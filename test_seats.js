async function run() {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('http://localhost:3000/api/election-data');
    const data = await res.json();
    let e = 0, l = 0;
    data.partyResults.forEach(p => { e += p.elected; l += p.leading; });
    console.log(`Total Elected: ${e}, Total Leading: ${l}`);
}
run();
