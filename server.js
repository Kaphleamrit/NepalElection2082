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

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🗳️  Nepal Election Dashboard running at http://localhost:${PORT}\n`);
});
