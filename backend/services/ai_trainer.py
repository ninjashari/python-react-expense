"""
Enhanced AI Training Service for Transaction Categorization
Uses Deep Neural Network with PyTorch for better predictions
Features: description tokens, account info, account type, transaction type, and amount
Trains on user's historical data and provides predictions for new transactions
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.transactions import Transaction
from models.categories import Category
from models.payees import Payee
from models.accounts import Account
from models.users import User
import re
from collections import defaultdict, Counter
import uuid
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import LabelEncoder
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not available. Using fallback pattern matching.")


class TransactionDataset(Dataset):
    """Custom Dataset for transaction data"""
    def __init__(self, features, labels):
        self.features = torch.FloatTensor(features)
        self.labels = torch.LongTensor(labels)
    
    def __len__(self):
        return len(self.labels)
    
    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


class DeepTransactionClassifier(nn.Module):
    """Deep Neural Network for transaction classification"""
    def __init__(self, input_size, hidden_sizes, num_classes, dropout=0.3):
        super(DeepTransactionClassifier, self).__init__()
        
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(nn.BatchNorm1d(hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            prev_size = hidden_size
        
        layers.append(nn.Linear(prev_size, num_classes))
        
        self.network = nn.Sequential(*layers)
        
    def forward(self, x):
        return self.network(x)


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
        self.existing_accounts = {}
        
        # Deep Learning models
        self.payee_model = None
        self.category_model = None
        self.payee_label_encoder = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.category_label_encoder = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.account_label_encoder = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.account_type_encoder = LabelEncoder() if SKLEARN_AVAILABLE else None
        
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=150,  # Increased for more description features
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.95,
            lowercase=True,
            strip_accents='unicode'
        ) if SKLEARN_AVAILABLE else None
        
        self.min_training_samples = 15  # Minimum samples needed for deep learning
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Model hyperparameters
        self.hidden_sizes = [256, 128, 64]  # Deep architecture
        self.learning_rate = 0.001
        self.batch_size = 32
        self.num_epochs = 50
        self.dropout = 0.3
        
    def train_from_historical_data(self) -> Dict:
        """
        Train Deep Learning model on user's historical transaction data
        Uses PyTorch Neural Network with multiple features
        Returns training statistics
        """
        # Get user's existing payees, categories, and accounts
        self._load_existing_entities()
        
        # Get ALL historical transactions to maximize training data
        all_transactions = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.description.isnot(None),
            Transaction.account_id.isnot(None)
        ).all()
        
        # Separate training data
        payee_training_data = [
            tx for tx in all_transactions 
            if tx.payee_id is not None and tx.description and tx.account_id
        ]
        category_training_data = [
            tx for tx in all_transactions 
            if tx.category_id is not None and tx.description and tx.account_id
        ]
        
        training_stats = {
            'total_transactions': len(all_transactions),
            'payee_training_samples': len(payee_training_data),
            'category_training_samples': len(category_training_data),
            'payee_patterns_learned': 0,
            'category_patterns_learned': 0,
            'payee_model_trained': False,
            'category_model_trained': False,
            'model_type': 'DeepNeuralNetwork',
            'device': str(self.device)
        }
        
        # Train pattern-based models for fallback
        for transaction in payee_training_data:
            if transaction.category_id:
                self._extract_patterns(transaction)
        
        # Train Deep Learning models if we have enough data
        if SKLEARN_AVAILABLE:
            if len(payee_training_data) >= self.min_training_samples:
                try:
                    self._train_payee_model(payee_training_data)
                    training_stats['payee_model_trained'] = True
                except Exception as e:
                    print(f"Error training payee model: {e}")
                    import traceback
                    traceback.print_exc()
                
            if len(category_training_data) >= self.min_training_samples:
                try:
                    self._train_category_model(category_training_data)
                    training_stats['category_model_trained'] = True
                except Exception as e:
                    print(f"Error training category model: {e}")
                    import traceback
                    traceback.print_exc()
        
        # Calculate pattern statistics
        training_stats['payee_patterns_learned'] = len(self.trained_patterns['payee_patterns'])
        training_stats['category_patterns_learned'] = len(self.trained_patterns['category_patterns'])
        
        return training_stats
    
    def _train_payee_model(self, training_data: List[Transaction]):
        """Train Deep Neural Network model for payee prediction"""
        if len(training_data) < self.min_training_samples:
            return
            
        # Prepare features and labels
        X, y = self._prepare_features_and_labels(training_data, 'payee')
        
        if X is None or y is None:
            return
        
        # Get input size and number of classes
        input_size = X.shape[1]
        num_classes = len(np.unique(y))
        
        # Create model
        self.payee_model = DeepTransactionClassifier(
            input_size=input_size,
            hidden_sizes=self.hidden_sizes,
            num_classes=num_classes,
            dropout=self.dropout
        ).to(self.device)
        
        # Train model
        self._train_model(self.payee_model, X, y)
    
    def _train_category_model(self, training_data: List[Transaction]):
        """Train Deep Neural Network model for category prediction"""
        if len(training_data) < self.min_training_samples:
            return
            
        # Prepare features and labels
        X, y = self._prepare_features_and_labels(training_data, 'category')
        
        if X is None or y is None:
            return
        
        # Get input size and number of classes
        input_size = X.shape[1]
        num_classes = len(np.unique(y))
        
        # Create model
        self.category_model = DeepTransactionClassifier(
            input_size=input_size,
            hidden_sizes=self.hidden_sizes,
            num_classes=num_classes,
            dropout=self.dropout
        ).to(self.device)
        
        # Train model
        self._train_model(self.category_model, X, y)
    
    def _prepare_features_and_labels(self, training_data: List[Transaction], label_type: str):
        """Prepare comprehensive feature set and labels for training"""
        try:
            # Extract raw data
            descriptions = [self._prepare_description(tx.description) for tx in training_data]
            amounts = [float(tx.amount) for tx in training_data]
            types = [tx.type for tx in training_data]
            account_ids = [str(tx.account_id) for tx in training_data]
            
            # Get account types
            account_types = []
            for tx in training_data:
                if tx.account_id in self.existing_accounts:
                    account_types.append(self.existing_accounts[tx.account_id].type)
                else:
                    account_types.append('unknown')
            
            # Extract labels
            if label_type == 'payee':
                labels = [str(tx.payee_id) for tx in training_data]
                label_encoded = self.payee_label_encoder.fit_transform(labels)
            else:  # category
                labels = [str(tx.category_id) for tx in training_data]
                label_encoded = self.category_label_encoder.fit_transform(labels)
            
            # Feature 1: TF-IDF from descriptions (150 features)
            tfidf_features = self.tfidf_vectorizer.fit_transform(descriptions).toarray()
            
            # Feature 2: Amount features (3 features - raw, log, normalized)
            amount_raw = np.array([[amt] for amt in amounts])
            amount_log = np.array([[np.log10(max(amt, 1))] for amt in amounts])
            amount_norm = np.array([[self._normalize_amount(amt)] for amt in amounts])
            amount_features = np.hstack([amount_raw, amount_log, amount_norm])
            
            # Feature 3: Transaction type (one-hot encoded, 3 features)
            type_features = np.array([[
                1 if t == 'income' else 0,
                1 if t == 'expense' else 0,
                1 if t == 'transfer' else 0
            ] for t in types])
            
            # Feature 4: Account ID (encoded, 1 feature)
            account_encoded = self.account_label_encoder.fit_transform(account_ids)
            account_features = account_encoded.reshape(-1, 1)
            
            # Feature 5: Account type (one-hot encoded, 6 features)
            account_type_mapping = {
                'checking': [1, 0, 0, 0, 0, 0],
                'savings': [0, 1, 0, 0, 0, 0],
                'credit': [0, 0, 1, 0, 0, 0],
                'cash': [0, 0, 0, 1, 0, 0],
                'investment': [0, 0, 0, 0, 1, 0],
                'ppf': [0, 0, 0, 0, 0, 1],
                'unknown': [0, 0, 0, 0, 0, 0]
            }
            account_type_features = np.array([
                account_type_mapping.get(at, [0, 0, 0, 0, 0, 0]) 
                for at in account_types
            ])
            
            # Combine all features
            X = np.hstack([
                tfidf_features,      # 150 features
                amount_features,     # 3 features
                type_features,       # 3 features
                account_features,    # 1 feature
                account_type_features  # 6 features
            ])  # Total: 163 features
            
            return X, label_encoded
            
        except Exception as e:
            print(f"Error preparing features: {e}")
            import traceback
            traceback.print_exc()
            return None, None
    
    def _train_model(self, model, X, y):
        """Train the neural network model"""
        # Create dataset and dataloader
        dataset = TransactionDataset(X, y)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)
        
        # Loss and optimizer
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.parameters(), lr=self.learning_rate)
        
        # Training loop
        model.train()
        for epoch in range(self.num_epochs):
            total_loss = 0
            for batch_features, batch_labels in dataloader:
                batch_features = batch_features.to(self.device)
                batch_labels = batch_labels.to(self.device)
                
                # Forward pass
                outputs = model(batch_features)
                loss = criterion(outputs, batch_labels)
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            # Print progress every 10 epochs
            if (epoch + 1) % 10 == 0:
                avg_loss = total_loss / len(dataloader)
                print(f"Epoch [{epoch+1}/{self.num_epochs}], Loss: {avg_loss:.4f}")
        
        model.eval()
    
    def _prepare_description(self, description: str) -> str:
        """Prepare description text for vectorization"""
        if not description:
            return ""
        # Convert to lowercase and clean special characters
        cleaned = re.sub(r'[^\w\s]', ' ', description.lower())
        # Remove extra whitespace
        cleaned = ' '.join(cleaned.split())
        return cleaned
    
    def _normalize_amount(self, amount: float) -> float:
        """Normalize amount to 0-1 range using log scale"""
        # Use log scale to handle wide range of amounts
        return min(1.0, np.log10(max(amount, 1)) / 5)  # Assuming max ~100K
        
    def _load_existing_entities(self):
        """Load existing payees, categories, and accounts for the user"""
        # Load payees
        payees = self.db.query(Payee).filter(Payee.user_id == self.user_id).all()
        self.existing_payees = {payee.id: payee for payee in payees}
        
        # Load categories
        categories = self.db.query(Category).filter(Category.user_id == self.user_id).all()
        self.existing_categories = {category.id: category for category in categories}
        
        # Load accounts
        accounts = self.db.query(Account).filter(Account.user_id == self.user_id).all()
        self.existing_accounts = {account.id: account for account in accounts}
    
    def _extract_patterns(self, transaction: Transaction):
        """Extract patterns from a historical transaction for fallback matching"""
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
            
            # Consolidate duplicates
            existing = self.trained_patterns['payee_patterns'][pattern_key]
            found = False
            for pattern in existing:
                if pattern['payee_id'] == payee.id:
                    pattern['frequency'] += 1
                    found = True
                    break
            
            if not found:
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
            
            # Consolidate duplicates
            existing = self.trained_patterns['category_patterns'][pattern_key]
            found = False
            for pattern in existing:
                if pattern['category_id'] == category.id:
                    pattern['frequency'] += 1
                    found = True
                    break
            
            if not found:
                self.trained_patterns['category_patterns'][pattern_key].append({
                    'category_id': category.id,
                    'category_name': category.name,
                    'confidence': 1.0,
                    'frequency': 1
                })
    
    def _extract_keywords(self, description: str) -> List[str]:
        """Extract meaningful keywords from description"""
        # Expanded stop words list
        stop_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
            'by', 'a', 'an', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 
            'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
        }
        
        # Clean and split description
        cleaned = re.sub(r'[^\w\s]', ' ', description)
        words = [word.lower().strip() for word in cleaned.split() if len(word) > 2]
        keywords = [word for word in words if word not in stop_words]
        
        # Return top 8 keywords (increased from 5)
        return keywords[:8]
    
    def _get_amount_range(self, amount: float) -> str:
        """Categorize amount into ranges for pattern matching"""
        if amount < 10:
            return 'micro'
        elif amount < 50:
            return 'small'
        elif amount < 200:
            return 'medium'
        elif amount < 1000:
            return 'large'
        else:
            return 'xlarge'
    
    def _create_pattern_key(self, features: Dict) -> str:
        """Create a unique pattern key from features"""
        keywords_str = '_'.join(sorted(features['description_words']))
        return f"{keywords_str}_{features['transaction_type']}_{features['amount_range']}"
    
    def predict_payee_and_category(self, description: str, transaction_type: str, amount: float, account_id: Optional[str] = None) -> Dict:
        """
        Predict payee and category for a new transaction using Deep Learning model
        Uses DNN model if available, falls back to pattern matching
        Returns only existing payees and categories, never creates new ones
        """
        # Try ML prediction first
        if SKLEARN_AVAILABLE and self.payee_model is not None:
            payee_prediction = self._ml_predict_payee(description, transaction_type, amount, account_id)
        else:
            payee_prediction = None
        
        if SKLEARN_AVAILABLE and self.category_model is not None:
            category_prediction = self._ml_predict_category(description, transaction_type, amount, account_id)
        else:
            category_prediction = None
        
        # Fallback to pattern matching if ML didn't produce high confidence result
        if payee_prediction is None or payee_prediction.get('confidence', 0) < 0.6:
            features = {
                'description_words': self._extract_keywords(description.lower()),
                'transaction_type': transaction_type,
                'amount_range': self._get_amount_range(float(amount)),
                'description_full': description.lower()
            }
            pattern_payee = self._find_best_match('payee', features)
            if pattern_payee and (payee_prediction is None or pattern_payee['confidence'] > payee_prediction.get('confidence', 0)):
                payee_prediction = pattern_payee
        
        if category_prediction is None or category_prediction.get('confidence', 0) < 0.6:
            features = {
                'description_words': self._extract_keywords(description.lower()),
                'transaction_type': transaction_type,
                'amount_range': self._get_amount_range(float(amount)),
                'description_full': description.lower()
            }
            pattern_category = self._find_best_match('category', features)
            if pattern_category and (category_prediction is None or pattern_category['confidence'] > category_prediction.get('confidence', 0)):
                category_prediction = pattern_category
        
        return {
            'payee': payee_prediction,
            'category': category_prediction
        }
    
    def _ml_predict_payee(self, description: str, transaction_type: str, amount: float, account_id: Optional[str] = None) -> Optional[Dict]:
        """Predict payee using Deep Learning model"""
        if self.payee_model is None or self.tfidf_vectorizer is None:
            return None
        
        try:
            # Prepare features
            X = self._prepare_prediction_features(description, transaction_type, amount, account_id)
            
            if X is None:
                return None
            
            # Convert to tensor and predict
            X_tensor = torch.FloatTensor(X).to(self.device)
            
            with torch.no_grad():
                outputs = self.payee_model(X_tensor)
                probabilities = torch.softmax(outputs, dim=1).cpu().numpy()[0]
            
            # Get best prediction
            predicted_class = np.argmax(probabilities)
            confidence = probabilities[predicted_class]
            
            # Decode label to get payee ID
            payee_id = self.payee_label_encoder.inverse_transform([predicted_class])[0]
            payee_uuid = uuid.UUID(payee_id)
            
            # Get payee name
            if payee_uuid in self.existing_payees:
                payee = self.existing_payees[payee_uuid]
                return {
                    'id': payee_id,
                    'name': payee.name,
                    'confidence': float(confidence),
                    'match_type': 'deep_learning'
                }
        except Exception as e:
            print(f"Error in DNN payee prediction: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        return None
    
    def _ml_predict_category(self, description: str, transaction_type: str, amount: float, account_id: Optional[str] = None) -> Optional[Dict]:
        """Predict category using Deep Learning model"""
        if self.category_model is None or self.tfidf_vectorizer is None:
            return None
        
        try:
            # Prepare features
            X = self._prepare_prediction_features(description, transaction_type, amount, account_id)
            
            if X is None:
                return None
            
            # Convert to tensor and predict
            X_tensor = torch.FloatTensor(X).to(self.device)
            
            with torch.no_grad():
                outputs = self.category_model(X_tensor)
                probabilities = torch.softmax(outputs, dim=1).cpu().numpy()[0]
            
            # Get best prediction
            predicted_class = np.argmax(probabilities)
            confidence = probabilities[predicted_class]
            
            # Decode label to get category ID
            category_id = self.category_label_encoder.inverse_transform([predicted_class])[0]
            category_uuid = uuid.UUID(category_id)
            
            # Get category name
            if category_uuid in self.existing_categories:
                category = self.existing_categories[category_uuid]
                return {
                    'id': category_id,
                    'name': category.name,
                    'confidence': float(confidence),
                    'match_type': 'deep_learning'
                }
        except Exception as e:
            print(f"Error in DNN category prediction: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        return None
    
    def _prepare_prediction_features(self, description: str, transaction_type: str, amount: float, account_id: Optional[str] = None):
        """Prepare feature vector for a single prediction"""
        try:
            # Feature 1: TF-IDF from description
            desc_clean = self._prepare_description(description)
            tfidf_features = self.tfidf_vectorizer.transform([desc_clean]).toarray()
            
            # Feature 2: Amount features (3 features)
            amount_raw = np.array([[amount]])
            amount_log = np.array([[np.log10(max(amount, 1))]])
            amount_norm = np.array([[self._normalize_amount(amount)]])
            amount_features = np.hstack([amount_raw, amount_log, amount_norm])
            
            # Feature 3: Transaction type (one-hot)
            type_features = np.array([[
                1 if transaction_type == 'income' else 0,
                1 if transaction_type == 'expense' else 0,
                1 if transaction_type == 'transfer' else 0
            ]])
            
            # Feature 4: Account ID (encoded)
            if account_id and self.account_label_encoder is not None:
                try:
                    # Try to transform the account_id
                    account_encoded = self.account_label_encoder.transform([str(account_id)])
                    account_features = account_encoded.reshape(-1, 1)
                except:
                    # If account_id not seen during training, use -1
                    account_features = np.array([[-1]])
            else:
                account_features = np.array([[-1]])
            
            # Feature 5: Account type (one-hot)
            account_type = 'unknown'
            if account_id:
                try:
                    account_uuid = uuid.UUID(str(account_id))
                    if account_uuid in self.existing_accounts:
                        account_type = self.existing_accounts[account_uuid].type
                except:
                    pass
            
            account_type_mapping = {
                'checking': [1, 0, 0, 0, 0, 0],
                'savings': [0, 1, 0, 0, 0, 0],
                'credit': [0, 0, 1, 0, 0, 0],
                'cash': [0, 0, 0, 1, 0, 0],
                'investment': [0, 0, 0, 0, 1, 0],
                'ppf': [0, 0, 0, 0, 0, 1],
                'unknown': [0, 0, 0, 0, 0, 0]
            }
            account_type_features = np.array([account_type_mapping.get(account_type, [0, 0, 0, 0, 0, 0])])
            
            # Combine all features
            X = np.hstack([
                tfidf_features,
                amount_features,
                type_features,
                account_features,
                account_type_features
            ])
            
            return X
            
        except Exception as e:
            print(f"Error preparing prediction features: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _find_best_match(self, field_type: str, features: Dict) -> Optional[Dict]:
        """Find best matching payee or category based on pattern features (fallback method)"""
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
                    'id': str(best_candidate[f'{field_type}_id']),
                    'name': best_candidate[f'{field_type}_name'],
                    'confidence': min(0.95, 0.7 + (best_candidate.get('frequency', 1) * 0.05)),
                    'match_type': 'exact_pattern'
                }
        
        # Try partial matches
        description_words = features['description_words']
        transaction_type = features['transaction_type']
        
        for pattern_key, candidates in self.trained_patterns[patterns_key].items():
            score = self._calculate_similarity_score(
                pattern_key, description_words, transaction_type, features['amount_range']
            )
            
            if score > best_score and score >= 0.5:  # Lowered threshold from 0.6
                best_score = score
                best_candidate = max(candidates, key=lambda x: x.get('frequency', 1))
                best_match = {
                    'id': str(best_candidate[f'{field_type}_id']),
                    'name': best_candidate[f'{field_type}_name'],
                    'confidence': score,
                    'match_type': 'partial_pattern'
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
        
        # Transaction type match (weight: 0.25)
        if pattern_type == transaction_type:
            score += 0.25
        
        # Amount range match (weight: 0.15)
        if pattern_amount_range == amount_range:
            score += 0.15
        # Partial credit for adjacent ranges
        elif self._are_adjacent_ranges(pattern_amount_range, amount_range):
            score += 0.075
        
        # Keyword overlap (weight: 0.6)
        if description_words and pattern_keywords:
            keyword_matches = len(set(description_words) & set(pattern_keywords))
            total_keywords = len(set(description_words) | set(pattern_keywords))
            if total_keywords > 0:
                keyword_score = keyword_matches / total_keywords
                score += 0.6 * keyword_score
        
        return min(score, 1.0)
    
    def _are_adjacent_ranges(self, range1: str, range2: str) -> bool:
        """Check if two amount ranges are adjacent"""
        ranges = ['micro', 'small', 'medium', 'large', 'xlarge']
        try:
            idx1 = ranges.index(range1)
            idx2 = ranges.index(range2)
            return abs(idx1 - idx2) == 1
        except ValueError:
            return False
    
    def get_training_summary(self) -> Dict:
        """Get summary of trained patterns and models"""
        summary = {
            'payee_patterns_count': len(self.trained_patterns['payee_patterns']),
            'category_patterns_count': len(self.trained_patterns['category_patterns']),
            'existing_payees_count': len(self.existing_payees),
            'existing_categories_count': len(self.existing_categories),
            'ml_models_available': SKLEARN_AVAILABLE
        }
        
        if SKLEARN_AVAILABLE:
            summary['payee_ml_model_trained'] = self.payee_model is not None
            summary['category_ml_model_trained'] = self.category_model is not None
            
            if self.payee_model is not None:
                summary['payee_model_classes'] = len(self.payee_label_encoder.classes_)
            if self.category_model is not None:
                summary['category_model_classes'] = len(self.category_label_encoder.classes_)
        
        return summary
