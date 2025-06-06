# DOST Project with ngrok Local Tunneling

This guide explains how to expose your locally running DOST Process Management System to the internet using ngrok.

## Prerequisites

1. **Docker setup working** (see DOCKER_SETUP.md)
2. **ngrok account** (free at [ngrok.com](https://ngrok.com/))

## Step 1: Install ngrok

### Option A: Download from Website
1. Go to [ngrok.com](https://ngrok.com/) and sign up
2. Download ngrok for Windows
3. Extract to a folder (e.g., `C:\ngrok\`)
4. Add to your PATH or use full path

### Option B: Install via Chocolatey (if you have it)
```powershell
choco install ngrok
```

### Option C: Install via Scoop (if you have it)
```powershell
scoop install ngrok
```

## Step 2: Configure ngrok

1. **Get your authtoken** from [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
2. **Configure ngrok**:
```powershell
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

## Step 3: Start Your DOST Project

Make sure your Docker containers are running:
```powershell
# Navigate to your project
cd C:\Users\qhien\OneDrive\Desktop\IFN711\DOST-process-management-system-prototype

# Start all services
docker-compose up -d

# Verify they're running
docker-compose ps
```

Your services should be running on:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **MongoDB**: localhost:27017

## Step 4: Expose Services with ngrok

### Option A: Expose Frontend Only (Recommended for demos)
```powershell
# In a new terminal window
ngrok http 3000
```

This will give you a public URL like: `https://abc123.ngrok.io`

### Option B: Expose Both Frontend and Backend
You'll need two ngrok tunnels. Open two separate terminal windows:

**Terminal 1 - Frontend:**
```powershell
ngrok http 3000 --subdomain=dost-frontend
```

**Terminal 2 - Backend:**
```powershell
ngrok http 3001 --subdomain=dost-backend
```

*Note: Custom subdomains require a paid ngrok plan*

### Option C: Use ngrok Configuration File
Create an `ngrok.yml` file for multiple tunnels:

```yaml
version: "2"
authtoken: YOUR_AUTHTOKEN_HERE
tunnels:
  frontend:
    addr: 3000
    proto: http
    subdomain: dost-frontend
  backend:
    addr: 3001
    proto: http
    subdomain: dost-backend
```

Then run:
```powershell
ngrok start --all
```

## Step 5: Update Frontend Configuration

If you're exposing both frontend and backend, you need to update your frontend to use the ngrok backend URL.

### For Docker Setup:
Update the `docker-compose.yml` environment variable:
```yaml
frontend:
  environment:
    VITE_API_BASE_URL: https://your-backend-ngrok-url.ngrok.io/api/v1
```

### For Local Development:
Create a `.env.local` file in `workflow-creator-frontend/`:
```env
VITE_API_BASE_URL=https://your-backend-ngrok-url.ngrok.io/api/v1
```

## Step 6: Update CORS Settings

Update your backend CORS configuration to allow the ngrok frontend URL.

In `docker-compose.yml`:
```yaml
backend:
  environment:
    CORS_ORIGIN: https://your-frontend-ngrok-url.ngrok.io
```

## Common Use Cases

### 1. Demo/Presentation
```powershell
# Just expose the frontend
ngrok http 3000
```
Share the ngrok URL with your audience.

### 2. Mobile Testing
```powershell
# Expose frontend for mobile testing
ngrok http 3000
```
Access the ngrok URL from your mobile device.

### 3. Webhook Testing
```powershell
# Expose backend for webhook testing
ngrok http 3001
```
Use the backend ngrok URL for webhook endpoints.

### 4. External API Integration
```powershell
# Expose both services
ngrok http 3000 --subdomain=dost-app
ngrok http 3001 --subdomain=dost-api
```

## Security Considerations

### 1. Authentication
- Your ngrok URLs are public
- Ensure your app has proper authentication
- Consider ngrok's built-in authentication:
```powershell
ngrok http 3000 --basic-auth="username:password"
```

### 2. HTTPS
- ngrok provides HTTPS by default
- Update any hardcoded HTTP URLs to HTTPS

### 3. Rate Limiting
- Free ngrok has connection limits
- Consider upgrading for production use

## Troubleshooting

### 1. "ngrok not found"
- Ensure ngrok is in your PATH
- Or use full path: `C:\path\to\ngrok.exe http 3000`

### 2. "Tunnel not found"
- Check your authtoken is configured
- Verify the port is correct and service is running

### 3. CORS Errors
- Update CORS_ORIGIN in docker-compose.yml
- Restart containers after changes

### 4. API Calls Failing
- Ensure VITE_API_BASE_URL points to correct ngrok URL
- Check both frontend and backend are accessible

## Advanced Configuration

### Custom Domain (Paid Plan)
```powershell
ngrok http 3000 --hostname=dost.yourdomain.com
```

### Password Protection
```powershell
ngrok http 3000 --basic-auth="admin:secretpassword"
```

### IP Restrictions (Paid Plan)
```powershell
ngrok http 3000 --cidr-allow=192.168.1.0/24
```

## Useful Commands

```powershell
# Check ngrok status
ngrok status

# List active tunnels
ngrok tunnels list

# Stop all tunnels
ngrok stop --all

# View ngrok web interface
# Open http://localhost:4040 in browser
```

## Example Workflow

1. **Start Docker services:**
```powershell
docker-compose up -d
```

2. **Start ngrok for frontend:**
```powershell
ngrok http 3000
```

3. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Share with others** or test on mobile devices

5. **Stop when done:**
```powershell
# Stop ngrok (Ctrl+C in ngrok terminal)
# Stop Docker
docker-compose down
```

## Integration with CI/CD

For automated deployments, you can use ngrok in scripts:
```powershell
# Start services
docker-compose up -d

# Start ngrok in background
Start-Process ngrok -ArgumentList "http 3000" -WindowStyle Hidden

# Get the public URL
$ngrokUrl = (Invoke-RestMethod http://localhost:4040/api/tunnels).tunnels[0].public_url
Write-Host "App available at: $ngrokUrl"
```

## Cost Considerations

### Free Plan Limitations:
- 1 online ngrok process
- 4 tunnels/ngrok process
- 40 connections/minute

### Paid Plans Offer:
- Custom subdomains
- Reserved domains
- IP whitelisting
- More concurrent connections
- Password protection

For development and testing, the free plan is usually sufficient! 