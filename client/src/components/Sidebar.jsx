// ============================================================
// SIDEBAR — Collapsible navigation sidebar
// Shows icon-only when collapsed, expands on hover.
// Active link is highlighted based on current route.
// ============================================================

import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Building2, Target, FileText, LogOut, Zap
} from 'lucide-react';

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();

  // Navigation items — each maps to a route
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    // Users page is admin-only
    ...(isAdmin ? [{ to: '/users', icon: Users, label: 'Users' }] : []),
    { to: '/clients', icon: Building2, label: 'Clients' },
    { to: '/opportunities', icon: Target, label: 'Opportunities' },
    { to: '/invoices', icon: FileText, label: 'Invoices' }
  ];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={14} color="white" />
        </div>
        <span className="sidebar-logo-text">Ignatiuz CRM</span>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={logout} title="Click to logout">
          <div className="sidebar-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
