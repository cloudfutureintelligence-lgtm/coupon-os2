async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  const tables = ['sites', 'coupon_profiles', 'users', 'user_sites', 'site_prices', 'wallets', 'coupons', 'transactions', 'audit_logs', 'settings', 'cash_collections'];
  
  console.log('Checking database table counts...');
  for (const table of tables) {
    try {
      const res = await fetch(`${url}/${table}?select=count`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Prefer': 'count=exact,head=true'
        }
      });
      const countHeader = res.headers.get('content-range');
      console.log(`Table: ${table} - Count: ${countHeader ? countHeader.split('/')[1] : 'unknown'}`);
    } catch (e) {
      console.error(`Error on ${table}:`, e.message);
    }
  }
}

run();
