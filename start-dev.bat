@echo off
REM Expense Manager Development Startup Script for Windows
REM This script starts both backend and frontend in parallel

setlocal enabledelayedexpansion

echo.
echo 🚀 Starting Expense Manager Development Environment...
echo.

REM Check if we're in the correct directory
if not exist "backend\main.py" (
    echo ❌ Error: backend\main.py not found
    echo Please run this script from the project root directory
    exit /b 1
)

if not exist "frontend\package.json" (
    echo ❌ Error: frontend\package.json not found
    echo Please run this script from the project root directory
    exit /b 1
)

REM Check if virtual environment exists
if not exist "backend\.venv" (
    echo ❌ Error: Virtual environment not found at backend\.venv
    echo Please create one with: cd backend ^&^& python -m venv .venv
    exit /b 1
)

echo ✅ Prerequisites verified
echo.

REM Start backend
echo 🔧 Starting backend server...
echo 🌐 FastAPI will run on http://localhost:8000
start cmd /k "cd /d %cd%\backend && .\.venv\Scripts\activate.bat && python -m uvicorn main:app --reload --port 8000"

REM Give backend a moment to start
timeout /t 2 /nobreak

REM Start frontend
echo 🔧 Starting frontend server...
echo 🌐 React will run on http://localhost:3000
start cmd /k "cd /d %cd%\frontend && npm start"

echo.
echo 🎉 Development environment started successfully!
echo.
echo 📍 Services running in separate windows:
echo    • Backend (FastAPI):  http://localhost:8000
echo    • Frontend (React):   http://localhost:3000
echo    • API Documentation:  http://localhost:8000/docs
echo.
echo ⚠️  Close each window to stop the respective service
echo.

endlocal
