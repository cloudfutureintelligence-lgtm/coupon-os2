import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, AlertTriangle, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';

const RESET_PASSWORD = '9495471187';

export const Settings = () => {
  const { db, updateSettings, showToast, resetDatabase } = useApp();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const [threshold, setThreshold] = useState(db.settings.lowStockThreshold || 5);
  const [telegramUrl, setTelegramUrl] = useState(db.settings.telegramWebhookUrl || '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(db.settings.whatsappNotificationEnabled || false);
  const [twoFactor, setTwoFactor] = useState(db.settings.twoFactorEnabled || false);

  // SMS settings
  const [smsProvider, setSmsProvider]               = useState(db.settings.smsProvider || 'twilio');
  const [twilioAccountSid, setTwilioAccountSid]     = useState(db.settings.twilioAccountSid || '');
  const [twilioAuthToken, setTwilioAuthToken]       = useState(db.settings.twilioAuthToken || '');
  const [twilioFromNumber, setTwilioFromNumber]     = useState(db.settings.twilioFromNumber || '');
  const [msegatUserName, setMsegatUserName]         = useState(db.settings.msegatUserName || '');
  const [msegatApiKey, setMsegatApiKey]             = useState(db.settings.msegatApiKey || '');
  const [msegatSenderName, setMsegatSenderName]     = useState(db.settings.msegatSenderName || '');

  const handleConfirmReset = async () => {
    if (resetPassword !== RESET_PASSWORD) {
      setResetError('Incorrect password. Please try again.');
      return;
    }
    setResetting(true);
    try {
      await resetDatabase();
      setShowResetModal(false);
    } catch (e) {
      setResetError('Reset failed: ' + e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings({
      lowStockThreshold: Number(threshold),
      telegramWebhookUrl: telegramUrl,
      whatsappNotificationEnabled: whatsappEnabled,
      twoFactorEnabled: twoFactor,
      // SMS
      smsProvider,
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
      msegatUserName,
      msegatApiKey,
      msegatSenderName,
    });
  };

  return (
    <>
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

            {/* SMS Gateway */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ padding: '0.5rem', background: 'var(--green-light)', color: 'var(--green)', borderRadius: '6px' }}>
                <Smartphone size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>SMS Gateway — UAE &amp; KSA</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                  Send coupon codes directly to customer mobiles (+971 UAE / +966 KSA) after a sale.
                </div>

                {/* Provider selector */}
                <div className="form-input-wrapper" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-field-label">SMS Provider</label>
                  <select
                    className="select-dropdown-field"
                    value={smsProvider}
                    onChange={e => setSmsProvider(e.target.value)}
                    style={{ maxWidth: '220px' }}
                  >
                    <option value="twilio">Twilio (Global — UAE &amp; KSA)</option>
                    <option value="msegat">Msegat (Arab Regional)</option>
                  </select>
                </div>

                {smsProvider === 'twilio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--brand-blue)' }}>
                      Get your credentials at <strong>console.twilio.com</strong> → Account Info. Use a number with SMS enabled for UAE/KSA.
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Account SID</label>
                      <input type="text" className="text-input-field" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioAccountSid} onChange={e => setTwilioAccountSid(e.target.value)} />
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Auth Token</label>
                      <input type="password" className="text-input-field" placeholder="••••••••••••••••••••••••••••••••"
                        value={twilioAuthToken} onChange={e => setTwilioAuthToken(e.target.value)} />
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">From Number (E.164 format)</label>
                      <input type="text" className="text-input-field" placeholder="+12015551234"
                        value={twilioFromNumber} onChange={e => setTwilioFromNumber(e.target.value)} />
                    </div>
                  </div>
                )}

                {smsProvider === 'msegat' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--green)' }}>
                      Register at <strong>msegat.com</strong>. Activate your Sender ID for UAE/KSA delivery before use.
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Msegat Username</label>
                      <input type="text" className="text-input-field" placeholder="your_msegat_username"
                        value={msegatUserName} onChange={e => setMsegatUserName(e.target.value)} />
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">API Key</label>
                      <input type="password" className="text-input-field" placeholder="••••••••••••••••"
                        value={msegatApiKey} onChange={e => setMsegatApiKey(e.target.value)} />
                    </div>
                    <div className="form-input-wrapper">
                      <label className="form-field-label">Sender ID (Approved Name)</label>
                      <input type="text" className="text-input-field" placeholder="e.g. MyBrand"
                        value={msegatSenderName} onChange={e => setMsegatSenderName(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="ui-section-divider" style={{ margin: 0 }} />
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
                    setResetPassword('');
                    setResetError('');
                    setShowResetModal(true);
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

    {/* Reset Password Modal */}
    {showResetModal && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div style={{
          background: 'var(--surface)', borderRadius: '12px', padding: '2rem',
          width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.5rem', background: 'var(--red-light)', color: 'var(--red)', borderRadius: '8px' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Confirm Database Reset</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>This action is irreversible</div>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            All sites, users, coupons, transactions, and logs will be permanently deleted.
            Enter the admin password to continue.
          </p>

          <div className="form-input-wrapper" style={{ marginBottom: '0.75rem' }}>
            <label className="form-field-label">Admin Password</label>
            <input
              type="password"
              className="text-input-field"
              placeholder="Enter password"
              value={resetPassword}
              onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmReset(); }}
            />
            {resetError && (
              <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: '0.4rem' }}>{resetError}</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="action-btn"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              onClick={() => setShowResetModal(false)}
              disabled={resetting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="action-btn btn-brand-red"
              onClick={handleConfirmReset}
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Reset Database'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
