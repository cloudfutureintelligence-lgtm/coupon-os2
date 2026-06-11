import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Sites } from './pages/Sites';
import { CouponProfiles } from './pages/CouponProfiles';
import { Coupons } from './pages/Coupons';
import { Sales } from './pages/Sales';
import { SalesLog } from './pages/SalesLog';
import { CashCollection } from './pages/CashCollection';
import { Reports } from './pages/Reports';
import { Wallets } from './pages/Wallets';
import { Ledger } from './pages/Ledger';
import { Users } from './pages/Users';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { ApiConsole } from './pages/ApiConsole';
import { CashInHand } from './pages/CashInHand';
import { 
  Bell, 
  Moon, 
  Sun, 
  X, 
  Terminal, 
  ShieldAlert, 
  AlertTriangle 
} from 'lucide-react';

export const App = () => {
  const { 
    currentUser,
    appLoading,
    loginUser, 
    toastMessage, 
    notifications, 
    theme, 
    showToast 
  } = useApp();

  // App layouts states
  const [activePage, setActivePage] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // FIX 2: Track login-in-progress to prevent blank screen flicker
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const result = await loginUser(username, password);
      if (result.success) {
        setActivePage('dashboard');
        showToast(`Welcome back, ${username}!`);
      } else {
        showToast('Login failed. Check your username and password.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Route selector to render correct page component
  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={setActivePage} />;
      case 'sites':
        return <Sites />;
      case 'profiles':
        return <CouponProfiles />;
      case 'coupons':
        return <Coupons />;
      case 'sales':
        return <Sales />;
      case 'saleslog':
        return <SalesLog />;
      case 'collections':
        return <CashCollection />;
      case 'reports':
        return <Reports />;
      case 'wallets':
        return <Wallets />;
      case 'ledger':
        return <Ledger />;
      case 'users':
        return <Users />;
      case 'audit':
        return <AuditLogs />;
      case 'settings':
        return <Settings />;
      case 'apiconsole':
        return <ApiConsole />;
      case 'cashinhand':
        return <CashInHand />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  // While session is being restored, show spinner — not the login form
  if (appLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', fontFamily: 'sans-serif', color: '#666' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e0e0e0', borderTop: '3px solid #333', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  // 1. Render Login Screen if not authenticated
  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <div className="logo-mark">CO</div>
            <div className="login-brand-name">
              Coupon<em>OS</em>
            </div>
          </div>
          <div className="login-title">Welcome back</div>
          <div className="login-sub">Enter your credentials to sign in</div>
          
          <form onSubmit={handleLoginSubmit} className="flex-direction-gap">
            <div className="form-input-wrapper">
              <label className="form-field-label">Username</label>
              <input 
                type="text" 
                className="text-input-field" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-input-wrapper">
              <label className="form-field-label">Password</label>
              <input 
                type="password" 
                className="text-input-field" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }} disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign In Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Render Main Application Layout
  return (
    <div id="app-layout">
      {/* Mobile Sidebar overlay click to close */}
      {isMobileSidebarOpen && (
        <div 
          className="mobile-view-sidebar-overlay overlay-visible-state" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* Main viewport area */}
      <div id="main-viewport">
        <Navbar 
          activePage={activePage} 
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          onToggleNotif={() => setIsNotifOpen(!isNotifOpen)}
        />

        {/* Content Pane */}
        <main id="content-pane">
          {renderActivePage()}
        </main>
      </div>

      {/* Slideout Notification tray */}
      <div className={`sliding-notifications-panel ${isNotifOpen ? 'panel-expanded' : ''}`}>
        <div className="panel-header-section">
          <span>Recent Activity Feed</span>
          <button className="btn-ghost-muted" onClick={() => setIsNotifOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="panel-scrollable-content">
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
              No recent notifications
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div key={idx} className="panel-notification-item">
                <div 
                  className="notif-item-icon-box" 
                  style={{ background: notif.bg, color: notif.color }}
                >
                  {notif.type === 'WARNING' ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Bell size={14} />
                  )}
                </div>
                <div className="notif-item-text-body">
                  <span className="notif-item-message">{notif.message}</span>
                  <span className="notif-item-timestamp">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Global Toast Alert */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.82rem',
            fontWeight: 600,
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
