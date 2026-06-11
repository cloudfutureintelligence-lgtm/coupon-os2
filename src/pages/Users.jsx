import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users as UsersIcon, Plus, ShieldCheck, Key, MapPin, Trash2 } from 'lucide-react';

export const Users = () => {
  const { db, addUser, deleteUser, showToast } = useApp();

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [password, setPassword] = useState('');
  const [selectedSites, setSelectedSites] = useState([]);

  const handleSiteCheckbox = (siteId) => {
    if (selectedSites.includes(siteId)) {
      setSelectedSites(selectedSites.filter(id => id !== siteId));
    } else {
      setSelectedSites([...selectedSites, siteId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !name || !password) {
      showToast('Please fill out all required fields');
      return;
    }

    addUser(
      {
        username,
        name,
        role,
        password
      },
      selectedSites
    );

    // Reset Form
    setUsername('');
    setName('');
    setRole('Staff');
    setPassword('');
    setSelectedSites([]);
  };

  const handleResetPassword = (userId) => {
    showToast(`Password for user ${userId} reset to default: "ChangeMe2026!"`);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">User Directory</h1>
          <p className="page-subtitle">Add new members, allocate roles, and map user access scopes</p>
        </div>
      </div>

      <div className="layout-grid-columns-3">
        {/* Create User Form */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Create User Account</span>
          </div>
          <div className="ui-card-body">
            <form onSubmit={handleSubmit} className="flex-direction-gap">
              <div className="form-input-wrapper">
                <label className="form-field-label">Full Name *</label>
                <input 
                  type="text" 
                  className="text-input-field" 
                  placeholder="e.g. John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-input-wrapper">
                <label className="form-field-label">Username *</label>
                <input 
                  type="text" 
                  className="text-input-field" 
                  placeholder="e.g. john_doe" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-columns-2">
                <div className="form-input-wrapper">
                  <label className="form-field-label">System Role *</label>
                  <select 
                    className="select-dropdown-field"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  >
                    <option value="Admin">Admin</option>
                    <option value="Owner">Owner</option>
                    <option value="Manager">Manager</option>
                    <option value="Super Staff">Super Staff</option>
                    <option value="Staff">Staff</option>
                    <option value="Accountant">Accountant</option>
                  </select>
                </div>
                <div className="form-input-wrapper">
                  <label className="form-field-label">Password *</label>
                  <input 
                    type="password" 
                    className="text-input-field" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Site Assignment Options */}
              {role !== 'Admin' && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="form-field-label" style={{ marginBottom: '0.4rem' }}>Assigned Site Scope(s)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {db.sites.map(site => (
                      <label key={site.id} className="flex-align-items-center" style={{ gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedSites.includes(site.id)}
                          onChange={() => handleSiteCheckbox(site.id)}
                        />
                        <span>{site.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" className="action-btn btn-brand-blue" style={{ marginTop: '0.5rem' }}>
                <Plus size={14} /> Create User
              </button>
            </form>
          </div>
        </div>

        {/* Users Directory List */}
        <div className="ui-card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Registered System Accounts</span>
          </div>
          <div className="ui-card-body" style={{ padding: 0 }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Detail</th>
                    <th>Role</th>
                    <th>Tenant Scope(s)</th>
                    <th>2FA status</th>
                    <th className="text-alignment-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {db.users.map(u => {
                    const assignedSiteNames = db.userSites
                      .filter(us => us.userId === u.id)
                      .map(us => db.sites.find(s => s.id === us.siteId)?.name)
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>@{u.username}</div>
                        </td>
                        <td>
                          <span className={`pill-badge badge-${u.role === 'Admin' ? 'danger' : (u.role === 'Accountant' ? 'purple' : 'info')}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{u.role === 'Admin' ? 'Global Access' : (assignedSiteNames || 'None')}</td>
                        <td>
                          <span className={`pill-badge badge-${u.twoFAEnabled ? 'success' : 'neutral'}`}>
                            {u.twoFAEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="td-actions" style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="action-btn btn-outlined btn-sm"
                            onClick={() => handleResetPassword(u.id)}
                            title="Reset password to default"
                          >
                            <Key size={12} style={{ marginRight: '3px' }} /> Reset PW
                          </button>
                          {u.id !== 'u-sysadmin' && (
                            <button 
                              className="action-btn btn-danger btn-sm"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete user ${u.name}?`)) {
                                  deleteUser(u.id);
                                }
                              }}
                              title="Delete user account"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
