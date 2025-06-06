const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3003;

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${req.originalUrl.startsWith('/api') ? 'BACKEND' : 'FRONTEND'}`);
  next();
});

// API proxy
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  ws: true,
  logLevel: 'info',
  onError: (err, req, res) => {
    console.error('[PROXY] Backend proxy error:', err.message);
    res.status(500).json({ error: 'Backend service unavailable' });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] API: ${req.method} ${req.originalUrl} -> http://localhost:3001${req.originalUrl}`);
  }
});

// Frontend proxy
const frontendProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  logLevel: 'info',
  onError: (err, req, res) => {
    console.error('[PROXY] Frontend proxy error:', err.message);
    res.status(500).send('Frontend service unavailable');
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] Frontend: ${req.method} ${req.originalUrl} -> http://localhost:3000${req.originalUrl}`);
  }
});

// Custom routing middleware - preserves full URL path
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    // Route to backend, preserving the full URL including /api
    apiProxy(req, res, next);
  } else {
    // Route to frontend
    frontendProxy(req, res, next);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📡 API calls (/api/*) -> Backend (http://localhost:3001) [preserving full path]`);
  console.log(`🌐 All other requests -> Frontend (http://localhost:3000)`);
  console.log(`🔗 Ready for ngrok: ngrok http ${PORT}`);
  console.log('');
  console.log('Make sure your Docker containers are running:');
  console.log('  - Frontend: http://localhost:3000');
  console.log('  - Backend: http://localhost:3001');
}); 