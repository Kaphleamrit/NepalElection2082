const fs = require('fs');
async function fetchG() {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('https://raw.githubusercontent.com/Acesmndr/nepal-geojson/master/generated-geojson/nepal-districts.geojson');
    const json = await res.text();
    fs.writeFileSync('public/assets/nepal-districts.json', json);
    try {
        const obj = JSON.parse(json);
        console.log("Success, prop keys:", Object.keys(obj.features[0].properties));
        console.log("Sample name:", obj.features[0].properties.DISTRICT || obj.features[0].properties.name);
    } catch (e) { console.error('still not json'); }
}
fetchG();
