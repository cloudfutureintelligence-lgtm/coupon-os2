import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Receipt, Search, Filter, X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { dubaiDateStr as toDubaiDateStr, formatDubaiDateTime } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Sales Log — dedicated page with full search, filter & pagination
//
// SCALABILITY NOTE: this page used to load every coupon in the system into
// `db.coupons` and filter/paginate it in JavaScript. That works fine at a few
// thousand rows, but breaks down badly once the table grows into the hundreds
// of thousands — the whole table gets downloaded on every page load, the
// browser holds all of it in memory, and even a plain client refresh becomes
// slow. This version instead asks Postgres for exactly one filtered page at a
// time via getCouponsPage() / getCouponsSummary() (see AppContext.jsx /
// mockDb.js) — the browser never receives more rows than are on screen.
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
const DUBAI_OFFSET = '+04:00';

const todayStr = () => toDubaiDateStr(new Date());

export const SalesLog = () => {
  const { db, currentUser, getCouponsPage, getCouponsSummary } = useApp();

  const [search,        setSearch]        = useState('');
  const [filterSiteId,  setFilterSiteId]  = useState('all');
  const [filterProfile, setFilterProfile] = useState('all');
  const [filterSeller,  setFilterSeller]  = useState('all');
  const [dateFrom,      setDateFrom]      = useState(todayStr());
  const [dateTo,        setDateTo]        = useState('');
  const [currentPage,   setCurrentPage]   = useState(1);

  // Server-fetched results for the current page/filters
  const [pageRows,     setPageRows]     = useState([]);
  const [totalCount,   setTotalCount]   = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);

  const role = currentUser?.role;

  // ── Sites visible to this user (small table — fine to load fully) ─────────
  const visibleSiteIds = useMemo(() => {
    if (!currentUser) return [];
    if (role === 'Admin' || role === 'Accountant') return db.sites.map(s => s.id);
    return db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
  }, [db, currentUser, role]);

  const visibleSellerIds = useMemo(() => {
    return [...new Set(
      db.userSites
        .filter(us => visibleSiteIds.includes(us.siteId))
        .map(us => us.userId)
    )];
  }, [db, visibleSiteIds]);

  const dropdownSites = useMemo(
    () => db.sites.filter(s => visibleSiteIds.includes(s.id)),
    [db, visibleSiteIds]
  );

  // NOTE: previously this list only showed profiles that already had at least
  // one loaded sale (derived from the full in-memory coupons array). Since we
  // no longer hold every coupon in memory, we show all profiles assigned to
  // the user's visible sites instead — couponProfiles is a small table, so
  // this stays cheap regardless of how many coupons exist.
  const dropdownProfiles = useMemo(() => {
    const assignedProfileIds = new Set(
      (db.sitePrices || [])
        .filter(sp => visibleSiteIds.includes(sp.siteId))
        .map(sp => sp.profileId)
    );
    return db.couponProfiles.filter(p => assignedProfileIds.has(p.id));
  }, [db, visibleSiteIds]);

  const dropdownSellers = useMemo(
    () => db.users.filter(u => visibleSellerIds.includes(u.id)),
    [db, visibleSellerIds]
  );

  const showRevenue  = role !== 'Staff' && role !== 'Super Staff';
  const canExportCSV = role === 'Manager' || role === 'Owner' || role === 'Super Owner';
  const hasActiveFilters = filterSiteId !== 'all' || filterProfile !== 'all' ||
    filterSeller !== 'all' || dateFrom || dateTo || search.trim();

  // ── Build the current filter set once, shared by fetch + export ──────────
  const buildFilters = useCallback(() => {
    const siteIds = filterSiteId !== 'all' ? [filterSiteId] : visibleSiteIds;
    const isSearching = !!search.trim();

    return {
      siteIds,
      profileId: filterProfile !== 'all' ? filterProfile : null,
      sellerId:  filterSeller  !== 'all' ? filterSeller  : null,
      status: 'Sold',
      // Same rule as before: date filters are ignored while actively searching
      dateFrom: !isSearching && dateFrom ? `${dateFrom}T00:00:00${DUBAI_OFFSET}` : null,
      dateTo:   !isSearching && dateTo   ? `${dateTo}T23:59:59${DUBAI_OFFSET}`   : null,
      search: isSearching ? search.trim() : null,
    };
  }, [filterSiteId, filterProfile, filterSeller, dateFrom, dateTo, search, visibleSiteIds]);

  // ── Fetch current page + summary from the server whenever filters/page change ──
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const filters = buildFilters();
        const [pageResult, summaryResult] = await Promise.all([
          getCouponsPage({ ...filters, page: currentPage, pageSize: PAGE_SIZE }),
          getCouponsSummary(filters),
        ]);
        if (cancelled) return;
        setPageRows(pageResult.coupons);
        setTotalCount(pageResult.totalCount);
        setTotalRevenue(summaryResult.totalRevenue);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load sales');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [buildFilters, currentPage, currentUser, getCouponsPage, getCouponsSummary]);

  // Reset to page 1 whenever filters change (not when only the page changes)
  useEffect(() => { setCurrentPage(1); }, [filterSiteId, filterProfile, filterSeller, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart  = (currentPage - 1) * PAGE_SIZE;
  const pageEnd    = pageStart + pageRows.length;

  const goToPage = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  const pageButtons = useMemo(() => {
    const pages = [];
    const delta = 3;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      }
    }
    const result = [];
    let prev = null;
    for (const p of pages) {
      if (prev !== null && p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  }, [totalPages, currentPage]);

  if (!currentUser) return null;

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

  const clearAll = () => {
    setSearch(''); setFilterSiteId('all'); setFilterProfile('all');
    setFilterSeller('all'); setDateFrom(''); setDateTo('');
  };

  // ── CSV Export — pages through ALL matching rows via the server in batches ──
  // of 1000 (PostgREST's per-request cap), instead of requiring every row to
  // already be sitting in memory. Only used for exports; the on-screen table
  // still only ever holds one page at a time.
  const [exporting, setExporting] = useState(false);
  const handleExportCSV = async () => {
    if (totalCount === 0) return;
    setExporting(true);
    try {
      const filters = buildFilters();
      const BATCH_SIZE = 1000;
      let all = [];
      let batchPage = 1;
      while (true) {
        const { coupons, totalCount: tc } = await getCouponsPage({ ...filters, page: batchPage, pageSize: BATCH_SIZE });
        all = all.concat(coupons);
        if (all.length >= tc || coupons.length < BATCH_SIZE) break;
        batchPage += 1;
      }

      const headers = ['#', 'Coupon Code', 'Profile'];
      if (dropdownSites.length > 1) headers.push('Site');
      headers.push('Sold By', 'Role');
      if (showRevenue) headers.push('Price (AED)', 'Free Coupon');
      headers.push('Customer Name', 'Mobile', 'Date & Time');

      const rows = all.map((log, idx) => {
        const profile = db.couponProfiles.find(p => p.id === log.profileId);
        const site    = db.sites.find(s => s.id === log.siteId);
        const seller  = db.users.find(u => u.id === log.soldByUserId);
        const row = [idx + 1, log.code || '', profile?.name || log.profileId || ''];
        if (dropdownSites.length > 1) row.push(site?.name || '');
        row.push(seller?.name || '', seller?.role || '');
        if (showRevenue) row.push(log.salePrice ?? '', log.isFree ? 'Yes' : 'No');
        row.push(log.customerName || '', log.customerPhone || '',
          log.soldAt ? formatDubaiDateTime(log.soldAt) : '');
        return row;
      });

      const csv = [headers, ...rows]
        .map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = 'sales_log_' + todayStr() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
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
            disabled={exporting || totalCount === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: '6px',
              border: '1px solid var(--blue)', background: 'var(--blue)',
              color: '#fff', cursor: exporting ? 'default' : 'pointer', fontWeight: 600,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : `Export CSV${totalCount > 0 ? ` (${totalCount})` : ''}`}
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

          {dropdownSites.length > 1 && (
            <select style={selectStyle} value={filterSiteId} onChange={e => setFilterSiteId(e.target.value)}>
              <option value="all">All Sites</option>
              {dropdownSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <select style={selectStyle} value={filterProfile} onChange={e => setFilterProfile(e.target.value)}>
            <option value="all">All Profiles</option>
            {dropdownProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {dropdownSellers.length > 1 && (
            <select style={selectStyle} value={filterSeller} onChange={e => setFilterSeller(e.target.value)}>
              <option value="all">All Staff</option>
              {dropdownSellers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>From</span>
            <input type="date" style={dateInputStyle} value={dateFrom}
              max={dateTo || todayStr()} onChange={e => setDateFrom(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>To</span>
            <input type="date" style={dateInputStyle} value={dateTo}
              min={dateFrom} max={todayStr()} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* Summary row */}
        <div style={{ padding: '0.5rem 1rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text)' }}>{totalCount}</strong> sales found
          </span>
          {showRevenue && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
              Revenue: <strong style={{ color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</strong>
            </span>
          )}
          {totalCount > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              Showing {pageStart + 1}–{Math.min(pageEnd, totalCount)} of {totalCount}
            </span>
          )}
          {hasActiveFilters && (
            <span style={{ fontSize: '0.72rem', color: 'var(--blue)', fontWeight: 600 }}>Filters active</span>
          )}
          {loading && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Loader2 size={12} className="spin" /> Loading…
            </span>
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
              {loadError ? (
                <tr>
                  <td colSpan={8 + (dropdownSites.length > 1 ? 1 : 0)} className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                    <div className="empty-view-title" style={{ color: 'var(--red)' }}>Couldn't load sales</div>
                    <div className="empty-view-description">{loadError}</div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8 + (dropdownSites.length > 1 ? 1 : 0)} className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                    <div className="empty-view-title">
                      {loading ? 'Loading…' : hasActiveFilters ? 'No sales match your filters' : 'No sales yet'}
                    </div>
                    {!loading && (
                      <div className="empty-view-description">
                        {hasActiveFilters
                          ? 'Try adjusting the filters or clearing them'
                          : 'Completed sales will appear here'}
                      </div>
                    )}
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
                        {log.soldAt ? formatDubaiDateTime(log.soldAt) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {pageStart + 1}–{Math.min(pageEnd, totalCount)} of {totalCount} records &nbsp;·&nbsp; {PAGE_SIZE} per page
            </span>

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
