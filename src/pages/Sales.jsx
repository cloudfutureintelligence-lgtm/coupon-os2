import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Search, CheckCircle2, Loader2, Receipt, BarChart2, Calendar, TrendingUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Role visibility matrix for sold coupon list
//   Staff        → own sales only
//   Super Staff  → own sales + staff at same site(s)
//   Manager      → all sales at assigned site(s)
//   Owner        → all sales at assigned site(s)
//   Accountant   → all sales (all sites)
//   Admin        → all sales (all sites, filterable)
// ─────────────────────────────────────────────────────────────────────────────

// ── Date helpers ──────────────────────────────────────────────────────────────
const toDateStr = (d) => d.toISOString().slice(0, 10); // "YYYY-MM-DD"

const todayStr  = () => toDateStr(new Date());

const thisMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return toDateStr(d);
};

const isInRange = (isoStr, from, to) => {
  if (!isoStr) return false;
  const d = isoStr.slice(0, 10); // "YYYY-MM-DD"
  if (from && d < from) return false;
  if (to   && d > to  ) return false;
  return true;
};

export const Sales = () => {
  const { db, currentUser, selectedSiteId, sellCoupon, showToast } = useApp();

  // POS state
  const [selectedProfileId, setSelectedProfileId] = useState('all');
  const [saleModalOpen, setSaleModalOpen]         = useState(false);
  const [targetProfile, setTargetProfile]         = useState(null);
  const [custName, setCustName]                   = useState('');
  const [custPhone, setCustPhone]                 = useState('');
  const [remarks, setRemarks]                     = useState('');

  // Duplicate-click guard
  const [isSelling, setIsSelling]   = useState(false);
  const saleInFlightRef             = useRef(false);

  // Success modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [soldCouponCode, setSoldCouponCode]     = useState('');
  // Optimistic sold entry shown immediately after sale
  const [pendingSale, setPendingSale]           = useState(null);

  // Sales-log search (code, name, mobile)
  const [logSearch, setLogSearch] = useState('');

  // ── Analytics date filter state ───────────────────────────────────────────
  const [dateMode, setDateMode]     = useState('today');   // 'today' | 'month' | 'custom'
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo]     = useState(todayStr());

  if (!currentUser) return null;

  const role     = currentUser.role;
  const isSeller = ['Staff', 'Super Staff'].includes(role);
  const showLog  = ['Staff', 'Super Staff', 'Manager', 'Owner', 'Accountant', 'Admin'].includes(role);
  const showAnalytics = ['Manager', 'Owner', 'Accountant', 'Admin'].includes(role);

  // ── POS helpers ────────────────────────────────────────────────────────────
  const getProfileStock = (profileId) =>
    db.coupons.filter(c => c.siteId === selectedSiteId && c.profileId === profileId && c.status === 'Available').length;

  const getProfilePrice = (profileId) => {
    const ov = db.sitePrices?.find(sp => sp.siteId === selectedSiteId && sp.profileId === profileId);
    return ov ? ov.salePrice : (db.couponProfiles.find(p => p.id === profileId)?.salePrice || 0);
  };

  // ── Duplicate-safe submit ──────────────────────────────────────────────────
  const handleConfirmSale = async (e) => {
    e.preventDefault();
    if (!targetProfile || saleInFlightRef.current) return;
    saleInFlightRef.current = true;
    setIsSelling(true);
    try {
      const res = await sellCoupon(selectedSiteId, targetProfile.id, custName, custPhone, remarks);
      if (res && res.success) {
        const optimistic = {
          code:           res.couponCode,
          profileId:      targetProfile.id,
          siteId:         selectedSiteId,
          salePrice:      getProfilePrice(targetProfile.id),
          customerName:   custName,
          customerPhone:  custPhone,
          soldAt:         new Date().toISOString(),
          soldByUserId:   currentUser.id,
        };
        setPendingSale(optimistic);
        setSoldCouponCode(res.couponCode);
        setSaleModalOpen(false);
        setTargetProfile(null);
        setSuccessModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      saleInFlightRef.current = false;
      setIsSelling(false);
    }
  };

  // ── Sales log data ─────────────────────────────────────────────────────────
  const getSalesLogs = () => {
    let list = db.coupons.filter(c => c.status === 'Sold');

    if (role === 'Admin' || role === 'Accountant') {
      if (selectedSiteId !== 'all') list = list.filter(c => c.siteId === selectedSiteId);
    } else if (role === 'Owner' || role === 'Manager') {
      const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
      list = list.filter(c => mySiteIds.includes(c.siteId));
    } else if (role === 'Super Staff') {
      const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
      const siteUserIds = db.userSites.filter(us => mySiteIds.includes(us.siteId)).map(us => us.userId);
      list = list.filter(c => mySiteIds.includes(c.siteId) &&
        (c.soldByUserId === currentUser.id || siteUserIds.includes(c.soldByUserId)));
    } else {
      // Staff — own sales only
      list = list.filter(c => c.soldByUserId === currentUser.id);
    }

    // Merge optimistic pending sale (won't be in db yet right after selling)
    if (pendingSale && !list.find(c => c.code === pendingSale.code)) {
      list = [pendingSale, ...list];
    }

    // Search: coupon code, customer name, OR mobile/phone number
    if (logSearch.trim()) {
      const q = logSearch.trim().toLowerCase();
      list = list.filter(c =>
        c.code?.toLowerCase().includes(q) ||
        c.customerName?.toLowerCase().includes(q) ||
        c.customerPhone?.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const salesLogs = showLog ? getSalesLogs() : [];

  // ── Analytics helpers ─────────────────────────────────────────────────────
  const getAnalyticsRange = () => {
    if (dateMode === 'today') return { from: todayStr(), to: todayStr() };
    if (dateMode === 'month') return { from: thisMonthStart(), to: todayStr() };
    return { from: customFrom, to: customTo };
  };

  const renderAnalyticsPanel = () => {
    if (!showAnalytics) return null;

    const { from, to } = getAnalyticsRange();

    // Determine which sites this user can see
    let visibleSiteIds;
    if (role === 'Admin' || role === 'Accountant') {
      visibleSiteIds = db.sites.map(s => s.id);
    } else {
      visibleSiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    }

    // Build per-site stats
    const siteStats = visibleSiteIds.map(siteId => {
      const site = db.sites.find(s => s.id === siteId);
      let sold = db.coupons.filter(c => c.status === 'Sold' && c.siteId === siteId);

      // Include optimistic pending sale for this site
      if (pendingSale && pendingSale.siteId === siteId && !sold.find(c => c.code === pendingSale.code)) {
        sold = [pendingSale, ...sold];
      }

      // Apply date range
      const filtered = sold.filter(c => isInRange(c.soldAt, from, to));

      // Per-profile breakdown
      const profileMap = {};
      filtered.forEach(c => {
        profileMap[c.profileId] = (profileMap[c.profileId] || 0) + 1;
      });

      // Per-seller breakdown
      const sellerMap = {};
      filtered.forEach(c => {
        const sid = c.soldByUserId;
        if (!sellerMap[sid]) sellerMap[sid] = 0;
        sellerMap[sid] += 1;
      });

      const revenue = filtered.reduce((s, c) => s + (Number(c.salePrice) || 0), 0);

      return { siteId, site, count: filtered.length, revenue, profileMap, sellerMap };
    });

    const totalCount   = siteStats.reduce((s, x) => s + x.count, 0);
    const totalRevenue = siteStats.reduce((s, x) => s + x.revenue, 0);
    const activeSites  = siteStats.filter(x => x.count > 0).length;

    const rangeLabel = dateMode === 'today' ? 'Today'
      : dateMode === 'month' ? 'This Month'
      : `${from} → ${to}`;

    const summaryCardStyle = {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1rem 1.25rem',
      flex: 1,
      minWidth: '150px',
    };

    return (
      <>
        {/* ── Header card with date controls ── */}
        <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
          <div className="ui-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={14} />
              <span className="ui-card-title">Sales Analytics</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: '0.25rem' }}>— {rangeLabel}</span>
            </div>
            {/* Date mode tabs */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[['today', 'Today'], ['month', 'This Month'], ['custom', 'Custom']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setDateMode(m)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.72rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: dateMode === m ? 'var(--brand-blue)' : 'var(--surface-2)',
                    color: dateMode === m ? '#fff' : 'var(--text-2)',
                    cursor: 'pointer',
                    fontWeight: dateMode === m ? 700 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range picker */}
          {dateMode === 'custom' && (
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={13} style={{ color: 'var(--text-3)' }} />
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayStr()}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
              </div>
            </div>
          )}

          {/* Overall summary row */}
          <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ ...summaryCardStyle, borderLeft: '3px solid var(--brand-blue)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>All Sites — Sales</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{totalCount}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>coupons sold</div>
            </div>
            <div style={{ ...summaryCardStyle, borderLeft: '3px solid var(--green)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>All Sites — Revenue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>combined revenue</div>
            </div>
            <div style={{ ...summaryCardStyle, borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Active Sites</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{activeSites} / {visibleSiteIds.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>had sales this period</div>
            </div>
          </div>
        </div>

        {/* ── Individual site cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {siteStats
            .sort((a, b) => b.revenue - a.revenue)
            .map(({ siteId, site, count, revenue, profileMap, sellerMap }) => {
              const profileEntries = Object.entries(profileMap).sort((a, b) => b[1] - a[1]);
              const sellerEntries  = Object.entries(sellerMap).sort((a, b) => b[1] - a[1]);
              const hasData = count > 0;

              return (
                <div key={siteId} className="ui-card" style={{ marginBottom: 0, opacity: hasData ? 1 : 0.55 }}>
                  {/* Site header */}
                  <div className="ui-card-header" style={{ background: hasData ? 'var(--surface-2)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{site?.name || siteId}</span>
                      {site?.location && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>· {site.location}</span>
                      )}
                    </div>
                    <span className={`pill-badge ${hasData ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>
                      {hasData ? `${count} sold` : 'No sales'}
                    </span>
                  </div>

                  <div style={{ padding: '0.9rem 1rem' }}>
                    {/* Revenue + count row */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem' }}>
                      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                        <div style={{ fontSize: '0.63rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Coupons Sold</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)' }}>{count}</div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                        <div style={{ fontSize: '0.63rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: hasData ? 'var(--green)' : 'var(--text-3)' }}>
                          {revenue > 0 ? `${revenue.toLocaleString()} AED` : '—'}
                        </div>
                      </div>
                    </div>

                    {hasData && (
                      <>
                        {/* Profiles breakdown */}
                        {profileEntries.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Profiles Sold</div>
                            <div className="data-table-container" style={{ marginTop: 0 }}>
                              <table className="data-table" style={{ fontSize: '0.78rem' }}>
                                <thead>
                                  <tr>
                                    <th>Profile</th>
                                    <th>Qty</th>
                                    <th>Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {profileEntries.map(([pid, cnt]) => {
                                    const prof = db.couponProfiles.find(p => p.id === pid);
                                    const price = db.sitePrices?.find(sp => sp.siteId === siteId && sp.profileId === pid)?.salePrice
                                      ?? prof?.salePrice ?? 0;
                                    return (
                                      <tr key={pid}>
                                        <td style={{ fontWeight: 600 }}>{prof?.name || pid}</td>
                                        <td><span className="pill-badge badge-info">{cnt}</span></td>
                                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>{(price * cnt).toLocaleString()} AED</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Seller breakdown */}
                        {sellerEntries.length > 0 && (role === 'Admin' || role === 'Owner' || role === 'Manager') && (
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>By Staff</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {sellerEntries.map(([uid, cnt]) => {
                                const user = db.users.find(u => u.id === uid);
                                return (
                                  <span key={uid} style={{
                                    padding: '0.18rem 0.55rem',
                                    borderRadius: '20px',
                                    fontSize: '0.7rem',
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-2)',
                                  }}>
                                    {user?.name || uid} <span style={{ fontWeight: 700, color: 'var(--brand-blue)' }}>×{cnt}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </>
    );
  };

  // ── Sold-coupon table (shared between seller and log-only views) ───────────
  const renderSalesTable = (title, subtitle) => (
    <div className="ui-card" style={{ marginTop: '2rem' }}>
      <div className="ui-card-header">
        <div>
          <span className="ui-card-title">
            <Receipt size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            {title}
          </span>
          {subtitle && <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>{subtitle}</div>}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div className="filter-search-box">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search by coupon code, customer name or mobile number…"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="data-table-container" style={{ marginTop: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Coupon Code</th>
              <th>Profile</th>
              <th>Site</th>
              {(role !== 'Staff') && <th>Sold By</th>}
              <th>Price</th>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {salesLogs.length === 0 ? (
              <tr>
                <td colSpan={role !== 'Staff' ? 8 : 7} className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                  <div className="empty-view-title">
                    {logSearch ? 'No results match your search' : 'No sales yet'}
                  </div>
                  <div className="empty-view-description">
                    {logSearch ? 'Try a different coupon code, name or phone number' : 'Completed sales will appear here'}
                  </div>
                </td>
              </tr>
            ) : (
              salesLogs.map((log, idx) => {
                const profile = db.couponProfiles.find(p => p.id === log.profileId);
                const site    = db.sites.find(s => s.id === log.siteId);
                const seller  = db.users.find(u => u.id === log.soldByUserId);
                return (
                  <tr key={log.id || log.code || idx}>
                    <td className="td-monospaced td-emphasis">{log.code}</td>
                    <td>{profile?.name || log.profileId}</td>
                    <td>{site?.name || '-'}</td>
                    {role !== 'Staff' && <td>{seller?.name || log.soldByUserId || '-'}</td>}
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{log.salePrice} AED</td>
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
    </div>
  );

  // ── POS view (Staff + Super Staff) ─────────────────────────────────────────
  const renderPOSView = () => {
    // Only show profiles assigned to the current site (have a sitePrices entry)
    const assignedProfileIds = new Set(
      (db.sitePrices || []).filter(sp => sp.siteId === selectedSiteId).map(sp => sp.profileId)
    );
    let list = db.couponProfiles.filter(p => assignedProfileIds.has(p.id));
    if (selectedProfileId !== 'all') list = list.filter(p => p.id === selectedProfileId);

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Retail Point of Sale</h1>
            <p className="page-subtitle">Select a package profile to sell to a retail customer</p>
          </div>
        </div>

        <div className="filters-container-row">
          <select className="filter-dropdown-select" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}>
            <option value="all">All Profiles</option>
            {db.couponProfiles.filter(p => assignedProfileIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '1rem' }}>
          {list.length === 0 ? (
            <div className="empty-view-state" style={{ gridColumn: '1 / -1' }}>
              <ShoppingCart size={36} style={{ color: 'var(--text-3)', marginBottom: '0.5rem' }} />
              <div className="empty-view-title">No profiles assigned to this site</div>
              <div className="empty-view-description">An admin needs to assign profiles to this site first</div>
            </div>
          ) : (
            list.map(profile => {
              const stockCount = getProfileStock(profile.id);
              const salePrice  = getProfilePrice(profile.id);
              return (
                <div key={profile.id} className="ui-card flex-column-flow" style={{ marginBottom: 0 }}>
                  <div className="ui-card-header" style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{profile.name}</span>
                    <span className="pill-badge badge-info">{profile.validityDays} Days</span>
                  </div>
                  <div className="ui-card-body flex-column-flow" style={{ flex: 1, padding: '1rem', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '1rem', lineHeight: '1.4' }}>
                      {profile.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Available stock:</span>
                      <span className={`pill-badge ${stockCount > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                        {stockCount} units
                      </span>
                    </div>
                    <div className="flex-align-items-center flex-justify-space-between">
                      <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', display: 'block' }}>Sale price</span>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--green)' }}>{salePrice} AED</strong>
                      </div>
                      <button
                        className="action-btn btn-brand-blue btn-sm"
                        disabled={stockCount === 0}
                        onClick={() => { setTargetProfile(profile); setCustName(''); setCustPhone(''); setRemarks(''); setSaleModalOpen(true); }}
                      >
                        {stockCount > 0 ? 'Activate Sale' : 'Out of Stock'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sale confirmation modal */}
        {saleModalOpen && targetProfile && (
          <div className="app-modal-backdrop modal-open-state">
            <div className="app-modal-window">
              <div className="app-modal-header">
                <span className="app-modal-title">Confirm Coupon Activation</span>
                {!isSelling && <button className="app-modal-close-btn" onClick={() => setSaleModalOpen(false)}>×</button>}
              </div>
              <form onSubmit={handleConfirmSale}>
                <div className="app-modal-body">
                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.25rem' }}>
                    <div className="flex-justify-space-between" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                      <span>Selected Package:</span><strong>{targetProfile.name}</strong>
                    </div>
                    <div className="flex-justify-space-between" style={{ fontSize: '0.82rem' }}>
                      <span>Price Charged:</span>
                      <strong style={{ color: 'var(--green)' }}>{getProfilePrice(targetProfile.id)} AED</strong>
                    </div>
                  </div>
                  <div className="form-input-wrapper">
                    <label className="form-field-label">Customer Name (Optional)</label>
                    <input type="text" className="text-input-field" placeholder="e.g. John Doe" value={custName} onChange={e => setCustName(e.target.value)} disabled={isSelling} />
                  </div>
                  <div className="form-input-wrapper">
                    <label className="form-field-label">Customer Phone (Optional)</label>
                    <input type="text" className="text-input-field" placeholder="e.g. +971501234567" value={custPhone} onChange={e => setCustPhone(e.target.value)} disabled={isSelling} />
                  </div>
                  <div className="form-input-wrapper">
                    <label className="form-field-label">Sale Remarks / Notes</label>
                    <textarea className="text-input-field" rows="2" placeholder="Payment details, notes..." value={remarks} onChange={e => setRemarks(e.target.value)} disabled={isSelling} />
                  </div>
                </div>
                <div className="app-modal-footer">
                  <button type="button" className="action-btn btn-outlined" onClick={() => setSaleModalOpen(false)} disabled={isSelling}>Cancel</button>
                  <button type="submit" className="action-btn btn-brand-green" disabled={isSelling}
                    style={{ minWidth: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {isSelling
                      ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing…</>
                      : <><CheckCircle2 size={14} /> Complete & Credit Wallet</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success modal */}
        {successModalOpen && (
          <div className="app-modal-backdrop modal-open-state">
            <div className="app-modal-window" style={{ maxWidth: '400px' }}>
              <div className="app-modal-header" style={{ borderBottom: 'none' }}>
                <span className="app-modal-title" style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: '1.2rem', color: 'var(--green)' }}>
                  ✓ Sale Completed Successfully
                </span>
              </div>
              <div className="app-modal-body" style={{ textAlign: 'center', padding: '0.5rem 1.5rem 2rem 1.5rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '1.5rem' }}>
                  Share this code with the customer to activate their internet access:
                </p>
                <div style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '2px dashed var(--green)', marginBottom: '1.5rem' }}>
                  <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Access Code</span>
                  <strong className="td-monospaced" style={{ fontSize: '1.6rem', color: 'var(--text)', fontWeight: 800 }}>{soldCouponCode}</strong>
                </div>
                <button type="button" className="action-btn btn-brand-blue" style={{ width: '100%' }} onClick={() => setSuccessModalOpen(false)}>
                  Close & Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Log-only view (Manager, Owner, Accountant, Admin) ─────────────────────
  const renderLogsView = () => {
    const titles = {
      Manager:    'Staff Sales Logs',
      Owner:      'Sales Activity',
      Accountant: 'Sales Records',
      Admin:      'Coupon Sales Logs',
    };
    const subtitles = {
      Manager:    'All sales by staff at your assigned sites',
      Owner:      'All coupon sales across your sites',
      Accountant: 'All sales across all sites',
      Admin:      'Complete historical record of all coupon sales',
    };
    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">{titles[role] || 'Sales Logs'}</h1>
            <p className="page-subtitle">{subtitles[role] || ''}</p>
          </div>
        </div>
        {renderAnalyticsPanel()}
        {!['Manager', 'Owner'].includes(role) && renderSalesTable(titles[role] || 'Sales', subtitles[role] || '')}
      </>
    );
  };

  return isSeller ? renderPOSView() : renderLogsView();
};
