import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart2, Calendar, Download, Printer, Filter } from 'lucide-react';

// ── Date helpers ──────────────────────────────────────────────────────────────
const toDateStr = (d) => d.toISOString().slice(0, 10);
const todayStr       = () => toDateStr(new Date());
const thisMonthStart = () => { const d = new Date(); d.setDate(1); return toDateStr(d); };
const isInRange = (isoStr, from, to) => {
  if (!isoStr) return false;
  const d = isoStr.slice(0, 10);
  if (from && d < from) return false;
  if (to   && d > to  ) return false;
  return true;
};

/**
 * SalesAnalyticsPanel
 *
 * Props:
 *   pendingSale      — optimistic sale object from Sales.jsx (optional)
 *   showTransactions — if false, hide the full transaction detail table (default true)
 */
export const SalesAnalyticsPanel = ({ pendingSale = null, showTransactions = true }) => {
  const { db, currentUser, showToast, selectedSiteId, setSelectedSiteId } = useApp();

  const [dateMode, setDateMode]     = useState('today');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo]     = useState(todayStr());

  if (!currentUser) return null;

  const role = currentUser.role;

  const getRange = () => {
    if (dateMode === 'today')  return { from: todayStr(),       to: todayStr() };
    if (dateMode === 'month')  return { from: thisMonthStart(), to: todayStr() };
    return { from: customFrom, to: customTo };
  };

  const { from, to } = getRange();

  // Which sites this user can see.
  // ONLY Admin is global — every other role (including Accountant) is strictly
  // limited to their own assigned sites via db.userSites.
  const visibleSiteIds = role === 'Admin'
    ? db.sites.map(s => s.id)
    : db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);

  // Apply site filter
  const filteredSiteIds = selectedSiteId === 'all'
    ? visibleSiteIds
    : visibleSiteIds.filter(id => id === selectedSiteId);

  // Build per-site stats
  const siteStats = filteredSiteIds.map(siteId => {
    const site = db.sites.find(s => s.id === siteId);
    let sold = db.coupons.filter(c => c.status === 'Sold' && c.siteId === siteId);

    if (pendingSale && pendingSale.siteId === siteId && !sold.find(c => c.code === pendingSale.code)) {
      sold = [pendingSale, ...sold];
    }

    const filtered = sold.filter(c => isInRange(c.soldAt, from, to));

    const profileMap = {};
    filtered.forEach(c => { profileMap[c.profileId] = (profileMap[c.profileId] || 0) + 1; });

    const sellerMap = {};
    filtered.forEach(c => { sellerMap[c.soldByUserId] = (sellerMap[c.soldByUserId] || 0) + 1; });

    const revenue = filtered.reduce((s, c) => s + (Number(c.salePrice) || 0), 0);
    const cost    = filtered.reduce((s, c) => s + (Number(c.cost) || 0), 0);

    return { siteId, site, count: filtered.length, revenue, cost, profit: revenue - cost, profileMap, sellerMap, filtered };
  });

  const totalCount   = siteStats.reduce((s, x) => s + x.count,   0);
  const totalRevenue = siteStats.reduce((s, x) => s + x.revenue, 0);
  const totalCost    = siteStats.reduce((s, x) => s + x.cost,    0);
  const totalProfit  = totalRevenue - totalCost;
  const activeSites  = siteStats.filter(x => x.count > 0).length;
  const margin       = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  const allFiltered  = siteStats.flatMap(s => s.filtered);

  const rangeLabel = dateMode === 'today' ? 'Today'
    : dateMode === 'month' ? 'This Month'
    : `${from} → ${to}`;

  // ── Revenue by Site table data ─────────────────────────────────────────────
  const revenueBySite = siteStats
    .filter(s => s.count > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map(s => ({
      ...s,
      sharePercent: totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) : '0.0',
    }));

  // ── Sales by Profile table data ────────────────────────────────────────────
  const profileTotals = {};
  allFiltered.forEach(c => {
    if (!profileTotals[c.profileId]) {
      profileTotals[c.profileId] = { count: 0, revenue: 0 };
    }
    profileTotals[c.profileId].count   += 1;
    profileTotals[c.profileId].revenue += Number(c.salePrice) || 0;
  });

  const salesByProfile = Object.entries(profileTotals)
    .map(([profileId, data]) => {
      const prof = db.couponProfiles.find(p => p.id === profileId);
      return {
        profileId,
        name: prof?.name || profileId,
        count: data.count,
        revenue: data.revenue,
        sharePercent: totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : '0.0',
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (allFiltered.length === 0) { showToast('No data to export'); return; }

    const rows = [
      ['Coupon Code', 'Profile', 'Site', 'Sold By', 'Sale Price (AED)', 'Cost (AED)', 'Profit (AED)', 'Sold At'],
      ...allFiltered.map(c => {
        const prof = db.couponProfiles.find(p => p.id === c.profileId)?.name || c.profileId;
        const site = db.sites.find(s => s.id === c.siteId)?.name || c.siteId;
        const user = db.users.find(u => u.id === c.soldByUserId)?.name || c.soldByUserId;
        const profit = (c.salePrice || 0) - (c.cost || 0);
        return [c.code, prof, site, user, c.salePrice, c.cost, profit, new Date(c.soldAt).toLocaleString()];
      }),
    ];

    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sales_analytics_${rangeLabel.replace(/ /g, '_').replace(/→/g, 'to')}_${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully');
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Shared styles ───────────────────────────────────────────────────────────
  const summaryCardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1rem 1.25rem',
    flex: 1,
    minWidth: '150px',
  };

  const tableHeaderStyle = {
    fontSize: '0.65rem',
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.5rem 0.75rem',
    fontWeight: 600,
    background: 'var(--surface-2)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };

  const tableCellStyle = {
    padding: '0.55rem 0.75rem',
    fontSize: '0.82rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text)',
  };

  const progressBarBg = {
    background: 'var(--surface-2)',
    borderRadius: '999px',
    height: '6px',
    width: '80px',
    overflow: 'hidden',
    display: 'inline-block',
    verticalAlign: 'middle',
    marginLeft: '0.4rem',
  };

  // Visible sites for filter dropdown (only those the user can access)
  const visibleSites = db.sites.filter(s => visibleSiteIds.includes(s.id));

  return (
    <>
      {/* ── Header card with date controls + site filter + export/print ── */}
      <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={14} />
            <span className="ui-card-title">Sales Analytics</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginLeft: '0.25rem' }}>— {rangeLabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Date mode tabs */}
            {[['today', 'Today'], ['month', 'This Month'], ['custom', 'Custom']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setDateMode(m)}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: dateMode === m ? 'var(--blue)' : 'var(--surface-2)',
                  color: dateMode === m ? '#fff' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontWeight: dateMode === m ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.15rem' }} />

            {/* Site Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Filter size={12} style={{ color: 'var(--text-3)' }} />
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.22rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: selectedSiteId !== 'all' ? 'var(--blue)' : 'var(--surface-2)',
                  color: selectedSiteId !== 'all' ? '#fff' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontWeight: selectedSiteId !== 'all' ? 700 : 400,
                  outline: 'none',
                }}
              >
                <option value="all">All Sites</option>
                {visibleSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.15rem' }} />

            {/* Print */}
            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.65rem', fontSize: '0.72rem', borderRadius: '4px',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              <Printer size={12} /> Print
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.65rem', fontSize: '0.72rem', borderRadius: '4px',
                border: '1px solid var(--blue)', background: 'var(--blue)',
                color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>

        {/* Custom date range picker */}
        {dateMode === 'custom' && (
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={13} style={{ color: 'var(--text-3)' }} />
              <label style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>From</label>
              <input type="date" value={customFrom} max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>To</label>
              <input type="date" value={customTo} min={customFrom} max={todayStr()}
                onChange={e => setCustomTo(e.target.value)}
                style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }} />
            </div>
          </div>
        )}

        {/* Overall summary row */}
        <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ ...summaryCardStyle, borderLeft: '3px solid var(--blue)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Sales</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{totalCount}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>coupons sold</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '3px solid var(--green)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>gross sales</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '3px solid var(--purple)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Net Profit</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalProfit.toLocaleString()} AED
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>margin {margin}%</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Active Sites</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{activeSites} / {filteredSiteIds.length}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>had sales this period</div>
          </div>
        </div>
      </div>

      {/* ── Revenue by Site + Sales by Profile (side by side) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

        {/* Revenue by Site */}
        <div className="ui-card" style={{ marginBottom: 0 }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Revenue by Site</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{revenueBySite.length} active site{revenueBySite.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {revenueBySite.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.82rem' }}>No sales data for this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Site</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Coupons</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Revenue</th>
                    {role !== 'Manager' && role !== 'Owner' && (
                      <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Profit</th>
                    )}
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueBySite.map(s => (
                    <tr key={s.siteId} style={{ background: selectedSiteId === s.siteId ? 'var(--surface-2)' : 'transparent' }}>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: 700 }}>{s.site?.name || s.siteId}</span>
                        {s.site?.location && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', display: 'block' }}>{s.site.location}</span>
                        )}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <span className="pill-badge badge-info">{s.count}</span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                        {s.revenue.toLocaleString()} AED
                      </td>
                      {role !== 'Manager' && role !== 'Owner' && (
                        <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600, color: s.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {s.profit.toLocaleString()} AED
                        </td>
                      )}
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '0.82rem' }}>
                          {s.sharePercent}%
                        </span>
                        <span style={progressBarBg}>
                          <span style={{ display: 'block', height: '100%', width: `${s.sharePercent}%`, background: 'var(--blue)', borderRadius: '999px' }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {revenueBySite.length > 1 && (
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-2)' }}>Total</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>{totalCount}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</td>
                      {role !== 'Manager' && role !== 'Owner' && (
                        <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800, color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{totalProfit.toLocaleString()} AED</td>
                      )}
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        {/* Sales by Profile */}
        <div className="ui-card" style={{ marginBottom: 0 }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Sales by Profile</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{salesByProfile.length} profile{salesByProfile.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {salesByProfile.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.82rem' }}>No sales data for this period</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Profile</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Units Sold</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByProfile.map(p => (
                    <tr key={p.profileId}>
                      <td style={tableCellStyle}>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <span className="pill-badge badge-success">{p.count}</span>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                        {p.revenue.toLocaleString()} AED
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--purple)', fontSize: '0.82rem' }}>
                          {p.sharePercent}%
                        </span>
                        <span style={{ ...progressBarBg }}>
                          <span style={{ display: 'block', height: '100%', width: `${p.sharePercent}%`, background: 'var(--purple)', borderRadius: '999px' }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {salesByProfile.length > 1 && (
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-2)' }}>Total</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>{totalCount}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{totalRevenue.toLocaleString()} AED</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Individual site cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {siteStats
          .sort((a, b) => b.revenue - a.revenue)
          .map(({ siteId, site, count, revenue, profit, profileMap, sellerMap }) => {
            const profileEntries = Object.entries(profileMap).sort((a, b) => b[1] - a[1]);
            const sellerEntries  = Object.entries(sellerMap).sort((a, b) => b[1] - a[1]);
            const hasData = count > 0;

            return (
              <div key={siteId} className="ui-card" style={{ marginBottom: 0, opacity: hasData ? 1 : 0.55 }}>
                <div className="ui-card-header" style={{ background: hasData ? 'var(--surface-2)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{site?.name || siteId}</span>
                    {site?.location && <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>· {site.location}</span>}
                  </div>
                  <span className={`pill-badge ${hasData ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>
                    {hasData ? `${count} sold` : 'No sales'}
                  </span>
                </div>

                <div style={{ padding: '0.9rem 1rem' }}>
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
                    {role !== 'Manager' && role !== 'Owner' && (
                      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: '6px', padding: '0.6rem 0.75rem' }}>
                        <div style={{ fontSize: '0.63rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Profit</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {hasData ? `${profit.toLocaleString()} AED` : '—'}
                        </div>
                      </div>
                    )}
                  </div>

                  {hasData && (
                    <>
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
                                  const prof  = db.couponProfiles.find(p => p.id === pid);
                                  const price = db.sitePrices?.find(sp => sp.siteId === siteId && sp.profileId === pid)?.salePrice ?? prof?.salePrice ?? 0;
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

                      {sellerEntries.length > 0 && ['Admin', 'Owner', 'Manager', 'Accountant'].includes(role) && (
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>By Staff</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {sellerEntries.map(([uid, cnt]) => {
                              const user = db.users.find(u => u.id === uid);
                              return (
                                <span key={uid} style={{ padding: '0.18rem 0.55rem', borderRadius: '20px', fontSize: '0.7rem', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                                  {user?.name || uid} <span style={{ fontWeight: 700, color: 'var(--blue)' }}>×{cnt}</span>
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

      {/* ── Transaction detail table ── */}
      {showTransactions && allFiltered.length > 0 && (
        <div className="ui-card" style={{ marginBottom: '2rem' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Transaction Detail</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{allFiltered.length} records</span>
          </div>
          <div className="ui-card-body" style={{ padding: 0 }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coupon Code</th>
                    <th>Profile</th>
                    <th>Site</th>
                    <th>Sold By</th>
                    <th>Sale Price</th>
                    <th>Cost</th>
                    <th>Profit</th>
                    <th>Sold At</th>
                  </tr>
                </thead>
                <tbody>
                  {allFiltered.map((c, i) => {
                    const prof   = db.couponProfiles.find(p => p.id === c.profileId);
                    const site   = db.sites.find(s => s.id === c.siteId);
                    const user   = db.users.find(u => u.id === c.soldByUserId);
                    const profit = (c.salePrice || 0) - (c.cost || 0);
                    return (
                      <tr key={c.id || i}>
                        <td className="td-monospaced td-emphasis">{c.code}</td>
                        <td>{prof?.name || '-'}</td>
                        <td>{site?.name || '-'}</td>
                        <td>{user?.name || '-'}</td>
                        <td style={{ fontWeight: 600, color: 'var(--green)' }}>{c.salePrice} AED</td>
                        <td>{c.cost} AED</td>
                        <td style={{ fontWeight: 600, color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{profit} AED</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{new Date(c.soldAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          /* Hide chrome */
          #sidebar-nav,
          #main-viewport > nav,
          .page-actions-group,
          button { display: none !important; }

          /* Reset layout so content fills the page */
          body, html { background: white !important; margin: 0; padding: 0; }
          #main-viewport, #app-root, main, [class*="main"] {
            margin-left: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          /* Let cards flow naturally across pages */
          .ui-card {
            break-inside: auto;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            margin-bottom: 0.75rem !important;
            page-break-inside: auto;
          }

          /* Tables: repeat header on every page, never clip rows */
          table {
            width: 100% !important;
            font-size: 0.72rem !important;
            border-collapse: collapse !important;
          }
          thead { display: table-header-group !important; }
          tbody { display: table-row-group !important; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          th, td {
            padding: 0.3rem 0.5rem !important;
            border: 1px solid #ddd !important;
          }

          /* Summary cards: 2-up on print */
          .ui-card > div[style*="display: flex"] {
            flex-wrap: wrap !important;
          }

          /* Ensure overflow tables are fully visible */
          .data-table-container, [style*="overflow"] {
            overflow: visible !important;
          }
        }
      `}</style>
    </>
  );
};
