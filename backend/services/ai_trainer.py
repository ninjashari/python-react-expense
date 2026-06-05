"""
AI Trainer — Rules + XGBoost (GPU-accelerated) hybrid.

Prediction pipeline:
  1. Rule match  (exact normalised description → majority-vote payee)
  2. XGBoost GPU fallback for payee
  3. Payee→Category chain (most common category for the predicted payee)
  4. XGBoost GPU fallback for category
"""

import re
import math
import time
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
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("[AI] xgboost not installed — install with: pip install xgboost")


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

RULE_MIN_CONFIDENCE  = 0.60
CHAIN_MIN_CONFIDENCE = 0.50
ML_MIN_CONFIDENCE    = 0.45
MIN_SAMPLES          = 10

# ─────────────────────────────────────────────────────────────────────────────
# GPU detection (cached after first probe)
# ─────────────────────────────────────────────────────────────────────────────

_xgb_device: Optional[str] = None


def _detect_xgb_device() -> str:
    """Return 'cuda' if an XGBoost-compatible GPU is available, else 'cpu'."""
    global _xgb_device
    if _xgb_device is not None:
        return _xgb_device
    if not XGBOOST_AVAILABLE:
        _xgb_device = 'cpu'
        return _xgb_device
    try:
        clf = xgb.XGBClassifier(
            n_estimators=1, device='cuda', tree_method='hist', verbosity=0
        )
        clf.fit(np.array([[1.0, 2.0], [3.0, 4.0]]), np.array([0, 1]))
        _xgb_device = 'cuda'
        print("[AI] GPU probe OK — XGBoost will use CUDA acceleration")
    except Exception as exc:
        _xgb_device = 'cpu'
        print(f"[AI] GPU probe failed ({exc.__class__.__name__}: {exc}) — falling back to CPU")
    return _xgb_device


# ─────────────────────────────────────────────────────────────────────────────
# Trainer
# ─────────────────────────────────────────────────────────────────────────────

class TransactionAITrainer:
    """
    Public API:
        train_from_historical_data() -> dict
        predict_payee_and_category(description, transaction_type, amount,
                                   account_id=None) -> dict
        get_training_summary() -> dict
    """

    def __init__(self, db: Session, user_id):
        self.db = db
        self.user_id = user_id

        self.rule_dict: Dict[str, dict] = {}
        self.payee_to_category: Dict[str, dict] = {}
        self.payee_pipeline    = None
        self.category_pipeline = None
        self.payee_label_enc     = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.category_label_enc  = LabelEncoder() if SKLEARN_AVAILABLE else None
        self.existing_payees:     Dict = {}
        self.existing_categories: Dict = {}
        self.existing_accounts:   Dict = {}

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def train_from_historical_data(self) -> Dict:
        """Train rules + XGBoost models from all labelled historical transactions."""
        wall_start = time.perf_counter()
        print(f"[AI] ── Training start for user {self.user_id} ──────────────────")

        # ── Entity loading ───────────────────────────────────────────────────
        t = time.perf_counter()
        self._load_existing_entities()
        print(f"[AI]   Entities loaded: {len(self.existing_payees)} payees, "
              f"{len(self.existing_categories)} categories, "
              f"{len(self.existing_accounts)} accounts  [{time.perf_counter()-t:.2f}s]")

        # ── Transaction loading ──────────────────────────────────────────────
        t = time.perf_counter()
        all_txns = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.description.isnot(None),
        ).all()
        payee_txns = [tx for tx in all_txns if tx.payee_id is not None]
        cat_txns   = [tx for tx in all_txns if tx.category_id is not None]
        print(f"[AI]   Transactions: {len(all_txns)} total | "
              f"{len(payee_txns)} with payee | "
              f"{len(cat_txns)} with category  [{time.perf_counter()-t:.2f}s]")

        # ── Phase 1: Rule dictionary ─────────────────────────────────────────
        t = time.perf_counter()
        self._build_rule_dict(payee_txns)
        print(f"[AI]   Rules built: {len(self.rule_dict)} description rules  [{time.perf_counter()-t:.2f}s]")

        # ── Phase 2: Payee→Category chain ────────────────────────────────────
        t = time.perf_counter()
        self._build_payee_to_category_chain(payee_txns)
        print(f"[AI]   Payee→Category chain: {len(self.payee_to_category)} links  [{time.perf_counter()-t:.2f}s]")

        payee_trained = False
        cat_trained   = False

        if SKLEARN_AVAILABLE and XGBOOST_AVAILABLE:
            device = _detect_xgb_device()
            print(f"[AI]   XGBoost device: {device.upper()}")

            # ── Phase 3: Payee ML model ──────────────────────────────────────
            if len(payee_txns) >= MIN_SAMPLES:
                t = time.perf_counter()
                print(f"[AI]   Payee model: building features for {len(payee_txns)} samples...")
                payee_trained = self._train_pipeline(
                    payee_txns,
                    label_fn=lambda tx: str(tx.payee_id),
                    pipeline_attr='payee_pipeline',
                    enc_attr='payee_label_enc',
                    label='payee',
                    device=device,
                )
                print(f"[AI]   Payee model: {'trained' if payee_trained else 'skipped (single class)'}  [{time.perf_counter()-t:.2f}s]")
            else:
                print(f"[AI]   Payee model: skipped (only {len(payee_txns)} labelled samples, need {MIN_SAMPLES})")

            # ── Phase 4: Category ML model ───────────────────────────────────
            if len(cat_txns) >= MIN_SAMPLES:
                t = time.perf_counter()
                print(f"[AI]   Category model: building features for {len(cat_txns)} samples...")
                cat_trained = self._train_pipeline(
                    cat_txns,
                    label_fn=lambda tx: str(tx.category_id),
                    pipeline_attr='category_pipeline',
                    enc_attr='category_label_enc',
                    label='category',
                    device=device,
                )
                print(f"[AI]   Category model: {'trained' if cat_trained else 'skipped (single class)'}  [{time.perf_counter()-t:.2f}s]")
            else:
                print(f"[AI]   Category model: skipped (only {len(cat_txns)} labelled samples, need {MIN_SAMPLES})")
        elif not XGBOOST_AVAILABLE:
            print("[AI]   ML models skipped — xgboost not installed")
        else:
            print("[AI]   ML models skipped — sklearn not installed")

        total = time.perf_counter() - wall_start
        stats = {
            'total_transactions':        len(all_txns),
            'payee_training_samples':    len(payee_txns),
            'category_training_samples': len(cat_txns),
            'rules_built':               len(self.rule_dict),
            'payee_chain_entries':       len(self.payee_to_category),
            'payee_model_trained':       payee_trained,
            'category_model_trained':    cat_trained,
            'model_type':                'Rules+XGBoost',
            'device':                    _xgb_device or 'n/a',
        }
        print(f"[AI] ── Training complete in {total:.2f}s  {stats} ──")
        return stats

    def predict_payee_and_category(
        self,
        description:      str,
        transaction_type: str,
        amount:           float,
        account_id:       Optional[str] = None,
    ) -> Dict:
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

        # ── 3. Payee→Category chain (top-3) ──────────────────────────────────
        chain_results = []
        if payee_result is not None:
            pid = payee_result['id']
            if pid in self.payee_to_category:
                for chain in self.payee_to_category[pid]:
                    chain_results.append({
                        'id':         chain['category_id'],
                        'name':       chain['category_name'],
                        'confidence': chain['confidence'],
                        'match_type': 'chain',
                    })
                if chain_results:
                    category_result = chain_results[0]

        # ── 4. ML fallback for category ───────────────────────────────────────
        if category_result is None and self.category_pipeline is not None:
            category_result = self._ml_predict(
                self.category_pipeline, self.category_label_enc,
                features, self.existing_categories
            )

        return {
            'payee': payee_result,
            'category': category_result,
            'category_chain': chain_results,  # all top-3 chain options
        }

    def get_training_summary(self) -> Dict:
        return {
            'rules_built':               len(self.rule_dict),
            'payee_chain_entries':       len(self.payee_to_category),
            'payee_model_trained':       self.payee_pipeline is not None,
            'category_model_trained':    self.category_pipeline is not None,
            'existing_payees_count':     len(self.existing_payees),
            'existing_categories_count': len(self.existing_categories),
            'model_type':                'Rules+XGBoost',
            'device':                    _xgb_device or 'n/a',
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Training internals
    # ─────────────────────────────────────────────────────────────────────────

    def _build_rule_dict(self, payee_txns: List[Transaction]):
        groups:      Dict[str, Counter] = defaultdict(Counter)
        payee_names: Dict[str, str]     = {}

        for tx in payee_txns:
            norm = _normalize(tx.description)
            groups[norm][str(tx.payee_id)] += 1
            if tx.payee_id in self.existing_payees:
                payee_names[str(tx.payee_id)] = self.existing_payees[tx.payee_id].name

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
        """Build payee→category mapping storing top-3 categories per payee."""
        groups:    Dict[str, Counter] = defaultdict(Counter)
        cat_names: Dict[str, str]     = {}

        for tx in payee_txns:
            if tx.category_id is None:
                continue
            groups[str(tx.payee_id)][str(tx.category_id)] += 1
            if tx.category_id in self.existing_categories:
                cat_names[str(tx.category_id)] = self.existing_categories[tx.category_id].name

        for pid, counts in groups.items():
            total = sum(counts.values())
            top3 = [
                {
                    'category_id':   cid,
                    'category_name': cat_names.get(cid, ''),
                    'confidence':    count / total,
                }
                for cid, count in counts.most_common(3)
                if count / total >= CHAIN_MIN_CONFIDENCE
            ]
            if top3:
                self.payee_to_category[pid] = top3

    def _train_pipeline(
        self, txns, label_fn, pipeline_attr, enc_attr, label: str, device: str = 'cpu'
    ) -> bool:
        try:
            t = time.perf_counter()
            rows   = [self._build_feature_row(
                          tx.description, float(tx.amount), tx.type, str(tx.account_id),
                          getattr(tx, 'date', None))
                      for tx in txns]
            labels = [label_fn(tx) for tx in txns]
            print(f"[AI]     Feature rows built: {len(rows)}  [{time.perf_counter()-t:.2f}s]")

            unique_labels = set(labels)
            if len(unique_labels) < 2:
                print(f"[AI]     Skipping {label} model — only 1 unique class")
                return False
            print(f"[AI]     Unique {label} classes: {len(unique_labels)}")

            enc = getattr(self, enc_attr)
            y   = enc.fit_transform(labels)

            t = time.perf_counter()
            pipeline = _build_xgb_pipeline(device=device)
            pipeline.fit(rows, y)
            print(f"[AI]     XGBoost fit ({device}): {len(rows)} samples × {len(unique_labels)} classes  [{time.perf_counter()-t:.2f}s]")

            setattr(self, pipeline_attr, pipeline)
            return True
        except Exception as e:
            print(f"[AI]     {label} model training failed: {e}")
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

        import datetime as _dt
        if date is None:
            date = _dt.date.today()
        dow = date.weekday()
        moy = date.month

        return {
            'description':      _normalize(description),
            'amount':           amount,
            'amount_log':       math.log10(amount + 1),
            'amount_bucket':    _amount_bucket(amount),
            'transaction_type': transaction_type or 'expense',
            'account_type':     account.type if account else 'unknown',
            'account_name':     account.name if account else 'unknown',
            'day_sin':          math.sin(2 * math.pi * dow / 7),
            'day_cos':          math.cos(2 * math.pi * dow / 7),
            'month_sin':        math.sin(2 * math.pi * moy / 12),
            'month_cos':        math.cos(2 * math.pi * moy / 12),
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
        payees     = self.db.query(Payee).filter(Payee.user_id == self.user_id).all()
        categories = self.db.query(Category).filter(Category.user_id == self.user_id).all()
        accounts   = self.db.query(Account).filter(Account.user_id == self.user_id).all()
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


def _build_xgb_pipeline(device: str = 'cpu'):
    """Return a fresh sklearn Pipeline using XGBoost as the classifier."""
    import pandas as pd
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import (
        OrdinalEncoder, StandardScaler, OneHotEncoder, FunctionTransformer
    )
    from sklearn.compose import ColumnTransformer

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

    clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        device=device,
        tree_method='hist',      # required for GPU; also faster on CPU
        random_state=42,
        eval_metric='mlogloss',
        verbosity=0,
    )

    return Pipeline([
        ('to_df',    FunctionTransformer(_to_df)),
        ('features', ct),
        ('clf',      clf),
    ])
