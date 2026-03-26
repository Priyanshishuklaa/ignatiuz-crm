// ============================================================
// AUTH CONTEXT — Global authentication state
// Wraps the entire app. Any component can access user info.
// Uses React Context + useReducer pattern.
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

// Create the context object
const AuthContext = createContext(null);

// ============================================================
// AuthProvider — Wraps the app and provides auth state
// ============================================================
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load, check if we have a saved token and validate it
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const savedUser = localStorage.getItem('crm_user');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Invalid saved data, clear it
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
      }
    }
    setLoading(false);
  }, []);

  // ---- Login function ----
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data;

    // Save token and user to localStorage (persists across page reloads)
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  // ---- Logout function ----
  const logout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setUser(null);
  };

  // ---- Computed properties ----
  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// useAuth hook — Easy access to auth state from any component
// Usage: const { user, isAdmin, login, logout } = useAuth();
// ============================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
