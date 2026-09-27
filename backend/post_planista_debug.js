(async ()=>{
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    const body = { selectedSemesters: ['4'], debug: true };
    const res = await fetch('http://localhost:5000/api/planista/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json();
    console.log('status', res.status);
    console.log(JSON.stringify(j, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
