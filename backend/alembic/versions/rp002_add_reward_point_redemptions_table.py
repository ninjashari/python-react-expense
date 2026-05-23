"""Add reward_point_redemptions table

Revision ID: rp002
Revises: rp001
Create Date: 2026-05-23 00:00:00.000002

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = 'rp002'
down_revision = 'rp001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'reward_point_redemptions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('points_used', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_rpr_id', 'reward_point_redemptions', ['id'], unique=False)
    op.create_index('ix_rpr_user_id', 'reward_point_redemptions', ['user_id'], unique=False)
    op.create_index('ix_rpr_account_id', 'reward_point_redemptions', ['account_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_rpr_account_id', table_name='reward_point_redemptions')
    op.drop_index('ix_rpr_user_id', table_name='reward_point_redemptions')
    op.drop_index('ix_rpr_id', table_name='reward_point_redemptions')
    op.drop_table('reward_point_redemptions')
