async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1/sites?select=*';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  console.log('Sending request to', url);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Data count:', json.length);
    console.log('Data:', json);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

run();
