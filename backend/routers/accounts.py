from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from database import get_db
from models.accounts import Account
from models.users import User
from schemas.accounts import AccountCreate, AccountUpdate, AccountResponse
from utils.auth import get_current_active_user

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