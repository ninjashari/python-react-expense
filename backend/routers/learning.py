from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import case
from typing import List
import uuid

from database import get_db
from models.users import User
from schemas.learning import (
    SmartSuggestionRequest,
    SmartSuggestionResponse,
    UserSelectionRequest,
    UserTransactionPatternResponse,
    LearningStatisticsResponse,
    LearningFeedbackRequest
)
from services.learning_service import TransactionLearningService
from services.ai_trainer import TransactionAITrainer
from utils.auth import get_current_active_user

router = APIRouter()


@router.post("/suggestions", response_model=SmartSuggestionResponse)
async def get_smart_suggestions(
    request: SmartSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get AI-powered suggestions for payee and category based on transaction description"""
    
    suggestions = TransactionLearningService.get_suggestions_for_description(
        db=db,
        user_id=str(current_user.id),
        description=request.description,
        amount=request.amount,
        account_type=request.account_type
    )
    
    return SmartSuggestionResponse(
        payee_suggestions=[
            {
                "id": s["id"],
                "name": s["name"],
                "type": s["type"],
                "confidence": s["confidence"],
                "reason": s["reason"],
                "usage_count": s.get("usage_count")
            }
            for s in suggestions["payee_suggestions"]
        ],
        category_suggestions=[
            {
                "id": s["id"],
                "name": s["name"],
                "type": s["type"],
                "confidence": s["confidence"],
                "reason": s["reason"],
                "usage_count": s.get("usage_count"),
                "color": s.get("color")
            }
            for s in suggestions["category_suggestions"]
        ]
    )


@router.post("/record-selection")
async def record_user_selection(
    request: UserSelectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record a user selection for learning purposes"""
    
    background_tasks.add_task(
        TransactionLearningService.record_user_selection,
        db=db,
        user_id=str(current_user.id),
        transaction_id=request.transaction_id,
        field_type=request.field_type,
        selected_value_id=request.selected_value_id,
        selected_value_name=request.selected_value_name,
        transaction_description=request.transaction_description,
        transaction_amount=request.transaction_amount,
        account_type=request.account_type,
        was_suggested=request.was_suggested,
        suggestion_confidence=request.suggestion_confidence,
        selection_method=request.selection_method
    )
    
    return {"status": "success", "message": "Selection recorded for learning"}


@router.get("/patterns", response_model=List[UserTransactionPatternResponse])
async def get_user_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all learned patterns for the current user"""
    
    patterns = TransactionLearningService.get_user_patterns(db, str(current_user.id))
    
    return [
        UserTransactionPatternResponse(
            id=str(pattern.id),
            description_keywords=pattern.description_keywords,
            payee_name=pattern.payee.name if pattern.payee else None,
            category_name=pattern.category.name if pattern.category else None,
            confidence_score=pattern.confidence_score,
            usage_frequency=pattern.usage_frequency,
            success_rate=pattern.success_rate,
            last_used=pattern.last_used,
            created_at=pattern.created_at
        )
        for pattern in patterns
    ]


@router.post("/feedback")
async def record_learning_feedback(
    request: LearningFeedbackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record feedback about suggestion quality for learning improvement"""
    
    # This will be used to improve the learning algorithm
    # For now, we'll just acknowledge the feedback
    
    return {
        "status": "success", 
        "message": "Feedback recorded",
        "suggestion_id": request.suggestion_id,
        "was_accepted": request.was_accepted
    }


@router.get("/statistics", response_model=LearningStatisticsResponse)
async def get_learning_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get learning system statistics for the current user"""
    
    from models.learning import LearningStatistics
    
    stats = db.query(LearningStatistics).filter(
        LearningStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        # Create initial statistics record
        stats = LearningStatistics(
            user_id=current_user.id,
            total_suggestions_made=0,
            total_suggestions_accepted=0,
            total_patterns_learned=0,
            average_confidence=0.0,
            success_rate=0.0
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
    
    return LearningStatisticsResponse(
        total_suggestions_made=stats.total_suggestions_made,
        total_suggestions_accepted=stats.total_suggestions_accepted,
        total_patterns_learned=stats.total_patterns_learned,
        average_confidence=stats.average_confidence,
        success_rate=stats.success_rate,
        last_updated=stats.last_updated
    )


@router.delete("/patterns/{pattern_id}")
async def delete_learning_pattern(
    pattern_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a specific learning pattern"""
    
    from models.learning import UserTransactionPattern
    
    pattern = db.query(UserTransactionPattern).filter(
        UserTransactionPattern.id == pattern_id,
        UserTransactionPattern.user_id == current_user.id
    ).first()
    
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")
    
    db.delete(pattern)
    db.commit()
    
    return {"status": "success", "message": "Learning pattern deleted"}


@router.post("/patterns/reset")
async def reset_learning_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reset all learning patterns for the current user"""
    
    from models.learning import UserTransactionPattern, UserSelectionHistory, UserCorrectionPattern
    
    # Delete all user's learning data
    db.query(UserTransactionPattern).filter(
        UserTransactionPattern.user_id == current_user.id
    ).delete()
    
    db.query(UserSelectionHistory).filter(
        UserSelectionHistory.user_id == current_user.id
    ).delete()
    
    db.query(UserCorrectionPattern).filter(
        UserCorrectionPattern.user_id == current_user.id
    ).delete()
    
    db.commit()
    
    return {"status": "success", "message": "All learning patterns reset"}


@router.get("/analytics/performance")
async def get_learning_performance_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed performance analytics for the learning system"""
    
    from models.learning import UserSelectionHistory, UserTransactionPattern
    from sqlalchemy import func, case
    from datetime import datetime, timedelta
    
    # Get suggestion acceptance rates over time
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Overall metrics
    total_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True
    ).scalar() or 0
    
    accepted_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True,
        UserSelectionHistory.suggestion_confidence > 0.5
    ).scalar() or 0
    
    # Recent trends
    recent_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True,
        UserSelectionHistory.created_at >= seven_days_ago
    ).scalar() or 0
    
    # Confidence distribution
    confidence_ranges = db.query(
        case([
            (UserSelectionHistory.suggestion_confidence >= 0.8, 'high'),
            (UserSelectionHistory.suggestion_confidence >= 0.6, 'medium'),
        ], else_='low').label('confidence_range'),
        func.count(UserSelectionHistory.id).label('count')
    ).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True
    ).group_by('confidence_range').all()
    
    confidence_distribution = {range_name: count for range_name, count in confidence_ranges}
    
    # Most successful patterns
    top_patterns = db.query(UserTransactionPattern).filter(
        UserTransactionPattern.user_id == current_user.id
    ).order_by(UserTransactionPattern.success_rate.desc()).limit(5).all()
    
    return {
        "overall_metrics": {
            "total_suggestions_made": total_suggestions,
            "total_suggestions_accepted": accepted_suggestions,
            "acceptance_rate": (accepted_suggestions / total_suggestions * 100) if total_suggestions > 0 else 0,
            "recent_suggestions_7_days": recent_suggestions
        },
        "confidence_distribution": {
            "high_confidence": confidence_distribution.get('high', 0),
            "medium_confidence": confidence_distribution.get('medium', 0),
            "low_confidence": confidence_distribution.get('low', 0)
        },
        "top_patterns": [
            {
                "id": str(pattern.id),
                "keywords": pattern.description_keywords[:3],  # First 3 keywords
                "payee_name": pattern.payee.name if pattern.payee else None,
                "category_name": pattern.category.name if pattern.category else None,
                "success_rate": pattern.success_rate,
                "usage_frequency": pattern.usage_frequency,
                "confidence_score": pattern.confidence_score
            }
            for pattern in top_patterns
        ]
    }


@router.get("/analytics/patterns")
async def get_pattern_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed pattern analytics and insights"""
    
    from models.learning import UserTransactionPattern
    from sqlalchemy import func
    
    # Pattern distribution by category
    category_patterns = db.query(
        UserTransactionPattern.category_id,
        func.count(UserTransactionPattern.id).label('pattern_count'),
        func.avg(UserTransactionPattern.confidence_score).label('avg_confidence')
    ).filter(
        UserTransactionPattern.user_id == current_user.id
    ).group_by(UserTransactionPattern.category_id).all()
    
    # Pattern distribution by payee
    payee_patterns = db.query(
        UserTransactionPattern.payee_id,
        func.count(UserTransactionPattern.id).label('pattern_count'),
        func.avg(UserTransactionPattern.confidence_score).label('avg_confidence')
    ).filter(
        UserTransactionPattern.user_id == current_user.id
    ).group_by(UserTransactionPattern.payee_id).all()
    
    # Most frequent keywords
    all_patterns = db.query(UserTransactionPattern).filter(
        UserTransactionPattern.user_id == current_user.id
    ).all()
    
    keyword_frequency = {}
    for pattern in all_patterns:
        for keyword in pattern.description_keywords:
            keyword_frequency[keyword] = keyword_frequency.get(keyword, 0) + 1
    
    top_keywords = sorted(keyword_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "pattern_distribution": {
            "by_category": len(category_patterns),
            "by_payee": len(payee_patterns),
            "total_patterns": len(all_patterns)
        },
        "keyword_insights": {
            "total_unique_keywords": len(keyword_frequency),
            "most_frequent_keywords": [
                {"keyword": keyword, "frequency": freq} 
                for keyword, freq in top_keywords
            ]
        },
        "category_breakdown": [
            {
                "category_id": str(cat_id) if cat_id else None,
                "pattern_count": count,
                "average_confidence": float(avg_conf or 0)
            }
            for cat_id, count, avg_conf in category_patterns
        ],
        "payee_breakdown": [
            {
                "payee_id": str(payee_id) if payee_id else None,
                "pattern_count": count,
                "average_confidence": float(avg_conf or 0)
            }
            for payee_id, count, avg_conf in payee_patterns
        ]
    }


@router.get("/analytics/accuracy")
async def get_accuracy_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get suggestion accuracy analytics over time"""
    
    from models.learning import UserSelectionHistory
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Daily accuracy for last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    daily_accuracy = db.query(
        func.date(UserSelectionHistory.created_at).label('date'),
        func.count(UserSelectionHistory.id).label('total_suggestions'),
        func.sum(
            case([
                (UserSelectionHistory.suggestion_confidence >= 0.7, 1)
            ], else_=0)
        ).label('accurate_suggestions')
    ).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True,
        UserSelectionHistory.created_at >= thirty_days_ago
    ).group_by(func.date(UserSelectionHistory.created_at)).all()
    
    # Field-specific accuracy
    field_accuracy = db.query(
        UserSelectionHistory.field_type,
        func.avg(UserSelectionHistory.suggestion_confidence).label('avg_confidence'),
        func.count(UserSelectionHistory.id).label('suggestion_count')
    ).filter(
        UserSelectionHistory.user_id == current_user.id,
        UserSelectionHistory.was_suggested == True
    ).group_by(UserSelectionHistory.field_type).all()
    
    return {
        "daily_accuracy": [
            {
                "date": str(date),
                "total_suggestions": total,
                "accurate_suggestions": accurate or 0,
                "accuracy_rate": (accurate / total * 100) if total > 0 and accurate else 0
            }
            for date, total, accurate in daily_accuracy
        ],
        "field_accuracy": [
            {
                "field_type": field_type,
                "average_confidence": float(avg_conf or 0),
                "suggestion_count": count
            }
            for field_type, avg_conf, count in field_accuracy
        ]
    }


@router.post("/auto-categorize")
async def auto_categorize_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Automatically categorize uncategorized transactions using high-confidence patterns"""
    
    from models.transactions import Transaction
    from models.learning import UserTransactionPattern
    from sqlalchemy import and_
    
    # Get uncategorized transactions
    uncategorized_transactions = db.query(Transaction).filter(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.payee_id.is_(None) | Transaction.category_id.is_(None)
        )
    ).all()
    
    auto_categorized = []
    
    for transaction in uncategorized_transactions:
        # Get suggestions for this transaction
        suggestions = TransactionLearningService.get_suggestions_for_description(
            db=db,
            user_id=str(current_user.id),
            description=transaction.description,
            amount=float(transaction.amount),
            account_type=transaction.account.type if transaction.account else None
        )
        
        updates = {}
        confidence_threshold = 0.6  # High confidence threshold for auto-categorization
        
        # Auto-apply payee if high confidence
        if not transaction.payee_id:
            high_confidence_payee = next(
                (s for s in suggestions["payee_suggestions"] 
                 if s["type"] == "ai_suggestion" and s["confidence"] >= confidence_threshold), 
                None
            )
            if high_confidence_payee:
                updates["payee_id"] = high_confidence_payee["id"]
        
        # Auto-apply category if high confidence
        if not transaction.category_id:
            high_confidence_category = next(
                (s for s in suggestions["category_suggestions"] 
                 if s["type"] == "ai_suggestion" and s["confidence"] >= confidence_threshold), 
                None
            )
            if high_confidence_category:
                updates["category_id"] = high_confidence_category["id"]
        
        # Apply updates if any
        if updates:
            for field, value in updates.items():
                setattr(transaction, field, value)
            
            # Record the auto-categorization for learning
            TransactionLearningService.record_user_selection(
                db=db,
                user_id=str(current_user.id),
                transaction_id=str(transaction.id),
                field_type="payee" if "payee_id" in updates else "category",
                selected_value_id=updates.get("payee_id") or updates.get("category_id"),
                selected_value_name=high_confidence_payee["name"] if "payee_id" in updates else high_confidence_category["name"],
                transaction_description=transaction.description,
                transaction_amount=float(transaction.amount),
                account_type=transaction.account.type if transaction.account else None,
                was_suggested=True,
                suggestion_confidence=(high_confidence_payee or high_confidence_category)["confidence"],
                selection_method="auto_categorization"
            )
            
            auto_categorized.append({
                "transaction_id": str(transaction.id),
                "description": transaction.description,
                "updates": updates,
                "confidence": (high_confidence_payee or high_confidence_category)["confidence"]
            })
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Auto-categorized {len(auto_categorized)} transactions",
        "categorized_transactions": auto_categorized,
        "total_processed": len(uncategorized_transactions)
    }


@router.post("/bulk-process")
async def bulk_process_transactions(
    transaction_ids: List[str],
    action: str,  # "categorize", "duplicate_check", "validate"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Bulk process multiple transactions with AI assistance"""
    
    from models.transactions import Transaction
    
    transactions = db.query(Transaction).filter(
        Transaction.id.in_(transaction_ids),
        Transaction.user_id == current_user.id
    ).all()
    
    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found")
    
    results = []
    
    if action == "categorize":
        for transaction in transactions:
            suggestions = TransactionLearningService.get_suggestions_for_description(
                db=db,
                user_id=str(current_user.id),
                description=transaction.description,
                amount=float(transaction.amount),
                account_type=transaction.account.type if transaction.account else None
            )
            
            results.append({
                "transaction_id": str(transaction.id),
                "description": transaction.description,
                "suggestions": {
                    "payee": suggestions["payee_suggestions"][:3],  # Top 3
                    "category": suggestions["category_suggestions"][:3]  # Top 3
                }
            })
    
    elif action == "duplicate_check":
        # Simple duplicate detection based on description, amount, and date
        for i, transaction in enumerate(transactions):
            similar_transactions = db.query(Transaction).filter(
                Transaction.user_id == current_user.id,
                Transaction.description.ilike(f"%{transaction.description}%"),
                Transaction.amount == transaction.amount,
                Transaction.id != transaction.id
            ).limit(5).all()
            
            results.append({
                "transaction_id": str(transaction.id),
                "description": transaction.description,
                "amount": float(transaction.amount),
                "potential_duplicates": [
                    {
                        "id": str(dup.id),
                        "date": str(dup.date),
                        "description": dup.description,
                        "similarity_score": 0.9 if dup.description == transaction.description else 0.7
                    }
                    for dup in similar_transactions
                ]
            })
    
    return {
        "status": "success",
        "action": action,
        "processed_count": len(transactions),
        "results": results
    }


@router.post("/smart-import-preprocess")
async def smart_import_preprocess(
    import_data: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Preprocess import data with AI suggestions for better categorization"""
    
    processed_data = []
    
    for row in import_data:
        description = row.get("description", "")
        amount = row.get("amount", 0)
        
        if description:
            suggestions = TransactionLearningService.get_suggestions_for_description(
                db=db,
                user_id=str(current_user.id),
                description=description,
                amount=amount
            )
            
            # Get best suggestions
            best_payee = suggestions["payee_suggestions"][0] if suggestions["payee_suggestions"] else None
            best_category = suggestions["category_suggestions"][0] if suggestions["category_suggestions"] else None
            
            processed_row = {
                **row,
                "ai_suggestions": {
                    "payee": best_payee,
                    "category": best_category,
                    "confidence_score": max(
                        best_payee["confidence"] if best_payee else 0,
                        best_category["confidence"] if best_category else 0
                    )
                }
            }
            
            processed_data.append(processed_row)
        else:
            processed_data.append(row)
    
    return {
        "status": "success",
        "processed_data": processed_data,
        "total_rows": len(import_data),
        "rows_with_suggestions": len([d for d in processed_data if "ai_suggestions" in d])
    }


@router.get("/predictions/spending-patterns")
async def get_spending_pattern_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Predict future spending patterns based on historical data"""
    
    from models.transactions import Transaction
    from models.categories import Category
    from sqlalchemy import func, extract
    from datetime import datetime, timedelta
    import calendar
    
    # Get transactions from last 12 months
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    
    # Monthly spending by category
    monthly_spending = db.query(
        extract('month', Transaction.date).label('month'),
        extract('year', Transaction.date).label('year'),
        Transaction.category_id,
        func.sum(Transaction.amount).label('total_amount'),
        func.count(Transaction.id).label('transaction_count')
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'expense',
        Transaction.date >= one_year_ago
    ).group_by(
        extract('month', Transaction.date),
        extract('year', Transaction.date),
        Transaction.category_id
    ).all()
    
    # Calculate averages and predictions
    category_predictions = {}
    
    for month, year, category_id, total_amount, transaction_count in monthly_spending:
        if category_id not in category_predictions:
            category_predictions[category_id] = {
                'monthly_amounts': [],
                'transaction_counts': [],
                'category_id': category_id
            }
        
        category_predictions[category_id]['monthly_amounts'].append(float(total_amount))
        category_predictions[category_id]['transaction_counts'].append(transaction_count)
    
    # Generate predictions for next 3 months
    predictions = []
    current_month = datetime.utcnow().month
    current_year = datetime.utcnow().year
    
    for category_id, data in category_predictions.items():
        if len(data['monthly_amounts']) >= 3:  # Need at least 3 months of data
            avg_amount = sum(data['monthly_amounts']) / len(data['monthly_amounts'])
            avg_transactions = sum(data['transaction_counts']) / len(data['transaction_counts'])
            
            # Simple trend calculation
            recent_avg = sum(data['monthly_amounts'][-3:]) / min(3, len(data['monthly_amounts']))
            trend_factor = recent_avg / avg_amount if avg_amount > 0 else 1.0
            
            category = db.query(Category).filter(Category.id == category_id).first()
            
            for i in range(1, 4):  # Next 3 months
                predicted_month = (current_month + i - 1) % 12 + 1
                predicted_year = current_year + ((current_month + i - 1) // 12)
                
                predicted_amount = avg_amount * trend_factor
                predicted_transactions = int(avg_transactions)
                
                predictions.append({
                    'month': predicted_month,
                    'year': predicted_year,
                    'month_name': calendar.month_name[predicted_month],
                    'category_id': str(category_id),
                    'category_name': category.name if category else 'Unknown',
                    'category_color': category.color if category else '#666666',
                    'predicted_amount': predicted_amount,
                    'predicted_transactions': predicted_transactions,
                    'confidence': min(0.9, len(data['monthly_amounts']) / 12),  # Higher confidence with more data
                    'trend': 'increasing' if trend_factor > 1.1 else 'decreasing' if trend_factor < 0.9 else 'stable'
                })
    
    return {
        "predictions": sorted(predictions, key=lambda x: (x['year'], x['month'], -x['predicted_amount'])),
        "total_months_analyzed": len(set([(m, y) for m, y, _, _, _ in monthly_spending])),
        "categories_with_predictions": len(category_predictions)
    }


@router.get("/predictions/anomalies")
async def detect_spending_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Detect unusual spending patterns and potential anomalies"""
    
    from models.transactions import Transaction
    from models.payees import Payee
    from sqlalchemy import func
    from datetime import datetime, timedelta
    import statistics
    
    # Get recent transactions (last 90 days)
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    recent_transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= ninety_days_ago,
        Transaction.type == 'expense'
    ).all()
    
    # Get historical baseline (6 months before that)
    baseline_start = ninety_days_ago - timedelta(days=180)
    baseline_transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= baseline_start,
        Transaction.date < ninety_days_ago,
        Transaction.type == 'expense'
    ).all()
    
    anomalies = []
    
    if baseline_transactions:
        # Calculate baseline statistics
        baseline_amounts = [float(t.amount) for t in baseline_transactions]
        baseline_mean = statistics.mean(baseline_amounts)
        baseline_stdev = statistics.stdev(baseline_amounts) if len(baseline_amounts) > 1 else 0
        
        # Detect amount anomalies
        threshold = baseline_mean + (2 * baseline_stdev)  # 2 standard deviations
        
        large_transactions = [t for t in recent_transactions if float(t.amount) > threshold]
        
        for transaction in large_transactions:
            anomalies.append({
                'type': 'large_amount',
                'transaction_id': str(transaction.id),
                'date': str(transaction.date),
                'description': transaction.description,
                'amount': float(transaction.amount),
                'category_name': transaction.category.name if transaction.category else 'Uncategorized',
                'payee_name': transaction.payee.name if transaction.payee else 'Unknown',
                'severity': 'high' if float(transaction.amount) > threshold * 1.5 else 'medium',
                'baseline_mean': baseline_mean,
                'deviation_factor': float(transaction.amount) / baseline_mean if baseline_mean > 0 else 0
            })
        
        # Detect frequency anomalies by category
        category_baseline_counts = {}
        for transaction in baseline_transactions:
            cat_id = transaction.category_id or 'uncategorized'
            category_baseline_counts[cat_id] = category_baseline_counts.get(cat_id, 0) + 1
        
        category_recent_counts = {}
        for transaction in recent_transactions:
            cat_id = transaction.category_id or 'uncategorized'
            category_recent_counts[cat_id] = category_recent_counts.get(cat_id, 0) + 1
        
        # Adjust for time period difference (90 days recent vs 180 days baseline)
        time_adjustment = 90 / 180
        
        for cat_id, recent_count in category_recent_counts.items():
            baseline_count = category_baseline_counts.get(cat_id, 0) * time_adjustment
            if baseline_count > 0 and recent_count > baseline_count * 2:  # More than double the expected frequency
                category = db.query(Category).filter(Category.id == cat_id).first() if cat_id != 'uncategorized' else None
                anomalies.append({
                    'type': 'unusual_frequency',
                    'category_id': str(cat_id) if cat_id != 'uncategorized' else None,
                    'category_name': category.name if category else 'Uncategorized',
                    'recent_count': recent_count,
                    'expected_count': int(baseline_count),
                    'frequency_factor': recent_count / baseline_count if baseline_count > 0 else 0,
                    'severity': 'medium' if recent_count < baseline_count * 3 else 'high',
                    'time_period': '90 days'
                })
        
        # Detect new payees with significant spending
        baseline_payee_ids = set(t.payee_id for t in baseline_transactions if t.payee_id)
        new_payees = {}
        
        for transaction in recent_transactions:
            if transaction.payee_id and transaction.payee_id not in baseline_payee_ids:
                if transaction.payee_id not in new_payees:
                    new_payees[transaction.payee_id] = {
                        'payee': transaction.payee,
                        'total_amount': 0,
                        'transaction_count': 0
                    }
                new_payees[transaction.payee_id]['total_amount'] += float(transaction.amount)
                new_payees[transaction.payee_id]['transaction_count'] += 1
        
        for payee_id, data in new_payees.items():
            if data['total_amount'] > baseline_mean * 2:  # Significant spending with new payee
                anomalies.append({
                    'type': 'new_payee_spending',
                    'payee_id': str(payee_id),
                    'payee_name': data['payee'].name if data['payee'] else 'Unknown',
                    'total_amount': data['total_amount'],
                    'transaction_count': data['transaction_count'],
                    'severity': 'medium',
                    'avg_transaction_size': data['total_amount'] / data['transaction_count']
                })
    
    return {
        "anomalies": sorted(anomalies, key=lambda x: x.get('amount', x.get('total_amount', 0)), reverse=True),
        "summary": {
            "total_anomalies": len(anomalies),
            "high_severity": len([a for a in anomalies if a.get('severity') == 'high']),
            "medium_severity": len([a for a in anomalies if a.get('severity') == 'medium']),
            "analysis_period": "90 days",
            "baseline_period": "180 days"
        }
    }


@router.get("/recommendations/budget")
async def get_budget_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate intelligent budget recommendations based on spending patterns"""
    
    from models.transactions import Transaction
    from models.categories import Category
    from sqlalchemy import func, extract
    from datetime import datetime, timedelta
    import statistics
    
    # Get last 6 months of expense data
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    
    # Monthly spending by category
    monthly_category_spending = db.query(
        extract('month', Transaction.date).label('month'),
        extract('year', Transaction.date).label('year'),
        Transaction.category_id,
        func.sum(Transaction.amount).label('monthly_total')
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'expense',
        Transaction.date >= six_months_ago
    ).group_by(
        extract('month', Transaction.date),
        extract('year', Transaction.date),
        Transaction.category_id
    ).all()
    
    # Calculate category-based budget recommendations
    category_budgets = {}
    
    for month, year, category_id, monthly_total in monthly_category_spending:
        if category_id not in category_budgets:
            category_budgets[category_id] = []
        category_budgets[category_id].append(float(monthly_total))
    
    recommendations = []
    total_recommended_budget = 0
    
    for category_id, monthly_amounts in category_budgets.items():
        if len(monthly_amounts) >= 2:  # Need at least 2 months of data
            avg_spending = statistics.mean(monthly_amounts)
            spending_stdev = statistics.stdev(monthly_amounts) if len(monthly_amounts) > 1 else 0
            
            # Calculate trend
            recent_avg = statistics.mean(monthly_amounts[-2:]) if len(monthly_amounts) >= 2 else avg_spending
            trend_factor = recent_avg / avg_spending if avg_spending > 0 else 1.0
            
            # Budget recommendation: average + some buffer for variability
            buffer_factor = 1.2 + (spending_stdev / avg_spending * 0.5) if avg_spending > 0 else 1.2
            recommended_budget = avg_spending * buffer_factor * trend_factor
            
            category = db.query(Category).filter(Category.id == category_id).first()
            
            # Determine priority based on spending consistency and amount
            consistency_score = 1 - (spending_stdev / avg_spending) if avg_spending > 0 else 0
            priority = 'high' if avg_spending > 500 and consistency_score > 0.7 else \
                      'medium' if avg_spending > 100 or consistency_score > 0.5 else 'low'
            
            recommendations.append({
                'category_id': str(category_id),
                'category_name': category.name if category else 'Uncategorized',
                'category_color': category.color if category else '#666666',
                'current_avg_spending': avg_spending,
                'recommended_budget': recommended_budget,
                'spending_variance': spending_stdev,
                'trend': 'increasing' if trend_factor > 1.1 else 'decreasing' if trend_factor < 0.9 else 'stable',
                'priority': priority,
                'confidence': min(0.95, len(monthly_amounts) / 6),  # Higher confidence with more data
                'months_analyzed': len(monthly_amounts),
                'savings_opportunity': max(0, avg_spending - recommended_budget * 0.8) if trend_factor < 1.0 else 0
            })
            
            total_recommended_budget += recommended_budget
    
    # Get income data for budget feasibility check
    monthly_income = db.query(
        func.avg(func.sum(Transaction.amount)).label('avg_monthly_income')
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == 'income',
        Transaction.date >= six_months_ago
    ).group_by(
        extract('month', Transaction.date),
        extract('year', Transaction.date)
    ).scalar() or 0
    
    # Calculate savings recommendation
    savings_rate = (float(monthly_income) - total_recommended_budget) / float(monthly_income) if monthly_income > 0 else 0
    
    return {
        "category_recommendations": sorted(recommendations, key=lambda x: -x['current_avg_spending']),
        "summary": {
            "total_recommended_budget": total_recommended_budget,
            "average_monthly_income": float(monthly_income),
            "recommended_savings_rate": max(0.1, savings_rate),  # At least 10% savings
            "budget_feasibility": "good" if savings_rate > 0.2 else "tight" if savings_rate > 0.1 else "over_budget",
            "total_categories": len(recommendations)
        },
        "insights": {
            "highest_spending_category": max(recommendations, key=lambda x: x['current_avg_spending'])['category_name'] if recommendations else None,
            "most_variable_category": max(recommendations, key=lambda x: x['spending_variance'])['category_name'] if recommendations else None,
            "best_savings_opportunity": max(recommendations, key=lambda x: x['savings_opportunity'])['category_name'] if recommendations else None
        }
    }


@router.get("/trends/forecast")
async def get_expense_trend_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate expense trend analysis and forecasting"""
    
    from models.transactions import Transaction
    from sqlalchemy import func, extract
    from datetime import datetime, timedelta
    import calendar
    
    # Get 12 months of data
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    
    # Monthly totals by type
    monthly_totals = db.query(
        extract('month', Transaction.date).label('month'),
        extract('year', Transaction.date).label('year'),
        Transaction.type,
        func.sum(Transaction.amount).label('total_amount'),
        func.count(Transaction.id).label('transaction_count')
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= one_year_ago
    ).group_by(
        extract('month', Transaction.date),
        extract('year', Transaction.date),
        Transaction.type
    ).all()
    
    # Organize data by month and type
    monthly_data = {}
    
    for month, year, transaction_type, total_amount, transaction_count in monthly_totals:
        month_key = f"{year}-{month:02d}"
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month,
                'year': int(year),
                'month_name': calendar.month_name[month],
                'income': 0,
                'expense': 0,
                'transfer': 0,
                'net_income': 0,
                'transaction_counts': {'income': 0, 'expense': 0, 'transfer': 0}
            }
        
        monthly_data[month_key][transaction_type] = float(total_amount)
        monthly_data[month_key]['transaction_counts'][transaction_type] = transaction_count
    
    # Calculate net income for each month
    for month_key, data in monthly_data.items():
        data['net_income'] = data['income'] - data['expense']
    
    # Generate trend analysis
    sorted_months = sorted(monthly_data.keys())
    recent_months = sorted_months[-6:] if len(sorted_months) >= 6 else sorted_months
    
    if len(recent_months) >= 3:
        # Calculate trends
        recent_expenses = [monthly_data[m]['expense'] for m in recent_months]
        recent_income = [monthly_data[m]['income'] for m in recent_months]
        recent_net = [monthly_data[m]['net_income'] for m in recent_months]
        
        # Simple trend calculation (comparing first and last 3 months)
        mid_point = len(recent_months) // 2
        first_half_expense_avg = sum(recent_expenses[:mid_point]) / mid_point
        second_half_expense_avg = sum(recent_expenses[mid_point:]) / (len(recent_expenses) - mid_point)
        
        first_half_income_avg = sum(recent_income[:mid_point]) / mid_point
        second_half_income_avg = sum(recent_income[mid_point:]) / (len(recent_income) - mid_point)
        
        expense_trend = 'increasing' if second_half_expense_avg > first_half_expense_avg * 1.05 else \
                       'decreasing' if second_half_expense_avg < first_half_expense_avg * 0.95 else 'stable'
        
        income_trend = 'increasing' if second_half_income_avg > first_half_income_avg * 1.05 else \
                      'decreasing' if second_half_income_avg < first_half_income_avg * 0.95 else 'stable'
        
        # Forecast next 3 months
        current_month = datetime.utcnow().month
        current_year = datetime.utcnow().year
        
        forecasts = []
        for i in range(1, 4):
            forecast_month = (current_month + i - 1) % 12 + 1
            forecast_year = current_year + ((current_month + i - 1) // 12)
            
            # Simple forecast based on recent average and trend
            base_expense = sum(recent_expenses) / len(recent_expenses)
            base_income = sum(recent_income) / len(recent_income)
            
            # Apply trend factor
            trend_factor_expense = second_half_expense_avg / first_half_expense_avg if first_half_expense_avg > 0 else 1.0
            trend_factor_income = second_half_income_avg / first_half_income_avg if first_half_income_avg > 0 else 1.0
            
            forecasted_expense = base_expense * trend_factor_expense
            forecasted_income = base_income * trend_factor_income
            
            forecasts.append({
                'month': forecast_month,
                'year': forecast_year,
                'month_name': calendar.month_name[forecast_month],
                'forecasted_expense': forecasted_expense,
                'forecasted_income': forecasted_income,
                'forecasted_net_income': forecasted_income - forecasted_expense,
                'confidence': max(0.6, len(recent_months) / 12)  # Higher confidence with more data
            })
    else:
        expense_trend = 'insufficient_data'
        income_trend = 'insufficient_data'
        forecasts = []
    
    return {
        "historical_data": [
            {
                **monthly_data[month_key],
                "month_key": month_key
            }
            for month_key in sorted(monthly_data.keys())
        ],
        "trend_analysis": {
            "expense_trend": expense_trend,
            "income_trend": income_trend,
            "months_analyzed": len(recent_months),
            "data_quality": "good" if len(recent_months) >= 6 else "limited" if len(recent_months) >= 3 else "insufficient"
        },
        "forecasts": forecasts,
        "insights": {
            "avg_monthly_expense": sum(recent_expenses) / len(recent_expenses) if recent_expenses else 0,
            "avg_monthly_income": sum(recent_income) / len(recent_income) if recent_income else 0,
            "avg_monthly_net": sum(recent_net) / len(recent_net) if recent_net else 0,
            "most_expensive_month": max(monthly_data.items(), key=lambda x: x[1]['expense'])[0] if monthly_data else None,
            "best_savings_month": max(monthly_data.items(), key=lambda x: x[1]['net_income'])[0] if monthly_data else None
        }
    }

@router.post("/train")
async def manually_train_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually trigger AI model training on user's historical transaction data.
    This will update the model used for payee and category suggestions.
    """
    try:
        # Initialize AI trainer
        ai_trainer = TransactionAITrainer(db, current_user.id)
        
        # Train on historical data
        training_stats = ai_trainer.train_from_historical_data()
        
        # Get training summary
        training_summary = ai_trainer.get_training_summary()
        
        return {
            "message": "AI model training completed successfully",
            "training_stats": training_stats,
            "training_summary": training_summary,
            "status": "completed"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to train model: {str(e)}")


@router.post("/cleanup-selection-history")
async def cleanup_selection_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    One-time cleanup to reduce user_selection_history table to 10 most recent entries per user.
    This endpoint is for maintenance and performance optimization.
    """
    try:
        # Run the cleanup for all users (including current user)
        result = TransactionLearningService.cleanup_all_users_selection_history(db)
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup selection history: {str(e)}")