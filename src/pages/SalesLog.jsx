import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Receipt, Search, Filter, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Sales Log — dedicated page with full search, filter & pagination
//
// Role scoping:
//   Staff        → all sales at their assigned site(s)   ← shows site & seller
//   Super Staff  → all sales at their assigned site(s)
//   Manager      → all sales at assigned site(s)
//   Owner        → all sales at assigned site(s)
//   Accountant   → all sales, all sites
//   Admin        → all sales, all sites
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const todayStr  = () => new Date().toISOString().slice(0, 10);

export const SalesLog = () => {
  const { db, currentUser } = useApp();

  const [search,        setSearch]        = useState('');
  const [filterSiteId,  setFilterSiteId]  = useState('all');
  const [filterProfile, setFilterProfile] = useState('all');
  const [filterSeller,  setFilterSeller]  = useState('all');
  const [dateFrom,      setDateFrom]      = useState(todayStr());
  const [dateTo,        setDateTo]        = useState('');
  const [currentPage,   setCurrentPage]   = useState(1);

  if (!currentUser) return null;
  const role = currentUser.role;

  // ── Sites visible to this user ────────────────────────────────────────────
  const visibleSiteIds = useMemo(() => {
    if (role === 'Admin' || role === 'Accountant') return db.sites.map(s => s.id);
    return db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
  }, [db, currentUser, role]);

  // ── All sellers at those sites (for filter dropdown) ─────────────────────
  const visibleSellerIds = useMemo(() => {
    return [...new Set(
      db.userSites
        .filter(us => visibleSiteIds.includes(us.siteId))
        .map(us => us.userId)
    )];
  }, [db, visibleSiteIds]);

  // ── Base sales list: all roles see all sales at their site(s) ─────────────
  const baseSales = useMemo(() => {
    return db.coupons
      .filter(c => c.status === 'Sold' && visibleSiteIds.includes(c.siteId));
  }, [db.coupons, visibleSiteIds]);

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...baseSales];

    if (filterSiteId  !== 'all') list = list.filter(c => c.siteId      === filterSiteId);
    if (filterProfile !== 'all') list = list.filter(c => c.profileId   === filterProfile);
    if (filterSeller  !== 'all') list = list.filter(c => c.soldByUserId === filterSeller);
    
    // Only apply date filters if search input is empty
    if (!search.trim()) {
      if (dateFrom) list = list.filter(c => c.soldAt && c.soldAt.slice(0, 10) >= dateFrom);
      if (dateTo)   list = list.filter(c => c.soldAt && c.soldAt.slice(0, 10) <= dateTo);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.code?.toLowerCase().includes(q) ||
        c.customerName?.toLowerCase().includes(q) ||
        c.customerPhone?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.soldAt || '').localeCompare(a.soldAt || ''));
  }, [baseSales, filterSiteId, filterProfile, filterSeller, dateFrom, dateTo, search]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [filtered]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart   = (currentPage - 1) * PAGE_SIZE;
  const pageEnd     = pageStart + PAGE_SIZE;
  const pageRows    = filtered.slice(pageStart, pageEnd);

  const goToPage = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  // Page number buttons: show up to 7 around current page
  const pageButtons = useMemo(() => {
    const pages = [];
    const delta = 3;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      }
    }
    // Insert ellipsis markers
    const result = [];
    let prev = null;
    for (const p of pages) {
      if (prev !== null && p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  }, [totalPages, currentPage]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalRevenue = filtered.reduce((s, c) => s + (Number(c.salePrice) || 0), 0);

  // ── Dropdown data ─────────────────────────────────────────────────────────
  const dropdownSites = db.sites.filter(s => visibleSiteIds.includes(s.id));

  const dropdownProfiles = useMemo(() => {
    const ids = new Set(baseSales.map(c => c.profileId));
    return db.couponProfiles.filter(p => ids.has(p.id));
  }, [baseSales, db]);

  const dropdownSellers = useMemo(() => {
    return db.users.filter(u => visibleSellerIds.includes(u.id));
  }, [db, visibleSellerIds]);

  const showRevenue  = role !== 'Staff' && role !== 'Super Staff';
  const canExportCSV = role === 'Manager' || role === 'Owner' || role === 'Super Owner';
  const hasActiveFilters = filterSiteId !== 'all' || filterProfile !== 'all' ||
    filterSeller !== 'all' || dateFrom || dateTo || search.trim();

  const clearAll = () => {
    setSearch(''); setFilterSiteId('all'); setFilterProfile('all');
    setFilterSeller('all'); setDateFrom(''); setDateTo('');
  };

  // ── Labels ────────────────────────────────────────────────────────────────
  const pageTitle = {
    Staff:         'Site Sales History',
    'Super Staff': 'Site Sales Log',
    Manager:       'Staff Sales Log',
    Owner:         'Sales Activity',
    Accountant:    'Sales Records',
    Admin:         'Coupon Sales Log',
  }[role] || 'Sales Log';

  const pageSubtitle = {
    Staff:         'All sales at your assigned site(s)',
    'Super Staff': 'All sales across your assigned site(s)',
    Manager:       'All sales by staff at your assigned site(s)',
    Owner:         'All coupon sales across your sites',
    Accountant:    'All sales across every site',
    Admin:         'Complete historical record of all coupon sales',
  }[role] || '';

  // ── Styles ────────────────────────────────────────────────────────────────
  const selectStyle = {
    fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '4px',
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    color: 'var(--text)', cursor: 'pointer',
  };
  const dateInputStyle = {
    fontSize: '0.78rem', padding: '0.28rem 0.5rem', borderRadius: '4px',
    border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)',
  };
  const pageBtnStyle = (active) => ({
    minWidth: '32px', height: '32px', padding: '0 0.4rem',
    borderRadius: '4px', border: '1px solid var(--border)',
    background: active ? 'var(--blue)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--text-2)',
    fontWeight: active ? 700 : 400, fontSize: '0.78rem',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  });

  const colSpan = 5 + (dropdownSites.length > 1 ? 1 : 0) + 1;

  // CSV Export — exports ALL filtered rows (not just current page)
  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = ['#', 'Coupon Code', 'Profile'];
    if (dropdownSites.length > 1) headers.push('Site');
    headers.push('Sold By', 'Role');
    if (showRevenue) headers.push('Price (AED)', 'Free Coupon');
    headers.push('Customer Name', 'Mobile', 'Date & Time');

    const rows = filtered.map((log, idx) => {
      const profile = db.couponProfiles.find(p => p.id === log.profileId);
      const site    = db.sites.find(s => s.id === log.siteId);
      const seller  = db.users.find(u => u.id === log.soldByUserId);
      const row = [idx + 1, log.code || '', profile?.name || log.profileId || ''];
      if (dropdownSites.length > 1) row.push(site?.name || '');
      row.push(seller?.name || '', seller?.role || '');
      if (showRevenue) row.push(log.salePrice ?? '', log.isFree ? 'Yes' : 'No');
      row.push(log.customerName || '', log.customerPhone || '',
        log.soldAt ? new Date(log.soldAt).toLocaleString() : '');
      return row;
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'sales_log_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
        {canExportCSV && (
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: '6px',
              border: '1px solid var(--blue)', background: 'var(--blue)',
              color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}
          >
            <Download size={14} /> Export CSV{filtered.length > 0 ? ` (${filtered.length})` : ''}
          </button>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
        <div className="ui-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={13} />
            <span className="ui-card-title">Search & Filter</span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.75rem', color: 'var(--text-3)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        <div style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          {/* Text search */}
          <div className="filter-search-box" style={{ minWidth: '220px', flex: 2 }}>
            <Search size={13} />
            <input
              type="text"
              placeholder="Coupon code, customer name or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Site filter — shown when user has multiple sites */}
          {dropdownSites.length > 1 && (
            <select style={selectStyle} value={filterSiteId} onChange={e => setFilterSiteId(e.target.value)}>
              <option value="all">All Sites</option>
              {dropdownSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {/* Profile filter */}
          <select style={selectStyle} value={filterProfile} onChange={e => setFilterProfile(e.target.value)}>
            <option value="all">All Profiles</option>
            {dropdownProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Seller filter — all roles now see this since Staff also sees site-wide */}
          {dropdownSellers.length > 1 && (
            <select style={selectStyle} value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
              <option value="all">All Staff</option>
              {dropdownSellers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          )}

          {/* Date from */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>From</span>
            <input type="date" style={dateInputStyle} value={dateFrom}
              max={dateTo || todayStr()} onChange={e => setDateFrom(e.target.value)} />
          </div>

          {/* Date to */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>To</span>
            <input type="date" style={dateInputStyle} value={dateTo}
              min={dateFrom} max={todayStr()} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* Summary row */}
        <div style={{ padding: '0.5rem 1rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> sales found
          </span>
          {showRevenue && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
              Revenue: <strong style={{ color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</strong>
            </span>
          )}
          {filtered.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              Showing {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
            </span>
          )}
          {hasActiveFilters && (
            <span style={{ fontSize: '0.72rem', color: 'var(--blue)', fontWeight: 600 }}>Filters active</span>
          )}
        </div>
      </div>

      {/* ── Results table ── */}
      <div className="ui-card">
        <div className="ui-card-header">
          <span className="ui-card-title">
            <Receipt size={13} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
            Sales Records
          </span>
          {totalPages > 1 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>

        <div className="data-table-container" style={{ marginTop: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Coupon Code</th>
                <th>Profile</th>
                {dropdownSites.length > 1 && <th>Site</th>}
                <th>Sold By</th>
                {showRevenue && <th>Price</th>}
                <th>Customer Name</th>
                <th>Mobile</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8 + (dropdownSites.length > 1 ? 1 : 0)} className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                    <div className="empty-view-title">
                      {hasActiveFilters ? 'No sales match your filters' : 'No sales yet'}
                    </div>
                    <div className="empty-view-description">
                      {hasActiveFilters
                        ? 'Try adjusting the filters or clearing them'
                        : 'Completed sales will appear here'}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((log, idx) => {
                  const profile = db.couponProfiles.find(p => p.id === log.profileId);
                  const site    = db.sites.find(s => s.id === log.siteId);
                  const seller  = db.users.find(u => u.id === log.soldByUserId);
                  return (
                    <tr key={log.id || log.code || idx}>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{pageStart + idx + 1}</td>
                      <td className="td-monospaced td-emphasis">{log.code}</td>
                      <td>{profile?.name || log.profileId}</td>
                      {dropdownSites.length > 1 && <td>{site?.name || '—'}</td>}
                      <td>
                        <span style={{ fontWeight: 500 }}>{seller?.name || '—'}</span>
                        {seller?.role && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginLeft: '0.3rem' }}>
                            ({seller.role})
                          </span>
                        )}
                      </td>
                      {showRevenue && (
                        <td style={{ fontWeight: 600, color: 'var(--green)' }}>
                          {log.isFree
                            ? <span className="pill-badge badge-info">FREE</span>
                            : `${log.salePrice} AED`}
                        </td>
                      )}
                      <td>{log.customerName || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                      <td>{log.customerPhone || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        {log.soldAt ? new Date(log.soldAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination controls ── */}
        {totalPages > 1 && (
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            {/* Left: rows info */}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length} records &nbsp;·&nbsp; {PAGE_SIZE} per page
            </span>

            {/* Right: page buttons */}
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <button
                style={pageBtnStyle(false)}
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              {pageButtons.map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} style={{ fontSize: '0.78rem', color: 'var(--text-3)', padding: '0 0.2rem' }}>…</span>
                ) : (
                  <button
                    key={p}
                    style={pageBtnStyle(p === currentPage)}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                style={pageBtnStyle(false)}
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
                title="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
