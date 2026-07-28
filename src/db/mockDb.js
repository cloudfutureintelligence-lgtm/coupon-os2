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

export const getCouponHistory = async (couponId) => {
  const { data, error } = await supabase
    .from('coupon_history')
    .select('*')
    .eq('coupon_id', couponId)
    .order('timestamp', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(h => ({
    action: h.action,
    details: h.details,
    user: h.user_id,
    timestamp: h.timestamp
  }));
};

export const getDb = async () => {
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 10;

  const [
    [{ data: sites }, { data: profiles }, { data: users }, { data: userSites },
    { data: sitePrices }, { data: wallets },
    { data: transactions }, { data: auditLogs }, { data: settingsRows }, { data: cashCollections }],
    ...availResults
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
    ...Array.from({ length: MAX_PAGES }, (_, i) =>
      supabase.from('coupons').select('*').order('created_at', { ascending: false }).range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
    )
  ]);

  let couponsRaw = [];
  for (const res of availResults) {
    if (res.error) throw new Error(res.error.message);
    couponsRaw = couponsRaw.concat(res.data || []);
  }

  const coupons = couponsRaw.map(mapCoupon);

  return {
    sites: (sites || []).map(mapSite),
    couponProfiles: (profiles || []).map(mapProfile),
    users: (users || []).map(mapUser),
    userSites: (userSites || []).map(mapUserSite),
    sitePrices: (sitePrices || []).map(mapSitePrice),
    coupons,
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
  // All of this now runs as ONE atomic transaction in Postgres (see
  // sell_coupon_atomic in the SQL migration) instead of separate network
  // requests. If anything fails partway through, nothing is committed —
  // no more "coupon marked Sold with no matching wallet credit" risk.
  const { data, error } = await supabase.rpc('sell_coupon_atomic', {
    p_site_id: siteId,
    p_profile_id: profileId,
    p_sold_by_user_id: soldByUserId,
    p_customer_name: customerName || '',
    p_customer_phone: customerPhone || '',
    p_remarks: remarks || '',
    p_is_free: !!isFree,
  });
  if (error) throw new Error(error.message);
  const row = data[0];
  return { success: true, transactionId: row.transaction_id, couponCode: row.coupon_code, isFree: !!isFree, salePrice: Number(row.sale_price) };
};

export const collectCashFromStaff = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  // Runs as one atomic transaction (see collect_cash_simple_atomic) — the
  // wallet debit, wallet credit, transaction record, and collection record
  // either all commit together or none do.
  const { data, error } = await supabase.rpc('collect_cash_simple_atomic', {
    p_from_wallet_id: 'w-' + collectedFromUserId + '-sales',
    p_collected_by_user_id: collectedByUserId,
    p_collected_from_user_id: collectedFromUserId,
    p_amount: amount,
    p_site_id: siteId || null,
    p_remarks: remarks || '',
    p_allowed_roles: ['Super Staff', 'Manager', 'Owner', 'Accountant'],
    p_permission_message: 'Insufficient permissions to collect from Staff',
    p_log_details: 'Collected ' + amount + ' AED from staff ' + collectedFromUserId,
  });
  if (error) {
    if (error.message && error.message.startsWith('Insufficient balance')) {
      throw new Error('Insufficient balance or wallet not found for staff member.');
    }
    throw new Error(error.message);
  }
  return { success: true, transactionId: data[0].transaction_id };
};

export const collectCashFromSuperStaff = async (collectedByUserId, collectedFromUserId, splits, remarks) => {
  // Runs as one atomic transaction (see collect_cash_dual_wallet_atomic) —
  // draining sales wallet then collection wallet, crediting the collector,
  // and recording it all happens together or not at all.
  const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  const siteId = splits[0]?.siteId || null;

  const { data, error } = await supabase.rpc('collect_cash_dual_wallet_atomic', {
    p_collected_by_user_id: collectedByUserId,
    p_collected_from_user_id: collectedFromUserId,
    p_total_amount: totalAmount,
    p_site_id: siteId,
    p_remarks: remarks || '',
    p_allowed_roles: ['Super Staff', 'Manager', 'Owner', 'Accountant', 'Admin'],
    p_permission_message: 'Insufficient permissions to collect from Super Staff',
    p_default_remark: 'Collected from Super Staff',
    p_sales_suffix: ' [own sales]',
    p_collection_suffix: ' [staff collections]',
    p_log_label: 'Super Staff',
  });
  if (error) throw new Error(error.message);
  return { success: true, transactionId: data[0].transaction_id };
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
  // Runs as one atomic transaction (see collect_cash_dual_wallet_atomic).
  const { data, error } = await supabase.rpc('collect_cash_dual_wallet_atomic', {
    p_collected_by_user_id: collectedByUserId,
    p_collected_from_user_id: collectedFromUserId,
    p_total_amount: amount,
    p_site_id: siteId || null,
    p_remarks: remarks || '',
    p_allowed_roles: ['Manager', 'Owner', 'Accountant'],
    p_permission_message: 'Insufficient permissions to collect from Manager',
    p_default_remark: 'Collected from Manager',
    p_sales_suffix: ' [own sales]',
    p_collection_suffix: ' [collected cash]',
    p_log_label: 'Manager',
  });
  if (error) throw new Error(error.message);
  return { success: true, transactionId: data[0].transaction_id };
};

// FIX 5: Collect from Owner (Accountant only)
export const collectCashFromOwner = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  // Runs as one atomic transaction (see collect_cash_simple_atomic).
  const { data, error } = await supabase.rpc('collect_cash_simple_atomic', {
    p_from_wallet_id: 'w-' + collectedFromUserId + '-collection',
    p_collected_by_user_id: collectedByUserId,
    p_collected_from_user_id: collectedFromUserId,
    p_amount: amount,
    p_site_id: siteId || null,
    p_remarks: remarks || '',
    p_allowed_roles: ['Accountant'],
    p_permission_message: 'Only Accountant can collect from Owner',
    p_log_details: 'Collected ' + amount + ' AED from Owner ' + collectedFromUserId,
  });
  if (error) throw new Error(error.message);
  return { success: true, transactionId: data[0].transaction_id };
};