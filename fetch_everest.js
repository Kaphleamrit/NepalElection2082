const fs = require('fs');

async function downloadEverest() {
    const fetch = (await import('node-fetch')).default;

    console.log('Fetching Mt Everest image...');
    const url = 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Mount_Everest_as_seen_from_Drukair2_PLW_edit.jpg';

    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();

    fs.writeFileSync('public/assets/everest.jpg', Buffer.from(buffer));
    console.log('Saved to public/assets/everest.jpg');
}

downloadEverest().catch(console.error);
