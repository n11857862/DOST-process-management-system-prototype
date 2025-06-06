# Quick Start Guide - Running DOST Process Management System

## Prerequisites

Before running the system, ensure you have the following installed:

### Option 1: Docker (Recommended - Easiest)
- **Docker Desktop** 
  - Windows: [Download Docker Desktop](https://docs.docker.com/desktop/windows/install/)
  - macOS: [Download Docker Desktop](https://docs.docker.com/desktop/mac/install/)
  - Linux: [Install Docker Engine](https://docs.docker.com/engine/install/)
- **Minimum System Requirements:**
  - 4GB RAM (8GB recommended)
  - 10GB free disk space

### Option 2: Manual Installation
- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** - [Install locally](https://docs.mongodb.com/manual/installation/) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Git** (should already be installed if you pulled the repo)

---

## Quick Start with Docker (Recommended)

### Step 1: Navigate to Project Directory
```bash
cd DOST-process-management-system-prototype
```

### Step 2: Start All Services
```bash
# Start all services in background
docker-compose up -d

# Or start with logs visible (useful for debugging)
docker-compose up
```

### Step 3: Wait for Services to Start
The system will take 1-2 minutes to fully start. You'll see logs indicating when services are ready.

### Step 4: Access the Application
- **Frontend (Main Application)**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### Step 5: Create Your First User Account
1. Open http://localhost:3000 in your browser
2. Click "Register" or "Sign Up"
3. Fill in your details to create an account
4. Login with your new credentials

### Step 6: Stop the System (When Done)
```bash
# Stop all services
docker-compose down

# Stop and remove all data (fresh start next time)
docker-compose down -v
```

---

## Manual Installation (Alternative)

If you prefer not to use Docker or encounter Docker issues:

### Step 1: Install Dependencies

#### Backend Setup
```bash
cd backend
npm install
```

#### Frontend Setup
```bash
cd workflow-creator-frontend
npm install
```

### Step 2: Set Up Database
- Install MongoDB locally or create a free MongoDB Atlas account
- The application will create necessary collections automatically

### Step 3: Start Services

#### Terminal 1 - Start Backend
```bash
cd backend
npm start
```

#### Terminal 2 - Start Frontend
```bash
cd workflow-creator-frontend
npm run dev
```

### Step 4: Access the Application
- **Frontend**: http://localhost:3000 (or the port shown in Terminal 2)
- **Backend**: http://localhost:5000

---

## Troubleshooting Common Issues

### Docker Issues

**"Port already in use" error:**
```bash
# Check what's using the ports
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Stop the conflicting process or change ports in docker-compose.yml
```

**"Docker daemon not running":**
- Ensure Docker Desktop is running
- Restart Docker Desktop if necessary

**Services won't start:**
```bash
# Check logs for specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb

# Restart specific service
docker-compose restart backend
```

### Manual Installation Issues

**"npm install" fails:**
```bash
# Clear npm cache and try again
npm cache clean --force
npm install
```

**"Module not found" errors:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

**Database connection issues:**
- Ensure MongoDB is running
- Check if you need to update connection strings in the backend configuration

### General Issues

**Browser cache issues:**
- Clear browser cache and cookies
- Try an incognito/private browsing window
- Try a different browser

**Still having problems?**
- Check the full [User Manual](USER_MANUAL.md) for detailed troubleshooting
- Look at existing setup documentation: [DOCKER_SETUP.md](DOCKER_SETUP.md)

---

## Default System Information

### Default Ports
- **Frontend**: 3000
- **Backend**: 5000
- **MongoDB**: 27017

### First User Setup
1. The first user you create will need to be manually promoted to Admin in the database
2. Or you can start using the system with Staff/Manager permissions initially
3. Admin access is needed for user management and system configuration

### Sample Data
- The system starts empty - you'll need to create workflows and users
- Check the User Manual for guidance on creating your first workflow

---

## Next Steps

Once the system is running:

1. **Read the User Manual**: Check [USER_MANUAL.md](USER_MANUAL.md) for comprehensive guidance
2. **Create Workflows**: Use the Workflow Designer to create your first business process
3. **Add Users**: Invite team members and assign appropriate roles
4. **Configure Settings**: Adjust system settings to match your organization's needs

## Getting Help

- **User Manual**: [USER_MANUAL.md](USER_MANUAL.md) - Comprehensive documentation
- **Docker Setup**: [DOCKER_SETUP.md](DOCKER_SETUP.md) - Detailed Docker instructions
- **API Configuration**: [API_CONFIG_FLEXIBLE_SYSTEM.md](API_CONFIG_FLEXIBLE_SYSTEM.md) - API integration guide

---

## System Architecture Overview

The DOST Process Management System consists of:
- **Frontend**: React.js application with modern UI
- **Backend**: Node.js/Express API server
- **Database**: MongoDB for data storage
- **Workflow Engine**: Custom workflow processing system
- **API Integration**: Flexible system for external connections

Happy workflow managing! 🚀 