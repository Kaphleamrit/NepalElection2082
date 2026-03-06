const express = require('express');
const path = require('path');
const { scrapeElectionData } = require('./scraper');

const app = express();
const PORT = 3000;

// Cache data with TTL
let cachedData = null;
let lastFetch = 0;
const CACHE_TTL = 15 * 1000; // 15 second cache for near-realtime updates

app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for election data
app.get('/api/election-data', async (req, res) => {
    try {
        const now = Date.now();
        if (!cachedData || (now - lastFetch > CACHE_TTL)) {
            console.log('Fetching fresh data...');
            cachedData = await scrapeElectionData();
            lastFetch = now;
        } else {
            console.log('Serving cached data...');
        }
        res.json(cachedData);
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to fetch election data', details: error.message });
    }
});

// Image proxy to bypass CORB
app.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl || !imageUrl.startsWith('http')) {
            return res.status(400).send('Invalid generic URL');
        }

        const fetch = (await import('node-fetch')).default;
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://election.ekantipur.com/'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send('Image fetch failed');
        }

        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        response.body.pipe(res);
    } catch (error) {
        console.error('Image proxy error for ' + req.query.url + ':', error.message);
        res.status(500).send('Proxy error');
    }
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🗳️  Nepal Election Dashboard running at http://localhost:${PORT}\n`);
});
