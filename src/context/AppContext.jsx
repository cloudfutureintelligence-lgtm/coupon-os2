// ============================================================================
// OPTIMIZED AppContext.jsx - Performance-focused version
// ============================================================================
// KEY CHANGES:
// 1. Split refreshDbState() into targeted refresh functions
// 2. Memoize expensive notification computation
// 3. Add optimistic updates for better UX
// 4. Request deduplication to prevent duplicate API calls
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as mockDb from '../db/mockDb';

const AppContext = createContext();

const EMPTY_DB = {
  sites: [], couponProfiles: [], users: [], userSites: [],
  sitePrices: [], coupons: [], wallets: [], transactions: [],
  auditLogs: [], settings: { lowStockThreshold: 5, telegramWebhookUrl: '', whatsappNotificationEnabled: false, twoFactorEnabled: false },
  cashCollections: []
};

const GLOBAL_ROLES = ['Admin'];

export const AppProvider = ({ children }) => {
  const [dbState, setDbState] = useState(EMPTY_DB);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // 🚀 NEW: Track in-flight requests to prevent duplicate fetches
  const inFlightRequests = useRef(new Map());

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 🚀 OPTIMIZATION 1: Request Deduplication
  const deduplicatedFetch = useCallback(async (key, fetchFn) => {
    // If a request for this key is already in-flight, return the existing promise
    if (inFlightRequests.current.has(key)) {
      return inFlightRequests.current.get(key);
    }

    // Create new request
    const promise = fetchFn().finally(() => {
      inFlightRequests.current.delete(key);
    });

    inFlightRequests.current.set(key, promise);
    return promise;
  }, []);

  // ── Original refreshDbState (keep for complex multi-entity updates) ────
  const refreshDbState = useCallback(async () => {
    return deduplicatedFetch('refreshDbState', async () => {
      try {
        const db = await mockDb.getDb();
        setDbState(db);
        return db;
      } catch (e) {
        console.error('Failed to load DB:', e);
        showToast('Database connection error');
      }
    });
  }, [deduplicatedFetch]);

  // 🚀 OPTIMIZATION 2: Targeted Refresh Functions (use instead of full refresh)
  
  const refreshCoupons = useCallback(async () => {
    return deduplicatedFetch('refreshCoupons', async () => {
      try {
        // Use the same pagination logic as mockDb
        let allCoupons = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        while (true) {
          const { data, error } = await mockDb.supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw new Error(error.message);
          allCoupons = allCoupons.concat(data || []);
          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        const mapCoupon = (r) => r ? ({
          id: r.id, code: r.code, profileId: r.profile_id, siteId: r.site_id,
          cost: r.cost, salePrice: r.sale_price, isFree: !!r.is_free, status: r.status,
          soldByUserId: r.sold_by_user_id, customerName: r.customer_name, customerPhone: r.customer_phone,
          soldAt: r.sold_at, createdAt: r.created_at,
          history: r.coupon_history ? r.coupon_history.map(h => ({
            action: h.action, details: h.details, user: h.user_id, timestamp: h.timestamp
          })) : []
        }) : null;
        setDbState(prev => ({
          ...prev,
          coupons: allCoupons.map(mapCoupon)
        }));
      } catch (e) {
        console.error('Failed to refresh coupons:', e);
        showToast('Error loading coupons');
      }
    });
  }, [deduplicatedFetch]);

  const refreshTransactions = useCallback(async () => {
    return deduplicatedFetch('refreshTransactions', async () => {
      try {
        const { data, error } = await mockDb.supabase
          .from('transactions')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(500);
        if (error) throw new Error(error.message);
        const mapTransaction = (r) => r ? ({
          id: r.id, fromWalletId: r.from_wallet_id, toWalletId: r.to_wallet_id,
          amount: Number(r.amount), type: r.type, siteId: r.site_id,
          relatedTransactionId: r.related_transaction_id, remarks: r.remarks,
          createdByUserId: r.created_by_user_id, timestamp: r.timestamp
        }) : null;
        setDbState(prev => ({
          ...prev,
          transactions: (data || []).map(mapTransaction)
        }));
      } catch (e) {
        console.error('Failed to refresh transactions:', e);
        showToast('Error loading transactions');
      }
    });
  }, [deduplicatedFetch]);

  const refreshWallets = useCallback(async () => {
    return deduplicatedFetch('refreshWallets', async () => {
      try {
        const { data, error } = await mockDb.supabase.from('wallets').select('*');
        if (error) throw new Error(error.message);
        const mapWallet = (r) => r ? ({
          id: r.id, ownerId: r.owner_id, ownerType: r.owner_type, siteId: r.site_id, balance: Number(r.balance)
        }) : null;
        setDbState(prev => ({
          ...prev,
          wallets: (data || []).map(mapWallet)
        }));
      } catch (e) {
        console.error('Failed to refresh wallets:', e);
        showToast('Error loading wallets');
      }
    });
  }, [deduplicatedFetch]);

  const refreshAuditLogs = useCallback(async () => {
    return deduplicatedFetch('refreshAuditLogs', async () => {
      try {
        const { data, error } = await mockDb.supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(200);
        if (error) throw new Error(error.message);
        const mapAuditLog = (r) => r ? ({
          id: r.id, userId: r.user_id, action: r.action, details: r.details, timestamp: r.timestamp
        }) : null;
        setDbState(prev => ({
          ...prev,
          auditLogs: (data || []).map(mapAuditLog)
        }));
      } catch (e) {
        console.error('Failed to refresh audit logs:', e);
        showToast('Error loading audit logs');
      }
    });
  }, [deduplicatedFetch]);

  const refreshSitesAndProfiles = useCallback(async () => {
    return deduplicatedFetch('refreshSitesAndProfiles', async () => {
      try {
        const [sitesRes, profilesRes] = await Promise.all([
          mockDb.supabase.from('sites').select('*').order('name'),
          mockDb.supabase.from('coupon_profiles').select('*').order('name')
        ]);
        if (sitesRes.error) throw new Error(sitesRes.error.message);
        if (profilesRes.error) throw new Error(profilesRes.error.message);
        const mapSite = (r) => r ? ({
          id: r.id, name: r.name, location: r.location, status: r.status,
          smsEnabled: r.sms_enabled !== false, subscriptionExpiry: r.subscription_expiry || null
        }) : null;
        const mapProfile = (r) => r ? ({
          id: r.id, name: r.name, validityDays: r.validity_days, price: r.price,
          salePrice: r.sale_price, costPrice: r.cost_price, description: r.description, status: r.status
        }) : null;
        setDbState(prev => ({
          ...prev,
          sites: (sitesRes.data || []).map(mapSite),
          couponProfiles: (profilesRes.data || []).map(mapProfile)
        }));
      } catch (e) {
        console.error('Failed to refresh sites/profiles:', e);
        showToast('Error loading sites and profiles');
      }
    });
  }, [deduplicatedFetch]);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const freshDb = await refreshDbState();
      const savedUser = localStorage.getItem('coupon_session_user');
      if (savedUser && freshDb) {
        try {
          const parsed = JSON.parse(savedUser);
          const user = await mockDb.findUser(parsed.username);
          if (user && user.password === parsed.password) {
            setCurrentUser(user);
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
  }, [refreshDbState]);

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

  // 🚀 OPTIMIZATION 3: Memoized Notification Computation
  const computeNotifications = useCallback(() => {
    if (!currentUser) return [];

    const role = currentUser.role;
    const threshold = dbState.settings?.lowStockThreshold || 5;

    // ── Low-stock alerts ──
    const userSiteIds = GLOBAL_ROLES.includes(role)
      ? dbState.sites.map(s => s.id)
      : (dbState.userSites || []).filter(us => us.userId === currentUser.id).map(us => us.siteId);

    const lowStockAlerts = [];
    userSiteIds.forEach(siteId => {
      const site = dbState.sites.find(s => s.id === siteId);
      if (!site) return;
      dbState.couponProfiles.forEach(prof => {
        const siteAssigned = dbState.coupons.filter(
          c => c.profileId === prof.id && c.siteId === siteId && (c.status === 'Assigned' || c.status === 'Available')
        );
        if (siteAssigned.length > 0 && siteAssigned.length < threshold) {
          lowStockAlerts.push({
            id: `warn-${siteId}-${prof.id}`,
            timestamp: new Date().toISOString(),
            type: 'WARNING',
            message: `Low stock: ${prof.name} at ${site.name} has only ${siteAssigned.length} unit(s) left.`,
            color: 'var(--yellow)',
            bg: 'var(--yellow-light)',
          });
        }
      });
    });

    // ── Subscription expiry alerts ──
    const subscriptionAlerts = [];
    userSiteIds.forEach(siteId => {
      const site = dbState.sites.find(s => s.id === siteId);
      if (!site || !site.subscriptionExpiry) return;
      const msLeft = new Date(site.subscriptionExpiry).getTime() - Date.now();
      if (msLeft <= 0) {
        subscriptionAlerts.push({
          id: `sub-expired-${siteId}`,
          timestamp: new Date().toISOString(),
          type: 'WARNING',
          message: `Subscription expired for ${site.name}. Coupon sales and imports are paused.`,
          color: 'var(--red)',
          bg: 'var(--red-light)',
        });
      } else if (msLeft <= 3 * 24 * 60 * 60 * 1000) {
        const daysLeft = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
        subscriptionAlerts.push({
          id: `sub-expiring-${siteId}`,
          timestamp: new Date().toISOString(),
          type: 'WARNING',
          message: `Subscription for ${site.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          color: 'var(--yellow)',
          bg: 'var(--yellow-light)',
        });
      }
    });

    // ── Recent activity logs (simplified for performance) ──
    // TODO: Keep your existing activity log logic here
    const activityAlerts = [];

    return [...lowStockAlerts, ...subscriptionAlerts, ...activityAlerts];
  }, [dbState.coupons, dbState.sites, dbState.couponProfiles, dbState.userSites, currentUser, dbState.settings?.lowStockThreshold]);

  // Use memoized notification computation
  useEffect(() => {
    const computed = computeNotifications();
    setNotifications(computed);
  }, [computeNotifications]);

  // ── Auth functions ───────────────────────────────────────────────────
  const loginUser = async (username, password) => {
    try {
      const user = await mockDb.findUser(username);
      if (user && user.password === password) {
        setCurrentUser(user);
        localStorage.setItem('coupon_session_user', JSON.stringify({ username, password }));
        if (!GLOBAL_ROLES.includes(user.role)) {
          const userSites = (dbState.userSites || []).filter(us => us.userId === user.id);
          setSelectedSiteId(userSites.length > 0 ? userSites[0].siteId : 'none');
        }
        return { success: true };
      }
      return { success: false };
    } catch (e) {
      console.error('Login failed:', e);
      return { success: false };
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('coupon_session_user');
  };

  // ── Action functions with OPTIMIZED refreshes ──────────────────────
  
  const sellCoupon = async (couponId, customerName, customerPhone, salePrice) => {
    if (!currentUser) return;
    try {
      // 🚀 OPTIMISTIC UPDATE: Update UI immediately
      const couponIndex = dbState.coupons.findIndex(c => c.id === couponId);
      if (couponIndex >= 0) {
        setDbState(prev => ({
          ...prev,
          coupons: prev.coupons.map((c, i) =>
            i === couponIndex
              ? { ...c, status: 'Sold', customerName, customerPhone, soldByUserId: currentUser.id, soldAt: new Date().toISOString() }
              : c
          )
        }));
      }

      showToast('Coupon sold!');

      // Sync with backend (only refresh affected data)
      const result = await mockDb.sellCoupon(couponId, customerName, customerPhone, salePrice, currentUser.id);
      
      // Only refresh transactions and wallets (not all coupons)
      await Promise.all([
        refreshTransactions(),
        refreshWallets()
      ]);

      return result;
    } catch (e) {
      // Rollback on error
      await refreshCoupons();
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const collectCashFromStaff = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromStaff(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      // ✅ TARGETED REFRESH: Only refresh what changed
      await Promise.all([
        refreshTransactions(),
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast(`Collected ${amount} AED!`);
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const collectCashFromSuperStaff = async (collectedFromUserId, splits, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromSuperStaff(currentUser.id, collectedFromUserId, splits, remarks);
      await Promise.all([
        refreshTransactions(),
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast('Collection done!');
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const collectCashFromManager = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromManager(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      await Promise.all([
        refreshTransactions(),
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast(`Collected ${amount} AED!`);
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const collectCashFromOwner = async (collectedFromUserId, amount, siteId, remarks) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.collectCashFromOwner(currentUser.id, collectedFromUserId, amount, siteId, remarks);
      await Promise.all([
        refreshTransactions(),
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast(`Collected ${amount} AED!`);
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const reverseTransaction = async (transactionId, reason) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.reverseTransaction(transactionId, currentUser.id, reason);
      await Promise.all([
        refreshTransactions(),
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast('Transaction reversed!');
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const importCoupons = async (csvLines, siteId = null) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.importCoupons(csvLines, currentUser.id, siteId);
      // Only refresh coupons and audit logs
      await Promise.all([
        refreshCoupons(),
        refreshAuditLogs()
      ]);
      showToast(`Imported ${result.count} coupons${result.errors.length ? ' with warnings' : ' successfully'}.`);
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const addSite = async (name, location) => {
    if (!currentUser) return;
    try {
      await mockDb.addSite(name, location, currentUser.id);
      await refreshSitesAndProfiles(); // Sites changed
      showToast(`Site ${name} created`);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const addCouponProfile = async (profile) => {
    if (!currentUser) return;
    try {
      await mockDb.addCouponProfile(profile, currentUser.id);
      await refreshSitesAndProfiles(); // Profiles changed
      showToast(`Profile ${profile.name} created`);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const addUser = async (user, siteIds = []) => {
    if (!currentUser) return;
    try {
      await mockDb.addUser(user, siteIds, currentUser.id);
      await refreshDbState(); // Users and userSites changed - need full refresh
      showToast(`User ${user.username} created`);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const deleteSite = async (siteId) => {
    if (!currentUser) return;
    try {
      await mockDb.deleteSite(siteId, currentUser.id);
      await refreshSitesAndProfiles();
      showToast('Site deleted');
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const deleteCouponProfile = async (profileId) => {
    if (!currentUser) return;
    try {
      await mockDb.deleteCouponProfile(profileId, currentUser.id);
      await refreshSitesAndProfiles();
      showToast('Profile deleted');
    } catch (e) {
      showToast(`Error: ${e.message}`);
      throw e;
    }
  };

  const deleteCoupon = async (couponId) => {
    if (!currentUser) return;
    try {
      await mockDb.deleteCoupon(couponId, currentUser.id);
      await refreshCoupons();
      showToast('Coupon deleted');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const bulkDeleteCoupons = async (couponIds) => {
    if (!currentUser) return;
    try {
      const result = await mockDb.bulkDeleteCoupons(couponIds, currentUser.id);
      await refreshCoupons();
      showToast(`Deleted ${result.count} coupons`);
      return result;
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const walletAdjustment = async (walletId, amount, remarks) => {
    if (!currentUser) return;
    try {
      await mockDb.walletAdjustment(walletId, amount, remarks, currentUser.id);
      await Promise.all([
        refreshWallets(),
        refreshAuditLogs()
      ]);
      showToast(`Wallet adjusted by ${amount} AED!`);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const updateSettings = async (settings) => {
    try {
      await mockDb.updateSettings(settings, currentUser?.id || 'admin');
      await refreshDbState(); // Settings changed
      showToast('Settings saved');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const updateSiteSmsEnabled = async (siteId, enabled) => {
    if (!currentUser) return;
    try {
      await mockDb.updateSiteSmsEnabled(siteId, enabled, currentUser.id);
      await refreshSitesAndProfiles();
      showToast(`SMS ${enabled ? 'enabled' : 'disabled'} for site`);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const updateSiteSubscription = async (siteId, expiryIso) => {
    if (!currentUser) return;
    try {
      await mockDb.updateSiteSubscription(siteId, expiryIso, currentUser.id);
      await refreshSitesAndProfiles();
      showToast(expiryIso ? 'Subscription updated' : 'Subscription expiry cleared');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const isSiteActive = (site) => {
    if (!site || !site.subscriptionExpiry) return true;
    return new Date(site.subscriptionExpiry).getTime() > Date.now();
  };

  const resetDatabase = async () => {
    try {
      await mockDb.resetDb();
      localStorage.removeItem('coupon_session_user');
      await refreshDbState();
      setCurrentUser(null);
      showToast('Database reset successfully');
    } catch (e) {
      showToast(`Error resetting database: ${e.message}`);
      throw e;
    }
  };

  const getCouponHistory = async (couponId) => {
    return await mockDb.getCouponHistory(couponId);
  };

  const getCouponsPage = async (opts) => {
    return await mockDb.getCouponsPage(opts);
  };

  const getCouponsSummary = async (opts) => {
    return await mockDb.getCouponsSummary(opts);
  };

  const getStockCounts = async () => {
    return await mockDb.getStockCounts();
  };

  // Helper functions (from original)
  const getAccessibleSites = () => {
    if (!currentUser) return [];
    if (GLOBAL_ROLES.includes(currentUser.role)) return dbState.sites;
    const siteIds = new Set(
      (dbState.userSites || [])
        .filter(us => us.userId === currentUser.id)
        .map(us => us.siteId)
    );
    return dbState.sites.filter(s => siteIds.has(s.id));
  };

  const deleteUser = async (userId) => {
    if (!currentUser) return;
    try {
      await mockDb.deleteUser(userId, currentUser.id);
      await refreshDbState();
      showToast('User deleted');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const unlinkUserFromSite = async (userId, siteId) => {
    if (!currentUser) return;
    try {
      await mockDb.unlinkUserFromSite(userId, siteId, currentUser.id);
      await refreshDbState();
      showToast('User unlinked from site');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const linkUserToSite = async (userId, siteId) => {
    if (!currentUser) return;
    try {
      await mockDb.linkUserToSite(userId, siteId, currentUser.id);
      await refreshDbState();
      showToast('User linked to site');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const updateSitePrice = async (siteId, profileId, salePrice, costPrice) => {
    if (!currentUser) return;
    try {
      await mockDb.updateSitePrice(siteId, profileId, salePrice, costPrice, currentUser.id);
      await refreshDbState();
      showToast('Price updated');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const assignProfileToSite = async (profileId, siteId, salePrice, costPrice) => {
    if (!currentUser) return;
    try {
      await mockDb.assignProfileToSite(profileId, siteId, salePrice, costPrice, currentUser.id);
      await refreshSitesAndProfiles();
      showToast('Profile assigned');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  const unassignProfileFromSite = async (profileId, siteId) => {
    if (!currentUser) return;
    try {
      await mockDb.unassignProfileFromSite(profileId, siteId, currentUser.id);
      await refreshSitesAndProfiles();
      showToast('Profile unassigned');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  };

  return (
    <AppContext.Provider value={{
      db: dbState, currentUser, appLoading: loading,
      refreshDbState, refreshCoupons, refreshTransactions, refreshWallets, refreshAuditLogs, refreshSitesAndProfiles,
      loginUser, logoutUser,
      selectedSiteId, setSelectedSiteId, getAccessibleSites,
      searchQuery, setSearchQuery, theme, toggleTheme,
      notifications, unreadNotifications, setUnreadNotifications,
      toastMessage, showToast,
      sellCoupon, updateSitePrice, assignProfileToSite, unassignProfileFromSite,
      collectCashFromStaff, collectCashFromSuperStaff, collectCashFromManager, collectCashFromOwner,
      reverseTransaction, importCoupons, addSite, addCouponProfile, addUser,
      deleteUser, unlinkUserFromSite, linkUserToSite, deleteSite, deleteCoupon,
      deleteCouponProfile, bulkDeleteCoupons, getCouponHistory,
      getCouponsPage, getCouponsSummary, getStockCounts,
      walletAdjustment, updateSettings, updateSiteSmsEnabled, updateSiteSubscription, isSiteActive, resetDatabase
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
