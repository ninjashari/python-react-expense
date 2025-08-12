from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import re
from collections import Counter

from models.learning import UserTransactionPattern, UserSelectionHistory, UserCorrectionPattern, LearningStatistics
from models.transactions import Transaction
from models.payees import Payee
from models.categories import Category


class TransactionLearningService:
    """Service for learning from user transaction behavior"""
    
    @staticmethod
    def record_user_selection(
        db: Session,
        user_id: str,
        transaction_id: str,
        field_type: str,  # 'payee' or 'category'
        selected_value_id: Optional[str],
        selected_value_name: str,
        transaction_description: Optional[str] = None,
        transaction_amount: Optional[float] = None,
        account_type: Optional[str] = None,
        was_suggested: bool = False,
        suggestion_confidence: Optional[float] = None,
        selection_method: str = 'manual'
    ) -> UserSelectionHistory:
        """Record every user selection for learning purposes"""
        
        selection_record = UserSelectionHistory(
            user_id=user_id,
            transaction_id=transaction_id,
            field_type=field_type,
            selected_value_id=selected_value_id,
            selected_value_name=selected_value_name,
            transaction_description=transaction_description,
            transaction_amount=transaction_amount,
            account_type=account_type,
            was_suggested=was_suggested,
            suggestion_confidence=suggestion_confidence,
            selection_method=selection_method
        )
        
        db.add(selection_record)
        db.commit()
        
        # Update or create learning patterns based on this selection
        TransactionLearningService._update_learning_patterns(
            db, selection_record
        )
        
        return selection_record
    
    @staticmethod
    def _update_learning_patterns(
        db: Session, 
        selection: UserSelectionHistory
    ):
        """Update learning patterns based on user selection"""
        
        if not selection.transaction_description:
            return
        
        # Extract keywords from transaction description
        keywords = TransactionLearningService._extract_keywords(
            selection.transaction_description
        )
        
        if not keywords:
            return
        
        # Find existing pattern or create new one
        from sqlalchemy import text
        existing_pattern = db.query(UserTransactionPattern).filter(
            UserTransactionPattern.user_id == selection.user_id,
            text("description_keywords && CAST(:keywords AS varchar[])").params(keywords=keywords)
        ).first()
        
        if selection.field_type == 'payee' and selection.selected_value_id:
            payee_id = selection.selected_value_id
        else:
            payee_id = None
            
        if selection.field_type == 'category' and selection.selected_value_id:
            category_id = selection.selected_value_id
        else:
            category_id = None
        
        if existing_pattern:
            # Update existing pattern
            if payee_id and not existing_pattern.payee_id:
                existing_pattern.payee_id = payee_id
            if category_id and not existing_pattern.category_id:
                existing_pattern.category_id = category_id
                
            # Update metrics
            existing_pattern.usage_frequency += 1
            existing_pattern.last_used = datetime.utcnow()
            
            # Update confidence based on usage
            existing_pattern.confidence_score = min(0.95, 
                existing_pattern.confidence_score + (0.05 * (1 - existing_pattern.confidence_score))
            )
            
            # Update amount range
            if selection.transaction_amount:
                if existing_pattern.amount_min is None or selection.transaction_amount < existing_pattern.amount_min:
                    existing_pattern.amount_min = selection.transaction_amount
                if existing_pattern.amount_max is None or selection.transaction_amount > existing_pattern.amount_max:
                    existing_pattern.amount_max = selection.transaction_amount
                    
        else:
            # Create new pattern
            new_pattern = UserTransactionPattern(
                user_id=selection.user_id,
                description_keywords=keywords,
                payee_id=payee_id,
                category_id=category_id,
                confidence_score=0.3,  # Start with moderate confidence
                usage_frequency=1,
                success_rate=1.0,
                last_used=datetime.utcnow(),
                amount_min=selection.transaction_amount,
                amount_max=selection.transaction_amount,
                account_types=[selection.account_type] if selection.account_type else None
            )
            db.add(new_pattern)
        
        db.commit()
    
    @staticmethod
    def _extract_keywords(description: str) -> List[str]:
        """Extract meaningful keywords from transaction description"""
        if not description:
            return []
        
        # Convert to lowercase and remove special characters
        clean_desc = re.sub(r'[^\w\s]', ' ', description.lower())
        
        # Split into words
        words = clean_desc.split()
        
        # Remove common stop words and short words
        stop_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 
            'below', 'between', 'among', 'is', 'are', 'was', 'were', 'been', 'be', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
            'may', 'might', 'must', 'shall', 'payment', 'purchase', 'transaction', 'charge'
        }
        
        # Filter meaningful keywords
        keywords = [
            word for word in words 
            if len(word) >= 3 and word not in stop_words and not word.isdigit()
        ]
        
        # Return top 5 most significant keywords
        return keywords[:5]
    
    @staticmethod
    def learn_from_transaction_update(
        db: Session,
        user_id: str,
        transaction_id: str,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        update_context: Dict[str, Any]
    ):
        """Learn from transaction updates (corrections, changes)"""
        
        # Check if payee was changed
        if old_values.get('payee_id') != new_values.get('payee_id'):
            TransactionLearningService.record_user_selection(
                db=db,
                user_id=user_id,
                transaction_id=transaction_id,
                field_type='payee',
                selected_value_id=new_values.get('payee_id'),
                selected_value_name=TransactionLearningService._get_name_by_id(
                    db, 'payee', new_values.get('payee_id')
                ) or 'Unknown',
                transaction_description=new_values.get('description') or old_values.get('description'),
                transaction_amount=new_values.get('amount') or old_values.get('amount'),
                account_type=update_context.get('account_type'),
                selection_method=update_context.get('update_method', 'form_edit')
            )
        
        # Check if category was changed
        if old_values.get('category_id') != new_values.get('category_id'):
            TransactionLearningService.record_user_selection(
                db=db,
                user_id=user_id,
                transaction_id=transaction_id,
                field_type='category',
                selected_value_id=new_values.get('category_id'),
                selected_value_name=TransactionLearningService._get_name_by_id(
                    db, 'category', new_values.get('category_id')
                ) or 'Unknown',
                transaction_description=new_values.get('description') or old_values.get('description'),
                transaction_amount=new_values.get('amount') or old_values.get('amount'),
                account_type=update_context.get('account_type'),
                selection_method=update_context.get('update_method', 'form_edit')
            )
    
    @staticmethod
    def _get_name_by_id(db: Session, entity_type: str, entity_id: Optional[str]) -> Optional[str]:
        """Helper to get entity name by ID"""
        if not entity_id:
            return None
            
        if entity_type == 'payee':
            payee = db.query(Payee).filter(Payee.id == entity_id).first()
            return payee.name if payee else None
        elif entity_type == 'category':
            category = db.query(Category).filter(Category.id == entity_id).first()
            return category.name if category else None
            
        return None
    
    @staticmethod
    def get_user_patterns(db: Session, user_id: str) -> List[UserTransactionPattern]:
        """Get all learning patterns for a user"""
        return db.query(UserTransactionPattern).filter(
            UserTransactionPattern.user_id == user_id
        ).order_by(
            UserTransactionPattern.confidence_score.desc(),
            UserTransactionPattern.usage_frequency.desc()
        ).all()
    
    @staticmethod
    def get_suggestions_for_description(
        db: Session, 
        user_id: str, 
        description: str,
        amount: Optional[float] = None,
        account_type: Optional[str] = None
    ) -> Dict[str, List[Dict]]:
        """Get AI suggestions based on description and learned patterns"""
        
        if not description:
            return {"payee_suggestions": [], "category_suggestions": []}
        
        # Extract keywords from description
        keywords = TransactionLearningService._extract_keywords(description)
        
        if not keywords:
            return {"payee_suggestions": [], "category_suggestions": []}
        
        # Find matching patterns using PostgreSQL array overlap operator
        from sqlalchemy import text
        patterns = db.query(UserTransactionPattern).filter(
            UserTransactionPattern.user_id == user_id,
            text("description_keywords && CAST(:keywords AS varchar[])").params(keywords=keywords)
        ).order_by(
            UserTransactionPattern.confidence_score.desc(),
            UserTransactionPattern.usage_frequency.desc()
        ).limit(10).all()
        
        payee_suggestions = []
        category_suggestions = []
        
        for pattern in patterns:
            # Calculate relevance score
            matching_keywords = set(keywords).intersection(set(pattern.description_keywords))
            keyword_match_ratio = len(matching_keywords) / len(pattern.description_keywords)
            
            # Amount range check
            amount_match = True
            if amount and pattern.amount_min and pattern.amount_max:
                amount_match = pattern.amount_min <= amount <= pattern.amount_max * 1.5  # Allow some flexibility
            
            # Account type check
            account_match = True
            if account_type and pattern.account_types:
                account_match = account_type in pattern.account_types
            
            # Calculate final confidence
            final_confidence = pattern.confidence_score * keyword_match_ratio
            if not amount_match:
                final_confidence *= 0.7
            if not account_match:
                final_confidence *= 0.8
            
            # Add payee suggestion
            if pattern.payee_id and final_confidence > 0.2:
                payee = db.query(Payee).filter(Payee.id == pattern.payee_id).first()
                if payee:
                    payee_suggestions.append({
                        "id": str(pattern.payee_id),
                        "name": payee.name,
                        "type": "ai_suggestion",
                        "confidence": round(final_confidence, 2),
                        "reason": f"Based on keywords: {', '.join(matching_keywords)}",
                        "usage_count": pattern.usage_frequency
                    })
            
            # Add category suggestion
            if pattern.category_id and final_confidence > 0.2:
                category = db.query(Category).filter(Category.id == pattern.category_id).first()
                if category:
                    category_suggestions.append({
                        "id": str(pattern.category_id),
                        "name": category.name,
                        "type": "ai_suggestion",
                        "confidence": round(final_confidence, 2),
                        "reason": f"Based on keywords: {', '.join(matching_keywords)}",
                        "usage_count": pattern.usage_frequency,
                        "color": category.color
                    })
        
        # Remove duplicates and sort by confidence
        payee_suggestions = list({s['id']: s for s in payee_suggestions}.values())
        category_suggestions = list({s['id']: s for s in category_suggestions}.values())
        
        payee_suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        category_suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        
        return {
            "payee_suggestions": payee_suggestions[:5],  # Top 5 suggestions
            "category_suggestions": category_suggestions[:5]
        }