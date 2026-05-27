"""Add PPF to account type constraint

Revision ID: b31578fb75e3
Revises: 846486f8bdb8
Create Date: 2025-09-03 07:41:05.824736

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b31578fb75e3'
down_revision = '846486f8bdb8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing CHECK constraint
    op.drop_constraint('accounts_type_check', 'accounts', type_='check')
    
    # Add the new CHECK constraint with PPF included
    op.create_check_constraint(
        'accounts_type_check',
        'accounts',
        "type IN ('checking', 'savings', 'credit', 'cash', 'investment', 'ppf')"
    )


def downgrade() -> None:
    # Drop the new CHECK constraint
    op.drop_constraint('accounts_type_check', 'accounts', type_='check')
    
    # Restore the old CHECK constraint without PPF
    op.create_check_constraint(
        'accounts_type_check',
        'accounts',
        "type IN ('checking', 'savings', 'credit', 'cash', 'investment')"
    )