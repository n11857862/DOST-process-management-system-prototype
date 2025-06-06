# DOST Process Management System - Docker Setup

This guide explains how to run the DOST Process Management System locally using Docker Compose.

## Prerequisites

1. **Docker Desktop** installed on your system
   - Windows: Download from [Docker Desktop for Windows](https://docs.docker.com/desktop/windows/install/)
   - macOS: Download from [Docker Desktop for Mac](https://docs.docker.com/desktop/mac/install/)
   - Linux: Follow [Docker Engine installation guide](https://docs.docker.com/engine/install/)

2. **Docker Compose** (included with Docker Desktop)

## Project Structure

```
DOST-process-management-system-prototype/
├── backend/                    # Node.js/Express backend
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
├── workflow-creator-frontend/  # React frontend
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
├── docker-compose.yml         # Docker Compose configuration
└── DOCKER_SETUP.md           # This file
```

## Services

The Docker Compose setup includes:

1. **MongoDB** (Port 27017) - Database
2. **Backend** (Port 5000) - Node.js API server
3. **Frontend** (Port 3000) - React development server

## Quick Start

### 1. Clone and Navigate to Project
```bash
cd /path/to/DOST-process-management-system-prototype
```

### 2. Start All Services
```bash
# Start all services in detached mode
docker-compose up -d

# Or start with logs visible
docker-compose up
```

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017 (for database tools)

### 4. Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

## Development Workflow

### Hot Reloading
Both frontend and backend support hot reloading:
- Frontend: React development server automatically reloads on file changes
- Backend: If you have nodemon configured, it will restart on changes

### View Logs
```bash
# View logs for all services
docker-compose logs

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb

# Follow logs in real-time
docker-compose logs -f backend
```

### Rebuild Services
```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild and restart
docker-compose up --build
```

## Database Management

### Access MongoDB
```bash
# Connect to MongoDB container
docker-compose exec mongodb mongosh

# Or use MongoDB connection string
mongodb://admin:password123@localhost:27017/dost_workflow_db?authSource=admin
```

### Reset Database
```bash
# Stop services and remove volumes
docker-compose down -v

# Start services again (fresh database)
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000                 # macOS/Linux
   
   # Kill the process or change ports in docker-compose.yml
   ```

2. **Permission Issues (Linux/macOS)**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **Container Won't Start**
   ```bash
   # Check container status
   docker-compose ps
   
   # View detailed logs
   docker-compose logs [service-name]
   
   # Restart specific service
   docker-compose restart [service-name]
   ```

4. **Database Connection Issues**
   - Ensure MongoDB container is running: `docker-compose ps`
   - Check backend logs: `docker-compose logs backend`
   - Verify connection string in docker-compose.yml

### Clean Reset
```bash
# Stop everything
docker-compose down -v

# Remove all containers, networks, and images
docker system prune -a

# Rebuild from scratch
docker-compose up --build
```

## Environment Variables

Key environment variables in docker-compose.yml:

### Backend
- `NODE_ENV`: development
- `PORT`: 5000
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGIN`: Frontend URL for CORS

### Frontend
- `VITE_API_BASE_URL`: Backend API URL (Vite environment variable)
- `NODE_ENV`: development

## Alternative: Run Frontend Locally

For better development experience, you can run only the backend and database in Docker:

```bash
# Start only backend services
docker-compose up mongodb backend

# In another terminal, run frontend locally
cd workflow-creator-frontend
npm install
npm start
```

## Production Deployment

For production deployment, you'll need to:

1. Create production Dockerfiles with multi-stage builds
2. Use environment-specific docker-compose files
3. Configure proper secrets management
4. Set up reverse proxy (nginx)
5. Configure SSL certificates

## Useful Commands

```bash
# View running containers
docker-compose ps

# Execute command in container
docker-compose exec backend npm install
docker-compose exec frontend npm install

# View container resource usage
docker stats

# Clean up unused Docker resources
docker system prune
```

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify Docker Desktop is running
3. Ensure ports 3000, 3001, and 27017 are available
4. Try a clean rebuild: `docker-compose down -v && docker-compose up --build` 