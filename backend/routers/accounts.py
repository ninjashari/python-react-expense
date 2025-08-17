from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from decimal import Decimal
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
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    accounts = db.query(Account).filter(Account.user_id == current_user.id).offset(skip).limit(limit).all()
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