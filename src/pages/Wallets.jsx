import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, Search, Filter, Plus, ArrowRightLeft } from 'lucide-react';

export const Wallets = () => {
  const { db, currentUser, showToast } = useApp();
  const [walletSearch, setWalletSearch] = useState('');

  // Adjustment states
  const [targetWalletId, setTargetWalletId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustRemarks, setAdjustRemarks] = useState('');

  if (!currentUser) return null;

  // Filter wallets list
  const getFilteredWallets = () => {
    let list = db.wallets;

    // Staff / Super Staff / Manager / Owner only see their own wallet(s)
    if (['Staff', 'Super Staff', 'Manager', 'Owner'].includes(currentUser.role)) {
      list = list.filter(w => w.ownerId === currentUser.id);
    }

    // Accountant sees only wallets belonging to users at their assigned sites.
    // Only Admin sees all wallets globally.
    if (currentUser.role === 'Accountant') {
      const mySiteIds = new Set(
        (db.userSites || []).filter(us => us.userId === currentUser.id).map(us => us.siteId)
      );
      const visibleUserIds = new Set(
        (db.userSites || []).filter(us => mySiteIds.has(us.siteId)).map(us => us.userId)
      );
      list = list.filter(w => visibleUserIds.has(w.ownerId));
    }

    if (walletSearch) {
      const q = walletSearch.toLowerCase();
      list = list.filter(w => {
        const u = db.users.find(usr => usr.id === w.ownerId);
        return (u && u.name.toLowerCase().includes(q)) || w.id.toLowerCase().includes(q);
      });
    }

    return list;
  };

  const filteredWallets = getFilteredWallets();

  // Admin Adjustment Submit
  const handleAdjustmentSubmit = (e) => {
    e.preventDefault();
    if (!targetWalletId || !adjustAmount) {
      showToast('All adjustment fields required');
      return;
    }

    const amt = Number(adjustAmount);
    if (isNaN(amt)) {
      showToast('Enter valid amount');
      return;
    }

    const dbInst = JSON.parse(localStorage.getItem('coupon_system_db'));
    const wallet = dbInst.wallets.find(w => w.id === targetWalletId);
    if (!wallet) {
      showToast('Wallet not found');
      return;
    }

    // Adjust balance (can be positive or negative)
    wallet.balance += amt;

    // Log ledger entry
    const txId = 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    dbInst.transactions.unshift({
      id: txId,
      fromWalletId: amt >= 0 ? 'w-system' : targetWalletId,
      toWalletId: amt >= 0 ? targetWalletId : 'w-system',
      amount: Math.abs(amt),
      type: 'ADJUSTMENT',
      timestamp: new Date().toISOString(),
      remarks: adjustRemarks || `Admin balance adjustment of ${amt} AED`,
      createdByUserId: currentUser.id
    });

    // Save & Refresh
    localStorage.setItem('coupon_system_db', JSON.stringify(dbInst));
    showToast(`Wallet adjusted by ${amt} AED!`);
    window.location.reload();
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Wallet Balances</h1>
          <p className="page-subtitle">Inspect credit limits, transaction balances, and trigger treasury corrections</p>
        </div>
      </div>

      <div className="layout-grid-columns-3">
        {/* Wallet Adjustment Panel for Admin */}
        {currentUser.role === 'Admin' && (
          <div className="ui-card" style={{ gridColumn: 'span 1' }}>
            <div className="ui-card-header">
              <span className="ui-card-title">Balance Adjustments</span>
            </div>
            <div className="ui-card-body">
              <form onSubmit={handleAdjustmentSubmit} className="flex-direction-gap">
                <div className="form-input-wrapper">
                  <label className="form-field-label">Target Wallet</label>
                  <select 
                    className="select-dropdown-field"
                    value={targetWalletId}
                    onChange={(e) => setTargetWalletId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Wallet --</option>
                    {db.wallets.map(w => {
                      const userObj = db.users.find(u => u.id === w.ownerId);
                      const label = userObj ? `${userObj.name} (${w.ownerType})` : `${w.id} (${w.ownerType})`;
                      return (
                        <option key={w.id} value={w.id}>
                          {label} — {w.balance} AED
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-input-wrapper">
                  <label className="form-field-label">Adjustment Amount (AED)</label>
                  <input 
                    type="number" 
                    className="text-input-field" 
                    placeholder="e.g. 100 or -50" 
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-3)', fontSize: '0.68rem', marginTop: '0.2rem', display: 'block' }}>
                    Use positive numbers to add funds, negative to deduct.
                  </small>
                </div>

                <div className="form-input-wrapper">
                  <label className="form-field-label">Adjustment Remarks</label>
                  <textarea 
                    className="text-input-field" 
                    rows="2" 
                    placeholder="Reason for adjustment..." 
                    value={adjustRemarks}
                    onChange={(e) => setAdjustRemarks(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="action-btn btn-brand-blue" style={{ marginTop: '0.5rem' }}>
                  <ArrowRightLeft size={14} /> Adjust Balance
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Wallets List */}
        <div style={{ gridColumn: currentUser.role === 'Admin' ? 'span 2' : 'span 3' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.1rem', color: 'var(--text)' }}>Active Wallets</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {filteredWallets.map(w => {
              const userObj = db.users.find(u => u.id === w.ownerId);
              const name = userObj ? userObj.name : w.id;
              const sub = userObj ? `${userObj.role} Account` : w.ownerType;
              return (
                <div key={w.id} className="wallet-ui-card">
                  <div className="wallet-card-label">{sub}</div>
                  <div className="wallet-card-balance">
                    {w.balance}
                    <span className="wallet-card-currency">AED</span>
                  </div>
                  <div className="wallet-card-subtitle">
                    Owner: {name}
                    <br />
                    ID: <code style={{ fontSize: '0.7rem' }}>{w.id}</code>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
