async function run() {
  const url = 'https://zreowomhxdepihnohmce.supabase.co/rest/v1/';
  const key = 'sb_publishable_iRzuLHeNoPunGL0lfDUQuQ_jEpA09V5';
  
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('Status:', res.status);
    const spec = await res.json();
    console.log('Keys of spec:', Object.keys(spec));
    if (spec.paths) {
      console.log('Paths:', Object.keys(spec.paths).filter(p => p.startsWith('/rpc/')));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
