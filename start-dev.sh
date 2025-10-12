#!/bin/bash

# Expense Manager Development Startup Script
# This script starts both backend and frontend in parallel

set -e

echo "🚀 Starting Expense Manager Development Environment..."

# Function to stop existing servers
stop_servers() {
    echo "🛑 Stopping any existing development servers..."
    
    # Kill processes on backend port 8001
    if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   • Stopping backend server on port 8001..."
        kill -9 $(lsof -ti:8001) 2>/dev/null || true
    fi
    
    # Kill processes on frontend port 3001
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   • Stopping frontend server on port 3001..."
        kill -9 $(lsof -ti:3001) 2>/dev/null || true
    fi
    
    # Kill any remaining node or uvicorn processes related to this project
    pkill -f "uvicorn.*main:app" 2>/dev/null || true
    pkill -f "react-scripts start" 2>/dev/null || true
    
    # Wait a moment for processes to clean up
    sleep 2
    echo "✅ Existing servers stopped"
}

# Stop existing servers first
stop_servers

# Check if we're in the correct directory
if [ ! -f "backend/main.py" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo -e "\n🛑 Shutting down development servers..."
    
    # Kill background jobs first
    kill $(jobs -p) 2>/dev/null || true
    
    # Kill processes on specific ports as backup
    kill -9 $(lsof -ti:8001) 2>/dev/null || true
    kill -9 $(lsof -ti:3001) 2>/dev/null || true
    
    # Kill any remaining related processes
    pkill -f "uvicorn.*main:app" 2>/dev/null || true
    pkill -f "react-scripts start" 2>/dev/null || true
    
    wait
    echo "✅ Development servers stopped"
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend server..."
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found in backend/venv"
    echo "Please create one with: cd backend && python -m venv venv"
    exit 1
fi

# Activate virtual environment and start backend
(
    source venv/bin/activate
    echo "✅ Backend virtual environment activated"
    echo "🌐 Starting FastAPI server on http://localhost:8001"
    python -m uvicorn main:app --reload --port 8001
) &
BACKEND_PID=$!

cd ..

# Start frontend
echo "🔧 Starting frontend server..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

(
    echo "🌐 Starting React development server on http://localhost:3001"
    npm start
) &
FRONTEND_PID=$!

cd ..

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📍 Services running:"
echo "   • Backend (FastAPI):  http://localhost:8001"
echo "   • Frontend (React):   http://localhost:3001"
echo "   • API Documentation:  http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID