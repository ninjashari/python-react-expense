"""Add is_investment flag to categories

Revision ID: rp006
Revises: rp005
Create Date: 2026-07-01 00:00:00.000006

"""
from alembic import op
import sqlalchemy as sa

revision = 'rp006'
down_revision = 'rp005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'categories',
        sa.Column('is_investment', sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column('categories', 'is_investment')
