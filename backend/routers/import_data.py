from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
import pandas as pd
import io
from datetime import datetime
import openpyxl
from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.payees import Payee
from models.categories import Category
from models.users import User
from schemas.transactions import TransactionCreate
from utils.auth import get_current_active_user
from routers.transactions import update_account_balance

router = APIRouter()

def parse_csv_data(file_content: bytes) -> pd.DataFrame:
    """Parse CSV file and return DataFrame"""
    try:
        df = pd.read_csv(io.BytesIO(file_content))
        return df
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")

def parse_excel_data(file_content: bytes) -> pd.DataFrame:
    """Parse Excel file and return DataFrame with smart header detection"""
    try:
        # First, try standard reading
        df = pd.read_excel(io.BytesIO(file_content))
        
        # Check if this looks like a bank statement by looking at column names
        # Support for ICICI and SBI bank formats
        bank_header_found = False
        bank_type = None
        header_row = 0
        
        # Check if current column headers match known bank formats
        column_names = [str(col).lower().strip() for col in df.columns]
        column_str = ' '.join(column_names)
        
        # SBI specific patterns in column headers
        if ('txn date' in column_str and 'debit' in column_str and 'credit' in column_str and 'balance' in column_str):
            print(f"Found SBI bank format headers at row 0 (columns)")
            bank_header_found = True
            bank_type = 'SBI'
        # ICICI specific patterns in column headers
        elif ('transaction date' in column_str and 'withdrawal amount' in column_str and 'deposit amount' in column_str):
            print(f"Found ICICI bank format headers at row 0 (columns)")
            bank_header_found = True
            bank_type = 'ICICI'
        elif ('s no.' in column_str and 'transaction remarks' in column_str):
            print(f"Found ICICI bank format headers at row 0 (columns)")
            bank_header_found = True
            bank_type = 'ICICI'
        else:
            # Fallback: scan first 20 rows for bank-style headers
            for i in range(min(20, len(df))):
                row_values = [str(val).lower().strip() for val in df.iloc[i].values if pd.notna(val)]
                row_str = ' '.join(row_values)
                
                # SBI specific patterns
                if ('txn date' in row_str and 'debit' in row_str and 'credit' in row_str):
                    print(f"Found SBI bank format headers at row {i}")
                    header_row = i
                    bank_header_found = True
                    bank_type = 'SBI'
                    break
                # ICICI specific patterns
                elif ('transaction date' in row_str and 'withdrawal amount' in row_str and 'deposit amount' in row_str):
                    print(f"Found ICICI bank format headers at row {i}")
                    header_row = i
                    bank_header_found = True
                    bank_type = 'ICICI'
                    break
                elif ('s no.' in row_str and 'transaction remarks' in row_str):
                    print(f"Found ICICI bank format headers at row {i}")
                    header_row = i
                    bank_header_found = True
                    bank_type = 'ICICI'
                    break
        
        # If bank format detected, handle accordingly
        if bank_header_found:
            if header_row > 0:
                # Re-read with proper header
                df = pd.read_excel(io.BytesIO(file_content), skiprows=header_row, date_format=None)
                # Clean up column names - remove extra spaces and standardize
                df.columns = [str(col).strip() if pd.notna(col) else f'Unnamed_{i}' 
                             for i, col in enumerate(df.columns)]
            else:
                # Headers are already at row 0, just ensure proper formatting
                df.columns = [str(col).strip() if pd.notna(col) else f'Unnamed_{i}' 
                             for i, col in enumerate(df.columns)]
            
            # Remove completely empty rows
            df = df.dropna(how='all')
            
            # Handle date columns based on bank type
            for col in df.columns:
                col_lower = str(col).lower().strip()
                if (bank_type == 'ICICI' and ('transaction date' in col_lower or 'value date' in col_lower)) or \
                   (bank_type == 'SBI' and ('txn date' in col_lower or 'value date' in col_lower)) or \
                   'date' in col_lower:
                    # Convert date column to string to preserve original format
                    df[col] = df[col].astype(str)
                    # Clean up any Excel date serial numbers that got converted
                    df[col] = df[col].replace('nan', '')
            
            # Replace NaN values with empty strings to avoid JSON serialization issues
            df = df.fillna('')
            
            print(f"{bank_type} format detected. Final columns: {list(df.columns)}")
            print(f"Data shape: {df.shape}")
            
            # Print sample date values for debugging
            date_col = None
            for col in df.columns:
                col_lower = str(col).lower().strip()
                if (bank_type == 'ICICI' and 'transaction date' in col_lower) or \
                   (bank_type == 'SBI' and 'txn date' in col_lower):
                    date_col = col
                    break
            if date_col and len(df) > 0:
                print(f"Sample date values from {date_col}: {df[date_col].head(3).tolist()}")
        
        # Always clean NaN values to prevent JSON serialization errors
        df = df.fillna('')
        
        return df
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel: {str(e)}")


def process_transactions_data(
    df: pd.DataFrame,
    db: Session,
    current_user: User,
    account_id: uuid.UUID,
    date_column: str,
    amount_column: str,
    description_column: str,
    payee_column: Optional[str] = None,
    category_column: Optional[str] = None,
    transaction_type_column: Optional[str] = None,
    withdrawal_column: Optional[str] = None,
    deposit_column: Optional[str] = None,
    default_transaction_type: str = "expense",
    reward_points_column: Optional[str] = None
) -> tuple[int, List[str]]:
    """Process DataFrame rows and create transactions"""

    transactions_created = 0
    errors = []

    for index, row in df.iterrows():
        try:
            # Parse date - restrict to DD/MM/YYYY or DD-MM-YYYY format
            date_value = str(row[date_column]).strip()
            try:
                transaction_date = pd.to_datetime(date_value, format='%d/%m/%Y').date()
            except (ValueError, TypeError):
                try:
                    transaction_date = pd.to_datetime(date_value, format='%d-%m-%Y').date()
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid date format '{date_value}'. Please use DD/MM/YYYY or DD-MM-YYYY format.")

            # Handle amount parsing
            if withdrawal_column and deposit_column:
                withdrawal_amt = float(row[withdrawal_column]) if pd.notna(row[withdrawal_column]) and str(row[withdrawal_column]).strip() != '' else 0.0
                deposit_amt = float(row[deposit_column]) if pd.notna(row[deposit_column]) and str(row[deposit_column]).strip() != '' else 0.0
                if withdrawal_amt > 0:
                    amount = withdrawal_amt
                    transaction_type = 'expense'
                elif deposit_amt > 0:
                    amount = deposit_amt
                    transaction_type = 'income'
                else:
                    continue
            else:
                amount = float(row[amount_column])
                transaction_type = default_transaction_type

            description = str(row[description_column]) if pd.notna(row[description_column]) else ""

            # Extract reward points if column specified
            reward_points = None
            if reward_points_column and reward_points_column in df.columns:
                raw_pts = row.get(reward_points_column, '')
                if pd.notna(raw_pts) and str(raw_pts).strip() not in ('', 'nan'):
                    try:
                        reward_points = int(float(str(raw_pts).strip()))
                    except (ValueError, TypeError):
                        reward_points = None

            # Override transaction type from column if provided
            if transaction_type_column and transaction_type_column in df.columns:
                type_value = str(row[transaction_type_column]).lower().strip()
                if type_value in ['income', 'expense', 'transfer']:
                    transaction_type = type_value

            if transaction_type not in ['income', 'expense', 'transfer']:
                transaction_type = 'expense'

            # Look up payee by name from the mapped column
            payee_id = None
            if payee_column and payee_column in df.columns:
                payee_name = str(row[payee_column]).strip()
                if payee_name and payee_name.lower() != 'nan':
                    payee = db.query(Payee).filter(
                        Payee.user_id == current_user.id,
                        Payee.name == payee_name
                    ).first()
                    if payee:
                        payee_id = payee.id

            # Look up category by name from the mapped column
            category_id = None
            if category_column and category_column in df.columns:
                category_name = str(row[category_column]).strip()
                if category_name and category_name.lower() != 'nan':
                    category = db.query(Category).filter(
                        Category.user_id == current_user.id,
                        Category.name == category_name
                    ).first()
                    if category:
                        category_id = category.id

            transaction_data = TransactionCreate(
                date=transaction_date,
                amount=abs(amount),
                description=description,
                type=transaction_type,
                account_id=account_id,
                payee_id=payee_id,
                category_id=category_id,
                reward_points=reward_points
            )

            db_transaction = Transaction(**transaction_data.model_dump(), user_id=current_user.id)
            db.add(db_transaction)
            update_account_balance(db, account_id, abs(amount), transaction_type)
            transactions_created += 1

        except Exception as e:
            errors.append(f"Row {index + 1}: {str(e)}")

    return transactions_created, errors

@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    default_transaction_type: str = Form("expense"),
    reward_points_column: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import transactions from CSV file"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    df = parse_csv_data(content)
    
    # Validate required columns exist
    required_columns = [date_column, amount_column, description_column]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    transactions_created, errors = process_transactions_data(
        df=df,
        db=db,
        current_user=current_user,
        account_id=account_id,
        date_column=date_column,
        amount_column=amount_column,
        description_column=description_column,
        payee_column=payee_column,
        category_column=category_column,
        transaction_type_column=transaction_type_column,
        withdrawal_column=None,
        deposit_column=None,
        default_transaction_type=default_transaction_type,
        reward_points_column=reward_points_column
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "message": f"Successfully imported {transactions_created} transactions",
        "transactions_created": transactions_created,
        "errors": errors
    }

@router.post("/excel")
async def import_excel(
    file: UploadFile = File(...),
    account_id: uuid.UUID = Form(...),
    sheet_name: Optional[str] = Form(None),
    date_column: str = Form("date"),
    amount_column: str = Form("amount"),
    description_column: str = Form("description"),
    payee_column: Optional[str] = Form(None),
    category_column: Optional[str] = Form(None),
    transaction_type_column: Optional[str] = Form(None),
    withdrawal_column: Optional[str] = Form(None),
    deposit_column: Optional[str] = Form(None),
    default_transaction_type: str = Form("expense"),
    reward_points_column: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import transactions from Excel file"""
    
    # Verify account exists and belongs to current user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    content = await file.read()
    
    try:
        # Use the same parsing function as column mapping to support ICICI format
        df = parse_excel_data(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
    
    # Validate required columns exist - either amount_column OR (withdrawal_column + deposit_column)
    required_columns = [date_column, description_column]
    if withdrawal_column and deposit_column:
        # ICICI style: separate withdrawal and deposit columns
        required_columns.extend([withdrawal_column, deposit_column])
    else:
        # Standard style: single amount column
        required_columns.append(amount_column)
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
    
    transactions_created, errors = process_transactions_data(
        df=df,
        db=db,
        current_user=current_user,
        account_id=account_id,
        date_column=date_column,
        amount_column=amount_column,
        description_column=description_column,
        payee_column=payee_column,
        category_column=category_column,
        transaction_type_column=transaction_type_column,
        withdrawal_column=withdrawal_column,
        deposit_column=deposit_column,
        default_transaction_type=default_transaction_type,
        reward_points_column=reward_points_column
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "message": f"Successfully imported {transactions_created} transactions",
        "transactions_created": transactions_created,
        "errors": errors
    }

@router.post("/column-mapping/{file_type}")
async def get_suggested_column_mapping(
    file_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Analyze uploaded file and suggest column mappings"""
    
    content = await file.read()
    
    try:
        if file_type.lower() == "csv":
            df = parse_csv_data(content)
        elif file_type.lower() in ["xlsx", "xls", "excel"]:
            df = parse_excel_data(content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Filter out completely empty/unnamed columns and clean column names
    cleaned_columns = []
    for col in df.columns:
        col_str = str(col).strip()
        if col_str and col_str != 'nan' and not col_str.startswith('Unnamed'):
            cleaned_columns.append(col_str)
        elif col_str.startswith('Unnamed') and df[col].notna().any():
            # Keep unnamed columns that have data
            cleaned_columns.append(col_str)
    
    # If we lost too many columns, fall back to original
    if len(cleaned_columns) < 3:
        columns = [str(col) for col in df.columns.tolist()]
    else:
        columns = cleaned_columns
        # Update dataframe to only include these columns
        df = df[columns]
    
    # Clean up sample data - replace NaN with empty strings
    sample_data = df.head(3).fillna('').to_dict('records')
    
    # Enhanced heuristics for column mapping suggestions including ICICI and SBI bank formats
    suggestions = {}
    
    for col in columns:
        col_lower = col.lower().strip()
        col_str = str(col).lower().strip()
        
        # Date column detection - prioritize bank-specific date columns
        if 'transaction date' in col_lower:  # ICICI format
            suggestions['date'] = col
        elif 'txn date' in col_lower:  # SBI format
            suggestions['date'] = col
        elif any(keyword in col_lower for keyword in ['value date', 'date', 'time', 'when']) and 'date' not in suggestions:
            suggestions['date'] = col
        # Amount column detection (single amount column)
        elif any(keyword in col_lower for keyword in ['amount', 'value', 'sum', 'total']) and 'withdrawal' not in col_lower and 'deposit' not in col_lower and 'debit' not in col_lower and 'credit' not in col_lower:
            suggestions['amount'] = col
        # Bank specific: Withdrawal/Debit columns
        elif 'withdrawal amount (inr' in col_lower or (any(keyword in col_lower for keyword in ['withdrawal']) and 'amount' in col_lower):
            suggestions['withdrawal'] = col
        elif 'debit' in col_lower and ('amount' in col_lower or col_lower.strip() == 'debit' or 'debit' in col_lower):  # SBI format
            suggestions['withdrawal'] = col
        # Bank specific: Deposit/Credit columns  
        elif 'deposit amount (inr' in col_lower or (any(keyword in col_lower for keyword in ['deposit']) and 'amount' in col_lower):
            suggestions['deposit'] = col
        elif 'credit' in col_lower and ('amount' in col_lower or col_lower.strip() == 'credit' or 'credit' in col_lower):  # SBI format
            suggestions['deposit'] = col
        # Description/Remarks column - bank specific priorities
        elif 'transaction remarks' in col_lower:  # ICICI format
            suggestions['description'] = col
        elif 'description' in col_lower:  # SBI and general format
            suggestions['description'] = col
        elif any(keyword in col_lower for keyword in ['desc', 'memo', 'note', 'remarks', 'particulars', 'narration']) and 'description' not in suggestions:
            suggestions['description'] = col
        # Payee column
        elif any(keyword in col_lower for keyword in ['payee', 'merchant', 'vendor', 'to', 'from']):
            suggestions['payee'] = col
        # Category column
        elif any(keyword in col_lower for keyword in ['category', 'type', 'class']) and 'transaction' not in col_lower:
            suggestions['category'] = col
        # Balance column
        elif any(keyword in col_lower for keyword in ['balance', 'running balance']):
            suggestions['balance'] = col
        # Reward points column
        elif col_lower in ('reward_points', 'reward points', 'points', 'reward', 'rewards', 'loyalty points'):
            suggestions['reward_points'] = col
    
    # If we found both withdrawal and deposit columns, don't suggest a single amount column
    if 'withdrawal' in suggestions and 'deposit' in suggestions:
        suggestions.pop('amount', None)
    
    # If we have transaction date, use it over other date columns
    transaction_date_col = None
    for col in columns:
        if 'transaction date' in col.lower():
            transaction_date_col = col
            break
    if transaction_date_col:
        suggestions['date'] = transaction_date_col
    
    # Final cleanup - ensure no NaN values in the response
    cleaned_sample_data = []
    for row in sample_data:
        cleaned_row = {}
        for key, value in row.items():
            if pd.isna(value) or value is None:
                cleaned_row[key] = ""
            else:
                cleaned_row[key] = str(value) if not isinstance(value, (int, float, bool)) else value
        cleaned_sample_data.append(cleaned_row)
    
    # Clean suggestions dictionary
    cleaned_suggestions = {k: v for k, v in suggestions.items() if v is not None and str(v) != 'nan'}
    
    return {
        "columns": columns,
        "sample_data": cleaned_sample_data,
        "suggested_mappings": cleaned_suggestions
    }


