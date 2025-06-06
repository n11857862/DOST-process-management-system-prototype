const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3003;

// Log all requests
app.use((req, res, next) => {
  console.log(`[PROXY] ${req.method} ${req.originalUrl}`);
  next();
});

// API proxy - simple configuration
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  logLevel: 'debug'
});

// Frontend proxy - simple configuration  
const frontendProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'debug'
});

// Use API proxy first
app.use('/api', apiProxy);

// Use frontend proxy for everything else
app.use('/', frontendProxy);

app.listen(PORT, () => {
  console.log(`Simple proxy server running on port ${PORT}`);
  console.log(`API: /api/* -> http://localhost:3001`);
  console.log(`Frontend: /* -> http://localhost:3000`);
}); 