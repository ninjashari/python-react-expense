from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case
from typing import List
import uuid
from datetime import datetime, timedelta

from database import get_db
from models.users import User
from models.transactions import Transaction
from models.payees import Payee
from models.categories import Category
from models_mongo.learning import (
    UserTransactionPatternDocument,
    UserSelectionHistoryDocument,
    UserCorrectionPatternDocument,
    LearningStatisticsDocument,
)
from models_mongo.payees import PayeeDocument
from models_mongo.categories import CategoryDocument
from models_mongo.transactions import TransactionDocument
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
from services.ollama_service import get_llm_suggestions
from services.ai_cache import record_selection_and_maybe_retrain
from services import mongo_sync
from utils.auth import get_current_active_user
from config import READ_SOURCE

router = APIRouter()


@router.post("/suggestions", response_model=SmartSuggestionResponse)
def get_smart_suggestions(
    request: SmartSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Fast ML/pattern suggestions (instant path the dropdown waits on).

    Declared `def` (not async) so FastAPI runs it in a threadpool — the
    synchronous DB queries never block the event loop. The slow LLM lives in
    a separate `/suggestions/llm` endpoint.
    """
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
                "id":          s["id"],
                "name":        s["name"],
                "type":        s["type"],
                "confidence":  s["confidence"],
                "reason":      s["reason"],
                "usage_count": s.get("usage_count"),
            }
            for s in suggestions["payee_suggestions"]
        ],
        category_suggestions=[
            {
                "id":          s["id"],
                "name":        s["name"],
                "type":        s["type"],
                "confidence":  s["confidence"],
                "reason":      s["reason"],
                "usage_count": s.get("usage_count"),
                "color":       s.get("color"),
            }
            for s in suggestions["category_suggestions"]
        ],
        confidence_explanation="ML pattern matching",
    )


# Timeout for interactive LLM suggestions. llama3.1:8b needs ~3-10s depending
# on context length. 25s gives headroom without hanging the browser indefinitely.
LLM_INTERACTIVE_TIMEOUT = 25


@router.post("/suggestions/llm", response_model=SmartSuggestionResponse)
async def get_llm_smart_suggestions(
    request: SmartSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """LLM suggestion overlay (async, best-effort).

    Reads cached per-user context (built off the event loop) and awaits Ollama.
    Returns empty suggestions if Ollama is unavailable — never raises.
    """
    from fastapi.concurrency import run_in_threadpool
    from services.suggestion_context import get_context

    # Heavy DB work runs in a threadpool; cached after the first build.
    ctx = await run_in_threadpool(get_context, db, current_user.id)

    llm_result = await get_llm_suggestions(
        description=request.description,
        amount=request.amount,
        account_type=request.account_type,
        known_payees=ctx["payees"],
        known_categories=ctx["categories"],
        history=ctx["history"],
        timeout=LLM_INTERACTIVE_TIMEOUT,
    )

    if not llm_result:
        return SmartSuggestionResponse(
            payee_suggestions=[],
            category_suggestions=[],
            confidence_explanation="LLM unavailable",
        )

    payee_suggestions = []
    category_suggestions = []

    # Secondary guard: only forward IDs that are verifiably in the current context.
    payee_ids = {p["id"] for p in ctx["payees"]}
    cat_ids   = {c["id"] for c in ctx["categories"]}

    if llm_result.get("payee_id") and llm_result["payee_id"] in payee_ids and llm_result.get("payee_name"):
        payee_suggestions.append({
            "id":          llm_result["payee_id"],
            "name":        llm_result["payee_name"],
            "type":        "ai_suggestion",
            "confidence":  round(float(llm_result.get("payee_confidence", 0.8)), 2),
            "reason":      "LLM suggestion based on transaction history",
            "usage_count": None,
        })

    if llm_result.get("category_id") and llm_result["category_id"] in cat_ids and llm_result.get("category_name"):
        color = next(
            (c["color"] for c in ctx["categories"] if c["id"] == llm_result["category_id"]),
            None
        )
        category_suggestions.append({
            "id":          llm_result["category_id"],
            "name":        llm_result["category_name"],
            "type":        "ai_suggestion",
            "confidence":  round(float(llm_result.get("category_confidence", 0.8)), 2),
            "reason":      "LLM suggestion based on transaction history",
            "usage_count": None,
            "color":       color,
        })

    return SmartSuggestionResponse(
        payee_suggestions=payee_suggestions,
        category_suggestions=category_suggestions,
        confidence_explanation="Local LLM (Ollama)",
    )


@router.post("/record-selection")
def record_user_selection(
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
    background_tasks.add_task(record_selection_and_maybe_retrain, str(current_user.id))

    return {"status": "success", "message": "Selection recorded for learning"}


async def _get_user_patterns_mongo(user_id: str) -> List[UserTransactionPatternResponse]:
    patterns = await UserTransactionPatternDocument.find(
        UserTransactionPatternDocument.user_id == user_id
    ).sort(-UserTransactionPatternDocument.confidence_score, -UserTransactionPatternDocument.usage_frequency).to_list()

    payees = await PayeeDocument.find(PayeeDocument.user_id == user_id).to_list()
    categories = await CategoryDocument.find(CategoryDocument.user_id == user_id).to_list()
    payee_map = {p.id: p.name for p in payees}
    category_map = {c.id: c.name for c in categories}

    return [
        UserTransactionPatternResponse(
            id=pattern.id,
            description_keywords=pattern.description_keywords,
            payee_name=payee_map.get(pattern.payee_id) if pattern.payee_id else None,
            category_name=category_map.get(pattern.category_id) if pattern.category_id else None,
            confidence_score=pattern.confidence_score,
            usage_frequency=pattern.usage_frequency,
            success_rate=pattern.success_rate,
            last_used=pattern.last_used,
            created_at=pattern.created_at
        )
        for pattern in patterns
    ]


@router.get("/patterns", response_model=List[UserTransactionPatternResponse])
async def get_user_patterns(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Get all learned patterns for the current user"""
    if READ_SOURCE == "mongo":
        return await _get_user_patterns_mongo(str(current_user.id))

    patterns = await run_in_threadpool(TransactionLearningService.get_user_patterns, db, str(current_user.id))

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
def record_learning_feedback(
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


def _get_or_create_learning_statistics_pg(db: Session, user_id: uuid.UUID):
    from models.learning import LearningStatistics
    stats = db.query(LearningStatistics).filter(
        LearningStatistics.user_id == user_id
    ).first()
    if not stats:
        stats = LearningStatistics(
            user_id=user_id,
            total_suggestions_made=0,
            total_suggestions_accepted=0,
            total_patterns_learned=0,
            average_confidence=0.0,
            success_rate=0.0
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
        return stats, True
    return stats, False


@router.get("/statistics", response_model=LearningStatisticsResponse)
async def get_learning_statistics(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Get learning system statistics for the current user"""
    user_id = uuid.UUID(str(current_user.id))

    if READ_SOURCE == "mongo":
        stats_doc = await LearningStatisticsDocument.find_one(LearningStatisticsDocument.user_id == str(user_id))
        if not stats_doc:
            # Postgres stays the write source of truth even when reading from Mongo.
            pg_stats, _ = await run_in_threadpool(_get_or_create_learning_statistics_pg, db, user_id)
            background_tasks.add_task(mongo_sync.mirror_learning_statistics_upsert, db, user_id)
            return LearningStatisticsResponse(
                total_suggestions_made=pg_stats.total_suggestions_made,
                total_suggestions_accepted=pg_stats.total_suggestions_accepted,
                total_patterns_learned=pg_stats.total_patterns_learned,
                average_confidence=pg_stats.average_confidence,
                success_rate=pg_stats.success_rate,
                last_updated=pg_stats.last_updated
            )
        return LearningStatisticsResponse(
            total_suggestions_made=stats_doc.total_suggestions_made,
            total_suggestions_accepted=stats_doc.total_suggestions_accepted,
            total_patterns_learned=stats_doc.total_patterns_learned,
            average_confidence=stats_doc.average_confidence,
            success_rate=stats_doc.success_rate,
            last_updated=stats_doc.last_updated
        )

    stats, created = await run_in_threadpool(_get_or_create_learning_statistics_pg, db, user_id)
    if created:
        background_tasks.add_task(mongo_sync.mirror_learning_statistics_upsert, db, user_id)

    return LearningStatisticsResponse(
        total_suggestions_made=stats.total_suggestions_made,
        total_suggestions_accepted=stats.total_suggestions_accepted,
        total_patterns_learned=stats.total_patterns_learned,
        average_confidence=stats.average_confidence,
        success_rate=stats.success_rate,
        last_updated=stats.last_updated
    )


@router.delete("/patterns/{pattern_id}")
def delete_learning_pattern(
    pattern_id: uuid.UUID,
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(mongo_sync.mirror_learning_pattern_delete, pattern_id)

    return {"status": "success", "message": "Learning pattern deleted"}


@router.post("/patterns/reset")
def reset_learning_patterns(
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(mongo_sync.mirror_patterns_reset, current_user.id)

    return {"status": "success", "message": "All learning patterns reset"}


async def _get_learning_performance_analytics_mongo(user_id: str) -> dict:
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)

        selections = await UserSelectionHistoryDocument.find(UserSelectionHistoryDocument.user_id == user_id).to_list()
        total_suggestions = len(selections)
        accepted_suggestions = sum(
            1 for s in selections if s.suggestion_confidence is not None and s.suggestion_confidence > 0.0
        )
        recent_suggestions = sum(1 for s in selections if s.created_at and s.created_at >= seven_days_ago)

        confidence_distribution = {'high': 0, 'medium': 0, 'low': 0}
        for s in selections:
            if s.suggestion_confidence is None:
                continue
            if s.suggestion_confidence >= 0.8:
                confidence_distribution['high'] += 1
            elif s.suggestion_confidence >= 0.6:
                confidence_distribution['medium'] += 1
            else:
                confidence_distribution['low'] += 1

        top_patterns = await UserTransactionPatternDocument.find(
            UserTransactionPatternDocument.user_id == user_id
        ).sort(-UserTransactionPatternDocument.success_rate, "_id").limit(5).to_list()

        payees = await PayeeDocument.find(PayeeDocument.user_id == user_id).to_list()
        categories = await CategoryDocument.find(CategoryDocument.user_id == user_id).to_list()
        payee_map = {p.id: p.name for p in payees}
        category_map = {c.id: c.name for c in categories}

        return {
            "overall_metrics": {
                "total_suggestions_made": total_suggestions,
                "total_suggestions_accepted": accepted_suggestions,
                "acceptance_rate": (accepted_suggestions / total_suggestions * 100) if total_suggestions > 0 else 0,
                "recent_suggestions_7_days": recent_suggestions
            },
            "confidence_distribution": {
                "high_confidence": confidence_distribution['high'],
                "medium_confidence": confidence_distribution['medium'],
                "low_confidence": confidence_distribution['low']
            },
            "top_patterns": [
                {
                    "id": pattern.id,
                    "keywords": pattern.description_keywords[:3],
                    "payee_name": payee_map.get(pattern.payee_id) if pattern.payee_id else None,
                    "category_name": category_map.get(pattern.category_id) if pattern.category_id else None,
                    "success_rate": pattern.success_rate,
                    "usage_frequency": pattern.usage_frequency,
                    "confidence_score": pattern.confidence_score
                }
                for pattern in top_patterns
            ]
        }
    except Exception:
        return {
            "overall_metrics": {
                "total_suggestions_made": 0,
                "total_suggestions_accepted": 0,
                "acceptance_rate": 0.0,
                "recent_suggestions_7_days": 0
            },
            "confidence_distribution": {
                "high_confidence": 0,
                "medium_confidence": 0,
                "low_confidence": 0
            },
            "top_patterns": []
        }


@router.get("/analytics/performance")
async def get_learning_performance_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Get detailed performance analytics for the learning system"""
    if READ_SOURCE == "mongo":
        return await _get_learning_performance_analytics_mongo(str(current_user.id))

    def _pg():
        from models.learning import UserSelectionHistory, UserTransactionPattern
        from sqlalchemy import func, case

        try:
            # Get suggestion acceptance rates over time
            seven_days_ago = datetime.utcnow() - timedelta(days=7)

            # Overall metrics - include all selections, not just suggested ones
            total_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
                UserSelectionHistory.user_id == current_user.id
            ).scalar() or 0

            # Count selections that had some confidence (indicating AI involvement)
            accepted_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
                UserSelectionHistory.user_id == current_user.id,
                UserSelectionHistory.suggestion_confidence.isnot(None),
                UserSelectionHistory.suggestion_confidence > 0.0
            ).scalar() or 0

            # Recent trends - all selections
            recent_suggestions = db.query(func.count(UserSelectionHistory.id)).filter(
                UserSelectionHistory.user_id == current_user.id,
                UserSelectionHistory.created_at >= seven_days_ago
            ).scalar() or 0

            # Confidence distribution - only for records with actual confidence values
            confidence_ranges = db.query(
                case(
                    (UserSelectionHistory.suggestion_confidence >= 0.8, 'high'),
                    (UserSelectionHistory.suggestion_confidence >= 0.6, 'medium'),
                    else_='low'
                ).label('confidence_range'),
                func.count(UserSelectionHistory.id).label('count')
            ).filter(
                UserSelectionHistory.user_id == current_user.id,
                UserSelectionHistory.suggestion_confidence.isnot(None)
            ).group_by('confidence_range').all()

            confidence_distribution = {range_name: count for range_name, count in confidence_ranges}

            # Most successful patterns
            top_patterns = db.query(UserTransactionPattern).filter(
                UserTransactionPattern.user_id == current_user.id
            ).order_by(UserTransactionPattern.success_rate.desc(), UserTransactionPattern.id).limit(5).all()

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

        except Exception:
            # Return default structure with empty data if there's an error
            return {
                "overall_metrics": {
                    "total_suggestions_made": 0,
                    "total_suggestions_accepted": 0,
                    "acceptance_rate": 0.0,
                    "recent_suggestions_7_days": 0
                },
                "confidence_distribution": {
                    "high_confidence": 0,
                    "medium_confidence": 0,
                    "low_confidence": 0
                },
                "top_patterns": []
            }

    return await run_in_threadpool(_pg)


def _process_pattern_analytics(all_patterns) -> dict:
    from collections import defaultdict

    category_agg = defaultdict(lambda: [0, 0.0])  # count, confidence sum
    payee_agg = defaultdict(lambda: [0, 0.0])
    keyword_frequency: dict = {}

    for pattern in all_patterns:
        category_agg[pattern.category_id][0] += 1
        category_agg[pattern.category_id][1] += pattern.confidence_score
        payee_agg[pattern.payee_id][0] += 1
        payee_agg[pattern.payee_id][1] += pattern.confidence_score
        if pattern.description_keywords:
            for keyword in pattern.description_keywords:
                keyword_frequency[keyword] = keyword_frequency.get(keyword, 0) + 1

    # Tiebreak alphabetically - ties would otherwise keep whatever arbitrary order
    # the (unordered) pattern fetch produced, differing between Postgres and Mongo.
    top_keywords = sorted(keyword_frequency.items(), key=lambda x: (-x[1], x[0]))[:10]

    return {
        "pattern_distribution": {
            "by_category": len(category_agg),
            "by_payee": len(payee_agg),
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
                "average_confidence": float(total_conf / count) if count else 0.0
            }
            for cat_id, (count, total_conf) in category_agg.items()
        ],
        "payee_breakdown": [
            {
                "payee_id": str(payee_id) if payee_id else None,
                "pattern_count": count,
                "average_confidence": float(total_conf / count) if count else 0.0
            }
            for payee_id, (count, total_conf) in payee_agg.items()
        ]
    }


_EMPTY_PATTERN_ANALYTICS = {
    "pattern_distribution": {"by_category": 0, "by_payee": 0, "total_patterns": 0},
    "keyword_insights": {"total_unique_keywords": 0, "most_frequent_keywords": []},
    "category_breakdown": [],
    "payee_breakdown": []
}


@router.get("/analytics/patterns")
async def get_pattern_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Get detailed pattern analytics and insights"""
    try:
        if READ_SOURCE == "mongo":
            all_patterns = await UserTransactionPatternDocument.find(
                UserTransactionPatternDocument.user_id == str(current_user.id)
            ).to_list()
        else:
            def _fetch_pg():
                from models.learning import UserTransactionPattern
                return db.query(UserTransactionPattern).filter(
                    UserTransactionPattern.user_id == current_user.id
                ).all()
            all_patterns = await run_in_threadpool(_fetch_pg)
        return _process_pattern_analytics(all_patterns)
    except Exception:
        return _EMPTY_PATTERN_ANALYTICS


def _process_accuracy_analytics(selections) -> dict:
    from collections import defaultdict

    daily_agg = defaultdict(lambda: [0, 0])  # total, accurate
    field_agg = defaultdict(lambda: [0, 0.0])  # count, confidence sum

    for s in selections:
        if s.created_at:
            day = s.created_at.date() if hasattr(s.created_at, 'date') else s.created_at
            daily_agg[day][0] += 1
            if s.suggestion_confidence is not None and s.suggestion_confidence >= 0.7:
                daily_agg[day][1] += 1
        if s.suggestion_confidence is not None:
            field_agg[s.field_type][0] += 1
            field_agg[s.field_type][1] += s.suggestion_confidence

    return {
        "daily_accuracy": [
            {
                "date": str(day),
                "total_suggestions": total,
                "accurate_suggestions": accurate,
                "accuracy_rate": (accurate / total * 100) if total > 0 and accurate else 0
            }
            for day, (total, accurate) in sorted(daily_agg.items())
        ],
        "field_accuracy": [
            {
                "field_type": field_type,
                "average_confidence": float(total_conf / count) if count else 0.0,
                "suggestion_count": count
            }
            for field_type, (count, total_conf) in field_agg.items()
        ]
    }


@router.get("/analytics/accuracy")
async def get_accuracy_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Get suggestion accuracy analytics over time"""
    try:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        if READ_SOURCE == "mongo":
            selections = await UserSelectionHistoryDocument.find(
                UserSelectionHistoryDocument.user_id == str(current_user.id),
                UserSelectionHistoryDocument.created_at >= thirty_days_ago,
            ).to_list()
            # Field-specific accuracy intentionally ignores the 30-day window (matches
            # the Postgres query below, which only applies created_at >= thirty_days_ago
            # to daily_accuracy, not field_accuracy).
            all_with_confidence = await UserSelectionHistoryDocument.find(
                UserSelectionHistoryDocument.user_id == str(current_user.id),
                UserSelectionHistoryDocument.suggestion_confidence != None,  # noqa: E711 - Beanie query operator
            ).to_list()
        else:
            from models.learning import UserSelectionHistory

            def _fetch_pg():
                recent = db.query(UserSelectionHistory).filter(
                    UserSelectionHistory.user_id == current_user.id,
                    UserSelectionHistory.created_at >= thirty_days_ago,
                ).all()
                with_confidence = db.query(UserSelectionHistory).filter(
                    UserSelectionHistory.user_id == current_user.id,
                    UserSelectionHistory.suggestion_confidence.isnot(None),
                ).all()
                return recent, with_confidence
            selections, all_with_confidence = await run_in_threadpool(_fetch_pg)

        # daily_accuracy only needs the 30-day-windowed set; field_accuracy only
        # needs the has-confidence set - merge without double counting by computing
        # them from their respective inputs directly.
        daily_result = _process_accuracy_analytics(selections)["daily_accuracy"]
        field_result = _process_accuracy_analytics(all_with_confidence)["field_accuracy"]
        return {"daily_accuracy": daily_result, "field_accuracy": field_result}
    except Exception:
        return {"daily_accuracy": [], "field_accuracy": []}


@router.post("/auto-categorize")
def auto_categorize_transactions(
    background_tasks: BackgroundTasks,
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
    updated_transaction_ids = []

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
            updated_transaction_ids.append(transaction.id)

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
    for txn_id in updated_transaction_ids:
        background_tasks.add_task(mongo_sync.mirror_transaction_upsert, db, txn_id)

    return {
        "status": "success",
        "message": f"Auto-categorized {len(auto_categorized)} transactions",
        "categorized_transactions": auto_categorized,
        "total_processed": len(uncategorized_transactions)
    }


@router.post("/auto-categorize-filtered")
def auto_categorize_filtered_transactions(
    filters: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Enhanced auto-categorization for filtered transactions using historical data training.
    Trains model on historical data up to filter start date, then applies to filtered transactions.
    """
    from models.transactions import Transaction
    from sqlalchemy import and_, or_
    from datetime import datetime
    
    # Parse filters
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')
    account_ids = filters.get('account_ids', [])
    category_ids = filters.get('category_ids', [])
    payee_ids = filters.get('payee_ids', [])
    
    # Step 1: Get historical training data (transactions before start_date)
    training_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.payee_id.isnot(None),
        Transaction.category_id.isnot(None)
    )
    
    if start_date:
        training_query = training_query.filter(Transaction.date < start_date)
    
    training_transactions = training_query.all()
    
    # Step 2: Get filtered transactions to categorize
    target_query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    # Apply filters to target transactions
    if start_date:
        target_query = target_query.filter(Transaction.date >= start_date)
    if end_date:
        target_query = target_query.filter(Transaction.date <= end_date)
    if account_ids:
        target_query = target_query.filter(Transaction.account_id.in_(account_ids))
    if category_ids:
        target_query = target_query.filter(
            or_(Transaction.category_id.in_(category_ids), Transaction.category_id.is_(None))
        )
    if payee_ids:
        target_query = target_query.filter(
            or_(Transaction.payee_id.in_(payee_ids), Transaction.payee_id.is_(None))
        )
    
    target_transactions = target_query.all()
    
    # Step 3: Enhanced training and prediction
    auto_categorized = []
    updated_transaction_ids = []
    training_stats = {
        "training_transactions_count": len(training_transactions),
        "target_transactions_count": len(target_transactions),
        "predictions_made": 0,
        "high_confidence_applied": 0
    }
    
    # Create enhanced feature-based training patterns
    enhanced_patterns = _build_enhanced_patterns(training_transactions)
    
    for transaction in target_transactions:
        updates = {}
        applied_predictions = []
        
        # Enhanced prediction using multiple features
        predictions = _predict_with_enhanced_features(
            transaction, enhanced_patterns, training_transactions
        )
        
        # Enhanced categorization using multiple features
        
        # Apply payee prediction if confident and not already set
        if predictions.get('payee') and not transaction.payee_id:
            payee_pred = predictions['payee']
            if payee_pred['confidence'] >= 0.6:  # High confidence threshold
                updates["payee_id"] = payee_pred['payee_id']
                applied_predictions.append({
                    "field": "payee",
                    "value": payee_pred['payee_name'],
                    "confidence": payee_pred['confidence']
                })
        
        # Apply category prediction if confident and not already set
        if predictions.get('category') and not transaction.category_id:
            category_pred = predictions['category']
            if category_pred['confidence'] >= 0.6:  # High confidence threshold
                updates["category_id"] = category_pred['category_id']
                applied_predictions.append({
                    "field": "category", 
                    "value": category_pred['category_name'],
                    "confidence": category_pred['confidence']
                })
        
        # Apply updates if any predictions were made
        if updates:
            for field, value in updates.items():
                setattr(transaction, field, value)
            updated_transaction_ids.append(transaction.id)

            training_stats["predictions_made"] += len(applied_predictions)
            training_stats["high_confidence_applied"] += 1
            
            auto_categorized.append({
                "transaction_id": str(transaction.id),
                "description": transaction.description,
                "amount": float(transaction.amount),
                "date": transaction.date.isoformat(),
                "account_type": transaction.account.type if transaction.account else None,
                "updates": updates,
                "predictions": applied_predictions,
                "confidence": max([p['confidence'] for p in applied_predictions]) if applied_predictions else 0.0
            })
            
            # Record the categorization for learning
            for prediction in applied_predictions:
                TransactionLearningService.record_user_selection(
                    db=db,
                    user_id=str(current_user.id),
                    transaction_id=str(transaction.id),
                    field_type=prediction['field'],
                    selected_value_id=updates.get(f"{prediction['field']}_id"),
                    selected_value_name=prediction['value'],
                    transaction_description=transaction.description,
                    transaction_amount=float(transaction.amount),
                    account_type=transaction.account.type if transaction.account else None,
                    was_suggested=True,
                    suggestion_confidence=prediction['confidence'],
                    selection_method="enhanced_auto_categorize"
                )
    
    db.commit()
    for txn_id in updated_transaction_ids:
        background_tasks.add_task(mongo_sync.mirror_transaction_upsert, db, txn_id)

    return {
        "status": "success",
        "message": f"Enhanced auto-categorization completed: {training_stats['high_confidence_applied']} transactions categorized",
        "categorized_transactions": auto_categorized,
        "training_stats": training_stats,
        "filters_applied": filters
    }


def _build_enhanced_patterns(training_transactions):
    """Build enhanced patterns from training data using multiple features"""
    patterns = {
        "description_patterns": {},
        "amount_ranges": {},
        "account_patterns": {},
        "combined_patterns": {}
    }
    
    for tx in training_transactions:
        if not tx.description:
            continue
            
        # Description patterns
        desc_lower = tx.description.lower().strip()
        words = desc_lower.split()
        
        # Store exact descriptions
        if desc_lower not in patterns["description_patterns"]:
            patterns["description_patterns"][desc_lower] = {"payees": {}, "categories": {}}
        
        if tx.payee_id:
            payee_name = tx.payee.name if tx.payee else "Unknown"
            patterns["description_patterns"][desc_lower]["payees"][tx.payee_id] = {
                "name": payee_name,
                "count": patterns["description_patterns"][desc_lower]["payees"].get(tx.payee_id, {}).get("count", 0) + 1
            }
        
        if tx.category_id:
            category_name = tx.category.name if tx.category else "Unknown"
            patterns["description_patterns"][desc_lower]["categories"][tx.category_id] = {
                "name": category_name,
                "count": patterns["description_patterns"][desc_lower]["categories"].get(tx.category_id, {}).get("count", 0) + 1
            }
        
        # Amount range patterns
        amount = float(tx.amount) if tx.amount else 0
        amount_bucket = _get_amount_bucket(amount)
        
        if amount_bucket not in patterns["amount_ranges"]:
            patterns["amount_ranges"][amount_bucket] = {"payees": {}, "categories": {}}
        
        # Account type patterns
        account_type = tx.account.type if tx.account else "unknown"
        if account_type not in patterns["account_patterns"]:
            patterns["account_patterns"][account_type] = {"payees": {}, "categories": {}}
    
    return patterns


def _get_amount_bucket(amount):
    """Categorize amounts into buckets for pattern matching"""
    if amount == 0:
        return "zero"
    elif amount < 10:
        return "micro"
    elif amount < 50:
        return "small"
    elif amount < 200:
        return "medium" 
    elif amount < 1000:
        return "large"
    else:
        return "huge"


def _predict_with_enhanced_features(transaction, patterns, training_transactions):
    """Make enhanced predictions using multiple features"""
    predictions = {}
    
    if not transaction.description:
        return predictions
    
    desc_lower = transaction.description.lower().strip()
    amount = float(transaction.amount) if transaction.amount else 0
    amount_bucket = _get_amount_bucket(amount)
    account_type = transaction.account.type if transaction.account else "unknown"
    
    # Exact description match
    exact_match = patterns["description_patterns"].get(desc_lower)
    if exact_match:
        # Predict payee
        if exact_match["payees"]:
            best_payee = max(exact_match["payees"].items(), key=lambda x: x[1]["count"])
            predictions["payee"] = {
                "id": best_payee[0],
                "name": best_payee[1]["name"],
                "confidence": min(0.95, 0.6 + (best_payee[1]["count"] * 0.1)),
                "reason": f"Exact description match (used {best_payee[1]['count']} times)"
            }
        
        # Predict category
        if exact_match["categories"]:
            best_category = max(exact_match["categories"].items(), key=lambda x: x[1]["count"])
            predictions["category"] = {
                "id": best_category[0],
                "name": best_category[1]["name"],
                "confidence": min(0.95, 0.6 + (best_category[1]["count"] * 0.1)),
                "reason": f"Exact description match (used {best_category[1]['count']} times)"
            }
    
    # Partial description match using keywords
    if not predictions.get("payee") or not predictions.get("category"):
        desc_words = set(desc_lower.split())
        
        # Find partial matches
        for pattern_desc, pattern_data in patterns["description_patterns"].items():
            pattern_words = set(pattern_desc.split())
            common_words = desc_words.intersection(pattern_words)
            
            if len(common_words) >= 2:  # At least 2 words in common
                similarity = len(common_words) / len(pattern_words.union(desc_words))
                confidence_boost = similarity * 0.4
                
                if not predictions.get("payee") and pattern_data["payees"]:
                    best_payee = max(pattern_data["payees"].items(), key=lambda x: x[1]["count"])
                    base_confidence = 0.4 + confidence_boost
                    predictions["payee"] = {
                        "id": best_payee[0],
                        "name": best_payee[1]["name"],
                        "confidence": min(0.85, base_confidence),
                        "reason": f"Partial description match ({len(common_words)} common words)"
                    }
                
                if not predictions.get("category") and pattern_data["categories"]:
                    best_category = max(pattern_data["categories"].items(), key=lambda x: x[1]["count"])
                    base_confidence = 0.4 + confidence_boost
                    predictions["category"] = {
                        "id": best_category[0],
                        "name": best_category[1]["name"],
                        "confidence": min(0.85, base_confidence),
                        "reason": f"Partial description match ({len(common_words)} common words)"
                    }
    
    return predictions


@router.post("/bulk-process")
def bulk_process_transactions(
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
def smart_import_preprocess(
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


def _fetch_spending_predictions_pg(db: Session, user_id: uuid.UUID, one_year_ago):
    from models.transactions import Transaction
    return db.query(Transaction).options(joinedload(Transaction.category)).filter(
        Transaction.user_id == user_id,
        Transaction.type == 'expense',
        Transaction.date >= one_year_ago
    ).all()


async def _fetch_spending_predictions_mongo(user_id: str, one_year_ago):
    return await TransactionDocument.find(
        TransactionDocument.user_id == user_id,
        TransactionDocument.type == 'expense',
        TransactionDocument.date >= one_year_ago,
    ).to_list()


def _process_spending_predictions(transactions) -> dict:
    import calendar

    # Deterministic chronological order - both fetches are unordered, and
    # "recent 3 months" below depends on insertion order into monthly_amounts.
    transactions = sorted(transactions, key=lambda t: (t.date, t.created_at or datetime.min, str(t.id)))

    # Group into (year, month, category_id) -> {total_amount, transaction_count},
    # replicating the original SQL GROUP BY in Python.
    monthly_spending: dict = {}
    for t in transactions:
        key = (t.date.year, t.date.month, t.category_id)
        if key not in monthly_spending:
            monthly_spending[key] = [0.0, 0, t.category.name if t.category else None, t.category.color if t.category else None]
        monthly_spending[key][0] += float(t.amount)
        monthly_spending[key][1] += 1

    # Calculate averages and predictions
    category_predictions = {}
    for (year, month, category_id), (total_amount, transaction_count, cat_name, cat_color) in monthly_spending.items():
        if category_id not in category_predictions:
            category_predictions[category_id] = {
                'monthly_amounts': [],
                'transaction_counts': [],
                'category_id': category_id,
                'category_name': cat_name,
                'category_color': cat_color,
            }
        category_predictions[category_id]['monthly_amounts'].append(total_amount)
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

            for i in range(1, 4):  # Next 3 months
                predicted_month = (current_month + i - 1) % 12 + 1
                predicted_year = current_year + ((current_month + i - 1) // 12)

                predicted_amount = avg_amount * trend_factor
                predicted_transactions = int(avg_transactions)

                predictions.append({
                    'month': predicted_month,
                    'year': predicted_year,
                    'month_name': calendar.month_name[predicted_month],
                    'category_id': str(category_id) if category_id else None,
                    'category_name': data['category_name'] or 'Unknown',
                    'category_color': data['category_color'] or '#666666',
                    'predicted_amount': predicted_amount,
                    'predicted_transactions': predicted_transactions,
                    'confidence': min(0.9, len(data['monthly_amounts']) / 12),  # Higher confidence with more data
                    'trend': 'increasing' if trend_factor > 1.1 else 'decreasing' if trend_factor < 0.9 else 'stable'
                })

    return {
        "predictions": sorted(predictions, key=lambda x: (x['year'], x['month'], -x['predicted_amount'])),
        "total_months_analyzed": len(set([(y, m) for y, m, _ in monthly_spending.keys()])),
        "categories_with_predictions": len(category_predictions)
    }


@router.get("/predictions/spending-patterns")
async def get_spending_pattern_predictions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Predict future spending patterns based on historical data"""
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    if READ_SOURCE == "mongo":
        transactions = await _fetch_spending_predictions_mongo(str(current_user.id), one_year_ago)
    else:
        transactions = await run_in_threadpool(
            _fetch_spending_predictions_pg, db, uuid.UUID(str(current_user.id)), one_year_ago
        )
    return _process_spending_predictions(transactions)


def _process_spending_anomalies(recent_transactions, baseline_transactions) -> dict:
    import statistics

    # Deterministic order: both fetch queries are unordered, and several dict
    # groupings below (category counts, new_payees) are built by iterating these
    # lists, so arbitrary fetch order would otherwise make tie-breaking in the
    # final sort (and dict insertion order) differ between Postgres and Mongo.
    sort_key = lambda t: (t.date, t.created_at or datetime.min, str(t.id))
    recent_transactions = sorted(recent_transactions, key=sort_key)
    baseline_transactions = sorted(baseline_transactions, key=sort_key)

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
        
        # Detect frequency anomalies by category. Category names come from each
        # transaction's own .category attribute (joinedloaded relationship on
        # Postgres, embedded CategoryRef on Mongo) instead of a fresh lookup, so
        # this works unmodified against either backend.
        category_names = {}
        category_baseline_counts = {}
        for transaction in baseline_transactions:
            cat_id = transaction.category_id or 'uncategorized'
            category_baseline_counts[cat_id] = category_baseline_counts.get(cat_id, 0) + 1
            if transaction.category:
                category_names[cat_id] = transaction.category.name

        category_recent_counts = {}
        for transaction in recent_transactions:
            cat_id = transaction.category_id or 'uncategorized'
            category_recent_counts[cat_id] = category_recent_counts.get(cat_id, 0) + 1
            if transaction.category:
                category_names[cat_id] = transaction.category.name

        # Adjust for time period difference (90 days recent vs 180 days baseline)
        time_adjustment = 90 / 180

        for cat_id, recent_count in category_recent_counts.items():
            baseline_count = category_baseline_counts.get(cat_id, 0) * time_adjustment
            if baseline_count > 0 and recent_count > baseline_count * 2:  # More than double the expected frequency
                anomalies.append({
                    'type': 'unusual_frequency',
                    'category_id': str(cat_id) if cat_id != 'uncategorized' else None,
                    'category_name': category_names.get(cat_id, 'Uncategorized'),
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


def _fetch_anomalies_pg(db: Session, user_id: uuid.UUID, ninety_days_ago, baseline_start):
    from models.transactions import Transaction
    recent = db.query(Transaction).options(joinedload(Transaction.category), joinedload(Transaction.payee)).filter(
        Transaction.user_id == user_id,
        Transaction.date >= ninety_days_ago,
        Transaction.type == 'expense'
    ).all()
    baseline = db.query(Transaction).options(joinedload(Transaction.category), joinedload(Transaction.payee)).filter(
        Transaction.user_id == user_id,
        Transaction.date >= baseline_start,
        Transaction.date < ninety_days_ago,
        Transaction.type == 'expense'
    ).all()
    return recent, baseline


async def _fetch_anomalies_mongo(user_id: str, ninety_days_ago, baseline_start):
    recent = await TransactionDocument.find(
        TransactionDocument.user_id == user_id,
        TransactionDocument.date >= ninety_days_ago,
        TransactionDocument.type == 'expense',
    ).to_list()
    baseline = await TransactionDocument.find(
        TransactionDocument.user_id == user_id,
        TransactionDocument.date >= baseline_start,
        TransactionDocument.date < ninety_days_ago,
        TransactionDocument.type == 'expense',
    ).to_list()
    return recent, baseline


@router.get("/predictions/anomalies")
async def detect_spending_anomalies(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Detect unusual spending patterns and potential anomalies"""
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    baseline_start = ninety_days_ago - timedelta(days=180)

    if READ_SOURCE == "mongo":
        recent, baseline = await _fetch_anomalies_mongo(str(current_user.id), ninety_days_ago, baseline_start)
    else:
        recent, baseline = await run_in_threadpool(
            _fetch_anomalies_pg, db, uuid.UUID(str(current_user.id)), ninety_days_ago, baseline_start
        )
    return _process_spending_anomalies(recent, baseline)


def _fetch_budget_recommendations_pg(db: Session, user_id: uuid.UUID, six_months_ago):
    from models.transactions import Transaction
    expenses = db.query(Transaction).options(joinedload(Transaction.category)).filter(
        Transaction.user_id == user_id, Transaction.type == 'expense', Transaction.date >= six_months_ago
    ).all()
    incomes = db.query(Transaction).filter(
        Transaction.user_id == user_id, Transaction.type == 'income', Transaction.date >= six_months_ago
    ).all()
    return expenses, incomes


async def _fetch_budget_recommendations_mongo(user_id: str, six_months_ago):
    expenses = await TransactionDocument.find(
        TransactionDocument.user_id == user_id, TransactionDocument.type == 'expense',
        TransactionDocument.date >= six_months_ago,
    ).to_list()
    incomes = await TransactionDocument.find(
        TransactionDocument.user_id == user_id, TransactionDocument.type == 'income',
        TransactionDocument.date >= six_months_ago,
    ).to_list()
    return expenses, incomes


def _process_budget_recommendations(expenses, incomes) -> dict:
    import statistics

    sort_key = lambda t: (t.date, t.created_at or datetime.min, str(t.id))
    expenses = sorted(expenses, key=sort_key)
    incomes = sorted(incomes, key=sort_key)

    # Group expenses into (year, month, category_id) -> monthly total, replicating
    # the original SQL GROUP BY in Python.
    monthly_category_totals: dict = {}
    category_names: dict = {}
    for t in expenses:
        key = (t.date.year, t.date.month, t.category_id)
        monthly_category_totals[key] = monthly_category_totals.get(key, 0.0) + float(t.amount)
        if t.category:
            category_names[t.category_id] = (t.category.name, t.category.color)

    category_budgets: dict = {}
    for (year, month, category_id), total in monthly_category_totals.items():
        category_budgets.setdefault(category_id, []).append(total)

    recommendations = []
    total_recommended_budget = 0

    for category_id, monthly_amounts in category_budgets.items():
        if len(monthly_amounts) >= 2:  # Need at least 2 months of data
            avg_spending = statistics.mean(monthly_amounts)
            spending_stdev = statistics.stdev(monthly_amounts) if len(monthly_amounts) > 1 else 0

            recent_avg = statistics.mean(monthly_amounts[-2:]) if len(monthly_amounts) >= 2 else avg_spending
            trend_factor = recent_avg / avg_spending if avg_spending > 0 else 1.0

            buffer_factor = 1.2 + (spending_stdev / avg_spending * 0.5) if avg_spending > 0 else 1.2
            recommended_budget = avg_spending * buffer_factor * trend_factor

            name, color = category_names.get(category_id, (None, None))

            consistency_score = 1 - (spending_stdev / avg_spending) if avg_spending > 0 else 0
            priority = 'high' if avg_spending > 500 and consistency_score > 0.7 else \
                      'medium' if avg_spending > 100 or consistency_score > 0.5 else 'low'

            recommendations.append({
                'category_id': str(category_id) if category_id else None,
                'category_name': name or 'Uncategorized',
                'category_color': color or '#666666',
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

    # Average monthly income: group incomes by (year, month), sum each, then average
    # those monthly sums - matches func.avg(func.sum(...)).group_by(month, year).
    monthly_income_totals: dict = {}
    for t in incomes:
        key = (t.date.year, t.date.month)
        monthly_income_totals[key] = monthly_income_totals.get(key, 0.0) + float(t.amount)
    monthly_income = statistics.mean(monthly_income_totals.values()) if monthly_income_totals else 0

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


@router.get("/recommendations/budget")
async def get_budget_recommendations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Generate intelligent budget recommendations based on spending patterns"""
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    if READ_SOURCE == "mongo":
        expenses, incomes = await _fetch_budget_recommendations_mongo(str(current_user.id), six_months_ago)
    else:
        expenses, incomes = await run_in_threadpool(
            _fetch_budget_recommendations_pg, db, uuid.UUID(str(current_user.id)), six_months_ago
        )
    return _process_budget_recommendations(expenses, incomes)


def _fetch_trend_forecast_pg(db: Session, user_id: uuid.UUID, one_year_ago):
    from models.transactions import Transaction
    return db.query(Transaction).filter(
        Transaction.user_id == user_id, Transaction.date >= one_year_ago
    ).all()


async def _fetch_trend_forecast_mongo(user_id: str, one_year_ago):
    return await TransactionDocument.find(
        TransactionDocument.user_id == user_id, TransactionDocument.date >= one_year_ago,
    ).to_list()


def _process_trend_forecast(transactions) -> dict:
    import calendar

    # Group into (year, month, type) -> {total_amount, transaction_count}, replicating
    # the original SQL GROUP BY in Python (commutative sum, no fetch-order dependency).
    grouped: dict = {}
    for t in transactions:
        key = (t.date.year, t.date.month, t.type)
        if key not in grouped:
            grouped[key] = [0.0, 0]
        grouped[key][0] += float(t.amount)
        grouped[key][1] += 1

    # Organize data by month and type
    monthly_data = {}

    for (year, month, transaction_type), (total_amount, transaction_count) in grouped.items():
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


@router.get("/trends/forecast")
async def get_expense_trend_forecast(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Generate expense trend analysis and forecasting"""
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    if READ_SOURCE == "mongo":
        transactions = await _fetch_trend_forecast_mongo(str(current_user.id), one_year_ago)
    else:
        transactions = await run_in_threadpool(_fetch_trend_forecast_pg, db, uuid.UUID(str(current_user.id)), one_year_ago)
    return _process_trend_forecast(transactions)


@router.post("/train")
def manually_train_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually trigger AI model training on user's historical transaction data.
    This will update the model used for payee and category suggestions.
    """
    try:
        from services.ai_cache import set_cached_trainer, set_last_training_stats
        from services.training_logger import start_training, make_log_fn, end_training

        start_training(current_user.id)
        try:
            log_fn = make_log_fn(current_user.id)
            ai_trainer = TransactionAITrainer(db, current_user.id, log_fn=log_fn)
            training_stats = ai_trainer.train_from_historical_data()
        finally:
            end_training(current_user.id)

        # Update the cache with the freshly trained model
        set_cached_trainer(current_user.id, ai_trainer)
        set_last_training_stats(current_user.id, training_stats)

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
def cleanup_selection_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    One-time cleanup to reduce user_selection_history table to 200 most recent entries per user.
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


def _process_correction_patterns(correction_patterns) -> dict:
    patterns_data = []
    for pattern in correction_patterns:
        patterns_data.append({
            "id": str(pattern.id),
            "original_suggestion_type": pattern.original_suggestion_type,
            "original_suggestion_name": pattern.original_suggestion_name,
            "user_correction_name": pattern.user_correction_name,
            "correction_frequency": pattern.correction_frequency,
            "transaction_description": pattern.transaction_description,
            "transaction_amount": pattern.transaction_amount,
            "suggestion_confidence": pattern.suggestion_confidence,
            "first_seen": pattern.first_seen.isoformat() if pattern.first_seen else None,
            "last_seen": pattern.last_seen.isoformat() if pattern.last_seen else None,
            "context_data": pattern.context_data
        })

    return {
        "correction_patterns": patterns_data,
        "total_patterns": len(patterns_data),
        "summary": {
            "payee_corrections": len([p for p in patterns_data if p["original_suggestion_type"] == "payee"]),
            "category_corrections": len([p for p in patterns_data if p["original_suggestion_type"] == "category"]),
            "most_frequent_correction": patterns_data[0] if patterns_data else None
        }
    }


@router.get("/correction-patterns")
async def get_correction_patterns(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """
    Get user's correction patterns to understand how often they correct AI suggestions.
    Useful for improving the learning system and debugging suggestion accuracy.
    """
    if READ_SOURCE == "mongo":
        patterns = await UserCorrectionPatternDocument.find(
            UserCorrectionPatternDocument.user_id == str(current_user.id)
        ).sort(-UserCorrectionPatternDocument.correction_frequency, "_id").to_list()
    else:
        def _fetch_pg():
            from models.learning import UserCorrectionPattern
            return db.query(UserCorrectionPattern).filter(
                UserCorrectionPattern.user_id == current_user.id
            ).order_by(UserCorrectionPattern.correction_frequency.desc(), UserCorrectionPattern.id).all()
        patterns = await run_in_threadpool(_fetch_pg)
    return _process_correction_patterns(patterns)


def _process_correction_insights(corrections) -> dict:
    """Mirrors TransactionLearningService.get_correction_insights - a Mongo
    UserCorrectionPatternDocument and a Postgres UserCorrectionPattern expose the
    same attribute surface this needs, so the logic works unmodified either way."""
    try:
        from collections import defaultdict
        import re

        if not corrections:
            return {"message": "No correction patterns found", "insights": []}

        insights = []

        suggestion_corrections = defaultdict(list)
        for correction in corrections:
            key = f"{correction.original_suggestion_type}:{correction.original_suggestion_name}"
            suggestion_corrections[key].append(correction)

        problematic_suggestions = []
        for suggestion, correction_list in suggestion_corrections.items():
            total_corrections = sum(c.correction_frequency for c in correction_list)
            if total_corrections >= 2:
                suggestion_type, suggestion_name = suggestion.split(":", 1)
                correction_counts = defaultdict(int)
                for correction in correction_list:
                    correction_counts[correction.user_correction_name] += correction.correction_frequency
                most_common_correction = max(correction_counts.items(), key=lambda x: x[1])
                problematic_suggestions.append({
                    "suggestion_type": suggestion_type,
                    "suggestion_name": suggestion_name,
                    "total_corrections": total_corrections,
                    "most_common_correction": most_common_correction[0],
                    "correction_frequency": most_common_correction[1]
                })

        problematic_suggestions.sort(key=lambda x: x["total_corrections"], reverse=True)

        if problematic_suggestions:
            insights.append({
                "type": "frequently_corrected_suggestions",
                "title": "Frequently Corrected Suggestions",
                "description": "These suggestions are often corrected by the user",
                "data": problematic_suggestions[:10],
                "suggestion": "Consider updating the learning patterns for these suggestions"
            })

        description_patterns = defaultdict(list)
        for correction in corrections:
            if correction.transaction_description:
                words = re.findall(r'\b\w+\b', correction.transaction_description.lower())
                for word in words:
                    if len(word) > 3:
                        description_patterns[word].append(correction)

        problematic_keywords = []
        for keyword, correction_list in description_patterns.items():
            if len(correction_list) >= 2:
                total_corrections = sum(c.correction_frequency for c in correction_list)
                problematic_keywords.append({
                    "keyword": keyword,
                    "correction_count": len(correction_list),
                    "total_corrections": total_corrections
                })

        problematic_keywords.sort(key=lambda x: x["total_corrections"], reverse=True)

        if problematic_keywords:
            insights.append({
                "type": "problematic_keywords",
                "title": "Keywords Often Associated with Corrections",
                "description": "Transaction descriptions containing these keywords often lead to corrections",
                "data": problematic_keywords[:10],
                "suggestion": "Improve pattern recognition for transactions containing these keywords"
            })

        return {
            "total_corrections": len(corrections),
            "unique_patterns": len(suggestion_corrections),
            "insights": insights
        }

    except Exception as e:
        return {"error": f"Failed to analyze correction patterns: {str(e)}"}


@router.get("/correction-insights")
async def get_correction_insights(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """
    Get insights from user correction patterns to understand and improve AI suggestion accuracy.
    """
    if READ_SOURCE == "mongo":
        corrections = await UserCorrectionPatternDocument.find(
            UserCorrectionPatternDocument.user_id == str(current_user.id)
        ).to_list()
        insights = _process_correction_insights(corrections)
    else:
        insights = await run_in_threadpool(
            TransactionLearningService.get_correction_insights, db, current_user.id
        )

    return {
        "status": "success",
        "correction_insights": insights
    }


@router.get("/model-status")
def get_model_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Return current cached AI trainer state for the user."""
    from services.ai_cache import _trainer_cache, get_last_training_stats

    user_key = str(current_user.id)
    is_trained = user_key in _trainer_cache

    if is_trained:
        trainer = _trainer_cache[user_key]
        summary = trainer.get_training_summary()
        last_stats = get_last_training_stats(current_user.id)
        return {
            "is_trained": True,
            "model_type": summary.get("model_type", "Rules+XGBoost"),
            "device": summary.get("device", "n/a"),
            "rules_built": summary.get("rules_built", 0),
            "payee_chain_entries": summary.get("payee_chain_entries", 0),
            "payee_model_trained": summary.get("payee_model_trained", False),
            "category_model_trained": summary.get("category_model_trained", False),
            "payee_training_samples": last_stats.get("payee_training_samples", 0),
            "category_training_samples": last_stats.get("category_training_samples", 0),
            "total_transactions": last_stats.get("total_transactions", 0),
        }
    else:
        return {
            "is_trained": False,
            "model_type": "Rules+XGBoost",
            "device": "n/a",
            "rules_built": 0,
            "payee_chain_entries": 0,
            "payee_model_trained": False,
            "category_model_trained": False,
            "payee_training_samples": 0,
            "category_training_samples": 0,
            "total_transactions": 0,
        }


@router.get("/training-logs")
def get_training_logs(
    current_user: User = Depends(get_current_active_user)
):
    """Get captured training logs for the current user."""
    from services.training_logger import get_training_logs, has_active_training

    logs = get_training_logs(current_user.id)
    is_training = has_active_training(current_user.id)

    return {
        "logs": logs,
        "is_training": is_training,
        "total_logs": len(logs)
    }