#!/usr/bin/env python3
"""
Data migration script to populate balance_after_transaction fields for existing transactions.

This script carefully calculates running balances for all existing transactions:
1. Processes each account separately
2. Sorts transactions chronologically (oldest first)
3. Calculates running balance after each transaction
4. Handles transfer transactions for both source and destination accounts
5. Preserves all existing data - only updates balance_after_transaction fields

IMPORTANT: Run this script only once after adding the balance_after_transaction fields.
"""

import sys
import os
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models.accounts import Account
from models.transactions import Transaction


def get_account_starting_balance(db: Session, account_id: str) -> Decimal:
    """
    Calculate the account's starting balance by working backwards from current balance.
    This accounts for all transactions that have already been applied to the account.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise ValueError(f"Account {account_id} not found")
    
    current_balance = account.balance
    
    # Get all transactions for this account (including transfers)
    transactions = db.query(Transaction).filter(
        (Transaction.account_id == account_id) | 
        (Transaction.to_account_id == account_id)
    ).order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()
    
    # Work backwards to find the starting balance
    starting_balance = current_balance
    
    for transaction in transactions:
        if str(transaction.account_id) == str(account_id):
            # This account was the source
            if account.type == 'credit':
                if transaction.type == "income":
                    starting_balance += transaction.amount  # Reverse payment (add back debt)
                elif transaction.type == "expense":
                    starting_balance -= transaction.amount  # Reverse charge (remove debt)
                elif transaction.type == "transfer":
                    starting_balance += transaction.amount  # Reverse debit (add back debt)
            else:
                if transaction.type == "income":
                    starting_balance -= transaction.amount  # Reverse income
                elif transaction.type == "expense":
                    starting_balance += transaction.amount  # Reverse expense
                elif transaction.type == "transfer":
                    starting_balance += transaction.amount  # Reverse debit
        
        elif str(transaction.to_account_id) == str(account_id) and transaction.type == "transfer":
            # This account was the destination of a transfer
            if account.type == 'credit':
                starting_balance += transaction.amount  # Reverse credit (add back debt)
            else:
                starting_balance -= transaction.amount  # Reverse credit
    
    return starting_balance


def calculate_balance_after_transaction_for_account(account_id: str, account_type: str, 
                                                  current_balance: Decimal, 
                                                  transaction: Transaction) -> Decimal:
    """
    Calculate what the account balance will be after applying a transaction.
    """
    amount = transaction.amount
    
    if str(transaction.account_id) == str(account_id):
        # This account is the source
        if account_type == 'credit':
            if transaction.type == "income":
                return current_balance - amount  # Payment reduces debt
            elif transaction.type == "expense":
                return current_balance + amount  # Charge increases debt
            elif transaction.type == "transfer":
                return current_balance + amount  # Debit increases debt
        else:
            if transaction.type == "income":
                return current_balance + amount  # Income increases balance
            elif transaction.type == "expense":
                return current_balance - amount  # Expense decreases balance
            elif transaction.type == "transfer":
                return current_balance - amount  # Debit decreases balance
    
    elif str(transaction.to_account_id) == str(account_id) and transaction.type == "transfer":
        # This account is the destination of a transfer
        if account_type == 'credit':
            return current_balance - amount  # Credit reduces debt
        else:
            return current_balance + amount  # Credit increases balance
    
    return current_balance  # No change for this account


def migrate_account_transaction_balances(db: Session, account_id: str, dry_run: bool = True):
    """
    Migrate balance_after_transaction for all transactions of a specific account.
    Processes transactions chronologically from oldest to newest.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        print(f"❌ Account {account_id} not found")
        return False
    
    print(f"\n📊 Processing account: {account.name} ({account.type})")
    print(f"   Current balance: {account.balance}")
    
    # Get starting balance
    try:
        starting_balance = get_account_starting_balance(db, account_id)
        print(f"   Calculated starting balance: {starting_balance}")
    except Exception as e:
        print(f"❌ Error calculating starting balance for account {account.name}: {e}")
        return False
    
    # Get all transactions for this account, sorted chronologically
    transactions = db.query(Transaction).filter(
        (Transaction.account_id == account_id) | 
        (Transaction.to_account_id == account_id)
    ).order_by(Transaction.date.asc(), Transaction.created_at.asc()).all()
    
    print(f"   Found {len(transactions)} transactions to process")
    
    if len(transactions) == 0:
        print(f"   ✅ No transactions found for account {account.name}")
        return True
    
    # Process transactions chronologically
    running_balance = starting_balance
    updates_made = 0
    
    for i, transaction in enumerate(transactions):
        # Calculate balance after this transaction
        new_balance = calculate_balance_after_transaction_for_account(
            account_id, account.type, running_balance, transaction
        )
        
        # Determine which balance field to update
        if str(transaction.account_id) == str(account_id):
            # This account is the source
            if transaction.balance_after_transaction is None:
                if not dry_run:
                    transaction.balance_after_transaction = new_balance
                updates_made += 1
                if i < 5 or updates_made % 100 == 0:  # Show first few and every 100th
                    print(f"   🔄 Transaction {i+1}: {transaction.date} | "
                          f"{transaction.type} | {transaction.amount} | "
                          f"Balance: {running_balance} → {new_balance}")
        
        elif str(transaction.to_account_id) == str(account_id) and transaction.type == "transfer":
            # This account is the destination of a transfer
            if transaction.to_account_balance_after is None:
                if not dry_run:
                    transaction.to_account_balance_after = new_balance
                updates_made += 1
                print(f"   🔄 Transfer To {i+1}: {transaction.date} | "
                      f"{transaction.amount} | "
                      f"Balance: {running_balance} → {new_balance}")
        
        # Update running balance for next iteration
        running_balance = new_balance
    
    # Verify final balance matches current account balance
    if abs(running_balance - account.balance) > Decimal('0.01'):
        print(f"⚠️  WARNING: Final calculated balance ({running_balance}) "
              f"doesn't match current account balance ({account.balance})")
        print(f"   Difference: {running_balance - account.balance}")
        return False
    
    print(f"   ✅ Final balance verification passed: {running_balance}")
    print(f"   📝 Updates needed: {updates_made}")
    
    return True


def migrate_all_transaction_balances(dry_run: bool = True):
    """
    Migrate balance_after_transaction for all accounts and their transactions.
    """
    db = SessionLocal()
    
    try:
        print("🚀 Starting transaction balance migration...")
        print(f"   Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
        
        # Get all accounts
        accounts = db.query(Account).order_by(Account.name).all()
        print(f"\n📋 Found {len(accounts)} accounts to process")
        
        success_count = 0
        error_count = 0
        
        for account in accounts:
            try:
                success = migrate_account_transaction_balances(db, str(account.id), dry_run)
                if success:
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                print(f"❌ Error processing account {account.name}: {e}")
                error_count += 1
        
        if not dry_run and error_count == 0:
            print("\n💾 Committing changes to database...")
            db.commit()
            print("✅ Migration completed successfully!")
        elif error_count > 0:
            print(f"\n⚠️  Migration completed with {error_count} errors")
            if not dry_run:
                print("🔄 Rolling back changes due to errors...")
                db.rollback()
        else:
            print(f"\n✅ Dry run completed successfully!")
            print(f"   Accounts processed: {success_count}")
            print(f"   Run with --apply to make actual changes")
        
        return error_count == 0
        
    except Exception as e:
        print(f"❌ Critical error during migration: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def verify_migration():
    """
    Verify that the migration was successful by checking for transactions 
    with missing balance_after_transaction fields.
    """
    db = SessionLocal()
    
    try:
        print("\n🔍 Verifying migration...")
        
        # Check for transactions missing balance_after_transaction
        missing_balance = db.query(Transaction).filter(
            Transaction.balance_after_transaction.is_(None)
        ).count()
        
        # Check for transfer transactions missing to_account_balance_after
        missing_to_balance = db.query(Transaction).filter(
            Transaction.type == "transfer",
            Transaction.to_account_balance_after.is_(None),
            Transaction.to_account_id.is_not(None)
        ).count()
        
        total_transactions = db.query(Transaction).count()
        transfer_transactions = db.query(Transaction).filter(
            Transaction.type == "transfer",
            Transaction.to_account_id.is_not(None)
        ).count()
        
        print(f"   Total transactions: {total_transactions}")
        print(f"   Missing balance_after_transaction: {missing_balance}")
        print(f"   Transfer transactions: {transfer_transactions}")
        print(f"   Missing to_account_balance_after: {missing_to_balance}")
        
        if missing_balance == 0 and missing_to_balance == 0:
            print("✅ Migration verification passed!")
            return True
        else:
            print("❌ Migration verification failed!")
            return False
            
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("📊 Transaction Balance Migration Script")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        print("⚠️  LIVE MODE: This will modify the database!")
        confirmation = input("Type 'CONFIRM' to proceed: ")
        if confirmation != "CONFIRM":
            print("❌ Migration cancelled")
            sys.exit(1)
        
        success = migrate_all_transaction_balances(dry_run=False)
        
        if success:
            verify_migration()
        
    elif len(sys.argv) > 1 and sys.argv[1] == "--verify":
        verify_migration()
    
    else:
        print("ℹ️  Running in DRY RUN mode (no changes will be made)")
        print("   Use --apply to make actual changes")
        print("   Use --verify to check migration status")
        migrate_all_transaction_balances(dry_run=True)