# 💰 Expense Manager

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A modern, full-stack expense management application designed for personal financial tracking and analysis. Built with React 19 and FastAPI, featuring comprehensive transaction management, intelligent file imports, and advanced reporting capabilities.

![Dashboard Preview](https://via.placeholder.com/800x400/f0f0f0/333333?text=Expense+Manager+Dashboard)

## ✨ Features

### 🎯 Core Functionality
- **Dashboard**: Overview of accounts, recent transactions, and financial summaries
- **Account Management**: Support for multiple account types (checking, savings, credit card, cash, investment, loan)
- **Transaction Management**: Handle deposits, withdrawals, and transfers with automatic balance updates
- **Payee Management**: Organize and track transaction counterparties
- **Category Management**: Categorize transactions with unique color coding
- **Advanced Reports**: Comprehensive filtering and analytics with multiple report types

### 🚀 Advanced Features
- **Credit Card Support**: Specific fields for credit limit, bill generation date, and payment tracking
- **Transfer Handling**: Seamless money transfers between accounts with proper balance tracking
- **Multi-Select Dropdowns**: Advanced UI components with search and reset functionality
- **File Import System**: Import transactions from CSV, Excel, and PDF files with OCR support
- **Unique Color Generation**: Automatic generation of distinct colors for categories
- **Comprehensive Filtering**: Multi-dimensional filtering across all data entities

## 🛠 Technology Stack

### Backend
- **Python 3.8+** with FastAPI framework
- **PostgreSQL** database
- **SQLAlchemy** ORM with Alembic migrations
- **Pydantic** for data validation
- **OCR Support** with Tesseract and PIL
- **PDF Processing** with PyPDF2
- **Excel/CSV Processing** with pandas and openpyxl

### Frontend
- **React 19** with TypeScript
- **Material-UI (MUI)** for component library
- **React Router** for navigation
- **TanStack Query** (React Query) for data fetching
- **React Hook Form** for form management
- **React Select** for advanced dropdowns

## 🚀 Quick Start

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/) (v3.8 or higher) 
- [PostgreSQL](https://www.postgresql.org/) (v12 or higher)
- [Tesseract OCR](https://tesseract-ocr.github.io/) (optional, for PDF processing)

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/expense-manager.git
cd expense-manager
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
python -m uvicorn main:app --reload --port 8000
```

🎉 **Backend is now running at:** `http://localhost:8000`  
📚 **API Documentation:** `http://localhost:8000/docs`

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

🎉 **Frontend is now running at:** `http://localhost:3000`

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

For advanced PDF processing with local LLMs:

```bash
# Install and setup Ollama
./setup_ollama.sh

# Or if Ollama is already installed
./setup_ollama_existing.sh
```

## 🔗 API Reference

The backend provides a comprehensive REST API with the following endpoints:

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login  
- `GET /auth/me` - Get current user info

### Accounts
- `GET /accounts/` - List all accounts
- `POST /accounts/` - Create new account
- `GET /accounts/{id}` - Get account by ID
- `PUT /accounts/{id}` - Update account
- `DELETE /accounts/{id}` - Delete account

### Transactions
- `GET /transactions/` - List transactions with filtering
- `POST /transactions/` - Create new transaction
- `GET /transactions/{id}` - Get transaction by ID
- `PUT /transactions/{id}` - Update transaction
- `DELETE /transactions/{id}` - Delete transaction

### Payees
- `GET /payees/` - List payees with search
- `POST /payees/` - Create new payee
- `GET /payees/{id}` - Get payee by ID
- `PUT /payees/{id}` - Update payee
- `DELETE /payees/{id}` - Delete payee

### Categories
- `GET /categories/` - List categories with search
- `POST /categories/` - Create new category (auto-generates unique color)
- `GET /categories/{id}` - Get category by ID
- `PUT /categories/{id}` - Update category
- `DELETE /categories/{id}` - Delete category

### Reports
- `GET /reports/summary` - Get financial summary with filtering
- `GET /reports/by-category` - Get transactions grouped by category
- `GET /reports/by-payee` - Get transactions grouped by payee
- `GET /reports/by-account` - Get transactions grouped by account
- `GET /reports/monthly-trend` - Get monthly transaction trends

### Import
- `POST /import/csv` - Import transactions from CSV file
- `POST /import/excel` - Import transactions from Excel file
- `POST /import/pdf` - Extract text from PDF using OCR

## 📖 Usage Guide

### Adding Accounts
1. Navigate to the Accounts page
2. Click "Add Account"
3. Fill in account details:
   - Name and type are required
   - For credit cards, add credit limit and bill dates
   - Set initial balance and opening date

### Managing Transactions
1. Go to the Transactions page
2. Click "Add Transaction" to create new transactions
3. For transfers, select both source and destination accounts
4. Payees and categories are optional but help with organization
5. Use the Import button to bulk import from files

### Creating Categories
1. Visit the Categories page
2. Add new categories - colors are auto-generated for uniqueness
3. Manually specify colors if desired using the color picker

### Generating Reports
1. Open the Reports page
2. Set date range and select filters:
   - Multiple accounts, categories, and payees supported
   - Use the multi-select dropdowns with search functionality
3. Click "Generate Reports" to view analytics
4. Reports include summary, category breakdown, payee analysis, and trends

### Importing Data
1. Go to Transactions page and click "Import"
2. Upload CSV, Excel, or PDF files
3. Map columns to transaction fields
4. Review and confirm import
5. For PDFs, OCR will extract text for manual processing

## 📄 Import Features

### Supported Formats
- **CSV**: Standard comma-separated values
- **Excel**: .xlsx and .xls files with sheet selection
- **PDF**: Text extraction with OCR fallback

### Column Mapping
The system provides intelligent column mapping suggestions:
- Date fields: looks for "date", "time", "when"
- Amount fields: "amount", "value", "sum", "total"
- Description: "desc", "description", "memo", "note"
- Payee: "payee", "merchant", "vendor", "to", "from"
- Category: "category", "type", "class"

### Auto-Creation
- Payees and categories are automatically created if they don't exist
- Each new category gets a unique color assigned

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
├── backend/
│   ├── models/          # SQLAlchemy models
│   ├── routers/         # API route handlers
│   ├── schemas/         # Pydantic schemas
│   ├── utils/           # Utility functions
│   └── main.py          # FastAPI application
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Utility functions
│   └── public/
└── README.md
```

### Database Schema
- **accounts**: Store account information with type-specific fields  
- **transactions**: Transaction records with relationships to accounts, payees, categories
- **payees**: Transaction counterparties
- **categories**: Expense/income categories with unique colors

### Key Features Implementation
- **Balance Tracking**: Automatic updates on transaction create/update/delete
- **Transfer Logic**: Proper debit/credit handling between accounts
- **Color Generation**: Algorithm ensures unique colors for categories
- **Multi-Select UI**: Custom component with search and reset functionality
- **File Processing**: Robust parsing with error handling and validation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. 🍴 Fork the repository
2. 🌟 Create a feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add some amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔄 Open a Pull Request

### Development Setup

For detailed development instructions, see:
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

## 📸 Screenshots

<details>
<summary>Click to view screenshots</summary>

### Dashboard
![Dashboard](https://via.placeholder.com/600x400/f8f9fa/343a40?text=Dashboard+View)

### Transaction Management
![Transactions](https://via.placeholder.com/600x400/f8f9fa/343a40?text=Transaction+Management)

### Import Features
![Import](https://via.placeholder.com/600x400/f8f9fa/343a40?text=File+Import+System)

</details>

## 🔒 Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://username:password@localhost/expense_manager
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:3000

# Optional: PDF LLM Import
OLLAMA_HOST=http://localhost:11434
OLLAMA_TIMEOUT=60
TESSERACT_CMD=/usr/bin/tesseract
```

### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=http://localhost:8000/api
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

## 📊 Roadmap

- [ ] Mobile responsive design improvements
- [ ] Advanced analytics and charts
- [ ] Budget planning and alerts
- [ ] Multi-currency support
- [ ] Bank integration APIs
- [ ] Export to various formats
- [ ] Docker containerization
- [ ] Cloud deployment guides

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/) and [React](https://reactjs.org/)
- UI components from [Material-UI](https://mui.com/)
- OCR powered by [Tesseract](https://tesseract-ocr.github.io/)
- Local LLM integration via [Ollama](https://ollama.ai/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- 📫 Create an [issue](https://github.com/yourusername/expense-manager/issues) for bug reports
- 💡 Start a [discussion](https://github.com/yourusername/expense-manager/discussions) for feature requests
- ⭐ Star this repo if you find it helpful!

---

<div align="center">
  Made with ❤️ by developers, for financial clarity
</div>