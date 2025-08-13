"""
AI Training Service for Transaction Categorization
Trains on user's historical data and provides predictions for new transactions
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.transactions import Transaction
from models.categories import Category
from models.payees import Payee
from models.users import User
import re
from collections import defaultdict
import uuid


class TransactionAITrainer:
    def __init__(self, db: Session, user_id: uuid.UUID):
        self.db = db
        self.user_id = user_id
        self.trained_patterns = {
            'payee_patterns': defaultdict(list),
            'category_patterns': defaultdict(list)
        }
        self.existing_payees = {}
        self.existing_categories = {}
        
    def train_from_historical_data(self) -> Dict:
        """
        Train AI model on user's historical transaction data
        Returns training statistics
        """
        # Get user's existing payees and categories
        self._load_existing_entities()
        
        # Get all historical transactions with payee and category assigned
        historical_transactions = self.db.query(Transaction).filter(
            and_(
                Transaction.user_id == self.user_id,
                Transaction.payee_id.isnot(None),
                Transaction.category_id.isnot(None)
            )
        ).all()
        
        training_stats = {
            'total_transactions': len(historical_transactions),
            'payee_patterns_learned': 0,
            'category_patterns_learned': 0
        }
        
        # Train patterns for each transaction
        for transaction in historical_transactions:
            self._extract_patterns(transaction)
            
        # Calculate pattern statistics
        training_stats['payee_patterns_learned'] = len(self.trained_patterns['payee_patterns'])
        training_stats['category_patterns_learned'] = len(self.trained_patterns['category_patterns'])
        
        return training_stats
    
    def _load_existing_entities(self):
        """Load existing payees and categories for the user"""
        # Load payees
        payees = self.db.query(Payee).filter(Payee.user_id == self.user_id).all()
        self.existing_payees = {payee.id: payee for payee in payees}
        
        # Load categories
        categories = self.db.query(Category).filter(Category.user_id == self.user_id).all()
        self.existing_categories = {category.id: category for category in categories}
    
    def _extract_patterns(self, transaction: Transaction):
        """Extract patterns from a historical transaction"""
        description = transaction.description.lower().strip()
        transaction_type = transaction.type
        amount_range = self._get_amount_range(transaction.amount)
        
        # Create feature vector
        features = {
            'description_words': self._extract_keywords(description),
            'transaction_type': transaction_type,
            'amount_range': amount_range,
            'description_full': description
        }
        
        # Store payee pattern
        if transaction.payee_id and transaction.payee_id in self.existing_payees:
            payee = self.existing_payees[transaction.payee_id]
            pattern_key = self._create_pattern_key(features)
            self.trained_patterns['payee_patterns'][pattern_key].append({
                'payee_id': payee.id,
                'payee_name': payee.name,
                'confidence': 1.0,
                'frequency': 1
            })
        
        # Store category pattern
        if transaction.category_id and transaction.category_id in self.existing_categories:
            category = self.existing_categories[transaction.category_id]
            pattern_key = self._create_pattern_key(features)
            self.trained_patterns['category_patterns'][pattern_key].append({
                'category_id': category.id,
                'category_name': category.name,
                'confidence': 1.0,
                'frequency': 1
            })
    
    def _extract_keywords(self, description: str) -> List[str]:
        """Extract meaningful keywords from description"""
        # Remove common stop words and extract meaningful terms
        stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'}
        
        # Clean and split description
        cleaned = re.sub(r'[^\w\s]', ' ', description)
        words = [word.lower().strip() for word in cleaned.split() if len(word) > 2]
        keywords = [word for word in words if word not in stop_words]
        
        return keywords[:5]  # Return top 5 keywords
    
    def _get_amount_range(self, amount: float) -> str:
        """Categorize amount into ranges for pattern matching"""
        if amount < 10:
            return 'micro'  # < $10
        elif amount < 50:
            return 'small'  # $10-$50
        elif amount < 200:
            return 'medium'  # $50-$200
        elif amount < 1000:
            return 'large'   # $200-$1000
        else:
            return 'xlarge'  # $1000+
    
    def _create_pattern_key(self, features: Dict) -> str:
        """Create a unique pattern key from features"""
        keywords_str = '_'.join(sorted(features['description_words']))
        return f"{keywords_str}_{features['transaction_type']}_{features['amount_range']}"
    
    def predict_payee_and_category(self, description: str, transaction_type: str, amount: float) -> Dict:
        """
        Predict payee and category for a new transaction based on trained patterns
        Returns only existing payees and categories, never creates new ones
        """
        # Extract features from new transaction
        features = {
            'description_words': self._extract_keywords(description.lower()),
            'transaction_type': transaction_type,
            'amount_range': self._get_amount_range(float(amount)),
            'description_full': description.lower()
        }
        
        # Find best matches
        payee_prediction = self._find_best_match('payee', features)
        category_prediction = self._find_best_match('category', features)
        
        return {
            'payee': payee_prediction,
            'category': category_prediction
        }
    
    def _find_best_match(self, field_type: str, features: Dict) -> Optional[Dict]:
        """Find best matching payee or category based on features"""
        patterns_key = f"{field_type}_patterns"
        best_match = None
        best_score = 0.0
        
        # Try exact pattern match first
        pattern_key = self._create_pattern_key(features)
        if pattern_key in self.trained_patterns[patterns_key]:
            candidates = self.trained_patterns[patterns_key][pattern_key]
            if candidates:
                # Return the most frequent match
                best_candidate = max(candidates, key=lambda x: x.get('frequency', 1))
                return {
                    'id': best_candidate[f'{field_type}_id'],
                    'name': best_candidate[f'{field_type}_name'],
                    'confidence': 0.95,  # High confidence for exact match
                    'match_type': 'exact'
                }
        
        # Try partial matches based on keywords and transaction type
        description_words = features['description_words']
        transaction_type = features['transaction_type']
        
        for pattern_key, candidates in self.trained_patterns[patterns_key].items():
            score = self._calculate_similarity_score(
                pattern_key, description_words, transaction_type, features['amount_range']
            )
            
            if score > best_score and score >= 0.6:  # Minimum confidence threshold
                best_score = score
                best_candidate = max(candidates, key=lambda x: x.get('frequency', 1))
                best_match = {
                    'id': best_candidate[f'{field_type}_id'],
                    'name': best_candidate[f'{field_type}_name'],
                    'confidence': score,
                    'match_type': 'partial'
                }
        
        return best_match
    
    def _calculate_similarity_score(self, pattern_key: str, description_words: List[str], 
                                  transaction_type: str, amount_range: str) -> float:
        """Calculate similarity score between pattern and new transaction features"""
        parts = pattern_key.split('_')
        if len(parts) < 3:
            return 0.0
            
        pattern_type = parts[-2]
        pattern_amount_range = parts[-1]
        pattern_keywords = parts[:-2]
        
        score = 0.0
        
        # Transaction type match (weight: 0.3)
        if pattern_type == transaction_type:
            score += 0.3
        
        # Amount range match (weight: 0.2) 
        if pattern_amount_range == amount_range:
            score += 0.2
        
        # Keyword overlap (weight: 0.5)
        if description_words and pattern_keywords:
            keyword_matches = len(set(description_words) & set(pattern_keywords))
            keyword_score = keyword_matches / max(len(description_words), len(pattern_keywords))
            score += 0.5 * keyword_score
        
        return min(score, 1.0)
    
    def get_training_summary(self) -> Dict:
        """Get summary of trained patterns"""
        return {
            'payee_patterns_count': len(self.trained_patterns['payee_patterns']),
            'category_patterns_count': len(self.trained_patterns['category_patterns']),
            'existing_payees_count': len(self.existing_payees),
            'existing_categories_count': len(self.existing_categories)
        }