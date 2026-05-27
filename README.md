# 💰 Expense Manager# 💰 Expense Manager



[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)

[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)

[![Material-UI](https://img.shields.io/badge/Material--UI-5.18-007FFF.svg)](https://mui.com/)

A modern, full-stack expense management application with AI-powered features for personal financial tracking and analysis.[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)



## ✨ Key FeaturesA modern, full-stack expense management application designed for personal financial tracking and analysis. Built with React 19 and FastAPI, featuring comprehensive transaction management, intelligent AI-powered imports, and advanced reporting capabilities.



- 💼 **Multi-Account Support** - Track checking, savings, credit cards, investments## 📋 Table of Contents

- 📊 **Smart Analytics** - Comprehensive reports and spending insights

- 🤖 **AI-Powered Import** - Automatic categorization from CSV, Excel, and PDF files- [Features](#-features)

- 🔒 **Secure & Private** - JWT authentication with local LLM processing- [Technology Stack](#-technology-stack)

- 📱 **Modern UI** - React 19 with Material-UI components- [Quick Start](#-quick-start)

- [Installation](#-installation)

## 🚀 Quick Start- [Configuration](#-configuration)

- [Usage](#-usage)

### Prerequisites- [API Documentation](#-api-documentation)

- Node.js 16+- [Development](#-development)

- Python 3.8+- [Contributing](#-contributing)

- PostgreSQL 12+- [License](#-license)



### Installation## ✨ Features



```bash### 💼 Core Financial Management

# Clone repository- **Multi-Account Support**: Checking, savings, credit cards, cash, investment, and PPF accounts

git clone https://github.com/yourusername/python-react-expense.git- **Transaction Tracking**: Income, expenses, and transfers with automatic balance calculations  

cd python-react-expense- **Credit Card Management**: Track balances, credit limits, utilization, and payment due dates

- **Category & Payee Organization**: Smart categorization with auto-generated unique colors

# Backend setup- **Real-time Balance Updates**: Automatic account balance synchronization across all transactions

cd backend

python -m venv venv### 🤖 AI-Powered Features

source venv/bin/activate- **Smart Import Processing**: AI categorization for CSV, Excel, and PDF files

pip install -r requirements.txt- **Local LLM Integration**: Offline PDF processing with Ollama (llama3.1, mistral, gemma)

cp .env.example .env  # Configure your database- **Machine Learning Engine**: Continuous learning from user patterns and corrections

alembic upgrade head- **Intelligent Suggestions**: Context-aware payee and category recommendations

python -m uvicorn main:app --reload --port 8001- **Pattern Recognition**: Advanced transaction analysis with confidence scoring



# Frontend setup (in new terminal)### 📊 Analytics & Reporting

cd frontend- **Comprehensive Reports**: Summary, category breakdown, payee analysis, monthly trends

npm install- **Advanced Filtering**: Multi-dimensional search across accounts, dates, amounts, and tags

npm start- **Credit Utilization Tracking**: Visual progress bars with health indicators

```- **Export Capabilities**: Multiple format support for data portability

- **Financial Insights**: Spending patterns and account performance metrics

**Or use the convenience script:**

```bash### 🔧 Advanced Import System

./start-dev.sh- **Multi-Format Support**: CSV, Excel (.xlsx/.xls), and PDF with OCR

```- **Column Mapping**: Intelligent field detection and manual mapping options

- **Preview & Validation**: Review transactions before committing to database

🎉 **Access the app at:** `http://localhost:3001`- **Error Handling**: Comprehensive validation with detailed error reporting

- **Batch Processing**: Efficient handling of large transaction sets

## 📚 Documentation

## 🛠 Technology Stack

For complete documentation including:

- Detailed installation instructions### Backend

- Architecture and design patterns- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern, high-performance web framework

- API reference- **[PostgreSQL](https://www.postgresql.org/)** - Robust relational database

- AI features and PDF import setup- **[SQLAlchemy](https://www.sqlalchemy.org/)** - Python SQL toolkit and ORM

- Development guidelines- **[Alembic](https://alembic.sqlalchemy.org/)** - Database migration tool

- Troubleshooting- **[Pydantic](https://pydantic.dev/)** - Data validation using Python type hints

- **[JWT Authentication](https://python-jose.readthedocs.io/)** - Secure token-based auth

**👉 See [DOCUMENTATION.md](DOCUMENTATION.md)**- **[Ollama](https://ollama.ai/)** - Local LLM integration for PDF processing

- **[Tesseract OCR](https://tesseract-ocr.github.io/)** - Optical character recognition

## 🛠 Tech Stack- **[pandas](https://pandas.pydata.org/)** - Data manipulation and analysis



**Backend:** FastAPI, PostgreSQL, SQLAlchemy, Alembic, Ollama  ### Frontend

**Frontend:** React 19, TypeScript, Material-UI, TanStack Query  - **[React 19](https://reactjs.org/)** - Modern UI library with latest features

**AI:** Local LLM processing with Ollama, Tesseract OCR- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript development

- **[Material-UI v5](https://mui.com/)** - Comprehensive component library

## 📦 Project Structure- **[TanStack Query](https://tanstack.com/query)** - Powerful data synchronization

- **[React Router v7](https://reactrouter.com/)** - Declarative routing

```- **[React Hook Form](https://react-hook-form.com/)** - Performant forms with easy validation

python-react-expense/- **[React Select](https://react-select.com/)** - Flexible select input control

├── backend/          # FastAPI backend- **[React Dropzone](https://react-dropzone.js.org/)** - File upload with drag & drop

│   ├── models/       # Database models

│   ├── routers/      # API endpoints## 🚀 Quick Start

│   └── services/     # Business logic & AI

├── frontend/         # React frontend### Prerequisites

│   ├── src/

│   │   ├── pages/    # Main pages- **[Node.js](https://nodejs.org/)** v16+ 

│   │   ├── components/ # UI components- **[Python](https://www.python.org/)** v3.8+

│   │   └── hooks/    # Custom hooks- **[PostgreSQL](https://www.postgresql.org/)** v12+

└── DOCUMENTATION.md  # Complete docs- **[Git](https://git-scm.com/)** for version control

```

### Optional Components

## 🤝 Contributing- **[Tesseract OCR](https://tesseract-ocr.github.io/)** - For PDF text extraction

- **[Ollama](https://ollama.ai/)** - For local LLM-powered PDF processing

Contributions welcome! Please see [DOCUMENTATION.md](DOCUMENTATION.md) for development guidelines.

## 📦 Installation

## 📄 License

### 1. Clone the Repository

MIT License - see [LICENSE](LICENSE) file for details.

```bash

---git clone https://github.com/yourusername/python-react-expense.git

cd python-react-expense

<div align="center">```

  Made with ❤️ for financial clarity

</div>### 2. Database Setup


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

### 5. Optional: PDF Processing Setup

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

### 6. LLM Setup (Optional)

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
| `/auth/*` | `POST` | User registration, login, and authentication |
| `/accounts/*` | `GET, POST, PUT, DELETE` | Account management with balance tracking |
| `/transactions/*` | `GET, POST, PUT, DELETE` | Transaction CRUD with filtering |
| `/categories/*` | `GET, POST, PUT, DELETE` | Category management with color generation |
| `/payees/*` | `GET, POST, PUT, DELETE` | Payee organization and search |

#### Advanced Features
| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/reports/*` | `GET` | Financial analytics and reporting |
| `/import/*` | `POST, GET` | File import with AI processing |
| `/learning/*` | `GET, POST` | AI learning system management |

### Authentication

All endpoints (except registration/login) require JWT authentication:

```bash
Authorization: Bearer <your-jwt-token>
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

### Running Tests

**Frontend:**
```bash
cd frontend
npm test
```

**Backend:**
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
│   │   ├── pages/          # Main application pages
│   │   ├── contexts/       # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API communication layer
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Frontend utilities
│   ├── public/             # Static assets
│   └── package.json        # Node.js dependencies
├── CLAUDE.md               # Developer documentation
├── PDF_LLM_SETUP.md       # LLM setup instructions
└── README.md               # This file
```

### Architecture Overview

```mermaid
graph TD
    A[React Frontend] -->|HTTP/REST| B[FastAPI Backend]
    B -->|SQLAlchemy ORM| C[PostgreSQL Database]
    B -->|File Processing| D[Import Services]
    D -->|OCR| E[Tesseract]
    D -->|AI Processing| F[Ollama LLM]
    B -->|ML Training| G[Learning Engine]
    G -->|Pattern Analysis| H[User Behavior Data]
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

## ⚙️ Configuration

### Backend (.env)
```bash
DATABASE_URL=postgresql://username:password@localhost/expense_manager
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3001

# Optional: PDF LLM Import
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract
```

### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=http://localhost:8001/api
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

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive developer documentation and architecture guide
- **[PDF_LLM_SETUP.md](PDF_LLM_SETUP.md)** - Local LLM setup instructions for PDF processing
- **[Backend README](backend/README.md)** - Backend-specific setup and API details
- **[Frontend README](frontend/README.md)** - Frontend development and component guide

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
