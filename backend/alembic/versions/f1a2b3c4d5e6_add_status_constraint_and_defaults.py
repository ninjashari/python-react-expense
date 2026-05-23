"""Add status constraint and defaults for accounts

Revision ID: f1a2b3c4d5e6
Revises: e2366f4c3892
Create Date: 2026-03-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e2366f4c3892'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Set default value for existing NULL status values
    op.execute("UPDATE accounts SET status = 'active' WHERE status IS NULL")
    
    # Alter the column to be NOT NULL with default
    op.alter_column('accounts', 'status',
                    existing_type=sa.String(length=20),
                    nullable=False,
                    server_default='active')
    
    # Add CHECK constraint for status values
    op.create_check_constraint(
        'accounts_status_check',
        'accounts',
        "status IN ('active', 'inactive', 'closed')"
    )


def downgrade() -> None:
    # Drop the CHECK constraint
    op.drop_constraint('accounts_status_check', 'accounts', type_='check')
    
    # Revert the column to allow NULL
    op.alter_column('accounts', 'status',
                    existing_type=sa.String(length=20),
                    nullable=True,
                    server_default=None)
