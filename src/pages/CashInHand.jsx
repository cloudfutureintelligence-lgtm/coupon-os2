import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, TrendingUp, Users, DollarSign } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Cash In Hand — shows all staff/users who have a wallet balance > 0
// Sorted by highest balance first
// Visible to: Super Staff (own site), Manager (assigned sites),
//             Owner, Accountant, Admin (all sites)
// ─────────────────────────────────────────────────────────────────────────────

export const CashInHand = () => {
  const { db, currentUser } = useApp();

  if (!currentUser) return null;
  const role = currentUser.role;

  // Visible site IDs for this user
  const visibleSiteIds = useMemo(() => {
    if (role === 'Admin' || role === 'Owner' || role === 'Accountant') {
      return db.sites.map(s => s.id);
    }
    return db.userSites
      .filter(us => us.userId === currentUser.id)
      .map(us => us.siteId);
  }, [db, currentUser, role]);

  // Roles visible to each viewer
  const visibleRoles = useMemo(() => {
    if (role === 'Super Staff') return ['Staff'];
    if (role === 'Manager')     return ['Staff', 'Super Staff'];
    if (role === 'Owner')       return ['Staff', 'Super Staff', 'Manager'];
    if (role === 'Accountant')  return ['Staff', 'Super Staff', 'Manager', 'Owner'];
    if (role === 'Admin')       return ['Staff', 'Super Staff', 'Manager', 'Owner', 'Accountant'];
    return [];
  }, [role]);

  // Build the list: one entry per user who has a wallet with balance > 0
  const entries = useMemo(() => {
    const map = {};

    db.wallets.forEach(w => {
      if (!w.ownerType || !w.ownerType.startsWith('USER')) return;
      if (w.ownerId === 'SYSTEM') return;
      if (w.siteId && !visibleSiteIds.includes(w.siteId)) return;
      if (!w.balance || w.balance <= 0) return;

      // Only include users whose role is in visibleRoles
      const user = db.users.find(u => u.id === w.ownerId);
      if (!user || !visibleRoles.includes(user.role)) return;

      const key = w.ownerId;
      if (!map[key]) map[key] = { userId: w.ownerId, totalBalance: 0, wallets: [] };
      map[key].totalBalance += w.balance;
      map[key].wallets.push(w);
    });

    return Object.values(map)
      .sort((a, b) => b.totalBalance - a.totalBalance)
      .map(entry => {
        const user = db.users.find(u => u.id === entry.userId);
        const sites = entry.wallets.map(w => {
          const site = db.sites.find(s => s.id === w.siteId);
          return { siteName: site?.name || w.siteId, balance: w.balance };
        });
        return { ...entry, user, sites };
      });
  }, [db, visibleSiteIds]);

  const totalCashInHand = entries.reduce((s, e) => s + e.totalBalance, 0);
  const rankColors = ['#f59e0b', '#9ca3af', '#b45309']; // gold, silver, bronze

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Cash In Hand</h1>
          <p className="page-subtitle">Staff with uncollected cash — highest balance first</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Total Cash In Hand</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--yellow-light)', color: 'var(--yellow)' }}>
              <DollarSign size={14} />
            </div>
          </div>
          <div className="metric-value-text">{totalCashInHand.toLocaleString()} AED</div>
          <div className="metric-sub-detail">Across all staff</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Staff with Cash</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
              <Users size={14} />
            </div>
          </div>
          <div className="metric-value-text">{entries.length}</div>
          <div className="metric-sub-detail">Pending collection</div>
        </div>
        {entries.length > 0 && (
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label-text">Highest Balance</span>
              <div className="metric-icon-wrapper" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                <TrendingUp size={14} />
              </div>
            </div>
            <div className="metric-value-text">{entries[0].totalBalance.toLocaleString()} AED</div>
            <div className="metric-sub-detail">{entries[0].user?.name || '—'}</div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="ui-card">
        <div className="ui-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Wallet size={13} />
            <span className="ui-card-title">Staff Cash Balances</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {entries.length} staff · Sorted by highest
          </span>
        </div>

        <div className="data-table-container" style={{ marginTop: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Site(s)</th>
                <th style={{ textAlign: 'right' }}>Cash In Hand</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                    <div className="empty-view-title">No cash in hand</div>
                    <div className="empty-view-description">All staff wallets are empty or cleared</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr key={entry.userId}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: idx < 3 ? rankColors[idx] : 'var(--surface-2)',
                        color: idx < 3 ? '#fff' : 'var(--text-3)',
                        fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%',
                          background: 'var(--brand-blue)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {(entry.user?.name || '?')[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {entry.user?.name || entry.userId}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="pill-badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {entry.user?.role || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                      {entry.sites.map((s, i) => (
                        <span key={i}>
                          {s.siteName}
                          {entry.sites.length > 1 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginLeft: '0.2rem' }}>
                              ({s.balance} AED)
                            </span>
                          )}
                          {i < entry.sites.length - 1 && ', '}
                        </span>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: entry.totalBalance > 500 ? 'var(--red)' : entry.totalBalance > 200 ? 'var(--yellow)' : 'var(--green)',
                      }}>
                        {entry.totalBalance.toLocaleString()} AED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
