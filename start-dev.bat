@echo off
REM Expense Manager Development Startup Script for Windows
REM This script starts both backend and frontend in parallel

echo 🚀 Starting Expense Manager Development Environment...

REM Check if we're in the correct directory
if not exist "backend\main.py" (
    echo ❌ Error: Please run this script from the project root directory
    exit /b 1
)
if not exist "frontend\package.json" (
    echo ❌ Error: Please run this script from the project root directory
    exit /b 1
)

REM Start backend
echo 🔧 Starting backend server...
cd backend

REM Check if virtual environment exists
if not exist "venv" (
    echo ❌ Error: Virtual environment not found in backend\venv
    echo Please create one with: cd backend ^&^& python -m venv venv
    exit /b 1
)

REM Start backend in new window
start "Backend Server" cmd /k "venv\Scripts\activate && echo ✅ Backend virtual environment activated && echo 🌐 Starting FastAPI server on http://localhost:8000 && python -m uvicorn main:app --reload --port 8000"

cd ..

REM Start frontend
echo 🔧 Starting frontend server...
cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    npm install
)

REM Start frontend in new window
start "Frontend Server" cmd /k "echo 🌐 Starting React development server on http://localhost:3000 && npm start"

cd ..

echo.
echo 🎉 Development environment started successfully!
echo.
echo 📍 Services running:
echo    • Backend (FastAPI):  http://localhost:8000
echo    • Frontend (React):   http://localhost:3000
echo    • API Documentation:  http://localhost:8000/docs
echo.
echo Both servers are running in separate windows.
echo Close the respective windows to stop the servers.
echo.
pause