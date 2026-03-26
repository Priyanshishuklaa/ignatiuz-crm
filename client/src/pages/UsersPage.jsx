// ============================================================
// USERS PAGE — Admin-only user management
// Full CRUD with create/edit modal
// ============================================================

import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', phone: '', department: '', designation: '' });

  // Fetch users on mount
  const fetchUsers = () => {
    api.get('/users')
      .then(res => setUsers(res.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchUsers, []);

  // Open modal for creating a new user
  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'client', phone: '', department: '', designation: '' });
    setShowModal(true);
  };

  // Open modal for editing an existing user
  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, phone: user.phone || '', department: user.department || '', designation: user.designation || '' });
    setShowModal(true);
  };

  // Handle form submission (create or update)
  const handleSubmit = async () => {
    try {
      if (editUser) {
        // Update existing user (password optional)
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editUser.id}`, payload);
        toast.success('User updated successfully');
      } else {
        // Create new user (password required)
        if (!form.password) return toast.error('Password is required for new users');
        await api.post('/users', form);
        toast.success('User created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  // Delete user with confirmation
  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'employee' ? 'badge-info' : 'badge-neutral'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.department || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.designation || '—'}</td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn-icon btn-ghost" onClick={() => openEdit(u)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon btn-ghost" onClick={() => handleDelete(u)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="table-empty">No users found</div>}
      </div>

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editUser ? 'Edit User' : 'Create User'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editUser ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password {editUser ? '(leave blank to keep)' : '*'}</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editUser ? 'Leave blank to keep current' : 'Min 6 characters'} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-000-0000" />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <input className="form-input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g., Sales" />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Designation</label>
            <input className="form-input" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g., Account Manager" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
