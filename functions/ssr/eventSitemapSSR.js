'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { db, toSlug, formatDateISO } = require('./helpers');

exports.eventSitemapSSR = onRequest(
    { region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', invoker: 'public' },
    async (req, res) => {
        try {
            const snapshot = await db.collection('events')
                .where('isPublished', '==', true)
                .orderBy('eventDate', 'asc')
                .get();

            const now = new Date();
            const urls = [];
            const artistSlugs = new Set();

            // Events index hub
            urls.push({
                loc: 'https://dtxent.com/events',
                changefreq: 'daily',
                priority: '0.9',
                lastmod: formatDateISO({ toDate: () => now }),
            });

            snapshot.forEach(doc => {
                const e = doc.data();
                if (!e.artistName || !e.venueName || !e.eventDate) return;

                const artistSlug = toSlug(e.artistName);
                const venueSlug = toSlug(e.venueName);
                const dateStr = formatDateISO(e.eventDate);
                const eventSlug = `${artistSlug}-${venueSlug}-${dateStr}`;
                const isUpcoming = e.eventDate.toDate ? e.eventDate.toDate() >= now : new Date(e.eventDate) >= now;

                urls.push({
                    loc: `https://dtxent.com/events/${eventSlug}`,
                    changefreq: isUpcoming ? 'weekly' : 'monthly',
                    priority: isUpcoming ? '1.0' : '0.6',
                    lastmod: e.metadata && e.metadata.updatedAt
                        ? formatDateISO(e.metadata.updatedAt)
                        : formatDateISO({ toDate: () => now }),
                });

                if (!artistSlugs.has(artistSlug)) {
                    artistSlugs.add(artistSlug);
                    urls.push({
                        loc: `https://dtxent.com/events/${artistSlug}`,
                        changefreq: 'weekly',
                        priority: '0.7',
                        lastmod: formatDateISO({ toDate: () => now }),
                    });
                }
            });

            const urlTags = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlTags}
</urlset>`;

            res.set('Content-Type', 'application/xml; charset=utf-8');
            res.set('Cache-Control', 'public, s-maxage=43200, max-age=43200');
            res.status(200).send(xml);
        } catch (err) {
            console.error('eventSitemapSSR error:', err);
            res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
        }
    }
);
