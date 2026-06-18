import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingCart, Search, CheckCircle2, Loader2, Receipt, MessageSquare, CheckCheck, Gift, Lock } from 'lucide-react';
import { sendCouponSms, normalisePhone, isAllowedForProvider } from '../utils/smsService';
import { SalesAnalyticsPanel } from '../components/SalesAnalyticsPanel';

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
  const { db, currentUser, selectedSiteId, sellCoupon, showToast, isSiteActive } = useApp();

  // POS state
  const [selectedProfileId, setSelectedProfileId] = useState('all');
  const [saleModalOpen, setSaleModalOpen]         = useState(false);
  const [targetProfile, setTargetProfile]         = useState(null);
  const [custName, setCustName]                   = useState('');
  const [custPhone, setCustPhone]                 = useState('');
  const [remarks, setRemarks]                     = useState('');
  // Manager-only: mark this sale as a free coupon (price forced to 0)
  const [isFreeCoupon, setIsFreeCoupon]           = useState(false);

  // Duplicate-click guard
  const [isSelling, setIsSelling]   = useState(false);
  const saleInFlightRef             = useRef(false);

  // Success modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [soldCouponCode, setSoldCouponCode]     = useState('');
  // Optimistic sold entry shown immediately after sale
  const [pendingSale, setPendingSale]           = useState(null);

  // SMS delivery state
  const [smsSending, setSmsSending]   = useState(false);
  const [smsSent, setSmsSent]         = useState(false);
  const [smsError, setSmsError]       = useState('');
  const [smsPhone, setSmsPhone]       = useState('');

  // Sales-log search (code, name, mobile)
  const [logSearch, setLogSearch] = useState('');

  if (!currentUser) return null;

  const role     = currentUser.role;
  const isSeller = ['Staff', 'Super Staff', 'Manager'].includes(role);
  const isManager = role === 'Manager';
  const showLog  = ['Staff', 'Super Staff', 'Manager', 'Owner', 'Accountant', 'Admin'].includes(role);
  const showAnalytics = ['Manager', 'Owner', 'Accountant', 'Admin'].includes(role);

  const currentSite = db.sites.find(s => s.id === selectedSiteId);
  const siteSubscriptionActive = selectedSiteId === 'all' ? true : isSiteActive(currentSite);

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
      const freeSale = isManager && isFreeCoupon;
      const res = await sellCoupon(selectedSiteId, targetProfile.id, custName, custPhone, remarks, freeSale);
      if (res && res.success) {
        const optimistic = {
          code:           res.couponCode,
          profileId:      targetProfile.id,
          siteId:         selectedSiteId,
          salePrice:      freeSale ? 0 : getProfilePrice(targetProfile.id),
          isFree:         freeSale,
          customerName:   custName,
          customerPhone:  custPhone,
          soldAt:         new Date().toISOString(),
          soldByUserId:   currentUser.id,
        };
        setPendingSale(optimistic);
        setSoldCouponCode(res.couponCode);
        setSaleModalOpen(false);
        setTargetProfile(null);
        // Pre-fill SMS phone from customer phone and reset SMS state
        setSmsPhone(custPhone || '');
        setSmsSent(false);
        setSmsError('');
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

  // ── Analytics rendered via shared SalesAnalyticsPanel component ─────────────

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
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>
                      {log.isFree ? (
                        <span className="pill-badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Gift size={11} /> FREE
                        </span>
                      ) : (
                        `${log.salePrice} AED`
                      )}
                    </td>
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

  // ── POS view (Staff + Super Staff + Manager) ───────────────────────────────
  const renderPOSView = () => {
    // Only show profiles assigned to the current site (have a sitePrices entry)
    const assignedProfileIds = new Set(
      (db.sitePrices || []).filter(sp => sp.siteId === selectedSiteId).map(sp => sp.profileId)
    );
    let list = db.couponProfiles.filter(p => assignedProfileIds.has(p.id));
    if (selectedProfileId !== 'all') list = list.filter(p => p.id === selectedProfileId);

    // Subscription gate — selling (and everything else on this page) stops for an expired site
    if (!siteSubscriptionActive) {
      return (
        <>
          <div className="page-header-row">
            <div>
              <h1 className="page-title-main">Retail Point of Sale</h1>
              <p className="page-subtitle">Select a package profile to sell to a retail customer</p>
            </div>
          </div>
          <div className="empty-view-state" style={{ padding: '3rem 1.5rem', border: '1px dashed var(--red)', borderRadius: 'var(--radius)', background: 'var(--red-light)' }}>
            <Lock size={36} style={{ color: 'var(--red)', marginBottom: '0.5rem' }} />
            <div className="empty-view-title" style={{ color: 'var(--red)' }}>Subscription Expired</div>
            <div className="empty-view-description">
              {currentSite?.name || 'This site'}'s subscription has expired. Coupon sales are paused until an Admin renews it from the Sites page.
            </div>
          </div>
        </>
      );
    }

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
                        onClick={() => { setTargetProfile(profile); setCustName(''); setCustPhone(''); setRemarks(''); setIsFreeCoupon(false); setSaleModalOpen(true); }}
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
                      {isFreeCoupon ? (
                        <strong style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Gift size={13} /> FREE (0 AED)
                        </strong>
                      ) : (
                        <strong style={{ color: 'var(--green)' }}>{getProfilePrice(targetProfile.id)} AED</strong>
                      )}
                    </div>
                  </div>

                  {/* Free Coupon toggle — Manager-only */}
                  {isManager && (
                    <div
                      className="flex-align-items-center flex-justify-space-between"
                      style={{
                        background: isFreeCoupon ? 'var(--blue-light)' : 'var(--surface-2)',
                        border: `1px solid ${isFreeCoupon ? 'var(--blue)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)', padding: '0.6rem 0.75rem', marginBottom: '1.1rem',
                      }}
                    >
                      <div className="flex-align-items-center" style={{ gap: '0.45rem' }}>
                        <Gift size={14} style={{ color: isFreeCoupon ? 'var(--blue)' : 'var(--text-3)' }} />
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isFreeCoupon ? 'var(--blue)' : 'var(--text)', display: 'block' }}>
                            Free Coupon
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Manager only — sets price to 0 AED</span>
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: isSelling ? 'default' : 'pointer' }}>
                        <span style={{ fontSize: '0.72rem', color: isFreeCoupon ? 'var(--blue)' : 'var(--text-3)', fontWeight: 600 }}>
                          {isFreeCoupon ? 'On' : 'Off'}
                        </span>
                        <div
                          onClick={() => !isSelling && setIsFreeCoupon(!isFreeCoupon)}
                          style={{
                            width: 36, height: 20, borderRadius: 10, cursor: isSelling ? 'default' : 'pointer', transition: 'background 0.2s',
                            background: isFreeCoupon ? 'var(--blue)' : 'var(--border)',
                            position: 'relative', flexShrink: 0,
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 3, left: isFreeCoupon ? 19 : 3,
                            width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                          }} />
                        </div>
                      </label>
                    </div>
                  )}

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
                  <button type="submit" className={`action-btn ${isFreeCoupon ? 'btn-brand-blue' : 'btn-brand-green'}`} disabled={isSelling}
                    style={{ minWidth: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {isSelling
                      ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing…</>
                      : isFreeCoupon
                        ? <><Gift size={14} /> Issue Free Coupon</>
                        : <><CheckCircle2 size={14} /> Complete & Credit Wallet</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success modal */}
        {successModalOpen && (() => {
          // Check if SMS is enabled for this site from the DB site record
          const currentSite = db.sites.find(s => s.id === selectedSiteId);
          const smsEnabledForSite = currentSite ? currentSite.smsEnabled !== false : true;

          const smsConfigured = db.settings?.smsProvider &&
            (db.settings.smsProvider === 'twilio'
              ? db.settings.twilioAccountSid && db.settings.twilioAuthToken && db.settings.twilioFromNumber
              : db.settings.msegatUserName && db.settings.msegatApiKey && db.settings.msegatSenderName);

          const e164Preview = normalisePhone(smsPhone);
          const phoneValid  = e164Preview && isAllowedForProvider(e164Preview, db.settings?.smsProvider || 'twilio');

          const handleSendSms = async () => {
            if (!phoneValid || smsSending || smsSent) return;
            setSmsSending(true);
            setSmsError('');
            const profileName = pendingSale
              ? db.couponProfiles.find(p => p.id === pendingSale.profileId)?.name || ''
              : '';
            const result = await sendCouponSms(db.settings, smsPhone, soldCouponCode, profileName);
            setSmsSending(false);
            if (result.success) {
              setSmsSent(true);
              showToast('SMS sent successfully!');
            } else {
              setSmsError(result.error || 'SMS failed. Check Settings → SMS Gateway.');
            }
          };

          return (
            <div className="app-modal-backdrop modal-open-state">
              <div className="app-modal-window" style={{ maxWidth: '420px' }}>
                <div className="app-modal-header" style={{ borderBottom: 'none' }}>
                  <span className="app-modal-title" style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: '1.2rem', color: pendingSale?.isFree ? 'var(--blue)' : 'var(--green)' }}>
                    {pendingSale?.isFree ? '✓ Free Coupon Issued' : '✓ Sale Completed Successfully'}
                  </span>
                </div>
                <div className="app-modal-body" style={{ padding: '0.5rem 1.5rem 1.5rem 1.5rem' }}>

                  {/* Coupon code display */}
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '1rem', textAlign: 'center' }}>
                    Share this code with the customer to activate their internet access:
                  </p>
                  <div style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 'var(--radius)', border: `2px dashed ${pendingSale?.isFree ? 'var(--blue)' : 'var(--green)'}`, marginBottom: '1.25rem', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Access Code</span>
                    <strong className="td-monospaced" style={{ fontSize: '1.6rem', color: 'var(--text)', fontWeight: 800 }}>{soldCouponCode}</strong>
                    {pendingSale?.isFree && (
                      <span className="pill-badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
                        <Gift size={11} /> FREE COUPON
                      </span>
                    )}
                  </div>

                  {/* SMS section — only if SMS is enabled for this site */}
                  {smsEnabledForSite && (
                  <div style={{
                    background: smsSent ? 'var(--green-light)' : 'var(--surface-2)',
                    border: `1px solid ${smsSent ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '0.9rem 1rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem' }}>
                      {smsSent
                        ? <CheckCheck size={14} style={{ color: 'var(--green)' }} />
                        : <MessageSquare size={14} style={{ color: 'var(--text-3)' }} />}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: smsSent ? 'var(--green)' : 'var(--text)' }}>
                        {smsSent ? 'SMS Sent!' : 'Send Code via SMS'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginLeft: 'auto' }}>
                        {db.settings?.smsProvider === 'msegat'
                          ? 'UAE · KSA · Qatar · Bahrain · Oman'
                          : 'UAE · KSA · Qatar · Bahrain · Oman · India'}
                      </span>
                    </div>

                    {!smsSent && (
                      <>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <input
                            type="tel"
                            className="text-input-field"
                            placeholder={db.settings?.smsProvider === 'msegat'
                              ? 'e.g. +971xxxxxxxx or +966xxxxxxxx'
                              : 'e.g. +91xxxxxxxxxx or +971xxxxxxxx'}
                            value={smsPhone}
                            onChange={e => { setSmsPhone(e.target.value); setSmsError(''); }}
                            disabled={smsSending}
                            style={{ flex: 1, fontSize: '0.82rem' }}
                          />
                          <button
                            type="button"
                            className="action-btn btn-brand-blue"
                            style={{ whiteSpace: 'nowrap', minWidth: '90px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            onClick={handleSendSms}
                            disabled={!phoneValid || smsSending || !smsConfigured}
                          >
                            {smsSending
                              ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Sending…</>
                              : <><MessageSquare size={13} /> Send SMS</>}
                          </button>
                        </div>

                        {/* Helper text */}
                        {smsPhone && !phoneValid && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--yellow)', marginTop: '0.35rem' }}>
                            {db.settings?.smsProvider === 'msegat'
                              ? 'Msegat supports UAE, KSA, Qatar, Bahrain, Oman only.'
                              : 'Twilio supports UAE, KSA, Qatar, Bahrain, Oman and India. Enter with country code e.g. +91xxxxxxxxxx.'}
                          </p>
                        )}
                        {phoneValid && !smsConfigured && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--yellow)', marginTop: '0.35rem' }}>
                            SMS not configured. Ask Admin to set up the SMS Gateway in Settings.
                          </p>
                        )}
                        {smsError && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: '0.35rem' }}>{smsError}</p>
                        )}
                      </>
                    )}

                    {smsSent && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--green)', margin: 0 }}>
                        Coupon code delivered to {normalisePhone(smsPhone)}.
                      </p>
                    )}
                  </div>
                  )}

                  <button type="button" className="action-btn btn-brand-blue" style={{ width: '100%' }} onClick={() => setSuccessModalOpen(false)}>
                    Close &amp; Continue
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
        {showAnalytics && <SalesAnalyticsPanel pendingSale={pendingSale} showTransactions={false} />}
        {!['Manager', 'Owner'].includes(role) && renderSalesTable(titles[role] || 'Sales', subtitles[role] || '')}
      </>
    );
  };

  return isSeller ? renderPOSView() : renderLogsView();
};
