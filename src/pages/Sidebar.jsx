import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Home,
  Building2,
  Ticket,
  Layers,
  Share2,
  Wallet,
  DollarSign,
  BookOpen,
  Users,
  Receipt,
  BarChart3,
  ShieldAlert,
  Settings,
  Terminal,
  LogOut
} from 'lucide-react';

const ROLE_ICONS = {
  admin: 'A',
  owner: 'O',
  manager: 'M',
  superstaff: 'SS',
  staff: 'S',
  accountant: 'AC'
};

const ROLE_COLORS = {
  Admin: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
  Owner: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
  'Super Owner': 'linear-gradient(135deg, #9333EA, #7E22CE)',
  Manager: 'linear-gradient(135deg, #0891B2, #0e7490)',
  'Super Staff': 'linear-gradient(135deg, #D97706, #b45309)',
  Staff: 'linear-gradient(135deg, #16A34A, #15803d)',
  Accountant: 'linear-gradient(135deg, #DC2626, #b91c1c)'
};

export const Sidebar = ({ activePage, setActivePage, isMobileOpen, setIsMobileOpen }) => {
  const { currentUser, logoutUser, db } = useApp();

  if (!currentUser) return null;

  // Navigation schema per role
  const getNavItems = () => {
    const role = currentUser.role;

    const items = [];

    // All roles see Dashboard
    items.push({ id: 'dashboard', label: 'Dashboard', icon: Home, group: 'Overview' });

    if (role === 'Admin') {
      items.push({ id: 'sites', label: 'Sites', icon: Building2, group: 'Overview' });
      
      items.push({ id: 'profiles', label: 'Coupon Profiles', icon: Layers, group: 'Coupons' });
      items.push({ id: 'coupons', label: 'Coupons Inventory', icon: Ticket, group: 'Coupons' });
      items.push({ id: 'wallets', label: 'Wallets Overview', icon: Wallet, group: 'Financials' });
      items.push({ id: 'collections', label: 'Cash Collections', icon: DollarSign, group: 'Financials' });
      items.push({ id: 'ledger', icon: BookOpen, label: 'Ledger Audit', group: 'Financials' });
      
      items.push({ id: 'users', label: 'User Directory', icon: Users, group: 'People & Sales' });
      items.push({ id: 'sales', label: 'Sales Records', icon: Receipt, group: 'People & Sales' });
      items.push({ id: 'saleslog', label: 'Sales Log', icon: BookOpen, group: 'People & Sales' });
      
      items.push({ id: 'salesanalytics', label: 'Analytics Reports', icon: BarChart3, group: 'System Logs' });
      items.push({ id: 'audit', label: 'Audit Logs', icon: ShieldAlert, group: 'System Logs' });
      items.push({ id: 'settings', label: 'Settings', icon: Settings, group: 'System Logs' });
      items.push({ id: 'apiconsole', label: 'REST API Console', icon: Terminal, group: 'System Logs' });
    }

    if (role === 'Owner') {
      items.push({ id: 'salesanalytics', label: 'Sales Analytics', icon: BarChart3, group: 'Performance' });
      items.push({ id: 'saleslog', label: 'Sales Log', icon: BookOpen, group: 'Performance' });
      items.push({ id: 'collections', label: 'Collections Logs', icon: DollarSign, group: 'Performance' });
      items.push({ id: 'cashinhand', label: 'Cash In Hand', icon: Wallet, group: 'Performance' });
      items.push({ id: 'wallets', label: 'My Wallet', icon: Wallet, group: 'My Wallet' });
    }

    if (role === 'Super Owner') {
      items.push({ id: 'salesanalytics', label: 'Sales Analytics', icon: BarChart3, group: 'Performance' });
      items.push({ id: 'saleslog', label: 'Sales Log', icon: BookOpen, group: 'Performance' });
    }

    if (role === 'Manager') {
      items.push({ id: 'sales', label: 'Sell Coupons', icon: Receipt, group: 'Monitoring' });
      items.push({ id: 'salesanalytics', label: 'Sales Analytics', icon: BarChart3, group: 'Monitoring' });
      items.push({ id: 'saleslog', label: 'Sales Log', icon: BookOpen, group: 'Monitoring' });
      items.push({ id: 'collections', label: 'Cash Collections', icon: DollarSign, group: 'Monitoring' });
      items.push({ id: 'cashinhand', label: 'Cash In Hand', icon: Wallet, group: 'Monitoring' });
      items.push({ id: 'wallets', label: 'My Wallet', icon: Wallet, group: 'My Wallet' });
    }

    if (role === 'Super Staff') {
      items.push({ id: 'coupons', label: 'My Coupons Stock', icon: Ticket, group: 'Inventory' });
      items.push({ id: 'sales', label: 'Sell Coupons', icon: Receipt, group: 'My Operations' });
      items.push({ id: 'saleslog', label: 'Sales Log', icon: BookOpen, group: 'My Operations' });
      items.push({ id: 'collections', label: 'Collect from Staff', icon: DollarSign, group: 'My Operations' });
      items.push({ id: 'cashinhand', label: 'Cash In Hand', icon: Wallet, group: 'My Operations' });
      items.push({ id: 'wallets', label: 'My Wallets', icon: Wallet, group: 'My Wallet' });
    }

    if (role === 'Staff') {
      items.push({ id: 'coupons', label: 'Available Coupons', icon: Ticket, group: 'Inventory' });
      items.push({ id: 'sales', label: 'Sell Coupons', icon: Receipt, group: 'My Work' });
      items.push({ id: 'saleslog', label: 'My Sales History', icon: BookOpen, group: 'My Work' });
      items.push({ id: 'wallets', label: 'My Wallet', icon: Wallet, group: 'My Balance' });
    }

    if (role === 'Accountant') {
      items.push({ id: 'collections', label: 'Collect Cash (Splits)', icon: DollarSign, group: 'Treasury' });
      items.push({ id: 'wallets', label: 'Sites Balances', icon: Wallet, group: 'Treasury' });
      items.push({ id: 'ledger', label: 'Double Ledger Book', icon: BookOpen, group: 'Treasury' });
      items.push({ id: 'salesanalytics', label: 'Sales Analytics', icon: BarChart3, group: 'Treasury' });
      items.push({ id: 'cashinhand', label: 'Cash In Hand', icon: Wallet, group: 'Treasury' });
    }

    return items;
  };

  const navItems = getNavItems();
  
  // Group navigation items by their designated group section
  const groups = {};
  navItems.forEach(item => {
    if (!groups[item.group]) {
      groups[item.group] = [];
    }
    groups[item.group].push(item);
  });

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    setIsMobileOpen(false);
  };

  return (
    <nav id="sidebar-nav" className={isMobileOpen ? 'mobile-expanded-state' : ''}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">CO</div>
          <span className="sidebar-brand-name">
            Coupon<em>OS</em>
          </span>
        </div>
      </div>

      {/* Sidebar User Info Block */}
      <div className="sidebar-user">
        <div 
          className="user-avatar" 
          style={{ background: ROLE_COLORS[currentUser.role] || ROLE_COLORS.Staff }}
        >
          {currentUser.username[0].toUpperCase()}
        </div>
        <div className="user-info">
          <span className="user-name">{currentUser.name}</span>
          <span className="user-role-label">{currentUser.role}</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="sidebar-nav-list">
        {Object.keys(groups).map(groupName => (
          <div key={groupName}>
            <div className="nav-group-label">{groupName}</div>
            {groups[groupName].map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <div
                  key={item.id}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="nav-badge-count">{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer Operations */}
      <div className="sidebar-footer">
        <button 
          className="sidebar-footer-action" 
          onClick={logoutUser} 
          title="Sign Out"
          style={{ width: '100%' }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
};
