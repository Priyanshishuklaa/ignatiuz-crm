// ============================================================
// PROTECTED ROUTE — Guards routes that require authentication
// Redirects to /login if user is not logged in
// ============================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  // Not logged in → redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Route requires admin but user isn't admin → redirect to dashboard
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
