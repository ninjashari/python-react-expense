# 🔧 Backend API - Expense Manager

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-red.svg)](https://www.sqlalchemy.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)

The FastAPI backend for the Expense Manager application, providing a robust REST API with authentication, file processing, and advanced data management capabilities.

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Database](#-database)
- [Architecture](#-architecture)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)

## ✨ Features

### Core API Features
- **JWT Authentication** - Secure user registration and login
- **RESTful API Design** - Following REST conventions
- **Database Migrations** - Alembic for schema management
- **Data Validation** - Pydantic schemas for request/response validation
- **CORS Support** - Configurable cross-origin resource sharing
- **Interactive Documentation** - Auto-generated Swagger UI

### Advanced Features
- **File Import System** - CSV, Excel, and PDF processing
- **PDF OCR Processing** - Text extraction with Tesseract
- **LLM Integration** - Local Ollama integration for PDF analysis
- **Color Generation** - Unique color assignment for categories
- **Slug Generation** - URL-friendly identifiers
- **Relationship Loading** - Optimized database queries

## 🚀 Installation

### Prerequisites

- Python 3.8 or higher
- PostgreSQL 12 or higher
- pip (Python package manager)

### Setup Steps

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize database:**
   ```bash
   alembic upgrade head
   ```

6. **Run the development server:**
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

The API will be available at `http://localhost:8000` with documentation at `http://localhost:8000/docs`.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/expense_manager

# JWT Configuration
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Optional: PDF LLM Import
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract

# Optional: Development
DEBUG=True
LOG_LEVEL=INFO
```

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/db` |
| `SECRET_KEY` | JWT signing key (use strong random key) | `openssl rand -hex 32` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry | `30` |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `TESSERACT_CMD` | Tesseract executable path | System default |

## 📚 API Documentation

### Interactive Documentation

Once running, visit:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

### Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT authentication:

```bash
# Login to get token
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=password"

# Use token in subsequent requests
curl -H "Authorization: Bearer <your-jwt-token>" \
  "http://localhost:8000/accounts/"
```

### Main Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

#### Accounts
- `GET /accounts/` - List user accounts
- `POST /accounts/` - Create new account
- `GET /accounts/{id}` - Get specific account
- `PUT /accounts/{id}` - Update account
- `DELETE /accounts/{id}` - Delete account

#### Transactions
- `GET /transactions/` - List transactions (with filtering)
- `POST /transactions/` - Create transaction
- `GET /transactions/{id}` - Get specific transaction
- `PUT /transactions/{id}` - Update transaction
- `DELETE /transactions/{id}` - Delete transaction

#### Categories
- `GET /categories/` - List categories
- `POST /categories/` - Create category (auto-generates color)
- `PUT /categories/{id}` - Update category
- `DELETE /categories/{id}` - Delete category

#### Payees
- `GET /payees/` - List payees
- `POST /payees/` - Create payee
- `PUT /payees/{id}` - Update payee
- `DELETE /payees/{id}` - Delete payee

#### Import
- `POST /import/csv` - Import from CSV file
- `POST /import/excel` - Import from Excel file
- `POST /import/pdf-ocr` - Import from PDF (OCR)
- `POST /import/pdf-llm` - Import from PDF (LLM)
- `GET /import/pdf-llm/status` - Check LLM system status

## 🗄️ Database

### Schema Overview

The database uses PostgreSQL with SQLAlchemy ORM:

```
users
├── id (Primary Key)
├── email (Unique)
├── hashed_password
└── created_at

accounts
├── id (Primary Key)
├── user_id (Foreign Key → users.id)
├── name
├── type (checking, savings, credit, cash, investment)
├── balance
├── credit_limit (for credit cards)
└── ...

transactions
├── id (Primary Key)
├── user_id (Foreign Key → users.id)
├── account_id (Foreign Key → accounts.id)
├── to_account_id (Foreign Key → accounts.id, nullable)
├── category_id (Foreign Key → categories.id, nullable)
├── payee_id (Foreign Key → payees.id, nullable)
├── amount
├── type (income, expense, transfer)
├── description
└── date

categories
├── id (Primary Key)
├── user_id (Foreign Key → users.id)
├── name
├── color (auto-generated)
└── slug

payees
├── id (Primary Key)
├── user_id (Foreign Key → users.id)
├── name
└── slug
```

### Database Operations

**Run migrations:**
```bash
alembic upgrade head
```

**Create new migration:**
```bash
alembic revision --autogenerate -m "Description of changes"
```

**Check migration history:**
```bash
alembic history
```

**Reset database (development only):**
```bash
alembic downgrade base
alembic upgrade head
```

## 🏗️ Architecture

### Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── database.py            # Database configuration
├── requirements.txt       # Python dependencies
├── alembic.ini           # Alembic configuration
├── alembic/              # Database migrations
│   ├── env.py
│   └── versions/
├── models/               # SQLAlchemy models
│   ├── __init__.py
│   ├── accounts.py
│   ├── categories.py
│   ├── payees.py
│   ├── transactions.py
│   └── users.py
├── routers/              # API route handlers
│   ├── __init__.py
│   ├── accounts.py
│   ├── auth.py
│   ├── categories.py
│   ├── import_data.py
│   ├── payees.py
│   └── transactions.py
├── schemas/              # Pydantic request/response schemas
│   ├── __init__.py
│   ├── accounts.py
│   ├── categories.py
│   ├── import_schemas.py
│   ├── payees.py
│   ├── transactions.py
│   └── users.py
├── services/             # Business logic services
│   ├── __init__.py
│   ├── llm_service.py
│   ├── pdf_llm_processor.py
│   └── pdf_processor.py
└── utils/                # Utility functions
    ├── __init__.py
    ├── auth.py
    ├── color_generator.py
    └── slug.py
```

### Key Design Patterns

**Dependency Injection:**
```python
from database import get_db
from utils.auth import get_current_user

@router.get("/transactions/")
def get_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ...
```

**Repository Pattern:**
```python
def get_user_transactions(db: Session, user_id: int):
    return db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).all()
```

**Service Layer:**
```python
class PDFLLMProcessor:
    def process_pdf(self, file_content: bytes) -> List[TransactionData]:
        # Complex business logic separated from API layer
        ...
```

## 🧪 Development

### Running in Development Mode

```bash
# With auto-reload
python -m uvicorn main:app --reload --port 8000

# With specific host
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# With debug logging
python -m uvicorn main:app --reload --log-level debug
```

### Code Quality

**Format code:**
```bash
black .
isort .
```

**Lint code:**
```bash
flake8 .
pylint **/*.py
```

**Type checking:**
```bash
mypy .
```

### Adding New Features

1. **Create/update models** in `models/`
2. **Generate migration:** `alembic revision --autogenerate -m "Description"`
3. **Create schemas** in `schemas/`
4. **Implement routes** in `routers/`
5. **Add business logic** in `services/` if complex
6. **Register router** in `main.py`

### Common Development Tasks

**Add new model field:**
1. Update model in `models/`
2. Update schema in `schemas/`
3. Generate migration: `alembic revision --autogenerate -m "Add field"`
4. Run migration: `alembic upgrade head`

**Add new endpoint:**
1. Add route function in appropriate `routers/` file
2. Import and include router in `main.py` if new file
3. Update schemas if needed

## 🧪 Testing

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html
```

### Test Structure

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_account():
    response = client.post("/accounts/", json={
        "name": "Test Account",
        "type": "checking",
        "balance": 1000.0
    })
    assert response.status_code == 200
```

## 🚀 Deployment

### Production Setup

1. **Install production dependencies:**
   ```bash
   pip install gunicorn
   ```

2. **Run with Gunicorn:**
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

3. **Environment variables for production:**
   ```bash
   DEBUG=False
   DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/prod_db
   SECRET_KEY=super-secure-production-key
   CORS_ORIGINS=https://yourdomain.com
   ```

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Health Checks

The API includes health check endpoints:

```bash
# Basic health check
curl http://localhost:8000/health

# Database connectivity check
curl http://localhost:8000/health/db
```

### Performance Monitoring

Consider adding:
- **Prometheus metrics** for monitoring
- **Logging** with structured format
- **Database connection pooling**
- **Redis caching** for frequent queries

## 📝 Notes

### Important Considerations

- **Security:** Always use strong `SECRET_KEY` in production
- **Database:** Use connection pooling for production deployments
- **CORS:** Restrict `CORS_ORIGINS` to your frontend domain in production
- **Rate Limiting:** Consider adding rate limiting for production API
- **Monitoring:** Implement proper logging and monitoring

### Known Limitations

- File uploads are processed in memory (consider streaming for large files)
- LLM processing is synchronous (consider async processing for production)
- No built-in rate limiting (add middleware if needed)

### Contributing

See the main [Contributing Guidelines](../CONTRIBUTING.md) for details on:
- Code style conventions
- Pull request process
- Issue reporting

---

For more information, see the [main README](../README.md) or visit the [frontend documentation](../frontend/README.md).