// ===== Nepal Election 2082 Dashboard =====

const PARTY_COLORS = {
    'Rastriya Swatantra Party': '#10b981',
    'CPN-UML': '#3b82f6',
    'Nepali Congress': '#ef4444',
    'Nepali Communist Party': '#f59e0b',
    'Rastriya Prajatantra Party': '#8b5cf6',
    'Janata Samjbadi Party-Nepal': '#06b6d4',
    'Shram Sanskriti Party': '#f97316',
    'Nepal Communist Party (Maoist)': '#ec4899',
    'Ujaylo Nepal Party': '#14b8a6',
    'Rastriya Mukti Party Nepal (Ekal Chunab Chinha)': '#6366f1',
    'Janamat Party': '#a855f7',
    'Nagarik Unmukti Party': '#22d3ee',
    'CPN (Maoist Center)': '#f59e0b',
    'Janata Samajbadi Party': '#06b6d4',
    'CPN (Unified Socialist)': '#e879f9',
    'Loktantrik Samajwadi Party': '#fb923c',
    'Maoist Centre': '#f59e0b',
    'SSF': '#34d399',
    'RJP': '#fbbf24',
    'Others': '#64748b',
    'Independent': '#94a3b8'
};

const PARTY_SHORT = {
    'Rastriya Swatantra Party': 'RSP',
    'CPN-UML': 'UML',
    'Nepali Congress': 'NC',
    'Nepali Communist Party': 'NCP',
    'Rastriya Prajatantra Party': 'RPP',
    'Janata Samjbadi Party-Nepal': 'JSP-N',
    'Shram Sanskriti Party': 'SSP',
    'Nepal Communist Party (Maoist)': 'NCP-M',
    'Ujaylo Nepal Party': 'UNP',
    'Rastriya Mukti Party Nepal (Ekal Chunab Chinha)': 'RMPN',
    'Janamat Party': 'JP',
    'Nagarik Unmukti Party': 'NUP',
    'Others': 'OTH'
};

let currentData = null;
let autoRefreshInterval = null;
let tabRotationInterval = null;
let idleTimeout = null;
let userIsActive = false;
const TAB_NAMES = ['parties', 'constituencies', 'provinces'];

// ===== Data Fetching =====
async function fetchElectionData() {
    try {
        const response = await fetch('/api/election-data');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch election data:', error);
        throw error;
    }
}

// ===== Main App Init =====
async function initApp() {
    try {
        currentData = await fetchElectionData();
        renderDashboard(currentData);
        hideLoading();
        startAutoRefresh();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function hideLoading() {
    const screen = document.getElementById('loadingScreen');
    screen.classList.add('hidden');
    setTimeout(() => screen.remove(), 500);
}

function showError(message) {
    document.getElementById('mainContent').innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <div class="error-message">Failed to load election data.<br><small>${message}</small></div>
            <button class="error-btn" onclick="location.reload()">Try Again</button>
        </div>
    `;
}

// ===== Auto Refresh =====
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        try {
            const data = await fetchElectionData();
            currentData = data;
            renderDashboard(data);
        } catch (e) {
            console.warn('Auto-refresh failed:', e);
        }
    }, 15000); // Refresh every 15 seconds for near-realtime
}

async function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    btn.disabled = true;

    try {
        currentData = await fetchElectionData();
        renderDashboard(currentData);
    } catch (e) {
        console.error('Refresh failed:', e);
    } finally {
        btn.classList.remove('spinning');
        btn.disabled = false;
    }
}

// ===== Tab Switching =====
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`.nav-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Reset auto-rotation when user manually switches
    resetIdleTimer();
}

// ===== Auto Tab Rotation =====
function startTabRotation() {
    if (tabRotationInterval) clearInterval(tabRotationInterval);
    tabRotationInterval = setInterval(() => {
        if (userIsActive) return; // Skip if user is interacting
        const activeTab = document.querySelector('.nav-tab.active');
        const currentIdx = TAB_NAMES.indexOf(activeTab?.dataset?.tab || 'parties');
        const nextIdx = (currentIdx + 1) % TAB_NAMES.length;
        switchTab(TAB_NAMES[nextIdx]);
    }, 10000);
}

function resetIdleTimer() {
    userIsActive = true;
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        userIsActive = false;
    }, 10000); // Resume rotation after 10s of inactivity
}

// Listen for user activity
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// ===== Render Dashboard =====
function renderDashboard(data) {
    renderHeroStats(data);
    renderSeatDistribution(data);
    renderPartyGrid(data);
    renderConstituencies(data);
    renderProvinces(data);
    updateTimestamp(data);
}

// ===== Hero Stats =====
function renderHeroStats(data) {
    const parties = data.partyResults || [];

    // Total elected & leading
    let totalElected = 0;
    let totalLeading = 0;
    let leadingParty = { name: '--', leading: 0, elected: 0 };

    parties.forEach(p => {
        totalElected += p.elected || 0;
        totalLeading += p.leading || 0;
        if ((p.elected + p.leading) > (leadingParty.elected + leadingParty.leading)) {
            leadingParty = p;
        }
    });

    document.getElementById('totalElected').textContent = totalElected;
    document.getElementById('leadingPartySeats').textContent =
        (leadingParty.elected + leadingParty.leading);
    document.getElementById('leadingPartyName').textContent =
        PARTY_SHORT[leadingParty.name] || leadingParty.name;
    document.getElementById('totalPartiesCount').textContent = data.totalParties || 67;
}

// ===== Seat Distribution Bar =====
function renderSeatDistribution(data) {
    const container = document.getElementById('seatDistribution');
    const legend = document.getElementById('seatLegend');
    const parties = (data.partyResults || []).filter(p => (p.elected + p.leading) > 0);
    const totalSeats = 165;

    // Sort by total seats
    parties.sort((a, b) => (b.elected + b.leading) - (a.elected + a.leading));

    let html = '';
    let legendHtml = '';

    parties.forEach((party, i) => {
        const total = party.elected + party.leading;
        const pct = (total / totalSeats) * 100;
        const color = PARTY_COLORS[party.name] || '#64748b';
        const short = PARTY_SHORT[party.name] || party.name;

        html += `
            <div class="seat-segment" style="width: ${pct}%; background: ${color};" title="${party.name}: ${total} seats">
                <div class="tooltip"><strong>${short}</strong>: ${total} seats (${pct.toFixed(1)}%)</div>
            </div>
        `;

        legendHtml += `
            <div class="legend-item">
                <div class="legend-dot" style="background: ${color};"></div>
                <span>${short}: ${total}</span>
            </div>
        `;
    });

    // Remaining (undecided)
    const decided = parties.reduce((s, p) => s + p.elected + p.leading, 0);
    const remaining = totalSeats - decided;
    if (remaining > 0) {
        const pct = (remaining / totalSeats) * 100;
        html += `
            <div class="seat-segment" style="width: ${pct}%; background: rgba(255,255,255,0.05);">
                <div class="tooltip">Undecided: ${remaining} seats</div>
            </div>
        `;
        legendHtml += `
            <div class="legend-item">
                <div class="legend-dot" style="background: rgba(255,255,255,0.15);"></div>
                <span>Undecided: ${remaining}</span>
            </div>
        `;
    }

    container.innerHTML = html;
    legend.innerHTML = legendHtml;
}

// ===== Party Grid =====
function renderPartyGrid(data) {
    const grid = document.getElementById('partyGrid');
    const parties = data.partyResults || [];

    // Sort: leading/elected parties first
    const sorted = [...parties].sort((a, b) =>
        (b.elected + b.leading) - (a.elected + a.leading)
    );

    grid.innerHTML = sorted.map(party => {
        const isLeading = (party.elected + party.leading) > 0;
        return `
            <div class="party-card ${isLeading ? 'leading' : ''}" id="party-${party.id}">
                <img class="party-logo" 
                     src="${party.symbolUrl}" 
                     alt="${party.name}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23222%22 width=%2240%22 height=%2240%22 rx=%224%22/><text x=%2250%%22 y=%2255%%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2212%22>🏛️</text></svg>'">
                <div class="party-info">
                    <div class="party-name" title="${party.name}">${party.name}</div>
                    <div class="party-short">${PARTY_SHORT[party.name] || ''}</div>
                </div>
                <div class="party-stats">
                    <div class="party-stat-box elected">
                        <div class="party-stat-label">Won</div>
                        <div class="party-stat-value">${party.elected}</div>
                    </div>
                    <div class="party-stat-box leading">
                        <div class="party-stat-label">Lead</div>
                        <div class="party-stat-value">${party.leading}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Candidates =====
function renderCandidates(data) {
    const grid = document.getElementById('candidatesGrid');
    const candidates = data.popularCandidates || [];

    // Sort by votes desc
    const sorted = [...candidates].sort((a, b) => b.votes - a.votes);

    grid.innerHTML = sorted.map(candidate => {
        const color = PARTY_COLORS[candidate.party] || '#64748b';
        const voteStr = candidate.votes > 0 ? candidate.votes.toLocaleString() : 'Awaiting';

        return `
            <div class="candidate-card">
                <div class="candidate-top">
                    <img class="candidate-photo" 
                         src="${candidate.photoUrl}" 
                         alt="${candidate.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22><circle fill=%22%23222%22 cx=%2226%22 cy=%2226%22 r=%2226%22/><text x=%2250%%22 y=%2258%%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2218%22>👤</text></svg>'">
                    <div class="candidate-meta">
                        <div class="candidate-name">${candidate.name}</div>
                        <div class="candidate-constituency">${candidate.constituency || 'N/A'}</div>
                        <div class="candidate-party">
                            <span class="candidate-party-dot" style="background: ${color};"></span>
                            ${candidate.party || 'Independent'}
                        </div>
                    </div>
                    <div class="candidate-votes">
                        <div class="candidate-vote-count ${candidate.votes > 0 ? '' : 'text-muted'}">${voteStr}</div>
                        <div class="candidate-vote-label">votes</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===== Province Results =====
function renderProvinces(data) {
    const tabsContainer = document.getElementById('provinceTabs');
    const contentsContainer = document.getElementById('provinceContents');
    const provinces = data.provinceResults || {};
    const provinceNames = Object.keys(provinces);

    // Render tabs
    tabsContainer.innerHTML = provinceNames.map((name, i) => `
        <button class="province-tab ${i === 0 ? 'active' : ''}" 
                onclick="switchProvince('${name}')"
                data-province="${name}">
            ${name}
        </button>
    `).join('');

    // Render contents
    contentsContainer.innerHTML = provinceNames.map((name, i) => {
        const parties = provinces[name] || [];

        let tableRows = '';
        if (parties.length === 0) {
            tableRows = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 30px;">No results available yet</td></tr>`;
        } else {
            tableRows = parties.map(p => {
                const color = PARTY_COLORS[p.name] || '#64748b';
                return `
                    <tr>
                        <td>
                            <div class="party-cell">
                                <div style="width:4px; height:28px; border-radius:2px; background:${color}; flex-shrink:0;"></div>
                                ${p.name}
                            </div>
                        </td>
                        <td class="num-cell text-emerald">${p.elected}</td>
                        <td class="num-cell text-blue">${p.leading}</td>
                        <td class="num-cell" style="font-weight:700;">${p.elected + p.leading}</td>
                    </tr>
                `;
            }).join('');
        }

        return `
            <div class="province-content ${i === 0 ? 'active' : ''}" id="province-${name}">
                <table class="province-table">
                    <thead>
                        <tr>
                            <th>Party</th>
                            <th>Elected</th>
                            <th>Leading</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }).join('');
}

function switchProvince(name) {
    document.querySelectorAll('.province-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.province-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`.province-tab[data-province="${name}"]`).classList.add('active');
    document.getElementById(`province-${name}`).classList.add('active');
}

// ===== Proportional Results =====
function renderProportional(data) {
    renderProportionalBars('proportional2082', data.proportionalResults || [], '2082');
    renderProportionalBars('proportional2079', data.proportionalResults2079 || [], '2079');
}

function renderProportionalBars(containerId, results, year) {
    const container = document.getElementById(containerId);
    if (!results.length) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No data available</p>';
        return;
    }

    const maxVotes = Math.max(...results.map(r => r.votes));
    const totalVotes = results.reduce((s, r) => s + r.votes, 0);

    // Show top 10 only for cleanliness
    const topResults = results.slice(0, 10);

    container.innerHTML = topResults.map((result, i) => {
        const pct = (result.votes / maxVotes) * 100;
        const votePct = ((result.votes / totalVotes) * 100).toFixed(1);
        const color = PARTY_COLORS[result.name] || `hsl(${i * 36}, 60%, 55%)`;
        const colorIdx = i % 10;

        return `
            <div class="proportional-bar-container">
                <div class="proportional-bar-header">
                    <span class="proportional-party-name">${result.name}</span>
                    <span class="proportional-vote-count">${result.votes.toLocaleString()} (${votePct}%)</span>
                </div>
                <div class="proportional-bar-track">
                    <div class="proportional-bar-fill bar-color-${colorIdx}" 
                         style="width: 0%;"
                         data-target-width="${pct}%">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Animate bars
    requestAnimationFrame(() => {
        setTimeout(() => {
            container.querySelectorAll('.proportional-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.targetWidth;
            });
        }, 100);
    });
}

// ===== Timestamp (Nepal Time UTC+5:45) =====
function updateTimestamp(data) {
    const el = document.getElementById('lastUpdated');
    if (data.timestamp) {
        const date = new Date(data.timestamp);
        const nepalTime = date.toLocaleString('en-US', {
            timeZone: 'Asia/Kathmandu',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        el.textContent = `Updated: ${nepalTime} NPT`;
    }
}

// ===== Number Animation =====
function animateNumber(element, target, duration = 1000) {
    const start = parseInt(element.textContent) || 0;
    if (start === target) return;

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        const current = Math.round(start + (target - start) * eased);
        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ===== Constituency Battle =====
let currentFilter = 'all';

function renderConstituencies(data) {
    const grid = document.getElementById('constituencyGrid');
    const results = data.constituencyResults || [];

    if (results.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px;">Loading constituency data...</div>';
        return;
    }

    // Sort: constituencies with votes first, then alphabetically
    const sorted = [...results].sort((a, b) => {
        const aMaxVotes = Math.max(...a.candidates.map(c => c.votes));
        const bMaxVotes = Math.max(...b.candidates.map(c => c.votes));
        if (aMaxVotes > 0 && bMaxVotes === 0) return -1;
        if (aMaxVotes === 0 && bMaxVotes > 0) return 1;
        if (aMaxVotes > 0 && bMaxVotes > 0) return bMaxVotes - aMaxVotes;
        return a.constituency.localeCompare(b.constituency);
    });

    grid.innerHTML = sorted.map(result => {
        const maxVotes = Math.max(...result.candidates.map(c => c.votes));
        const totalVotes = result.candidates.reduce((s, c) => s + c.votes, 0);
        const hasVotes = totalVotes > 0;
        const status = hasVotes ? 'counting' : 'pending';

        // Sort candidates by votes descending
        const sortedCandidates = [...result.candidates].sort((a, b) => b.votes - a.votes);

        // Calculate lead margin
        let leadMargin = '';
        if (sortedCandidates.length >= 2 && sortedCandidates[0].votes > 0) {
            const margin = sortedCandidates[0].votes - sortedCandidates[1].votes;
            if (margin > 0) {
                leadMargin = `<span class="constituency-lead">↑ ${margin.toLocaleString()} lead</span>`;
            }
        }

        const candidateRows = sortedCandidates.map((c, idx) => {
            const color = PARTY_COLORS[c.party] || '#64748b';
            const barWidth = maxVotes > 0 ? (c.votes / maxVotes * 100) : 0;
            const voteStr = c.votes > 0 ? c.votes.toLocaleString() : '—';
            const shortParty = PARTY_SHORT[c.party] || c.party || 'IND';

            return `
                <div class="candidate-row" data-candidate="${c.name.toLowerCase()}">
                    <div class="candidate-rank ${idx === 0 && hasVotes ? 'rank-1' : ''}">${idx + 1}</div>
                    <img class="candidate-row-photo" 
                         src="${c.photoUrl}" 
                         alt="${c.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><circle fill=%22%23222%22 cx=%2216%22 cy=%2216%22 r=%2216%22/><text x=%2250%%22 y=%2260%%22 text-anchor=%22middle%22 fill=%22%23555%22 font-size=%2212%22>👤</text></svg>'">
                    <div class="candidate-row-info">
                        <div class="candidate-row-name">${c.name}</div>
                        <div class="candidate-row-party">
                            <span class="party-color-dot" style="background:${color}"></span>
                            ${shortParty}
                        </div>
                    </div>
                    <div class="candidate-row-votes" style="color:${idx === 0 && hasVotes ? 'var(--accent-emerald)' : 'var(--text-secondary)'}">
                        ${voteStr}
                    </div>
                    <div class="candidate-bar-container">
                        <div class="candidate-bar" style="width:${barWidth}%; background:${color};" data-target-width="${barWidth}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="constituency-card ${hasVotes ? 'has-votes' : 'no-votes'}" 
                 data-status="${status}" 
                 data-constituency="${result.constituency.toLowerCase()}">
                <div class="constituency-header">
                    <div>
                        <div class="constituency-name">${result.constituency}</div>
                        <div class="constituency-district">${result.district || ''}</div>
                    </div>
                    <div class="constituency-status ${status}">
                        ${hasVotes ? '● Counting' : '⏳ Pending'}
                    </div>
                </div>
                ${candidateRows}
                <div class="constituency-total-votes">
                    <span>Total Votes: <span class="total-num">${totalVotes > 0 ? totalVotes.toLocaleString() : '—'}</span></span>
                    ${leadMargin}
                </div>
            </div>
        `;
    }).join('');
}

function filterConstituencies() {
    const query = document.getElementById('constituencySearch').value.toLowerCase();
    const cards = document.querySelectorAll('.constituency-card');

    cards.forEach(card => {
        const constituency = card.dataset.constituency || '';
        const status = card.dataset.status || '';
        const candidateNames = Array.from(card.querySelectorAll('.candidate-row-name')).map(el => el.textContent.toLowerCase()).join(' ');

        const matchesSearch = !query || constituency.includes(query) || candidateNames.includes(query);
        const matchesFilter = currentFilter === 'all' || status === currentFilter;

        card.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
    });
}

function filterByStatus(status) {
    currentFilter = status;

    // Update active pill
    document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
    event.target.classList.add('active');

    filterConstituencies();
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    startTabRotation();
});
