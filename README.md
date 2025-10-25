# 💰 Expense Manager

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Material-UI](https://img.shields.io/badge/Material--UI-5.18-007FFF.svg)](https://mui.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A modern, full-stack expense management application designed for personal financial tracking and analysis. Built with React 19 and FastAPI, featuring comprehensive transaction management, intelligent AI-powered imports, high-performance caching, and advanced reporting capabilities.

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Performance](#-performance)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 💼 Core Financial Management
- **Multi-Account Support**: Checking, savings, credit cards, cash, investment, and PPF accounts
- **Transaction Tracking**: Income, expenses, and transfers with automatic balance calculations  
- **Credit Card Management**: Track balances, credit limits, utilization, and payment due dates
- **Category & Payee Organization**: Smart categorization with auto-generated unique colors
- **Real-time Balance Updates**: Automatic account balance synchronization across all transactions
- **Balance Recalculation**: Built-in tools to fix and maintain data integrity

### 🤖 AI-Powered Features
- **Smart Import Processing**: AI categorization for CSV, Excel, and PDF files
- **Local LLM Integration**: Offline PDF processing with Ollama (llama3.1, mistral, gemma)
- **Machine Learning Engine**: Continuous learning from user patterns and corrections
- **Intelligent Suggestions**: Context-aware payee and category recommendations
- **Pattern Recognition**: Advanced transaction analysis with confidence scoring
- **Spending Insights**: AI-powered spending analysis and trend forecasting

### 📊 Analytics & Reporting
- **Comprehensive Reports**: Summary, category breakdown, payee analysis, monthly trends
- **Advanced Filtering**: Multi-dimensional search across accounts, dates, amounts, and tags
- **Credit Utilization Tracking**: Visual progress bars with health indicators
- **Export Capabilities**: Multiple format support for data portability
- **Financial Insights**: Spending patterns and account performance metrics
- **Learning Dashboard**: AI model performance and suggestion accuracy tracking

### 🔧 Advanced Import System
- **Multi-Format Support**: CSV, Excel (.xlsx/.xls), and PDF with OCR
- **Column Mapping**: Intelligent field detection and manual mapping options
- **Preview & Validation**: Review transactions before committing to database
- **Error Handling**: Comprehensive validation with detailed error reporting
- **Batch Processing**: Efficient handling of large transaction sets
- **LLM-Powered PDF Analysis**: Advanced AI processing for unstructured PDF data

### ⚡ Performance Optimizations
- **Frontend Caching**: TanStack Query frontend caching for optimal user experience
- **Smart Query Management**: Automatic query invalidation on data mutations
- **Optimized Queries**: Eager loading with SQLAlchemy for reduced N+1 queries
- **Background Prefetching**: Proactive data loading for faster user experience
- **Automatic Bulk Operations**: Streamlined bulk editing with instant activation

### 🔧 User Experience Features
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Themes**: User preference-based theme switching
- **Real-time Notifications**: Toast notifications for all user actions
- **Bulk Operations**: Multi-select with automatic bulk edit mode
- **Advanced Search**: Full-text search across transactions with filters
- **Data Export/Import**: Comprehensive backup and restore capabilities

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
- **[TanStack Query](https://tanstack.com/query)** - Optimized data synchronization with intelligent caching
- **[React Router v7](https://reactrouter.com/)** - Declarative routing
- **[React Hook Form](https://react-hook-form.com/)** - Performant forms with easy validation
- **[React Select](https://react-select.com/)** - Flexible select input control
- **[React Dropzone](https://react-dropzone.js.org/)** - File upload with drag & drop

### Development & Deployment
- **[Docker](https://www.docker.com/)** - Containerization (optional)
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD automation
- **[ESLint](https://eslint.org/)** - Code linting and formatting
- **[Prettier](https://prettier.io/)** - Code formatting
- **[Jest](https://jestjs.io/)** - Testing framework

## 🚀 Quick Start

### Prerequisites

- **[Node.js](https://nodejs.org/)** v16+ 
- **[Python](https://www.python.org/)** v3.8+
- **[PostgreSQL](https://www.postgresql.org/)** v12+
- **[Git](https://git-scm.com/)** for version control

### Optional Components
- **[Tesseract OCR](https://tesseract-ocr.github.io/)** - For PDF text extraction
- **[Ollama](https://ollama.ai/)** - For local LLM-powered PDF processing

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

### 4. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file from example
cp .env.example .env

# Update .env with your database credentials:
# DATABASE_URL=postgresql://expense_user:your_password@localhost:5432/expense_manager

# Run database migrations
alembic upgrade head

# Start the development server
python -m uvicorn main:app --reload --port 8001
```

🎉 **Backend is now running at:** `http://localhost:8001`  
📚 **API Documentation:** `http://localhost:8001/docs`

### 5. Frontend Setup

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

### 6. Optional Components

#### PDF Processing with OCR

For PDF import functionality, install Tesseract OCR:

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
- Download from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)

#### LLM Setup for Advanced PDF Processing

For AI-powered PDF analysis, install Ollama:

For AI-powered PDF processing with local LLMs:

```bash
# Install and setup Ollama (new installation)
./setup_ollama.sh

# Or if Ollama is already installed
./setup_ollama_existing.sh
```

See [PDF_LLM_SETUP.md](PDF_LLM_SETUP.md) for detailed LLM configuration instructions.

## 📚 API Documentation

### REST API Endpoints

The application provides a comprehensive REST API. Full interactive documentation is available at `http://localhost:8001/docs` when running the backend.

#### Core Resources
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/auth/*` | `POST` | User registration, login, and authentication |
| `/api/accounts/*` | `GET, POST, PUT, DELETE` | Account management with balance tracking |
| `/api/transactions/*` | `GET, POST, PUT, DELETE` | Transaction CRUD with filtering and bulk operations |
| `/api/categories/*` | `GET, POST, PUT, DELETE` | Category management with auto-generated colors |
| `/api/payees/*` | `GET, POST, PUT, DELETE` | Payee organization with smart search |

#### Advanced Features
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/transactions/reports/*` | `GET` | Financial analytics and comprehensive reporting |
| `/api/import/*` | `POST, GET` | Multi-format file import with AI processing |
| `/api/learning/*` | `GET, POST` | AI learning system and smart suggestions |
| `/api/transactions/recalculate-balances/*` | `POST` | Balance integrity and recalculation tools |

#### Special Endpoints
| Endpoint | Description |
|----------|-------------|
| `/api/learning/smart-suggestions` | AI-powered transaction suggestions |
| `/api/learning/spending-insights` | Advanced spending pattern analysis |
| `/api/learning/trend-forecast` | Predictive financial forecasting |
| `/api/import/pdf-llm/*` | LLM-powered PDF processing |
| `/api/transactions/bulk-update` | Bulk transaction operations |

### Authentication

All endpoints (except registration/login) require JWT authentication:

```bash
Authorization: Bearer <your-jwt-token>
```

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

Error responses:
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

## 📖 Usage Guide

### Getting Started
1. **Create Account**: Register and login to access the application
2. **Set Up Accounts**: Add your bank accounts, credit cards, and other financial accounts
3. **Add Categories**: Create spending categories (groceries, utilities, entertainment, etc.)
4. **Import Data**: Bulk import your transaction history or add transactions manually
5. **Generate Reports**: Analyze your spending patterns and financial trends

### Core Workflows

<details>
<summary><strong>Account Management</strong></summary>

1. Navigate to **Accounts** page
2. Click **"Add Account"** 
3. Select account type and fill details:
   - **Checking/Savings**: Name, initial balance, account number
   - **Credit Cards**: Credit limit, bill generation date, payment due date
   - **Investment/Cash**: Customize based on account type
4. **View Account Details**: Click any account to see transaction history and balance trends

</details>

<details>
<summary><strong>Transaction Management</strong></summary>

1. Go to **Transactions** page
2. **Add Single Transaction**: 
   - Select account, type (income/expense/transfer)
   - Add amount, description, payee, and category
   - For transfers: select destination account
3. **Bulk Import**: Use Import feature for CSV/Excel/PDF files
4. **Edit Transactions**: Inline editing with automatic balance updates
5. **Filter & Search**: Use advanced filters for date ranges, amounts, accounts

</details>

<details>
<summary><strong>AI-Powered Import</strong></summary>

1. **Upload File**: Drag & drop or select CSV, Excel, or PDF files
2. **Column Mapping**: 
   - System auto-detects common patterns
   - Manually map columns if needed
   - Preview data before import
3. **AI Processing**: 
   - System trains on your historical data
   - Suggests categories and payees with confidence scores
   - Auto-applies high-confidence suggestions (>60%)
4. **Review & Import**: Confirm suggestions or make manual adjustments
5. **Continuous Learning**: AI improves from your corrections

</details>

<details>
<summary><strong>Advanced PDF Processing</strong></summary>

**Prerequisites**: Install Ollama and download models (see [LLM Setup](#6-llm-setup-optional))

1. **Upload PDF**: Bank statements, credit card bills, receipts
2. **Processing Options**:
   - **OCR Mode**: Extract text using Tesseract
   - **LLM Mode**: AI-powered transaction extraction
3. **Model Selection**: Choose llama3.1 (accuracy), mistral (balanced), or gemma (speed)
4. **Review Results**: AI extracts structured transaction data
5. **Import**: Confirm and import parsed transactions

</details>

## 🧪 Development

### Development Environment Setup

**Backend Development:**
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8001
```

**Frontend Development:**
```bash
cd frontend
npm start  # Runs on http://localhost:3001
```

**Both Servers:**
```bash
./start-dev.sh    # Linux/macOS
./start-dev.bat   # Windows
```

### Running Tests

**Performance Tests:**
```bash
# Test balance recalculation functionality  
python test_recalculation.py
```

**Frontend Tests:**
```bash
cd frontend
npm test
```

**Backend Tests:**
```bash
cd backend
pytest  # If test suite is configured
```

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd backend
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

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
│   │   ├── pages/          # Main application pages (Dashboard, Transactions, etc.)
│   │   ├── contexts/       # React context providers (Auth, Toast)
│   │   ├── hooks/          # Custom React hooks (API, Learning, Notifications)
│   │   ├── services/       # API communication layer
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Frontend utilities
│   ├── public/             # Static assets
│   └── package.json        # Node.js dependencies
├── CLAUDE.md               # Developer documentation
├── PDF_LLM_SETUP.md       # LLM setup instructions
├── test_recalculation.py   # Balance recalculation tests
└── README.md               # This file
```

### Architecture Overview

```mermaid
graph TD
    A[React Frontend] -->|HTTP/REST API| B[FastAPI Backend]
    B -->|SQLAlchemy ORM| C[PostgreSQL Database]
    B -->|File Processing| D[Import Services]
    D -->|OCR| E[Tesseract]
    D -->|AI Processing| F[Ollama LLM]
    B -->|ML Training| G[Learning Engine]
    G -->|Pattern Analysis| H[User Behavior Data]
    A -->|Real-time Updates| J[Toast Notifications]
```

### Database Schema
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `users` | User authentication | JWT-based auth system |
| `accounts` | Financial accounts | Multi-type support, balance tracking, credit limits |
| `transactions` | Financial transactions | Auto-balance calculation, bulk operations, recalculation tools |
| `categories` | Expense categories | Auto-color generation, AI suggestions |
| `payees` | Transaction counterparties | Smart search, learning integration |
| `user_*_patterns` | AI learning data | Pattern recognition, confidence scoring, trend analysis |

### Key Development Features
- **Hot Reloading**: Automatic server restart on code changes
- **Type Safety**: Full TypeScript coverage in frontend
- **API Documentation**: Auto-generated Swagger UI at `/docs`
- **Database Migrations**: Alembic for schema versioning
- **AI Integration**: Local LLM processing with Ollama
- **Balance Integrity**: Automated recalculation and validation tools

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

### Contributing Process
1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request with a clear description

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting PR

### Development Resources
- **[CLAUDE.md](CLAUDE.md)** - Complete development guide and architecture patterns
- **[Backend README](backend/README.md)** - Backend-specific setup and API details  
- **[Frontend README](frontend/README.md)** - Frontend development and component guide

## ⚡ Performance

This application is optimized for handling large datasets with efficient data management:

### Frontend Optimization
- **TanStack Query**: Efficient data fetching and state management
- **Query deduplication**: Prevents duplicate requests
- **Background refetching**: Keeps data fresh automatically
- **Automatic bulk edit mode**: Improved user workflow for multiple operations

### Balance Recalculation System
- **Data integrity tools**: Built-in balance recalculation for maintenance
- **Automatic corrections**: Smart detection and fixing of balance inconsistencies  
- **Audit trails**: Detailed reporting of balance corrections

```

### Testing Performance
```bash
# Test balance recalculation functionality
python test_recalculation.py
```

## ⚙️ Configuration

### Backend (.env)
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost/expense_manager

# Security Settings
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Settings
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001

# Optional: PDF LLM Import
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract

# Optional: Development Settings
DEBUG=True
```

### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=http://localhost:8001/api
```

### Quick Setup Scripts
The project includes convenient setup scripts:

```bash
# Setup Ollama for LLM features (if needed)
./setup_ollama.sh

# Start both frontend and backend
./start-dev.sh    # Linux/macOS
./start-dev.bat   # Windows
```

## 🐛 Troubleshooting

<details>
<summary>Common Issues</summary>

### Database Connection Issues
- Ensure PostgreSQL is running
- Check database credentials in `.env` file
- Verify database exists and user has permissions

### Import Module Errors
- Activate virtual environment: `source venv/bin/activate`
- Install requirements: `pip install -r requirements.txt`

### Port Already in Use
- Backend: Change port with `--port 8001` flag
- Frontend: Set `PORT=3001` in environment or use different terminal

### OCR Not Working
- Install Tesseract OCR system-wide
- Update `TESSERACT_CMD` path in `.env` file

</details>

## 🗺️ Roadmap

### Platform & Infrastructure
- [ ] **Mobile App**: React Native companion app
- [ ] **Docker Support**: Containerized deployment
- [ ] **Cloud Integration**: AWS/GCP deployment guides
- [ ] **API Rate Limiting**: Enhanced security and performance
- [ ] **Backup & Restore**: Automated data backup solutions

### Financial Features  
- [ ] **Budget Management**: Set and track spending budgets
- [ ] **Multi-Currency**: Support for international transactions
- [ ] **Bank Integration**: Direct API connections to financial institutions
- [ ] **Investment Tracking**: Portfolio management and performance analytics
- [ ] **Bill Reminders**: Automated payment due date notifications
- [ ] **Goal Setting**: Savings targets and progress tracking

### AI & Analytics
- [ ] **Enhanced ML Models**: Neural networks and ensemble methods  
- [ ] **Real-time Learning**: Continuous model updates without imports
- [ ] **Anomaly Detection**: Identify unusual spending patterns
- [ ] **Predictive Analytics**: Forecast spending and budget recommendations
- [ ] **NLP Processing**: Advanced transaction description analysis
- [ ] **Receipt OCR**: Computer vision for receipt scanning
- [ ] **Voice Interface**: Voice-powered transaction entry

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- UI components from [Material-UI](https://mui.com/)
- OCR powered by [Tesseract](https://tesseract-ocr.github.io/)
- Local LLM integration via [Ollama](https://ollama.ai/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- 📫 Create an [issue](https://github.com/yourusername/python-react-expense/issues) for bug reports
- 💡 Start a [discussion](https://github.com/yourusername/python-react-expense/discussions) for feature requests  
- ⭐ Star this repo if you find it helpful!

## 🔗 Related Documentation

- **[CACHING_GUIDE.md](CACHING_GUIDE.md)** - Comprehensive caching setup and performance optimization guide
- **[CLAUDE.md](CLAUDE.md)** - Developer documentation and architecture patterns  
- **[PDF_LLM_SETUP.md](PDF_LLM_SETUP.md)** - Local LLM setup instructions for AI-powered PDF processing
- **[Backend README](backend/README.md)** - Backend-specific setup, API details, and development guide
- **[Frontend README](frontend/README.md)** - Frontend development, component guide, and UI patterns
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - AI coding assistant guidelines for this project

---

<div align="center">
  Made with ❤️ by developers, for financial clarity
</div>

<!-- SCREENSHOTS START -->
## 📸 Application Screenshots

<div align="center">
  <em>Experience the intuitive interface of our comprehensive expense management solution</em>
</div>

<br>

### 🏠 Dashboard Overview
The main dashboard provides a comprehensive view of your financial health with account summaries, recent transactions, and spending insights.

<details>
<summary>View Dashboard Screenshot</summary>

![Dashboard](./screenshots/dashboard.png)

</details>

### 💳 Account Management
Manage all your financial accounts including checking, savings, credit cards, and investment accounts with real-time balance tracking.

<details>
<summary>View Accounts Screenshot</summary>

![Accounts](./screenshots/accounts.png)

</details>

### 📊 Transaction History
Track and categorize all your financial transactions with advanced filtering, search, and bulk editing capabilities.

<details>
<summary>View Transactions Screenshot</summary>

![Transactions](./screenshots/transactions.png)

</details>

### 📈 Reports & Analytics
Generate detailed financial reports with customizable filters and date ranges to understand your spending patterns.

<details>
<summary>View Reports Screenshot</summary>

![Reports](./screenshots/reports.png)

</details>

### 🏪 Payee Management
Organize and manage all your payees with color coding and automatic transaction categorization.

<details>
<summary>View Payees Screenshot</summary>

![Payees](./screenshots/payees.png)

</details>

### 🏷️ Category Organization
Create and manage expense categories with visual color coding for better transaction organization.

<details>
<summary>View Categories Screenshot</summary>

![Categories](./screenshots/categories.png)

</details>

### 📥 Data Import
Import transactions from various sources including CSV, Excel, and PDF files with intelligent column mapping.

<details>
<summary>View Import Screenshot</summary>

![Import Data](./screenshots/import.png)

</details>

### 💾 Backup & Export
Export your financial data in multiple formats and manage backups to keep your information secure.

<details>
<summary>View Backup Screenshot</summary>

![Backup & Export](./screenshots/backup.png)

</details>

### 🧠 Learning Dashboard
AI-powered insights help you learn from your spending patterns and improve your financial decisions.

<details>
<summary>View Learning Screenshot</summary>

![Learning Dashboard](./screenshots/learning.png)

</details>

### 🔍 Advanced Insights
Deep analytics and trends provide detailed insights into your financial behavior and spending patterns.

<details>
<summary>View Insights Screenshot</summary>

![Advanced Insights](./screenshots/insights.png)

</details>

---

<div align="center">
  <strong>💡 Tip:</strong> All screenshots are automatically generated using our Puppeteer automation script.<br>
  Run <code>npm run screenshot</code> to capture fresh screenshots with real data.
</div>

<!-- SCREENSHOTS END -->
