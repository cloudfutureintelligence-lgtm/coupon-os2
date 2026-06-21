import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Menu, 
  Search, 
  Bell, 
  Sun, 
  Moon, 
  MapPin, 
  UserCheck 
} from 'lucide-react';

export const Navbar = ({ activePage, onToggleSidebar, onToggleNotif }) => {
  const {
    currentUser,
    loginUser,
    selectedSiteId,
    setSelectedSiteId,
    getAccessibleSites,
    isSiteActive,
    searchQuery,
    setSearchQuery,
    theme,
    toggleTheme,
    notifications,
    unreadNotifications,
    setUnreadNotifications
  } = useApp();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!currentUser) return null;

  const accessibleSites = getAccessibleSites();
  const activeSiteObj = accessibleSites.find(s => s.id === selectedSiteId);

  const handleNotifClick = () => {
    setUnreadNotifications(false);
    onToggleNotif();
  };

  return (
    <header className="top-bar-nav">
      {/* Mobile Sidebar Toggle */}
      <button 
        className="action-icon-btn" 
        onClick={onToggleSidebar}
        style={{ display: isMobile ? 'flex' : 'none' }}
      >
        <Menu size={16} />
      </button>

      {/* Page Title */}
      <div className="top-bar-left">
        <span className="top-bar-title-text" style={{ textTransform: 'capitalize' }}>
          {activePage === 'apiconsole' ? 'REST API Docs' : activePage}
        </span>
      </div>

      {/* Top Bar Actions & Filters */}
      <div className="top-bar-actions-right">
        
        {/* Global Search */}
        <div className="top-search-bar">
          <Search />
          <input
            type="text"
            placeholder="Search anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Site Filter (Tenant-isolation) */}
        {accessibleSites.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select
              className="filter-dropdown-select"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.78rem', fontWeight: 600 }}
            >
<<<<<<< HEAD
              {(currentUser.role === 'Admin' || currentUser.role === 'Accountant' || currentUser.role === 'Owner' || currentUser.role === 'Super Owner' || currentUser.role === 'Manager') && (
=======
              {(currentUser.role === 'Admin' || currentUser.role === 'Accountant' || currentUser.role === 'Owner' || currentUser.role === 'Manager') && (
>>>>>>> f472e7621ca18dbe0379778985eb4b4cb453b3ba
                <option value="all">All Sites</option>
              )}
              {accessibleSites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}{!isSiteActive(site) ? ' (Expired)' : ''}
                </option>
              ))}
            </select>
            <MapPin 
              size={12} 
              style={{ position: 'absolute', left: '8px', top: '10px', pointerEvents: 'none', color: 'var(--text-3)' }} 
            />
          </div>
        )}



        {/* Theme Toggle */}
        <button className="action-icon-btn" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications Slideout trigger */}
        <button 
          className={`action-icon-btn ${unreadNotifications ? 'active' : ''}`} 
          onClick={handleNotifClick}
        >
          <Bell size={16} />
          {unreadNotifications && <div className="red-indicator-dot" />}
        </button>

      </div>
    </header>
  );
};
