import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';

export const AuditLogs = () => {
  const { db, showToast } = useApp();
  const [filterAction, setFilterAction] = useState('all');
  const [logSearch, setLogSearch] = useState('');

  // Get unique actions for filter options
  const getUniqueActions = () => {
    const actions = db.auditLogs.map(log => log.action);
    return ['all', ...new Set(actions)];
  };

  const getFilteredLogs = () => {
    let list = db.auditLogs;

    if (filterAction !== 'all') {
      list = list.filter(log => log.action === filterAction);
    }

    if (logSearch) {
      const q = logSearch.toLowerCase();
      list = list.filter(
        log => 
          log.details.toLowerCase().includes(q) || 
          log.action.toLowerCase().includes(q) ||
          log.userId.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const filteredLogs = getFilteredLogs();

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">System Audit Logs</h1>
          <p className="page-subtitle">Immutable chronological journal of administrative, operational, and financial transactions</p>
        </div>
        <button 
          className="action-btn btn-outlined" 
          onClick={() => {
            showToast('Audit logs feed refreshed');
            window.location.reload();
          }}
        >
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      {/* Filters */}
      <div className="filters-container-row">
        <div className="filter-search-box">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search details or operators..." 
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
          />
        </div>

        <select 
          className="filter-dropdown-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="all">All Action Types</option>
          {getUniqueActions().filter(a => a !== 'all').map(act => (
            <option key={act} value={act}>{act}</option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Event</th>
              <th>Operator ID</th>
              <th>Detailed Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                  <div className="empty-view-title">No audit records found</div>
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const operatorUser = db.users.find(u => u.id === log.userId);
                
                let actionBadgeClass = 'badge-neutral';
                if (log.action.includes('SALE')) actionBadgeClass = 'badge-success';
                if (log.action.includes('COLLECTION')) actionBadgeClass = 'badge-royal';
                if (log.action.includes('REVERSAL')) actionBadgeClass = 'badge-danger';
                if (log.action.includes('ASSIGN')) actionBadgeClass = 'badge-info';
                if (log.action.includes('CREATION')) actionBadgeClass = 'badge-royal';

                return (
                  <tr key={log.id}>
                    <td className="td-monospaced" style={{ fontSize: '0.75rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className={`pill-badge ${actionBadgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{operatorUser?.name || log.userId}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{log.details}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
