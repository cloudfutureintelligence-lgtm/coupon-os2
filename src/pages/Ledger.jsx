import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Search, Filter, RotateCcw, AlertTriangle } from 'lucide-react';

export const Ledger = () => {
  const { db, currentUser, reverseTransaction, showToast } = useApp();
  const [logSearch, setLogSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Reversal states
  const [reversalModalOpen, setReversalModalOpen] = useState(false);
  const [targetTx, setTargetTx] = useState(null);
  const [reversalReason, setReversalReason] = useState('');

  if (!currentUser) return null;

  const getFilteredTransactions = () => {
    let list = db.transactions;

    if (typeFilter !== 'all') {
      list = list.filter(t => t.type === typeFilter);
    }

    if (logSearch) {
      const q = logSearch.toLowerCase();
      list = list.filter(
        t => 
          t.id.toLowerCase().includes(q) || 
          t.remarks.toLowerCase().includes(q) ||
          t.fromWalletId.toLowerCase().includes(q) ||
          t.toWalletId.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const filteredTx = getFilteredTransactions();

  const handleOpenReversal = (tx) => {
    setTargetTx(tx);
    setReversalReason('');
    setReversalModalOpen(true);
  };

  const handleConfirmReversal = (e) => {
    e.preventDefault();
    if (!targetTx || !reversalReason) {
      showToast('Please specify a reversal reason');
      return;
    }

    try {
      reverseTransaction(targetTx.id, reversalReason);
      setReversalModalOpen(false);
      setTargetTx(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to check if a transaction was already reversed
  const isTxReversed = (txId) => {
    return db.transactions.some(t => t.type === 'REVERSAL' && t.relatedTransactionId === txId);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Financial Ledger</h1>
          <p className="page-subtitle">Historical log of all internal credit balances movements and wallet transfers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-container-row">
        <div className="filter-search-box">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search transaction description..." 
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
          />
        </div>

        <select 
          className="filter-dropdown-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Transaction Types</option>
          <option value="SALE">Sale</option>
          <option value="CASH_COLLECTION">Cash Collection</option>
          <option value="TRANSFER">Transfer</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="REVERSAL">Reversal</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tx ID</th>
              <th>From Wallet</th>
              <th>To Wallet</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Date & Time</th>
              <th>Description / Remarks</th>
              <th>Operator</th>
              {(currentUser.role === 'Admin' || currentUser.role === 'Accountant') && <th className="text-alignment-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredTx.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                  <div className="empty-view-title">No transactions logged</div>
                </td>
              </tr>
            ) : (
              filteredTx.map(tx => {
                const operatorUser = db.users.find(u => u.id === tx.createdByUserId);
                const wasReversed = isTxReversed(tx.id);

                let badgeClass = 'badge-neutral';
                if (tx.type === 'SALE') badgeClass = 'badge-success';
                if (tx.type === 'CASH_COLLECTION') badgeClass = 'badge-royal';
                if (tx.type === 'REVERSAL') badgeClass = 'badge-danger';
                if (tx.type === 'ADJUSTMENT') badgeClass = 'badge-warning';

                return (
                  <tr key={tx.id} style={{ opacity: wasReversed ? 0.55 : 1 }}>
                    <td className="td-monospaced td-emphasis">{tx.id}</td>
                    <td className="td-monospaced" style={{ fontSize: '0.72rem' }}>{tx.fromWalletId}</td>
                    <td className="td-monospaced" style={{ fontSize: '0.72rem' }}>{tx.toWalletId}</td>
                    <td style={{ fontWeight: 700 }}>{tx.amount} AED</td>
                    <td>
                      <span className={`pill-badge ${badgeClass}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="td-monospaced" style={{ fontSize: '0.75rem' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                      {tx.remarks} {wasReversed && <span style={{ color: 'var(--red)', fontWeight: 700 }}>(REVERSED)</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{operatorUser?.name || tx.createdByUserId}</td>
                    {(currentUser.role === 'Admin' || currentUser.role === 'Accountant') && (
                      <td className="td-actions">
                        {tx.type !== 'REVERSAL' && !wasReversed ? (
                          <button 
                            className="action-btn btn-outlined btn-sm"
                            onClick={() => handleOpenReversal(tx)}
                            style={{ color: 'var(--red)', borderColor: 'var(--red-border)' }}
                            title="Reverse Transaction"
                          >
                            <RotateCcw size={12} style={{ marginRight: '3px' }} /> Reverse
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontStyle: 'italic', paddingRight: '0.5rem' }}>
                            {wasReversed ? 'Reversed' : '-'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════
         MODAL: REVERSE TRANSACTION
      ═══════════════════════════════════════════ */}
      {reversalModalOpen && targetTx && (
        <div className="app-modal-backdrop modal-open-state">
          <div className="app-modal-window">
            <div className="app-modal-header">
              <span className="app-modal-title">Confirm Ledger Reversal</span>
              <button className="app-modal-close-btn" onClick={() => setReversalModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleConfirmReversal}>
              <div className="app-modal-body">
                <div className="alert-banner alert-danger-type">
                  <AlertTriangle />
                  <div>
                    <strong>Financial Reversal Warning!</strong> This action will append a new credit balance adjustment to the ledger. Deleting transactions is forbidden. Balances will be swapped.
                  </div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  <div>Transaction ID: <strong>{targetTx.id}</strong></div>
                  <div>Amount: <strong>{targetTx.amount} AED</strong></div>
                  <div>Details: <em>"{targetTx.remarks}"</em></div>
                </div>

                <div className="form-input-wrapper">
                  <label className="form-field-label">Reason for Reversal *</label>
                  <textarea 
                    className="text-input-field" 
                    rows="3" 
                    placeholder="Specify audit correction details..." 
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="app-modal-footer">
                <button type="button" className="action-btn btn-outlined" onClick={() => setReversalModalOpen(false)}>Cancel</button>
                <button type="submit" className="action-btn btn-brand-red">
                  Reverse Ledger Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
