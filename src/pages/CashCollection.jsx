import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, DollarSign, Users, Loader2 } from 'lucide-react';

// FIX 5: Full role-based cash collection hierarchy
// Super Staff  → collect from Staff
// Manager      → collect from Staff + Super Staff
// Owner        → collect from Staff + Super Staff + Manager
// Accountant   → collect from Staff + Super Staff + Manager + Owner

const ROLE_CAN_COLLECT_FROM = {
  'Super Staff': ['Staff'],
  'Manager':     ['Staff', 'Super Staff'],
  'Owner':       ['Staff', 'Super Staff', 'Manager'],
  'Accountant':  ['Staff', 'Super Staff', 'Manager', 'Owner'],
  'Admin':       ['Staff', 'Super Staff', 'Manager', 'Owner'],
};

// Wallet type per role (where their cash accumulates)
// Staff sales go into USER_SALES wallet (w-{id}-sales)
// Super Staff and Manager can also sell directly, accumulating a USER_SALES wallet,
// in addition to their USER_COLLECTION wallet from collecting cash off others.
// All other roles accumulate collections in USER_COLLECTION wallet (w-{id}-collection)
const ROLE_WALLET_TYPE = {
  'Staff':       'USER_SALES',
  'Super Staff': 'USER_COLLECTION',
  'Manager':     'USER_COLLECTION',
  'Owner':       'USER_COLLECTION',
  'Accountant':  'USER_COLLECTION',
  'Admin':       'USER_COLLECTION',
};

// Wallet ID suffix per role (to correctly look up the wallet)
const ROLE_WALLET_SUFFIX = {
  'Staff':       '-sales',
  'Super Staff': '-collection',
  'Manager':     '-collection',
  'Owner':       '-collection',
  'Accountant':  '-collection',
  'Admin':       '-collection',
};

export const CashCollection = () => {
  const {
    db,
    currentUser,
    collectCashFromStaff,
    collectCashFromSuperStaff,
    collectCashFromManager,
    collectCashFromOwner,
    showToast,
  } = useApp();

  // Active "from-role" tab
  const [activeFromRole, setActiveFromRole] = useState(null);

  // Generic collection form state
  const [targetUserId, setTargetUserId] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [collectRemarks, setCollectRemarks] = useState('');

  // Double-submit guard — ref blocks re-entry immediately, state updates UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  // Accountant / Super Staff splits (for Super Staff source)
  const [splits, setSplits] = useState([]);
  React.useEffect(() => {
    if (db.sites) setSplits(db.sites.map(s => ({ siteId: s.id, amount: '' })));
  }, [db.sites]);

  if (!currentUser) return null;

  const myRole = currentUser.role;
  const collectableRoles = ROLE_CAN_COLLECT_FROM[myRole] || [];

  if (collectableRoles.length === 0) {
    return (
      <div>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Cash Collection</h1>
            <p className="page-subtitle">Your role does not have cash collection permissions</p>
          </div>
        </div>
      </div>
    );
  }

  // Initialize active tab on first render
  if (!activeFromRole) {
    setActiveFromRole(collectableRoles[0]);
    return null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Get users of a given role that share at least one site with current user.
  // Rule: ONLY Admin sees all users globally.
  // Every other role — including Accountant, Owner, Manager, Super Staff —
  // is strictly limited to users assigned to at least one of their own sites.
  const getUsersByRole = (role) => {
    if (myRole === 'Admin') {
      return db.users.filter(u => u.role === role);
    }
    const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    return db.users.filter(u => {
      if (u.role !== role) return false;
      const userSites = db.userSites.filter(us => us.userId === u.id).map(us => us.siteId);
      return userSites.some(sid => mySiteIds.includes(sid));
    });
  };

  const getWalletBalance = (userId, role) => {
    // Super Staff AND Manager can both accumulate two wallets: their own sales (-sales,
    // from selling coupons directly) + cash collected from others (-collection).
    // Both are drained together when someone collects from them, so show the combined total.
    if (role === 'Super Staff' || role === 'Manager') {
      const sales      = db.wallets.find(w => w.id === 'w-' + userId + '-sales');
      const collection = db.wallets.find(w => w.id === 'w-' + userId + '-collection');
      return (sales?.balance || 0) + (collection?.balance || 0);
    }
    const suffix = ROLE_WALLET_SUFFIX[role] || '-collection';
    const walletId = 'w-' + userId + suffix;
    const w = db.wallets.find(w => w.id === walletId);
    return w?.balance || 0;
  };

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleCollect = async (e) => {
    e.preventDefault();
    // ref check blocks re-entry immediately (before React re-render)
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);

    const amt = Number(collectAmount);

    if (!targetUserId || isNaN(amt) || amt <= 0) {
      showToast('Select a user and enter a valid amount');
      submitInFlightRef.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      const siteId = db.userSites.find(us => us.userId === targetUserId)?.siteId || null;

      if (activeFromRole === 'Staff') {
        await collectCashFromStaff(targetUserId, amt, siteId, collectRemarks);
      } else if (activeFromRole === 'Super Staff') {
        const fallbackSiteId = db.userSites.find(us => us.userId === targetUserId)?.siteId || (db.sites[0]?.id);
        await collectCashFromSuperStaff(targetUserId, [{ siteId: fallbackSiteId, amount: amt }], collectRemarks);
      } else if (activeFromRole === 'Manager') {
        await collectCashFromManager(targetUserId, amt, siteId, collectRemarks);
      } else if (activeFromRole === 'Owner') {
        await collectCashFromOwner(targetUserId, amt, siteId, collectRemarks);
      }

      // Reset form
      setTargetUserId('');
      setCollectAmount('');
      setCollectRemarks('');
      setSplits(db.sites.map(s => ({ siteId: s.id, amount: '' })));
    } catch (err) {
      console.error(err);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const targetUsers = getUsersByRole(activeFromRole);
  const selectedUserBalance = targetUserId ? getWalletBalance(targetUserId, activeFromRole) : null;
  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Cash Collection</h1>
          <p className="page-subtitle">Collect and transfer cash according to your role permissions</p>
        </div>
      </div>

      {/* Role tabs — one per collectable-from role */}
      <div className="tab-controls-row" style={{ marginBottom: '1.5rem' }}>
        {collectableRoles.map(role => (
          <div
            key={role}
            className={`tab-control-item ${activeFromRole === role ? 'active' : ''}`}
            onClick={() => {
              setActiveFromRole(role);
              setTargetUserId('');
              setCollectAmount('');
              setCollectRemarks('');
            }}
          >
            Collect from {role}
          </div>
        ))}
      </div>

      <div className="layout-grid-columns-3">
        {/* ── Collection Form ── */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">
              <Users size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Collect from {activeFromRole}
            </span>
          </div>
          <div className="ui-card-body">
            <form onSubmit={handleCollect} className="flex-direction-gap">
              {/* User selector */}
              <div className="form-input-wrapper">
                <label className="form-field-label">Select {activeFromRole}</label>
                <select
                  className="select-dropdown-field"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  required
                >
                  <option value="">-- Choose {activeFromRole} --</option>
                  {targetUsers.map(user => {
                    const bal = getWalletBalance(user.id, activeFromRole);
                    return (
                      <option key={user.id} value={user.id}>
                        {user.name} (Wallet: {bal} AED)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Balance indicator */}
              {selectedUserBalance !== null && (
                <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.82rem' }}>
                  <span>Available balance: </span>
                  <strong style={{ color: 'var(--green)' }}>{selectedUserBalance} AED</strong>
                </div>
              )}

              {/* Amount to collect */}
              <div className="form-input-wrapper">
                <label className="form-field-label">Amount to Collect (AED)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    className="text-input-field"
                    placeholder="0.00"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    min="1"
                    required
                    style={{ flex: 1 }}
                  />
                  {selectedUserBalance > 0 && (
                    <button
                      type="button"
                      className="action-btn"
                      style={{ whiteSpace: 'nowrap', padding: '0 0.75rem', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.78rem', cursor: 'pointer' }}
                      onClick={() => setCollectAmount(String(selectedUserBalance))}
                    >
                      Collect All
                    </button>
                  )}
                </div>
              </div>

              <div className="form-input-wrapper">
                <label className="form-field-label">Remarks</label>
                <textarea
                  className="text-input-field"
                  rows="2"
                  placeholder="Collection notes..."
                  value={collectRemarks}
                  onChange={(e) => setCollectRemarks(e.target.value)}
                />
              </div>

              <button type="submit" className="action-btn btn-brand-blue" style={{ marginTop: '0.5rem' }} disabled={isSubmitting}>
                {isSubmitting
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing…</>
                  : <><DollarSign size={14} /> Collect & Log</>}
              </button>
            </form>
          </div>
        </div>

        {/* ── Recent Collections Ledger ── */}
        <div className="ui-card" style={{ gridColumn: 'span 2' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Recent Cash Collections</span>
          </div>
          <div className="ui-card-body" style={{ padding: 0 }}>
            {(!db.cashCollections || db.cashCollections.length === 0) ? (
              <div className="empty-view-state">
                <div className="empty-view-title">No cash collections logged yet</div>
              </div>
            ) : (
              db.cashCollections.slice(0, 10).map(cc => {
                const fromUser = db.users.find(u => u.id === cc.collected_from_user_id || u.id === cc.collectedFromUserId);
                const byUser = db.users.find(u => u.id === cc.collected_by_user_id || u.id === cc.collectedByUserId);
                const ts = cc.timestamp || cc.created_at;
                return (
                  <div
                    key={cc.id}
                    className="flex-align-items-center flex-justify-space-between"
                    style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)' }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                        From: {fromUser?.name || cc.collected_from_user_id || cc.collectedFromUserId}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                        By: {byUser?.name || cc.collected_by_user_id || cc.collectedByUserId}
                        {ts && ` • ${new Date(ts).toLocaleString()}`}
                        {cc.remarks && ` • "${cc.remarks}"`}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--green)' }}>
                      {cc.amount} AED
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
