async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  const queryUrl = `${url}/coupons?select=sale_price,cost,sold_at,site_id,profile_id,sold_by_user_id&status=eq.Sold`;
  console.log('Fetching sold coupons data from:', queryUrl);
  const start = Date.now();
  try {
    const res = await fetch(queryUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    const end = Date.now();
    console.log(`Fetch took ${end - start}ms. Returned ${data.length} rows.`);
    if (data.length > 0) {
      console.log('First row sample:', data[0]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
