const fs = require('fs');

async function downloadGeo() {
    const fetch = (await import('node-fetch')).default;

    console.log('Fetching new GeoJSON...');
    // A much more reliable map source for charting libraries
    const url = 'https://raw.githubusercontent.com/Acesmndr/nepal-geojson/master/simplified/nepal-districts.geojson';

    const resp = await fetch(url);
    const text = await resp.text();

    fs.writeFileSync('public/assets/nepal-districts.json', text);
    try {
        const obj = JSON.parse(text);
        console.log('Success, prop keys:', Object.keys(obj.features[0].properties));
        console.log('Sample name:', obj.features[0].properties.DISTRICT || obj.features[0].properties.name || obj.features[0].properties.district);
    } catch (e) {
        console.error('Invalid json');
    }
}
downloadGeo();
