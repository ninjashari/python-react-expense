# First-Time Setup Checklist

This checklist ensures proper database setup for new installations of the Expense Manager backend.

## Prerequisites ✅

- [ ] Python 3.8+ installed
- [ ] PostgreSQL installed and running
- [ ] Database created (e.g., `expense_manager`)
- [ ] Database user with proper permissions

## Quick Setup (Recommended)

Run the automated setup script:

```bash
python setup.py
```

This handles everything automatically. If you prefer manual setup, follow the steps below.

## Manual Setup Steps

### 1. Environment Setup ⚙️

- [ ] Clone the repository
- [ ] Create virtual environment: `python3 -m venv venv`
- [ ] Activate virtual environment: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
- [ ] Install dependencies: `pip install -r requirements.txt`

### 2. Environment Configuration 🔧

- [ ] Copy `.env.example` to `.env`: `cp .env.example .env`
- [ ] Update `.env` with your database credentials:
  ```
  DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name
  SECRET_KEY=your-secret-key-change-in-production
  ```

### 3. Database Setup 🗄️

#### Option A: Automated (Recommended)
- [ ] Run database setup script: `python setup_database.py`

#### Option B: Manual
- [ ] Run migrations: `alembic upgrade head`
- [ ] Verify tables created: Check for `users`, `accounts`, `categories`, `payees`, `transactions`

### 4. Verification ✅

- [ ] Test server startup: `python -m uvicorn main:app --reload --port 8000`
- [ ] Access API docs: http://localhost:8000/docs
- [ ] Test registration endpoint with sample data
- [ ] Import Postman collection: `Expense_Manager_API.postman_collection.json`

## Common Issues & Solutions 🔧

### Issue: "relation already exists" during migration
**Solution**: Database has existing tables
```bash
alembic stamp head  # Mark database as current
```

### Issue: "Can't connect to database" 
**Solutions**:
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database exists and user has permissions
- Test connection: `psql -d your_database_url`

### Issue: "No module named 'X'"
**Solution**: Dependencies not installed
```bash
pip install -r requirements.txt
```

### Issue: "Alembic command not found"
**Solution**: Alembic not in PATH
```bash
pip install alembic
# Or use: python -m alembic upgrade head
```

## Database Schema Overview 📊

The setup creates these tables:

- **users**: User authentication and profiles
- **accounts**: Bank accounts, credit cards, etc.
- **categories**: Expense/income categories with colors
- **payees**: Transaction counterparties
- **transactions**: Financial transactions with relationships
- **alembic_version**: Migration version tracking

## Setup Scripts 🛠️

| Script | Purpose |
|--------|---------|
| `setup.py` | Complete automated setup |
| `setup_database.py` | Database-only setup |
| `test_fresh_install.py` | Test fresh installation |

## Validation Commands 🧪

```bash
# Test database connection
python -c "from database import engine; engine.connect(); print('✓ Database OK')"

# Test model imports
python -c "from models.users import User; print('✓ Models OK')"

# Test server startup
python -c "from main import app; print('✓ App OK')"

# Test API endpoint
curl -X POST "http://localhost:8000/auth/register" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","name":"Test User","password":"test123"}'
```

## Development Workflow 🔄

After setup:

1. **Start development server**: `python -m uvicorn main:app --reload`
2. **Create migrations**: `alembic revision --autogenerate -m "description"`
3. **Apply migrations**: `alembic upgrade head`
4. **Run tests**: `pytest` (if test suite exists)

## Production Notes 🚀

For production deployment:

- [ ] Use strong SECRET_KEY
- [ ] Set DEBUG=False
- [ ] Use production database
- [ ] Configure proper logging
- [ ] Use HTTPS
- [ ] Set up reverse proxy (nginx)
- [ ] Use production WSGI server (gunicorn)

---

✅ **Setup Complete!** The backend should now be ready for development or production use.