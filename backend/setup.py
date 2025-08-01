#!/usr/bin/env python3
"""
Complete setup script for Expense Manager backend first-time installation.

This script will guide users through the entire setup process including:
1. Environment configuration
2. Virtual environment setup  
3. Dependencies installation
4. Database setup and migrations
5. Final verification
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from dotenv import load_dotenv

def print_header(title):
    """Print a formatted header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_step(step, description):
    """Print a step description."""
    print(f"\n📋 Step {step}: {description}")
    print("-" * 40)

def run_command(command, description, check=True):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        if result.stdout:
            print(f"✓ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        return False

def check_requirements():
    """Check if required software is installed."""
    print_step(1, "Checking Requirements")
    
    requirements = [
        ("python3", "Python 3.8+ is required"),
        ("pip", "pip is required for package installation"),
        ("psql", "PostgreSQL client (optional, for database verification)"),
    ]
    
    missing = []
    for cmd, desc in requirements:
        if shutil.which(cmd):
            print(f"✓ {cmd} found")
        else:
            print(f"❌ {cmd} not found - {desc}")
            if cmd != "psql":  # psql is optional
                missing.append(cmd)
    
    if missing:
        print(f"\n❌ Missing required software: {', '.join(missing)}")
        return False
    
    return True

def setup_virtual_environment():
    """Create and activate virtual environment."""
    print_step(2, "Setting up Virtual Environment")
    
    venv_path = Path("venv")
    if venv_path.exists():
        print("✓ Virtual environment already exists")
        return True
    
    if not run_command("python3 -m venv venv", "Creating virtual environment"):
        return False
    
    print("✓ Virtual environment created")
    print("💡 To activate: source venv/bin/activate (Linux/Mac) or venv\\Scripts\\activate (Windows)")
    return True

def install_dependencies():
    """Install Python dependencies."""
    print_step(3, "Installing Dependencies")
    
    requirements_file = Path("requirements.txt")
    if not requirements_file.exists():
        print("❌ requirements.txt not found")
        return False
    
    # Use the virtual environment pip
    pip_cmd = "venv/bin/pip" if os.name != 'nt' else "venv\\Scripts\\pip"
    
    if not run_command(f"{pip_cmd} install --upgrade pip", "Upgrading pip"):
        return False
    
    if not run_command(f"{pip_cmd} install -r requirements.txt", "Installing dependencies"):
        return False
    
    return True

def create_environment_file():
    """Create .env file from template."""
    print_step(4, "Environment Configuration")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if env_file.exists():
        print("✓ .env file already exists")
        return True
    
    if env_example.exists():
        # Copy example file
        shutil.copy(env_example, env_file)
        print("✓ Created .env from .env.example")
        print("⚠ Please edit .env file with your database credentials")
        return True
    else:
        # Create basic .env file
        env_content = """# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/expense_manager

# JWT Configuration  
SECRET_KEY=change-this-secret-key-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Settings
DEBUG=True
"""
        with open(env_file, 'w') as f:
            f.write(env_content)
        print("✓ Created basic .env file")
        print("⚠ Please edit .env file with your database credentials")
        return True

def setup_database():
    """Setup database using the setup_database script."""
    print_step(5, "Database Setup")
    
    # Use the virtual environment python
    python_cmd = "venv/bin/python" if os.name != 'nt' else "venv\\Scripts\\python"
    
    if not run_command(f"{python_cmd} setup_database.py", "Setting up database"):
        print("\n💡 Database setup failed. Please:")
        print("1. Ensure PostgreSQL is running")
        print("2. Create the database specified in DATABASE_URL")
        print("3. Update .env with correct database credentials")
        print("4. Run: python setup_database.py")
        return False
    
    return True

def final_verification():
    """Perform final verification."""
    print_step(6, "Final Verification")
    
    # Check if server can start
    python_cmd = "venv/bin/python" if os.name != 'nt' else "venv\\Scripts\\python"
    
    print("🔄 Testing server startup...")
    try:
        # Try to import the main app
        result = subprocess.run(
            f'{python_cmd} -c "from main import app; print(\'✓ Server can start successfully\')"',
            shell=True, check=True, capture_output=True, text=True
        )
        print(result.stdout.strip())
        return True
    except subprocess.CalledProcessError as e:
        print("❌ Server startup test failed:")
        if e.stderr:
            print("Error:", e.stderr)
        return False

def print_next_steps():
    """Print what to do next."""
    print_header("🎉 Setup Complete!")
    
    activate_cmd = "source venv/bin/activate" if os.name != 'nt' else "venv\\Scripts\\activate"
    
    print(f"""
Setup completed successfully! Here's what you can do next:

1. Activate the virtual environment:
   {activate_cmd}

2. Start the development server:
   python -m uvicorn main:app --reload --port 8000

3. Access the application:
   - API Documentation: http://localhost:8000/docs
   - Alternative Docs: http://localhost:8000/redoc

4. Create your first user:
   - Use POST /auth/register endpoint
   - Or use the provided Postman collection

5. Import the Postman collection:
   - File: Expense_Manager_API.postman_collection.json
   - Set base_url variable to: http://localhost:8000

📁 Project Structure:
   - Backend API: http://localhost:8000
   - Frontend (if setup): http://localhost:3000
   - Database: PostgreSQL
   - Migrations: alembic/versions/

🔧 Useful Commands:
   - Run migrations: alembic upgrade head
   - Create migration: alembic revision --autogenerate -m "description"
   - Reset database: python setup_database.py
   - Run tests: pytest (if test suite exists)

📚 Documentation:
   - README.md: Project overview and detailed setup
   - API Docs: http://localhost:8000/docs (when server is running)
""")

def main():
    """Main setup function."""
    print_header("🚀 Expense Manager Backend Setup")
    print("This script will guide you through the complete setup process.")
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    steps = [
        ("Requirements Check", check_requirements),
        ("Virtual Environment", setup_virtual_environment),
        ("Dependencies Installation", install_dependencies),
        ("Environment Configuration", create_environment_file),
        ("Database Setup", setup_database),
        ("Final Verification", final_verification),
    ]
    
    for step_name, step_func in steps:
        if not step_func():
            print(f"\n❌ Setup failed at: {step_name}")
            print("Please fix the above errors and run the setup again.")
            sys.exit(1)
    
    print_next_steps()

if __name__ == "__main__":
    main()