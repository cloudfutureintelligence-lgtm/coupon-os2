async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  // Test summing sale_price for sold coupons
  const queryUrl = `${url}/coupons?select=sale_price.sum(),cost.sum()&status=eq.Sold`;
  console.log('Fetching sum via PostgREST:', queryUrl);
  try {
    const res = await fetch(queryUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', json);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
