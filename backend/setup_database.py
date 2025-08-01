#!/usr/bin/env python3
"""
Database setup script for first-time installation of Expense Manager backend.

This script will:
1. Check if database exists and is accessible
2. Run Alembic migrations to create/update schema
3. Verify the setup is complete
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import subprocess

def load_environment():
    """Load environment variables from .env file if it exists."""
    env_file = Path(".env")
    if env_file.exists():
        load_dotenv(env_file)
        print("✓ Loaded .env file")
    else:
        print("⚠ No .env file found, using default/system environment variables")

def get_database_url():
    """Get database URL from environment."""
    db_url = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/expense_manager")
    print(f"📊 Database URL: {db_url.split('@')[0]}@***")
    return db_url

def test_database_connection(db_url):
    """Test if we can connect to the database."""
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\nPlease ensure:")
        print("1. PostgreSQL is running")
        print("2. Database exists and credentials are correct")
        print("3. DATABASE_URL in .env is properly configured")
        return False

def check_alembic_setup():
    """Check if Alembic is properly configured."""
    alembic_ini = Path("alembic.ini")
    versions_dir = Path("alembic/versions")
    
    if not alembic_ini.exists():
        print("❌ alembic.ini not found")
        return False
    
    if not versions_dir.exists():
        print("❌ alembic/versions directory not found")
        return False
    
    migration_files = list(versions_dir.glob("*.py"))
    if not migration_files:
        print("❌ No migration files found")
        return False
    
    print(f"✓ Alembic setup found with {len(migration_files)} migration(s)")
    return True

def check_database_state(db_url):
    """Check if database is empty or has existing tables."""
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Check if any tables exist
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"
            ))
            table_count = result.scalar()
            
            # Check if alembic_version exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='alembic_version'"
            ))
            alembic_exists = result.scalar() > 0
            
            return {
                'table_count': table_count,
                'alembic_exists': alembic_exists,
                'is_empty': table_count == 0
            }
    except Exception as e:
        print(f"❌ Error checking database state: {e}")
        return None

def run_migrations():
    """Run Alembic migrations with proper handling for different database states."""
    db_url = get_database_url()
    db_state = check_database_state(db_url)
    
    if not db_state:
        return False
    
    try:
        print("🔄 Running database migrations...")
        
        if db_state['is_empty']:
            # Fresh database - run normal upgrade
            print("📊 Fresh database detected, running initial setup...")
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                check=True
            )
        elif not db_state['alembic_exists']:
            # Database has tables but no alembic_version - stamp current version
            print("📊 Existing database without migration history detected...")
            print("🔄 Marking database as up-to-date...")
            result = subprocess.run(
                ["alembic", "stamp", "head"],
                capture_output=True,
                text=True,
                check=True
            )
            print("✓ Database marked as up-to-date")
            return True
        else:
            # Database with alembic_version - normal upgrade
            print("📊 Existing managed database detected, checking for updates...")
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                check=True
            )
        
        print("✓ Migrations completed successfully")
        if result.stdout:
            print("Migration output:", result.stdout)
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Migration failed: {e}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        
        # If it's a table exists error, try to stamp the database
        if "already exists" in str(e.stderr):
            print("🔄 Attempting to resolve by marking database as current...")
            try:
                subprocess.run(
                    ["alembic", "stamp", "head"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                print("✓ Database marked as up-to-date")
                return True
            except subprocess.CalledProcessError:
                print("❌ Could not resolve migration conflict")
                return False
        
        return False
    except FileNotFoundError:
        print("❌ Alembic not found. Please ensure it's installed:")
        print("pip install alembic")
        return False

def verify_tables(db_url):
    """Verify that all expected tables were created."""
    expected_tables = {'users', 'accounts', 'categories', 'payees', 'transactions', 'alembic_version'}
    
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT tablename FROM pg_tables WHERE schemaname='public'"
            ))
            actual_tables = {row[0] for row in result}
        
        missing_tables = expected_tables - actual_tables
        if missing_tables:
            print(f"❌ Missing tables: {missing_tables}")
            return False
        
        print("✓ All expected tables created successfully")
        print(f"  Tables: {', '.join(sorted(actual_tables))}")
        return True
        
    except Exception as e:
        print(f"❌ Error verifying tables: {e}")
        return False

def test_basic_operations(db_url):
    """Test basic database operations."""
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Test insert/select on users table
            conn.execute(text("""
                INSERT INTO users (id, email, name, password_hash) 
                VALUES (gen_random_uuid(), 'test@setup.com', 'Setup Test', 'dummy_hash')
                ON CONFLICT (email) DO NOTHING
            """))
            
            result = conn.execute(text(
                "SELECT COUNT(*) FROM users WHERE email = 'test@setup.com'"
            ))
            count = result.scalar()
            
            if count > 0:
                print("✓ Basic database operations working")
                # Cleanup test data
                conn.execute(text("DELETE FROM users WHERE email = 'test@setup.com'"))
                conn.commit()
                return True
            else:
                print("❌ Could not insert test data")
                return False
                
    except Exception as e:
        print(f"❌ Error testing basic operations: {e}")
        return False

def main():
    """Main setup function."""
    print("🚀 Expense Manager Database Setup")
    print("=" * 40)
    
    # Step 1: Load environment
    load_environment()
    
    # Step 2: Get database URL
    db_url = get_database_url()
    
    # Step 3: Test database connection
    if not test_database_connection(db_url):
        sys.exit(1)
    
    # Step 4: Check Alembic setup
    if not check_alembic_setup():
        sys.exit(1)
    
    # Step 5: Run migrations
    if not run_migrations():
        sys.exit(1)
    
    # Step 6: Verify tables
    if not verify_tables(db_url):
        sys.exit(1)
    
    # Step 7: Test basic operations
    if not test_basic_operations(db_url):
        sys.exit(1)
    
    print("\n🎉 Database setup completed successfully!")
    print("\nNext steps:")
    print("1. Start the backend server: python -m uvicorn main:app --reload")
    print("2. Access the API docs at: http://localhost:8000/docs")
    print("3. Create your first user via the /auth/register endpoint")

if __name__ == "__main__":
    main()