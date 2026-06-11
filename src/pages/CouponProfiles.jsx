import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layers, Plus, Calendar, Trash2, Building2, MapPin } from 'lucide-react';

export const CouponProfiles = () => {
  const { db, addCouponProfile, deleteCouponProfile, showToast } = useApp();

  const [name, setName] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDeleteProfileId, setConfirmDeleteProfileId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !price || !salePrice || !costPrice) {
      showToast('Please fill out all required fields');
      return;
    }
    addCouponProfile({
      name,
      validityDays: Number(validityDays),
      price: Number(price),
      salePrice: Number(salePrice),
      costPrice: Number(costPrice),
      description
    });
    setName(''); setValidityDays(30); setPrice(''); setSalePrice(''); setCostPrice(''); setDescription('');
  };

  // Build profile card component
  const ProfileCard = ({ p, assignedSiteNames }) => (
    <div className="ui-card" style={{ marginBottom: 0 }}>
      <div className="ui-card-header" style={{ padding: '0.75rem 1rem' }}>
        <div className="flex-align-items-center" style={{ gap: '0.4rem' }}>
          <Layers size={14} style={{ color: 'var(--blue)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
        </div>
        <div className="flex-align-items-center" style={{ gap: '0.4rem' }}>
          <span className={`pill-badge ${assignedSiteNames.length > 0 ? 'badge-success' : 'badge-warning'}`}>
            {assignedSiteNames.length > 0 ? 'Active' : 'Unassigned'}
          </span>
          <button
            onClick={() => setConfirmDeleteProfileId(p.id)}
            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
            title="Delete Profile"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="ui-card-body" style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: '0.75rem' }}>
          {p.description || 'No description provided.'}
        </div>

        <div className="flex-align-items-center" style={{ gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
          <Calendar size={12} />
          <span>Validity: <strong>{p.validityDays} Days</strong></span>
        </div>

        {assignedSiteNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.65rem' }}>
            {assignedSiteNames.map(sName => (
              <span key={sName} className="pill-badge badge-info" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MapPin size={9} /> {sName}
              </span>
            ))}
          </div>
        )}

        <div className="ui-section-divider" style={{ margin: '0.65rem 0' }} />

        <div className="flex-justify-space-between" style={{ fontSize: '0.78rem' }}>
          <div>
            <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.68rem' }}>Retail Price</span>
            <strong style={{ color: 'var(--text)' }}>{p.price} AED</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.68rem' }}>Promo Price</span>
            <strong style={{ color: 'var(--green)' }}>{p.salePrice} AED</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '0.68rem' }}>Unit Cost</span>
            <strong style={{ color: 'var(--text)' }}>{p.costPrice} AED</strong>
          </div>
        </div>
      </div>
    </div>
  );

  // Separate profiles into assigned vs unassigned
  const assignedProfiles = [];
  const unassignedProfiles = [];

  db.couponProfiles.forEach(p => {
    const assignedSites = (db.sitePrices || [])
      .filter(sp => sp.profileId === p.id)
      .map(sp => db.sites.find(s => s.id === sp.siteId))
      .filter(Boolean);
    if (assignedSites.length > 0) {
      assignedProfiles.push({ profile: p, sites: assignedSites });
    } else {
      unassignedProfiles.push({ profile: p, sites: [] });
    }
  });

  // Group assigned profiles by site
  const profilesBySite = db.sites.map(site => {
    const profiles = (db.sitePrices || [])
      .filter(sp => sp.siteId === site.id)
      .map(sp => db.couponProfiles.find(p => p.id === sp.profileId))
      .filter(Boolean);
    return { site, profiles };
  }).filter(s => s.profiles.length > 0);

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Coupon Profiles</h1>
          <p className="page-subtitle">Define package templates, validity windows, and price rates for coupon generation</p>
        </div>
      </div>

      <div className="layout-grid-columns-3" style={{ marginBottom: '2rem' }}>
        {/* Create Profile Card */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Create Package Profile</span>
          </div>
          <div className="ui-card-body">
            <form onSubmit={handleSubmit} className="flex-direction-gap">
              <div className="form-input-wrapper">
                <label className="form-field-label">Profile Name *</label>
                <input type="text" className="text-input-field" placeholder="e.g. 15 Days Unlimited" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-input-wrapper">
                <label className="form-field-label">Validity (Days) *</label>
                <input type="number" className="text-input-field" placeholder="30" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} min="1" required />
              </div>
              <div className="form-grid-columns-3" style={{ gap: '0.5rem' }}>
                <div className="form-input-wrapper">
                  <label className="form-field-label">Retail (AED)</label>
                  <input type="number" className="text-input-field" placeholder="100" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
                <div className="form-input-wrapper">
                  <label className="form-field-label">Promo (AED)</label>
                  <input type="number" className="text-input-field" placeholder="90" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
                </div>
                <div className="form-input-wrapper">
                  <label className="form-field-label">Cost (AED)</label>
                  <input type="number" className="text-input-field" placeholder="50" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} required />
                </div>
              </div>
              <div className="form-input-wrapper">
                <label className="form-field-label">Description</label>
                <textarea className="text-input-field" rows="2" placeholder="Short plan summary..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <button type="submit" className="action-btn btn-brand-blue" style={{ marginTop: '0.5rem' }}>
                <Plus size={14} /> Add Profile
              </button>
            </form>
          </div>
        </div>

        {/* Right column: site-grouped profiles + unassigned */}
        <div style={{ gridColumn: 'span 2' }}>

          {/* Profiles grouped by site */}
          {profilesBySite.map(({ site, profiles }) => (
            <div key={site.id} style={{ marginBottom: '1.75rem' }}>
              <div className="flex-align-items-center" style={{ gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Building2 size={15} style={{ color: 'var(--blue)' }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{site.name}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>— {site.location}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {profiles.map(p => {
                  const assignedSiteNames = (db.sitePrices || [])
                    .filter(sp => sp.profileId === p.id)
                    .map(sp => db.sites.find(s => s.id === sp.siteId)?.name)
                    .filter(Boolean);
                  return <ProfileCard key={p.id} p={p} assignedSiteNames={assignedSiteNames} />;
                })}
              </div>
            </div>
          ))}

          {/* Unassigned profiles */}
          {unassignedProfiles.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <div className="flex-align-items-center" style={{ gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Layers size={15} style={{ color: 'var(--text-3)' }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-3)', margin: 0 }}>Unassigned Profiles</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>— assign these to a site from the Sites page</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {unassignedProfiles.map(({ profile: p }) => (
                  <ProfileCard key={p.id} p={p} assignedSiteNames={[]} />
                ))}
              </div>
            </div>
          )}

          {db.couponProfiles.length === 0 && (
            <div className="empty-view-state" style={{ padding: '3rem 1rem' }}>
              <div className="empty-view-title">No profiles yet</div>
              <div className="empty-view-description">Create your first profile using the form on the left</div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Profile Modal */}
      {confirmDeleteProfileId && (() => {
        const profile = db.couponProfiles.find(p => p.id === confirmDeleteProfileId);
        return (
          <div className="app-modal-backdrop modal-open-state">
            <div className="app-modal-window" style={{ maxWidth: '400px' }}>
              <div className="app-modal-header">
                <span className="app-modal-title">Delete Profile</span>
                <button className="app-modal-close-btn" onClick={() => setConfirmDeleteProfileId(null)}>×</button>
              </div>
              <div className="app-modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>
                  Are you sure you want to delete the profile <strong style={{ color: 'var(--text)' }}>{profile?.name}</strong>? Coupons linked to this profile will lose their profile reference. This action cannot be undone.
                </p>
              </div>
              <div className="app-modal-footer">
                <button className="action-btn btn-outlined" onClick={() => setConfirmDeleteProfileId(null)}>Cancel</button>
                <button
                  className="action-btn"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                  onClick={async () => { await deleteCouponProfile(confirmDeleteProfileId); setConfirmDeleteProfileId(null); }}
                >
                  <Trash2 size={13} /> Delete Profile
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
