# Copilot Instructions for the Expense Manager Project

This document provides essential guidance for AI agents working on this full-stack expense management application.

## About this Project

This is a full-stack expense management application with a FastAPI backend and a React/TypeScript frontend. It features comprehensive financial tracking, multi-account support, and AI-powered data import from CSV, Excel, and PDF files using local LLMs (Ollama).

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, Pydantic, Alembic
- **Frontend**: React 19, TypeScript, Material-UI, TanStack Query, React Hook Form
- **Database**: PostgreSQL
- **AI**: Ollama for local LLM processing, Tesseract for OCR

## Getting Started & Development Workflow

To run the full stack locally:

1.  **Setup & Run Backend**:

    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    # Create and configure .env from .env.example
    alembic upgrade head
    python -m uvicorn main:app --reload --port 8001
    ```

2.  **Setup & Run Frontend**:
    ```bash
    cd frontend
    npm install
    # Create and configure .env from .env.example
    npm start
    ```
    The frontend runs on `http://localhost:3001` and connects to the backend at `http://localhost:8001`.

## Architecture & Key Concepts

- **Monorepo Structure**: The project is organized into `backend` and `frontend` directories.
- **Authentication**: JWT-based authentication is used. All API endpoints (except login/register) require an `Authorization: Bearer <token>` header.
- **Database Migrations**: Database schema changes are managed with Alembic. To create a new migration:
  ```bash
  cd backend
  alembic revision --autogenerate -m "Your migration message"
  alembic upgrade head
  ```
- **Credit Card Logic**: A critical convention is that credit card balances represent **debt**.
  - **Expenses** _increase_ the balance.
  - **Income/Payments** _decrease_ the balance.
  - Available Credit = `credit_limit - balance`.

## Backend Development (FastAPI)

- **Structure**: Follows the standard FastAPI pattern:
  - `models/`: SQLAlchemy ORM models.
  - `schemas/`: Pydantic models for data validation and serialization.
  - `routers/`: API endpoint definitions.
  - `services/`: Business logic, especially for complex operations like AI processing.
- **Database Queries**: To prevent performance issues, always use `joinedload()` from SQLAlchemy to eager-load related models in queries.
  ```python
  # Example from backend/routers/transactions.py
  db.query(Transaction).options(joinedload(Transaction.category), joinedload(Transaction.payee))
  ```
- **Field Naming**: Be precise with field names. Use `type` for account and transaction types, not `account_type` or `transaction_type`.

## Frontend Development (React)

- **Structure**:
  - `pages/`: Top-level components for each page/route.
  - `components/`: Reusable UI components.
  - `services/`: API client and data fetching logic.
  - `hooks/`: Custom hooks for shared logic (e.g., `useApiWithToast`).
  - `contexts/`: Global state management (e.g., `AuthContext`, `ToastContext`).
  - `types/`: TypeScript type definitions.
- **State Management**:
  - **Server State**: Use **TanStack Query** (`useQuery`, `useMutation`) for all interactions with the backend API.
  - **Global UI State**: Use React Context for global state like authentication (`AuthContext`) and notifications (`ToastContext`).
- **Notifications**: The app has a built-in toast notification system. Use the `useApiWithToast` hook to automatically show success/error messages for API calls.

## Key Files to Reference

- `README.md`: Overall project documentation.
- `CLAUDE.md`: In-depth developer guide with critical patterns and historical context.
- `backend/main.py`: FastAPI application entry point and router configuration.
- `backend/database.py`: Database session management.
- `frontend/src/App.tsx`: Main frontend component with routing setup.
- `frontend/src/services/api.ts`: Axios instance and base API configuration.
- `frontend/src/contexts/AuthContext.tsx`: Manages user authentication state.
- `frontend/src/hooks/useApiWithToast.ts`: A key hook for API calls with user feedback.
