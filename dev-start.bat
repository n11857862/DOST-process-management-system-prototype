@echo off
echo 🚀 Starting DOST Development Environment...
echo.

echo 📦 Installing dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

cd ../workflow-creator-frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo 🎯 Starting development servers...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop servers
echo.

start "Backend Server" cmd /k "cd backend && npm run dev"
start "Frontend Server" cmd /k "cd workflow-creator-frontend && npm run dev"

echo ✅ Development servers started in separate windows
pause 