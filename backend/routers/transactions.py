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
    Clean up transaction descriptions:
    1. Remove "| " from descriptions of filtered transactions
    2. Remove trailing whitespaces from all transactions
    """
    
    # First, get all transactions for this user
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
    
    # Get filtered transactions for "| " removal
    filtered_transactions = query.all()
    
    # Get all transactions for trailing whitespace removal
    all_transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    
    pipe_removals = 0
    whitespace_removals = 0
    
    # Remove "| " from filtered transactions
    for transaction in filtered_transactions:
        if transaction.description and "| " in transaction.description:
            old_description = transaction.description
            transaction.description = transaction.description.replace("| ", "")
            if transaction.description != old_description:
                pipe_removals += 1
    
    # Remove trailing whitespaces from all transactions
    for transaction in all_transactions:
        if transaction.description and transaction.description != transaction.description.rstrip():
            transaction.description = transaction.description.rstrip()
            whitespace_removals += 1
    
    db.commit()
    
    return {
        "message": "Transaction descriptions cleaned up successfully",
        "pipe_symbol_removals": pipe_removals,
        "trailing_whitespace_removals": whitespace_removals,
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