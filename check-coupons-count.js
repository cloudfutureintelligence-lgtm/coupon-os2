async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  try {
    console.log('Fetching coupons count...');
    const res = await fetch(`${url}/coupons`, {
      method: 'HEAD',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'count=exact'
      }
    });
    console.log('Status:', res.status);
    const countHeader = res.headers.get('content-range');
    console.log('Content-Range:', countHeader);
    if (countHeader) {
      console.log('Coupons count:', countHeader.split('/')[1]);
    } else {
      console.log('Content-Range header missing');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
