# PowerShell script to start DOST project with ngrok
# Usage: .\start-with-ngrok.ps1

Write-Host "🚀 Starting DOST Process Management System with ngrok..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if ngrok is available
try {
    ngrok version | Out-Null
    Write-Host "✅ ngrok is available" -ForegroundColor Green
} catch {
    Write-Host "❌ ngrok not found. Please install ngrok first." -ForegroundColor Red
    Write-Host "   Download from: https://ngrok.com/" -ForegroundColor Yellow
    exit 1
}

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Blue
docker-compose up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if services are running
$containers = docker-compose ps --format json | ConvertFrom-Json
$frontendRunning = $containers | Where-Object { $_.Service -eq "frontend" -and $_.State -eq "running" }
$backendRunning = $containers | Where-Object { $_.Service -eq "backend" -and $_.State -eq "running" }

if (-not $frontendRunning) {
    Write-Host "❌ Frontend container is not running" -ForegroundColor Red
    docker-compose logs frontend
    exit 1
}

if (-not $backendRunning) {
    Write-Host "❌ Backend container is not running" -ForegroundColor Red
    docker-compose logs backend
    exit 1
}

Write-Host "✅ All services are running!" -ForegroundColor Green

# Display service URLs
Write-Host "`n📍 Local URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "   MongoDB:  mongodb://localhost:27017" -ForegroundColor White

# Ask user what they want to expose
Write-Host "`n🌐 What would you like to expose with ngrok?" -ForegroundColor Cyan
Write-Host "   1. Frontend only (recommended for demos)" -ForegroundColor White
Write-Host "   2. Backend only (for webhook testing)" -ForegroundColor White
Write-Host "   3. Both frontend and backend" -ForegroundColor White
Write-Host "   4. Skip ngrok (use local only)" -ForegroundColor White

$choice = Read-Host "`nEnter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "`n🚀 Starting ngrok for frontend..." -ForegroundColor Green
        Write-Host "Press Ctrl+C to stop ngrok when done." -ForegroundColor Yellow
        ngrok http 3000
    }
    "2" {
        Write-Host "`n🚀 Starting ngrok for backend..." -ForegroundColor Green
        Write-Host "Press Ctrl+C to stop ngrok when done." -ForegroundColor Yellow
        ngrok http 3001
    }
    "3" {
        Write-Host "`n🚀 Starting ngrok for both services..." -ForegroundColor Green
        Write-Host "This will open two terminal windows." -ForegroundColor Yellow
        Write-Host "Close both windows when done." -ForegroundColor Yellow
        
        # Start frontend ngrok in new window
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Frontend ngrok tunnel' -ForegroundColor Green; ngrok http 3000"
        
        # Start backend ngrok in new window
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Backend ngrok tunnel' -ForegroundColor Blue; ngrok http 3001"
        
        Write-Host "✅ ngrok tunnels started in separate windows" -ForegroundColor Green
    }
    "4" {
        Write-Host "`n✅ Services are running locally only." -ForegroundColor Green
        Write-Host "Access your app at: http://localhost:3000" -ForegroundColor Cyan
    }
    default {
        Write-Host "`n❌ Invalid choice. Services are running locally." -ForegroundColor Red
        Write-Host "Access your app at: http://localhost:3000" -ForegroundColor Cyan
    }
}

Write-Host "`n📝 Useful commands:" -ForegroundColor Cyan
Write-Host "   View logs:        docker-compose logs" -ForegroundColor White
Write-Host "   Stop services:    docker-compose down" -ForegroundColor White
Write-Host "   Restart services: docker-compose restart" -ForegroundColor White
Write-Host "   ngrok dashboard:  http://localhost:4040" -ForegroundColor White 