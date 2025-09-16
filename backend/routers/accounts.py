from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
from decimal import Decimal
import pandas as pd
import io
import json
from datetime import datetime
from database import get_db
from models.accounts import Account
from models.transactions import Transaction
from models.users import User
from schemas.accounts import AccountCreate, AccountUpdate, AccountResponse
from utils.auth import get_current_active_user
from routers.transactions import update_account_balance

router = APIRouter()

@router.post("/", response_model=AccountResponse)
def create_account(
    account: AccountCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        db_account = Account(**account.dict(), user_id=current_user.id)
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create account")

@router.get("/", response_model=List[AccountResponse])
def get_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Order by creation date descending (newest first) and return all accounts
    accounts = db.query(Account).filter(Account.user_id == current_user.id).order_by(Account.created_at.desc()).all()
    return accounts

@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    account = db.query(Account).filter(
        Account.id == account_id, 
        Account.user_id == current_user.id
    ).first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: uuid.UUID, 
    account_update: AccountUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == current_user.id
        ).first()
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
        
        update_data = account_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(account, field, value)
        
        db.commit()
        db.refresh(account)
        return account
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update account")

@router.delete("/{account_id}")
def delete_account(
    account_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.user_id == current_user.id
        ).first()
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
        
        db.delete(account)
        db.commit()
        return {"message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to delete account")

@router.post("/recalculate-balances")
def recalculate_all_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Recalculate balances for all user's accounts based on their transactions"""
    try:
        # Get all accounts for the current user
        accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
        updated_accounts = []
        
        for account in accounts:
            # Reset balance to 0
            account.balance = Decimal('0.00')
            db.commit()
            
            # Get all transactions for this account in chronological order
            # Include both transactions where this account is source OR destination
            transactions = db.query(Transaction).filter(
                (Transaction.account_id == account.id) | 
                (Transaction.to_account_id == account.id)
            ).order_by(Transaction.date, Transaction.created_at).all()
            
            # Apply each transaction to recalculate balance
            for txn in transactions:
                if txn.type in ['income', 'expense'] and txn.account_id == account.id:
                    # Regular income/expense transaction where this account is the source
                    update_account_balance(db, account.id, float(txn.amount), txn.type)
                elif txn.type == 'transfer':
                    if txn.account_id == account.id:
                        # This account is the source (debit/expense side)
                        update_account_balance(db, account.id, float(txn.amount), 'expense')
                    elif txn.to_account_id == account.id:
                        # This account is the destination (credit/income side)
                        update_account_balance(db, account.id, float(txn.amount), 'income')
            
            # Get updated balance
            db.refresh(account)
            updated_accounts.append({
                "account_id": account.id,
                "account_name": account.name,
                "account_type": account.type,
                "new_balance": float(account.balance),
                "transactions_processed": len(transactions)
            })
        
        return {
            "message": f"Successfully recalculated balances for {len(accounts)} accounts",
            "updated_accounts": updated_accounts
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to recalculate balances: {str(e)}")

@router.get("/export")
def export_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all accounts to Excel/CSV format"""
    try:
        # Get all accounts for the current user
        accounts = db.query(Account).filter(
            Account.user_id == current_user.id
        ).order_by(Account.name).all()
        
        if not accounts:
            raise HTTPException(status_code=404, detail="No accounts found to export")
        
        # Convert to DataFrame
        data = []
        for account in accounts:
            data.append({
                'Name': account.name,
                'Type': account.type,
                'Balance': float(account.balance) if account.balance else 0.0,
                'Opening Date': account.opening_date.strftime('%Y-%m-%d') if account.opening_date else '',
                'Account Number': account.account_number or '',
                'Card Number': account.card_number or '',
                'Card Expiry Month': account.card_expiry_month or '',
                'Card Expiry Year': account.card_expiry_year or '',
                'Credit Limit': float(account.credit_limit) if account.credit_limit else '',
                'Bill Generation Date': account.bill_generation_date or '',
                'Payment Due Date': account.payment_due_date or '',
                'Interest Rate': float(account.interest_rate) if account.interest_rate else '',
                'Status': account.status,
                'Currency': account.currency,
                'Created At': account.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            })
        
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Accounts')
        
        output.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": "attachment; filename=accounts_export.xlsx"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export accounts: {str(e)}")

@router.post("/import")
def import_accounts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import accounts from Excel/CSV file"""
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file format. Only Excel (.xlsx, .xls) and CSV files are supported."
            )
        
        # Read file content
        content = file.file.read()
        
        try:
            # Try to read as Excel first, then CSV
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            else:
                df = pd.read_excel(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read file: {str(e)}. Please ensure the file is not corrupted."
            )
        
        # Validate required columns
        required_columns = ['Name', 'Type']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}. Required: {', '.join(required_columns)}"
            )
        
        # Clean and validate data
        df = df.dropna(subset=['Name'])  # Remove rows with empty names
        df['Name'] = df['Name'].astype(str).str.strip()  # Clean names
        df = df[df['Name'] != '']  # Remove empty names after cleaning
        
        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="No valid account data found in the file"
            )
        
        # Valid account types
        valid_account_types = ['checking', 'savings', 'credit', 'cash', 'investment', 'ppf']
        
        # Track results
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                name = row['Name']
                account_type = row.get('Type', '').lower()
                
                # Validate account type
                if account_type not in valid_account_types:
                    errors.append(f"Row {index + 2}: Invalid account type '{account_type}'. Must be one of: {', '.join(valid_account_types)}")
                    continue
                
                # Check if account already exists (case-insensitive)
                existing_account = db.query(Account).filter(
                    Account.name.ilike(name),
                    Account.user_id == current_user.id
                ).first()
                
                if existing_account:
                    # Update existing account with provided fields
                    updated = False
                    
                    # Update fields if different
                    if account_type != existing_account.type:
                        existing_account.type = account_type
                        updated = True
                    
                    if 'Balance' in row and pd.notna(row['Balance']):
                        new_balance = Decimal(str(row['Balance']))
                        if new_balance != existing_account.balance:
                            existing_account.balance = new_balance
                            updated = True
                    
                    # Update optional fields
                    optional_fields = {
                        'account_number': 'Account Number',
                        'card_number': 'Card Number',
                        'card_expiry_month': 'Card Expiry Month',
                        'card_expiry_year': 'Card Expiry Year',
                        'bill_generation_date': 'Bill Generation Date',
                        'payment_due_date': 'Payment Due Date',
                        'status': 'Status',
                        'currency': 'Currency'
                    }
                    
                    for field, col_name in optional_fields.items():
                        if col_name in row and pd.notna(row[col_name]) and str(row[col_name]).strip():
                            new_value = str(row[col_name]).strip()
                            if new_value != str(getattr(existing_account, field) or ''):
                                setattr(existing_account, field, new_value)
                                updated = True
                    
                    # Handle decimal fields
                    decimal_fields = {
                        'credit_limit': 'Credit Limit',
                        'interest_rate': 'Interest Rate'
                    }
                    
                    for field, col_name in decimal_fields.items():
                        if col_name in row and pd.notna(row[col_name]):
                            try:
                                new_value = Decimal(str(row[col_name]))
                                if new_value != getattr(existing_account, field):
                                    setattr(existing_account, field, new_value)
                                    updated = True
                            except:
                                pass  # Skip invalid decimal values
                    
                    # Handle opening date
                    if 'Opening Date' in row and pd.notna(row['Opening Date']):
                        try:
                            if isinstance(row['Opening Date'], str):
                                opening_date = datetime.strptime(row['Opening Date'], '%Y-%m-%d').date()
                            else:
                                opening_date = row['Opening Date']
                            if opening_date != existing_account.opening_date:
                                existing_account.opening_date = opening_date
                                updated = True
                        except:
                            pass  # Skip invalid dates
                    
                    if updated:
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    # Create new account
                    account_data = {
                        'name': name,
                        'type': account_type,
                        'user_id': current_user.id
                    }
                    
                    # Add optional fields
                    if 'Balance' in row and pd.notna(row['Balance']):
                        account_data['balance'] = Decimal(str(row['Balance']))
                    
                    if 'Opening Date' in row and pd.notna(row['Opening Date']):
                        try:
                            if isinstance(row['Opening Date'], str):
                                account_data['opening_date'] = datetime.strptime(row['Opening Date'], '%Y-%m-%d').date()
                            else:
                                account_data['opening_date'] = row['Opening Date']
                        except:
                            pass
                    
                    # String fields
                    string_fields = {
                        'account_number': 'Account Number',
                        'card_number': 'Card Number',
                        'status': 'Status',
                        'currency': 'Currency'
                    }
                    
                    for field, col_name in string_fields.items():
                        if col_name in row and pd.notna(row[col_name]):
                            account_data[field] = str(row[col_name]).strip()
                    
                    # Integer fields
                    int_fields = {
                        'card_expiry_month': 'Card Expiry Month',
                        'card_expiry_year': 'Card Expiry Year',
                        'bill_generation_date': 'Bill Generation Date',
                        'payment_due_date': 'Payment Due Date'
                    }
                    
                    for field, col_name in int_fields.items():
                        if col_name in row and pd.notna(row[col_name]):
                            try:
                                account_data[field] = int(row[col_name])
                            except:
                                pass
                    
                    # Decimal fields
                    decimal_fields = {
                        'credit_limit': 'Credit Limit',
                        'interest_rate': 'Interest Rate'
                    }
                    
                    for field, col_name in decimal_fields.items():
                        if col_name in row and pd.notna(row[col_name]):
                            try:
                                account_data[field] = Decimal(str(row[col_name]))
                            except:
                                pass
                    
                    new_account = Account(**account_data)
                    db.add(new_account)
                    created_count += 1
                    
            except Exception as row_error:
                errors.append(f"Row {index + 2}: {str(row_error)}")
                continue
        
        # Commit all changes
        db.commit()
        
        return {
            "message": f"Import completed successfully",
            "total_rows": len(df),
            "created_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "error_count": len(errors),
            "errors": errors[:10]  # Limit to first 10 errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import accounts: {str(e)}")