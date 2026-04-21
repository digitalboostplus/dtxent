'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { Timestamp } = require('firebase-admin/firestore');
const {
    db, toSlug, isEventSlug, parseDateFromSlug,
    formatDate, formatMonthShort, formatDay, formatYear, formatDateISO, formatDateTimeISO,
    setCacheHeaders, esc,
    buildHead, buildNav, buildFooter, buildScripts, buildEventCard, build404,
} = require('./helpers');

// ─── Individual Event Page ────────────────────────────────────────────────────

async function renderEventPage(req, res, slug) {
    const dateStr = parseDateFromSlug(slug);
    if (!dateStr) {
        res.status(404).send(build404('Event Not Found'));
        return;
    }

    // Parse the date string into a day range (UTC)
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));

    let snapshot;
    try {
        snapshot = await db.collection('events')
            .where('isPublished', '==', true)
            .where('eventDate', '>=', Timestamp.fromDate(dayStart))
            .where('eventDate', '<=', Timestamp.fromDate(dayEnd))
            .get();
    } catch (err) {
        console.error('eventPageSSR Firestore error:', err);
        res.status(500).send(build404('Error loading event'));
        return;
    }

    // Find the matching event by slug
    let event = null;
    snapshot.forEach(doc => {
        const e = doc.data();
        if (!e.artistName || !e.venueName) return;
        const expectedSlug = `${toSlug(e.artistName)}-${toSlug(e.venueName)}-${dateStr}`;
        if (expectedSlug === slug) {
            event = { id: doc.id, ...e };
        }
    });

    if (!event) {
        res.status(404).send(build404('Event Not Found'));
        return;
    }

    const artistSlug = toSlug(event.artistName);
    const canonicalUrl = `https://dtxent.com/events/${slug}`;
    const formattedDate = formatDate(event.eventDate);
    const isPast = event.eventDate.toDate ? event.eventDate.toDate() < new Date() : new Date(event.eventDate) < new Date();
    const isOldPast = (() => {
        const d = event.eventDate.toDate ? event.eventDate.toDate() : new Date(event.eventDate);
        return (Date.now() - d.getTime()) > 30 * 24 * 60 * 60 * 1000; // >30 days old
    })();

    // Fetch related events (same artist, excluding current)
    let sameArtistEvents = [];
    let sameVenueEvents = [];
    try {
        const [artistSnap, venueSnap] = await Promise.all([
            db.collection('events')
                .where('isPublished', '==', true)
                .where('artistName', '==', event.artistName)
                .where('eventDate', '>=', Timestamp.now())
                .orderBy('eventDate', 'asc')
                .limit(5)
                .get(),
            db.collection('events')
                .where('isPublished', '==', true)
                .where('venueName', '==', event.venueName)
                .where('eventDate', '>=', Timestamp.now())
                .orderBy('eventDate', 'asc')
                .limit(5)
                .get(),
        ]);
        artistSnap.forEach(doc => {
            const e = doc.data();
            if (doc.id !== event.id && e.artistName && e.venueName) {
                sameArtistEvents.push(e);
            }
        });
        venueSnap.forEach(doc => {
            const e = doc.data();
            if (doc.id !== event.id && e.artistName && e.venueName) {
                sameVenueEvents.push(e);
            }
        });
        sameArtistEvents = sameArtistEvents.slice(0, 4);
        sameVenueEvents = sameVenueEvents.slice(0, 4).filter(
            e => toSlug(e.artistName) !== artistSlug
        );
    } catch (err) {
        console.error('eventPageSSR related events error:', err);
    }

    // ── JSON-LD ──
    const eventSchema = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.eventName || event.artistName,
        description: event.description || `${event.artistName} live at ${event.venueName} in ${event.venueCity}, TX. Presented by Dynamic TX Entertainment.`,
        startDate: formatDateTimeISO(event.eventDate),
        eventStatus: event.isClosed
            ? 'https://schema.org/EventCancelled'
            : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: event.venueName,
            address: {
                '@type': 'PostalAddress',
                addressLocality: event.venueCity || 'Hidalgo',
                addressRegion: 'TX',
                addressCountry: 'US',
            },
        },
        performer: { '@type': 'MusicGroup', name: event.artistName },
        organizer: {
            '@type': 'Organization',
            name: 'Dynamic TX Entertainment',
            url: 'https://dtxent.com',
        },
        url: canonicalUrl,
    };
    if (event.imageUrl) eventSchema.image = [event.imageUrl];
    if (event.ticketUrl && !event.isClosed) {
        eventSchema.offers = {
            '@type': 'Offer',
            url: event.ticketUrl,
            priceCurrency: 'USD',
            availability: isPast ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        };
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dtxent.com/' },
            { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://dtxent.com/events' },
            { '@type': 'ListItem', position: 3, name: event.artistName, item: `https://dtxent.com/events/${artistSlug}` },
            { '@type': 'ListItem', position: 4, name: `${event.artistName} at ${event.venueName} – ${formattedDate}`, item: canonicalUrl },
        ],
    };

    // ── HTML sections ──
    const heroStyle = event.imageUrl
        ? `style="background-image:url('${esc(event.imageUrl)}')"`
        : '';

    const ticketSection = event.isClosed
        ? `<div class="ticket-card"><p class="ticket-cancelled">This event has been cancelled.</p></div>`
        : isPast
        ? `<div class="ticket-card"><p class="ticket-past">This event has already taken place.</p><a href="/events/${artistSlug}" class="btn btn-outline">See More ${esc(event.artistName)} Shows</a></div>`
        : `<div class="ticket-card">
                <div class="ticket-info">
                    <h2>Get Your Tickets</h2>
                    <p class="ticket-date">${esc(formattedDate)}</p>
                    <p class="ticket-venue">${esc(event.venueName)}, ${esc(event.venueCity || '')}, TX</p>
                </div>
                <a href="${esc(event.ticketUrl || '#')}" class="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer" aria-label="Buy ${esc(event.artistName)} tickets at ${esc(event.venueName)}">
                    Buy Tickets
                </a>
            </div>`;

    const relatedArtistSection = sameArtistEvents.length > 0
        ? `<section class="section ssr-related" aria-label="More ${esc(event.artistName)} shows">
            <div class="container">
                <h2 class="section-title">More <span class="text-highlight">${esc(event.artistName)}</span> Shows</h2>
                <div class="events-grid" role="list">
                    ${sameArtistEvents.map(e => buildEventCard(e)).join('\n                    ')}
                </div>
            </div>
        </section>`
        : '';

    const relatedVenueSection = sameVenueEvents.length > 0
        ? `<section class="section ssr-related" aria-label="More events at ${esc(event.venueName)}">
            <div class="container">
                <h2 class="section-title">More Events at <span class="text-highlight">${esc(event.venueName)}</span></h2>
                <div class="events-grid" role="list">
                    ${sameVenueEvents.map(e => buildEventCard(e)).join('\n                    ')}
                </div>
            </div>
        </section>`
        : '';

    const description = event.description
        || `${event.artistName} performs live at ${event.venueName} in ${event.venueCity || 'the Rio Grande Valley'}, TX on ${formattedDate}. Presented by Dynamic TX Entertainment (DTXENT) — the Rio Grande Valley's premier live entertainment brand.`;

    const head = buildHead({
        title: `${event.artistName} at ${event.venueName} – ${formattedDate} | DTXENT`,
        description: `${event.artistName} live at ${event.venueName}, ${event.venueCity || 'TX'} on ${formattedDate}. Get tickets now — presented by Dynamic TX Entertainment.`,
        canonicalUrl,
        ogImage: event.imageUrl || undefined,
        noindex: isOldPast,
        jsonLdBlocks: [eventSchema, breadcrumbSchema],
    });

    const html = `${head}
<body>
${buildNav()}
    <main id="main-content" role="main">

        <!-- Breadcrumb -->
        <nav class="ssr-breadcrumb container" aria-label="Breadcrumb">
            <ol>
                <li><a href="/">Home</a></li>
                <li><a href="/events">Events</a></li>
                <li><a href="/events/${artistSlug}">${esc(event.artistName)}</a></li>
                <li aria-current="page">${esc(event.venueName)} – ${esc(formattedDate)}</li>
            </ol>
        </nav>

        <!-- Event Hero -->
        <section class="ssr-event-hero" ${heroStyle} aria-label="Event hero">
            <div class="ssr-event-hero-overlay"></div>
            <div class="container ssr-event-hero-content">
                <div class="ssr-date-badge">
                    <span class="month">${formatMonthShort(event.eventDate)}</span>
                    <span class="day">${formatDay(event.eventDate)}</span>
                    <span class="year">${formatYear(event.eventDate)}</span>
                </div>
                <h1 class="ssr-event-title">${esc(event.artistName)}</h1>
                ${event.eventName ? `<p class="ssr-event-tour">${esc(event.eventName)}</p>` : ''}
                <p class="ssr-event-venue-line">${esc(event.venueName)} &middot; ${esc(event.venueCity || '')}, TX</p>
            </div>
        </section>

        <!-- Ticket CTA -->
        <section id="tickets" class="section ssr-tickets" aria-label="Tickets">
            <div class="container">
                ${ticketSection}
            </div>
        </section>

        <!-- Event Details -->
        <section class="section ssr-details" aria-label="Event details">
            <div class="container ssr-details-grid">
                <div class="ssr-description">
                    <h2>About This Show</h2>
                    <p>${esc(description)}</p>
                </div>
                <aside class="ssr-sidebar">
                    <div class="ssr-detail-card">
                        <h3>Event Details</h3>
                        <dl>
                            <dt>Date</dt>
                            <dd>${esc(formattedDate)}</dd>
                            <dt>Venue</dt>
                            <dd>${esc(event.venueName)}</dd>
                            <dt>City</dt>
                            <dd>${esc(event.venueCity || 'Rio Grande Valley')}, TX</dd>
                        </dl>
                    </div>
                    <div class="ssr-detail-card">
                        <h3>VIP Experience</h3>
                        <p>Upgrade your night with DTXENT VIP packages — bottle service, exclusive access, and more.</p>
                        <a href="/vip.html" class="btn btn-outline">Explore VIP</a>
                    </div>
                </aside>
            </div>
        </section>

        ${relatedArtistSection}
        ${relatedVenueSection}

    </main>
${buildFooter()}
${buildScripts()}
</body>
</html>`;

    setCacheHeaders(res, event.eventDate);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}

// ─── Artist Hub Page ──────────────────────────────────────────────────────────

async function renderArtistHub(req, res, artistSlug) {
    let snapshot;
    try {
        snapshot = await db.collection('events')
            .where('isPublished', '==', true)
            .orderBy('eventDate', 'asc')
            .get();
    } catch (err) {
        console.error('artistHub Firestore error:', err);
        res.status(500).send(build404('Error loading events'));
        return;
    }

    const now = new Date();
    const upcoming = [];
    const past = [];
    let artistName = '';

    snapshot.forEach(doc => {
        const e = doc.data();
        if (!e.artistName || !e.venueName) return;
        if (toSlug(e.artistName) !== artistSlug) return;
        if (!artistName) artistName = e.artistName;
        const eDate = e.eventDate.toDate ? e.eventDate.toDate() : new Date(e.eventDate);
        if (eDate >= now) {
            upcoming.push(e);
        } else {
            past.push(e);
        }
    });

    if (!artistName) {
        res.status(404).send(build404('Artist Not Found'));
        return;
    }

    past.sort((a, b) => {
        const da = a.eventDate.toDate ? a.eventDate.toDate() : new Date(a.eventDate);
        const db2 = b.eventDate.toDate ? b.eventDate.toDate() : new Date(b.eventDate);
        return db2 - da;
    });

    const canonicalUrl = `https://dtxent.com/events/${artistSlug}`;
    const noindex = upcoming.length === 0;

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dtxent.com/' },
            { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://dtxent.com/events' },
            { '@type': 'ListItem', position: 3, name: artistName, item: canonicalUrl },
        ],
    };

    const upcomingCards = upcoming.map(e => buildEventCard(e)).join('\n                    ');
    const pastCards = past.slice(0, 8).map(e => buildEventCard(e, { past: true })).join('\n                    ');

    const head = buildHead({
        title: `${artistName} Events in the Rio Grande Valley | DTXENT`,
        description: `All ${artistName} concerts and events in South Texas promoted by Dynamic TX Entertainment. Get tickets for upcoming ${artistName} shows at Payne Arena, South Padre Island, McAllen, and beyond.`,
        canonicalUrl,
        noindex,
        jsonLdBlocks: [breadcrumbSchema],
    });

    const html = `${head}
<body>
${buildNav()}
    <main id="main-content" role="main">

        <!-- Breadcrumb -->
        <nav class="ssr-breadcrumb container" aria-label="Breadcrumb">
            <ol>
                <li><a href="/">Home</a></li>
                <li><a href="/events">Events</a></li>
                <li aria-current="page">${esc(artistName)}</li>
            </ol>
        </nav>

        <!-- Artist Hero -->
        <section class="ssr-hero section" aria-labelledby="artist-hub-title">
            <div class="container">
                <h1 id="artist-hub-title" class="section-title">
                    ${esc(artistName)} <span class="text-gradient">in the Rio Grande Valley</span>
                </h1>
                <p class="section-desc">All ${esc(artistName)} concerts and events in South Texas — promoted by DTXENT.</p>
            </div>
        </section>

        ${upcoming.length > 0 ? `
        <section class="section" aria-label="Upcoming ${esc(artistName)} shows">
            <div class="container">
                <h2 class="section-title">Upcoming <span class="text-highlight">Shows</span></h2>
                <div class="events-grid" role="list">
                    ${upcomingCards}
                </div>
            </div>
        </section>` : `
        <section class="section" aria-label="No upcoming shows">
            <div class="container ssr-empty">
                <p>No upcoming ${esc(artistName)} shows at this time.</p>
                <a href="/events" class="btn btn-outline">Browse All Events</a>
            </div>
        </section>`}

        ${past.length > 0 ? `
        <section class="section ssr-past-section" aria-label="Past ${esc(artistName)} shows">
            <div class="container">
                <h2 class="section-title">Past <span class="text-highlight">Shows</span></h2>
                <div class="events-grid events-grid--past" role="list">
                    ${pastCards}
                </div>
            </div>
        </section>` : ''}

    </main>
${buildFooter()}
${buildScripts()}
</body>
</html>`;

    res.set('Cache-Control', 'public, s-maxage=3600, max-age=3600');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

exports.eventPageSSR = onRequest(
    { region: 'us-central1', timeoutSeconds: 15, memory: '256MiB', invoker: 'public' },
    async (req, res) => {
        // Extract slug from path: /events/some-slug → "some-slug"
        const pathParts = req.path.replace(/^\/+/, '').split('/');
        const slug = pathParts[1] || '';

        if (!slug) {
            res.status(404).send(build404('Event Not Found'));
            return;
        }

        if (isEventSlug(slug)) {
            await renderEventPage(req, res, slug);
        } else {
            await renderArtistHub(req, res, slug);
        }
    }
);
