// ============================================================
// LOGIN PAGE — Entry point for all users
// Shows a clean login form with demo account quick-fills.
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick-fill demo credentials
  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Zap size={18} color="white" />
          </div>
          <span className="login-logo-text">Ignatiuz CRM</span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your account to continue</p>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts */}
        <div className="login-demo">
          <div className="login-demo-title">Demo Accounts</div>
          <div className="login-demo-accounts">
            <div className="login-demo-account" onClick={() => fillDemoAccount('admin@crm.com', 'admin123')}>
              <div>
                <strong>Admin</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>admin@crm.com</span>
              </div>
              <span className="badge badge-success">Full Access</span>
            </div>
            <div className="login-demo-account" onClick={() => fillDemoAccount('sarah@crm.com', 'client123')}>
              <div>
                <strong>Client</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>sarah@crm.com</span>
              </div>
              <span className="badge badge-info">Read Only</span>
            </div>
            <div className="login-demo-account" onClick={() => fillDemoAccount('mike@crm.com', 'employee123')}>
              <div>
                <strong>Employee</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>mike@crm.com</span>
              </div>
              <span className="badge badge-info">Read Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
