// CouponOS — Supabase Database Engine
import { supabase } from './supabase';

const uid = () => 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
const txid = () => 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

const mapSite = (r) => r ? ({ id: r.id, name: r.name, location: r.location, status: r.status }) : null;
const mapProfile = (r) => r ? ({ id: r.id, name: r.name, validityDays: r.validity_days, price: r.price, salePrice: r.sale_price, costPrice: r.cost_price, description: r.description, status: r.status }) : null;
const mapUser = (r) => r ? ({ id: r.id, username: r.username, password: r.password, role: r.role, name: r.name, twoFAEnabled: r.two_fa_enabled }) : null;
const mapUserSite = (r) => r ? ({ userId: r.user_id, siteId: r.site_id }) : null;
const mapSitePrice = (r) => r ? ({ siteId: r.site_id, profileId: r.profile_id, salePrice: r.sale_price, costPrice: r.cost_price }) : null;
const mapCoupon = (r) => r ? ({ id: r.id, code: r.code, profileId: r.profile_id, siteId: r.site_id, cost: r.cost, salePrice: r.sale_price, status: r.status, soldByUserId: r.sold_by_user_id, customerName: r.customer_name, customerPhone: r.customer_phone, soldAt: r.sold_at, createdAt: r.created_at, history: r.coupon_history ? r.coupon_history.map(h => ({ action: h.action, details: h.details, user: h.user_id, timestamp: h.timestamp })) : [] }) : null;
const mapWallet = (r) => r ? ({ id: r.id, ownerId: r.owner_id, ownerType: r.owner_type, siteId: r.site_id, balance: Number(r.balance) }) : null;
const mapTransaction = (r) => r ? ({ id: r.id, fromWalletId: r.from_wallet_id, toWalletId: r.to_wallet_id, amount: Number(r.amount), type: r.type, siteId: r.site_id, relatedTransactionId: r.related_transaction_id, remarks: r.remarks, createdByUserId: r.created_by_user_id, timestamp: r.timestamp }) : null;
const mapAuditLog = (r) => r ? ({ id: r.id, userId: r.user_id, action: r.action, details: r.details, timestamp: r.timestamp }) : null;
const mapSettings = (r) => r ? ({ lowStockThreshold: r.low_stock_threshold, telegramWebhookUrl: r.telegram_webhook_url, whatsappNotificationEnabled: r.whatsapp_notification_enabled, twoFactorEnabled: r.two_factor_enabled }) : { lowStockThreshold: 5, telegramWebhookUrl: '', whatsappNotificationEnabled: false, twoFactorEnabled: false };

export const getDb = async () => {
  const [
    { data: sites }, { data: profiles }, { data: users }, { data: userSites },
    { data: sitePrices }, { data: coupons }, { data: wallets },
    { data: transactions }, { data: auditLogs }, { data: settingsRows }, { data: cashCollections }
  ] = await Promise.all([
    supabase.from('sites').select('*').order('name'),
    supabase.from('coupon_profiles').select('*').order('name'),
    supabase.from('users').select('*').order('name'),
    supabase.from('user_sites').select('*'),
    supabase.from('site_prices').select('*'),
    supabase.from('coupons').select('*, coupon_history(*)').order('created_at', { ascending: false }),
    supabase.from('wallets').select('*'),
    supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(500),
    supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
    supabase.from('settings').select('*').limit(1),
    supabase.from('cash_collections').select('*').order('timestamp', { ascending: false })
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
  else if (user.role === 'Super Staff') { wallets.push({ id: 'w-'+id+'-sales', owner_id: id, owner_type: 'USER_SALES', balance: 0 }); wallets.push({ id: 'w-'+id+'-collection', owner_id: id, owner_type: 'USER_COLLECTION', balance: 0 }); }
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
  const { data: profiles } = await supabase.from('coupon_profiles').select('*');
  const { data: sitePrices } = await supabase.from('site_prices').select('*');
  const { data: existing } = await supabase.from('coupons').select('code');
  const existingCodes = new Set((existing || []).map(c => c.code));
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
  if (toInsert.length) {
    const { error } = await supabase.from('coupons').insert(toInsert);
    if (error) throw new Error(error.message);
    await supabase.from('coupon_history').insert(historyToInsert);
  }
  await logAction(importedByUserId, 'CSV_IMPORT', 'Imported ' + toInsert.length + ' coupons. Errors: ' + errors.length);
  return { success: true, count: toInsert.length, errors };
};

export const deleteCoupon = async (couponId, currentUserId) => {
  const { data: coupon } = await supabase.from('coupons').select('code').eq('id', couponId).single();
  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  if (error) throw new Error(error.message);
  await logAction(currentUserId || 'admin', 'COUPON_DELETION', 'Deleted coupon: ' + coupon?.code);
};

export const sellCoupon = async (siteId, profileId, soldByUserId, customerName, customerPhone, remarks) => {
  // FIX 1: Backend duplicate-prevention — re-check availability right before writing
  // This catches race conditions where the same coupon was picked by two near-simultaneous requests
  const { data: coupons } = await supabase.from('coupons').select('*').eq('site_id', siteId).eq('profile_id', profileId).eq('status', 'Available').limit(1);
  if (!coupons || coupons.length === 0) throw new Error('No coupons available for this profile at this site');
  const coupon = coupons[0];
  // Atomic update: only update if still 'Available' — if another request already sold it, rowCount = 0
  const { data: updated, error: updateError } = await supabase
    .from('coupons')
    .update({ status: 'Sold', sold_by_user_id: soldByUserId, customer_name: customerName || '', customer_phone: customerPhone || '', sold_at: new Date().toISOString() })
    .eq('id', coupon.id)
    .eq('status', 'Available')  // Only update if STILL available — prevents duplicate
    .select();
  if (updateError) throw new Error(updateError.message);
  if (!updated || updated.length === 0) throw new Error('Coupon was already sold — please try again');
  const soldAt = updated[0].sold_at;
  await supabase.from('coupon_history').insert({ coupon_id: coupon.id, action: 'SOLD', user_id: soldByUserId, details: 'Sold to ' + (customerName || 'Walk-in') + ' for ' + coupon.sale_price + ' AED. ' + (remarks || '') });
  const walletId = 'w-' + soldByUserId + '-sales';
  const { data: ew } = await supabase.from('wallets').select('id, balance').eq('id', walletId).single();
  if (ew) { await supabase.from('wallets').update({ balance: Number(ew.balance) + Number(coupon.sale_price) }).eq('id', walletId); }
  else { await supabase.from('wallets').insert({ id: walletId, owner_id: soldByUserId, owner_type: 'USER_SALES', balance: coupon.sale_price }); }
  const { data: sw } = await supabase.from('wallets').select('balance').eq('id', 'w-system').single();
  if (sw) await supabase.from('wallets').update({ balance: Number(sw.balance) - Number(coupon.sale_price) }).eq('id', 'w-system');
  const txId = txid();
  await supabase.from('transactions').insert({ id: txId, from_wallet_id: 'w-system', to_wallet_id: walletId, amount: coupon.sale_price, type: 'SALE', timestamp: soldAt, remarks: 'Coupon sold: ' + coupon.code, created_by_user_id: soldByUserId });
  await logAction(soldByUserId, 'COUPON_SALE', 'Sold coupon ' + coupon.code + ' for ' + coupon.sale_price + ' AED. Customer: ' + (customerName || 'None'));
  return { success: true, transactionId: txId, couponCode: coupon.code };
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
  await supabase.from('settings').update({ low_stock_threshold: settings.lowStockThreshold, telegram_webhook_url: settings.telegramWebhookUrl, whatsapp_notification_enabled: settings.whatsappNotificationEnabled, two_factor_enabled: settings.twoFactorEnabled }).eq('id', 1);
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
export const collectCashFromManager = async (collectedByUserId, collectedFromUserId, amount, siteId, remarks) => {
  const { data: collector } = await supabase.from('users').select('role').eq('id', collectedByUserId).single();
  const ALLOWED = ['Owner', 'Accountant'];
  if (!collector || !ALLOWED.includes(collector.role)) throw new Error('Insufficient permissions to collect from Manager');
  const managerWalletId = 'w-' + collectedFromUserId + '-collection';
  const { data: mgrWallet } = await supabase.from('wallets').select('balance').eq('id', managerWalletId).single();
  if (!mgrWallet || Number(mgrWallet.balance) < amount) throw new Error('Insufficient balance: ' + (mgrWallet?.balance || 0) + ' AED');
  // Collector wallet
  const collectorWalletId = 'w-' + collectedByUserId + '-collection';
  const { data: collWallet } = await supabase.from('wallets').select('balance').eq('id', collectorWalletId).single();
  await supabase.from('wallets').update({ balance: Number(mgrWallet.balance) - amount }).eq('id', managerWalletId);
  if (collWallet) { await supabase.from('wallets').update({ balance: Number(collWallet.balance) + amount }).eq('id', collectorWalletId); }
  else { await supabase.from('wallets').insert({ id: collectorWalletId, owner_id: collectedByUserId, owner_type: 'USER_COLLECTION', balance: amount }); }
  const txId = txid();
  await supabase.from('transactions').insert({ id: txId, from_wallet_id: managerWalletId, to_wallet_id: collectorWalletId, amount, type: 'CASH_COLLECTION', created_by_user_id: collectedByUserId, remarks: remarks || 'Collected ' + amount + ' AED from manager' });
  await supabase.from('cash_collections').insert({ id: uid(), collected_from_user_id: collectedFromUserId, collected_by_user_id: collectedByUserId, amount, site_id: siteId || null, remarks: remarks || '' });
  await logAction(collectedByUserId, 'CASH_COLLECTION', 'Collected ' + amount + ' AED from Manager ' + collectedFromUserId);
  return { success: true, transactionId: txId };
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
