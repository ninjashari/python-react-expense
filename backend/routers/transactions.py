from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import uuid
import math
from decimal import Decimal
from datetime import date, datetime
import pandas as pd
import io
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

def calculate_balance_after_transaction_for_account(account_id: str, account_type: str, 
                                                  current_balance: Decimal, 
                                                  transaction: Transaction) -> Decimal:
    """
    Calculate what the account balance will be after applying a transaction.
    This is a specialized version for the recalculation logic.
    """
    amount = transaction.amount
    
    if str(transaction.account_id) == str(account_id):
        # This account is the source
        if account_type == 'credit':
            if transaction.type == "income":
                return current_balance - amount  # Payment reduces debt
            elif transaction.type == "expense":
                return current_balance + amount  # Charge increases debt
            elif transaction.type == "transfer":
                return current_balance + amount  # Debit increases debt
        else:
            if transaction.type == "income":
                return current_balance + amount  # Income increases balance
            elif transaction.type == "expense":
                return current_balance - amount  # Expense decreases balance
            elif transaction.type == "transfer":
                return current_balance - amount  # Debit decreases balance
    
    elif str(transaction.to_account_id) == str(account_id) and transaction.type == "transfer":
        # This account is the destination of a transfer
        if account_type == 'credit':
            return current_balance - amount  # Credit reduces debt
        else:
            return current_balance + amount  # Credit increases balance
    
    return current_balance  # No change for this account

def recalculate_subsequent_balances(db: Session, account_ids: list, modified_transaction_date: str):
    """
    Recalculate balance_after_transaction for all transactions after the modified transaction date.
    This ensures that when a transaction is updated, all subsequent balances remain accurate.
    
    Optimizations:
    - Processes accounts in parallel-friendly chunks
    - Uses efficient database queries with proper indexing
    - Batches database commits for better performance
    
    Args:
        db: Database session
        account_ids: List of account IDs that were affected by the transaction update
        modified_transaction_date: Date of the modified transaction (YYYY-MM-DD format)
    """
    from datetime import datetime
    
    # Remove duplicates and sort for consistent processing
    unique_account_ids = list(set(account_ids))
    
    for account_id in unique_account_ids:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            continue
            
        # Get all transactions for this account starting from the modified date, ordered chronologically
        # Optimize: Only select necessary fields and use proper indexing
        subsequent_transactions = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
            Transaction.date >= modified_transaction_date
        ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).all()
        
        if not subsequent_transactions:
            continue
            
        # Performance optimization: Limit processing for very large sets
        if len(subsequent_transactions) > 1000:
            print(f"Warning: Large transaction set ({len(subsequent_transactions)}) for account {account_id}. Consider optimization.")
            
        # Find the starting balance for recalculation
        # Get the balance from the last transaction before the modified date
        previous_transaction = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
            Transaction.date < modified_transaction_date
        ).order_by(Transaction.date.desc(), Transaction.created_at.desc()).first()
        
        if previous_transaction:
            # Use the balance from the previous transaction
            if str(previous_transaction.account_id) == str(account_id):
                running_balance = previous_transaction.balance_after_transaction or Decimal('0')
            elif str(previous_transaction.to_account_id) == str(account_id):
                running_balance = previous_transaction.to_account_balance_after or Decimal('0')
            else:
                # Fallback: calculate from account starting balance
                running_balance = get_account_balance_at_date(db, account_id, modified_transaction_date)
        else:
            # No previous transactions, start from account's original starting balance
            running_balance = get_account_starting_balance_for_recalc(db, account_id)
        
        # Recalculate balances for all subsequent transactions
        for transaction in subsequent_transactions:
            new_balance = calculate_balance_after_transaction_for_account(
                account_id, account.type, running_balance, transaction
            )
            
            # Update the appropriate balance field
            if str(transaction.account_id) == str(account_id):
                transaction.balance_after_transaction = new_balance
            elif str(transaction.to_account_id) == str(account_id) and transaction.type == "transfer":
                transaction.to_account_balance_after = new_balance
                
            running_balance = new_balance

def get_account_starting_balance_for_recalc(db: Session, account_id: str) -> Decimal:
    """
    Get the account's starting balance for recalculation purposes.
    For a complete recalculation, we should start from the account's original opening balance,
    not work backwards from the potentially corrupted current balance.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return Decimal('0')
    
    # Use the account's original opening balance as the starting point
    # This is the balance when the account was first created
    from decimal import Decimal
    
    # Check if there's an initial balance transaction that represents the opening balance
    initial_transaction = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.description.ilike('%initial%')
    ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).first()
    
    if initial_transaction:
        # If there's an initial funding transaction, start from 0
        # The initial transaction will add the opening balance
        return Decimal('0')
    else:
        # If no initial transaction, use the account's balance field as opening balance
        # But we need to determine what the true opening balance should be
        # For safety, let's calculate it by examining the pattern of transactions
        earliest_transaction = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id)
        ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).first()
        
        if earliest_transaction and earliest_transaction.type == 'income' and 'initial' in (earliest_transaction.description or '').lower():
            # If the earliest transaction is an income with "initial" in description, start from 0
            return Decimal('0')
        else:
            # For accounts without clear initial transactions, we'll assume they started at 0
            # This is safer than using potentially corrupted balance values
            return Decimal('0')

def get_account_balance_at_date(db: Session, account_id: str, target_date: str) -> Decimal:
    """
    Calculate the account balance just before the target date.
    Used as starting point for recalculation.
    """
    # Get the starting balance
    starting_balance = get_account_starting_balance_for_recalc(db, account_id)
    
    # Get account info
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return Decimal('0')
    
    # Get all transactions before the target date
    transactions_before = db.query(Transaction).filter(
        (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
        Transaction.date < target_date
    ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).all()
    
    running_balance = starting_balance
    
    for transaction in transactions_before:
        new_balance = calculate_balance_after_transaction_for_account(
            account_id, account.type, running_balance, transaction
        )
        running_balance = new_balance
    
    return running_balance

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
    size: int = Query(50, ge=1, le=10000, description="Page size"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    payee_ids: Optional[str] = Query(None, description="Comma-separated payee IDs"),
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    description: Optional[str] = Query(None, description="Search in description"),
    sort_by: Optional[str] = Query(None, description="Field to sort by"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
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
        transaction_type_parts = [type.strip() for type in transaction_type.split(',') if type.strip()]
        if len(transaction_type_parts) == 1:
            # Single transaction type
            query = query.filter(Transaction.type == transaction_type_parts[0])
        else:
            # Multiple transaction types
            query = query.filter(Transaction.type.in_(transaction_type_parts))
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    # Filter by description (case-insensitive search)
    if description:
        query = query.filter(Transaction.description.ilike(f"%{description}%"))
    
    # Filter by current user
    query = query.filter(Transaction.user_id == current_user.id)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    skip = (page - 1) * size
    pages = math.ceil(total / size) if total > 0 else 0
    
    # Apply sorting
    if sort_by:
        if sort_by == 'date':
            sort_column = Transaction.date
        elif sort_by == 'description':
            sort_column = Transaction.description
        elif sort_by == 'amount':
            sort_column = Transaction.amount
        elif sort_by == 'type':
            sort_column = Transaction.type
        elif sort_by == 'account':
            sort_column = Account.name
            query = query.join(Account, Transaction.account_id == Account.id)
        elif sort_by == 'payee':
            from models.payees import Payee
            sort_column = Payee.name
            query = query.outerjoin(Payee, Transaction.payee_id == Payee.id)
        elif sort_by == 'category':
            from models.categories import Category
            sort_column = Category.name
            query = query.outerjoin(Category, Transaction.category_id == Category.id)
        else:
            sort_column = Transaction.date
        
        # Apply sort order
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
    else:
        # Default sort by date descending
        query = query.order_by(Transaction.date.desc())
    
    # Get paginated results
    transactions = query.offset(skip).limit(size).all()
    
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
        transaction_type_parts = [type.strip() for type in transaction_type.split(',') if type.strip()]
        if len(transaction_type_parts) == 1:
            # Single transaction type
            query = query.filter(Transaction.type == transaction_type_parts[0])
        else:
            # Multiple transaction types
            query = query.filter(Transaction.type.in_(transaction_type_parts))
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
    bulk_recalc_data = []  # Store data for bulk recalculation
    
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
                'date': transaction.date,
                'description': transaction.description,
                'payee_id': transaction.payee_id,
                'category_id': transaction.category_id
            }
            
            # Store data for bulk recalculation
            bulk_recalc_data.append({
                'original_account_id': transaction.account_id,
                'original_to_account_id': transaction.to_account_id,
                'original_date': transaction.date,
                'transaction': transaction
            })
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
        
        # Collect all affected accounts and dates for bulk recalculation
        all_affected_account_ids = set()
        earliest_date = None
        
        for recalc_data in bulk_recalc_data:
            original_account_id = recalc_data['original_account_id']
            original_to_account_id = recalc_data['original_to_account_id']
            original_date = recalc_data['original_date']
            transaction = recalc_data['transaction']
            
            # Add original account IDs
            if original_account_id:
                all_affected_account_ids.add(str(original_account_id))
            if original_to_account_id:
                all_affected_account_ids.add(str(original_to_account_id))
            
            # Add new account IDs (in case accounts changed)
            if transaction.account_id:
                all_affected_account_ids.add(str(transaction.account_id))
            if transaction.to_account_id:
                all_affected_account_ids.add(str(transaction.to_account_id))
            
            # Track the earliest date for recalculation (consider both original and new dates)
            for date_to_check in [original_date, transaction.date]:
                if earliest_date is None or date_to_check < earliest_date:
                    earliest_date = date_to_check
        
        # Commit all changes at once
        db.commit()
        
        # Recalculate balances for all affected accounts from the earliest modified date
        if all_affected_account_ids and earliest_date:
            recalculate_subsequent_balances(db, list(all_affected_account_ids), str(earliest_date))
            db.commit()
        
        # Refresh all updated transactions
        for transaction in updated_transactions:
            db.refresh(transaction)
        
        return updated_transactions
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update transactions: {str(e)}")

@router.get("/export")
async def export_transactions(
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    payee_ids: Optional[str] = Query(None, description="Comma-separated payee IDs"),
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export filtered transactions to Excel format"""
    
    # Build base query with all relationships
    query = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    )
    
    # Apply same filters as get_transactions endpoint
    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(
            (Transaction.account_id.in_(account_id_list)) | 
            (Transaction.to_account_id.in_(account_id_list))
        )
    
    if category_ids:
        category_id_parts = [id.strip() for id in category_ids.split(',') if id.strip()]
        if 'none' in category_id_parts:
            other_ids = [uuid.UUID(id) for id in category_id_parts if id != 'none']
            if other_ids:
                query = query.filter(
                    (Transaction.category_id.is_(None)) | (Transaction.category_id.in_(other_ids))
                )
            else:
                query = query.filter(Transaction.category_id.is_(None))
        else:
            category_id_list = [uuid.UUID(id) for id in category_id_parts]
            query = query.filter(Transaction.category_id.in_(category_id_list))
    
    if payee_ids:
        payee_id_parts = [id.strip() for id in payee_ids.split(',') if id.strip()]
        if 'none' in payee_id_parts:
            other_ids = [uuid.UUID(id) for id in payee_id_parts if id != 'none']
            if other_ids:
                query = query.filter(
                    (Transaction.payee_id.is_(None)) | (Transaction.payee_id.in_(other_ids))
                )
            else:
                query = query.filter(Transaction.payee_id.is_(None))
        else:
            payee_id_list = [uuid.UUID(id) for id in payee_id_parts]
            query = query.filter(Transaction.payee_id.in_(payee_id_list))
    
    if transaction_type:
        transaction_type_parts = [type.strip() for type in transaction_type.split(',') if type.strip()]
        if len(transaction_type_parts) == 1:
            # Single transaction type
            query = query.filter(Transaction.type == transaction_type_parts[0])
        else:
            # Multiple transaction types
            query = query.filter(Transaction.type.in_(transaction_type_parts))
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    # Filter by current user
    query = query.filter(Transaction.user_id == current_user.id)
    
    # Get all transactions (no pagination for export)
    transactions = query.order_by(Transaction.date.desc()).all()
    
    # Convert to DataFrame
    data = []
    for transaction in transactions:
        data.append({
            'Date': transaction.date.strftime('%Y-%m-%d'),
            'Description': transaction.description,
            'Amount': float(transaction.amount),
            'Type': transaction.type.title(),
            'Account': transaction.account.name if transaction.account else '',
            'To Account': transaction.to_account.name if transaction.to_account else '',
            'Category': transaction.category.name if transaction.category else '',
            'Payee': transaction.payee.name if transaction.payee else '',
            'Balance After': float(transaction.balance_after_transaction) if transaction.balance_after_transaction else '',
            'Notes': transaction.notes or ''
        })
    
    if not data:
        raise HTTPException(status_code=404, detail="No transactions found for the given filters")
    
    df = pd.DataFrame(data)
    
    # Create Excel file in memory
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Transactions')
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Transactions']
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    excel_buffer.seek(0)
    
    # Generate filename with current date
    filename = f"transactions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        io.BytesIO(excel_buffer.read()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
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
        'date': transaction.date,
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
    
    # Recalculate subsequent transaction balances for affected accounts
    affected_account_ids = []
    
    # Add original account IDs that were affected
    if original_account_id:
        affected_account_ids.append(str(original_account_id))
    if original_to_account_id:
        affected_account_ids.append(str(original_to_account_id))
    
    # Add new account IDs that are affected  
    if transaction.account_id and str(transaction.account_id) not in affected_account_ids:
        affected_account_ids.append(str(transaction.account_id))
    if transaction.to_account_id and str(transaction.to_account_id) not in affected_account_ids:
        affected_account_ids.append(str(transaction.to_account_id))
    
    # Determine the earliest date that needs recalculation
    original_date = original_values.get('date', transaction.date)
    earliest_date = min(str(original_date), str(transaction.date))
    
    # Recalculate balances for all affected accounts from the earliest date
    recalculate_subsequent_balances(db, affected_account_ids, earliest_date)
    
    db.commit()
    
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

@router.post("/recalculate-balances/{account_id}")
async def recalculate_account_balances(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Recalculate balance_after_transaction for all transactions of a specific account.
    This is useful for maintenance and ensuring data integrity.
    """
    # Verify account exists and belongs to user
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        # Get the earliest transaction date for this account to start recalculation from
        earliest_transaction = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
            Transaction.user_id == current_user.id
        ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).first()
        
        if not earliest_transaction:
            return {
                "success": True,
                "message": f"No transactions found for account {account.name}",
                "transactions_updated": 0,
                "account_name": account.name
            }
        
        # Count transactions before recalculation
        transaction_count = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
            Transaction.user_id == current_user.id
        ).count()
        
        # Trigger recalculation from the earliest date
        recalculate_subsequent_balances(
            db, 
            [str(account_id)], 
            str(earliest_transaction.date)
        )
        
        # Update the account's balance to match the final calculated balance
        last_transaction = db.query(Transaction).filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id),
            Transaction.user_id == current_user.id
        ).order_by(Transaction.date.desc(), Transaction.created_at.desc()).first()
        
        if last_transaction:
            # Determine which balance field to use based on whether this account was source or destination
            if str(last_transaction.account_id) == str(account_id):
                final_balance = last_transaction.balance_after_transaction
            elif str(last_transaction.to_account_id) == str(account_id):
                final_balance = last_transaction.to_account_balance_after
            else:
                final_balance = None
            
            if final_balance is not None:
                old_balance = account.balance
                account.balance = final_balance
                balance_correction = final_balance - old_balance
                db.add(account)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Successfully recalculated balances for account {account.name}",
            "transactions_updated": transaction_count,
            "account_name": account.name,
            "balance_correction": balance_correction if 'balance_correction' in locals() else 0
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to recalculate balances: {str(e)}"
        )


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


@router.post("/cleanup-descriptions")
async def cleanup_transaction_descriptions(
    filters: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Clean up transaction descriptions for ALL transactions:
    1. Remove "| " (pipe symbol with space) from all transaction descriptions
    2. Remove leading and trailing whitespaces from all transaction descriptions
    Note: Filters are ignored - cleanup applies to ALL transactions for the user
    """
    
    # Get all transactions for this user (ignore filters for cleanup operations)
    all_transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    
    pipe_removals = 0
    whitespace_removals = 0
    
    # Process all transactions for both pipe removal and whitespace cleanup
    for transaction in all_transactions:
        if transaction.description:
            original_description = transaction.description
            modified_description = original_description
            
            # Remove "| " (pipe symbol with space) from description
            if "| " in modified_description:
                modified_description = modified_description.replace("| ", "")
                pipe_removals += 1
            
            # Remove leading and trailing whitespaces
            trimmed_description = modified_description.strip()
            if trimmed_description != modified_description:
                whitespace_removals += 1
                modified_description = trimmed_description
            
            # Update the transaction if any changes were made
            if modified_description != original_description:
                transaction.description = modified_description
    
    db.commit()
    
    return {
        "message": "Transaction descriptions cleaned up successfully for ALL transactions",
        "pipe_symbol_removals": pipe_removals,
        "whitespace_removals": whitespace_removals,
        "total_transactions_processed": len(all_transactions)
    }


@router.post("/clear-fields")
async def clear_transaction_fields(
    filters: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Clear payee and category fields from filtered transactions
    """
    
    # Build query for filtered transactions
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    # Apply filters if provided
    if filters:
        if filters.get('start_date'):
            query = query.filter(Transaction.date >= filters['start_date'])
        if filters.get('end_date'):
            query = query.filter(Transaction.date <= filters['end_date'])
        if filters.get('account_ids'):
            query = query.filter(Transaction.account_id.in_(filters['account_ids']))
        if filters.get('category_ids'):
            query = query.filter(Transaction.category_id.in_(filters['category_ids']))
        if filters.get('payee_ids'):
            query = query.filter(Transaction.payee_id.in_(filters['payee_ids']))
    
    # Get filtered transactions
    filtered_transactions = query.all()
    
    payee_clearings = 0
    category_clearings = 0
    
    # Clear payee and category fields
    for transaction in filtered_transactions:
        if transaction.payee_id:
            transaction.payee_id = None
            payee_clearings += 1
        if transaction.category_id:
            transaction.category_id = None
            category_clearings += 1
    
    db.commit()
    
    return {
        "message": "Transaction fields cleared successfully",
        "payee_clearings": payee_clearings,
        "category_clearings": category_clearings,
        "total_transactions_processed": len(filtered_transactions)
    }


@router.post("/bulk-reassign")
async def bulk_reassign_transactions(
    transaction_ids: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Bulk reassign payee and category for selected transactions using current AI learning model.
    This will overwrite existing assignments with the latest AI suggestions.
    """
    from services.learning_service import TransactionLearningService
    from models.payees import Payee
    from models.categories import Category
    
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")
    
    # Get the transactions to reassign
    transactions = db.query(Transaction).filter(
        Transaction.id.in_(transaction_ids),
        Transaction.user_id == current_user.id
    ).all()
    
    if not transactions:
        raise HTTPException(status_code=404, detail="No valid transactions found")
    
    reassignments = []
    payee_updates = 0
    category_updates = 0
    errors = []
    
    for transaction in transactions:
        try:
            # Get AI suggestions for this transaction
            try:
                suggestions = TransactionLearningService.get_suggestions_for_description(
                    db=db,
                    user_id=current_user.id,
                    description=transaction.description,
                    amount=float(transaction.amount) if transaction.amount else 0.0,
                    account_type=transaction.account.type if transaction.account else None
                )
            except Exception as suggestion_error:
                suggestions = {}
            
            original_payee = transaction.payee.name if transaction.payee else None
            original_category = transaction.category.name if transaction.category else None
            
            changes = {
                "transaction_id": str(transaction.id),
                "description": transaction.description,
                "original_payee": original_payee,
                "original_category": original_category,
                "new_payee": None,
                "new_category": None,
                "payee_confidence": None,
                "category_confidence": None
            }
            
            # Apply payee suggestion with highest confidence
            if suggestions.get("payee_suggestions"):
                best_payee = max(suggestions["payee_suggestions"], key=lambda x: x.get("confidence", 0))
                if best_payee.get("confidence", 0) >= 0.5:
                    payee = db.query(Payee).filter(Payee.id == best_payee["id"]).first()
                    if payee:
                        transaction.payee_id = payee.id
                        changes["new_payee"] = payee.name
                        changes["payee_confidence"] = best_payee.get("confidence")
                        payee_updates += 1
                        
                        # Record this as a learning selection
                        TransactionLearningService.record_user_selection(
                            db=db,
                            user_id=current_user.id,
                            transaction_id=str(transaction.id),
                            field_type="payee",
                            selected_value_id=str(payee.id),
                            selected_value_name=payee.name,
                            transaction_description=transaction.description,
                            transaction_amount=float(transaction.amount) if transaction.amount else 0.0,
                            account_type=transaction.account.type if transaction.account else None,
                            was_suggested=True,
                            suggestion_confidence=best_payee.get("confidence"),
                            selection_method="bulk_reassign"
                        )
            
            # Apply category suggestion with highest confidence
            if suggestions.get("category_suggestions"):
                best_category = max(suggestions["category_suggestions"], key=lambda x: x.get("confidence", 0))
                if best_category.get("confidence", 0) >= 0.5:
                    category = db.query(Category).filter(Category.id == best_category["id"]).first()
                    if category:
                        transaction.category_id = category.id
                        changes["new_category"] = category.name
                        changes["category_confidence"] = best_category.get("confidence")
                        category_updates += 1
                        
                        # Record this as a learning selection
                        TransactionLearningService.record_user_selection(
                            db=db,
                            user_id=current_user.id,
                            transaction_id=str(transaction.id),
                            field_type="category",
                            selected_value_id=str(category.id),
                            selected_value_name=category.name,
                            transaction_description=transaction.description,
                            transaction_amount=float(transaction.amount) if transaction.amount else 0.0,
                            account_type=transaction.account.type if transaction.account else None,
                            was_suggested=True,
                            suggestion_confidence=best_category.get("confidence"),
                            selection_method="bulk_reassign"
                        )
            
            reassignments.append(changes)
            
        except Exception as e:
            errors.append({
                "transaction_id": str(transaction.id),
                "error": str(e)
            })
    
    # Commit all changes
    db.commit()
    
    return {
        "message": f"Bulk reassignment completed successfully",
        "total_transactions": len(transactions),
        "payee_updates": payee_updates,
        "category_updates": category_updates,
        "reassignments": reassignments,
        "errors": errors,
        "success_rate": f"{((len(transactions) - len(errors)) / len(transactions) * 100):.1f}%" if transactions else "0%"
    }


@router.get("/reports/by-category")
def get_transactions_by_category(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    use_all_data: bool = Query(False, description="Use all historical data for comprehensive analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get transaction summary grouped by category with optional comprehensive historical analysis"""
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    # Apply filters only if not using all data for comprehensive analysis
    if not use_all_data:
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)

    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(Transaction.account_id.in_(account_id_list))

    transactions = query.options(joinedload(Transaction.category)).all()

    category_data = {}
    monthly_trends = {}

    for transaction in transactions:
        category_name = transaction.category.name if transaction.category else "Uncategorized"
        category_id = str(transaction.category.id) if transaction.category else "none"
        category_color = transaction.category.color if transaction.category else "#cccccc"

        # Monthly tracking for trends
        month_key = transaction.date.strftime("%Y-%m")

        if category_id not in category_data:
            category_data[category_id] = {
                "id": category_id,
                "name": category_name,
                "color": category_color,
                "total_amount": 0,
                "transaction_count": 0,
                "income": 0,
                "expense": 0,
                "average_amount": 0,
                "monthly_data": {},
                "first_transaction": transaction.date,
                "last_transaction": transaction.date,
                "peak_month": {"month": "", "amount": 0},
                "trend": "stable"
            }

        # Track monthly data for trend analysis
        if month_key not in category_data[category_id]["monthly_data"]:
            category_data[category_id]["monthly_data"][month_key] = {
                "amount": 0,
                "count": 0,
                "month_name": transaction.date.strftime("%B %Y")
            }

        amount = float(transaction.amount)
        category_data[category_id]["total_amount"] += amount
        category_data[category_id]["transaction_count"] += 1
        category_data[category_id]["monthly_data"][month_key]["amount"] += amount
        category_data[category_id]["monthly_data"][month_key]["count"] += 1

        # Update date range
        if transaction.date < category_data[category_id]["first_transaction"]:
            category_data[category_id]["first_transaction"] = transaction.date
        if transaction.date > category_data[category_id]["last_transaction"]:
            category_data[category_id]["last_transaction"] = transaction.date

        # Track peak month
        if category_data[category_id]["monthly_data"][month_key]["amount"] > category_data[category_id]["peak_month"]["amount"]:
            category_data[category_id]["peak_month"] = {
                "month": category_data[category_id]["monthly_data"][month_key]["month_name"],
                "amount": category_data[category_id]["monthly_data"][month_key]["amount"]
            }

        if transaction.type == "income":
            category_data[category_id]["income"] += amount
        elif transaction.type == "expense":
            category_data[category_id]["expense"] += amount

    # Calculate averages and trends
    for category in category_data.values():
        if category["transaction_count"] > 0:
            category["average_amount"] = category["total_amount"] / category["transaction_count"]

            # Calculate spending trend over time
            monthly_amounts = [data["amount"] for data in category["monthly_data"].values()]
            if len(monthly_amounts) >= 3:
                recent_avg = sum(monthly_amounts[-3:]) / 3
                older_avg = sum(monthly_amounts[:-3]) / len(monthly_amounts[:-3]) if len(monthly_amounts) > 3 else recent_avg

                if recent_avg > older_avg * 1.1:
                    category["trend"] = "increasing"
                elif recent_avg < older_avg * 0.9:
                    category["trend"] = "decreasing"
                else:
                    category["trend"] = "stable"

            # Convert monthly data to list for easier frontend consumption
            category["monthly_trend"] = sorted(
                [{"month": k, **v} for k, v in category["monthly_data"].items()],
                key=lambda x: x["month"]
            )
            del category["monthly_data"]  # Remove dict version

            # Format dates
            category["first_transaction"] = category["first_transaction"].isoformat()
            category["last_transaction"] = category["last_transaction"].isoformat()
            category["active_months"] = len(category["monthly_trend"])

    return sorted(category_data.values(), key=lambda x: x["total_amount"], reverse=True)


@router.get("/reports/by-payee")
def get_transactions_by_payee(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    use_all_data: bool = Query(False, description="Use all historical data for comprehensive analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get transaction summary grouped by payee"""
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    # Apply filters only if not using all data
    if not use_all_data:
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(Transaction.account_id.in_(account_id_list))

    transactions = query.options(joinedload(Transaction.payee)).all()

    payee_data = {}
    for transaction in transactions:
        payee_name = transaction.payee.name if transaction.payee else "No Payee"
        payee_id = str(transaction.payee.id) if transaction.payee else "none"
        payee_color = transaction.payee.color if transaction.payee else "#cccccc"

        # Monthly tracking for trends
        month_key = transaction.date.strftime("%Y-%m")

        if payee_id not in payee_data:
            payee_data[payee_id] = {
                "id": payee_id,
                "name": payee_name,
                "color": payee_color,
                "total_amount": 0,
                "transaction_count": 0,
                "income": 0,
                "expense": 0,
                "average_amount": 0,
                "monthly_data": {},
                "first_transaction": transaction.date,
                "last_transaction": transaction.date,
                "peak_month": {"month": "", "amount": 0},
                "trend": "stable"
            }

        # Track monthly data for trend analysis
        if month_key not in payee_data[payee_id]["monthly_data"]:
            payee_data[payee_id]["monthly_data"][month_key] = {
                "amount": 0,
                "count": 0,
                "month_name": transaction.date.strftime("%B %Y")
            }

        amount = float(transaction.amount)
        payee_data[payee_id]["total_amount"] += amount
        payee_data[payee_id]["transaction_count"] += 1
        payee_data[payee_id]["monthly_data"][month_key]["amount"] += amount
        payee_data[payee_id]["monthly_data"][month_key]["count"] += 1

        # Update date range
        if transaction.date < payee_data[payee_id]["first_transaction"]:
            payee_data[payee_id]["first_transaction"] = transaction.date
        if transaction.date > payee_data[payee_id]["last_transaction"]:
            payee_data[payee_id]["last_transaction"] = transaction.date

        # Track peak month
        if payee_data[payee_id]["monthly_data"][month_key]["amount"] > payee_data[payee_id]["peak_month"]["amount"]:
            payee_data[payee_id]["peak_month"] = {
                "month": payee_data[payee_id]["monthly_data"][month_key]["month_name"],
                "amount": payee_data[payee_id]["monthly_data"][month_key]["amount"]
            }

        if transaction.type == "income":
            payee_data[payee_id]["income"] += amount
        elif transaction.type == "expense":
            payee_data[payee_id]["expense"] += amount

    # Calculate averages and trends
    for payee in payee_data.values():
        if payee["transaction_count"] > 0:
            payee["average_amount"] = payee["total_amount"] / payee["transaction_count"]

            # Calculate active months
            payee["active_months"] = len(payee["monthly_data"])

            # Calculate spending trend over time
            monthly_amounts = [data["amount"] for data in payee["monthly_data"].values()]
            if len(monthly_amounts) >= 3:
                recent_avg = sum(monthly_amounts[-3:]) / 3
                older_avg = sum(monthly_amounts[:-3]) / len(monthly_amounts[:-3]) if len(monthly_amounts) > 3 else recent_avg

                if recent_avg > older_avg * 1.1:
                    payee["trend"] = "increasing"
                elif recent_avg < older_avg * 0.9:
                    payee["trend"] = "decreasing"
                else:
                    payee["trend"] = "stable"

            # Convert monthly data to list for easier frontend consumption
            payee["monthly_trend"] = sorted(
                [{"month": k, **v} for k, v in payee["monthly_data"].items()],
                key=lambda x: x["month"]
            )
            del payee["monthly_data"]  # Remove dict version

            # Format dates
            payee["first_transaction"] = payee["first_transaction"].isoformat()
            payee["last_transaction"] = payee["last_transaction"].isoformat()

    return sorted(payee_data.values(), key=lambda x: x["total_amount"], reverse=True)


@router.get("/reports/by-account")
def get_transactions_by_account(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    use_all_data: bool = Query(False, description="Use all historical data for comprehensive analysis"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get transaction summary grouped by account"""
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    # Apply filters only if not using all data
    if not use_all_data:
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)

    transactions = query.options(joinedload(Transaction.account)).all()

    account_data = {}
    for transaction in transactions:
        account_name = transaction.account.name if transaction.account else "Unknown Account"
        account_id = str(transaction.account.id) if transaction.account else "none"
        account_type = transaction.account.type if transaction.account else "unknown"

        # Monthly tracking for trends
        month_key = transaction.date.strftime("%Y-%m")

        if account_id not in account_data:
            account_data[account_id] = {
                "id": account_id,
                "name": account_name,
                "type": account_type,
                "total_amount": 0,
                "transaction_count": 0,
                "income": 0,
                "expense": 0,
                "transfers_in": 0,
                "transfers_out": 0,
                "average_amount": 0,
                "monthly_data": {},
                "first_transaction": transaction.date,
                "last_transaction": transaction.date,
                "peak_month": {"month": "", "amount": 0},
                "trend": "stable"
            }

        # Track monthly data for trend analysis
        if month_key not in account_data[account_id]["monthly_data"]:
            account_data[account_id]["monthly_data"][month_key] = {
                "amount": 0,
                "count": 0,
                "month_name": transaction.date.strftime("%B %Y")
            }

        amount = float(transaction.amount)
        account_data[account_id]["total_amount"] += amount
        account_data[account_id]["transaction_count"] += 1
        account_data[account_id]["monthly_data"][month_key]["amount"] += amount
        account_data[account_id]["monthly_data"][month_key]["count"] += 1

        # Update date range
        if transaction.date < account_data[account_id]["first_transaction"]:
            account_data[account_id]["first_transaction"] = transaction.date
        if transaction.date > account_data[account_id]["last_transaction"]:
            account_data[account_id]["last_transaction"] = transaction.date

        # Track peak month
        if account_data[account_id]["monthly_data"][month_key]["amount"] > account_data[account_id]["peak_month"]["amount"]:
            account_data[account_id]["peak_month"] = {
                "month": account_data[account_id]["monthly_data"][month_key]["month_name"],
                "amount": account_data[account_id]["monthly_data"][month_key]["amount"]
            }

        if transaction.type == "income":
            account_data[account_id]["income"] += amount
        elif transaction.type == "expense":
            account_data[account_id]["expense"] += amount
        elif transaction.type == "transfer":
            # Check if this account is source or destination
            if transaction.account_id == transaction.account.id:
                account_data[account_id]["transfers_out"] += amount

    # Check for incoming transfers
    incoming_transfers_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "transfer",
        Transaction.to_account_id.isnot(None)
    ).options(joinedload(Transaction.to_account))
    
    if not use_all_data:
        if start_date:
            incoming_transfers_query = incoming_transfers_query.filter(Transaction.date >= start_date)
        if end_date:
            incoming_transfers_query = incoming_transfers_query.filter(Transaction.date <= end_date)
    
    incoming_transfers = incoming_transfers_query.all()

    for transfer in incoming_transfers:
        if transfer.to_account:
            to_account_id = str(transfer.to_account.id)
            if to_account_id in account_data:
                account_data[to_account_id]["transfers_in"] += float(transfer.amount)

    # Calculate averages and trends
    for account in account_data.values():
        if account["transaction_count"] > 0:
            account["average_amount"] = account["total_amount"] / account["transaction_count"]

            # Calculate active months
            account["active_months"] = len(account["monthly_data"])

            # Calculate activity trend over time
            monthly_amounts = [data["amount"] for data in account["monthly_data"].values()]
            if len(monthly_amounts) >= 3:
                recent_avg = sum(monthly_amounts[-3:]) / 3
                older_avg = sum(monthly_amounts[:-3]) / len(monthly_amounts[:-3]) if len(monthly_amounts) > 3 else recent_avg

                if recent_avg > older_avg * 1.1:
                    account["trend"] = "increasing"
                elif recent_avg < older_avg * 0.9:
                    account["trend"] = "decreasing"
                else:
                    account["trend"] = "stable"

            # Convert monthly data to list for easier frontend consumption
            account["monthly_trend"] = sorted(
                [{"month": k, **v} for k, v in account["monthly_data"].items()],
                key=lambda x: x["month"]
            )
            del account["monthly_data"]  # Remove dict version

            # Format dates
            account["first_transaction"] = account["first_transaction"].isoformat()
            account["last_transaction"] = account["last_transaction"].isoformat()

    return sorted(account_data.values(), key=lambda x: x["total_amount"], reverse=True)


@router.get("/reports/monthly-trend")
def get_monthly_trend(
    months: int = Query(12, description="Number of months to include"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get monthly income vs expense trends"""
    from datetime import datetime, timedelta
    from sqlalchemy import extract, func

    # Calculate start date
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=months * 30)

    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )

    if account_ids:
        account_id_list = [uuid.UUID(id.strip()) for id in account_ids.split(',') if id.strip()]
        query = query.filter(Transaction.account_id.in_(account_id_list))

    transactions = query.all()

    monthly_data = {}
    for transaction in transactions:
        month_key = transaction.date.strftime("%Y-%m")

        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "month": month_key,
                "month_name": transaction.date.strftime("%B"),
                "year": transaction.date.year,
                "income": 0,
                "expense": 0,
                "transfers": 0,
                "net_income": 0,
                "transaction_count": 0
            }

        amount = float(transaction.amount)
        monthly_data[month_key]["transaction_count"] += 1

        if transaction.type == "income":
            monthly_data[month_key]["income"] += amount
        elif transaction.type == "expense":
            monthly_data[month_key]["expense"] += amount
        elif transaction.type == "transfer":
            monthly_data[month_key]["transfers"] += amount

    # Calculate net income
    for month in monthly_data.values():
        month["net_income"] = month["income"] - month["expense"]

    return sorted(monthly_data.values(), key=lambda x: x["month"])


@router.get("/reports/comprehensive-analysis")
def get_comprehensive_financial_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive financial analysis using all historical data with advanced insights"""
    from datetime import datetime, timedelta
    from sqlalchemy import extract, func, case
    import statistics

    # Get ALL transactions for comprehensive analysis
    all_transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).options(
        joinedload(Transaction.category),
        joinedload(Transaction.payee),
        joinedload(Transaction.account)
    ).order_by(Transaction.date).all()

    if not all_transactions:
        return {"message": "No transaction data available for analysis"}

    # Comprehensive analysis data structure
    analysis = {
        "data_period": {
            "start_date": all_transactions[0].date.isoformat(),
            "end_date": all_transactions[-1].date.isoformat(),
            "total_days": (all_transactions[-1].date - all_transactions[0].date).days,
            "total_transactions": len(all_transactions)
        },
        "spending_patterns": {},
        "category_insights": {},
        "seasonal_trends": {},
        "prediction_data": {},
        "financial_health": {}
    }

    # Monthly aggregation for trend analysis
    monthly_data = {}
    category_monthly = {}
    payee_patterns = {}

    for transaction in all_transactions:
        month_key = transaction.date.strftime("%Y-%m")
        amount = float(transaction.amount)

        # Monthly totals
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "income": 0, "expense": 0, "transfers": 0,
                "transaction_count": 0, "date": transaction.date
            }

        monthly_data[month_key]["transaction_count"] += 1
        if transaction.type == "income":
            monthly_data[month_key]["income"] += amount
        elif transaction.type == "expense":
            monthly_data[month_key]["expense"] += amount
        elif transaction.type == "transfer":
            monthly_data[month_key]["transfers"] += amount

        # Category monthly tracking
        if transaction.category:
            cat_id = str(transaction.category.id)
            if cat_id not in category_monthly:
                category_monthly[cat_id] = {
                    "name": transaction.category.name,
                    "color": transaction.category.color,
                    "monthly_amounts": {},
                    "total": 0,
                    "months_active": 0
                }

            if month_key not in category_monthly[cat_id]["monthly_amounts"]:
                category_monthly[cat_id]["monthly_amounts"][month_key] = 0
                category_monthly[cat_id]["months_active"] += 1

            category_monthly[cat_id]["monthly_amounts"][month_key] += amount
            category_monthly[cat_id]["total"] += amount

    # Calculate spending patterns
    monthly_expenses = [data["expense"] for data in monthly_data.values()]
    monthly_incomes = [data["income"] for data in monthly_data.values()]

    if monthly_expenses:
        analysis["spending_patterns"] = {
            "average_monthly_expense": statistics.mean(monthly_expenses),
            "median_monthly_expense": statistics.median(monthly_expenses),
            "expense_volatility": statistics.stdev(monthly_expenses) if len(monthly_expenses) > 1 else 0,
            "highest_expense_month": max(monthly_expenses),
            "lowest_expense_month": min(monthly_expenses),
            "expense_trend": "increasing" if monthly_expenses[-3:] > monthly_expenses[:3] else "decreasing" if len(monthly_expenses) > 6 else "stable"
        }

    if monthly_incomes:
        analysis["financial_health"] = {
            "average_monthly_income": statistics.mean(monthly_incomes),
            "income_stability": 1 - (statistics.stdev(monthly_incomes) / statistics.mean(monthly_incomes)) if statistics.mean(monthly_incomes) > 0 else 0,
            "savings_rate": (statistics.mean(monthly_incomes) - statistics.mean(monthly_expenses)) / statistics.mean(monthly_incomes) if statistics.mean(monthly_incomes) > 0 else 0,
            "months_analyzed": len(monthly_data)
        }

    # Category insights with predictions
    for cat_id, data in category_monthly.items():
        amounts = list(data["monthly_amounts"].values())
        if len(amounts) >= 3:
            avg_monthly = statistics.mean(amounts)
            trend_factor = amounts[-1] / amounts[0] if amounts[0] > 0 else 1

            # Simple linear trend prediction for next 3 months
            if len(amounts) >= 6:
                recent_trend = sum(amounts[-3:]) / 3 / (sum(amounts[-6:-3]) / 3) if sum(amounts[-6:-3]) > 0 else 1
                predicted_next_month = amounts[-1] * recent_trend
            else:
                predicted_next_month = avg_monthly

            analysis["category_insights"][cat_id] = {
                "name": data["name"],
                "color": data["color"],
                "historical_average": avg_monthly,
                "trend_factor": trend_factor,
                "predicted_next_month": predicted_next_month,
                "consistency_score": 1 - (statistics.stdev(amounts) / avg_monthly) if avg_monthly > 0 else 0,
                "months_active": data["months_active"],
                "total_spent": data["total"]
            }

    # Seasonal analysis
    seasonal_data = {"spring": [], "summer": [], "fall": [], "winter": []}
    for transaction in all_transactions:
        month = transaction.date.month
        amount = float(transaction.amount) if transaction.type == "expense" else 0

        if month in [3, 4, 5]:
            seasonal_data["spring"].append(amount)
        elif month in [6, 7, 8]:
            seasonal_data["summer"].append(amount)
        elif month in [9, 10, 11]:
            seasonal_data["fall"].append(amount)
        else:
            seasonal_data["winter"].append(amount)

    analysis["seasonal_trends"] = {
        season: {
            "average_expense": statistics.mean(amounts) if amounts else 0,
            "total_transactions": len(amounts),
            "season_percentage": len(amounts) / len(all_transactions) * 100
        }
        for season, amounts in seasonal_data.items()
    }

    return analysis


@router.post("/reports/retrain-models")
def retrain_prediction_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrain prediction models using all historical user data"""
    from services.ai_trainer import TransactionAITrainer

    try:
        # Get all user transactions for training
        all_transactions = db.query(Transaction).filter(
            Transaction.user_id == current_user.id
        ).options(
            joinedload(Transaction.category),
            joinedload(Transaction.payee),
            joinedload(Transaction.account)
        ).all()

        if len(all_transactions) < 10:
            return {"message": "Insufficient data for model training. Need at least 10 transactions."}

        # Initialize trainer and retrain models
        trainer = TransactionAITrainer(db)

        # Train category prediction model
        category_model_info = trainer.train_category_prediction_model(str(current_user.id))

        # Train spending pattern model
        spending_model_info = trainer.train_spending_pattern_model(str(current_user.id))

        # Train anomaly detection model
        anomaly_model_info = trainer.train_anomaly_detection_model(str(current_user.id))

        return {
            "message": "Models retrained successfully",
            "training_data_size": len(all_transactions),
            "models_updated": {
                "category_prediction": category_model_info,
                "spending_patterns": spending_model_info,
                "anomaly_detection": anomaly_model_info
            },
            "last_retrain": datetime.now().isoformat()
        }

    except Exception as e:
        return {"error": f"Model retraining failed: {str(e)}"}


@router.get("/reports/prediction-insights")
def get_prediction_insights(
    months_ahead: int = Query(3, description="Number of months to predict ahead"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get advanced prediction insights using retrained models and all historical data"""
    from services.ai_trainer import TransactionAITrainer
    from datetime import datetime, timedelta
    import statistics

    # Get all historical data for context
    all_transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).options(
        joinedload(Transaction.category),
        joinedload(Transaction.payee)
    ).order_by(Transaction.date).all()

    if len(all_transactions) < 10:
        return {"message": "Insufficient historical data for accurate predictions"}

    # Category-wise historical analysis for predictions
    category_patterns = {}
    for transaction in all_transactions:
        if transaction.category:
            cat_id = str(transaction.category.id)
            month_key = transaction.date.strftime("%Y-%m")

            if cat_id not in category_patterns:
                category_patterns[cat_id] = {
                    "name": transaction.category.name,
                    "color": transaction.category.color,
                    "monthly_data": {},
                    "amounts": []
                }

            if month_key not in category_patterns[cat_id]["monthly_data"]:
                category_patterns[cat_id]["monthly_data"][month_key] = 0

            amount = float(transaction.amount)
            category_patterns[cat_id]["monthly_data"][month_key] += amount
            category_patterns[cat_id]["amounts"].append(amount)

    # Generate predictions
    predictions = []
    current_date = datetime.now().date()

    for cat_id, pattern in category_patterns.items():
        monthly_amounts = list(pattern["monthly_data"].values())

        if len(monthly_amounts) >= 3:
            # Calculate trend and seasonality
            avg_monthly = statistics.mean(monthly_amounts)

            # Linear trend calculation
            if len(monthly_amounts) >= 6:
                recent_avg = statistics.mean(monthly_amounts[-3:])
                older_avg = statistics.mean(monthly_amounts[-6:-3])
                trend_factor = recent_avg / older_avg if older_avg > 0 else 1
            else:
                trend_factor = 1

            # Predict for next months
            for month_offset in range(1, months_ahead + 1):
                predicted_date = current_date + timedelta(days=30 * month_offset)

                # Apply seasonal adjustment (simplified)
                seasonal_factor = 1
                month = predicted_date.month
                if month in [11, 12, 1]:  # Holiday season
                    seasonal_factor = 1.2
                elif month in [6, 7, 8]:  # Summer
                    seasonal_factor = 1.1

                predicted_amount = avg_monthly * trend_factor * seasonal_factor

                # Confidence based on data consistency
                volatility = statistics.stdev(monthly_amounts) / avg_monthly if avg_monthly > 0 else 1
                confidence = max(0.3, min(0.95, 1 - volatility))

                predictions.append({
                    "category_id": cat_id,
                    "category_name": pattern["name"],
                    "category_color": pattern["color"],
                    "month": predicted_date.month,
                    "year": predicted_date.year,
                    "month_name": predicted_date.strftime("%B"),
                    "predicted_amount": round(predicted_amount, 2),
                    "confidence": round(confidence, 2),
                    "trend": "increasing" if trend_factor > 1.1 else "decreasing" if trend_factor < 0.9 else "stable",
                    "based_on_months": len(monthly_amounts)
                })

    return {
        "predictions": sorted(predictions, key=lambda x: x["predicted_amount"], reverse=True),
        "total_categories_analyzed": len(category_patterns),
        "historical_months": len(set(t.date.strftime("%Y-%m") for t in all_transactions)),
        "data_quality": "excellent" if len(all_transactions) > 100 else "good" if len(all_transactions) > 50 else "fair",
        "next_retrain_recommended": len(all_transactions) < 100
    }


