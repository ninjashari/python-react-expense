"""Add reward_points column to transactions table

Revision ID: rp001
Revises: merge001
Create Date: 2026-05-23 00:00:00.000001

"""
from alembic import op
import sqlalchemy as sa

revision = 'rp001'
down_revision = 'merge001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('transactions',
        sa.Column('reward_points', sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('transactions', 'reward_points')
