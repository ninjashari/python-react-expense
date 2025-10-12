from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, and_, or_, text
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json
from decimal import Decimal

from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.categories import Category
from models.payees import Payee
from models.users import User
from utils.auth import get_current_active_user
from services.llm_service import LLMService
from pydantic import BaseModel

router = APIRouter()

class QueryRequest(BaseModel):
    prompt: str

class QueryResponse(BaseModel):
    interpretation: str
    data: List[Dict[str, Any]]
    columns: List[str]
    query_executed: str
    total_records: int

def create_data_query_prompt(prompt: str, available_tables: Dict[str, List[str]]) -> str:
    """Create a prompt for the AI to understand what data to query"""
    return f"""
You are a SQL query assistant for a personal finance application. Based on the user's question, determine what data they want to see and provide the appropriate query logic.

USER PROMPT: {prompt}

AVAILABLE DATA TABLES AND FIELDS:
{json.dumps(available_tables, indent=2)}

INSTRUCTIONS:
1. Analyze the user's prompt to understand what financial data they want
2. Determine which tables and fields are needed
3. Create a response with the interpretation and data structure needed
4. Focus on providing actionable, specific data

RESPONSE FORMAT (return only valid JSON):
{{
    "interpretation": "User wants to see...",
    "table_focus": "primary_table_name",
    "fields_needed": ["field1", "field2", "field3"],
    "filters": {{"date_range": "optional", "category": "optional", "amount_range": "optional"}},
    "group_by": "optional_field",
    "order_by": "field_name",
    "limit": 50
}}

Return ONLY the JSON response above, no additional text.
"""

def execute_dynamic_query(db: Session, user_id: str, query_spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Execute dynamic queries based on AI interpretation"""
    
    table_focus = query_spec.get('table_focus', 'transactions')
    fields_needed = query_spec.get('fields_needed', [])
    filters = query_spec.get('filters', {})
    group_by = query_spec.get('group_by')
    order_by = query_spec.get('order_by', 'date')
    limit = query_spec.get('limit', 50)
    
    if table_focus == 'transactions':
        return query_transactions(db, user_id, fields_needed, filters, group_by, order_by, limit)
    elif table_focus == 'accounts':
        return query_accounts(db, user_id, fields_needed, filters, group_by, order_by, limit)
    elif table_focus == 'categories':
        return query_categories(db, user_id, fields_needed, filters, group_by, order_by, limit)
    elif table_focus == 'payees':
        return query_payees(db, user_id, fields_needed, filters, group_by, order_by, limit)
    else:
        return query_transactions(db, user_id, fields_needed, filters, group_by, order_by, limit)

def query_transactions(db: Session, user_id: str, fields: List[str], filters: Dict, group_by: str, order_by: str, limit: int) -> List[Dict[str, Any]]:
    """Query transaction data dynamically"""
    
    query = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    ).filter(Transaction.user_id == user_id)
    
    # Apply filters
    if filters.get('date_range'):
        if filters['date_range'] == 'last_month':
            start_date = datetime.now() - timedelta(days=30)
            query = query.filter(Transaction.date >= start_date.date())
        elif filters['date_range'] == 'last_3_months':
            start_date = datetime.now() - timedelta(days=90)
            query = query.filter(Transaction.date >= start_date.date())
        elif filters['date_range'] == 'last_year':
            start_date = datetime.now() - timedelta(days=365)
            query = query.filter(Transaction.date >= start_date.date())
    
    if filters.get('category'):
        query = query.join(Category).filter(Category.name.ilike(f"%{filters['category']}%"))
    
    if filters.get('amount_range'):
        if filters['amount_range'] == 'high':
            query = query.filter(Transaction.amount > 1000)
        elif filters['amount_range'] == 'medium':
            query = query.filter(and_(Transaction.amount >= 100, Transaction.amount <= 1000))
        elif filters['amount_range'] == 'low':
            query = query.filter(Transaction.amount < 100)
    
    # Apply ordering
    if order_by == 'amount':
        query = query.order_by(desc(Transaction.amount))
    elif order_by == 'date':
        query = query.order_by(desc(Transaction.date))
    else:
        query = query.order_by(desc(Transaction.date))
    
    # Get results
    transactions = query.limit(limit).all()
    
    # Convert to dict format
    results = []
    for txn in transactions:
        result = {
            'id': str(txn.id),
            'date': txn.date.isoformat(),
            'amount': float(txn.amount),
            'description': txn.description,
            'type': txn.type,
            'account': txn.account.name if txn.account else '',
            'to_account': txn.to_account.name if txn.to_account else '',
            'category': txn.category.name if txn.category else 'Uncategorized',
            'payee': txn.payee.name if txn.payee else '',
        }
        
        # Filter fields if specified
        if fields:
            result = {k: v for k, v in result.items() if k in fields or k in ['id', 'date']}
        
        results.append(result)
    
    return results

def query_accounts(db: Session, user_id: str, fields: List[str], filters: Dict, group_by: str, order_by: str, limit: int) -> List[Dict[str, Any]]:
    """Query account data"""
    
    query = db.query(Account).filter(Account.user_id == user_id)
    
    if order_by == 'balance':
        query = query.order_by(desc(Account.balance))
    else:
        query = query.order_by(Account.name)
    
    accounts = query.limit(limit).all()
    
    results = []
    for acc in accounts:
        result = {
            'id': str(acc.id),
            'name': acc.name,
            'type': acc.type,
            'balance': float(acc.balance),
            'credit_limit': float(acc.credit_limit) if acc.credit_limit else 0,
            'created_at': acc.created_at.isoformat() if acc.created_at else '',
        }
        
        if fields:
            result = {k: v for k, v in result.items() if k in fields or k in ['id', 'name']}
        
        results.append(result)
    
    return results

def query_categories(db: Session, user_id: str, fields: List[str], filters: Dict, group_by: str, order_by: str, limit: int) -> List[Dict[str, Any]]:
    """Query category data with spending totals"""
    
    # Get categories with transaction totals
    category_totals = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.count(Transaction.id).label('transaction_count'),
        func.coalesce(func.sum(Transaction.amount), 0).label('total_amount')
    ).outerjoin(Transaction).filter(
        Category.user_id == user_id
    ).group_by(Category.id, Category.name, Category.color)
    
    if order_by == 'amount':
        category_totals = category_totals.order_by(desc('total_amount'))
    else:
        category_totals = category_totals.order_by(Category.name)
    
    categories = category_totals.limit(limit).all()
    
    results = []
    for cat in categories:
        result = {
            'id': str(cat.id),
            'name': cat.name,
            'color': cat.color,
            'transaction_count': cat.transaction_count,
            'total_amount': float(cat.total_amount),
        }
        
        if fields:
            result = {k: v for k, v in result.items() if k in fields or k in ['id', 'name']}
        
        results.append(result)
    
    return results

def query_payees(db: Session, user_id: str, fields: List[str], filters: Dict, group_by: str, order_by: str, limit: int) -> List[Dict[str, Any]]:
    """Query payee data with spending totals"""
    
    # Get payees with transaction totals
    payee_totals = db.query(
        Payee.id,
        Payee.name,
        Payee.color,
        func.count(Transaction.id).label('transaction_count'),
        func.coalesce(func.sum(Transaction.amount), 0).label('total_amount')
    ).outerjoin(Transaction).filter(
        Payee.user_id == user_id
    ).group_by(Payee.id, Payee.name, Payee.color)
    
    if order_by == 'amount':
        payee_totals = payee_totals.order_by(desc('total_amount'))
    else:
        payee_totals = payee_totals.order_by(Payee.name)
    
    payees = payee_totals.limit(limit).all()
    
    results = []
    for payee in payees:
        result = {
            'id': str(payee.id),
            'name': payee.name,
            'color': payee.color,
            'transaction_count': payee.transaction_count,
            'total_amount': float(payee.total_amount),
        }
        
        if fields:
            result = {k: v for k, v in result.items() if k in fields or k in ['id', 'name']}
        
        results.append(result)
    
    return results

@router.post("/query", response_model=QueryResponse)
def query_user_data(
    request: QueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Query user data based on natural language prompt"""
    
    try:
        # Initialize LLM service
        llm_service = LLMService()
        
        # Check if Ollama is available
        if not llm_service.check_ollama_connection():
            raise HTTPException(
                status_code=503,
                detail="AI service is not available. Please ensure Ollama is running."
            )
        
        # Define available tables and fields for the AI
        available_tables = {
            "transactions": [
                "id", "date", "amount", "description", "type", 
                "account", "to_account", "category", "payee"
            ],
            "accounts": [
                "id", "name", "type", "balance", "credit_limit", "created_at"
            ],
            "categories": [
                "id", "name", "color", "transaction_count", "total_amount"
            ],
            "payees": [
                "id", "name", "color", "transaction_count", "total_amount"
            ]
        }
        
        # Create the prompt for AI
        prompt = create_data_query_prompt(request.prompt, available_tables)
        
        # Get AI interpretation
        try:
            import ollama
            response = ollama.chat(
                model="llama3.1:latest",
                messages=[{
                    'role': 'user',
                    'content': prompt
                }],
                options={
                    'temperature': 0.1,
                    'top_p': 0.8,
                    'num_predict': 1000,
                }
            )
            
            ai_response = response['message']['content'].strip()
            
            # Parse AI response
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                query_spec = json.loads(json_match.group(0))
            else:
                # Fallback to simple transaction query
                query_spec = {
                    "interpretation": f"Showing recent transactions related to: {request.prompt}",
                    "table_focus": "transactions",
                    "fields_needed": ["date", "amount", "description", "category", "payee"],
                    "filters": {},
                    "order_by": "date",
                    "limit": 20
                }
            
        except Exception as e:
            # Fallback query specification
            query_spec = {
                "interpretation": f"Showing recent transactions related to: {request.prompt}",
                "table_focus": "transactions", 
                "fields_needed": ["date", "amount", "description", "category", "payee"],
                "filters": {},
                "order_by": "date",
                "limit": 20
            }
        
        # Execute the query
        data = execute_dynamic_query(db, str(current_user.id), query_spec)
        
        # Determine columns from the first record
        columns = list(data[0].keys()) if data else []
        
        return QueryResponse(
            interpretation=query_spec.get("interpretation", "Data query results"),
            data=data,
            columns=columns,
            query_executed=f"Query: {query_spec.get('table_focus', 'transactions')} table with filters: {query_spec.get('filters', {})}",
            total_records=len(data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process query: {str(e)}"
        )

@router.get("/suggestions")
def get_question_suggestions():
    """Get suggested prompts for querying data"""
    
    suggestions = [
        "Show me all my food expenses last month",
        "What are my top 5 highest transactions?",
        "List all my credit card accounts and balances",
        "Show me all transactions above ₹5000",
        "What categories do I spend most on?",
        "Show me all my UPI transactions",
        "List all my payees with total spending",
        "Show me transactions from last week",
        "What are my most expensive categories?",
        "Show me all my income transactions",
        "List my account balances",
        "Show me all grocery transactions"
    ]
    
    return {"suggestions": suggestions}