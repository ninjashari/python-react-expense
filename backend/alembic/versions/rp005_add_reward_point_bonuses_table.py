"""Add reward_point_bonuses table for bonus/milestone points

Revision ID: rp005
Revises: rp004
Create Date: 2026-06-13 00:00:00.000005

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'rp005'
down_revision = 'rp004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reward_point_bonuses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('points', sa.Float(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source_file', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
    )
    op.create_index('ix_rpb_user_id', 'reward_point_bonuses', ['user_id'])
    op.create_index('ix_rpb_account_id', 'reward_point_bonuses', ['account_id'])


def downgrade():
    op.drop_index('ix_rpb_account_id', 'reward_point_bonuses')
    op.drop_index('ix_rpb_user_id', 'reward_point_bonuses')
    op.drop_table('reward_point_bonuses')
