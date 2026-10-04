"""Convert transactions.date from Date to DateTime

Revision ID: rp008
Revises: rp007
Create Date: 2026-10-03 00:00:00.000008

"""
from alembic import op
import sqlalchemy as sa

revision = 'rp008'
down_revision = 'rp007'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'transactions',
        'date',
        type_=sa.DateTime(),
        existing_type=sa.Date(),
        postgresql_using='date::timestamp',
    )


def downgrade():
    op.alter_column(
        'transactions',
        'date',
        type_=sa.Date(),
        existing_type=sa.DateTime(),
        postgresql_using='date::date',
    )
