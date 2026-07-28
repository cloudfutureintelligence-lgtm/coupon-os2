import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Ticket, 
  Search, 
  Plus, 
  Upload, 
  History, 
  MapPin, 
  Tag, 
  Filter, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Trash2,
  CheckSquare
} from 'lucide-react';

const PAGE_SIZE = 50;
const STATUS_ORDER = { Available: 0, Sold: 1, Expired: 2, Cancelled: 3 };

export const Coupons = () => {
  const { 
    db, 
    currentUser, 
    selectedSiteId, 
    importCoupons,
    deleteCoupon,
    bulkDeleteCoupons,
    isSiteActive,
    showToast,
    getCouponHistory
  } = useApp();

  // Search & Filter state
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState('manual');
  
  // Manual form
  const [manualCode, setManualCode] = useState('');
  const [manualProfileId, setManualProfileId] = useState('');
  const [manualSiteId, setManualSiteId] = useState('');
  const [manualCost, setManualCost] = useState('');
  const [manualSale, setManualSale] = useState('');

  // CSV Import state
  const [csvContent, setCsvContent] = useState('');
  const [csvSiteId, setCsvSiteId] = useState('');
  const [csvProfileId, setCsvProfileId] = useState('');

  // API Import states
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSiteId, setApiSiteId] = useState('');
  const [apiProfileId, setApiProfileId] = useState('');

  // Selected coupon for history details
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleViewHistory = async (coupon) => {
    setSelectedCoupon(coupon);
    setLoadingHistory(true);
    setHistoryLogs([]);
    try {
      const logs = await getCouponHistory(coupon.id);
      setHistoryLogs(logs);
    } catch (e) {
      showToast('Error loading coupon history');
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'Admin';

  // ═══════════════════════════════════════════
  // Non-Admin Restricted View (Hides Unsold Codes)
  // ═══════════════════════════════════════════
  if (!isAdmin) {
    const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    
    return (
      <div>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Available Packages Stock</h1>
            <p className="page-subtitle">Summary of active coupon templates and available counts in site pools</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          {db.sites.filter(s => mySiteIds.includes(s.id)).map(site => {
            return (
              <div key={site.id} className="ui-card" style={{ marginBottom: 0 }}>
                <div className="ui-card-header">
                  <div className="flex-align-items-center" style={{ gap: '0.4rem' }}>
                    <MapPin size={14} style={{ color: 'var(--blue)' }} />
                    <span style={{ fontWeight: 700 }}>{site.name} Pool</span>
                  </div>
                  <span className="pill-badge badge-info">{site.location}</span>
                </div>
                <div className="ui-card-body" style={{ padding: '0.75rem 1rem' }}>
                  {db.couponProfiles.map(prof => {
                    const count = db.coupons.filter(c => c.siteId === site.id && c.profileId === prof.id && c.status === 'Available').length;
                    const override = db.sitePrices?.find(sp => sp.siteId === site.id && sp.profileId === prof.id);
                    const price = override ? override.salePrice : prof.salePrice;

                    return (
                      <div key={prof.id} className="flex-align-items-center flex-justify-space-between" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{prof.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Retail price: <strong style={{ color: 'var(--green)' }}>{price} AED</strong></div>
                        </div>
                        <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Stock:</span>
                          <span className={`pill-badge ${count > 0 ? 'badge-success' : 'badge-danger'}`} style={{ minWidth: '50px', textAlign: 'center' }}>
                            {count} units
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Get accessible coupons (Admin only view)
  const getFilteredCoupons = () => {
    let list = db.coupons;

    // Filter by navbar site selector
    if (selectedSiteId !== 'all') {
      list = list.filter(c => c.siteId === selectedSiteId);
    }

    // Local filters
    if (localSearch) {
      const q = localSearch.toLowerCase();
      list = list.filter(c => c.code.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      list = list.filter(c => c.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (profileFilter !== 'all') {
      list = list.filter(c => c.profileId === profileFilter);
    }

    return list;
  };

  const filteredCoupons = useMemo(() => {
    const list = getFilteredCoupons();
    list.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return list;
  }, [db.coupons, selectedSiteId, localSearch, statusFilter, profileFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / PAGE_SIZE));
  const pageStart  = (currentPage - 1) * PAGE_SIZE;
  const pageRows   = filteredCoupons.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  const pageBtnStyle = (active) => ({
    minWidth: '32px', height: '32px', padding: '0 0.4rem',
    borderRadius: '4px', border: '1px solid var(--border)',
    background: active ? 'var(--brand-blue)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-2)',
    fontWeight: active ? 700 : 400, fontSize: '0.78rem',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  });

  // Handle Manual Add Submit
  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!manualCode || !manualProfileId || !manualSiteId) {
      showToast('Please fill out all required fields');
      return;
    }
    
    // Format: code, profileId, costPrice, salePrice
    const csvLine = `${manualCode.trim()}, ${manualProfileId}, ${manualCost || ''}, ${manualSale || ''}`;
    const res = importCoupons([csvLine], manualSiteId);
    if (res && res.success && res.count > 0) {
      setManualCode('');
      setAddModalOpen(false);
    }
  };

  // Handle CSV Paste Submit
  const handleCsvImport = () => {
    if (!csvContent || !csvSiteId || !csvProfileId) {
      showToast('Please fill out site, profile and paste coupon codes');
      return;
    }
    const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
    const csvLines = lines.map(code => `${code}, ${csvProfileId}`);
    const res = importCoupons(csvLines, csvSiteId);
    if (res && res.success && res.count > 0) {
      setCsvContent('');
      setAddModalOpen(false);
    }
  };

  // Mock API connection check and pull
  const handleApiImport = () => {
    if (!apiEndpoint || !apiSiteId || !apiProfileId) {
      showToast('Enter API url and select site and profile');
      return;
    }
    showToast('Testing mock endpoint...');
    setTimeout(() => {
      const mockCodes = [
        `API-${Math.floor(100000+Math.random()*900000)}`,
        `API-${Math.floor(100000+Math.random()*900000)}`
      ];
      const csvLines = mockCodes.map(code => `${code}, ${apiProfileId}`);
      importCoupons(csvLines, apiSiteId);
      setAddModalOpen(false);
    }, 1200);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Coupon Stock Ledger</h1>
          <p className="page-subtitle">Track, import, and audit secure code batches across sites</p>
        </div>
        <div className="page-actions-group">
          {selectedIds.size > 0 && (
            <button className="action-btn" style={{ background: 'var(--red)', color: '#fff', border: 'none' }} onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.size})
            </button>
          )}
          <button className="action-btn btn-brand-blue" onClick={() => setAddModalOpen(true)}>
            <Plus size={14} /> Add Coupons
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filters-container-row">
        <div className="filter-search-box">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search coupon code..." 
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <select 
          className="filter-dropdown-select" 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Sold">Sold</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Expired">Expired</option>
        </select>

        <select 
          className="filter-dropdown-select" 
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
        >
          <option value="all">All Profiles</option>
          {db.couponProfiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>
                <input
                  type="checkbox"
                  checked={filteredCoupons.length > 0 && filteredCoupons.every(c => selectedIds.has(c.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredCoupons.map(c => c.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  title="Select all"
                />
              </th>
              <th>Coupon Code</th>
              <th>Profile Pack</th>
              <th>Site Tenant</th>
              <th>Cost Price</th>
              <th>Retail Price</th>
              <th>Status</th>
              <th className="text-alignment-right">Audits</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                  <div className="empty-view-title">No coupons found</div>
                  <div className="empty-view-description">Adjust your search filters or add a new coupon batch</div>
                </td>
              </tr>
            ) : (
              pageRows.map((coupon, idx) => {
                const profile = db.couponProfiles.find(p => p.id === coupon.profileId);
                const site = db.sites.find(s => s.id === coupon.siteId);
                
                let statusBadgeClass = 'badge-neutral';
                if (coupon.status === 'Available') statusBadgeClass = 'badge-success';
                if (coupon.status === 'Sold') statusBadgeClass = 'badge-royal';
                if (coupon.status === 'Cancelled') statusBadgeClass = 'badge-danger';
                if (coupon.status === 'Expired') statusBadgeClass = 'badge-warning';

                return (
                  <tr key={coupon.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(coupon.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(coupon.id);
                          else next.delete(coupon.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="td-monospaced td-emphasis">{coupon.code}</td>
                    <td>{profile?.name || coupon.profileId}</td>
                    <td>{site?.name || '-'}</td>
                    <td>{coupon.cost} AED</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>
                      {coupon.isFree
                        ? <span className="pill-badge badge-info">FREE</span>
                        : `${coupon.salePrice} AED`}
                    </td>
                    <td>
                      <span className={`pill-badge ${statusBadgeClass}`}>
                        {coupon.status}
                      </span>
                    </td>
                    <td className="td-actions">
                      <button 
                        className="action-icon-btn action-btn-sm" 
                        onClick={() => handleViewHistory(coupon)}
                        title="View Audit Trail"
                      >
                        <History size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          background: 'var(--surface)', borderRadius: '0 0 var(--radius) var(--radius)',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCoupons.length)} of {filteredCoupons.length} coupons &nbsp;·&nbsp; {PAGE_SIZE} per page
          </span>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <button style={pageBtnStyle(false)} disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p); return acc;
              }, [])
              .map((p, i) => p === '...'
                ? <span key={`e${i}`} style={{ fontSize: '0.78rem', color: 'var(--text-3)', padding: '0 0.2rem' }}>…</span>
                : <button key={p} style={pageBtnStyle(p === currentPage)} onClick={() => goToPage(p)}>{p}</button>
              )}
            <button style={pageBtnStyle(false)} disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
         MODAL: ADD COUPONS
      ═══════════════════════════════════════════ */}
      {addModalOpen && (
        <div className="app-modal-backdrop modal-open-state">
          <div className="app-modal-window">
            <div className="app-modal-header">
              <span className="app-modal-title">Batch Stock Generation</span>
              <button className="app-modal-close-btn" onClick={() => setAddModalOpen(false)}>×</button>
            </div>
            
            <div className="app-modal-body">
              <div className="tab-controls-row">
                <div 
                  className={`tab-control-item ${activeAddTab === 'manual' ? 'active' : ''}`}
                  onClick={() => setActiveAddTab('manual')}
                >
                  Manual Entry
                </div>
                <div 
                  className={`tab-control-item ${activeAddTab === 'csv' ? 'active' : ''}`}
                  onClick={() => setActiveAddTab('csv')}
                >
                  CSV Paste Upload
                </div>
                <div 
                  className={`tab-control-item ${activeAddTab === 'api' ? 'active' : ''}`}
                  onClick={() => setActiveAddTab('api')}
                >
                  API Import Sync
                </div>
              </div>

              {activeAddTab === 'manual' && (
                <form onSubmit={handleManualAdd}>
                  <div className="form-grid-columns-2">
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Site Tenant *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={manualSiteId}
                        onChange={(e) => {
                          const sid = e.target.value;
                          setManualSiteId(sid);
                          // Reset profile — new site may have different assigned profiles
                          setManualProfileId('');
                          setManualCost('');
                          setManualSale('');
                        }}
                        required
                      >
                        <option value="">-- Select Site --</option>
                        {db.sites.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Profile Pack Template *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={manualProfileId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setManualProfileId(pid);
                          if (manualSiteId && pid) {
                            const profile = db.couponProfiles.find(p => p.id === pid);
                            const override = db.sitePrices?.find(sp => sp.siteId === manualSiteId && sp.profileId === pid);
                            setManualCost(override ? override.costPrice : profile?.costPrice || '');
                            setManualSale(override ? override.salePrice : profile?.salePrice || '');
                          }
                        }}
                        required
                      >
                        <option value="">-- Select Profile --</option>
                        {db.couponProfiles
                          .filter(p => !manualSiteId || db.sitePrices?.some(sp => sp.siteId === manualSiteId && sp.profileId === p.id))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                      {manualSiteId && db.sitePrices?.filter(sp => sp.siteId === manualSiteId).length === 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--yellow)', marginTop: '0.25rem', display: 'block' }}>
                          No profiles assigned to this site yet.
                        </span>
                      )}
                      {manualSiteId && !isSiteActive(db.sites.find(s => s.id === manualSiteId)) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                          Subscription expired for this site — renew it before adding stock.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-input-wrapper" style={{ marginTop: '0.5rem' }}>
                    <label className="form-field-label">Coupon Code *</label>
                    <input 
                      type="text" 
                      className="text-input-field" 
                      placeholder="CP-XXXXXX"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-grid-columns-2" style={{ marginTop: '0.5rem' }}>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Cost Price (AED)</label>
                      <input 
                        type="number" 
                        className="text-input-field" 
                        placeholder="Cost" 
                        value={manualCost}
                        onChange={(e) => setManualCost(e.target.value)}
                      />
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Sale Price (AED)</label>
                      <input 
                        type="number" 
                        className="text-input-field" 
                        placeholder="Sale" 
                        value={manualSale}
                        onChange={(e) => setManualSale(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="app-modal-footer" style={{ paddingRight: 0, paddingBottom: 0 }}>
                    <button type="button" className="action-btn btn-outlined" onClick={() => setAddModalOpen(false)}>Cancel</button>
                    <button type="submit" className="action-btn btn-brand-blue">Add Coupon</button>
                  </div>
                </form>
              )}

              {activeAddTab === 'csv' && (
                <div>
                  <div className="form-grid-columns-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Assign To Site *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={csvSiteId}
                        onChange={(e) => { setCsvSiteId(e.target.value); setCsvProfileId(''); }}
                        required
                      >
                        <option value="">-- Select Site --</option>
                        {db.sites.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Coupon Profile Pack *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={csvProfileId}
                        onChange={(e) => setCsvProfileId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Profile --</option>
                        {db.couponProfiles
                          .filter(p => !csvSiteId || db.sitePrices?.some(sp => sp.siteId === csvSiteId && sp.profileId === p.id))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                      {csvSiteId && db.sitePrices?.filter(sp => sp.siteId === csvSiteId).length === 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--yellow)', marginTop: '0.25rem', display: 'block' }}>
                          No profiles assigned to this site yet.
                        </span>
                      )}
                      {csvSiteId && !isSiteActive(db.sites.find(s => s.id === csvSiteId)) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                          Subscription expired for this site — renew it before importing stock.
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius)', fontSize: '0.75rem', marginBottom: '1rem', color: 'var(--text-2)' }}>
                    <strong>CSV Import Format:</strong> Paste coupon codes (one code per line).
                    <br />
                    <em>Example:</em>
                    <pre style={{ margin: '0.25rem 0', fontFamily: 'var(--mono)' }}>
                      XYZ-123456{"\n"}
                      XYZ-998877
                    </pre>
                  </div>
                  <div className="form-input-wrapper">
                    <label className="form-field-label">Paste Coupon Codes Below</label>
                    <textarea 
                      className="text-input-field" 
                      rows="6" 
                      placeholder="Paste one code per line..." 
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                    />
                  </div>
                  <div className="app-modal-footer" style={{ paddingRight: 0, paddingBottom: 0 }}>
                    <button className="action-btn btn-outlined" onClick={() => setAddModalOpen(false)}>Cancel</button>
                    <button className="action-btn btn-brand-blue" onClick={handleCsvImport}>
                      <Upload size={14} /> Import CSV
                    </button>
                  </div>
                </div>
              )}

              {activeAddTab === 'api' && (
                <div className="flex-direction-gap">
                  <div className="form-grid-columns-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Assign To Site *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={apiSiteId}
                        onChange={(e) => { setApiSiteId(e.target.value); setApiProfileId(''); }}
                        required
                      >
                        <option value="">-- Select Site --</option>
                        {db.sites.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Coupon Profile Pack *</label>
                      <select 
                        className="select-dropdown-field" 
                        value={apiProfileId}
                        onChange={(e) => setApiProfileId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Profile --</option>
                        {db.couponProfiles
                          .filter(p => !apiSiteId || db.sitePrices?.some(sp => sp.siteId === apiSiteId && sp.profileId === p.id))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                      {apiSiteId && db.sitePrices?.filter(sp => sp.siteId === apiSiteId).length === 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--yellow)', marginTop: '0.25rem', display: 'block' }}>
                          No profiles assigned to this site yet.
                        </span>
                      )}
                      {apiSiteId && !isSiteActive(db.sites.find(s => s.id === apiSiteId)) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                          Subscription expired for this site — renew it before importing stock.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-input-wrapper">
                    <label className="form-field-label">API Gateway Endpoint URL</label>
                    <input 
                      type="text" 
                      className="text-input-field" 
                      placeholder="https://api.externalvendor.com/coupons" 
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                    />
                  </div>
                  <div className="form-input-wrapper">
                    <label className="form-field-label">Private Authorization Key</label>
                    <input 
                      type="password" 
                      className="text-input-field" 
                      placeholder="Bearer sk_live_..." 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <div className="app-modal-footer" style={{ paddingRight: 0, paddingBottom: 0 }}>
                    <button className="action-btn btn-outlined" onClick={() => setAddModalOpen(false)}>Cancel</button>
                    <button className="action-btn btn-brand-blue" onClick={handleApiImport}>
                      <ExternalLink size={14} /> Connect & Pull
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
         MODAL: COUPON AUDIT HISTORY
      ═══════════════════════════════════════════ */}
      {selectedCoupon && (
        <div className="app-modal-backdrop modal-open-state">
          <div className="app-modal-window">
            <div className="app-modal-header">
              <div>
                <span className="app-modal-title" style={{ display: 'block' }}>Coupon History Trace</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Code: {selectedCoupon.code}</span>
              </div>
              <button className="app-modal-close-btn" onClick={() => { setSelectedCoupon(null); setHistoryLogs([]); }}>×</button>
            </div>
            <div className="app-modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                  Loading history logs...
                </div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                  No history logs found for this coupon.
                </div>
              ) : (
                <div className="flex-direction-gap" style={{ gap: '1rem' }}>
                  {historyLogs.map((log, index) => (
                    <div 
                      key={index} 
                      style={{ 
                        display: 'flex', 
                        gap: '0.75rem', 
                        position: 'relative',
                        paddingLeft: '1.25rem',
                        borderLeft: '2px solid var(--border)' 
                      }}
                    >
                      <div 
                        style={{ 
                          position: 'absolute', 
                          left: '-6px', 
                          top: '4px', 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: 'var(--blue)' 
                        }} 
                      />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
                          {log.action}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: '0.15rem 0' }}>
                          {log.details}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
                          By: {log.user} • {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="app-modal-footer">
              <button className="action-btn btn-outlined" onClick={() => { setSelectedCoupon(null); setHistoryLogs([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && (
        <div className="app-modal-backdrop modal-open-state">
          <div className="app-modal-window" style={{ maxWidth: '400px' }}>
            <div className="app-modal-header">
              <span className="app-modal-title">Bulk Delete Coupons</span>
              <button className="app-modal-close-btn" onClick={() => setConfirmBulkDelete(false)}>×</button>
            </div>
            <div className="app-modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>
                You are about to permanently delete <strong style={{ color: 'var(--red)' }}>{selectedIds.size} coupon{selectedIds.size !== 1 ? 's' : ''}</strong>. This action cannot be undone.
              </p>
            </div>
            <div className="app-modal-footer">
              <button className="action-btn btn-outlined" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
              <button
                className="action-btn"
                style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                onClick={async () => {
                  await bulkDeleteCoupons(Array.from(selectedIds));
                  setSelectedIds(new Set());
                  setConfirmBulkDelete(false);
                }}
              >
                <Trash2 size={13} /> Delete {selectedIds.size} Coupon{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
