#!/usr/bin/env python3
"""
Test script to verify fresh installation works correctly.
This script simulates what happens when someone clones the repo and sets it up for the first time.
"""

import os
import tempfile
import shutil
import subprocess
from pathlib import Path

def run_command(command, cwd=None, check=True):
    """Run a command and return result."""
    try:
        result = subprocess.run(
            command, shell=True, cwd=cwd, check=check, 
            capture_output=True, text=True
        )
        return result, None
    except subprocess.CalledProcessError as e:
        return e, str(e)

def test_fresh_installation():
    """Test the complete fresh installation process."""
    print("🧪 Testing Fresh Installation Process")
    print("=" * 50)
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"📁 Test directory: {temp_dir}")
        
        # Copy project files (excluding venv, __pycache__, etc.)
        source_dir = Path(__file__).parent
        test_dir = Path(temp_dir) / "backend"
        
        print("📋 Copying project files...")
        shutil.copytree(
            source_dir, test_dir,
            ignore=shutil.ignore_patterns(
                'venv', '__pycache__', '*.pyc', '.env', 
                '.pytest_cache', '.git', 'node_modules'
            )
        )
        
        # Create a test .env file
        env_content = """DATABASE_URL=postgresql://expense_user:nezuko@localhost:5432/expense_manager_test
SECRET_KEY=test-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True"""
        
        (test_dir / ".env").write_text(env_content)
        print("✓ Created test .env file")
        
        # Test steps
        tests = [
            ("Virtual Environment", "python3 -m venv venv"),
            ("Install Dependencies", "venv/bin/pip install -r requirements.txt"),
            ("Test Import", "venv/bin/python -c 'from main import app; print(\"Import successful\")'"),
            ("Database Setup", "venv/bin/python setup_database.py"),
        ]
        
        all_passed = True
        for test_name, command in tests:
            print(f"\n🔄 Testing: {test_name}")
            result, error = run_command(command, cwd=test_dir, check=False)
            
            if error:
                print(f"❌ {test_name} failed:")
                print(f"  Command: {command}")
                print(f"  Error: {error}")
                if hasattr(result, 'stdout') and result.stdout:
                    print(f"  STDOUT: {result.stdout}")
                if hasattr(result, 'stderr') and result.stderr:
                    print(f"  STDERR: {result.stderr}")
                all_passed = False
            else:
                print(f"✓ {test_name} passed")
        
        if all_passed:
            print("\n🎉 Fresh installation test PASSED!")
            print("The backend can be successfully set up from scratch.")
        else:
            print("\n❌ Fresh installation test FAILED!")
            print("There are issues with the first-time setup process.")
        
        return all_passed

if __name__ == "__main__":
    try:
        success = test_fresh_installation()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠ Test interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n❌ Test failed with unexpected error: {e}")
        exit(1)