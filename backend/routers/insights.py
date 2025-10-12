from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import json
from decimal import Decimal

from database import get_db
from models.transactions import Transaction
from models.accounts import Account
from models.categories import Category
from models.payees import Payee
from models.users import User
from schemas.transactions import TransactionResponse
from utils.auth import get_current_active_user
from services.llm_service import LLMService
from pydantic import BaseModel

router = APIRouter()

class InsightRequest(BaseModel):
    question: str
    timeframe: Optional[str] = None  # "last_month", "last_3_months", "last_year", "all_time"

class InsightResponse(BaseModel):
    answer: str
    data_summary: dict
    related_transactions: List[TransactionResponse] = []
    confidence: float

def get_user_financial_context(db: Session, user_id: str, timeframe: Optional[str] = None) -> dict:
    """Get comprehensive financial context for the user"""
    
    # Determine date filter based on timeframe
    date_filter = None
    if timeframe == "last_month":
        date_filter = datetime.now() - timedelta(days=30)
    elif timeframe == "last_3_months":
        date_filter = datetime.now() - timedelta(days=90)
    elif timeframe == "last_year":
        date_filter = datetime.now() - timedelta(days=365)
    
    # Base query
    base_query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if date_filter:
        base_query = base_query.filter(Transaction.date >= date_filter.date())
    
    # Get all transactions with relationships
    transactions = base_query.options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    ).order_by(desc(Transaction.date)).all()
    
    # Get accounts
    accounts = db.query(Account).filter(Account.user_id == user_id).all()
    
    # Calculate summary statistics
    total_income = sum(float(t.amount) for t in transactions if t.type == 'income')
    total_expenses = sum(float(t.amount) for t in transactions if t.type == 'expense')
    net_worth = sum(float(a.balance) for a in accounts)
    
    # Category breakdown
    category_stats = {}
    for transaction in transactions:
        if transaction.type == 'expense' and transaction.category:
            cat_name = transaction.category.name
            if cat_name not in category_stats:
                category_stats[cat_name] = 0
            category_stats[cat_name] += float(transaction.amount)
    
    # Payee breakdown
    payee_stats = {}
    for transaction in transactions:
        if transaction.payee:
            payee_name = transaction.payee.name
            if payee_name not in payee_stats:
                payee_stats[payee_name] = 0
            payee_stats[payee_name] += float(transaction.amount)
    
    # Account breakdown
    account_stats = {}
    for account in accounts:
        account_stats[account.name] = {
            'type': account.type,
            'balance': float(account.balance),
            'transactions': len([t for t in transactions if t.account_id == account.id])
        }
    
    # Monthly trends
    monthly_trends = {}
    for transaction in transactions:
        month_key = transaction.date.strftime('%Y-%m')
        if month_key not in monthly_trends:
            monthly_trends[month_key] = {'income': 0, 'expenses': 0}
        
        if transaction.type == 'income':
            monthly_trends[month_key]['income'] += float(transaction.amount)
        elif transaction.type == 'expense':
            monthly_trends[month_key]['expenses'] += float(transaction.amount)
    
    # Recent significant transactions
    significant_transactions = sorted(
        [t for t in transactions if float(t.amount) > 1000],
        key=lambda x: x.amount,
        reverse=True
    )[:10]
    
    return {
        'period': timeframe or 'all_time',
        'total_transactions': len(transactions),
        'total_income': total_income,
        'total_expenses': total_expenses,
        'net_savings': total_income - total_expenses,
        'current_net_worth': net_worth,
        'accounts': account_stats,
        'top_categories': dict(sorted(category_stats.items(), key=lambda x: x[1], reverse=True)[:10]),
        'top_payees': dict(sorted(payee_stats.items(), key=lambda x: x[1], reverse=True)[:10]),
        'monthly_trends': monthly_trends,
        'significant_transactions': [
            {
                'date': t.date.isoformat(),
                'amount': float(t.amount),
                'description': t.description,
                'type': t.type,
                'category': t.category.name if t.category else None,
                'payee': t.payee.name if t.payee else None,
                'account': t.account.name if t.account else None
            }
            for t in significant_transactions
        ]
    }

def create_financial_insight_prompt(question: str, financial_data: dict) -> str:
    """Create a structured prompt for financial insights"""
    return f"""
You are a personal financial advisor with deep expertise in analyzing spending patterns and financial health. 
A user has asked you a question about their personal financial data. Provide a comprehensive, helpful, and actionable answer.

USER QUESTION: {question}

FINANCIAL DATA CONTEXT:
{json.dumps(financial_data, indent=2, default=str)}

INSTRUCTIONS:
1. Analyze the provided financial data to answer the user's question accurately
2. Provide specific insights based on the actual numbers and patterns in their data
3. If the question is about spending patterns, highlight the top categories and amounts
4. If about savings, calculate and explain their savings rate
5. If about budgeting, provide practical recommendations based on their spending history
6. If about trends, analyze the monthly data to identify patterns
7. Always include specific amounts in INR (Indian Rupees) and percentages when relevant
8. Be encouraging but realistic in your advice
9. Format your response in clear, readable sections with bullet points where appropriate
10. Keep the tone conversational and helpful, like a knowledgeable friend

RESPONSE FORMAT:
Provide your analysis in a well-structured format with:
- Direct answer to their question
- Key insights from their data
- Specific recommendations if applicable
- Warning signs or positive trends to note

IMPORTANT: 
- Base your entire response on the actual data provided. Do not make general assumptions.
- All amounts should be referenced in INR (Indian Rupees) format
- Consider Indian financial context and spending patterns in your advice
"""

@router.post("/ask", response_model=InsightResponse)
def ask_financial_question(
    request: InsightRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ask a question about the user's financial data and get AI-powered insights"""
    
    try:
        # Initialize LLM service
        llm_service = LLMService()
        
        # Check if Ollama is available
        if not llm_service.check_ollama_connection():
            raise HTTPException(
                status_code=503,
                detail="AI service is not available. Please ensure Ollama is running."
            )
        
        # Get user's financial context
        financial_data = get_user_financial_context(db, str(current_user.id), request.timeframe)
        
        # Create the prompt
        prompt = create_financial_insight_prompt(request.question, financial_data)
        
        # Get AI response
        try:
            import ollama
            response = ollama.chat(
                model="llama3.1:latest",
                messages=[{
                    'role': 'user',
                    'content': prompt
                }],
                options={
                    'temperature': 0.3,  # Lower for more factual responses
                    'top_p': 0.9,
                    'num_predict': 2000,
                }
            )
            
            ai_answer = response['message']['content'].strip()
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate AI insight: {str(e)}"
            )
        
        # Find related transactions based on the question keywords
        related_transactions = find_related_transactions(
            db, current_user.id, request.question, request.timeframe
        )
        
        return InsightResponse(
            answer=ai_answer,
            data_summary=financial_data,
            related_transactions=related_transactions,
            confidence=0.85
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process insight request: {str(e)}"
        )

def find_related_transactions(
    db: Session, 
    user_id: str, 
    question: str, 
    timeframe: Optional[str] = None
) -> List[TransactionResponse]:
    """Find transactions related to the user's question"""
    
    # Determine date filter
    date_filter = None
    if timeframe == "last_month":
        date_filter = datetime.now() - timedelta(days=30)
    elif timeframe == "last_3_months":
        date_filter = datetime.now() - timedelta(days=90)
    elif timeframe == "last_year":
        date_filter = datetime.now() - timedelta(days=365)
    
    base_query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if date_filter:
        base_query = base_query.filter(Transaction.date >= date_filter.date())
    
    # Keywords that might indicate specific searches
    question_lower = question.lower()
    
    # Search by category keywords
    category_keywords = {
        'food': ['food', 'restaurant', 'grocery', 'dining', 'meal'],
        'transport': ['transport', 'uber', 'gas', 'fuel', 'car', 'taxi'],
        'entertainment': ['entertainment', 'movie', 'music', 'game', 'fun'],
        'shopping': ['shopping', 'amazon', 'store', 'purchase', 'buy'],
        'bills': ['bill', 'utility', 'electric', 'phone', 'internet'],
        'income': ['salary', 'income', 'paycheck', 'earning'],
    }
    
    filters = []
    
    # Check for category-based queries
    for category, keywords in category_keywords.items():
        if any(keyword in question_lower for keyword in keywords):
            # Find transactions with matching categories or descriptions
            filters.append(
                or_(
                    Transaction.description.ilike(f'%{category}%'),
                    and_(
                        Transaction.category.has(Category.name.ilike(f'%{category}%'))
                    )
                )
            )
    
    # Check for amount-based queries
    import re
    amount_match = re.search(r'[₹\$]?(\d+(?:,\d{3})*(?:\.\d{2})?)', question)
    if amount_match:
        amount = float(amount_match.group(1).replace(',', ''))
        # Find transactions within 20% of the mentioned amount
        filters.append(
            and_(
                Transaction.amount >= amount * 0.8,
                Transaction.amount <= amount * 1.2
            )
        )
    
    # Check for time-based keywords
    if 'recent' in question_lower or 'last' in question_lower:
        recent_date = datetime.now() - timedelta(days=30)
        filters.append(Transaction.date >= recent_date.date())
    
    # Apply filters
    if filters:
        query = base_query.filter(or_(*filters))
    else:
        # If no specific filters, return recent high-value transactions
        query = base_query.filter(Transaction.amount > 100)
    
    # Get results with relationships
    transactions = query.options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.payee),
        joinedload(Transaction.category)
    ).order_by(desc(Transaction.date)).limit(10).all()
    
    return transactions

@router.get("/context")
def get_financial_context(
    timeframe: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the user's financial context for display"""
    return get_user_financial_context(db, str(current_user.id), timeframe)

@router.get("/suggestions")
def get_question_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get suggested questions based on user's financial data"""
    
    # Get basic financial context
    financial_data = get_user_financial_context(db, str(current_user.id))
    
    suggestions = [
        "What is my spending pattern for the last 3 months?",
        "How much did I spend on food this month?",
        "What are my top 5 expense categories?",
        "Am I saving money this year?",
        "What was my biggest expense last month?",
        "How does my spending compare month to month?",
        "What percentage of my income goes to each category?",
        "Which account do I use the most?",
        "What are my recurring expenses?",
        "How much did I spend on entertainment this year?",
        "How much do I spend on groceries monthly?",
        "What's my average UPI transaction amount?",
        "How much did I spend on travel last quarter?"
    ]
    
    # Add data-specific suggestions based on their actual data
    if financial_data['top_categories']:
        top_category = list(financial_data['top_categories'].keys())[0]
        suggestions.insert(0, f"How much have I spent on {top_category}?")
    
    if financial_data['top_payees']:
        top_payee = list(financial_data['top_payees'].keys())[0]
        suggestions.insert(1, f"How much have I spent at {top_payee}?")
    
    if len(financial_data['monthly_trends']) > 1:
        suggestions.insert(2, "What is my monthly spending trend?")
    
    return {"suggestions": suggestions[:8]}  # Return top 8 suggestions