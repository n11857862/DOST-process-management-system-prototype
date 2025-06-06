import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

console.log(`API Base URL set to: ${baseURL}`);

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',

  },
});

apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API_CLIENT] Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    if (config.headers.Authorization) {
      console.log(`[API_CLIENT] Authorization header present: ${config.headers.Authorization.substring(0, 20)}...`);
    } else {
      console.log(`[API_CLIENT] No Authorization header found`);
    }
    return config;
  },
  (error) => {
    console.error('[API_CLIENT] Request error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API call error:', error.response || error.message);
    return Promise.reject(error);
  }
);


export default apiClient;
