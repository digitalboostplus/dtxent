// Scrape Log - View scraping activity history
import { db, auth } from '../js/firebase-config.js';
import { requireAdminAccess, signOut } from '../js/auth.js';
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const adminApp = document.getElementById('admin-app');
const adminEmail = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const logEntries = document.getElementById('log-entries');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');

// Stats elements
const statLastScrape = document.getElementById('stat-last-scrape');
const statTotalRuns = document.getElementById('stat-total-runs');
const statEventsPosted = document.getElementById('stat-events-posted');
const statErrors = document.getElementById('stat-errors');

let logs = [];

// Initialize
async function init() {
    try {
        const user = await requireAdminAccess('/admin/login.html');
        adminEmail.textContent = user.email;
        loadingOverlay.style.display = 'none';
        adminApp.style.display = 'flex';
        await loadLogs();
        setupEventListeners();
    } catch (error) {
        console.error('Auth error:', error);
        loadingOverlay.style.display = 'none';
    }
}

function setupEventListeners() {
    logoutBtn.addEventListener('click', () => signOut('/admin/login.html'));
    refreshBtn.addEventListener('click', loadLogs);
}

async function loadLogs() {
    try {
        const q = query(
            collection(db, 'scrape_logs'),
            orderBy('scrapedAt', 'desc'),
            limit(50)
        );
        const snapshot = await getDocs(q);
        logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStats();
        renderLogs();
    } catch (error) {
        console.error('Error loading scrape logs:', error);
        showToast('Failed to load scrape logs', 'error');
    }
}

function renderStats() {
    statTotalRuns.textContent = logs.length;

    if (logs.length > 0) {
        const latest = logs[0];

        // Last scrape time
        if (latest.scrapedAt && latest.scrapedAt.toDate) {
            statLastScrape.textContent = formatRelativeTime(latest.scrapedAt.toDate());
        } else {
            statLastScrape.textContent = '--';
        }

        // Total events posted across all runs
        const totalPosted = logs.reduce((sum, log) => {
            return sum + (log.summary?.totalEventsPosted || 0);
        }, 0);
        statEventsPosted.textContent = totalPosted;

        // Total errors across all runs
        const totalErrors = logs.reduce((sum, log) => {
            return sum + (log.summary?.totalErrors || 0);
        }, 0);
        statErrors.textContent = totalErrors;
    } else {
        statLastScrape.textContent = '--';
        statEventsPosted.textContent = '0';
        statErrors.textContent = '0';
    }
}

function renderLogs() {
    if (logs.length === 0) {
        logEntries.innerHTML = '';
        emptyState.style.display = '';
        return;
    }

    emptyState.style.display = 'none';
    logEntries.innerHTML = logs.map(renderLogCard).join('');

    // Add click listeners for expand/collapse
    logEntries.querySelectorAll('.scrape-log-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.scrape-log-card').classList.toggle('expanded');
        });
    });
}

function renderLogCard(log) {
    const timestamp = log.scrapedAt?.toDate
        ? formatDateTime(log.scrapedAt.toDate())
        : 'Unknown';

    const sourceBadges = (log.sources || []).map(s => {
        const statusClass = s.status === 'success' ? s.name : 'error';
        const count = s.eventsFound || 0;
        return `<span class="source-badge ${statusClass}" title="${s.status === 'error' ? s.errorMessage : ''}">${s.name} (${count})</span>`;
    }).join('');

    const summary = log.summary || {};
    const events = log.events || [];

    const eventsTableRows = events.map(e => {
        const postedClass = e.postedToSite ? 'yes' : 'no';
        const postedText = e.postedToSite ? 'Yes' : 'No';
        const eventDate = e.eventDate ? formatEventDate(e.eventDate) : '--';
        return `<tr>
            <td>${escapeHtml(e.artistName)}</td>
            <td>${escapeHtml(e.eventName)}</td>
            <td>${eventDate}</td>
            <td>${escapeHtml(e.venueName)}${e.venueCity ? ', ' + escapeHtml(e.venueCity) : ''}</td>
            <td><span class="source-badge ${e.source}">${e.source}</span></td>
            <td><span class="posted-badge ${postedClass}">${postedText}</span></td>
        </tr>`;
    }).join('');

    return `
    <div class="scrape-log-card">
        <div class="scrape-log-header">
            <div class="scrape-log-meta">
                <span class="scrape-log-timestamp">${timestamp}</span>
                <div class="scrape-log-sources">${sourceBadges}</div>
            </div>
            <div class="scrape-log-summary">
                <span>${summary.totalEventsScraped || 0} scraped</span>
                <span>${summary.totalEventsPosted || 0} posted</span>
                ${summary.totalDuplicatesRemoved ? `<span>${summary.totalDuplicatesRemoved} dupes</span>` : ''}
                ${summary.totalErrors ? `<span style="color: #f87171;">${summary.totalErrors} errors</span>` : ''}
                <span class="expand-arrow">&#9660;</span>
            </div>
        </div>
        <div class="scrape-log-detail">
            ${events.length > 0 ? `
            <table class="scrape-events-table">
                <thead>
                    <tr>
                        <th>Artist</th>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Venue</th>
                        <th>Source</th>
                        <th>Posted</th>
                    </tr>
                </thead>
                <tbody>
                    ${eventsTableRows}
                </tbody>
            </table>` : '<p style="color: var(--text-muted); padding: 1rem 0;">No events in this run.</p>'}
        </div>
    </div>`;
}

// Utility functions
function formatDateTime(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Start
init();
