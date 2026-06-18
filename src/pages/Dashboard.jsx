import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Ticket, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  Wallet, 
  MapPin, 
  AlertTriangle,
  Users,
  Percent,
  ChevronRight,
  ArrowUpRight,
  User,
  BookOpen
} from 'lucide-react';

export const Dashboard = ({ setActivePage }) => {
  const { db, currentUser, selectedSiteId } = useApp();

  if (!currentUser) return null;

  // ── Determine which sites this user can access ────────────────────────────
  const GLOBAL_ROLES = ['Admin', 'Accountant', 'Owner', 'Manager'];
  const userAccessibleSiteIds = GLOBAL_ROLES.includes(currentUser.role)
    ? db.sites.map(s => s.id)
    : (db.userSites || []).filter(us => us.userId === currentUser.id).map(us => us.siteId);

  // Pre-filter coupons to only this user's accessible sites (profile scoping)
  const profileCoupons = db.coupons.filter(c => userAccessibleSiteIds.includes(c.siteId));

  // Then apply the selected site filter on top
  const filterBySite = (items, key = 'siteId') => {
    if (selectedSiteId === 'all') return items;
    return items.filter(item => item[key] === selectedSiteId);
  };

  // 1. Data Aggregation
  const coupons = profileCoupons;
  const siteCoupons = filterBySite(coupons);

  const totalCouponsCount = siteCoupons.length;
  const availableCount = siteCoupons.filter(c => c.status === 'Available').length;
  const assignedCount = siteCoupons.filter(c => c.status === 'Assigned').length;
  const soldCount = siteCoupons.filter(c => c.status === 'Sold').length;
  const expiredCount = siteCoupons.filter(c => c.status === 'Expired').length;

  // Wallet balances
  const wallets = db.wallets;
  const transactions = db.transactions;

  // Filter sold coupons by site
  const soldCoupons = siteCoupons.filter(c => c.status === 'Sold');

  // Revenue & Profit calculations
  const totalRevenue = soldCoupons.reduce((sum, c) => sum + c.salePrice, 0);
  const totalCost = soldCoupons.reduce((sum, c) => sum + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  // Today's Sales
  const today = new Date().toDateString();
  const todaySales = soldCoupons.filter(c => new Date(c.soldAt).toDateString() === today);
  const todayRevenue = todaySales.reduce((sum, c) => sum + c.salePrice, 0);

  // Active sites
  const activeSitesCount = db.sites.filter(s => s.status === 'Active').length;

  // Staff and wallets pending cash collections
  // Calculate how much cash is sitting in staff wallets
  const staffWallets = wallets.filter(w => w.ownerType === 'USER_SALES');
  const totalPendingCollection = staffWallets.reduce((sum, w) => sum + w.balance, 0);

  // Super staff collection wallets (cash collected from staff, not yet given to accountant)
  // FIX: Only include wallets owned by Super Staff users — not Accountant/Manager/Owner wallets
  // which also use USER_COLLECTION type but already belong to the collector.
  const superStaffIds = new Set(db.users.filter(u => u.role === 'Super Staff').map(u => u.id));
  const superCollectionWallets = wallets.filter(w => w.ownerType === 'USER_COLLECTION' && superStaffIds.has(w.ownerId));
  const superCollectedTotal = superCollectionWallets.reduce((sum, w) => sum + w.balance, 0);

  // ═══════════════════════════════════════════
  // PROFILE STOCK BREAKDOWN (shown when a specific site is selected)
  // ═══════════════════════════════════════════
  const renderProfileStockBreakdown = () => {
    if (selectedSiteId === 'all') return null;

    const site = db.sites.find(s => s.id === selectedSiteId);
    if (!site) return null;

    // Get profiles that have any coupons at this site
    const profileIds = [...new Set(siteCoupons.map(c => c.profileId))];
    const profiles = db.couponProfiles.filter(p => profileIds.includes(p.id));

    if (profiles.length === 0) return (
      <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-header">
          <span className="ui-card-title">
            <Ticket size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Stock by Profile — {site.name}
          </span>
        </div>
        <div className="empty-view-state">
          <div className="empty-view-title">No stock found for this site</div>
        </div>
      </div>
    );

    return (
      <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-header">
          <span className="ui-card-title">
            <Ticket size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Stock by Profile — {site.name}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="ui-card-body" style={{ padding: 0 }}>
          {profiles.map((profile, index) => {
            const profCoupons = siteCoupons.filter(c => c.profileId === profile.id);
            const avail    = profCoupons.filter(c => c.status === 'Available').length;
            const assigned = profCoupons.filter(c => c.status === 'Assigned').length;
            const sold     = profCoupons.filter(c => c.status === 'Sold').length;
            const total    = profCoupons.length;
            const availPct = total > 0 ? Math.round((avail / total) * 100) : 0;
            const isLow    = avail > 0 && avail < (db.settings?.lowStockThreshold || 5);
            const isEmpty  = avail === 0;

            return (
              <div
                key={profile.id}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderBottom: index < profiles.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Profile name + status badge */}
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                      {profile.name}
                    </span>
                    {isEmpty && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--red)', background: 'var(--red-light)', padding: '1px 6px', borderRadius: '99px' }}>
                        OUT
                      </span>
                    )}
                    {isLow && !isEmpty && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--yellow)', background: 'var(--yellow-light)', padding: '1px 6px', borderRadius: '99px' }}>
                        LOW
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '2px' }}>
                    {[profile.validity, profile.dataLimit].filter(Boolean).join(' · ') || 'No details'}
                  </div>
                </div>

                {/* Available progress bar */}
                <div style={{ flex: '2 1 140px', minWidth: '100px' }}>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${availPct}%`,
                      background: isEmpty ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)',
                      borderRadius: '99px',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '3px' }}>
                    {availPct}% available of {total} total
                  </div>
                </div>

                {/* Stat chips */}
                <div style={{ display: 'flex', gap: '1.25rem', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isEmpty ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)' }}>
                      {avail}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Available</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue)' }}>{assigned}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Assigned</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--purple)' }}>{sold}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Sold</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // STATS CARD COMPONENT
  // ═══════════════════════════════════════════
  const StatCard = ({ label, value, sub, icon: Icon, color, bg, trend }) => (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-label-text">{label}</span>
        <div className="metric-icon-wrapper" style={{ background: bg, color: color }}>
          <Icon size={14} />
        </div>
      </div>
      <div className="metric-value-text">{value}</div>
      <div className="metric-sub-detail">
        {trend && <span className={trend.startsWith('↑') ? 'metric-trend-up' : 'metric-trend-down'}>{trend} </span>}
        {sub}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // 1. ADMIN DASHBOARD
  // ═══════════════════════════════════════════
  const renderAdminDashboard = () => {
    // Top active staff list
    const staffSalesMap = {};
    soldCoupons.forEach(c => {
      if (!staffSalesMap[c.soldByUserId]) staffSalesMap[c.soldByUserId] = 0;
      staffSalesMap[c.soldByUserId] += c.salePrice;
    });
    const topStaff = Object.keys(staffSalesMap).map(sid => {
      const uObj = db.users.find(u => u.id === sid);
      return { name: uObj ? uObj.name : sid, role: uObj ? uObj.role : 'Staff', sales: staffSalesMap[sid] };
    }).sort((a, b) => b.sales - a.sales).slice(0, 4);

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Enterprise Admin Dashboard</h1>
            <p className="page-subtitle">Complete overview of distribution, inventory, and ledger across all site tenants</p>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="Total Coupons Stock" value={totalCouponsCount} sub="Coupons in platform" icon={Ticket} color="var(--blue)" bg="var(--blue-light)" trend="↑ 12%" />
          <StatCard label="Available Inventory" value={availableCount} sub={`${((availableCount/totalCouponsCount)*100 || 0).toFixed(1)}% of total`} icon={CheckCircle2} color="var(--green)" bg="var(--green-light)" />
          <StatCard label="Sold Coupons" value={soldCount} sub={`${((soldCount/totalCouponsCount)*100 || 0).toFixed(1)}% sell-out rate`} icon={TrendingUp} color="var(--purple)" bg="var(--purple-light)" />
          <StatCard label="Today's Revenue" value={`${todayRevenue} AED`} sub={`${todaySales.length} coupon sales today`} icon={DollarSign} color="var(--green)" bg="var(--green-light)" trend="↑ 24%" />
          <StatCard label="Outstanding in Wallets" value={`${totalPendingCollection} AED`} sub="Held by sales staff" icon={Wallet} color="var(--yellow)" bg="var(--yellow-light)" />
          <StatCard label="Active Sites (Tenants)" value={activeSitesCount} sub="Across UAE regions" icon={MapPin} color="var(--blue)" bg="var(--blue-light)" />
        </div>

        {renderProfileStockBreakdown()}

        <div className="layout-grid-columns-2">
          {/* Revenue Chart View */}
          <div className="ui-card">
            <div className="ui-card-header">
              <span className="ui-card-title">Site Revenue Split & Activity</span>
            </div>
            <div className="ui-card-body">
              <div className="custom-chart-wrapper flex-align-items-center flex-justify-center">
                <svg viewBox="0 0 100 100" style={{ width: '150px', height: '150px' }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border)" strokeWidth="15" />
                  {/* Site A = 70%, Site B = 30% */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--blue)" strokeWidth="15" 
                    strokeDasharray="251.2" strokeDashoffset="75" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--green)" strokeWidth="15" 
                    strokeDasharray="251.2" strokeDashoffset="210" transform="rotate(162 50 50)" />
                </svg>
                <div style={{ marginLeft: '2rem', fontSize: '0.82rem' }}>
                  <div className="flex-align-items-center" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', background: 'var(--blue)', borderRadius: '3px' }} />
                    <span>Site A - 75% ({totalRevenue * 0.75} AED)</span>
                  </div>
                  <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', background: 'var(--green)', borderRadius: '3px' }} />
                    <span>Site B - 25% ({totalRevenue * 0.25} AED)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performance Staff */}
          <div className="ui-card">
            <div className="ui-card-header">
              <span className="ui-card-title">Top Performing Sales Staff</span>
            </div>
            <div className="ui-card-body" style={{ padding: 0 }}>
              {topStaff.length === 0 ? (
                <div className="empty-view-state">
                  <div className="empty-view-title">No sales records found</div>
                </div>
              ) : (
                topStaff.map((staff, index) => (
                  <div 
                    key={index} 
                    className="flex-align-items-center flex-justify-space-between" 
                    style={{ 
                      padding: '0.85rem 1.25rem', 
                      borderBottom: index < topStaff.length - 1 ? '1px solid var(--border)' : 'none' 
                    }}
                  >
                    <div className="flex-align-items-center" style={{ gap: '0.75rem' }}>
                      <div className="avatar-stack-item">{staff.name[0]}</div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{staff.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{staff.role}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)' }}>
                      {staff.sales} AED
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════
  // SHARED: Monthly Sales Overview
  // ═══════════════════════════════════════════
  const renderMonthlySalesOverview = (filteredSoldCoupons) => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
      };
    });

    const monthData = months.map(m => {
      const sales = filteredSoldCoupons.filter(c => {
        if (!c.soldAt) return false;
        const d = new Date(c.soldAt);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      return {
        label: m.label,
        count: sales.length,
        revenue: sales.reduce((s, c) => s + (Number(c.salePrice) || 0), 0),
      };
    });

    const maxRevenue = Math.max(...monthData.map(m => m.revenue), 1);
    const maxCount = Math.max(...monthData.map(m => m.count), 1);

    return (
      <div className="ui-card" style={{ marginTop: '1.25rem' }}>
        <div className="ui-card-header">
          <span className="ui-card-title">
            <TrendingUp size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Monthly Sales Overview
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Last 6 months</span>
        </div>
        <div className="ui-card-body">
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: '120px', padding: '0 0.5rem 0' }}>
            {monthData.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600 }}>{m.revenue > 0 ? `${m.revenue}` : ''}</span>
                <div
                  title={`${m.label}: ${m.count} sold, ${m.revenue} AED`}
                  style={{
                    width: '100%',
                    height: `${Math.max((m.revenue / maxRevenue) * 80, m.revenue > 0 ? 6 : 2)}px`,
                    background: m.revenue > 0 ? 'var(--brand-blue)' : 'var(--border)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s',
                    minHeight: '2px',
                    cursor: 'default',
                    opacity: i === monthData.length - 1 ? 1 : 0.65 + (i * 0.07),
                  }}
                />
              </div>
            ))}
          </div>
          {/* Month labels */}
          <div style={{ display: 'flex', gap: '0.6rem', padding: '0 0.5rem', marginTop: '6px' }}>
            {monthData.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 600 }}>{m.label}</div>
            ))}
          </div>
          {/* Summary row */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {monthData.map((m, i) => (
              <div key={i} style={{ flex: 1, minWidth: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{m.label}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{m.count}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 600 }}>{m.revenue > 0 ? `${m.revenue} AED` : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // 2. OWNER DASHBOARD
  // ═══════════════════════════════════════════
  const renderOwnerDashboard = () => {
    const ownerSiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);

    // Respect selected site filter
    const ownerSoldCoupons = db.coupons.filter(c =>
      c.status === 'Sold' &&
      ownerSiteIds.includes(c.siteId) &&
      (selectedSiteId === 'all' || c.siteId === selectedSiteId)
    );

    const ownerTotalRevenue = ownerSoldCoupons.reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0);

    // Today's sales
    const ownerTodaySales = ownerSoldCoupons.filter(c => new Date(c.soldAt).toDateString() === today);
    const ownerTodayRevenue = ownerTodaySales.reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0);

    // This month's sales
    const now = new Date();
    const ownerMonthSales = ownerSoldCoupons.filter(c => {
      const d = new Date(c.soldAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const ownerMonthRevenue = ownerMonthSales.reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0);

    const siteLabelSuffix = selectedSiteId === 'all' ? 'all sites' : (db.sites.find(s => s.id === selectedSiteId)?.name || 'selected site');

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Owner Insights Dashboard</h1>
            <p className="page-subtitle">Real-time revenue, margins, stock levels, and staff balances for assigned sites</p>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="Total Revenue" value={`${ownerTotalRevenue} AED`} sub={`Gross sales — ${siteLabelSuffix}`} icon={DollarSign} color="var(--green)" bg="var(--green-light)" />
          <StatCard label="Today's Sales" value={`${ownerTodayRevenue} AED`} sub={`${ownerTodaySales.length} coupon${ownerTodaySales.length !== 1 ? 's' : ''} sold today`} icon={TrendingUp} color="var(--blue)" bg="var(--blue-light)" />
          <StatCard label="This Month's Sales" value={`${ownerMonthRevenue} AED`} sub={`${ownerMonthSales.length} coupon${ownerMonthSales.length !== 1 ? 's' : ''} sold this month`} icon={ArrowUpRight} color="var(--purple)" bg="var(--purple-light)" />
          <StatCard label="Pending Collections" value={`${totalPendingCollection} AED`} sub="Cash sitting in staff wallets" icon={Wallet} color="var(--yellow)" bg="var(--yellow-light)" />
        </div>

        {renderProfileStockBreakdown()}

        {renderMonthlySalesOverview(ownerSoldCoupons)}

        <div className="ui-card" style={{ marginTop: '1.25rem' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Coupon Profile Breakdown</span>
          </div>
          <div className="ui-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {db.couponProfiles.map(p => {
                const count = ownerSoldCoupons.filter(c => c.profileId === p.id).length;
                const rev = ownerSoldCoupons.filter(c => c.profileId === p.id).reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0);
                return (
                  <div key={p.id} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0' }}>{count} Sold</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>{rev} AED Revenue</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════
  // 3. MANAGER DASHBOARD
  // ═══════════════════════════════════════════
  const renderManagerDashboard = () => {
    const managerSiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    const managerSoldCoupons = db.coupons.filter(c => c.status === 'Sold' && managerSiteIds.includes(c.siteId));

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Manager Station</h1>
            <p className="page-subtitle">Track stock assignments, sales updates, and approve field activities</p>
          </div>
          <div className="page-actions-group">
            <button className="action-btn btn-brand-blue" onClick={() => setActivePage('sales')}>
              <DollarSign size={16} /> Sell Coupon
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="Coupons Stock" value={totalCouponsCount} sub="Assigned to your sites" icon={Ticket} color="var(--blue)" bg="var(--blue-light)" />
          <StatCard label="Stock Available" value={availableCount} sub="Ready to be sold" icon={CheckCircle2} color="var(--green)" bg="var(--green-light)" />
          <StatCard label="Sold Coupons" value={soldCount} sub="Total site activations" icon={TrendingUp} color="var(--purple)" bg="var(--purple-light)" />
          <StatCard label="Total Site Revenue" value={`${totalRevenue} AED`} sub="From site sales" icon={DollarSign} color="var(--green)" bg="var(--green-light)" />
        </div>

        {renderProfileStockBreakdown()}

        {renderMonthlySalesOverview(managerSoldCoupons)}

        <div className="ui-card" style={{ marginTop: '1.25rem' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Operational Warning Signals</span>
          </div>
          <div className="ui-card-body">
            {availableCount < 5 ? (
              <div className="alert-banner alert-warning-type">
                <AlertTriangle />
                <div>
                  <strong>Critical Low Stock Warning!</strong> Only {availableCount} unassigned coupons left in your local pool. Please request more stock from Admin.
                </div>
              </div>
            ) : (
              <div className="alert-banner alert-info-type">
                <CheckCircle2 size={16} />
                <div>
                  <strong>All Systems Normal.</strong> Stock levels are healthy and there are no pending stock warnings for your assigned sites.
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════
  // 4. SUPER STAFF DASHBOARD
  // ═══════════════════════════════════════════
  const renderSuperStaffDashboard = () => {
    const personalWallet = wallets.find(w => w.ownerId === currentUser.id && w.ownerType === 'USER_SALES');
    const collectionWallet = wallets.find(w => w.ownerId === currentUser.id && w.ownerType === 'USER_COLLECTION');
    const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    const availableSiteStock = coupons.filter(c => mySiteIds.includes(c.siteId) && c.status === 'Available').length;

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Super Staff Panel</h1>
            <p className="page-subtitle">Track your stock, conduct sales, and collect money from assigned field staff</p>
          </div>
          <div className="page-actions-group">
            <button className="action-btn btn-brand-blue" onClick={() => setActivePage('sales')}>
              <DollarSign size={16} /> Sell Coupon
            </button>
            <button className="action-btn btn-brand-green" onClick={() => setActivePage('collections')}>
              <Wallet size={16} /> Cash Collection
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="Personal Sales Wallet" value={`${personalWallet?.balance || 0} AED`} sub="From your own sales" icon={Wallet} color="var(--blue)" bg="var(--blue-light)" />
          <StatCard label="Collected Cash Wallet" value={`${collectionWallet?.balance || 0} AED`} sub="Collected from staff" icon={DollarSign} color="var(--green)" bg="var(--green-light)" />
          <StatCard label="Site Pool Available Stock" value={availableSiteStock} sub="Ready to be sold" icon={Ticket} color="var(--purple)" bg="var(--purple-light)" />
          <StatCard label="Active Staff" value={db.users.filter(u => u.role === 'Staff').length} sub="Under your collection" icon={Users} color="var(--blue)" bg="var(--blue-light)" />
        </div>

        {renderProfileStockBreakdown()}
      </>
    );
  };

  // ═══════════════════════════════════════════
  // 5. STAFF DASHBOARD
  // ═══════════════════════════════════════════
  const renderStaffDashboard = () => {
    const personalWallet = wallets.find(w => w.ownerId === currentUser.id && w.ownerType === 'USER_SALES');
    const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    const availableSiteStock = coupons.filter(c => mySiteIds.includes(c.siteId) && c.status === 'Available').length;
    const mySalesToday = coupons.filter(c => c.soldByUserId === currentUser.id && c.status === 'Sold' && new Date(c.soldAt).toDateString() === today);

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Staff Dashboard</h1>
            <p className="page-subtitle">Access your assigned coupons inventory, activate customer sales, and track wallet balances</p>
          </div>
          <div className="page-actions-group">
            <button className="action-btn btn-brand-blue" onClick={() => setActivePage('sales')}>
              <DollarSign size={16} /> Sell Coupon
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="My Wallet Balance" value={`${personalWallet?.balance || 0} AED`} sub="Awaiting cash collection" icon={Wallet} color="var(--green)" bg="var(--green-light)" />
          <StatCard label="Site Pool Available Stock" value={availableSiteStock} sub="Coupons available to sell" icon={Ticket} color="var(--blue)" bg="var(--blue-light)" />
          <StatCard label="Sales Today" value={mySalesToday.length} sub="Coupons activated today" icon={CheckCircle2} color="var(--purple)" bg="var(--purple-light)" />
          <StatCard label="Revenue Today" value={`${mySalesToday.reduce((sum, c) => sum + c.salePrice, 0)} AED`} sub="Gross value today" icon={DollarSign} color="var(--green)" bg="var(--green-light)" />
        </div>

        {renderProfileStockBreakdown()}

        <div className="ui-card">
          <div className="ui-card-header">
            <span className="ui-card-title">Recent Sales Feed</span>
          </div>
          <div className="ui-card-body" style={{ padding: 0 }}>
            {todaySales.length === 0 ? (
              <div className="empty-view-state">
                <div className="empty-view-title">No sales completed today</div>
              </div>
            ) : (
              todaySales.map((sale, index) => (
                <div 
                  key={sale.id} 
                  className="flex-align-items-center flex-justify-space-between" 
                  style={{ 
                    padding: '0.85rem 1.25rem', 
                    borderBottom: index < todaySales.length - 1 ? '1px solid var(--border)' : 'none' 
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                      Code: {sale.code}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                      {sale.customerName ? `Customer: ${sale.customerName}` : 'Walk-in'} • {new Date(sale.soldAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)' }}>
                    +{sale.salePrice} AED
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  // ═══════════════════════════════════════════
  // 6. ACCOUNTANT DASHBOARD
  // ═══════════════════════════════════════════
  const renderAccountantDashboard = () => {
    // Balances sitting in Super Staff collection wallets
    const accWallets = wallets.filter(w => w.ownerId === currentUser.id && w.ownerType === 'ACCOUNTANT_SITE');

    return (
      <>
        <div className="page-header-row">
          <div>
            <h1 className="page-title-main">Treasury & Accounting Desk</h1>
            <p className="page-subtitle">Verify cash collection allocations, reconcile double-entry ledger books, and post adjustments</p>
          </div>
          <div className="page-actions-group">
            <button className="action-btn btn-brand-purple" onClick={() => setActivePage('collections')}>
              <DollarSign size={16} /> Collect Cash from Super Staff
            </button>
          </div>
        </div>

        <div className="metrics-grid">
          <StatCard label="Pending in Super Staff Wallets" value={`${superCollectedTotal} AED`} sub="Ready for Accountant collection" icon={Wallet} color="var(--yellow)" bg="var(--yellow-light)" />
          <StatCard label="Ledger Entries Logged" value={transactions.length} sub="All-time double entries" icon={BookOpen} color="var(--blue)" bg="var(--blue-light)" />
        </div>

        <div className="ui-card">
          <div className="ui-card-header">
            <span className="ui-card-title">Site Allocation Cash Balances</span>
          </div>
          <div className="ui-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {accWallets.map(w => {
                const site = db.sites.find(s => s.id === w.siteId);
                return (
                  <div key={w.id} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>{site?.name || w.siteId} Cash Wallet</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0', color: 'var(--green)' }}>{w.balance} AED</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Location: {site?.location || 'UAE'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Switch dashboards based on active role
  switch (currentUser.role) {
    case 'Admin':
      return renderAdminDashboard();
    case 'Owner':
      return renderOwnerDashboard();
    case 'Manager':
      return renderManagerDashboard();
    case 'Super Staff':
      return renderSuperStaffDashboard();
    case 'Staff':
      return renderStaffDashboard();
    case 'Accountant':
      return renderAccountantDashboard();
    default:
      return renderStaffDashboard();
  }
};
