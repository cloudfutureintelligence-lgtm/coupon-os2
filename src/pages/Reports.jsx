import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Ticket,
  TrendingUp,
  Percent
} from 'lucide-react';

export const Reports = () => {
  const { db, currentUser, selectedSiteId, showToast } = useApp();

  // Report filter states
  const [dateRange, setDateRange] = useState('monthly'); // daily, weekly, monthly, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('all');
  const [filterProfileId, setFilterProfileId] = useState('all');

  if (!currentUser) return null;

  // Filter logic based on choices
  const getReportData = () => {
    let soldCoupons = db.coupons.filter(c => c.status === 'Sold');

    // Tenant Site Isolation
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Accountant') {
      const mySiteIds = db.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
      soldCoupons = soldCoupons.filter(c => mySiteIds.includes(c.siteId));
    } else {
      if (filterSiteId !== 'all') {
        soldCoupons = soldCoupons.filter(c => c.siteId === filterSiteId);
      }
    }

    if (filterProfileId !== 'all') {
      soldCoupons = soldCoupons.filter(c => c.profileId === filterProfileId);
    }

    // Filter by Date
    const now = Date.now();
    let limitTime = 0;
    if (dateRange === 'daily') {
      limitTime = now - 24 * 60 * 60 * 1000;
    } else if (dateRange === 'weekly') {
      limitTime = now - 7 * 24 * 60 * 60 * 1000;
    } else if (dateRange === 'monthly') {
      limitTime = now - 30 * 24 * 60 * 60 * 1000;
    } else if (dateRange === 'custom') {
      const start = customStart ? new Date(customStart).getTime() : 0;
      const end = customEnd ? new Date(customEnd).getTime() : now;
      return soldCoupons.filter(c => {
        const t = new Date(c.soldAt).getTime();
        return t >= start && t <= end;
      });
    }

    return soldCoupons.filter(c => new Date(c.soldAt).getTime() >= limitTime);
  };

  const reportCoupons = getReportData();

  // Metrics
  const totalRevenue = reportCoupons.reduce((sum, c) => sum + c.salePrice, 0);
  const totalCost = reportCoupons.reduce((sum, c) => sum + c.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const soldCount = reportCoupons.length;

  // CSV Exporter
  const handleExportCSV = () => {
    if (reportCoupons.length === 0) {
      showToast('No report records found to export');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Coupon Code, Profile, Cost Price, Sale Price, Site ID, Sold By, Sold At\n";

    reportCoupons.forEach(c => {
      const profName = db.couponProfiles.find(p => p.id === c.profileId)?.name || c.profileId;
      const siteName = db.sites.find(s => s.id === c.siteId)?.name || c.siteId;
      const userName = db.users.find(u => u.id === c.soldByUserId)?.username || c.soldByUserId;
      csvContent += `${c.code}, ${profName}, ${c.cost}, ${c.salePrice}, ${siteName}, ${userName}, ${c.soldAt}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `coupon_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export started');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Reports & Analytics</h1>
          <p className="page-subtitle">Track multi-site sales, margins, and download spreadsheet logs for accounting audits</p>
        </div>
        <div className="page-actions-group">
          <button className="action-btn btn-outlined" onClick={handlePrint}>
            <Printer size={14} /> Print Report
          </button>
          <button className="action-btn btn-brand-blue" onClick={handleExportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Filters */}
      <div className="filters-container-row" style={{ background: 'var(--surface)', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
          <Calendar size={14} style={{ color: 'var(--text-3)' }} />
          <select 
            className="filter-dropdown-select" 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="daily">Past 24 Hours</option>
            <option value="weekly">Past 7 Days</option>
            <option value="monthly">Past 30 Days</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
            <input 
              type="date" 
              className="filter-dropdown-select" 
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ fontSize: '0.78rem' }}>to</span>
            <input 
              type="date" 
              className="filter-dropdown-select" 
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        {(currentUser.role === 'Admin' || currentUser.role === 'Accountant') && (
          <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
            <MapPin size={14} style={{ color: 'var(--text-3)' }} />
            <select 
              className="filter-dropdown-select"
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
            >
              <option value="all">All Sites</option>
              {db.sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
          <select 
            className="filter-dropdown-select"
            value={filterProfileId}
            onChange={(e) => setFilterProfileId(e.target.value)}
          >
            <option value="all">All Plan Profiles</option>
            {db.couponProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Summary cards */}
      <div className="metrics-grid" style={{ marginTop: '1.5rem' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Reported Revenue</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
              <DollarSign size={14} />
            </div>
          </div>
          <div className="metric-value-text">{totalRevenue} AED</div>
          <div className="metric-sub-detail">Gross sales in range</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Inventory cost</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
              <Ticket size={14} />
            </div>
          </div>
          <div className="metric-value-text">{totalCost} AED</div>
          <div className="metric-sub-detail">Stock purchase price</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Net Profit Margin</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="metric-value-text">{totalProfit} AED</div>
          <div className="metric-sub-detail">Margin: {((totalProfit/totalRevenue)*100 || 0).toFixed(1)}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label-text">Coupons Activated</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--yellow-light)', color: 'var(--yellow)' }}>
              <Percent size={14} />
            </div>
          </div>
          <div className="metric-value-text">{soldCount} units</div>
          <div className="metric-sub-detail">Sold & active packages</div>
        </div>
      </div>

      {/* List Grid of Report Details */}
      <div className="ui-card" style={{ marginTop: '1.5rem' }}>
        <div className="ui-card-header">
          <span className="ui-card-title">Detailed Statement Report</span>
        </div>
        <div className="ui-card-body" style={{ padding: 0 }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coupon Code</th>
                  <th>Profile Pack</th>
                  <th>Site Tenant</th>
                  <th>Sales Agent</th>
                  <th>Retail Sale</th>
                  <th>Unit Cost</th>
                  <th>Margin AED</th>
                  <th>Sold At</th>
                </tr>
              </thead>
              <tbody>
                {reportCoupons.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-view-state" style={{ padding: '3rem 1rem' }}>
                      <div className="empty-view-title">No transactions within selected parameters</div>
                    </td>
                  </tr>
                ) : (
                  reportCoupons.map(c => {
                    const prof = db.couponProfiles.find(p => p.id === c.profileId);
                    const site = db.sites.find(s => s.id === c.siteId);
                    const user = db.users.find(u => u.id === c.soldByUserId);
                    const profit = c.salePrice - c.cost;
                    return (
                      <tr key={c.id}>
                        <td className="td-monospaced td-emphasis">{c.code}</td>
                        <td>{prof?.name || c.profileId}</td>
                        <td>{site?.name || '-'}</td>
                        <td>{user?.name || c.soldByUserId}</td>
                        <td style={{ fontWeight: 600, color: 'var(--green)' }}>{c.salePrice} AED</td>
                        <td>{c.cost} AED</td>
                        <td style={{ fontWeight: 600 }}>{profit} AED</td>
                        <td>{new Date(c.soldAt).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
