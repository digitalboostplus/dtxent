'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── Slug Utilities ───────────────────────────────────────────────────────────

function toSlug(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Returns true if slug ends with -YYYY-MM-DD */
function isEventSlug(slug) {
    return /-\d{4}-\d{2}-\d{2}$/.test(slug);
}

/** Extracts { dateStr } from a slug ending in -YYYY-MM-DD */
function parseDateFromSlug(slug) {
    const m = slug.match(/-(\d{4}-\d{2}-\d{2})$/);
    return m ? m[1] : null;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function tsToDate(ts) {
    if (!ts) return new Date();
    if (ts.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    return new Date(ts);
}

/** Returns "May 9, 2026" */
function formatDate(ts) {
    const d = tsToDate(ts);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Returns "MAY" */
function formatMonthShort(ts) {
    return MONTHS_SHORT[tsToDate(ts).getUTCMonth()];
}

/** Returns "9" */
function formatDay(ts) {
    return String(tsToDate(ts).getUTCDate());
}

/** Returns "2026" */
function formatYear(ts) {
    return String(tsToDate(ts).getUTCFullYear());
}

/** Returns "2026-05-09" */
function formatDateISO(ts) {
    const d = tsToDate(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Returns ISO 8601 datetime string with RGV timezone offset.
 * RGV is America/Chicago: CDT (UTC-5) Mar–Oct, CST (UTC-6) Nov–Feb.
 */
function formatDateTimeISO(ts) {
    const d = tsToDate(ts);
    const month = d.getUTCMonth() + 1; // 1-12
    const offset = (month >= 3 && month <= 10) ? '-05:00' : '-06:00';
    const y = d.getUTCFullYear();
    const mo = String(month).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hr = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${mo}-${day}T${hr}:${min}:00${offset}`;
}

/** "May 2026" for month grouping */
function formatMonthYear(ts) {
    const d = tsToDate(ts);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── Cache Headers ────────────────────────────────────────────────────────────

function setCacheHeaders(res, eventDate) {
    const d = tsToDate(eventDate);
    const isPast = d < new Date();
    const maxAge = isPast ? 86400 : 3600;
    res.set('Cache-Control', `public, s-maxage=${maxAge}, max-age=${maxAge}`);
}

// ─── HTML Fragments ───────────────────────────────────────────────────────────

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildHead({ title, description, canonicalUrl, ogImage, noindex = false, jsonLdBlocks = [] }) {
    const safeTitle = esc(title);
    const safeDesc = esc(description);
    const safeOgImage = ogImage || 'https://dtxent.com/assets/dtxent-logo.png';
    const robotsMeta = noindex
        ? '<meta name="robots" content="noindex, follow">'
        : '<meta name="robots" content="index, follow">';
    const jsonLdTags = jsonLdBlocks.map(obj =>
        `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`
    ).join('\n    ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}">
    <link rel="canonical" href="${esc(canonicalUrl)}">
    ${robotsMeta}

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${esc(canonicalUrl)}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:image" content="${esc(safeOgImage)}">
    <meta property="og:site_name" content="Dynamic TX Entertainment">
    <meta property="og:locale" content="en_US">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@dtxent">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta name="twitter:image" content="${esc(safeOgImage)}">

    <!-- Geo -->
    <meta name="geo.region" content="US-TX">
    <meta name="geo.placename" content="Rio Grande Valley">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="manifest" href="/manifest.json">

    <!-- Styles -->
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/css/ssr-pages.css">

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-RZY6W9D8H0"></script>
    <script src="/js/gtag.js"></script>

    <!-- External Analytics -->
    <script src="https://link.dtxent.com/js/external-tracking.js" data-tracking-id="tk_7fb448734686429f8324fcc0fcde1b45"></script>
    <script id="vtag-ai-js" async src="https://r2.leadsy.ai/tag.js" data-pid="LIXLdg8BNV3WGs46" data-version="062024"></script>

    ${jsonLdTags}
</head>`;
}

function buildNav() {
    return `    <a href="#main-content" class="skip-link">Skip to main content</a>
    <div class="mobile-menu-backdrop" aria-hidden="true"></div>
    <header class="header" role="banner">
        <nav class="nav container" role="navigation" aria-label="Main navigation">
            <a href="/" class="logo">
                <img src="/assets/dtxent-logo.png" alt="DTXENT Logo" class="logo-img" width="200" height="75">
            </a>
            <ul class="nav-links">
                <li><a href="/events">Shows</a></li>
                <li><a href="/#nightlife">Nightlife</a></li>
                <li><a href="/vip.html">VIP Services</a></li>
                <li><a href="/transportation.html">Transportation</a></li>
                <li><a href="/dining/dining.html">Dining</a></li>
                <li><a href="/#stay">Stay</a></li>
                <li><a href="/contact.html">Contact</a></li>
                <li><a href="/events" class="btn btn-primary">Buy Tickets</a></li>
            </ul>
            <button class="mobile-menu-btn" aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </nav>
    </header>`;
}

function buildFooter() {
    return `    <footer class="footer" role="contentinfo">
        <div class="container footer-content">
            <div class="footer-brand">
                <a href="/" class="logo">
                    <img src="/assets/dtxent-logo.png" alt="DTXENT Logo" class="logo-img" width="200" height="75" loading="lazy">
                </a>
                <p>&copy; ${new Date().getFullYear()} Dynamic TX Entertainment. All rights reserved.</p>
            </div>
            <div class="footer-social">
                <a href="https://facebook.com/dtxent" aria-label="Follow us on Facebook" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://instagram.com/dtxent" aria-label="Follow us on Instagram" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                </a>
                <a href="https://twitter.com/dtxent" aria-label="Follow us on X (Twitter)" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
            </div>
        </div>
    </footer>`;
}

function buildScripts() {
    return `    <script src="/script.js"></script>`;
}

/** Renders an event card matching the existing .event-card structure */
function buildEventCard(event, { past = false } = {}) {
    const artistSlug = toSlug(event.artistName || '');
    const venueSlug = toSlug(event.venueName || '');
    const dateStr = formatDateISO(event.eventDate);
    const href = `/events/${artistSlug}-${venueSlug}-${dateStr}`;
    const imgSrc = event.imageUrl || '/assets/dtxent-logo.png';
    const imgAlt = esc(event.imageAlt || event.artistName || 'Event');
    const month = formatMonthShort(event.eventDate);
    const day = formatDay(event.eventDate);

    const ticketBtn = past
        ? `<span class="btn btn-outline btn-block" style="opacity:0.5;cursor:default;">Show Ended</span>`
        : `<a href="${esc(event.ticketUrl || href)}" class="btn btn-primary btn-block" target="_blank" rel="noopener noreferrer">Get Tickets</a>`;

    return `<article class="event-card${past ? ' event-card--past' : ''}" role="listitem">
            <a href="${esc(href)}" class="event-card-link" aria-label="${esc(event.artistName)} at ${esc(event.venueName)}">
                <div class="event-image">
                    <div class="event-date">
                        <span class="month">${month}</span>
                        <span class="day">${day}</span>
                    </div>
                    <img src="${esc(imgSrc)}" alt="${imgAlt}" loading="lazy">
                </div>
                <div class="event-details">
                    <span class="event-venue">${esc(event.venueName)}, ${esc(event.venueCity)}</span>
                    <h3 class="event-artist">${esc(event.artistName)}</h3>
                    <p class="event-info">${esc(event.eventName || '')}</p>
                </div>
            </a>
            <div class="event-card-actions">
                ${ticketBtn}
            </div>
        </article>`;
}

function build404(message = 'Page Not Found') {
    const head = buildHead({
        title: `${message} | DTXENT`,
        description: 'The page you\'re looking for doesn\'t exist.',
        canonicalUrl: 'https://dtxent.com/',
        noindex: true,
    });
    return `${head}
<body>
${buildNav()}
    <main id="main-content" role="main" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:4rem 1rem;">
        <div>
            <h1 style="font-size:4rem;color:var(--primary);margin-bottom:1rem;">404</h1>
            <p style="font-size:1.25rem;color:var(--text-muted);margin-bottom:2rem;">${esc(message)}</p>
            <a href="/events" class="btn btn-primary">View All Events</a>
        </div>
    </main>
${buildFooter()}
${buildScripts()}
</body>
</html>`;
}

module.exports = {
    db,
    toSlug,
    isEventSlug,
    parseDateFromSlug,
    formatDate,
    formatMonthShort,
    formatDay,
    formatYear,
    formatDateISO,
    formatDateTimeISO,
    formatMonthYear,
    setCacheHeaders,
    esc,
    buildHead,
    buildNav,
    buildFooter,
    buildScripts,
    buildEventCard,
    build404,
};
