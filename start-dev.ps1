# Expense Manager Development Startup Script for PowerShell
# This script starts both backend and frontend in parallel with proper process management

param(
    [switch]$NoColor = $false
)

# Color output helper
function Write-Host-Color {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    if ($NoColor) {
        Write-Host $Message
    } else {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host-Color $Text -Color "Cyan"
    Write-Host ""
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host-Color "[ERROR] $Message" -Color "Red"
}

function Write-Success {
    param([string]$Message)
    Write-Host-Color "[OK] $Message" -Color "Green"
}

function Write-Info {
    param([string]$Message)
    Write-Host-Color "[INFO] $Message" -Color "Cyan"
}

# Cleanup on exit
$processes = @()
$shutdownInProgress = $false

function Cleanup {
    if ($shutdownInProgress) { return }
    $shutdownInProgress = $true
    
    Write-Host ""
    Write-Host-Color "[SHUTDOWN] Shutting down development servers..." -Color "Yellow"
    
    foreach ($process in $processes) {
        if ($process -and -not $process.HasExited) {
            try {
                $process | Stop-Process -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
    
    Write-Success "Development servers stopped"
    exit 0
}

# Set up trap for Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

# Check execution policy
$executionPolicy = Get-ExecutionPolicy -Scope Process
if ($executionPolicy -eq "Restricted") {
    Write-Error-Custom "PowerShell execution policy is Restricted"
    Write-Info "Run this command to fix it (this session only):"
    Write-Host "    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process"
    exit 1
}

Write-Title "[STARTUP] Starting Expense Manager Development Environment..."

# Validate project structure
if (-not (Test-Path "backend\main.py")) {
    Write-Error-Custom "backend\main.py not found"
    Write-Info "Please run this script from the project root directory"
    exit 1
}

if (-not (Test-Path "frontend\package.json")) {
    Write-Error-Custom "frontend\package.json not found"
    Write-Info "Please run this script from the project root directory"
    exit 1
}

# Check virtual environment
if (-not (Test-Path "backend\.venv")) {
    Write-Error-Custom "Virtual environment not found at backend\.venv"
    Write-Info "Create one with: cd backend; python -m venv .venv"
    exit 1
}

Write-Success "Prerequisites verified"

# Start backend
Write-Info "Starting backend server..."
Write-Host-Color "[BACKEND] FastAPI will run on http://localhost:8000" -Color "Blue"

$backendProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", "cd backend; & .\.venv\Scripts\Activate.ps1; python -m uvicorn main:app --reload --port 8000") `
    -PassThru `
    -NoNewWindow

$processes += $backendProcess

# Give backend a moment to start
Start-Sleep -Seconds 2

# Start frontend
Write-Info "Starting frontend server..."
Write-Host-Color "[FRONTEND] React will run on http://localhost:3000" -Color "Blue"

$frontendProcess = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", "cd frontend; npm start") `
    -PassThru `
    -NoNewWindow

$processes += $frontendProcess

Write-Title "[SUCCESS] Development environment started successfully!"

Write-Host-Color "Services running:" -Color "Yellow"
Write-Host "   * Backend (FastAPI):  http://localhost:8000"
Write-Host "   * Frontend (React):   http://localhost:3000"
Write-Host "   * API Documentation:  http://localhost:8000/docs"
Write-Host ""
Write-Host-Color "Press Ctrl+C to stop all servers" -Color "Yellow"
Write-Host ""

# Wait for both processes
while ($processes | Where-Object { -not $_.HasExited }) {
    Start-Sleep -Seconds 1
}

# If we get here, one of the processes exited unexpectedly
Write-Host-Color "One of the processes has exited" -Color "Yellow"
Cleanup
