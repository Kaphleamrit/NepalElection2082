const fs = require('fs');
async function fetchG() {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts.geojson');
    const json = await res.text();
    fs.writeFileSync('public/assets/nepal-districts.json', json);
}
fetchG();
