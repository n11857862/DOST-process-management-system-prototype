// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
server: {
  host: '0.0.0.0', // Allow external connections
  port: 3000,
  proxy: {
    '/api': {
      // Point to the Docker backend container
      target: 'http://dost-backend:5000',
      changeOrigin: true,
      secure: false,
      configure: (proxy, options) => {
        proxy.on('error', (err) => {
          console.log('Proxy error:', err);
        });
        proxy.on('proxyReq', (proxyReq, req) => {
          console.log('Proxying request:', req.method, req.url, '-> target:', options.target);
        });
      }
    }
  }
}
})