# Expense Manager - Developer Guide

This document provides comprehensive information for developers working on this Expense Manager application, with critical patterns, historical context, and best practices.

## Project Overview

A full-stack expense management application featuring comprehensive financial tracking, multi-account support, and AI-powered data import capabilities using local LLMs.

### Current Architecture
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL + Redis
- **Frontend**: React 19 + TypeScript + Material-UI + TanStack Query
- **Database**: PostgreSQL with Alembic migrations
- **Caching**: Redis for backend + optimized TanStack Query for frontend
- **Authentication**: JWT-based auth system
- **AI**: Ollama integration for PDF/document processing

## Quick Start Commands

### Full Stack Setup
```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure database and Redis URLs
alembic upgrade head
python -m uvicorn main:app --reload --port 8001

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env  # Configure API base URL
npm start  # Runs on http://localhost:3001
```

### Essential Services
```bash
# Start Redis (required for backend caching)
redis-server
# Or with Docker: docker run -d --name redis -p 6379:6379 redis:latest

# Start PostgreSQL
sudo systemctl start postgresql
# Or with Docker: docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
```

## Critical Architecture Patterns

### Field Name Consistency ⚠️
**CRITICAL**: The application uses specific field naming conventions:
- **Account Type**: Use `type` field (not `account_type`)
- **Transaction Type**: Use `type` field (not `transaction_type`)
- **Transaction Types**: Database expects `['income', 'expense', 'transfer']`
- **Account Types**: Database expects `['checking', 'savings', 'credit', 'cash', 'investment']`

### Database Performance Requirements ⚠️
**CRITICAL**: Always use `joinedload()` for relationships to prevent N+1 queries:
```python
# Correct approach - loads relationships in single query
query = db.query(Transaction).options(
    joinedload(Transaction.account),
    joinedload(Transaction.to_account),
    joinedload(Transaction.payee),
    joinedload(Transaction.category)
)

# Wrong approach - causes N+1 queries
query = db.query(Transaction).all()  # Will make additional queries for each relationship
```

### Caching Strategy ⚠️
**CRITICAL**: The application implements multi-layer caching:
- **Backend**: Redis caching with automatic invalidation on mutations
- **Frontend**: TanStack Query with optimized cache times
- **Cache Keys**: Use pattern `user:{user_id}:resource:{resource_type}` for user-scoped data
- **Invalidation**: Always invalidate related caches when data changes

## Recent Major Updates

### Balance Recalculation System (Latest)
- **Fixed**: Missing `db.commit()` in balance recalculation functions
- **Fixed**: Variable scope issues in `recalculate_account_balances()` endpoint
- **Added**: Comprehensive cache invalidation after balance updates
- **Added**: Test scripts (`test_recalculation.py`, `debug_recalculation.py`)
- **Performance**: Measured 77% overall API response improvement with caching

### Redis Integration & Performance Optimization
- **Added**: Redis caching service with intelligent invalidation
- **Performance**: 77% improvement in API response times
- **Cache TTL**: 5 minutes for balance data, 15 minutes for reference data
- **Fallback**: Graceful degradation when Redis is unavailable

### AI-Powered Import System
- **PDF Processing**: OCR + LLM integration for statement processing
- **Excel/CSV**: Advanced column mapping with data validation
- **Learning**: AI learns from user corrections for better categorization
- **Preview**: Full data preview before import with error highlighting

### Frontend Architecture Updates
- **React 19**: Upgraded to latest React with concurrent features
- **TanStack Query**: Optimized caching configuration (5x faster page loads)
- **Material-UI 5**: Modern component library with improved accessibility
- **TypeScript**: Strict typing for better developer experience

## API Endpoints

### Authentication
All endpoints except `/api/auth/register` and `/api/auth/login` require JWT token:
```bash
Authorization: Bearer <jwt_token>
```

### Core Endpoints
- **Accounts**: `/api/accounts/` (GET, POST), `/api/accounts/{id}` (GET, PUT, DELETE)  
- **Transactions**: `/api/transactions/` (GET, POST), `/api/transactions/{id}` (GET, PUT, DELETE)
- **Categories**: `/api/categories/` (GET, POST), `/api/categories/{id}` (PUT, DELETE)
- **Payees**: `/api/payees/` (GET, POST), `/api/payees/{id}` (PUT, DELETE)
- **Balance**: `/api/transactions/recalculate-balances` (POST) - Critical for data integrity

### Import Endpoints
- **CSV**: `/api/import/csv` (POST)
- **Excel**: `/api/import/excel` (POST) 
- **PDF OCR**: `/api/import/pdf-ocr` (POST)
- **PDF LLM**: `/api/import/pdf-llm` (POST)
- **LLM Status**: `/api/import/pdf-llm/status` (GET)

### Learning System
- **Suggestions**: `/api/learning/suggestions` (GET)
- **Feedback**: `/api/learning/feedback` (POST)

## Database Schema

### Critical Constraints
- **Transaction types**: `['income', 'expense', 'transfer']` (enforced by CHECK constraint)
- **Account types**: `['checking', 'savings', 'credit', 'cash', 'investment']` (enforced by CHECK constraint)

### Key Relationships
- **Users** ← **Accounts** ← **Transactions**
- **Categories** ← **Transactions** → **Payees**
- **Learning** data tracks AI categorization improvements

## Frontend State Management

### TanStack Query Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Authentication State
```typescript
const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  login: (credentials: LoginData) => Promise<void>;
  logout: () => void;
}>({} as any);
```

### Toast System
```typescript
const { toast } = useToast();
toast.success("Transaction created successfully!");
toast.error("Failed to update account");
```

## Critical Business Logic

### Credit Card Handling ⚠️
Credit card balances represent DEBT:
```typescript
// For credit cards:
const availableCredit = account.credit_limit - account.balance;
const utilizationPercent = (account.balance / account.credit_limit) * 100;

// Balance changes:
// - Expenses (charges): INCREASE balance (more debt)
// - Payments/Income: DECREASE balance (paying down debt)
```

### Balance Recalculation
```python
# Always commit changes and invalidate cache
async def recalculate_subsequent_balances(db: Session, account_id: str, start_date: date):
    # Update balances for all transactions after start_date
    db.commit()  # CRITICAL: Must commit changes
    cache_service.invalidate_pattern(f"user:*:account:{account_id}:*")
```

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

### Cache Invalidation Issues
Always invalidate related caches after mutations:
```python
# After updating account balance
cache_service.invalidate_pattern(f"user:{user_id}:account:{account_id}:*")
cache_service.invalidate_pattern(f"user:{user_id}:transactions:*")
```

### Balance Recalculation Failures
Common causes and fixes:
- **Missing commit**: Always call `db.commit()` after balance updates
- **Cache not cleared**: Invalidate cache after recalculation
- **Variable scope**: Ensure variables are properly initialized in endpoints

## Environment Setup

### Backend Environment Variables (.env)
```env
DATABASE_URL=postgresql://username:password@localhost/expense_manager
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001

# Redis Configuration (Required)
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=900

# AI/LLM Features (Optional)
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=llama3.1
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=.csv,.xlsx,.pdf
```

### Frontend Environment Variables (.env)
```env
REACT_APP_API_BASE_URL=http://localhost:8001/api
REACT_APP_ENABLE_DEBUG=true
```

## Testing & Verification

### Test Scripts
Essential test scripts for verifying functionality:

```bash
# Test balance recalculation
python test_recalculation.py

# Test caching performance
python test_caching.py

# Debug balance calculation issues
python debug_recalculation.py

# Test specific recalculation endpoint
python test_recalculation_endpoint.py
```

### Manual Testing Checklist
1. **Authentication**: Login/logout functionality
2. **Balance Updates**: Create/edit/delete transactions, verify balances
3. **Cache Performance**: Check API response times with/without cache
4. **Import System**: Test CSV/Excel/PDF import with validation
5. **Credit Cards**: Verify debt logic and utilization calculations
6. **Multi-Account**: Test transfers between accounts

## Documentation References

- **Main Setup Guide**: [README.md](../README.md)
- **Backend API**: [backend/README.md](../backend/README.md)  
- **Frontend Guide**: [frontend/README.md](../frontend/README.md)
- **Caching Details**: [CACHING_GUIDE.md](../CACHING_GUIDE.md)
- **PDF Processing**: [PDF_LLM_SETUP.md](../PDF_LLM_SETUP.md)

## Historical Context

This application has evolved through several major iterations:
1. **MVP** (2024): Basic transaction tracking
2. **Credit Card Support** (2024): Added debt tracking logic
3. **Import System** (2024): CSV/Excel import with AI categorization
4. **PDF Processing** (2024): OCR + LLM integration
5. **Performance Optimization** (2025): Redis caching implementation
6. **Balance Recalculation** (2025): Robust balance management system

Each iteration maintained backward compatibility while adding new capabilities. The current version represents a mature, production-ready financial management system with enterprise-grade caching and AI integration.

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