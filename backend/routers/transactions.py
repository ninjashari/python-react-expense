from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.transactions import Transaction, TransactionType
from models.accounts import Account
from schemas.transactions import TransactionCreate, TransactionUpdate, TransactionResponse

router = APIRouter()

def update_account_balance(db: Session, account_id: int, amount: float, transaction_type: TransactionType, is_reversal: bool = False):
    """Update account balance based on transaction type"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    multiplier = -1 if is_reversal else 1
    
    if transaction_type == TransactionType.DEPOSIT:
        account.balance += amount * multiplier
    elif transaction_type == TransactionType.WITHDRAWAL:
        account.balance -= amount * multiplier
    
    db.commit()
    return account

@router.post("/", response_model=TransactionResponse)
def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    # Validate accounts exist
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if transaction.to_account_id:
        to_account = db.query(Account).filter(Account.id == transaction.to_account_id).first()
        if not to_account:
            raise HTTPException(status_code=404, detail="Destination account not found")
        
        if transaction.transaction_type != TransactionType.TRANSFER:
            raise HTTPException(status_code=400, detail="to_account_id can only be used with transfer transactions")
    
    db_transaction = Transaction(**transaction.dict())
    db.add(db_transaction)
    db.commit()
    
    # Update account balances
    if transaction.transaction_type in [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.transaction_type)
    elif transaction.transaction_type == TransactionType.TRANSFER:
        # Debit from source account
        update_account_balance(db, transaction.account_id, transaction.amount, TransactionType.WITHDRAWAL)
        # Credit to destination account
        update_account_balance(db, transaction.to_account_id, transaction.amount, TransactionType.DEPOSIT)
    
    db.refresh(db_transaction)
    return db_transaction

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(
    skip: int = 0, 
    limit: int = 100, 
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    payee_id: Optional[int] = None,
    transaction_type: Optional[TransactionType] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if payee_id:
        query = query.filter(Transaction.payee_id == payee_id)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    transactions = query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()
    return transactions

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: int, transaction_update: TransactionUpdate, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Store original values for balance reversal
    original_amount = transaction.amount
    original_type = transaction.transaction_type
    original_account_id = transaction.account_id
    original_to_account_id = transaction.to_account_id
    
    # Reverse original balance changes
    if original_type in [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]:
        update_account_balance(db, original_account_id, original_amount, original_type, is_reversal=True)
    elif original_type == TransactionType.TRANSFER:
        update_account_balance(db, original_account_id, original_amount, TransactionType.WITHDRAWAL, is_reversal=True)
        if original_to_account_id:
            update_account_balance(db, original_to_account_id, original_amount, TransactionType.DEPOSIT, is_reversal=True)
    
    # Update transaction
    update_data = transaction_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    db.commit()
    
    # Apply new balance changes
    if transaction.transaction_type in [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.transaction_type)
    elif transaction.transaction_type == TransactionType.TRANSFER:
        update_account_balance(db, transaction.account_id, transaction.amount, TransactionType.WITHDRAWAL)
        if transaction.to_account_id:
            update_account_balance(db, transaction.to_account_id, transaction.amount, TransactionType.DEPOSIT)
    
    db.refresh(transaction)
    return transaction

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Reverse balance changes
    if transaction.transaction_type in [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.transaction_type, is_reversal=True)
    elif transaction.transaction_type == TransactionType.TRANSFER:
        update_account_balance(db, transaction.account_id, transaction.amount, TransactionType.WITHDRAWAL, is_reversal=True)
        if transaction.to_account_id:
            update_account_balance(db, transaction.to_account_id, transaction.amount, TransactionType.DEPOSIT, is_reversal=True)
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}