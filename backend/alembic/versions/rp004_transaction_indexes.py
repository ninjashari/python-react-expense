"""Add indexes to transactions table for common filter/sort columns

Revision ID: rp004
Revises: rp003
Create Date: 2026-05-30 00:00:01.000004

"""
from alembic import op

revision = 'rp004'
down_revision = 'rp003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_transactions_user_id',    'transactions', ['user_id'])
    op.create_index('ix_transactions_date',        'transactions', ['date'])
    op.create_index('ix_transactions_account_id',  'transactions', ['account_id'])
    op.create_index('ix_transactions_category_id', 'transactions', ['category_id'])
    op.create_index('ix_transactions_payee_id',    'transactions', ['payee_id'])
    # Composite index — most queries filter by user_id first then sort by date
    op.create_index('ix_transactions_user_date',   'transactions', ['user_id', 'date'])


def downgrade():
    op.drop_index('ix_transactions_user_date',   'transactions')
    op.drop_index('ix_transactions_payee_id',    'transactions')
    op.drop_index('ix_transactions_category_id', 'transactions')
    op.drop_index('ix_transactions_account_id',  'transactions')
    op.drop_index('ix_transactions_date',        'transactions')
    op.drop_index('ix_transactions_user_id',     'transactions')
