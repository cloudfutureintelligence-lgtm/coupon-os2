// CouponOS — Supabase Database Engine
import { supabase } from './supabase';

const uid = () => 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
const txid = () => 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

const mapSite = (r) => r ? ({ id: r.id, name: r.name, location: r.location, status: r.status, smsEnabled: r.sms_enabled !== false, subscriptionExpiry: r.subscription_expiry || null }) : null;
const mapProfile = (r) => r ? ({ id: r.id, name: r.name, validityDays: r.validity_days, price: r.price, salePrice: r.sale_price, costPrice: r.cost_price, description: r.description, status: r.status }) : null;
const mapUser = (r) => r ? ({ id: r.id, username: r.username, password: r.password, role: r.role, name: r.name, twoFAEnabled: r.two_fa_enabled }) : null;
const mapUserSite = (r) => r ? ({ userId: r.user_id, siteId: r.site_id }) : null;
const mapSitePrice = (r) => r ? ({ siteId: r.site_id, profileId: r.profile_id, salePrice: r.sale_price, costPrice: r.cost_price }) : null;
const mapCoupon = (r) => r ? ({ id: r.id, code: r.code, profileId: r.profile_id, siteId: r.site_id, cost: r.cost, salePrice: r.sale_price, isFree: !!r.is_free, status: r.status, soldByUserId: r.sold_by_user_id, customerName: r.customer_name, customerPhone: r.customer_phone, soldAt: r.sold_at, createdAt: r.created_at, history: r.coupon_history ? r.coupon_history.map(h => ({ action: h.action, details: h.details, user: h.user_id, timestamp: h.timestamp })) : [] }) : null;

// A site whose subscription has lapsed should stop generating sales / receiving new
// stock until an Admin renews it. No expiry set at all = never expires (legacy sites).
export const isSiteSubscriptionActive = (site) => {
  if (!site || !site.subscription_expiry) return true;
  return new Date(site.subscription_expiry).getTime() > Date.now();
};
const mapWallet = (r) => r ? ({ id: r.id, ownerId: r.owner_id, ownerType: r.owner_type, siteId: r.site_id, balance: Number(r.balance) }) : null;
const mapTransaction = (r) => r ? ({ id: r.id, fromWalletId: r.from_wallet_id, toWalletId: r.to_wallet_id, amount: Number(r.amount), type: r.type, siteId: r.site_id, relatedTransactionId: r.related_transaction_id, remarks: r.remarks, createdByUserId: r.created_by_user_id, timestamp: r.timestamp }) : null;
const mapAuditLog = (r) => r ? ({ id: r.id, userId: r.user_id, action: r.action, details: r.details, timestamp: r.timestamp }) : null;
const mapSettings = (r) => r ? ({
  lowStockThreshold: r.low_stock_threshold,
  telegramWebhookUrl: r.telegram_webhook_url,
  whatsappNotificationEnabled: r.whatsapp_notification_enabled,
  twoFactorEnabled: r.two_factor_enabled,
  // SMS gateway
  smsProvider:       r.sms_provider       || 'twilio',
  twilioAccountSid:  r.twilio_account_sid || '',
  twilioAuthToken:   r.twilio_auth_token  || '',
  twilioFromNumber:  r.twilio_from_number || '',
  msegatUserName:    r.msegat_user_name   || '',
  msegatApiKey:      r.msegat_api_key     || '',
  msegatSenderName:  r.msegat_sender_name || '',
}) : {
  lowStockThreshold: 5, telegramWebhookUrl: '', whatsappNotificationEnabled: false, twoFactorEnabled: false,
  smsProvider: 'twilio', twilioAccountSid: '', twilioAuthToken: '', twilioFromNumber: '',
  msegatUserName: '', msegatApiKey: '', msegatSenderName: '',
};

/**
 * Supabase/PostgREST caps any single query at 1000 rows by default. Tables
 * that can realistically grow past that (coupons, and anything selected in
 * full for duplicate/lookup checks) must be paged through in batches of
 * 1000 until a short page tells us we've reached the end.
 */
const PAGE_SIZE = 1000;
const fetchAllRows = async (build) => {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
};

export const getDb = async () => {
  const [
    [{ data: sites }, { data: profiles }, { data: users }, { data: userSites },
    { data: sitePrices }, { data: wallets },
    { data: transactions }, { data: auditLogs }, { data: settingsRows }, { data: cashCollections }],
    coupons
  ] = await Promise.all([
    Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('coupon_profiles').select('*').order('name'),
      supabase.from('users').select('*').order('name'),
      supabase.from('user_sites').select('*'),
      supabase.from('site_prices').select('*'),
      supabase.from('wallets').select('*'),
      supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(500),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
      supabase.from('settings').select('*').limit(1),
      supabase.from('cash_collections').select('*').order('timestamp', { ascending: false })
    ]),
    // coupons can legitimately exceed Supabase's 1000-row-per-query default,
    // so this one is paged through fully rather than fetched in one shot.
    fetchAllRows(() => supabase.from('coupons').select('*, coupon_history(*)').order('created_at', { ascending: false }))
  ]);
  return {
    sites: (sites || []).map(mapSite),
    couponProfiles: (profiles || []).map(mapProfile),
    users: (users || []).map(mapUser),
    userSites: (userSites || []).map(mapUserSite),
    sitePrices: (sitePrices || []).map(mapSitePrice),
    coupons: (coupons || []).map(mapCoupon),
    wallets: (wallets || []).map(mapWallet),
    transactions: (transactions || []).map(mapTransaction),
    auditLogs: (auditLogs || []).map(mapAuditLog),
    settings: mapSettings(settingsRows?.[0]),
    cashCollections: cashCollections || []
  };
};

export const logAction = async (userId, action, details) => {
  await supabase.from('audit_logs').insert({ id: uid(), user_id: userId, action, details });
};

export const findUser = async (username) => {
  const { data } = await supabase.from('users').select('*').ilike('username', username).single();
  return mapUser(data);
};

export const addSite = async (name, location, currentUserId) => {
  const id = 'site-' + name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  const { error } = await supabase.from('sites').insert({ id, name, location, status: 'Active' });
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'SITE_CREATION', 'Created site ' + name);
};

export const updateSiteSmsEnabled = async (siteId, enabled, currentUserId) => {
  const { error } = await supabase.from('sites').update({ sms_enabled: enabled }).eq('id', siteId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'SITE_SMS_TOGGLE', `SMS ${enabled ? 'enabled' : 'disabled'} for site ${siteId}`);
};

// expiryIso = ISO timestamp string, or null to clear the expiry (lifetime access)
export const updateSiteSubscription = async (siteId, expiryIso, currentUserId) => {
  const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();
  const { error } = await supabase.from('sites').update({ subscription_expiry: expiryIso || null }).eq('id', siteId);
  if (error) throw new Error(error.message);
  const detail = expiryIso
    ? `Set subscription for ${site?.name || siteId} to renew/expire on ${new Date(expiryIso).toLocaleString()}`
    : `Cleared subscription expiry for ${site?.name || siteId} (lifetime access)`;
  await logAction(currentUserId || 'admin', 'SITE_SUBSCRIPTION_UPDATE', detail);
};

export const deleteSite = async (siteId, currentUserId) => {
  const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();
  const { error } = await supabase.from('sites').delete().eq('id', siteId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'SITE_DELETION', 'Deleted site: ' + site?.name);
};

export const deleteCouponProfile = async (profileId, currentUserId) => {
  const { data: profile } = await supabase.from('coupon_profiles').select('name').eq('id', profileId).single();
  const { error } = await supabase.from('coupon_profiles').delete().eq('id', profileId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'PROFILE_DELETION', 'Deleted profile: ' + profile?.name);
};

export const bulkDeleteCoupons = async (couponIds, currentUserId) => {
  if (!couponIds || couponIds.length === 0) return { count: 0 };
  const { error } = await supabase.from('coupons').delete().in('id', couponIds);
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'BULK_COUPON_DELETION', 'Bulk deleted ' + couponIds.length + ' coupons');
  return { count: couponIds.length };
};

export const addCouponProfile = async (profile, currentUserId) => {
  const id = 'cp-' + profile.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  const { error } = await supabase.from('coupon_profiles').insert({ id, name: profile.name, validity_days: profile.validityDays, price: profile.price, sale_price: profile.salePrice, cost_price: profile.costPrice, description: profile.description, status: 'Active' });
  if (error) throw new Error(error.message);
  await logAction(currentUserId, 'PROFILE_CREATION', 'Created profile ' + profile.name);
};

export const updateSitePrice = async (siteId, profileId, salePrice, costPrice, currentUserId) => {
  const { error } = await supabase.from('site_prices').upsert({ site_id: siteId, profile_id: profileId, sale_price: Number(salePrice), cost_price: Number(costPrice) }, { onConflict: 'site_id,profile_id' });
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'UPDATE_SITE_PRICE', 'Updated price for profile ' + profileId + ' at site ' + siteId);
};

export const assignProfileToSite = async (siteId, profileId, currentUserId) => {
  const { data: profile } = await supabase.from('coupon_profiles').select('sale_price, cost_price').eq('id', profileId).single();
  const { error } = await supabase.from('site_prices').upsert({ site_id: siteId, profile_id: profileId, sale_price: profile?.sale_price || 0, cost_price: profile?.cost_price || 0 }, { onConflict: 'site_id,profile_id' });
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'PROFILE_ASSIGNED', 'Assigned profile ' + profileId + ' to site ' + siteId);
};

export const unassignProfileFromSite = async (siteId, profileId, currentUserId) => {
  const { error } = await supabase.from('site_prices').delete().eq('site_id', siteId).eq('profile_id', profileId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'PROFILE_UNASSIGNED', 'Unassigned profile ' + profileId + ' from site ' + siteId);
};

export const addUser = async (user, siteIds = [], currentUserId) => {
  const id = 'u-' + user.username.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  const { error } = await supabase.from('users').insert({ id, username: user.username, password: user.password, role: user.role, name: user.name, two_fa_enabled: false });
  if (error) throw new Error(error.message);
  const wallets = [];
  if (user.role === 'Staff') { wallets.push({ id: 'w-'+id+'-sales', owner_id: id, owner_type: 'USER_SALES', balance: 0 }); }
  else if (user.role === 'Super Staff' || user.role === 'Manager') { wallets.push({ id: 'w-'+id+'-sales', owner_id: id, owner_type: 'USER_SALES', balance: 0 }); wallets.push({ id: 'w-'+id+'-collection', owner_id: id, owner_type: 'USER_COLLECTION', balance: 0 }); }
  else { wallets.push({ id: 'w-'+id+'-collection', owner_id: id, owner_type: 'USER_COLLECTION', balance: 0 }); }
  if (wallets.length) await supabase.from('wallets').insert(wallets);
  if (siteIds.length) await supabase.from('user_sites').insert(siteIds.map(sid => ({ user_id: id, site_id: sid })));
  await logAction(currentUserId, 'USER_CREATION', 'Created user ' + user.username + ' (' + user.role + ')');
};

export const deleteUser = async (userId, currentUserId) => {
  if (userId === 'u-sysadmin') throw new Error('Cannot delete system administrator');
  const { data: user } = await supabase.from('users').select('username').eq('id', userId).single();
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'USER_DELETION', 'Deleted user: ' + user?.username);
};

export const linkUserToSite = async (userId, siteId, currentUserId) => {
  const { error } = await supabase.from('user_sites').insert({ user_id: userId, site_id: siteId });
  if (error) { if (error.code === '23505') throw new Error('User already linked to this site'); throw new Error(error.message); }
  await logAction(currentUserId || 'admin', 'USER_LINK', 'Linked user ' + userId + ' to site ' + siteId);
};

export const unlinkUserFromSite = async (userId, siteId, currentUserId) => {
  const { error } = await supabase.from('user_sites').delete().eq('user_id', userId).eq('site_id', siteId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'USER_UNLINK', 'Unlinked user ' + userId + ' from site ' + siteId);
};

export const importCoupons = async (csvLines, importedByUserId, siteId = null) => {
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name, subscription_expiry').eq('id', siteId).single();
    if (!isSiteSubscriptionActive(site)) {
      throw new Error('This site\'s subscription has expired. Renew it before importing more stock.');
    }
  }
  const { data: profiles } = await supabase.from('coupon_profiles').select('*');
  const { data: sitePrices } = await supabase.from('site_prices').select('*');
  // Paged, not a single .select('code') — past 1000 existing coupons the
  // unpaged version silently stopped seeing older codes, so duplicates
  // could slip through (or valid new codes could be wrongly flagged once
  // that page happened to include a look-alike from the truncated set).
  const existing = await fetchAllRows(() => supabase.from('coupons').select('code'));
  const existingCodes = new Set(existing.map(c => c.code));
  const { data: userRow } = await supabase.from('users').select('username').eq('id', importedByUserId).single();
  const username = userRow?.username || importedByUserId;
  const toInsert = [], historyToInsert = [], errors = [];
  const timestamp = new Date().toISOString();
  csvLines.forEach((line, index) => {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 2) { errors.push('Row ' + (index+1) + ': Need code, profile'); return; }
    const [code, profileName, costStr, salePriceStr] = parts;
    if (!code || !profileName) { errors.push('Row ' + (index+1) + ': Missing fields'); return; }
    const profile = (profiles || []).find(p => p.name.toLowerCase() === profileName.toLowerCase() || p.id.toLowerCase() === profileName.toLowerCase());
    if (!profile) { errors.push('Row ' + (index+1) + ': Profile "' + profileName + '" not found'); return; }
    if (existingCodes.has(code)) { errors.push('Row ' + (index+1) + ': Duplicate code "' + code + '"'); return; }
    let cost = costStr ? Number(costStr) : profile.cost_price;
    let salePrice = salePriceStr ? Number(salePriceStr) : profile.sale_price;
    if (siteId && !costStr && !salePriceStr) { const ov = (sitePrices || []).find(sp => sp.site_id === siteId && sp.profile_id === profile.id); if (ov) { cost = ov.cost_price; salePrice = ov.sale_price; } }
    const couponId = 'c-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '-' + index;
    existingCodes.add(code);
    toInsert.push({ id: couponId, code, profile_id: profile.id, site_id: siteId || null, cost, sale_price: salePrice, status: 'Available' });
    historyToInsert.push({ coupon_id: couponId, action: 'CREATED', details: 'Imported via CSV. Site: ' + (siteId || 'none'), user_id: username, timestamp });
  });

  // Insert in chunks rather than one giant request — keeps large pastes
  // (hundreds/thousands of codes) well under Supabase's request size and
  // statement-timeout limits, and lets us report exactly which chunk failed
  // instead of silently losing rows.
  const INSERT_CHUNK = 200;
  let insertedCount = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const couponChunk = toInsert.slice(i, i + INSERT_CHUNK);
    const historyChunk = historyToInsert.slice(i, i + INSERT_CHUNK);

    const { error: couponError } = await supabase.from('coupons').insert(couponChunk);
    if (couponError) {
      errors.push('Insert failed at row ' + (i + 1) + '-' + (i + couponChunk.length) + ': ' + couponError.message);
      break; // stop rather than risk history rows pointing at coupons that never landed
    }

    const { error: historyError } = await supabase.from('coupon_history').insert(historyChunk);
    if (historyError) {
      errors.push('Coupons ' + (i + 1) + '-' + (i + couponChunk.length) + ' saved, but their history entry failed: ' + historyError.message);
    }

    insertedCount += couponChunk.length;
  }

  await logAction(importedByUserId, 'CSV_IMPORT', 'Imported ' + insertedCount + ' coupons. Errors: ' + errors.length);
  return { success: true, count: insertedCount, errors };
};

export const deleteCoupon = async (couponId, currentUserId) => {
  const { data: coupon } = await supabase.from('coupons').select('code').eq('id', couponId).single();
  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'COUPON_DELETION', 'Deleted coupon: ' + coupon?.code);
};

export const sellCoupon = async (siteId, profileId, soldByUserId, customerName, customerPhone, remarks, isFree = false) => {
  // Step 0: Subscription gate — a site whose subscription has lapsed cannot sell coupons
  const { data: site } = await supabase.from('sites').select('name, subscription_expiry').eq('id', siteId).single();
  if (!isSiteSubscriptionActive(site)) {
    throw new Error('This site\'s subscription has expired. Ask an Admin to renew it before selling coupons.');
  }

  // Step 0b: Only Managers may issue free coupons — enforce server-side too
  if (isFree) {
    const { data: seller } = await supabase.from('users').select('role').eq('id', soldByUserId).single();
    if (!seller || seller.role !== 'Manager') throw new Error('Only Managers can issue free coupons');
  }

  // Step 1: Find an available coupon
  const { data: coupons } = await supabase.from('coupons').select('*').eq('site_id', siteId).eq('profile_id', profileId).eq('status', 'Available').limit(1);
  if (!coupons || coupons.length === 0) throw new Error('No coupons available for this profile at this site');
  const coupon = coupons[0];
  const effectivePrice = isFree ? 0 : Number(coupon.sale_price);

  // Step 2: Atomic status update + fetch both wallets in parallel
  const walletId = 'w-' + soldByUserId + '-sales';
  const [{ data: updated, error: updateError }, { data: ew }, { data: sw }] = await Promise.all([
    supabase.from('coupons')
      .update({ status: 'Sold', sold_by_user_id: soldByUserId, customer_name: customerName || '', customer_phone: customerPhone || '', sold_at: new Date().toISOString(), sale_price: effectivePrice, is_free: !!isFree })
      .eq('id', coupon.id)
      .eq('status', 'Available')
      .select(),
    supabase.from('wallets').select('id, balance').eq('id', walletId).single(),
    supabase.from('wallets').select('balance').eq('id', 'w-system').single(),
  ]);
  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.length === 0) throw new Error('Coupon was already sold — please try again');
  const soldAt = updated[0].sold_at;

  // Step 3: Update wallets + insert history/transaction/log all in parallel
  // (Free coupons move 0 AED, so wallets are effectively untouched but we still
  //  ensure the sales wallet row exists for first-time sellers like Managers.)
  const txId = txid();
  const newUserBalance = ew ? Number(ew.balance) + effectivePrice : effectivePrice;
  const freeNote = isFree ? 'FREE COUPON (Manager-issued, 0 AED). ' : '';
  await Promise.all([
    ew
      ? supabase.from('wallets').update({ balance: newUserBalance }).eq('id', walletId)
      : supabase.from('wallets').insert({ id: walletId, owner_id: soldByUserId, owner_type: 'USER_SALES', balance: effectivePrice }),
    sw
      ? supabase.from('wallets').update({ balance: Number(sw.balance) - effectivePrice }).eq('id', 'w-system')
      : Promise.resolve(),
    supabase.from('coupon_history').insert({ coupon_id: coupon.id, action: isFree ? 'SOLD_FREE' : 'SOLD', user_id: soldByUserId, details: freeNote + 'Sold to ' + (customerName || 'Walk-in') + ' for ' + effectivePrice + ' AED. ' + (remarks || '') }),
    supabase.from('transactions').insert({ id: txId, from_wallet_id: 'w-system', to_wallet_id: walletId, amount: effectivePrice, type: 'SALE', timestamp: soldAt, remarks: freeNote + 'Coupon sold: ' + coupon.code, created_by_user_id: soldByUserId }),
    logAction(soldByUserId, 'COUPON_SALE', freeNote + 'Sold coupon ' + coupon.code + ' for ' + effectivePrice + ' AED. Customer: ' + (customerName || 'None')),
  ]);

  return { success: true, transactionId: txId, couponCode: coupon.code, isFree: !!isFree, salePrice: effectivePrice };
};

export const collectCashFromStaff = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  // FIX 5: Role hierarchy — Super Staff, Manager, Owner, Accountant can collect from Staff
  const { data: collector } = await supabase.from('users').select('role').eq('id', collectedByUserId).single();
  const ALLOWED_COLLECTORS = ['Super Staff', 'Manager', 'Owner', 'Accountant'];
  if (!collector || !ALLOWED_COLLECTORS.includes(collector.role)) throw new Error('Insufficient permissions to collect from Staff');
  const staffWalletId = 'w-' + collectedFromUserId + '-sales';
  const { data: staffWallet } = await supabase.from('wallets').select('balance').eq('id', staffWalletId).single();
  if (!staffWallet || Number(staffWallet.balance) < amount) throw new Error('Insufficient balance: ' + (staffWallet?.balance || 0) + ' AED');
  const superWalletId = 'w-' + collectedByUserId + '-collection';
  const { data: superWallet } = await supabase.from('wallets').select('balance').eq('id', superWalletId).single();
  await supabase.from('wallets').update({ balance: Number(staffWallet.balance) - amount }).eq('id', staffWalletId);
  if (superWallet) { await supabase.from('wallets').update({ balance: Number(superWallet.balance) + amount }).eq('id', superWalletId); }
  else { await supabase.from('wallets').insert({ id: superWalletId, owner_id: collectedByUserId, owner_type: 'USER_COLLECTION', balance: amount }); }
  const txId = txid();
  await supabase.from('transactions').insert({ id: txId, from_wallet_id: staffWalletId, to_wallet_id: superWalletId, amount, type: 'CASH_COLLECTION', created_by_user_id: collectedByUserId, remarks: remarks || 'Collected ' + amount + ' AED from staff' });
  await supabase.from('cash_collections').insert({ id: uid(), collected_from_user_id: collectedFromUserId, collected_by_user_id: collectedByUserId, amount, site_id: siteId || null, remarks: remarks || '' });
  await logAction(collectedByUserId, 'CASH_COLLECTION', 'Collected ' + amount + ' AED from staff ' + collectedFromUserId);
  return { success: true, transactionId: txId };
};

export const collectCashFromSuperStaff = async (collectedByUserId, collectedFromUserId, splits, remarks) => {
  // Role hierarchy — Manager, Owner, Accountant, Admin can collect from Super Staff
  const { data: collector } = await supabase.from('users').select('role').eq('id', collectedByUserId).single();
  const ALLOWED_FROM_SUPER = ['Manager', 'Owner', 'Accountant', 'Admin'];
  if (!collector || !ALLOWED_FROM_SUPER.includes(collector.role)) throw new Error('Insufficient permissions to collect from Super Staff');

  // Super Staff has TWO wallets: their own sales (-sales) + cash collected from Staff (-collection)
  // Both must be drained together so the collector sees the full 20 AED, not just 10.
  const salesWalletId      = 'w-' + collectedFromUserId + '-sales';
  const collectionWalletId = 'w-' + collectedFromUserId + '-collection';
  const { data: salesWallet }      = await supabase.from('wallets').select('balance').eq('id', salesWalletId).single();
  const { data: collectionWallet } = await supabase.from('wallets').select('balance').eq('id', collectionWalletId).single();
  const salesBal      = salesWallet      ? Number(salesWallet.balance)      : 0;
  const collectionBal = collectionWallet ? Number(collectionWallet.balance) : 0;
  const combinedBalance = salesBal + collectionBal;

  const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  if (combinedBalance < totalAmount) throw new Error('Insufficient balance: ' + combinedBalance + ' AED (sales: ' + salesBal + ', collected: ' + collectionBal + ')');

  // Drain sales wallet first, then collection wallet for the remainder
  const timestamp = new Date().toISOString();
  const baseTxId = txid();
  let remaining = totalAmount;

  if (salesBal > 0 && remaining > 0) {
    const deductFromSales = Math.min(salesBal, remaining);
    await supabase.from('wallets').update({ balance: salesBal - deductFromSales }).eq('id', salesWalletId);
    remaining -= deductFromSales;
    await supabase.from('transactions').insert({ id: baseTxId+'-sales-debit', from_wallet_id: salesWalletId, to_wallet_id: 'w-' + collectedByUserId + '-collection', amount: deductFromSales, type: 'CASH_COLLECTION', timestamp, remarks: (remarks || 'Collected from Super Staff') + ' [own sales]', created_by_user_id: collectedByUserId });
  }
  if (collectionBal > 0 && remaining > 0) {
    const deductFromCollection = Math.min(collectionBal, remaining);
    await supabase.from('wallets').update({ balance: collectionBal - deductFromCollection }).eq('id', collectionWalletId);
    remaining -= deductFromCollection;
    await supabase.from('transactions').insert({ id: baseTxId+'-collection-debit', from_wallet_id: collectionWalletId, to_wallet_id: 'w-' + collectedByUserId + '-collection', amount: deductFromCollection, type: 'CASH_COLLECTION', timestamp, remarks: (remarks || 'Collected from Super Staff') + ' [staff collections]', created_by_user_id: collectedByUserId });
  }

  // Credit the collector's wallet
  const collectorWalletId = 'w-' + collectedByUserId + '-collection';
  const { data: collWallet } = await supabase.from('wallets').select('balance').eq('id', collectorWalletId).single();
  if (collWallet) { await supabase.from('wallets').update({ balance: Number(collWallet.balance) + totalAmount }).eq('id', collectorWalletId); }
  else { await supabase.from('wallets').insert({ id: collectorWalletId, owner_id: collectedByUserId, owner_type: 'USER_COLLECTION', balance: totalAmount }); }

  await supabase.from('cash_collections').insert({ id: uid(), collected_from_user_id: collectedFromUserId, collected_by_user_id: collectedByUserId, amount: totalAmount, site_id: splits[0]?.siteId || null, remarks: remarks || '' });
  await logAction(collectedByUserId, 'CASH_COLLECTION', 'Collected ' + totalAmount + ' AED from Super Staff ' + collectedFromUserId + ' (sales: ' + salesBal + ' + collected: ' + collectionBal + ')');
  return { success: true };
};

export const walletAdjustment = async (walletId, amount, remarks, currentUserId) => {
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', walletId).single();
  if (!wallet) throw new Error('Wallet not found');
  await supabase.from('wallets').update({ balance: Number(wallet.balance) + amount }).eq('id', walletId);
  const txId = txid();
  await supabase.from('transactions').insert({ id: txId, from_wallet_id: amount >= 0 ? 'w-system' : walletId, to_wallet_id: amount >= 0 ? walletId : 'w-system', amount: Math.abs(amount), type: 'ADJUSTMENT', remarks: remarks || 'Adjustment of ' + amount + ' AED', created_by_user_id: currentUserId });
  await logAction(currentUserId, 'WALLET_ADJUSTMENT', 'Adjusted wallet ' + walletId + ' by ' + amount + ' AED');
};

export const reverseTransaction = async (transactionId, reversedByUserId, reason) => {
  const { data: orig } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
  if (!orig) throw new Error('Transaction not found');
  if (orig.type === 'REVERSAL') throw new Error('Cannot reverse a reversal');
  const { data: already } = await supabase.from('transactions').select('id').eq('type', 'REVERSAL').eq('related_transaction_id', transactionId);
  if (already && already.length > 0) throw new Error('Already reversed');
  if (orig.to_wallet_id) { const { data: toW } = await supabase.from('wallets').select('balance').eq('id', orig.to_wallet_id).single(); if (!toW || Number(toW.balance) < orig.amount) throw new Error('Recipient has insufficient funds'); await supabase.from('wallets').update({ balance: Number(toW.balance) - Number(orig.amount) }).eq('id', orig.to_wallet_id); }
  if (orig.from_wallet_id) { const { data: fromW } = await supabase.from('wallets').select('balance').eq('id', orig.from_wallet_id).single(); if (fromW) await supabase.from('wallets').update({ balance: Number(fromW.balance) + Number(orig.amount) }).eq('id', orig.from_wallet_id); }
  const revTxId = txid();
  await supabase.from('transactions').insert({ id: revTxId, from_wallet_id: orig.to_wallet_id, to_wallet_id: orig.from_wallet_id, amount: orig.amount, type: 'REVERSAL', related_transaction_id: transactionId, remarks: 'REVERSAL of ' + transactionId + '. Reason: ' + (reason || 'Correction'), created_by_user_id: reversedByUserId });
  await logAction(reversedByUserId, 'TRANSACTION_REVERSAL', 'Reversed ' + transactionId + '. Reason: ' + reason);
  return { success: true, transactionId: revTxId };
};

export const updateSettings = async (settings, currentUserId) => {
  await supabase.from('settings').update({
    low_stock_threshold:          settings.lowStockThreshold,
    telegram_webhook_url:         settings.telegramWebhookUrl,
    whatsapp_notification_enabled: settings.whatsappNotificationEnabled,
    two_factor_enabled:           settings.twoFactorEnabled,
    // SMS gateway
    sms_provider:       settings.smsProvider       || 'twilio',
    twilio_account_sid: settings.twilioAccountSid  || '',
    twilio_auth_token:  settings.twilioAuthToken   || '',
    twilio_from_number: settings.twilioFromNumber  || '',
    msegat_user_name:   settings.msegatUserName    || '',
    msegat_api_key:     settings.msegatApiKey      || '',
    msegat_sender_name: settings.msegatSenderName  || '',
  }).eq('id', 1);
  await logAction(currentUserId || 'admin', 'SETTINGS_CHANGE', 'Updated system configuration');
};

export const resetDb = async () => {
  await Promise.all([
    supabase.from('transactions').delete().neq('id', ''),
    supabase.from('coupon_history').delete().neq('id', 0),
    supabase.from('cash_collections').delete().neq('id', ''),
    supabase.from('audit_logs').delete().neq('id', ''),
  ]);
  await supabase.from('coupons').delete().neq('id', '');
  await supabase.from('wallets').delete().neq('id', '');
  await supabase.from('user_sites').delete().neq('id', 0);
  await supabase.from('users').delete().neq('id', 'u-sysadmin');
  await supabase.from('sites').delete().neq('id', '');
  await supabase.from('coupon_profiles').delete().neq('id', '');
  await supabase.from('site_prices').delete().neq('id', 0);
  await supabase.from('settings').update({ low_stock_threshold: 5, telegram_webhook_url: '', whatsapp_notification_enabled: false, two_factor_enabled: false }).eq('id', 1);
  await supabase.from('wallets').insert([
    { id: 'w-system', owner_id: 'SYSTEM', owner_type: 'SYSTEM', balance: 0 },
    { id: 'w-u-sysadmin', owner_id: 'u-sysadmin', owner_type: 'USER', balance: 0 }
  ]);
};

// FIX 5: Collect from Manager (Owner and Accountant)
// Managers can now sell coupons directly (their own '-sales' wallet) in addition to
// collecting from Staff/Super Staff (their '-collection' wallet) — drain both, same
// pattern used for Super Staff, so the collector sees the Manager's full balance.
export const collectCashFromManager = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  const { data: collector } = await supabase.from('users').select('role').eq('id', collectedByUserId).single();
  const ALLOWED = ['Owner', 'Accountant'];
  if (!collector || !ALLOWED.includes(collector.role)) throw new Error('Insufficient permissions to collect from Manager');

  const salesWalletId      = 'w-' + collectedFromUserId + '-sales';
  const collectionWalletId = 'w-' + collectedFromUserId + '-collection';
  const { data: salesWallet }      = await supabase.from('wallets').select('balance').eq('id', salesWalletId).single();
  const { data: collectionWallet } = await supabase.from('wallets').select('balance').eq('id', collectionWalletId).single();
  const salesBal      = salesWallet      ? Number(salesWallet.balance)      : 0;
  const collectionBal = collectionWallet ? Number(collectionWallet.balance) : 0;
  const combinedBalance = salesBal + collectionBal;
  if (combinedBalance < amount) throw new Error('Insufficient balance: ' + combinedBalance + ' AED (sales: ' + salesBal + ', collected: ' + collectionBal + ')');

  const collectorWalletId = 'w-' + collectedByUserId + '-collection';
  const { data: collWallet } = await supabase.from('wallets').select('balance').eq('id', collectorWalletId).single();

  let remaining = amount;
  const timestamp = new Date().toISOString();
  const baseTxId = txid();

  if (salesBal > 0 && remaining > 0) {
    const deduct = Math.min(salesBal, remaining);
    await supabase.from('wallets').update({ balance: salesBal - deduct }).eq('id', salesWalletId);
    remaining -= deduct;
    await supabase.from('transactions').insert({ id: baseTxId + '-sales-debit', from_wallet_id: salesWalletId, to_wallet_id: collectorWalletId, amount: deduct, type: 'CASH_COLLECTION', timestamp, remarks: (remarks || 'Collected from Manager') + ' [own sales]', created_by_user_id: collectedByUserId });
  }
  if (collectionBal > 0 && remaining > 0) {
    const deduct = Math.min(collectionBal, remaining);
    await supabase.from('wallets').update({ balance: collectionBal - deduct }).eq('id', collectionWalletId);
    remaining -= deduct;
    await supabase.from('transactions').insert({ id: baseTxId + '-collection-debit', from_wallet_id: collectionWalletId, to_wallet_id: collectorWalletId, amount: deduct, type: 'CASH_COLLECTION', timestamp, remarks: (remarks || 'Collected from Manager') + ' [collected cash]', created_by_user_id: collectedByUserId });
  }

  if (collWallet) { await supabase.from('wallets').update({ balance: Number(collWallet.balance) + amount }).eq('id', collectorWalletId); }
  else { await supabase.from('wallets').insert({ id: collectorWalletId, owner_id: collectedByUserId, owner_type: 'USER_COLLECTION', balance: amount }); }

  await supabase.from('cash_collections').insert({ id: uid(), collected_from_user_id: collectedFromUserId, collected_by_user_id: collectedByUserId, amount, site_id: siteId || null, remarks: remarks || '' });
  await logAction(collectedByUserId, 'CASH_COLLECTION', 'Collected ' + amount + ' AED from Manager ' + collectedFromUserId + ' (sales: ' + salesBal + ' + collected: ' + collectionBal + ')');
  return { success: true, transactionId: baseTxId };
};

// FIX 5: Collect from Owner (Accountant only)
export const collectCashFromOwner = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  const { data: collector } = await supabase.from('users').select('role').eq('id', collectedByUserId).single();
  if (!collector || collector.role !== 'Accountant') throw new Error('Only Accountant can collect from Owner');
  const ownerWalletId = 'w-' + collectedFromUserId + '-collection';
  const { data: ownerWallet } = await supabase.from('wallets').select('balance').eq('id', ownerWalletId).single();
  if (!ownerWallet || Number(ownerWallet.balance) < amount) throw new Error('Insufficient balance: ' + (ownerWallet?.balance || 0) + ' AED');
  const collectorWalletId = 'w-' + collectedByUserId + '-collection';
  const { data: collWallet } = await supabase.from('wallets').select('balance').eq('id', collectorWalletId).single();
  await supabase.from('wallets').update({ balance: Number(ownerWallet.balance) - amount }).eq('id', ownerWalletId);
  if (collWallet) { await supabase.from('wallets').update({ balance: Number(collWallet.balance) + amount }).eq('id', collectorWalletId); }
  else { await supabase.from('wallets').insert({ id: collectorWalletId, owner_id: collectedByUserId, owner_type: 'USER_COLLECTION', balance: amount }); }
  const txId = txid();
  await supabase.from('transactions').insert({ id: txId, from_wallet_id: ownerWalletId, to_wallet_id: collectorWalletId, amount, type: 'CASH_COLLECTION', created_by_user_id: collectedByUserId, remarks: remarks || 'Collected ' + amount + ' AED from owner' });
  await supabase.from('cash_collections').insert({ id: uid(), collected_from_user_id: collectedFromUserId, collected_by_user_id: collectedByUserId, amount, site_id: siteId || null, remarks: remarks || '' });
  await logAction(collectedByUserId, 'CASH_COLLECTION', 'Collected ' + amount + ' AED from Owner ' + collectedFromUserId);
  return { success: true, transactionId: txId };
};