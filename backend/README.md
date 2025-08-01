# Expense Manager Backend

A FastAPI-based backend for expense management with user authentication, transaction tracking, and reporting features.

## Features

- **User Authentication**: JWT-based authentication system
- **Account Management**: Create and manage multiple accounts
- **Transaction Management**: Record deposits, withdrawals, and transfers
- **Category & Payee Management**: Organize transactions with categories and payees
- **Data Import**: Import transactions from CSV, Excel, and PDF files
- **Reporting**: Generate summaries and analytics
- **Database**: PostgreSQL with SQLAlchemy ORM

## Prerequisites

- Python 3.8+
- PostgreSQL
- Virtual environment (recommended)

## Setup

1. **Clone the repository and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   Create a `.env` file in the backend directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost/expense_manager
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

5. **Database setup:**
   ```bash
   # Run database migrations
   alembic upgrade head
   ```

6. **Start the development server:**
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

## API Documentation

Once the server is running, visit:
- **Interactive API docs (Swagger UI)**: http://localhost:8000/docs
- **Alternative API docs (ReDoc)**: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Accounts
- `GET /accounts/` - List user accounts
- `POST /accounts/` - Create new account
- `GET /accounts/{id}` - Get account details
- `PUT /accounts/{id}` - Update account
- `DELETE /accounts/{id}` - Delete account

### Transactions
- `GET /transactions/` - List transactions (with filters)
- `POST /transactions/` - Create new transaction
- `GET /transactions/{id}` - Get transaction details
- `PUT /transactions/{id}` - Update transaction
- `DELETE /transactions/{id}` - Delete transaction

### Categories
- `GET /categories/` - List categories
- `POST /categories/` - Create new category
- `PUT /categories/{id}` - Update category
- `DELETE /categories/{id}` - Delete category

### Payees
- `GET /payees/` - List payees
- `POST /payees/` - Create new payee
- `PUT /payees/{id}` - Update payee
- `DELETE /payees/{id}` - Delete payee

### Reports
- `GET /reports/summary` - Get transaction summary
- `GET /reports/by-category` - Get transactions by category
- `GET /reports/by-payee` - Get transactions by payee
- `GET /reports/by-account` - Get transactions by account
- `GET /reports/monthly-trend` - Get monthly trends

### Data Import
- `POST /import/csv` - Import from CSV file
- `POST /import/excel` - Import from Excel file
- `POST /import/pdf` - Import from PDF file

## Project Structure

```
backend/
├── alembic/              # Database migrations
├── models/               # SQLAlchemy models
│   ├── accounts.py
│   ├── categories.py
│   ├── payees.py
│   ├── transactions.py
│   └── users.py
├── routers/              # FastAPI route handlers
│   ├── accounts.py
│   ├── auth.py
│   ├── categories.py
│   ├── import_data.py
│   ├── payees.py
│   ├── reports.py
│   └── transactions.py
├── schemas/              # Pydantic schemas for request/response
│   ├── accounts.py
│   ├── categories.py
│   ├── payees.py
│   ├── transactions.py
│   └── users.py
├── utils/                # Utility functions
│   ├── auth.py
│   └── color_generator.py
├── database.py           # Database configuration
├── main.py              # FastAPI application entry point
└── requirements.txt     # Python dependencies
```

## Models

### User
- Authentication and user management
- Links to all user-specific data

### Account
- Bank accounts, credit cards, cash accounts
- Account types: checking, savings, credit, cash, investment
- Balance tracking with automatic updates

### Transaction
- Three types: deposit, withdrawal, transfer
- Links to accounts, categories, and payees
- Automatic balance updates

### Category
- Expense/income categorization
- Color coding for UI
- Optional for transactions

### Payee
- Person or entity involved in transactions
- Optional for transactions

## Transaction Types

1. **Deposit**: Money coming into an account
2. **Withdrawal**: Money going out of an account  
3. **Transfer**: Money moving between accounts

## Development

### Adding new endpoints:
1. Create/update models in `models/`
2. Create/update schemas in `schemas/`
3. Create route handlers in `routers/`
4. Register routers in `main.py`

### Database migrations:
```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head
```

### Testing:
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests (if test suite exists)
pytest
```

## Production Deployment

1. Set production environment variables
2. Use a production WSGI server like Gunicorn:
   ```bash
   pip install gunicorn
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```
3. Set up reverse proxy (nginx)
4. Use production database
5. Enable HTTPS

## License

[Add your license information here]