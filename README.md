# Expense Manager Application

A comprehensive expense management application built with React frontend and Python FastAPI backend, featuring PostgreSQL database integration, advanced reporting, and state-of-the-art file import capabilities.

## Features

### Core Functionality
- **Dashboard**: Overview of accounts, recent transactions, and financial summaries
- **Account Management**: Support for multiple account types (checking, savings, credit card, cash, investment, loan)
- **Transaction Management**: Handle deposits, withdrawals, and transfers with automatic balance updates
- **Payee Management**: Organize and track transaction counterparties
- **Category Management**: Categorize transactions with unique color coding
- **Advanced Reports**: Comprehensive filtering and analytics with multiple report types

### Advanced Features
- **Credit Card Support**: Specific fields for credit limit, bill generation date, and payment tracking
- **Transfer Handling**: Seamless money transfers between accounts with proper balance tracking
- **Multi-Select Dropdowns**: Advanced UI components with search and reset functionality
- **File Import System**: Import transactions from CSV, Excel, and PDF files with OCR support
- **Unique Color Generation**: Automatic generation of distinct colors for categories
- **Comprehensive Filtering**: Multi-dimensional filtering across all data entities

## Technology Stack

### Backend
- **Python 3.8+** with FastAPI framework
- **PostgreSQL** database
- **SQLAlchemy** ORM with Alembic migrations
- **Pydantic** for data validation
- **OCR Support** with Tesseract and PIL
- **PDF Processing** with PyPDF2
- **Excel/CSV Processing** with pandas and openpyxl

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for component library
- **React Router** for navigation
- **TanStack Query** (React Query) for data fetching
- **React Hook Form** for form management
- **React Select** for advanced dropdowns

## Setup Instructions

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- PostgreSQL 12+
- Tesseract OCR (for PDF text extraction)

### Database Setup
1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE expense_manager;
CREATE USER expense_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE expense_manager TO expense_user;
```

### Backend Setup
1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp .env.example .env
```

5. Update the `.env` file with your database credentials:
```
DATABASE_URL=postgresql://expense_user:your_password@localhost:5432/expense_manager
DEBUG=True
```

6. Run database migrations:
```bash
python -m alembic upgrade head
```

7. Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive documentation at `http://localhost:8000/docs`.

### Frontend Setup
1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update the `.env` file if needed:
```
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

5. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

### OCR Setup (Optional, for PDF import)
Install Tesseract OCR:

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
Download and install from: https://github.com/UB-Mannheim/tesseract/wiki

## API Documentation

The backend provides a comprehensive REST API with the following endpoints:

### Accounts
- `GET /api/accounts` - List all accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/{id}` - Get account by ID
- `PUT /api/accounts/{id}` - Update account
- `DELETE /api/accounts/{id}` - Delete account

### Transactions
- `GET /api/transactions` - List transactions with filtering
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/{id}` - Get transaction by ID
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction

### Payees
- `GET /api/payees` - List payees with search
- `POST /api/payees` - Create new payee
- `GET /api/payees/{id}` - Get payee by ID
- `PUT /api/payees/{id}` - Update payee
- `DELETE /api/payees/{id}` - Delete payee

### Categories
- `GET /api/categories` - List categories with search
- `POST /api/categories` - Create new category (auto-generates unique color)
- `GET /api/categories/{id}` - Get category by ID
- `PUT /api/categories/{id}` - Update category
- `DELETE /api/categories/{id}` - Delete category

### Reports
- `GET /api/reports/summary` - Get financial summary with filtering
- `GET /api/reports/by-category` - Get transactions grouped by category
- `GET /api/reports/by-payee` - Get transactions grouped by payee
- `GET /api/reports/by-account` - Get transactions grouped by account
- `GET /api/reports/monthly-trend` - Get monthly transaction trends

### Import
- `POST /api/import/csv` - Import transactions from CSV file
- `POST /api/import/excel` - Import transactions from Excel file
- `POST /api/import/pdf-ocr` - Extract text from PDF using OCR
- `GET /api/import/column-mapping/{file_type}` - Analyze file and suggest column mappings

## Usage Guide

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

## File Import Features

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

## Development

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests, please create an issue in the project repository.