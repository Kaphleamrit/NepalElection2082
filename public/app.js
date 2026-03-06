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
let idleTimeout = null;
let userIsActive = false;
let congratsShown = false;
const TAB_NAMES = ['constituencies', 'parties', 'provinces', 'interactive-map'];
let echarts3DMap = null;
let provinceChart = null;
let currentProvincesData = {};
let currentActiveProvince = '';
let geoJsonData = null;

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

    const tabEl = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (tabEl) tabEl.classList.add('active');

    const contentEl = document.getElementById(`tab-${tabName}`);
    if (contentEl) contentEl.classList.add('active');

    // Handle Echarts canvas resize trigger when shown
    if (tabName === 'interactive-map') {
        setTimeout(() => {
            if (echarts3DMap) echarts3DMap.resize();
            if (currentData) renderInteractiveMap(currentData);
        }, 50);
    }

    if (tabName === 'provinces') {
        setTimeout(() => {
            if (provinceChart) provinceChart.resize();
            if (currentActiveProvince) updateProvinceChart(currentActiveProvince);
        }, 50);
    }

    // Reset auto-rotation when user manually switches
    resetIdleTimer();
}

// ===== Auto Tab Rotation (DISCONTINUED per user request) =====
function startTabRotation() {
    // This feature has been disabled to prevent "annoying" automatic view switches.
}

function resetIdleTimer() {
    // Keep internal userIsActive tracking for potential future logic, but no auto-triggers.
}

// User activity listeners
['mousedown', 'keydown', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, () => { userIsActive = true; }, { passive: true });
});

// ===== Render Dashboard =====
function renderDashboard(data) {
    currentData = data;
    renderHeroStats(data);
    renderSeatDistribution(data);
    renderPartyGrid(data);
    renderConstituencies(data);
    renderProvinces(data);
    updateTimestamp(data);

    // Update map silently if already active
    if (document.getElementById('tab-interactive-map').classList.contains('active')) {
        renderInteractiveMap(data);
    }
    // Update province chart if active
    if (document.getElementById('tab-provinces').classList.contains('active') && currentActiveProvince) {
        updateProvinceChart(currentActiveProvince);
    }
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

    checkWinner(totalElected + totalLeading, leadingParty);
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

// ===== Winner Celebration & Confetti =====
function checkWinner(totalSeatsDecided, leadingParty) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceShow = urlParams.get('demo_winner') === 'true';

    // By default, triggers only if all 165 FPTP seats have been won or led
    if (!congratsShown && (totalSeatsDecided >= 165 || forceShow)) {
        congratsShown = true;
        showCongratsOverlay(leadingParty);
    }
}

function showCongratsOverlay(party) {
    const overlay = document.getElementById('congratsOverlay');
    document.getElementById('congratsPartyName').textContent = party.name || 'A Party';
    document.getElementById('congratsSeats').textContent = (party.elected || 0) + (party.leading || 0);
    document.getElementById('congratsPartyLogo').src = party.symbolUrl ? `/api/proxy-image?url=${encodeURIComponent(party.symbolUrl)}` : '';

    // Add glowing color based on party
    const color = PARTY_COLORS[party.name] || '#3b82f6';
    document.getElementById('congratsPartyName').style.textShadow = `0 0 20px ${color}88`; // 88 for alpha
    document.getElementById('congratsPartyLogo').style.boxShadow = `0 0 50px ${color}aa`;

    overlay.classList.add('show');
    startConfetti();
}

function closeCongrats() {
    document.getElementById('congratsOverlay').classList.remove('show');
    // We leave confetti running faintly in the background, or could clear it
}

// Simple Canvas Confetti
let confettiCtx;
let confettiParticles = [];
let confettiFrameId;

function startConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    confettiCtx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ffffff'];
    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 15 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 4 + 2,
            angle: Math.random() * 360,
            spin: Math.random() * 0.2 - 0.1
        });
    }
    renderConfetti();
}

function renderConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < confettiParticles.length; i++) {
        let p = confettiParticles[i];
        p.y += p.speed;
        p.angle += p.spin;
        if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
        }

        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.angle);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confettiCtx.restore();
    }
    confettiFrameId = requestAnimationFrame(renderConfetti);
}

window.addEventListener('resize', () => {
    const canvas = document.getElementById('confettiCanvas');
    if (canvas && confettiCtx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

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
                     src="${party.symbolUrl ? `/api/proxy-image?url=${encodeURIComponent(party.symbolUrl)}` : ''}" 
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
    currentProvincesData = provinces;
    const provinceNames = Object.keys(provinces);

    if (!currentActiveProvince && provinceNames.length > 0) {
        currentActiveProvince = provinceNames[0];
    }

    // Inject global Province Chart container exactly once
    if (!document.getElementById('globalProvinceChart')) {
        const chartWrapper = document.createElement('div');
        chartWrapper.id = 'globalProvinceChart';
        chartWrapper.style.width = '100%';
        chartWrapper.style.height = '350px';
        chartWrapper.style.marginBottom = '25px';
        chartWrapper.style.background = 'rgba(0,0,0,0.15)';
        chartWrapper.style.borderRadius = '16px';
        chartWrapper.style.padding = '15px';
        chartWrapper.style.border = '1px solid rgba(255,255,255,0.05)';
        document.getElementById('provinceTabs').after(chartWrapper);
    }

    // Render tabs
    tabsContainer.innerHTML = provinceNames.map((name) => `
        <button class="province-tab ${name === currentActiveProvince ? 'active' : ''}" 
                onclick="switchProvince('${name}')"
                data-province="${name}">
            ${name}
        </button>
    `).join('');

    // Render contents
    contentsContainer.innerHTML = provinceNames.map((name) => {
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
            <div class="province-content ${name === currentActiveProvince ? 'active' : ''}" id="province-${name}">
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
    currentActiveProvince = name;
    document.querySelectorAll('.province-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.province-content').forEach(t => t.classList.remove('active'));

    document.querySelector(`.province-tab[data-province="${name}"]`).classList.add('active');
    document.getElementById(`province-${name}`).classList.add('active');

    updateProvinceChart(name);
}

function updateProvinceChart(name) {
    const chartDiv = document.getElementById('globalProvinceChart');
    if (!chartDiv || !window.echarts) return;

    if (!provinceChart) {
        provinceChart = echarts.init(chartDiv);
        window.addEventListener('resize', () => { if (provinceChart) provinceChart.resize(); });
    }

    const parties = currentProvincesData[name] || [];
    if (parties.length === 0) {
        provinceChart.clear();
        return;
    }

    // Top 8 parties to keep chart clean, sorted descending so horizontal shows largest at top
    const sliced = parties.slice(0, 8).reverse();

    const labels = sliced.map(p => PARTY_SHORT[p.name] || p.name);
    const electedData = sliced.map(p => ({
        value: p.elected,
        itemStyle: { color: PARTY_COLORS[p.name] || '#3b82f6', borderRadius: [0, 4, 4, 0] }
    }));
    const leadingData = sliced.map(p => ({
        value: p.leading,
        itemStyle: {
            color: 'rgba(255,255,255,0.1)',
            borderColor: PARTY_COLORS[p.name] || '#3b82f6',
            borderWidth: 1.5,
            borderType: 'dashed',
            borderRadius: [0, 4, 4, 0]
        }
    }));

    provinceChart.setOption({
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(10, 14, 26, 0.9)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#fff', fontFamily: 'Outfit' }
        },
        grid: { left: '3%', right: '6%', bottom: '5%', top: '5%', containLabel: true },
        xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
            axisLabel: { color: '#94a3b8', fontFamily: 'Outfit' }
        },
        yAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: '#f1f5f9', fontWeight: 600, fontFamily: 'Outfit', fontSize: 13 },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [
            { name: 'Elected', type: 'bar', stack: 'total', data: electedData, label: { show: true, position: 'inside', color: '#fff', fontWeight: 600, formatter: (p) => p.value > 0 ? p.value : '' } },
            { name: 'Leading', type: 'bar', stack: 'total', data: leadingData, label: { show: true, position: 'right', color: '#a5b4fc', fontWeight: 600, formatter: (p) => p.value > 0 ? `+${p.value}` : '' } }
        ]
    }, true);
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
                         src="${c.photoUrl ? `/api/proxy-image?url=${encodeURIComponent(c.photoUrl)}` : ''}" 
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
});

// ===== Interactive 3D Map (ECharts GL) =====
async function renderInteractiveMap(data) {
    const mapContainer = document.getElementById('echartsMap');
    const mapLoader = document.getElementById('mapLoader');
    if (!mapContainer || !window.echarts) return;

    if (!echarts3DMap) {
        echarts3DMap = echarts.init(mapContainer);
        window.addEventListener('resize', () => { if (echarts3DMap) echarts3DMap.resize(); });
    }

    if (!geoJsonData) {
        mapLoader.style.display = 'block';
        try {
            const res = await fetch('assets/nepal-districts.json');
            geoJsonData = await res.json();
            echarts.registerMap('nepal', geoJsonData);
        } catch (err) {
            console.error('Failed to load map geojson', err);
            mapLoader.style.display = 'none';
            return;
        }
        mapLoader.style.display = 'none';
    }

    // Build map series data matching parsed districts with the constituency dataset
    const mapSeriesData = geoJsonData.features.map(f => {
        const dName = f.properties.DISTRICT || f.properties.name || '';

        // Find which party is leading in this district by checking string similarity with constituencies
        const districtConstituencies = data.constituencyResults.filter(c =>
            c.constituency.toUpperCase().includes(dName.toUpperCase()) ||
            dName.toUpperCase().includes(c.constituency.split('-')[0].toUpperCase())
        );

        let leadingParty = 'Unknown';
        let leaderColor = 'rgba(255,255,255, 0.1)';
        let winCount = 0;

        if (districtConstituencies.length > 0) {
            // Pick the most common leading party in this district block
            const tally = {};
            districtConstituencies.forEach(c => {
                if (c.leadingParty) tally[c.leadingParty] = (tally[c.leadingParty] || 0) + 1;
            });
            let max = 0;
            for (let p in tally) {
                if (tally[p] > max) { max = tally[p]; leadingParty = p; winCount = max; }
            }
            if (PARTY_COLORS[leadingParty]) leaderColor = PARTY_COLORS[leadingParty];
        }

        return {
            name: dName,
            value: winCount,
            leadingParty: leadingParty,
            itemStyle: {
                areaColor: leaderColor,
                opacity: 0.9
            }
        };
    });

    const option = {
        tooltip: {
            show: true,
            backgroundColor: 'rgba(10, 14, 26, 0.9)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#fff', fontFamily: 'Outfit' },
            formatter: (params) => {
                const lp = params.data?.leadingParty || 'Pending/Tied';
                const count = params.data?.value || 0;
                return `
                    <div style="font-weight:700; font-size:1.1em; margin-bottom:4px;">${params.name} District</div>
                    <div style="font-size:0.9em; display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.data?.itemStyle?.areaColor || '#fff'}"></span>
                        Leader: <strong style="color: ${params.data?.itemStyle?.areaColor || '#fff'}">${PARTY_SHORT[lp] || lp}</strong>
                    </div>
                `;
            }
        },
        series: [{
            type: 'map',
            map: 'nepal',
            roam: true,
            zoom: 1.2,
            itemStyle: {
                borderColor: 'rgba(255,255,255,0.4)',
                borderWidth: 0.8,
                areaColor: 'rgba(255,255,255, 0.05)',
                shadowColor: 'rgba(0, 0, 0, 0.5)',
                shadowOffsetX: 4,
                shadowOffsetY: 8,
                shadowBlur: 10
            },
            emphasis: {
                label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
                itemStyle: {
                    areaColor: '#f8fafc',
                    borderColor: '#fff',
                    borderWidth: 2,
                    shadowColor: 'rgba(255, 255, 255, 0.5)',
                    shadowBlur: 20
                }
            },
            select: {
                label: { show: true, color: '#fff' },
                itemStyle: { areaColor: '#3b82f6' }
            },
            data: mapSeriesData
        }]
    };

    echarts3DMap.setOption(option, true);
}
