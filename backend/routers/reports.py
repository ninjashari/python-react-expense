from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import date, datetime
from database import get_db
from models.transactions import Transaction, TransactionType
from models.accounts import Account
from models.categories import Category
from models.payees import Payee

router = APIRouter()

@router.get("/summary")
def get_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: List[int] = Query(default=[]),
    category_ids: List[int] = Query(default=[]),
    payee_ids: List[int] = Query(default=[]),
    db: Session = Depends(get_db)
):
    """Get summary statistics for transactions"""
    query = db.query(Transaction)
    
    # Apply filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    if category_ids:
        query = query.filter(Transaction.category_id.in_(category_ids))
    if payee_ids:
        query = query.filter(Transaction.payee_id.in_(payee_ids))
    
    # Calculate summaries
    total_income = query.filter(Transaction.transaction_type == TransactionType.DEPOSIT).with_entities(func.sum(Transaction.amount)).scalar() or 0
    total_expenses = query.filter(Transaction.transaction_type == TransactionType.WITHDRAWAL).with_entities(func.sum(Transaction.amount)).scalar() or 0
    total_transfers = query.filter(Transaction.transaction_type == TransactionType.TRANSFER).with_entities(func.sum(Transaction.amount)).scalar() or 0
    
    transaction_count = query.count()
    
    return {
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "total_transfers": float(total_transfers),
        "net_income": float(total_income - total_expenses),
        "transaction_count": transaction_count
    }

@router.get("/by-category")
def get_transactions_by_category(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: List[int] = Query(default=[]),
    transaction_type: Optional[TransactionType] = None,
    db: Session = Depends(get_db)
):
    """Get transaction summaries grouped by category"""
    query = db.query(
        Category.name.label("category_name"),
        Category.color.label("category_color"),
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("transaction_count")
    ).join(Category, Transaction.category_id == Category.id)
    
    # Apply filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    results = query.group_by(Category.id, Category.name, Category.color).all()
    
    return [
        {
            "category_name": result.category_name,
            "category_color": result.category_color,
            "total_amount": float(result.total_amount),
            "transaction_count": result.transaction_count
        }
        for result in results
    ]

@router.get("/by-payee")
def get_transactions_by_payee(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: List[int] = Query(default=[]),
    transaction_type: Optional[TransactionType] = None,
    db: Session = Depends(get_db)
):
    """Get transaction summaries grouped by payee"""
    query = db.query(
        Payee.name.label("payee_name"),
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("transaction_count")
    ).join(Payee, Transaction.payee_id == Payee.id)
    
    # Apply filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    results = query.group_by(Payee.id, Payee.name).all()
    
    return [
        {
            "payee_name": result.payee_name,
            "total_amount": float(result.total_amount),
            "transaction_count": result.transaction_count
        }
        for result in results
    ]

@router.get("/by-account")
def get_transactions_by_account(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_ids: List[int] = Query(default=[]),
    payee_ids: List[int] = Query(default=[]),
    transaction_type: Optional[TransactionType] = None,
    db: Session = Depends(get_db)
):
    """Get transaction summaries grouped by account"""
    query = db.query(
        Account.name.label("account_name"),
        Account.account_type.label("account_type"),
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("transaction_count")
    ).join(Account, Transaction.account_id == Account.id)
    
    # Apply filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category_ids:
        query = query.filter(Transaction.category_id.in_(category_ids))
    if payee_ids:
        query = query.filter(Transaction.payee_id.in_(payee_ids))
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    
    results = query.group_by(Account.id, Account.name, Account.account_type).all()
    
    return [
        {
            "account_name": result.account_name,
            "account_type": result.account_type.value,
            "total_amount": float(result.total_amount),
            "transaction_count": result.transaction_count
        }
        for result in results
    ]

@router.get("/monthly-trend")
def get_monthly_trend(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: List[int] = Query(default=[]),
    db: Session = Depends(get_db)
):
    """Get monthly transaction trends"""
    query = db.query(
        func.date_trunc('month', Transaction.date).label('month'),
        Transaction.transaction_type,
        func.sum(Transaction.amount).label('total_amount')
    )
    
    # Apply filters
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    
    results = query.group_by(
        func.date_trunc('month', Transaction.date),
        Transaction.transaction_type
    ).order_by(func.date_trunc('month', Transaction.date)).all()
    
    return [
        {
            "month": result.month.strftime("%Y-%m") if result.month else None,
            "transaction_type": result.transaction_type.value,
            "total_amount": float(result.total_amount)
        }
        for result in results
    ]