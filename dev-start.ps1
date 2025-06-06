# DOST Development Startup Script
# This script starts both frontend and backend locally for development

Write-Host "🚀 Starting DOST Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if MongoDB is running
$mongoProcess = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
if ($mongoProcess) {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB doesn't appear to be running" -ForegroundColor Yellow
    Write-Host "Please make sure MongoDB is started" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Gray
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Gray
Set-Location ../workflow-creator-frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "🎯 Starting development servers..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will run on: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Magenta
Write-Host ""

# Start both servers using Start-Job for parallel execution
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    npm run dev
}

$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\workflow-creator-frontend
    npm run dev
}

# Monitor jobs and display output
try {
    while ($true) {
        # Check if jobs are still running
        if ($backendJob.State -eq "Failed" -or $frontendJob.State -eq "Failed") {
            Write-Host "❌ One of the servers failed to start" -ForegroundColor Red
            break
        }
        
        # Receive output from jobs
        Receive-Job $backendJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[BACKEND] $_" -ForegroundColor Blue }
        Receive-Job $frontendJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor Green }
        
        Start-Sleep -Milliseconds 500
    }
} finally {
    # Clean up jobs
    Write-Host ""
    Write-Host "🛑 Stopping development servers..." -ForegroundColor Red
    Stop-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
} 