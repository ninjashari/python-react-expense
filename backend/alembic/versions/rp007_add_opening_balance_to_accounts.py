"""Add opening_balance to accounts

Revision ID: rp007
Revises: rp006
Create Date: 2026-09-06 00:00:00.000007

"""
from alembic import op
import sqlalchemy as sa

revision = 'rp007'
down_revision = 'rp006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'accounts',
        sa.Column('opening_balance', sa.Numeric(12, 2), nullable=False, server_default='0.00')
    )


def downgrade():
    op.drop_column('accounts', 'opening_balance')
