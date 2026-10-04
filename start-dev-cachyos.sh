#!/usr/bin/env fish

# Expense Manager Development Startup Script (CachyOS / fish shell)
# This script starts both backend and frontend in parallel

echo "🚀 Starting Expense Manager Development Environment..."

# Check if we're in the correct directory
if not test -f backend/main.py; or not test -f frontend/package.json
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
end

# Cleanup handler for Ctrl+C
function cleanup --on-signal INT --on-signal TERM
    echo
    echo "🛑 Shutting down development servers..."
    if set -q backend_pid
        kill $backend_pid 2>/dev/null
    end
    if set -q frontend_pid
        kill $frontend_pid 2>/dev/null
    end
    wait
    echo "✅ Development servers stopped"
    exit 0
end

# Start backend
echo "🔧 Starting backend server..."
cd backend

if not test -d .venv
    echo "❌ Error: Virtual environment not found in backend/.venv"
    echo "Please create one with: cd backend && python -m venv .venv"
    exit 1
end

fish -c 'source .venv/bin/activate.fish; echo "✅ Backend virtual environment activated"; echo "🌐 Starting FastAPI server on http://localhost:8000"; python -m uvicorn main:app --reload --reload-exclude ".venv/*" --port 8000' &
set backend_pid $last_pid

cd ..

# Start frontend
echo "🔧 Starting frontend server..."
cd frontend

if not test -d node_modules
    echo "📦 Installing frontend dependencies..."
    npm install
end

fish -c 'echo "🌐 Starting React development server on http://localhost:3000"; npm start' &
set frontend_pid $last_pid

cd ..

echo ""
echo "🎉 Development environment started successfully!"
echo ""
echo "📍 Services running:"
echo "   • Backend (FastAPI):  http://localhost:8000"
echo "   • Frontend (React):   http://localhost:3000"
echo "   • API Documentation:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $backend_pid $frontend_pid
