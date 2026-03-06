const fs = require('fs');
const rewind = require('@turf/rewind').default;

const geojson = JSON.parse(fs.readFileSync('public/assets/nepal-districts.json', 'utf8'));
const rewound = rewind(geojson, { mutate: true }); // standard RFC 7946 winding
fs.writeFileSync('public/assets/nepal-districts.json', JSON.stringify(rewound));
console.log('Rewound GeoJSON standard successfully');
