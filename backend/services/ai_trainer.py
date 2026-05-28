"""
AI Trainer — Rules + Gradient Boosting hybrid.

Prediction pipeline:
  1. Rule match  (exact normalised description → majority-vote payee)
  2. sklearn GradientBoosting fallback for payee
  3. Payee→Category chain (most common category for the predicted payee)
  4. sklearn GradientBoosting fallback for category
"""

import re
import math
import uuid
from collections import defaultdict, Counter
from typing import Dict, List, Optional
import numpy as np

from sqlalchemy.orm import Session
from models.transactions import Transaction
from models.accounts import Account
from models.payees import Payee
from models.categories import Category

try:
    import pandas as pd
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import (
        OrdinalEncoder, StandardScaler, OneHotEncoder,
        LabelEncoder, FunctionTransformer
    )
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingClassifier
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

RULE_MIN_CONFIDENCE  = 0.60   # majority fraction to trust a rule
CHAIN_MIN_CONFIDENCE = 0.50   # majority fraction to trust a payee→category link
ML_MIN_CONFIDENCE    = 0.45   # softmax probability to accept an ML prediction
MIN_SAMPLES          = 10     # min labelled samples to train an ML model


# ─────────────────────────────────────────────────────────────────────────────
# Trainer
# ─────────────────────────────────────────────────────────────────────────────

class TransactionAITrainer:
    """
    Public API (unchanged from previous version):
        train_from_historical_data() -> dict
        predict_payee_and_category(description, transaction_type, amount,
                                   account_id=None) -> dict
        get_training_summary() -> dict
    """

    def __init__(self, db: Session, user_id):
        self.db = db
        self.user_id = user_id

        # Rule dict: norm_description -> {payee_id, payee_name, confidence, count}
        self.rule_dict: Dict[str, dict] = {}
        # Payee->Category: str(payee_id) -> {category_id, category_name, confidence}
        self.payee_to_category: Dict[str, dict] = {}
        # sklearn pipelines
        self.payee_pipeline    = None
        self.category_pipeline = None
        self.payee_label_enc     = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.category_label_enc  = LabelEncoder() if SKLEARN_AVAILABLE else None
        # Entity caches (loaded during training)
        self.existing_payees:     Dict = {}
        self.existing_categories: Dict = {}
        self.existing_accounts:   Dict = {}

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def train_from_historical_data(self) -> Dict:
        """Train rules + sklearn models from all labelled historical transactions."""
        self._load_existing_entities()

        all_txns = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.description.isnot(None),
        ).all()

        payee_txns = [t for t in all_txns if t.payee_id is not None]
        cat_txns   = [t for t in all_txns if t.category_id is not None]

        # Phase 1 & 2 — rules and chain
        self._build_rule_dict(payee_txns)
        self._build_payee_to_category_chain(payee_txns)

        payee_trained = False
        cat_trained   = False

        if SKLEARN_AVAILABLE:
            if len(payee_txns) >= MIN_SAMPLES:
                payee_trained = self._train_pipeline(
                    payee_txns,
                    label_fn=lambda t: str(t.payee_id),
                    pipeline_attr='payee_pipeline',
                    enc_attr='payee_label_enc',
                    label='payee',
                )
            if len(cat_txns) >= MIN_SAMPLES:
                cat_trained = self._train_pipeline(
                    cat_txns,
                    label_fn=lambda t: str(t.category_id),
                    pipeline_attr='category_pipeline',
                    enc_attr='category_label_enc',
                    label='category',
                )

        stats = {
            'total_transactions':      len(all_txns),
            'payee_training_samples':  len(payee_txns),
            'category_training_samples': len(cat_txns),
            'rules_built':             len(self.rule_dict),
            'payee_chain_entries':     len(self.payee_to_category),
            'payee_model_trained':     payee_trained,
            'category_model_trained':  cat_trained,
            'model_type':              'Rules+GradientBoosting',
        }
        print(f"[AI] Training complete: {stats}")
        return stats

    def predict_payee_and_category(
        self,
        description:      str,
        transaction_type: str,
        amount:           float,
        account_id:       Optional[str] = None,
    ) -> Dict:
        """
        Returns:
          {
            'payee':    {id, name, confidence, match_type} | None,
            'category': {id, name, confidence, match_type} | None,
          }
        match_type is one of: 'rule', 'ml', 'chain', None
        """
        payee_result    = None
        category_result = None

        norm     = _normalize(description)
        features = self._build_feature_row(description, amount, transaction_type, account_id)

        # ── 1. Rule match ────────────────────────────────────────────────────
        if norm in self.rule_dict:
            rule = self.rule_dict[norm]
            if rule['confidence'] >= RULE_MIN_CONFIDENCE:
                payee_result = {
                    'id':         rule['payee_id'],
                    'name':       rule['payee_name'],
                    'confidence': rule['confidence'],
                    'match_type': 'rule',
                }

        # ── 2. ML fallback for payee ─────────────────────────────────────────
        if payee_result is None and self.payee_pipeline is not None:
            payee_result = self._ml_predict(
                self.payee_pipeline, self.payee_label_enc,
                features, self.existing_payees
            )

        # ── 3. Payee → Category chain ─────────────────────────────────────────
        if payee_result is not None:
            pid = payee_result['id']
            if pid in self.payee_to_category:
                chain = self.payee_to_category[pid]
                if chain['confidence'] >= CHAIN_MIN_CONFIDENCE:
                    category_result = {
                        'id':         chain['category_id'],
                        'name':       chain['category_name'],
                        'confidence': chain['confidence'],
                        'match_type': 'chain',
                    }

        # ── 4. ML fallback for category ───────────────────────────────────────
        if category_result is None and self.category_pipeline is not None:
            category_result = self._ml_predict(
                self.category_pipeline, self.category_label_enc,
                features, self.existing_categories
            )

        return {'payee': payee_result, 'category': category_result}

    def get_training_summary(self) -> Dict:
        return {
            'rules_built':             len(self.rule_dict),
            'payee_chain_entries':     len(self.payee_to_category),
            'payee_model_trained':     self.payee_pipeline is not None,
            'category_model_trained':  self.category_pipeline is not None,
            'existing_payees_count':   len(self.existing_payees),
            'existing_categories_count': len(self.existing_categories),
            'model_type':              'Rules+GradientBoosting',
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Training internals
    # ─────────────────────────────────────────────────────────────────────────

    def _build_rule_dict(self, payee_txns: List[Transaction]):
        groups:      Dict[str, Counter] = defaultdict(Counter)
        payee_names: Dict[str, str]     = {}

        for t in payee_txns:
            norm = _normalize(t.description)
            groups[norm][str(t.payee_id)] += 1
            if t.payee_id in self.existing_payees:
                payee_names[str(t.payee_id)] = self.existing_payees[t.payee_id].name

        for norm, counts in groups.items():
            total = sum(counts.values())
            best_pid, best_count = counts.most_common(1)[0]
            confidence = best_count / total
            if confidence >= RULE_MIN_CONFIDENCE:
                self.rule_dict[norm] = {
                    'payee_id':   best_pid,
                    'payee_name': payee_names.get(best_pid, ''),
                    'confidence': confidence,
                    'count':      best_count,
                }

    def _build_payee_to_category_chain(self, payee_txns: List[Transaction]):
        groups:    Dict[str, Counter] = defaultdict(Counter)
        cat_names: Dict[str, str]     = {}

        for t in payee_txns:
            if t.category_id is None:
                continue
            groups[str(t.payee_id)][str(t.category_id)] += 1
            if t.category_id in self.existing_categories:
                cat_names[str(t.category_id)] = self.existing_categories[t.category_id].name

        for pid, counts in groups.items():
            total = sum(counts.values())
            best_cid, best_count = counts.most_common(1)[0]
            confidence = best_count / total
            if confidence >= CHAIN_MIN_CONFIDENCE:
                self.payee_to_category[pid] = {
                    'category_id':   best_cid,
                    'category_name': cat_names.get(best_cid, ''),
                    'confidence':    confidence,
                }

    def _train_pipeline(
        self, txns, label_fn, pipeline_attr, enc_attr, label: str
    ) -> bool:
        try:
            rows   = [self._build_feature_row(
                          t.description, float(t.amount), t.type, str(t.account_id),
                          getattr(t, 'date', None))
                      for t in txns]
            labels = [label_fn(t) for t in txns]

            if len(set(labels)) < 2:
                return False

            enc = getattr(self, enc_attr)
            y   = enc.fit_transform(labels)

            pipeline = _build_sklearn_pipeline()
            pipeline.fit(rows, y)
            setattr(self, pipeline_attr, pipeline)
            return True
        except Exception as e:
            print(f"[AI] {label} model training failed: {e}")
            return False

    # ─────────────────────────────────────────────────────────────────────────
    # Feature engineering
    # ─────────────────────────────────────────────────────────────────────────

    def _build_feature_row(
        self,
        description:      str,
        amount:           float,
        transaction_type: str,
        account_id:       Optional[str] = None,
        date=None,
    ) -> Dict:
        amount = float(amount) if amount else 0.0

        account = None
        if account_id:
            try:
                acc_uuid = uuid.UUID(str(account_id))
                account = self.existing_accounts.get(acc_uuid)
            except Exception:
                pass

        # Date features — use transaction date when available
        import datetime as _dt
        if date is None:
            date = _dt.date.today()
        dow = date.weekday()   # 0 Mon … 6 Sun
        moy = date.month       # 1–12

        return {
            'description':     _normalize(description),
            'amount':          amount,
            'amount_log':      math.log10(amount + 1),
            'amount_bucket':   _amount_bucket(amount),
            'transaction_type': transaction_type or 'expense',
            'account_type':    account.type if account else 'unknown',
            'account_name':    account.name if account else 'unknown',
            'day_sin':         math.sin(2 * math.pi * dow / 7),
            'day_cos':         math.cos(2 * math.pi * dow / 7),
            'month_sin':       math.sin(2 * math.pi * moy / 12),
            'month_cos':       math.cos(2 * math.pi * moy / 12),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Prediction internals
    # ─────────────────────────────────────────────────────────────────────────

    def _ml_predict(self, pipeline, label_enc, features: Dict, entity_map: Dict) -> Optional[Dict]:
        try:
            probas      = pipeline.predict_proba([features])[0]
            best_idx    = int(np.argmax(probas))
            confidence  = float(probas[best_idx])
            if confidence < ML_MIN_CONFIDENCE:
                return None
            entity_id_str = label_enc.inverse_transform([best_idx])[0]
            entity_uuid   = uuid.UUID(entity_id_str)
            entity        = entity_map.get(entity_uuid)
            if entity is None:
                return None
            return {
                'id':         entity_id_str,
                'name':       entity.name,
                'confidence': confidence,
                'match_type': 'ml',
            }
        except Exception as e:
            print(f"[AI] ML prediction failed: {e}")
            return None

    # ─────────────────────────────────────────────────────────────────────────
    # Entity loading
    # ─────────────────────────────────────────────────────────────────────────

    def _load_existing_entities(self):
        payees      = self.db.query(Payee).filter(Payee.user_id == self.user_id).all()
        categories  = self.db.query(Category).filter(Category.user_id == self.user_id).all()
        accounts    = self.db.query(Account).filter(Account.user_id == self.user_id).all()
        self.existing_payees     = {p.id: p for p in payees}
        self.existing_categories = {c.id: c for c in categories}
        self.existing_accounts   = {a.id: a for a in accounts}


# ─────────────────────────────────────────────────────────────────────────────
# Module-level helpers
# ─────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    if not text:
        return ''
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    return ' '.join(text.split())


def _amount_bucket(amount: float) -> str:
    if amount < 500:
        return '0-500'
    elif amount < 2_000:
        return '500-2000'
    elif amount < 10_000:
        return '2000-10000'
    else:
        return '10000+'


def _build_sklearn_pipeline():
    """Return a fresh sklearn Pipeline for either payee or category prediction."""
    import pandas as pd
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import (
        OrdinalEncoder, StandardScaler, OneHotEncoder, FunctionTransformer
    )
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingClassifier

    def _to_df(rows):
        return pd.DataFrame(rows)

    ct = ColumnTransformer(
        transformers=[
            ('desc',     TfidfVectorizer(ngram_range=(1, 3), max_features=300,
                                         sublinear_tf=True),
                         'description'),
            ('num',      StandardScaler(),
                         ['amount', 'amount_log']),
            ('bucket',   OneHotEncoder(handle_unknown='ignore', sparse_output=False),
                         ['amount_bucket']),
            ('txn_type', OneHotEncoder(handle_unknown='ignore', sparse_output=False),
                         ['transaction_type']),
            ('acc_type', OneHotEncoder(handle_unknown='ignore', sparse_output=False),
                         ['account_type']),
            ('acc_name', OrdinalEncoder(handle_unknown='use_encoded_value',
                                        unknown_value=-1),
                         ['account_name']),
            ('dates',    'passthrough',
                         ['day_sin', 'day_cos', 'month_sin', 'month_cos']),
        ],
        remainder='drop',
    )

    return Pipeline([
        ('to_df',    FunctionTransformer(_to_df)),
        ('features', ct),
        ('clf',      GradientBoostingClassifier(
                         n_estimators=100, max_depth=4,
                         learning_rate=0.1, random_state=42,
                     )),
    ])
