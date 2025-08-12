# Expense Manager - Claude Code Documentation

This document provides comprehensive information for future Claude Code instances working on this Expense Manager application.

## Project Overview

A full-stack expense management application with a FastAPI backend and React TypeScript frontend, designed for personal financial tracking and reporting.

### Architecture
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React 19 + TypeScript + Material-UI
- **Database**: PostgreSQL with Alembic migrations
- **Authentication**: JWT-based auth system

## Quick Start Commands

### Backend Development
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python -m uvicorn main:app --reload --port 8001
```

### Frontend Development  
```bash
cd frontend
npm start  # Runs on http://localhost:3001
```

### Database Operations
```bash
cd backend
alembic upgrade head  # Apply migrations
alembic revision --autogenerate -m "Description"  # Create migration
```

## Common Development Tasks

### Build and Lint Commands
- **Frontend**: `npm run build`, `npm test`
- **Backend**: No specific lint/build commands configured

### Running the Full Stack
1. Start PostgreSQL database
2. Backend: `cd backend && python -m uvicorn main:app --reload --port 8001`
3. Frontend: `cd frontend && npm start`

## Critical Architecture Patterns

### Field Name Consistency
**CRITICAL**: The application has specific field name mappings between frontend/backend/database:

- **Account Type**: Use `type` field (not `account_type`)
- **Transaction Type**: Use `type` field (not `transaction_type`)
- **Transaction Types**: Database expects `['income', 'expense', 'transfer']` (not `['deposit', 'withdrawal', 'transfer']`)
- **Account Types**: Database expects `['checking', 'savings', 'credit', 'cash', 'investment']`

### Credit Card Business Logic
Credit cards have special balance handling:
- **Balance represents debt** (amount owed, not available funds)
- **Income/Payments**: Reduce balance (pay down debt)
- **Expenses/Charges**: Increase balance (add to debt)
- **Available Credit**: `credit_limit - balance`
- **Credit Utilization**: `(balance / credit_limit) * 100`

### Database Relationships
Backend queries MUST use `joinedload()` for relationships:
```python
query = db.query(Transaction).options(
    joinedload(Transaction.account),
    joinedload(Transaction.to_account),
    joinedload(Transaction.payee),
    joinedload(Transaction.category)
)
```

## Recent Major Changes

### Completed Fixes (2025-08-01)
1. **Authentication Integration**: Added JWT auth to all transaction endpoints
2. **Field Name Alignment**: Fixed `account_type` → `type` and `transaction_type` → `type` throughout
3. **Database Constraint Compliance**: Updated transaction types to match database constraints
4. **Credit Card Balance Logic**: Implemented proper debt vs. available credit calculations
5. **Credit Utilization Display**: Added progress bars with color coding for credit health
6. **Dashboard NaN Fix**: Added proper Number() conversion for balance calculations
7. **Transaction Relationship Loading**: Fixed missing payee/category data with joinedload()
8. **Comprehensive Import System**: Added full CSV/Excel import with column mapping, preview, and validation
9. **Enhanced Color Generation**: Implemented Material Design color palette with smart contrast detection
10. **Slug Support**: Added URL-friendly slug fields to categories and payees for better organization

### Key Files Recently Modified
- `backend/routers/transactions.py`: Authentication, balance updates, relationship loading
- `backend/routers/import_data.py`: Comprehensive import system with file processing
- `backend/utils/color_generator.py`: Material Design color palette and smart generation  
- `backend/utils/slug.py`: URL-friendly slug generation utility
- `frontend/src/pages/Import.tsx`: Multi-step import UI with drag-drop and preview
- `frontend/src/types/index.ts`: Field name corrections, type alignments
- `frontend/src/pages/Accounts.tsx`: Credit utilization display, balance logic
- `frontend/src/pages/Dashboard.tsx`: NaN fix for total balance calculation

## Database Schema Notes

### Accounts Table
- `type` field: CHECK constraint for `['checking', 'savings', 'credit', 'cash', 'investment']`
- Credit card fields: `credit_limit`, `bill_generation_date`, `payment_due_date`

### Transactions Table  
- `type` field: CHECK constraint for `['income', 'expense', 'transfer']`
- Required relationships: `account_id`, `user_id`
- Optional relationships: `to_account_id`, `category_id`, `payee_id`

## API Endpoints

### Authentication Required
All endpoints except `/auth/register` and `/auth/login` require JWT token in Authorization header.

### Key Endpoints
- **Accounts**: `/accounts/` (GET, POST), `/accounts/{id}` (GET, PUT, DELETE)
- **Transactions**: `/transactions/` (GET, POST), `/transactions/{id}` (GET, PUT, DELETE)
- **Categories**: `/categories/` (GET, POST), `/categories/{id}` (PUT, DELETE)
- **Payees**: `/payees/` (GET, POST), `/payees/{id}` (PUT, DELETE)
- **Reports**: `/reports/summary`, `/reports/by-category`, `/reports/by-payee`, `/reports/by-account`, `/reports/monthly-trend`
- **Import**: `/import/csv`, `/import/excel`, `/import/pdf-ocr`, `/import/pdf-llm`, `/import/pdf-llm/status`, `/import/pdf-llm/preview`, `/import/column-mapping/{file_type}`

## Frontend State Management

### Toast Notification System
Comprehensive toast system implemented with:
- `ToastContext`: Centralized toast state management
- `useApiWithToast`: Hooks for API calls with automatic success/error toasts
- `useUserInteractionNotifications`: User interaction feedback
- Material-UI Snackbar components with different severity levels

### Data Fetching
- **TanStack Query**: Server state management and caching
- **Optimistic Updates**: Immediate UI updates with server reconciliation
- **Error Handling**: Automatic retry logic and user feedback

## Common Issues & Solutions

### Type Conversion Errors
Always use `Number()` when converting string inputs to numbers:
```typescript
balance: Number(data.balance) || 0
```

### Missing Relationship Data
Backend: Always use `joinedload()` for nested data:
```python
.options(joinedload(Transaction.payee))
```

### Credit Card Logic
Remember credit cards track debt, not available funds:
```typescript
availableCredit = creditLimit - balance  // balance is debt
utilizationPercent = (balance / creditLimit) * 100
```

### Database Constraint Violations
Check enum values match database constraints before saving.

## Environment Setup

### Backend Environment Variables (.env)
```env
DATABASE_URL=postgresql://username:password@localhost/expense_manager
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,https://yourdomain.com

# PDF LLM Import (Optional)
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract
```

### Frontend Environment Variables (.env)
```env
REACT_APP_API_BASE_URL=http://localhost:8001/api
```

## Testing

### Backend Testing
```bash
cd backend
pip install pytest pytest-asyncio
pytest  # If test suite exists
```

### Frontend Testing
```bash
cd frontend
npm test
```

## Deployment Notes

### Production Backend
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Production Frontend
```bash
npm run build  # Creates optimized build in build/ folder
```

## Development Guidelines

### Code Style
- **Backend**: Follow FastAPI/SQLAlchemy patterns, use Pydantic schemas
- **Frontend**: Use React hooks, Material-UI components, TypeScript strict mode
- **No Comments**: Avoid adding comments unless explicitly requested

### Database Changes
1. Update models in `backend/models/`
2. Create migration: `alembic revision --autogenerate -m "Description"`
3. Apply migration: `alembic upgrade head`
4. Update schemas in `backend/schemas/`
5. Update frontend types in `frontend/src/types/`

### Adding New Features
1. Backend: Model → Schema → Router → Register in main.py
2. Frontend: Type → API service → Component → Route
3. Test both authentication and field name consistency
4. Verify database constraint compliance

## File Structure

### Backend (`backend/`)
- `main.py`: FastAPI app initialization
- `database.py`: Database configuration  
- `models/`: SQLAlchemy models
- `schemas/`: Pydantic request/response schemas
- `routers/`: FastAPI route handlers
- `utils/`: Helper functions (auth, color generation)
- `alembic/`: Database migrations

### Frontend (`frontend/src/`)
- `App.tsx`: Main app component with routing
- `components/`: Reusable UI components
- `contexts/`: React contexts (Auth, Toast)
- `hooks/`: Custom hooks for API calls and notifications
- `pages/`: Main application pages
- `services/`: API service layer
- `types/`: TypeScript type definitions
- `utils/`: Utility functions (formatters)

## PDF LLM Import Feature

### Overview
The PDF LLM import feature uses local Large Language Models (via Ollama) to automatically extract transaction data from PDF documents. It supports both text-based and scanned PDFs with OCR fallback.

### Architecture
- **PDF Processing**: PyMuPDF for text extraction, Tesseract for OCR
- **LLM Integration**: Local Ollama server with multiple model support
- **Backend Services**: `services/pdf_llm_processor.py`, `services/llm_service.py`, `services/pdf_processor.py`
- **Frontend Components**: `PDFLLMStep.tsx` for configuration UI

### Setup Requirements
1. **Install Ollama**: Run `./setup_ollama.sh` or follow `PDF_LLM_SETUP.md`
2. **Install Dependencies**: `pip install pymupdf ollama` (already in requirements.txt)
3. **Download Models**: `ollama pull llama3.1` (recommended)

### API Endpoints
- `GET /import/pdf-llm/status` - Check system status
- `POST /import/pdf-llm/preview` - Preview extraction without import
- `POST /import/pdf-llm` - Full import with LLM processing

### Usage Flow
1. Upload PDF file
2. System detects if text extraction or OCR is needed
3. LLM extracts structured transaction data
4. User reviews and confirms import

### Important Notes
- **Local Processing**: All LLM processing happens locally via Ollama
- **No External APIs**: No data sent to external services
- **Model Selection**: llama3.1 (best accuracy), mistral (balanced), gemma (fast)
- **Performance**: Processing takes 5-30 seconds depending on PDF size and model

This documentation should be updated as the application evolves. Always verify field names, database constraints, and authentication requirements when making changes.