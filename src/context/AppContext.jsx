import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as mockDb from '../db/mockDb';

const AppContext = createContext();

const EMPTY_DB = {
  sites: [], couponProfiles: [], users: [], userSites: [],
  sitePrices: [], coupons: [], wallets: [], transactions: [],
  auditLogs: [], settings: { lowStockThreshold: 5, telegramWebhookUrl: '', whatsappNotificationEnabled: false, twoFactorEnabled: false },
  cashCollections: []
};

// Roles that see all sites (no site-locking)
const GLOBAL_ROLES = ['Admin', 'Accountant', 'Owner', 'Manager'];

export const AppProvider = ({ children }) => {
  const [dbState, setDbState]           = useState(EMPTY_DB);
  const [loading, setLoading]           = useState(true);
  const [currentUser, setCurrentUser]   = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [theme, setTheme]               = useState('light');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshDbState = useCallback(async () => {
    try {
      const db = await mockDb.getDb();
      setDbState(db);
      return db; // return so callers can use the fresh data
    } catch (e) {
      console.error('Failed to load DB:', e);
      showToast('Database connection error');
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
  // KEY FIX: load db FIRST, then restore session from it — no blank-screen window
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const freshDb = await refreshDbState();
      const savedUser = localStorage.getItem('coupon_session_user');
      if (savedUser && freshDb) {
        try {
          const parsed = JSON.parse(savedUser);
          // Validate against the freshly loaded db users list (no extra round-trip)
          const user = await mockDb.findUser(parsed.username);
          if (user && user.password === parsed.password) {
            setCurrentUser(user);
            // Ensure selectedSiteId is valid for this user
            if (!GLOBAL_ROLES.includes(user.role)) {
              const assignedSites = (freshDb.userSites || [])
                .filter(us => us.userId === user.id)
                .map(us => us.siteId);
              if (assignedSites.length > 0) setSelectedSiteId(assignedSites[0]);
              else setSelectedSiteId('none');
            } else {
              setSelectedSiteId('all');
            }
          } else {
            localStorage.removeItem('coupon_session_user');
          }
        } catch (e) {
          localStorage.removeItem('coupon_session_user');
        }
      }
      setLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('coupon_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('coupon_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Notifications
  useEffect(() => {
    const lowStockAlerts = [];
    const threshold = dbState.settings?.lowStockThreshold || 5;
    dbState.couponProfiles.forEach(prof => {
      const available = dbState.coupons.filter(c => c.profileId === prof.id && c.status === 'Available');
      if (available.length > 0 && available.length < threshold) {
        lowStockAlerts.push({ id: `warn-global-${prof.id}`, timestamp: new Date().toISOString(), type: 'WARNING', message: `Low stock: ${prof.name} has only ${available.length} units left!`, icon: 'fa-triangle-exclamation', color: 'var(--yellow)', bg: 'var(--yellow-light)' });
      }
      dbState.sites.forEach(site => {
        const siteAssigned = dbState.coupons.filter(c => c.profileId === prof.id && c.siteId === site.id && c.status === 'Assigned');
        if (siteAssigned.length > 0 && siteAssigned.length < threshold) {
          lowStockAlerts.push({ id: `warn-${site.id}-${prof.id}`, timestamp: new Date().toISOString(), type: 'WARNING', message: `Low stock: ${prof.name} at ${site.name} has ${siteAssigned.length} units left.`, icon: 'fa-triangle-exclamation', color: 'var(--yellow)', bg: 'var(--yellow-light)' });
        }
      });
    });
    const recentLogs = dbState.auditLogs.slice(0, 8).map(log => {
      let icon = 'fa-bell', color = 'var(--blue)', bg = 'var(--blue-light)';
      if (log.action.includes('SALE'))       { icon = 'fa-receipt';               color = 'var(--green)';  bg = 'var(--green-light)'; }
      else if (log.action.includes('COLLECTION')) { icon = 'fa-money-bill-transfer'; color = 'var(--purple)'; bg = 'var(--purple-light)'; }
      else if (log.action.includes('REVERSAL'))   { icon = 'fa-arrow-rotate-left';   color = 'var(--red)';    bg = 'var(--red-light)'; }
      const userObj = dbState.users.find(u => u.id === log.userId);
      return { id: log.id, timestamp: log.timestamp, type: 'LOG', message: `${userObj ? userObj.name : log.userId}: ${log.details}`, icon, color, bg };
    });
    setNotifications([...lowStockAlerts, ...recentLogs]);
  }, [dbState]);

  const getAccessibleSites = () => {
    if (!currentUser) return [];
    if (GLOBAL_ROLES.includes(currentUser.role)) return dbState.sites;
    const assignedIds = dbState.userSites.filter(us => us.userId === currentUser.id).map(us => us.siteId);
    return dbState.sites.filter(s => assignedIds.includes(s.id));
  };

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loginUser = async (username, password) => {
    const user = await mockDb.findUser(username);
    if (user && user.password === password) {
      // Load fresh DB data BEFORE setting currentUser so the app
      // never renders the main layout with an empty db state
      const freshDb = await refreshDbState();

      // Set correct site selection for this role before showing the UI
      if (GLOBAL_ROLES.includes(user.role)) {
        setSelectedSiteId('all');
      } else {
        const assignedSites = ((freshDb || EMPTY_DB).userSites || [])
          .filter(us => us.userId === user.id)
          .map(us => us.siteId);
        setSelectedSiteId(assignedSites.length > 0 ? assignedSites[0] : 'none');
      }

      setCurrentUser(user);
      localStorage.setItem('coupon_session_user', JSON.stringify(user));
      await mockDb.logAction(user.id, 'LOGIN', `Logged in as ${user.role}`);
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password' };
  };

  const logoutUser = async () => {
    if (currentUser) {
      await mockDb.logAction(currentUser.id, 'LOGOUT', 'Logged out');
      localStorage.removeItem('coupon_session_user');
      setCurrentUser(null);
      setSelectedSiteId('all');
      await refreshDbState();
    }
  };

  // ── Wrappers ──────────────────────────────────────────────────────────────
  const sellCoupon = async (siteId, profileId, customerName, customerPhone, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.sellCoupon(siteId, profileId, currentUser.id, customerName, customerPhone, remarks);
      await refreshDbState();
      showToast('Coupon sold successfully!');
      return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const deleteUser = async (userId) => {
    if (!currentUser) return;
    try { await mockDb.deleteUser(userId, currentUser.id); await refreshDbState(); showToast('User deleted'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const unlinkUserFromSite = async (userId, siteId) => {
    if (!currentUser) return;
    try { await mockDb.unlinkUserFromSite(userId, siteId, currentUser.id); await refreshDbState(); showToast('User unlinked'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const linkUserToSite = async (userId, siteId) => {
    if (!currentUser) return;
    try { await mockDb.linkUserToSite(userId, siteId, currentUser.id); await refreshDbState(); showToast('User linked to site'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const updateSitePrice = async (siteId, profileId, salePrice, costPrice) => {
    if (!currentUser) return;
    try { await mockDb.updateSitePrice(siteId, profileId, salePrice, costPrice, currentUser.id); await refreshDbState(); showToast('Price updated!'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const assignProfileToSite = async (siteId, profileId) => {
    if (!currentUser) return;
    try { await mockDb.assignProfileToSite(siteId, profileId, currentUser.id); await refreshDbState(); showToast('Profile assigned to site'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const unassignProfileFromSite = async (siteId, profileId) => {
    if (!currentUser) return;
    try { await mockDb.unassignProfileFromSite(siteId, profileId, currentUser.id); await refreshDbState(); showToast('Profile removed from site'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const collectCashFromStaff = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromStaff(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      await refreshDbState(); showToast(`Collected ${amount} AED!`); return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const collectCashFromSuperStaff = async (collectedFromUserId, splits, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromSuperStaff(currentUser.id, collectedFromUserId, splits, remarks);
      await refreshDbState(); showToast('Collection done!'); return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const collectCashFromManager = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromManager(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      await refreshDbState(); showToast(`Collected ${amount} AED!`); return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const collectCashFromOwner = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromOwner(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      await refreshDbState(); showToast(`Collected ${amount} AED!`); return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const reverseTransaction = async (transactionId, reason) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.reverseTransaction(transactionId, currentUser.id, reason);
      await refreshDbState(); showToast('Transaction reversed!'); return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const importCoupons = async (csvLines, siteId = null) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.importCoupons(csvLines, currentUser.id, siteId);
      await refreshDbState();
      showToast(`Imported ${result.count} coupons${result.errors.length ? ' with warnings' : ' successfully'}.`);
      return result;
    } catch (e) { showToast(`Error: ${e.message}`); throw e; }
  };

  const addSite = async (name, location) => {
    if (!currentUser) return;
    try { await mockDb.addSite(name, location, currentUser.id); await refreshDbState(); showToast(`Site ${name} created`); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const addCouponProfile = async (profile) => {
    if (!currentUser) return;
    try { await mockDb.addCouponProfile(profile, currentUser.id); await refreshDbState(); showToast(`Profile ${profile.name} created`); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const addUser = async (user, siteIds = []) => {
    if (!currentUser) return;
    try { await mockDb.addUser(user, siteIds, currentUser.id); await refreshDbState(); showToast(`User ${user.username} created`); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const deleteSite = async (siteId) => {
    if (!currentUser) return;
    try { await mockDb.deleteSite(siteId, currentUser.id); await refreshDbState(); showToast('Site deleted'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const deleteCouponProfile = async (profileId) => {
    if (!currentUser) return;
    try { await mockDb.deleteCouponProfile(profileId, currentUser.id); await refreshDbState(); showToast('Profile deleted'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const deleteCoupon = async (couponId) => {
    if (!currentUser) return;
    try { await mockDb.deleteCoupon(couponId, currentUser.id); await refreshDbState(); showToast('Coupon deleted'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const bulkDeleteCoupons = async (couponIds) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.bulkDeleteCoupons(couponIds, currentUser.id);
      await refreshDbState();
      showToast(`Deleted ${result.count} coupons`);
      return result;
    } catch (e) { showToast(`Error: ${e.message}`); }
  };

  const walletAdjustment = async (walletId, amount, remarks) => {
    if (!currentUser) return;
    try { await mockDb.walletAdjustment(walletId, amount, remarks, currentUser.id); await refreshDbState(); showToast(`Wallet adjusted by ${amount} AED!`); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  const updateSettings = async (settings) => {
    try { await mockDb.updateSettings(settings, currentUser?.id || 'admin'); await refreshDbState(); showToast('Settings saved'); }
    catch (e) { showToast(`Error: ${e.message}`); }
  };

  return (
    <AppContext.Provider value={{
      db: dbState, currentUser, appLoading: loading, refreshDbState, loginUser, logoutUser,
      selectedSiteId, setSelectedSiteId, getAccessibleSites,
      searchQuery, setSearchQuery, theme, toggleTheme,
      notifications, unreadNotifications, setUnreadNotifications,
      toastMessage, showToast,
      sellCoupon, updateSitePrice, assignProfileToSite, unassignProfileFromSite,
      collectCashFromStaff, collectCashFromSuperStaff,
      collectCashFromManager, collectCashFromOwner,
      reverseTransaction, importCoupons, addSite, addCouponProfile, addUser,
      deleteUser, unlinkUserFromSite, linkUserToSite, deleteSite, deleteCoupon,
      deleteCouponProfile, bulkDeleteCoupons,
      walletAdjustment, updateSettings
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
