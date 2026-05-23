"""Merge dual heads before reward points migrations

Revision ID: merge001
Revises: cd20f777daba, f1a2b3c4d5e6
Create Date: 2026-05-23 00:00:00.000000

"""
from alembic import op

revision = 'merge001'
down_revision = ('cd20f777daba', 'f1a2b3c4d5e6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
