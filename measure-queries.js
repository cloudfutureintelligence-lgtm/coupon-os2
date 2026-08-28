async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  const queries = {
    'sites': `${url}/sites?select=*&order=name`,
    'coupon_profiles': `${url}/coupon_profiles?select=*&order=name`,
    'users': `${url}/users?select=*&order=name`,
    'user_sites': `${url}/user_sites?select=*`,
    'site_prices': `${url}/site_prices?select=*`,
    'wallets': `${url}/wallets?select=*`,
    'coupons': `${url}/coupons?select=*&order=created_at.desc,id.desc&limit=1000`,
    'transactions': `${url}/transactions?select=*&order=timestamp.desc&limit=500`,
    'audit_logs': `${url}/audit_logs?select=*&order=timestamp.desc&limit=200`,
    'settings': `${url}/settings?select=*&limit=1`,
    'cash_collections': `${url}/cash_collections?select=*&order=timestamp.desc&limit=500`,
    'stock_counts': `${url}/rpc/coupon_stock_counts`
  };

  console.log('Measuring individual query latency...');
  for (const [name, queryUrl] of Object.entries(queries)) {
    const start = Date.now();
    try {
      const res = await fetch(queryUrl, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      const data = await res.json();
      const end = Date.now();
      console.log(`Query: ${name.padEnd(20)} | Time: ${(end - start).toString().padStart(5)}ms | Rows: ${data.length || 0}`);
    } catch (e) {
      console.error(`Error on ${name}:`, e.message);
    }
  }
}

run();
