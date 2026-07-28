import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Terminal, Play, CheckCircle, AlertCircle } from 'lucide-react';

export const ApiConsole = () => {
  const { db, importCoupons, sellCoupon, showToast } = useApp();

  const [activeEndpoint, setActiveEndpoint] = useState('validate');
  const [jsonPayload, setJsonPayload] = useState(
    JSON.stringify({ code: db.coupons[0]?.code || 'XYZ-12345' }, null, 2)
  );

  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const endpointSpecs = {
    validate: {
      method: 'GET',
      path: '/api/coupons/validate',
      desc: 'Verify if a coupon code exists, check its status, and inspect package profile details.',
      defaultPayload: { code: db.coupons[0]?.code || 'XYZ-12345' }
    },
    import: {
      method: 'POST',
      path: '/api/coupons/import',
      desc: 'Bulk import coupon records directly into the Admin stock pool using JSON format arrays.',
      defaultPayload: {
        coupons: [
          { code: 'REST-API-001', serialNumber: 'SN-REST-001', profileName: '30 Days Premium' },
          { code: 'REST-API-002', serialNumber: 'SN-REST-002', profileName: '15 Days Unlimited' }
        ]
      }
    },
    sale: {
      method: 'POST',
      path: '/api/sales/create',
      desc: 'Trigger a retail coupon sale activation from an external partner system or merchant dashboard.',
      defaultPayload: {
        couponCode: db.coupons.find(c => c.status === 'Assigned')?.code || 'XYZ-123',
        customerName: 'External API Client',
        customerPhone: '+971501112222',
        remarks: 'Activated via developer REST API console client'
      }
    }
  };

  const handleEndpointSwitch = (key) => {
    setActiveEndpoint(key);
    setJsonPayload(JSON.stringify(endpointSpecs[key].defaultPayload, null, 2));
    setApiResponse(null);
  };

  const handleSendRequest = () => {
    setLoading(true);
    setApiResponse(null);

    setTimeout(() => {
      try {
        const payload = JSON.parse(jsonPayload);
        const dbInst = JSON.parse(localStorage.getItem('coupon_system_db'));

        if (activeEndpoint === 'validate') {
          if (!payload.code) throw new Error('Query parameter "code" is required');
          const coupon = dbInst.coupons.find(c => c.code === payload.code);
          if (!coupon) {
            setApiResponse({
              status: 404,
              statusText: 'Not Found',
              body: { error: 'Coupon code not registered' }
            });
          } else {
            const profile = dbInst.couponProfiles.find(p => p.id === coupon.profileId);
            setApiResponse({
              status: 200,
              statusText: 'OK',
              body: {
                couponCode: coupon.code,
                serialNumber: coupon.serialNumber,
                status: coupon.status,
                siteId: coupon.siteId,
                profile: {
                  name: profile?.name,
                  validityDays: profile?.validityDays,
                  salePrice: profile?.salePrice
                }
              }
            });
          }
        } else if (activeEndpoint === 'import') {
          if (!payload.coupons || !Array.isArray(payload.coupons)) {
            throw new Error('Payload property "coupons" must be an array');
          }

          // Map objects to CSV strings to reuse DB functions
          const lines = payload.coupons.map(c => `${c.code}, ${c.serialNumber}, ${c.profileName}`);
          
          // Execute import
          importCoupons(lines, null);

          setApiResponse({
            status: 201,
            statusText: 'Created',
            body: {
              success: true,
              importedCount: payload.coupons.length,
              details: 'Coupons imported successfully into Admin pool'
            }
          });
        } else if (activeEndpoint === 'sale') {
          if (!payload.couponCode) throw new Error('Property "couponCode" is required');

          const coupon = dbInst.coupons.find(c => c.code === payload.couponCode);
          if (!coupon) throw new Error('Coupon not found');

          // Trigger sale
          sellCoupon(coupon.id, payload.customerName, payload.customerPhone, payload.remarks);

          setApiResponse({
            status: 200,
            statusText: 'OK',
            body: {
              success: true,
              couponCode: coupon.code,
              status: 'Sold',
              creditedTo: 'u-admin-sales',
              priceCleared: `${coupon.salePrice} AED`
            }
          });
        }
      } catch (err) {
        setApiResponse({
          status: 400,
          statusText: 'Bad Request',
          body: { error: err.message }
        });
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Developer REST API Docs</h1>
          <p className="page-subtitle">Inspect endpoints specs and test API requests against the active database state</p>
        </div>
      </div>

      <div className="layout-grid-columns-3">
        {/* Endpoint Selector & Specs */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">API Routing Matrix</span>
          </div>
          <div className="ui-card-body" style={{ padding: 0 }}>
            {Object.keys(endpointSpecs).map(key => {
              const spec = endpointSpecs[key];
              const isActive = activeEndpoint === key;
              return (
                <div 
                  key={key} 
                  onClick={() => handleEndpointSwitch(key)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div className="flex-align-items-center" style={{ gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <span 
                      className={`pill-badge badge-${spec.method === 'GET' ? 'success' : 'info'}`}
                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.62rem' }}
                    >
                      {spec.method}
                    </span>
                    <code style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{spec.path}</code>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
                    {spec.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* JSON Request sandbox */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">Request Sandbox Payload</span>
          </div>
          <div className="ui-card-body">
            <div className="form-input-wrapper">
              <label className="form-field-label">JSON Request Body</label>
              <textarea 
                className="text-input-field" 
                rows="8" 
                value={jsonPayload}
                onChange={(e) => setJsonPayload(e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', background: 'var(--surface-2)' }}
              />
            </div>
            <button 
              className="action-btn btn-brand-blue" 
              onClick={handleSendRequest}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <Play size={12} style={{ marginRight: '4px' }} />
              {loading ? 'Sending Request...' : 'Execute Request'}
            </button>
          </div>
        </div>

        {/* JSON Response console */}
        <div className="ui-card" style={{ gridColumn: 'span 1' }}>
          <div className="ui-card-header">
            <span className="ui-card-title">API Response Terminal</span>
          </div>
          <div className="ui-card-body flex-column-flow" style={{ background: 'var(--sidebar-bg)', color: '#FFFFFF', minHeight: '260px' }}>
            {loading ? (
              <div className="margin-left-auto" style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <Terminal size={32} style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.85rem' }}>Executing connection sync...</div>
              </div>
            ) : apiResponse ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="flex-align-items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  {apiResponse.status >= 200 && apiResponse.status < 300 ? (
                    <CheckCircle size={14} style={{ color: 'var(--green)' }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                  )}
                  <span>Status: <strong>{apiResponse.status} {apiResponse.statusText}</strong></span>
                </div>
                <pre style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', overflowX: 'auto' }}>
                  {JSON.stringify(apiResponse.body, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="margin-left-auto" style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                <Terminal size={32} style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.85rem' }}>Waiting for request execution...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
