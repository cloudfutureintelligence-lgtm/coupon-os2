import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, AlertTriangle, MessageSquare, ShieldCheck } from 'lucide-react';

export const Settings = () => {
  const { db, updateSettings, showToast } = useApp();

  const [threshold, setThreshold] = useState(db.settings.lowStockThreshold || 5);
  const [telegramUrl, setTelegramUrl] = useState(db.settings.telegramWebhookUrl || '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(db.settings.whatsappNotificationEnabled || false);
  const [twoFactor, setTwoFactor] = useState(db.settings.twoFactorEnabled || false);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings({
      lowStockThreshold: Number(threshold),
      telegramWebhookUrl: telegramUrl,
      whatsappNotificationEnabled: whatsappEnabled,
      twoFactorEnabled: twoFactor
    });
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">System Configurations</h1>
          <p className="page-subtitle">Configure inventory limits, notification webhooks, and security settings</p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card-header">
          <span className="ui-card-title">General Preferences</span>
        </div>
        <div className="ui-card-body">
          <form onSubmit={handleSave} className="flex-direction-gap" style={{ gap: '1.5rem' }}>
            
            {/* Inventory thresholds */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '0.5rem', background: 'var(--yellow-light)', color: 'var(--yellow)', borderRadius: '6px' }}>
                <AlertTriangle size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Inventory Warning Threshold</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
                  Trigger warnings when unassigned site stocks fall below this unit count.
                </div>
                <input 
                  type="number" 
                  className="text-input-field" 
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  style={{ maxWidth: '120px' }}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="ui-section-divider" style={{ margin: 0 }} />

            {/* Notification Integrations */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '0.5rem', background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: '6px' }}>
                <MessageSquare size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>WhatsApp & Telegram Mock Notification Webhooks</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                  Alert operators when collections are logged or stock reaches warning limits.
                </div>
                
                <div className="form-input-wrapper">
                  <label className="form-field-label">Telegram Bot Webhook URL</label>
                  <input 
                    type="text" 
                    className="text-input-field" 
                    placeholder="https://api.telegram.org/bot..." 
                    value={telegramUrl}
                    onChange={(e) => setTelegramUrl(e.target.value)}
                  />
                </div>

                <label className="flex-align-items-center" style={{ gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                  />
                  <span>Enable Auto WhatsApp Notifications</span>
                </label>
              </div>
            </div>

            <div className="ui-section-divider" style={{ margin: 0 }} />

            {/* Security Settings */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '0.5rem', background: 'var(--purple-light)', color: 'var(--purple)', borderRadius: '6px' }}>
                <ShieldCheck size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Security Verification Options</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                  Require multi-factor authorization checkpoints on cash collections.
                </div>
                
                <label className="flex-align-items-center" style={{ gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.checked)}
                  />
                  <span>Enforce Two-Factor Authentication (2FA) for collection releases</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '0.5rem', background: 'var(--red-light)', color: 'var(--red)', borderRadius: '6px' }}>
                <AlertTriangle size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Danger Zone</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                  Wipe all coupons, transactions, user mappings, and sites. Restores database to a clean slate with default admin credentials.
                </div>
                <button 
                  type="button" 
                  className="action-btn btn-brand-red"
                  onClick={() => {
                    if (window.confirm("Are you absolutely sure you want to reset the database? This will delete all sites, users, and coupons, and log you out.")) {
                      localStorage.removeItem('coupon_system_db');
                      localStorage.removeItem('coupon_session_user');
                      window.location.reload();
                    }
                  }}
                >
                  Reset CouponOS Database
                </button>
              </div>
            </div>

            <div className="ui-section-divider" style={{ margin: 0 }} />

            <div style={{ textAlign: 'right' }}>
              <button type="submit" className="action-btn btn-brand-blue">
                Save System Settings
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
