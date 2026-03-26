// ============================================================
// AXIOS INSTANCE — Centralized HTTP client
// Auto-attaches JWT token to every request.
// On 401 (unauthorized), auto-redirects to login.
// ============================================================

import axios from 'axios';

// Create a custom Axios instance pointing at our API
const api = axios.create({
  baseURL: 'http://localhost:5000/api',  // Backend server URL
  headers: { 'Content-Type': 'application/json' }
});

// ============================================================
// REQUEST INTERCEPTOR — Runs before every API call
// Attaches the JWT token from localStorage
// ============================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// RESPONSE INTERCEPTOR — Runs after every API response
// If the server returns 401, the token is expired or invalid.
// We clear it and redirect to login.
// ============================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      // Only redirect if not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
