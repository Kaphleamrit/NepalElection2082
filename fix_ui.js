const fs = require('fs');

let css = fs.readFileSync('public/index.css', 'utf8');
css = css.replace(/font-weight:\s*800;/g, 'font-weight: 600;');
css = css.replace(/font-weight:\s*700;/g, 'font-weight: 500;');
css = css.replace(/font-weight:\s*600;/g, 'font-weight: 400;');
css = css.replace(/font-weight:\s*bold;/g, 'font-weight: 500;');
fs.writeFileSync('public/index.css', css);
console.log('CSS fonts lightened.');

let appJs = fs.readFileSync('public/app.js', 'utf8');
appJs = appJs.replace(`distance: 90,`, `distance: 120, boxWidth: 100, boxHeight: 3, boxDepth: 60, regionHeight: 2,`);
appJs = appJs.replace(`minDistance: 40,`, `minDistance: 50,`);
appJs = appJs.replace(`maxDistance: 140,`, `maxDistance: 200,`);
appJs = appJs.replace(`alpha: 35,`, `alpha: 45,`);
fs.writeFileSync('public/app.js', appJs);
console.log('Map properties updated.');
