const fs = require('fs');
async function run() {
    const fetch = (await import('node-fetch')).default;
    const flagHtml = await fetch('https://upload.wikimedia.org/wikipedia/commons/9/9b/Flag_of_Nepal.svg').then(r => r.text());
    console.log(flagHtml.substring(0, 500));
}
run();
