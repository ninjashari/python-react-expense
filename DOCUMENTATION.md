# 💰 Expense Manager - Complete Documentation

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Material-UI](https://img.shields.io/badge/Material--UI-5.18-007FFF.svg)](https://mui.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A modern, full-stack expense management application designed for personal financial tracking and analysis. Built with React 19 and FastAPI, featuring comprehensive transaction management, intelligent AI-powered imports, and advanced reporting capabilities.

---

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Architecture & Design](#-architecture--design)
- [Development Guide](#-development-guide)
- [API Documentation](#-api-documentation)
- [AI Features & PDF Import](#-ai-features--pdf-import)
- [Usage Guide](#-usage-guide)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 💼 Core Financial Management
- **Multi-Account Support**: Checking, savings, credit cards, cash, investment, and PPF accounts
- **Transaction Tracking**: Income, expenses, and transfers with automatic balance calculations  
- **Credit Card Management**: Track balances, credit limits, utilization, and payment due dates
- **Category & Payee Organization**: Smart categorization with auto-generated unique colors
- **Real-time Balance Updates**: Automatic account balance synchronization across all transactions

### 🤖 AI-Powered Features
- **Smart Import Processing**: AI categorization for CSV, Excel, and PDF files
- **Local LLM Integration**: Offline PDF processing with Ollama (llama3.1, mistral, gemma)
- **Machine Learning Engine**: Continuous learning from user patterns and corrections
- **Intelligent Suggestions**: Context-aware payee and category recommendations
- **Pattern Recognition**: Advanced transaction analysis with confidence scoring

### 📊 Analytics & Reporting
- **Comprehensive Reports**: Summary, category breakdown, payee analysis, monthly trends
- **Advanced Filtering**: Multi-dimensional search across accounts, dates, amounts, and tags
- **Credit Utilization Tracking**: Visual progress bars with health indicators
- **Export Capabilities**: Multiple format support for data portability
- **Financial Insights**: Spending patterns and account performance metrics

### 🔧 Advanced Import System
- **Multi-Format Support**: CSV, Excel (.xlsx/.xls), and PDF with OCR
- **Column Mapping**: Intelligent field detection and manual mapping options
- **Preview & Validation**: Review transactions before committing to database
- **Error Handling**: Comprehensive validation with detailed error reporting
- **Batch Processing**: Efficient handling of large transaction sets

---

## 🛠 Technology Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern, high-performance web framework
- **[PostgreSQL](https://www.postgresql.org/)** - Robust relational database
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - Python SQL toolkit and ORM
- **[Alembic](https://alembic.sqlalchemy.org/)** - Database migration tool
- **[Pydantic](https://pydantic.dev/)** - Data validation using Python type hints
- **[JWT Authentication](https://python-jose.readthedocs.io/)** - Secure token-based auth
- **[Ollama](https://ollama.ai/)** - Local LLM integration for PDF processing
- **[Tesseract OCR](https://tesseract-ocr.github.io/)** - Optical character recognition
- **[pandas](https://pandas.pydata.org/)** - Data manipulation and analysis

### Frontend
- **[React 19](https://reactjs.org/)** - Modern UI library with latest features
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript development
- **[Material-UI v5](https://mui.com/)** - Comprehensive component library
- **[TanStack Query](https://tanstack.com/query)** - Powerful data synchronization
- **[React Router v7](https://reactrouter.com/)** - Declarative routing
- **[React Hook Form](https://react-hook-form.com/)** - Performant forms with easy validation
- **[React Select](https://react-select.com/)** - Flexible select input control
- **[React Dropzone](https://react-dropzone.js.org/)** - File upload with drag & drop

---

## 🚀 Quick Start

### Prerequisites

- **[Node.js](https://nodejs.org/)** v16+ 
- **[Python](https://www.python.org/)** v3.8+
- **[PostgreSQL](https://www.postgresql.org/)** v12+
- **[Git](https://git-scm.com/)** for version control

### Optional Components
- **[Tesseract OCR](https://tesseract-ocr.github.io/)** - For PDF text extraction
- **[Ollama](https://ollama.ai/)** - For local LLM-powered PDF processing

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/python-react-expense.git
cd python-react-expense
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE expense_manager;
CREATE USER expense_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE expense_manager TO expense_user;
```

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file (update with your database credentials)
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start the development server
python -m uvicorn main:app --reload --port 8001
```

🎉 **Backend is now running at:** `http://localhost:8001`  
📚 **API Documentation:** `http://localhost:8001/docs`

### 4. Frontend Setup

```bash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Create environment file (optional - defaults work for local development)
cp .env.example .env

# Start the development server
npm start
```

🎉 **Frontend is now running at:** `http://localhost:3001`

### 5. Optional: Quick Start Script

For convenience, use the start-dev script:

```bash
# Make executable
chmod +x start-dev.sh

# Run both servers
./start-dev.sh
```

---

## ⚙️ Configuration

### Backend Environment Variables (.env)

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost/expense_manager

# JWT Authentication
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Settings
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001

# Optional: PDF LLM Import
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract
```

### Frontend Environment Variables (.env)

```bash
REACT_APP_API_BASE_URL=http://localhost:8001/api
```

---

## 🏗 Architecture & Design

### Project Structure

```
python-react-expense/
├── backend/                 # FastAPI Backend
│   ├── models/             # SQLAlchemy database models
│   ├── schemas/            # Pydantic request/response schemas
│   ├── routers/            # API route handlers
│   ├── services/           # Business logic and AI services
│   ├── utils/              # Helper utilities (auth, colors, slugs)
│   ├── alembic/            # Database migrations
│   ├── main.py             # FastAPI application entry point
│   └── requirements.txt    # Python dependencies
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Main application pages
│   │   ├── contexts/       # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API communication layer
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Frontend utilities
│   ├── public/             # Static assets
│   └── package.json        # Node.js dependencies
└── DOCUMENTATION.md        # This file
```

### Architecture Overview

```
┌─────────────────────┐
│   React Frontend   │
│   (Port 3001)      │
└──────────┬──────────┘
           │ HTTP/REST
           │
┌──────────▼──────────┐
│  FastAPI Backend   │
│   (Port 8001)      │
└──────────┬──────────┘
           │
     ┌─────┴─────┬──────────┬──────────────┐
     │           │          │              │
┌────▼────┐ ┌───▼───┐ ┌───▼────┐   ┌─────▼──────┐
│PostgreSQL│ │Ollama │ │Tesseract│  │Learning    │
│Database  │ │ LLM   │ │  OCR    │  │Engine      │
└──────────┘ └───────┘ └─────────┘  └────────────┘
```

### Database Schema

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `users` | User authentication | JWT-based auth system |
| `accounts` | Financial accounts | Multi-type support, credit card fields, PPF interest rates |
| `transactions` | Financial transactions | Auto-balance updates, transfer handling |
| `categories` | Expense categories | Auto-color generation, slug support |
| `payees` | Transaction counterparties | Smart search, slug support |
| `user_*_patterns` | AI learning data | Pattern recognition, confidence scoring |

### Key Design Patterns

#### Monorepo Structure
The project is organized into `backend` and `frontend` directories, each with its own dependencies and configuration.

#### JWT Authentication
All API endpoints (except login/register) require JWT authentication via `Authorization: Bearer <token>` header.

#### Database Migrations
Schema changes are managed with Alembic:
```bash
cd backend
alembic revision --autogenerate -m "Your migration message"
alembic upgrade head
```

#### Credit Card Logic
**CRITICAL**: Credit card balances represent **debt**:
- **Expenses** increase the balance (adding debt)
- **Income/Payments** decrease the balance (paying down debt)
- **Available Credit** = `credit_limit - balance`

---

## 💻 Development Guide

### For AI Assistants & Developers

#### Getting Started with Development

1. **Backend Development**:
   ```bash
   cd backend
   source venv/bin/activate
   python -m uvicorn main:app --reload --port 8001
   ```

2. **Frontend Development**:
   ```bash
   cd frontend
   npm start  # Runs on http://localhost:3001
   ```

#### Critical Field Naming Conventions

**IMPORTANT**: The application has specific field name mappings:

- **Account Type**: Use `type` field (not `account_type`)
- **Transaction Type**: Use `type` field (not `transaction_type`)
- **Transaction Types**: `['income', 'expense', 'transfer']`
- **Account Types**: `['checking', 'savings', 'credit', 'cash', 'investment', 'ppf']`

#### Backend Development Patterns

**Database Queries**: Always use `joinedload()` for relationships to prevent N+1 queries:

```python
from sqlalchemy.orm import joinedload

query = db.query(Transaction).options(
    joinedload(Transaction.account),
    joinedload(Transaction.to_account),
    joinedload(Transaction.payee),
    joinedload(Transaction.category)
)
```

**Structure**: Follow FastAPI patterns:
- `models/`: SQLAlchemy ORM models
- `schemas/`: Pydantic validation and serialization
- `routers/`: API endpoint definitions
- `services/`: Business logic, especially for AI processing

#### Frontend Development Patterns

**State Management**:
- **Server State**: Use TanStack Query (`useQuery`, `useMutation`)
- **Global UI State**: React Context (`AuthContext`, `ToastContext`)
- **Local State**: React hooks (`useState`, `useReducer`)

**Notifications**: Use the built-in toast system:
```typescript
import { useApiWithToast } from '../hooks/useApiWithToast';

const { showSuccess, showError } = useToast();
showSuccess('Transaction created successfully');
```

**Structure**:
- `pages/`: Top-level components for each route
- `components/`: Reusable UI components
- `services/`: API client and data fetching
- `hooks/`: Custom hooks for shared logic
- `contexts/`: Global state management
- `types/`: TypeScript type definitions

#### Adding New Features

1. **Backend**: Model → Schema → Router → Register in main.py
2. **Frontend**: Type → API service → Component → Route
3. **Test**: Authentication, field names, database constraints
4. **Document**: Update relevant sections of documentation

#### Database Changes

1. Update models in `backend/models/`
2. Create migration: `alembic revision --autogenerate -m "Description"`
3. Apply migration: `alembic upgrade head`
4. Update schemas in `backend/schemas/`
5. Update frontend types in `frontend/src/types/`

### Code Style Guidelines

- **Backend**: Follow FastAPI/SQLAlchemy patterns, use Pydantic schemas
- **Frontend**: Use React hooks, Material-UI components, TypeScript strict mode
- **Clean Code**: Write self-documenting code, avoid unnecessary comments

### Testing

**Frontend**:
```bash
cd frontend
npm test
npm run build  # Check for build errors
```

**Backend**:
```bash
cd backend
pytest  # If test suite is configured
```

---

## 📚 API Documentation

### REST API Endpoints

Full interactive documentation available at `http://localhost:8001/docs` when running the backend.

#### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login, returns JWT token |

All other endpoints require: `Authorization: Bearer <jwt-token>`

#### Core Resources
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/accounts/*` | GET, POST, PUT, DELETE | Account management with balance tracking |
| `/api/transactions/*` | GET, POST, PUT, DELETE | Transaction CRUD with filtering |
| `/api/categories/*` | GET, POST, PUT, DELETE | Category management with color generation |
| `/api/payees/*` | GET, POST, PUT, DELETE | Payee organization and search |

#### Reports & Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/summary` | GET | Financial summary with totals |
| `/api/reports/by-category` | GET | Spending breakdown by category |
| `/api/reports/by-payee` | GET | Transaction analysis by payee |
| `/api/reports/by-account` | GET | Account-wise breakdown |
| `/api/reports/monthly-trend` | GET | Monthly spending trends |

#### Import & AI Features
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/import/csv` | POST | Import CSV files |
| `/api/import/excel` | POST | Import Excel files |
| `/api/import/pdf-ocr` | POST | PDF import with OCR |
| `/api/import/pdf-llm` | POST | AI-powered PDF import |
| `/api/import/pdf-llm/status` | GET | Check LLM system status |
| `/api/import/pdf-llm/preview` | POST | Preview PDF extraction |
| `/api/learning/*` | GET, POST | AI learning system management |

---

## 🤖 AI Features & PDF Import

### Overview

The PDF LLM import feature uses local Large Language Models (via Ollama) to automatically extract transaction data from PDF documents. It supports both text-based and scanned PDFs with OCR fallback.

### Prerequisites

#### 1. Install Dependencies

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

Key dependencies:
- `pymupdf==1.23.8` - PDF text extraction
- `ollama==0.2.1` - LLM integration

#### 2. Install Ollama

**Linux/macOS**:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows**:
Download from: https://ollama.ai/download

**Verify**:
```bash
ollama --version
```

#### 3. Install LLM Models

```bash
# Primary model (recommended for accuracy)
ollama pull llama3.1

# Alternative models
ollama pull mistral  # Balanced speed/accuracy
ollama pull gemma    # Faster processing
```

#### 4. Install Tesseract OCR

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**macOS**:
```bash
brew install tesseract
```

**Windows**:
Download from: https://github.com/UB-Mannheim/tesseract/wiki

### Starting Services

1. **Start Ollama**:
   ```bash
   ollama serve
   ```

2. **Start Backend**:
   ```bash
   cd backend
   source venv/bin/activate
   python -m uvicorn main:app --reload --port 8001
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm start
   ```

### Using PDF Import

#### 1. Upload PDF File
- Navigate to Import page
- Drag and drop or select PDF file
- Supported: Bank statements, credit card bills, receipts

#### 2. Configure Settings
- Select target account
- Choose LLM model (llama3.1 recommended)
- Review PDF analysis

#### 3. Review Extracted Data
- AI extracts structured transaction data
- Review for accuracy
- Edit if needed

#### 4. Import Transactions
- Confirm import
- System auto-creates payees and categories
- Transactions added to your account

### Model Selection

| Model | Accuracy | Speed | Use Case |
|-------|----------|-------|----------|
| llama3.1 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Best for complex statements |
| mistral | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Balanced performance |
| gemma | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Quick processing |

### Performance Tips

1. **PDF Quality**: High-resolution PDFs process better
2. **Text-based PDFs**: Much faster than scanned documents
3. **System Resources**: 8GB+ RAM recommended
4. **Processing Time**: 5-30 seconds per PDF

### Security & Privacy

- **Local Processing**: All LLM processing happens locally
- **No External APIs**: No data sent to external services
- **Temporary Storage**: Extracted text stored in memory only
- **Data Privacy**: Transaction data follows existing security patterns

---

## 📖 Usage Guide

### Getting Started

1. **Create Account**: Register and login
2. **Set Up Accounts**: Add bank accounts, credit cards, etc.
3. **Add Categories**: Create spending categories
4. **Import Data**: Bulk import or add transactions manually
5. **Generate Reports**: Analyze spending patterns

### Core Workflows

#### Account Management

1. Navigate to **Accounts** page
2. Click **"Add Account"**
3. Select account type and fill details:
   - **Checking/Savings**: Name, initial balance, account number
   - **Credit Cards**: Credit limit, bill date, due date
   - **Investment/Cash**: Customize based on type
4. View account details and transaction history

#### Transaction Management

1. Go to **Transactions** page
2. **Add Single Transaction**:
   - Select account, type (income/expense/transfer)
   - Add amount, description, payee, category
   - For transfers: select destination account
3. **Bulk Import**: Use Import feature
4. **Edit**: Inline editing with auto-balance updates
5. **Filter & Search**: Advanced filters for dates, amounts, accounts

#### AI-Powered Import

1. **Upload File**: CSV, Excel, or PDF
2. **Column Mapping**:
   - Auto-detect common patterns
   - Manual mapping if needed
   - Preview before import
3. **AI Processing**:
   - System trains on historical data
   - Suggests categories/payees with confidence scores
   - Auto-applies high-confidence (>60%) suggestions
4. **Review & Import**: Confirm or adjust
5. **Continuous Learning**: AI improves from corrections

---

## 🐛 Troubleshooting

### Common Issues

#### Database Connection
- Ensure PostgreSQL is running
- Check credentials in `.env` file
- Verify database exists and user has permissions

#### Import Module Errors
- Activate virtual environment: `source venv/bin/activate`
- Install requirements: `pip install -r requirements.txt`

#### Port Already in Use
- Backend: Change with `--port 8001` flag
- Frontend: Set `PORT=3001` in environment

#### OCR Not Working
- Install Tesseract system-wide
- Update `TESSERACT_CMD` path in `.env`

#### "Ollama service is not available"
- Ensure Ollama is running: `ollama serve`
- Verify models installed: `ollama list`
- Check default port (11434)

#### "No LLM models available"
- Install model: `ollama pull llama3.1`
- Restart backend after installing

#### Poor PDF Extraction Quality
- Try different LLM model
- Ensure PDF has readable text/financial data
- For scanned docs, improve image quality

### Debug Tips

1. Check browser console for frontend errors
2. Review backend logs for API errors
3. Verify JWT token is being sent with requests
4. Check database constraints match application logic

---

## 🤝 Contributing

Contributions are welcome! Here's how:

### Process

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** Pull Request

### Guidelines

- Follow existing code style
- Add tests for new functionality
- Update documentation
- Ensure all tests pass

---

## 🗺️ Roadmap

### Platform & Infrastructure
- [ ] Mobile App (React Native)
- [ ] Docker Support
- [ ] Cloud Deployment Guides
- [ ] API Rate Limiting
- [ ] Automated Backup Solutions

### Financial Features
- [ ] Budget Management
- [ ] Multi-Currency Support
- [ ] Bank API Integration
- [ ] Investment Tracking
- [ ] Bill Reminders
- [ ] Savings Goals

### AI & Analytics
- [ ] Neural Network Models
- [ ] Real-time Learning
- [ ] Anomaly Detection
- [ ] Predictive Analytics
- [ ] NLP Processing
- [ ] Receipt OCR
- [ ] Voice Interface

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- UI components from [Material-UI](https://mui.com/)
- OCR by [Tesseract](https://tesseract-ocr.github.io/)
- LLM integration via [Ollama](https://ollama.ai/)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Support

- 📫 [Create an issue](https://github.com/yourusername/python-react-expense/issues)
- 💡 [Start a discussion](https://github.com/yourusername/python-react-expense/discussions)
- ⭐ Star this repo if you find it helpful!

---

<div align="center">
  Made with ❤️ for financial clarity
</div>
