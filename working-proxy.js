const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3003;

// Log all requests
app.use((req, res, next) => {
  console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${req.originalUrl.startsWith('/api') ? 'BACKEND' : 'FRONTEND'}`);
  next();
});

// API proxy
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] API: ${req.method} ${req.originalUrl} -> http://localhost:3001${req.originalUrl}`);
  }
});

// Frontend proxy
const frontendProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] Frontend: ${req.method} ${req.originalUrl} -> http://localhost:3000${req.originalUrl}`);
  }
});

// Custom routing middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    // Route to backend, preserving the full URL
    apiProxy(req, res, next);
  } else {
    // Route to frontend
    frontendProxy(req, res, next);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Working proxy server running on port ${PORT}`);
  console.log(`📡 API calls (/api/*) -> Backend (http://localhost:3001) [preserving full path]`);
  console.log(`🌐 All other requests -> Frontend (http://localhost:3000)`);
}); 