const fs = require('fs');
async function fetchHC() {
    const fetch = (await import('node-fetch')).default;
    const url = 'https://code.highcharts.com/mapdata/countries/np/np-all.geo.json';
    const res = await fetch(url);
    const json = await res.text();
    fs.writeFileSync('public/assets/nepal-districts.json', json);
    try {
        const obj = JSON.parse(json);
        console.log("Success, prop keys:", Object.keys(obj.features[0].properties));
        console.log("Sample name:", obj.features[0].properties.name);
    } catch (e) { console.error('still not json'); }
}
fetchHC();
