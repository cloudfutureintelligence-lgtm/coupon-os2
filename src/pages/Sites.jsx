import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Plus, MapPin, Users, CheckCircle2, UserPlus, Trash2, Layers, MessageSquare, CalendarClock, RotateCcw, Lock } from 'lucide-react';

<<<<<<< HEAD
const RESET_PASSWORD = '9495471187';

=======
>>>>>>> a7f513d (test-new-c-add)
// datetime-local inputs need "YYYY-MM-DDTHH:mm" in LOCAL time
const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const Sites = () => {
  const { db, currentUser, addSite, addUser, unlinkUserFromSite, linkUserToSite, updateSitePrice, deleteSite, assignProfileToSite, unassignProfileFromSite, updateSiteSmsEnabled, updateSiteSubscription, isSiteActive, showToast } = useApp();
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLoc, setNewSiteLoc] = useState('');
  const [confirmDeleteSiteId, setConfirmDeleteSiteId] = useState(null);
  const [deleteSitePassword, setDeleteSitePassword] = useState('');
  const [deleteSiteError, setDeleteSiteError] = useState('');
  const [deletingSite, setDeletingSite] = useState(false);
  const [linking, setLinking] = useState(false);

  // Per-site uncontrolled refs for the subscription expiry datetime input
  const subExpiryRefs = useRef({});

  // User assignment form states
  const [targetUserId, setTargetUserId] = useState('');
  const [targetSiteId, setTargetSiteId] = useState('');

  const handleCreateSite = (e) => {
    e.preventDefault();
    if (!newSiteName || !newSiteLoc) {
      showToast('Please fill out all site fields');
      return;
    }
    addSite(newSiteName, newSiteLoc);
    setNewSiteName('');
    setNewSiteLoc('');
  };

  const handleConfirmDeleteSite = async () => {
    if (deleteSitePassword !== RESET_PASSWORD) {
      setDeleteSiteError('Incorrect password. Please try again.');
      return;
    }
    setDeletingSite(true);
    try {
      await deleteSite(confirmDeleteSiteId);
      setConfirmDeleteSiteId(null);
      setDeleteSitePassword('');
    } catch (e) {
      setDeleteSiteError('Delete failed: ' + e.message);
    } finally {
      setDeletingSite(false);
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!targetUserId || !targetSiteId) {
      showToast('Select user and site');
      return;
    }

    // Check duplicate using context db state (which is Supabase-backed)
    const exists = db.userSites.some(
      (us) => us.userId === targetUserId && us.siteId === targetSiteId
    );
    if (exists) {
      showToast('User already assigned to this site');
      return;
    }

    setLinking(true);
    try {
      // linkUserToSite saves to Supabase via mockDb and refreshes context state
      await linkUserToSite(targetUserId, targetSiteId);
      setTargetUserId('');
      setTargetSiteId('');
    } finally {
      setLinking(false);
    }
  };

  // ── Subscription actions (Admin only) ──────────────────────────────────────
  const handleSaveSubscription = async (siteId) => {
    const val = subExpiryRefs.current[siteId]?.value;
    if (!val) { showToast('Pick a date & time first'); return; }
    await updateSiteSubscription(siteId, new Date(val).toISOString());
  };

  const handleRenewOneMonth = async (site) => {
    const base = site.subscriptionExpiry && new Date(site.subscriptionExpiry) > new Date()
      ? new Date(site.subscriptionExpiry)
      : new Date();
    base.setMonth(base.getMonth() + 1);
    await updateSiteSubscription(site.id, base.toISOString());
  };

  const handleClearSubscription = async (siteId) => {
    await updateSiteSubscription(siteId, null);
  };

  // Determine which sites to display based on role
  const visibleSites = currentUser.role === 'Admin'
    ? db.sites
    : db.sites.filter(site =>
        db.userSites.some(us => us.userId === currentUser.id && us.siteId === site.id)
      );

  // Group user assignments by site
  const getAssignedUsersBySite = (siteId) => {
    const userAssignments = db.userSites.filter(us => us.siteId === siteId);
    const usersList = userAssignments.map(us => db.users.find(u => u.id === us.userId)).filter(Boolean);
    
    // Group by role
    const grouped = {
      Owner: [],
      'Super Owner': [],
      Manager: [],
      'Super Staff': [],
      Staff: [],
      Accountant: []
    };
    usersList.forEach(u => {
      if (grouped[u.role]) {
        grouped[u.role].push(u);
      }
    });
    return grouped;
  };

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Site Management</h1>
          <p className="page-subtitle">Configure multi-tenant site divisions and align team roles to site boundaries</p>
        </div>
      </div>

      <div className="layout-grid-columns-3" style={{ marginBottom: '2rem' }}>
        {/* Create Site Card */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Add New Site</span>
          </div>
          <div className="ui-card-body">
            <form onSubmit={handleCreateSite} className="flex-direction-gap">
              <div className="form-input-wrapper">
                <label className="form-field-label">Site Name</label>
                <input 
                  type="text" 
                  className="text-input-field" 
                  placeholder="e.g. Site D" 
                  value={newSiteName} 
                  onChange={(e) => setNewSiteName(e.target.value)} 
                />
              </div>
              <div className="form-input-wrapper">
                <label className="form-field-label">Location Address</label>
                <input 
                  type="text" 
                  className="text-input-field" 
                  placeholder="e.g. Fujairah, UAE" 
                  value={newSiteLoc} 
                  onChange={(e) => setNewSiteLoc(e.target.value)} 
                />
              </div>
              <button type="submit" className="action-btn btn-brand-blue" style={{ marginTop: '0.5rem' }}>
                <Plus size={14} /> Create Site
              </button>
            </form>
          </div>
        </div>

        {/* Assign User to Site Card */}
        <div className="ui-card" style={{ gridColumn: 'span 2' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Link User to Site</span>
          </div>
          <div className="ui-card-body">
            <form onSubmit={handleAssignUser} className="form-grid-columns-2" style={{ gap: '1rem' }}>
              <div className="form-input-wrapper">
                <label className="form-field-label">Select Team Member</label>
                <select 
                  className="select-dropdown-field" 
                  value={targetUserId} 
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <option value="">-- Choose User --</option>
                  {db.users.filter(u => u.role !== 'Admin').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="form-input-wrapper">
                <label className="form-field-label">Select Destination Site</label>
                <select 
                  className="select-dropdown-field" 
                  value={targetSiteId} 
                  onChange={(e) => setTargetSiteId(e.target.value)}
                >
                  <option value="">-- Choose Site --</option>
                  {visibleSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                <button type="submit" className="action-btn btn-brand-purple" disabled={linking}>
                  <UserPlus size={14} /> {linking ? 'Linking...' : 'Link Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Sites Listing Grid */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>Active Site Tenancies</h2>
      
      <div className="layout-grid-columns-2">
        {visibleSites.map(site => {
          const assignments = getAssignedUsersBySite(site.id);
          return (
            <div key={site.id} className="ui-card">
              <div className="ui-card-header">
                <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
                  <Building2 size={18} style={{ color: 'var(--blue)' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{site.name}</span>
                </div>
                <div className="flex-align-items-center" style={{ gap: '0.5rem' }}>
                  {isSiteActive(site) ? (
                    <span className="pill-badge badge-success">Active</span>
                  ) : (
                    <span className="pill-badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Lock size={11} /> Expired
                    </span>
                  )}
                  {currentUser.role === 'Admin' && (
                    <button
                      onClick={() => {
                        setConfirmDeleteSiteId(site.id);
                        setDeleteSitePassword('');
                        setDeleteSiteError('');
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      title="Delete Site"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="ui-card-body">
                <div className="flex-align-items-center" style={{ gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                  <MapPin size={12} />
                  <span>{site.location}</span>
                </div>

                {/* Subscription status banner — shown to everyone when expired */}
                {!isSiteActive(site) && (
                  <div style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '0.55rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--red)', fontWeight: 600 }}>
                    Subscription expired on {new Date(site.subscriptionExpiry).toLocaleString()} — coupon sales & stock imports are paused.
                  </div>
                )}

                {/* Subscription management — Admin only */}
                {currentUser.role === 'Admin' && (
                  <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                    <div className="flex-align-items-center flex-justify-space-between" style={{ marginBottom: '0.5rem' }}>
                      <div className="flex-align-items-center" style={{ gap: '0.4rem' }}>
                        <CalendarClock size={13} style={{ color: isSiteActive(site) ? 'var(--text-3)' : 'var(--red)' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                          Subscription {site.subscriptionExpiry ? (isSiteActive(site) ? 'renews/expires' : 'expired') : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isSiteActive(site) ? 'var(--text)' : 'var(--red)' }}>
                        {site.subscriptionExpiry ? new Date(site.subscriptionExpiry).toLocaleString() : 'Lifetime access'}
                      </span>
                    </div>
                    <div className="flex-align-items-center" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                      <input
                        type="datetime-local"
                        ref={(el) => { subExpiryRefs.current[site.id] = el; }}
                        defaultValue={toDatetimeLocalValue(site.subscriptionExpiry)}
                        style={{ flex: '1 1 170px', fontSize: '0.75rem', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                      <button
                        className="action-btn btn-brand-blue"
                        style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                        onClick={() => handleSaveSubscription(site.id)}
                      >
                        Save
                      </button>
                      <button
                        className="action-btn btn-outlined"
                        style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => handleRenewOneMonth(site)}
                        title="Extend by 1 month from now (or from current expiry, whichever is later)"
                      >
                        <RotateCcw size={11} /> +1 Month
                      </button>
                      {site.subscriptionExpiry && (
                        <button
                          className="action-btn btn-outlined"
                          style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => handleClearSubscription(site.id)}
                          title="Remove expiry — site never expires"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* SMS toggle — Admin only */}
                {currentUser.role === 'Admin' && (
                  <div className="flex-align-items-center flex-justify-space-between" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '0.55rem 0.75rem', marginBottom: '0.75rem' }}>
                    <div className="flex-align-items-center" style={{ gap: '0.4rem' }}>
                      <MessageSquare size={13} style={{ color: site.smsEnabled ? 'var(--green)' : 'var(--text-3)' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>SMS after sale</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.72rem', color: site.smsEnabled ? 'var(--green)' : 'var(--text-3)', fontWeight: 600 }}>
                        {site.smsEnabled ? 'On' : 'Off'}
                      </span>
                      <div
                        onClick={() => updateSiteSmsEnabled(site.id, !site.smsEnabled)}
                        style={{
                          width: 36, height: 20, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
                          background: site.smsEnabled ? 'var(--green)' : 'var(--border)',
                          position: 'relative', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: site.smsEnabled ? 19 : 3,
                          width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                        }} />
                      </div>
                    </label>
                  </div>
                )}

                <div className="ui-section-divider" style={{ margin: '0.5rem 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Owners</div>
                    {assignments.Owner.length > 0 ? (
                      assignments.Owner.map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Super Owners</div>
                    {assignments['Super Owner'].length > 0 ? (
                      assignments['Super Owner'].map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Site Managers</div>
                    {assignments.Manager.length > 0 ? (
                      assignments.Manager.map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Super Staff</div>
                    {assignments['Super Staff'].length > 0 ? (
                      assignments['Super Staff'].map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Sales Staff</div>
                    {assignments.Staff.length > 0 ? (
                      assignments.Staff.map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.25rem' }}>Accountants</div>
                    {assignments.Accountant.length > 0 ? (
                      assignments.Accountant.map((u) => (
                        <div key={u.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                          <span>{u.name}</span>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={() => unlinkUserFromSite(u.id, site.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700 }}
                              title={`Unlink ${u.name}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic' }}>None assigned</div>}
                  </div>
                </div>

                {currentUser.role === 'Admin' && (() => {
                  const assignedProfileIds = new Set(
                    (db.sitePrices || []).filter(sp => sp.siteId === site.id).map(sp => sp.profileId)
                  );
                  const assignedProfiles = db.couponProfiles.filter(p => assignedProfileIds.has(p.id));
                  const unassignedProfiles = db.couponProfiles.filter(p => !assignedProfileIds.has(p.id));
                  const [assignSelect, setAssignSelect] = React.useState('');

                  return (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
                        Assigned Profiles
                      </div>

                      {/* Assign new profile row */}
                      {unassignedProfiles.length > 0 && (
                        <div className="flex-align-items-center" style={{ gap: '0.4rem', marginBottom: '0.5rem' }}>
                          <select
                            className="select-dropdown-field"
                            style={{ flex: 1, fontSize: '0.75rem', padding: '3px 6px' }}
                            value={assignSelect}
                            onChange={(e) => setAssignSelect(e.target.value)}
                          >
                            <option value="">— Add profile to site —</option>
                            {unassignedProfiles.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <button
                            className="action-btn btn-brand-blue"
                            style={{ fontSize: '0.72rem', padding: '3px 10px', whiteSpace: 'nowrap' }}
                            disabled={!assignSelect}
                            onClick={async () => {
                              if (assignSelect) {
                                await assignProfileToSite(site.id, assignSelect);
                                setAssignSelect('');
                              }
                            }}
                          >
                            <Plus size={11} /> Assign
                          </button>
                        </div>
                      )}

                      {/* Assigned profiles list with price overrides */}
                      {assignedProfiles.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontStyle: 'italic', padding: '0.25rem 0' }}>No profiles assigned yet</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {assignedProfiles.map(prof => {
                            const override = db.sitePrices?.find(sp => sp.siteId === site.id && sp.profileId === prof.id);
                            const currentCost = override ? override.costPrice : prof.costPrice;
                            const currentSale = override ? override.salePrice : prof.salePrice;

                            return (
                              <div key={prof.id} className="flex-align-items-center flex-justify-space-between" style={{ fontSize: '0.78rem', background: 'var(--surface-2)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                                <div style={{ flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Layers size={11} style={{ color: 'var(--blue)' }} />
                                  <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>{prof.name}</span>
                                </div>
                                <div className="flex-align-items-center" style={{ gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Cost:</span>
                                  <input
                                    type="number"
                                    defaultValue={currentCost}
                                    style={{ width: '45px', fontSize: '0.75rem', padding: '1px 3px', border: '1px solid var(--border)', borderRadius: '2px', background: 'var(--surface)' }}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== currentCost) updateSitePrice(site.id, prof.id, currentSale, val);
                                    }}
                                  />
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Sale:</span>
                                  <input
                                    type="number"
                                    defaultValue={currentSale}
                                    style={{ width: '45px', fontSize: '0.75rem', padding: '1px 3px', border: '1px solid var(--border)', borderRadius: '2px', background: 'var(--surface)' }}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== currentSale) updateSitePrice(site.id, prof.id, val, currentCost);
                                    }}
                                  />
                                  <button
                                    onClick={() => unassignProfileFromSite(site.id, prof.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center' }}
                                    title="Remove from site"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Delete Site Modal */}
      {confirmDeleteSiteId && (() => {
        const site = db.sites.find(s => s.id === confirmDeleteSiteId);
        return (
          <div className="app-modal-backdrop modal-open-state">
            <div className="app-modal-window" style={{ maxWidth: '400px' }}>
              <div className="app-modal-header">
                <span className="app-modal-title">Delete Site</span>
                <button className="app-modal-close-btn" onClick={() => setConfirmDeleteSiteId(null)}>×</button>
              </div>
              <div className="app-modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>
                  Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{site?.name}</strong>? This will remove the site and all associated data. This action cannot be undone.
                </p>
                <div className="form-input-wrapper" style={{ marginTop: '1rem' }}>
                  <label className="form-field-label">Admin Password</label>
                  <input
                    type="password"
                    className="text-input-field"
                    placeholder="Enter password"
                    value={deleteSitePassword}
                    onChange={(e) => { setDeleteSitePassword(e.target.value); setDeleteSiteError(''); }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmDeleteSite(); }}
                  />
                  {deleteSiteError && (
                    <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: '0.4rem' }}>{deleteSiteError}</div>
                  )}
                </div>
              </div>
              <div className="app-modal-footer">
                <button className="action-btn btn-outlined" onClick={() => setConfirmDeleteSiteId(null)} disabled={deletingSite}>Cancel</button>
                <button
                  className="action-btn"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                  onClick={handleConfirmDeleteSite}
                  disabled={deletingSite}
                >
                  <Trash2 size={13} /> {deletingSite ? 'Deleting...' : 'Delete Site'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
