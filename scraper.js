const cheerio = require('cheerio');

const BASE_URL = 'https://election.ekantipur.com';

async function fetchPage(url) {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    });
    return await res.text();
}

function parseNumber(str) {
    if (!str) return 0;
    return parseInt(String(str).replace(/,/g, '').trim()) || 0;
}

async function scrapeElectionData() {
    console.log('🗳️  Scraping Nepal Election 2082 data...');
    const html = await fetchPage(BASE_URL + '/?lng=eng');
    const $ = cheerio.load(html);

    const data = {
        timestamp: new Date().toISOString(),
        title: 'Federal Parliament Election 2082',
        totalParties: 67,
        partyResults: [],
        popularCandidates: [],
        constituencyResults: [],
        provinceResults: {}
    };

    // ---- Party-wise Results ----
    var partyMap = new Map();
    var partyLogos = {};

    $('img[src*="/parties/"]').each(function () {
        var src = $(this).attr('src');
        if (src) {
            var href = $(this).closest('a').attr('href') || '';
            var match = href.match(/\/party\/(\d+)/);
            if (match) partyLogos[match[1]] = src;
        }
    });

    $('a[href*="/party/"]').each(function () {
        var href = $(this).attr('href') || '';
        var text = $(this).text().trim();

        var partyMatch = href.match(/\/party\/(\d+)\?/);
        if (partyMatch && text && href.indexOf('/elected') === -1 && href.indexOf('/leading') === -1) {
            var partyId = partyMatch[1];
            if (!partyMap.has(partyId)) {
                partyMap.set(partyId, {
                    id: partyId,
                    name: text,
                    elected: 0,
                    leading: 0,
                    symbolUrl: partyLogos[partyId] || ''
                });
            } else if (!partyMap.get(partyId).symbolUrl && partyLogos[partyId]) {
                partyMap.get(partyId).symbolUrl = partyLogos[partyId];
            }
        }

        var electedMatch = href.match(/\/party\/(\d+)\/elected/);
        if (electedMatch) {
            var pid = electedMatch[1];
            var count = parseInt(text) || 0;
            if (partyMap.has(pid) && partyMap.get(pid).elected === 0) {
                partyMap.get(pid).elected = count;
            }
        }

        var leadingMatch = href.match(/\/party\/(\d+)\/leading/);
        if (leadingMatch) {
            var pid2 = leadingMatch[1];
            var count2 = parseInt(text) || 0;
            if (partyMap.has(pid2) && partyMap.get(pid2).leading === 0) {
                partyMap.get(pid2).leading = count2;
            }
        }
    });

    var mainPartyIds = ['7', '2', '9', '1', '3', '6', '11', '12', '13', '17', '22', '36', '99'];
    for (var pi = 0; pi < mainPartyIds.length; pi++) {
        if (partyMap.has(mainPartyIds[pi])) {
            data.partyResults.push(partyMap.get(mainPartyIds[pi]));
        }
    }

    // ---- Popular Candidates ----
    // Each card is in .popular-candidate-card-wrapper
    // Contains: constituency link, h5 with featured name, vote-count divs, profile links, party links
    //
    // DOM structure per card:
    //   allProfiles[0] = featured candidate (hero area, from h5's parent <a>)
    //   allProfiles[1] = 1st listed candidate (list section)
    //   allProfiles[2] = 2nd listed candidate
    //   allProfiles[3] = 3rd listed candidate
    //
    //   voteCounts[0] = featured candidate's total (big number)
    //   voteCounts[1] = 1st listed candidate's votes
    //   voteCounts[2] = 2nd listed candidate's votes
    //   voteCounts[3] = 3rd listed candidate's votes
    //
    //   parties[0] = 1st listed candidate's party
    //   parties[1] = 2nd listed candidate's party
    //   parties[2] = 3rd listed candidate's party
    //
    //   NOTE: allProfiles[0] (featured) is the SAME person as one of allProfiles[1..3]

    $('.popular-candidate-card-wrapper').each(function () {
        var card = $(this);
        var constituency = card.find('a[href*="/constituency-"]').first().text().trim();

        // Collect vote counts
        var voteCounts = [];
        card.find('.vote-count p').each(function () {
            voteCounts.push(parseNumber($(this).text()));
        });

        // Collect ALL profile links in DOM order (including duplicates)
        var allProfiles = [];
        card.find('a[href*="/profile/"]').each(function () {
            var href = $(this).attr('href') || '';
            var name = $(this).text().trim();
            var idMatch = href.match(/\/profile\/(\d+)/);
            if (idMatch && name.length > 1) {
                allProfiles.push({ id: idMatch[1], name: name });
            }
        });

        // Collect party names (3 parties for the 3 listed candidates)
        var partyNames = [];
        card.find('a[href*="/party/"]').each(function () {
            var name = $(this).text().trim();
            if (name.length > 1) partyNames.push(name);
        });

        // Build candidate entries from the LIST section (indices 1, 2, 3)
        // These map directly: allProfiles[i] + partyNames[i-1] + voteCounts[i]
        var seenIds = {};
        for (var i = 1; i <= 3 && i < allProfiles.length; i++) {
            var profile = allProfiles[i];
            if (seenIds[profile.id]) continue; // skip if already seen
            seenIds[profile.id] = true;

            data.popularCandidates.push({
                name: profile.name,
                constituency: constituency,
                party: partyNames[i - 1] || '',
                votes: (voteCounts[i] !== undefined) ? voteCounts[i] : 0,
                profileUrl: BASE_URL + '/profile/' + profile.id + '?lng=eng',
                photoUrl: 'https://assets-generalelection2082.ekantipur.com/candidates/candidate-' + profile.id + '.png'
            });
        }
    });

    // ---- Constituency-wise Vote Comparisons ----
    // Scrape the full popular-candidates page which lists ALL constituencies
    console.log('📊 Scraping constituency-level data...');
    var popHtml = await fetchPage(BASE_URL + '/popular-candidates?lng=eng');
    var $pop = cheerio.load(popHtml);

    $pop('.popular-candidate-card-wrapper').each(function () {
        var card = $pop(this);
        var constituency = card.find('a[href*="/constituency-"]').first().text().trim();
        if (!constituency) return;

        // Extract constituency URL for province info
        var constHref = card.find('a[href*="/constituency-"]').first().attr('href') || '';
        var provinceMatch = constHref.match(/\/(pradesh-\d+)\/district-(\w+)/);
        var province = provinceMatch ? provinceMatch[1].replace('pradesh-', 'Province ') : '';
        var district = provinceMatch ? provinceMatch[2].replace(/([A-Z])/g, ' $1').trim() : '';
        // Capitalize first letter of district
        district = district.charAt(0).toUpperCase() + district.slice(1);

        var voteCounts = [];
        card.find('.vote-count p').each(function () {
            voteCounts.push(parseNumber($pop(this).text()));
        });

        // Scrape actual candidate photo URLs from <img> elements
        var candidateImgs = [];
        card.find('img[src*="/candidates/"]').each(function () {
            var src = $pop(this).attr('src') || '';
            if (candidateImgs.indexOf(src) === -1) {
                candidateImgs.push(src);
            }
        });

        var allProfiles = [];
        card.find('a[href*="/profile/"]').each(function () {
            var href = $pop(this).attr('href') || '';
            var name = $pop(this).text().trim();
            var idMatch = href.match(/\/profile\/(\d+)/);
            if (idMatch && name.length > 1) {
                allProfiles.push({ id: idMatch[1], name: name });
            }
        });

        // Deduplicate profiles
        var uniqueProfiles = [];
        var seenProfileIds = {};
        for (var pi = 0; pi < allProfiles.length; pi++) {
            if (!seenProfileIds[allProfiles[pi].id]) {
                seenProfileIds[allProfiles[pi].id] = true;
                uniqueProfiles.push(allProfiles[pi]);
            }
        }

        var partyNames2 = [];
        card.find('a[href*="/party/"]').each(function () {
            var name = $pop(this).text().trim();
            if (name.length > 1) partyNames2.push(name);
        });

        var candidates = [];
        for (var j = 0; j < uniqueProfiles.length && j < 3; j++) {
            var p = uniqueProfiles[j];
            candidates.push({
                name: p.name,
                party: partyNames2[j] || '',
                votes: (voteCounts[j + 1] !== undefined) ? voteCounts[j + 1] : 0,
                photoUrl: candidateImgs[j] || ''
            });
        }

        if (candidates.length > 0) {
            data.constituencyResults.push({
                constituency: constituency,
                province: province,
                district: district,
                candidates: candidates
            });
        }
    });

    console.log('📊 Scraped ' + data.constituencyResults.length + ' constituencies');

    // ---- Province Results (DOM-based) ----
    // Each province is in a .result-table div with province name in .first-col
    $('.result-table').each(function () {
        var table = $(this);
        var provinceName = table.find('.first-col').first().text().trim();
        if (!provinceName) return;

        var provinceParties = [];
        var pMap = {};

        table.find('a[href*="/party/"]').each(function () {
            var href = $(this).attr('href') || '';
            var text = $(this).text().trim();

            var partyNameMatch = href.match(/\/party\/(\d+)\?/);
            if (partyNameMatch && text && href.indexOf('/elected') === -1 && href.indexOf('/leading') === -1) {
                var pid = partyNameMatch[1];
                if (!pMap[pid]) {
                    pMap[pid] = { id: pid, name: text, elected: 0, leading: 0 };
                }
            }

            var elMatch = href.match(/\/party\/(\d+)\/elected/);
            if (elMatch && pMap[elMatch[1]]) {
                pMap[elMatch[1]].elected = parseInt(text) || 0;
            }

            var ldMatch = href.match(/\/party\/(\d+)\/leading/);
            if (ldMatch && pMap[ldMatch[1]]) {
                pMap[ldMatch[1]].leading = parseInt(text) || 0;
            }
        });

        Object.keys(pMap).forEach(function (key) {
            provinceParties.push(pMap[key]);
        });

        provinceParties.sort(function (a, b) {
            return (b.elected + b.leading) - (a.elected + a.leading);
        });

        data.provinceResults[provinceName] = provinceParties;
    });

    console.log('✅ Scraped ' + data.partyResults.length + ' parties, ' + data.constituencyResults.length + ' constituencies, ' + Object.keys(data.provinceResults).length + ' provinces');
    return data;
}

module.exports = { scrapeElectionData };
