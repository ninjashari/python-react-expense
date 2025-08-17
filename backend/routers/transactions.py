from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import uuid
import math
from decimal import Decimal
from datetime import date, datetime
from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.users import User
from models.learning import UserSelectionHistory
from schemas.transactions import (
    TransactionCreate, 
    TransactionUpdate, 
    TransactionResponse, 
    PaginatedTransactionsResponse,
    TransactionSummary,
    TransactionBulkUpdate
)
from utils.auth import get_current_active_user
from services.learning_service import TransactionLearningService

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

def calculate_balance_after_transaction(db: Session, account_id: uuid.UUID, amount: float, transaction_type: str):
    """Calculate what the account balance will be after applying this transaction"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Convert amount to Decimal to match the database field type
    amount_decimal = Decimal(str(amount))
    current_balance = account.balance
    
    if account.type == 'credit':
        # For credit cards: balance represents amount owed
        if transaction_type == "income":  # Payment to credit card
            new_balance = current_balance - amount_decimal  # Reduces debt
        elif transaction_type == "expense":  # Charge on credit card
            new_balance = current_balance + amount_decimal  # Increases debt
        else:
            new_balance = current_balance
    else:
        # For regular accounts: balance represents money available
        if transaction_type == "income":
            new_balance = current_balance + amount_decimal
        elif transaction_type == "expense":
            new_balance = current_balance - amount_decimal
        else:
            new_balance = current_balance
    
    return new_balance

@router.post("/", response_model=TransactionResponse)
async def create_transaction(
    transaction: TransactionCreate, 
    background_tasks: BackgroundTasks,
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
    
    # Calculate balance after transaction for both accounts (before updating actual balances)
    balance_after_transaction = None
    to_account_balance_after = None
    
    if transaction.type in ["income", "expense"]:
        balance_after_transaction = calculate_balance_after_transaction(
            db, transaction.account_id, transaction.amount, transaction.type
        )
    elif transaction.type == "transfer":
        # Calculate balance for source account (debit)
        balance_after_transaction = calculate_balance_after_transaction(
            db, transaction.account_id, transaction.amount, "expense"
        )
        # Calculate balance for destination account (credit)
        to_account_balance_after = calculate_balance_after_transaction(
            db, transaction.to_account_id, transaction.amount, "income"
        )
    
    try:
        # Create transaction with calculated balances
        transaction_data = transaction.dict()
        transaction_data['balance_after_transaction'] = balance_after_transaction
        transaction_data['to_account_balance_after'] = to_account_balance_after
        
        db_transaction = Transaction(**transaction_data, user_id=current_user.id)
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create transaction")
    
    # Update account balances (this should match the calculated balances above)
    if transaction.type in ["income", "expense"]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.type)
    elif transaction.type == "transfer":
        # Debit from source account
        update_account_balance(db, transaction.account_id, transaction.amount, "expense")
        # Credit to destination account
        update_account_balance(db, transaction.to_account_id, transaction.amount, "income")
    
    # 🧠 LEARNING TRIGGER for new transactions - Run asynchronously  
    if transaction.payee_id:
        background_tasks.add_task(
            TransactionLearningService.record_user_selection,
            db=db,
            user_id=str(current_user.id),
            transaction_id=str(db_transaction.id),
            field_type='payee',
            selected_value_id=str(transaction.payee_id),
            selected_value_name="",  # Will be looked up in service
            transaction_description=transaction.description,
            transaction_amount=float(transaction.amount),
            account_type=account.type,
            selection_method='form_create'
        )
    
    if transaction.category_id:
        background_tasks.add_task(
            TransactionLearningService.record_user_selection,
            db=db,
            user_id=str(current_user.id),
            transaction_id=str(db_transaction.id),
            field_type='category',
            selected_value_id=str(transaction.category_id),
            selected_value_name="",  # Will be looked up in service
            transaction_description=transaction.description,
            transaction_amount=float(transaction.amount),
            account_type=account.type,
            selection_method='form_create'
        )
    
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
        # Include transactions where the account is either source OR destination (for transfers)
        query = query.filter(
            (Transaction.account_id.in_(account_id_list)) | 
            (Transaction.to_account_id.in_(account_id_list))
        )
    
    if category_ids:
        category_id_parts = [id.strip() for id in category_ids.split(',') if id.strip()]
        if 'none' in category_id_parts:
            # Handle "none" case for transactions with no category
            other_ids = [uuid.UUID(id) for id in category_id_parts if id != 'none']
            if other_ids:
                # Filter for transactions with no category OR with specific category IDs
                query = query.filter(
                    (Transaction.category_id.is_(None)) | (Transaction.category_id.in_(other_ids))
                )
            else:
                # Filter only for transactions with no category
                query = query.filter(Transaction.category_id.is_(None))
        else:
            # Normal case: filter by specific category IDs
            category_id_list = [uuid.UUID(id) for id in category_id_parts]
            query = query.filter(Transaction.category_id.in_(category_id_list))
    
    if payee_ids:
        payee_id_parts = [id.strip() for id in payee_ids.split(',') if id.strip()]
        if 'none' in payee_id_parts:
            # Handle "none" case for transactions with no payee
            other_ids = [uuid.UUID(id) for id in payee_id_parts if id != 'none']
            if other_ids:
                # Filter for transactions with no payee OR with specific payee IDs
                query = query.filter(
                    (Transaction.payee_id.is_(None)) | (Transaction.payee_id.in_(other_ids))
                )
            else:
                # Filter only for transactions with no payee
                query = query.filter(Transaction.payee_id.is_(None))
        else:
            # Normal case: filter by specific payee IDs
            payee_id_list = [uuid.UUID(id) for id in payee_id_parts]
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
        # Include transactions where the account is either source OR destination (for transfers)
        query = query.filter(
            (Transaction.account_id.in_(account_id_list)) | 
            (Transaction.to_account_id.in_(account_id_list))
        )
    
    if category_ids:
        category_id_parts = [id.strip() for id in category_ids.split(',') if id.strip()]
        if 'none' in category_id_parts:
            # Handle "none" case for transactions with no category
            other_ids = [uuid.UUID(id) for id in category_id_parts if id != 'none']
            if other_ids:
                # Filter for transactions with no category OR with specific category IDs
                query = query.filter(
                    (Transaction.category_id.is_(None)) | (Transaction.category_id.in_(other_ids))
                )
            else:
                # Filter only for transactions with no category
                query = query.filter(Transaction.category_id.is_(None))
        else:
            # Normal case: filter by specific category IDs
            category_id_list = [uuid.UUID(id) for id in category_id_parts]
            query = query.filter(Transaction.category_id.in_(category_id_list))
    
    if payee_ids:
        payee_id_parts = [id.strip() for id in payee_ids.split(',') if id.strip()]
        if 'none' in payee_id_parts:
            # Handle "none" case for transactions with no payee
            other_ids = [uuid.UUID(id) for id in payee_id_parts if id != 'none']
            if other_ids:
                # Filter for transactions with no payee OR with specific payee IDs
                query = query.filter(
                    (Transaction.payee_id.is_(None)) | (Transaction.payee_id.in_(other_ids))
                )
            else:
                # Filter only for transactions with no payee
                query = query.filter(Transaction.payee_id.is_(None))
        else:
            # Normal case: filter by specific payee IDs
            payee_id_list = [uuid.UUID(id) for id in payee_id_parts]
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

@router.put("/bulk", response_model=List[TransactionResponse])
async def bulk_update_transactions(
    bulk_update: TransactionBulkUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update multiple transactions with the same changes"""
    updated_transactions = []
    
    try:
        for transaction_id in bulk_update.transaction_ids:
            # Get the transaction
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
                continue  # Skip transactions that don't exist or don't belong to user
            
            # Store original values for balance reversal and learning
            original_values = {
                'amount': transaction.amount,
                'type': transaction.type,
                'account_id': transaction.account_id,
                'to_account_id': transaction.to_account_id,
                'description': transaction.description,
                'payee_id': transaction.payee_id,
                'category_id': transaction.category_id
            }
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
            
            # Update transaction with only the fields that are set in the updates
            update_data = bulk_update.updates.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(transaction, field, value)
            
            # Calculate new balances after transaction (before updating actual balances)
            new_balance_after_transaction = None
            new_to_account_balance_after = None
            
            if transaction.type in ["income", "expense"]:
                new_balance_after_transaction = calculate_balance_after_transaction(
                    db, transaction.account_id, transaction.amount, transaction.type
                )
            elif transaction.type == "transfer":
                # Calculate balance for source account (debit)
                new_balance_after_transaction = calculate_balance_after_transaction(
                    db, transaction.account_id, transaction.amount, "expense"
                )
                # Calculate balance for destination account (credit)
                if transaction.to_account_id:
                    new_to_account_balance_after = calculate_balance_after_transaction(
                        db, transaction.to_account_id, transaction.amount, "income"
                    )
            
            # Update the calculated balances in the transaction
            transaction.balance_after_transaction = new_balance_after_transaction
            transaction.to_account_balance_after = new_to_account_balance_after
            
            # Apply new balance changes (this should match the calculated balances above)
            if transaction.type in ["income", "expense"]:
                update_account_balance(db, transaction.account_id, transaction.amount, transaction.type)
            elif transaction.type == "transfer":
                update_account_balance(db, transaction.account_id, transaction.amount, "expense")
                if transaction.to_account_id:
                    update_account_balance(db, transaction.to_account_id, transaction.amount, "income")
            
            updated_transactions.append(transaction)
            
            # 🧠 LEARNING TRIGGER - Run asynchronously
            new_values = bulk_update.updates.dict(exclude_unset=True)
            background_tasks.add_task(
                TransactionLearningService.learn_from_transaction_update,
                db=db,
                user_id=str(current_user.id),
                transaction_id=str(transaction_id),
                old_values=original_values,
                new_values=new_values,
                update_context={
                    'account_type': transaction.account.type,
                    'update_method': 'bulk_edit',
                    'timestamp': datetime.now()
                }
            )
        
        # Commit all changes at once
        db.commit()
        
        # Refresh all updated transactions
        for transaction in updated_transactions:
            db.refresh(transaction)
        
        return updated_transactions
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update transactions: {str(e)}")

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
async def update_transaction(
    transaction_id: uuid.UUID, 
    transaction_update: TransactionUpdate, 
    background_tasks: BackgroundTasks,
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
    
    # Store original values for balance reversal and learning
    original_values = {
        'amount': transaction.amount,
        'type': transaction.type,
        'account_id': transaction.account_id,
        'to_account_id': transaction.to_account_id,
        'description': transaction.description,
        'payee_id': transaction.payee_id,
        'category_id': transaction.category_id
    }
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
    
    # Calculate new balances after transaction (before updating actual balances)
    new_balance_after_transaction = None
    new_to_account_balance_after = None
    
    if transaction.type in ["income", "expense"]:
        new_balance_after_transaction = calculate_balance_after_transaction(
            db, transaction.account_id, transaction.amount, transaction.type
        )
    elif transaction.type == "transfer":
        # Calculate balance for source account (debit)
        new_balance_after_transaction = calculate_balance_after_transaction(
            db, transaction.account_id, transaction.amount, "expense"
        )
        # Calculate balance for destination account (credit)
        if transaction.to_account_id:
            new_to_account_balance_after = calculate_balance_after_transaction(
                db, transaction.to_account_id, transaction.amount, "income"
            )
    
    # Update transaction with new data and calculated balances
    update_data = transaction_update.dict(exclude_unset=True)
    update_data['balance_after_transaction'] = new_balance_after_transaction
    update_data['to_account_balance_after'] = new_to_account_balance_after
    
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    db.commit()
    
    # Apply new balance changes (this should match the calculated balances above)
    if transaction.type in ["income", "expense"]:
        update_account_balance(db, transaction.account_id, transaction.amount, transaction.type)
    elif transaction.type == "transfer":
        update_account_balance(db, transaction.account_id, transaction.amount, "expense")
        if transaction.to_account_id:
            update_account_balance(db, transaction.to_account_id, transaction.amount, "income")
    
    db.refresh(transaction)
    
    # 🧠 LEARNING TRIGGER - Run asynchronously
    new_values = transaction_update.dict(exclude_unset=True)
    background_tasks.add_task(
        TransactionLearningService.learn_from_transaction_update,
        db=db,
        user_id=str(current_user.id),
        transaction_id=str(transaction_id),
        old_values=original_values,
        new_values=new_values,
        update_context={
            'account_type': transaction.account.type,
            'update_method': 'inline_edit',  # vs 'form_edit'
            'timestamp': datetime.now()
        }
    )
    
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
    
    # Delete related learning history records to avoid foreign key constraint violation
    db.query(UserSelectionHistory).filter(
        UserSelectionHistory.transaction_id == transaction_id
    ).delete(synchronize_session=False)
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}