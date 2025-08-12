from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import uuid
import math
from decimal import Decimal
from datetime import date
from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.users import User
from schemas.transactions import (
    TransactionCreate, 
    TransactionUpdate, 
    TransactionResponse, 
    PaginatedTransactionsResponse,
    TransactionSummary
)
from utils.auth import get_current_active_user

router = APIRouter()

def update_account_balance(db: Session, account_id: uuid.UUID, amount: float, transaction_type: str, is_reversal: bool = False):
    """Update account balance based on transaction type and account type"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Convert amount to Decimal to match the database field type
    amount_decimal = Decimal(str(amount))
    multiplier = -1 if is_reversal else 1
    
    if account.type == 'credit':
        # For credit cards: balance represents amount owed
        # Income (payments) reduces the balance, Expense (charges) increases the balance
        if transaction_type == "income":  # Payment to credit card
            account.balance -= amount_decimal * multiplier  # Reduces debt
        elif transaction_type == "expense":  # Charge on credit card
            account.balance += amount_decimal * multiplier  # Increases debt
    else:
        # For regular accounts: balance represents money available
        if transaction_type == "income":
            account.balance += amount_decimal * multiplier
        elif transaction_type == "expense":
            account.balance -= amount_decimal * multiplier
    
    db.commit()
    return account

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Validate accounts exist
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if transaction.to_account_id:
        to_account = db.query(Account).filter(Account.id == transaction.to_account_id).first()
        if not to_account:
            raise HTTPException(status_code=404, detail="Destination account not found")
        
        if transaction.type != "transfer":
            raise HTTPException(status_code=400, detail="to_account_id can only be used with transfer transactions")
    
    try:
        db_transaction = Transaction(**transaction.dict(), user_id=current_user.id)
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create transaction")
    
    # Update account balances
    if transaction.type in ["income", "expense"]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.type)
    elif transaction.type == "transfer":
        # Debit from source account
        update_account_balance(db, transaction.account_id, transaction.amount, "expense")
        # Credit to destination account
        update_account_balance(db, transaction.to_account_id, transaction.amount, "income")
    
    return db_transaction

@router.get("/", response_model=PaginatedTransactionsResponse)
def get_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=500, description="Page size"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    payee_ids: Optional[str] = Query(None, description="Comma-separated payee IDs"),
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Build base query
    query = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    )
    
    # Apply filters
    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(Transaction.account_id.in_(account_id_list))
    
    if category_ids:
        category_id_list = [uuid.UUID(id.strip()) for id in category_ids.split(',') if id.strip()]
        query = query.filter(Transaction.category_id.in_(category_id_list))
    
    if payee_ids:
        payee_id_list = [uuid.UUID(id.strip()) for id in payee_ids.split(',') if id.strip()]
        query = query.filter(Transaction.payee_id.in_(payee_id_list))
    
    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    # Filter by current user
    query = query.filter(Transaction.user_id == current_user.id)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    skip = (page - 1) * size
    pages = math.ceil(total / size) if total > 0 else 0
    
    # Get paginated results
    transactions = query.order_by(Transaction.date.desc()).offset(skip).limit(size).all()
    
    return PaginatedTransactionsResponse(
        items=transactions,
        total=total,
        page=page,
        size=size,
        pages=pages
    )

@router.get("/summary", response_model=TransactionSummary)
def get_transaction_summary(
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    payee_ids: Optional[str] = Query(None, description="Comma-separated payee IDs"),
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Build base query
    query = db.query(Transaction)
    
    # Apply filters (same logic as get_transactions)
    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(Transaction.account_id.in_(account_id_list))
    
    if category_ids:
        category_id_list = [uuid.UUID(id.strip()) for id in category_ids.split(',') if id.strip()]
        query = query.filter(Transaction.category_id.in_(category_id_list))
    
    if payee_ids:
        payee_id_list = [uuid.UUID(id.strip()) for id in payee_ids.split(',') if id.strip()]
        query = query.filter(Transaction.payee_id.in_(payee_id_list))
    
    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    # Filter by current user
    query = query.filter(Transaction.user_id == current_user.id)
    
    # Calculate summary statistics
    income_sum = query.filter(Transaction.type == 'income').with_entities(func.sum(Transaction.amount)).scalar() or Decimal('0')
    expense_sum = query.filter(Transaction.type == 'expense').with_entities(func.sum(Transaction.amount)).scalar() or Decimal('0')
    transaction_count = query.count()
    net_amount = income_sum - expense_sum
    
    return TransactionSummary(
        total_income=income_sum,
        total_expense=expense_sum,
        net_amount=net_amount,
        transaction_count=transaction_count
    )

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transaction = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    ).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: uuid.UUID, 
    transaction_update: TransactionUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transaction = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    ).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Store original values for balance reversal
    original_amount = transaction.amount
    original_type = transaction.type
    original_account_id = transaction.account_id
    original_to_account_id = transaction.to_account_id
    
    # Reverse original balance changes
    if original_type in ["income", "expense"]:
        update_account_balance(db, original_account_id, original_amount, original_type, is_reversal=True)
    elif original_type == "transfer":
        update_account_balance(db, original_account_id, original_amount, "expense", is_reversal=True)
        if original_to_account_id:
            update_account_balance(db, original_to_account_id, original_amount, "income", is_reversal=True)
    
    # Update transaction
    update_data = transaction_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    db.commit()
    
    # Apply new balance changes
    if transaction.type in ["income", "expense"]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.type)
    elif transaction.type == "transfer":
        update_account_balance(db, transaction.account_id, transaction.amount, "expense")
        if transaction.to_account_id:
            update_account_balance(db, transaction.to_account_id, transaction.amount, "income")
    
    db.refresh(transaction)
    return transaction

@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: uuid.UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    ).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Reverse balance changes
    if transaction.type in ["income", "expense"]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.type, is_reversal=True)
    elif transaction.type == "transfer":
        update_account_balance(db, transaction.account_id, transaction.amount, "expense", is_reversal=True)
        if transaction.to_account_id:
            update_account_balance(db, transaction.to_account_id, transaction.amount, "income", is_reversal=True)
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}