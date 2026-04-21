'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const {
    db, toSlug, formatDateISO, formatMonthYear,
    buildHead, buildNav, buildFooter, buildScripts, buildEventCard, esc,
} = require('./helpers');

const { Timestamp } = require('firebase-admin/firestore');

exports.eventIndexSSR = onRequest(
    { region: 'us-central1', timeoutSeconds: 15, memory: '256MiB', invoker: 'public' },
    async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const noindex = page > 1;
            const canonicalUrl = 'https://dtxent.com/events';

            const now = Timestamp.now();
            const snapshot = await db.collection('events')
                .where('isPublished', '==', true)
                .where('eventDate', '>=', now)
                .orderBy('eventDate', 'asc')
                .limit(60)
                .get();

            const events = [];
            snapshot.forEach(doc => {
                const e = doc.data();
                if (e.artistName && e.venueName && e.eventDate) {
                    events.push(e);
                }
            });

            // Group events by month
            const grouped = {};
            events.forEach(e => {
                const key = formatMonthYear(e.eventDate);
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(e);
            });

            const monthSections = Object.entries(grouped).map(([month, monthEvents]) => {
                const cards = monthEvents.map(e => buildEventCard(e)).join('\n            ');
                return `        <div class="ssr-month-group">
                <h2 class="ssr-month-heading">${esc(month)}</h2>
                <div class="events-grid" role="list">
                    ${cards}
                </div>
            </div>`;
            }).join('\n');

            const emptyState = events.length === 0
                ? `<div class="ssr-empty"><p>No upcoming events at this time. Check back soon!</p><a href="/" class="btn btn-outline">Back to Home</a></div>`
                : '';

            const jsonLd = [
                {
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    name: 'Upcoming Events | DTXENT',
                    description: 'Browse all upcoming concerts, shows, and live entertainment events in the Rio Grande Valley, TX.',
                    url: canonicalUrl,
                    publisher: {
                        '@type': 'Organization',
                        name: 'Dynamic TX Entertainment',
                        url: 'https://dtxent.com',
                    },
                },
                {
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dtxent.com/' },
                        { '@type': 'ListItem', position: 2, name: 'Events', item: canonicalUrl },
                    ],
                },
            ];

            const head = buildHead({
                title: 'Upcoming Events in the Rio Grande Valley | DTXENT',
                description: 'Browse all upcoming concerts, comedy shows, and live entertainment events across South Texas — Payne Arena, South Padre Island, McAllen, and beyond. Promoted by DTXENT.',
                canonicalUrl,
                noindex,
                jsonLdBlocks: jsonLd,
            });

            const html = `${head}
<body>
${buildNav()}
    <main id="main-content" role="main">
        <section class="ssr-hero section" aria-labelledby="events-index-title">
            <div class="container">
                <h1 id="events-index-title" class="section-title">
                    Upcoming <span class="text-highlight">Events</span>
                </h1>
                <p class="section-desc">Concerts, shows, and live entertainment across the Rio Grande Valley — Payne Arena, South Padre Island, McAllen, and beyond.</p>
            </div>
        </section>

        <section class="section" aria-label="Events list">
            <div class="container">
                ${monthSections}
                ${emptyState}
            </div>
        </section>
    </main>
${buildFooter()}
${buildScripts()}
</body>
</html>`;

            res.set('Cache-Control', 'public, s-maxage=1800, max-age=1800');
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(html);
        } catch (err) {
            console.error('eventIndexSSR error:', err);
            res.status(500).send('<html><body><h1>Error loading events</h1></body></html>');
        }
    }
);
