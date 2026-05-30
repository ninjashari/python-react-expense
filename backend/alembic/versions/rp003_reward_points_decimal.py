"""Change reward_points columns from Integer to Float

Revision ID: rp003
Revises: rp002
Create Date: 2026-05-30 00:00:00.000003

"""
from alembic import op
import sqlalchemy as sa

revision = 'rp003'
down_revision = 'rp002'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'transactions', 'reward_points',
        type_=sa.Float(),
        nullable=True,
        postgresql_using='reward_points::FLOAT'
    )
    op.alter_column(
        'reward_point_redemptions', 'points_used',
        type_=sa.Float(),
        existing_nullable=False,
        postgresql_using='points_used::FLOAT'
    )


def downgrade():
    op.alter_column(
        'reward_point_redemptions', 'points_used',
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using='points_used::INTEGER'
    )
    op.alter_column(
        'transactions', 'reward_points',
        type_=sa.Integer(),
        nullable=True,
        postgresql_using='reward_points::INTEGER'
    )
