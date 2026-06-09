@echo off
cd /d "C:\Dev\python-react-expense"

echo === HDFC Diners Club Import ===
echo.

REM Try virtual environment first
if exist "backend\.venv\Scripts\python.exe" (
    echo Using backend venv...
    backend\.venv\Scripts\python.exe import_hdfc_diners.py %*
) else if exist "backend\.venv\Scripts\python3.exe" (
    backend\.venv\Scripts\python3.exe import_hdfc_diners.py %*
) else (
    echo Using system Python...
    python import_hdfc_diners.py %*
)

echo.
pause
