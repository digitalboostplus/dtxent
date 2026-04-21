/**
 * DTXENT Firebase Cloud Functions
 *
 * These functions act as server-side proxies so that third-party API keys
 * and webhook URLs are never exposed to the browser.
 *
 * Required secrets (set via Firebase CLI before deploying):
 *   firebase functions:secrets:set GHL_NEWSLETTER_WEBHOOK_URL
 *   firebase functions:secrets:set GHL_VIP_WEBHOOK_URL
 *   firebase functions:secrets:set TM_API_KEY
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// SSR programmatic SEO pages
const { eventSitemapSSR } = require('./ssr/eventSitemapSSR');
const { eventIndexSSR } = require('./ssr/eventIndexSSR');
const { eventPageSSR } = require('./ssr/eventPageSSR');
exports.eventSitemapSSR = eventSitemapSSR;
exports.eventIndexSSR = eventIndexSSR;
exports.eventPageSSR = eventPageSSR;

const ghlNewsletterUrl = defineSecret('GHL_NEWSLETTER_WEBHOOK_URL');
const ghlVipUrl = defineSecret('GHL_VIP_WEBHOOK_URL');
const tmApiKey = defineSecret('TM_API_KEY');

// Allowed origins for CORS (Firebase Hosting rewrites make these same-origin,
// but kept here as defence-in-depth for direct function invocations).
const ALLOWED_ORIGINS = [
    'https://dtxent.com',
    'https://dtxent-web.web.app',
    'https://dtxent-web.firebaseapp.com'
];

function setCorsHeaders(req, res) {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * newsletterWebhook — proxies newsletter sign-up data to Go High Level CRM.
 * Called via Firebase Hosting rewrite at /api/newsletter-webhook
 */
exports.newsletterWebhook = onRequest(
    { secrets: [ghlNewsletterUrl] },
    async (req, res) => {
        setCorsHeaders(req, res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

        const { name, email, source } = req.body || {};
        if (!name || !email) {
            res.status(400).json({ error: 'Missing required fields: name, email' });
            return;
        }

        // Basic email format check server-side
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ error: 'Invalid email address' });
            return;
        }

        try {
            const webhookRes = await fetch(ghlNewsletterUrl.value(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: String(name).slice(0, 200),
                    email: String(email).toLowerCase().slice(0, 255),
                    source: source || 'landing_page',
                    subscribedAt: new Date().toISOString()
                })
            });

            if (!webhookRes.ok) {
                console.error('GHL newsletter webhook returned', webhookRes.status);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('newsletterWebhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * vipWebhook — proxies VIP request data to Go High Level CRM.
 * Called via Firebase Hosting rewrite at /api/vip-webhook
 */
exports.vipWebhook = onRequest(
    { secrets: [ghlVipUrl] },
    async (req, res) => {
        setCorsHeaders(req, res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

        const { fullName, phone, email, eventDetails, groupSize, requestedServices } = req.body || {};
        if (!fullName || !phone || !email || !eventDetails || !groupSize || !requestedServices) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        try {
            const payload = { ...req.body, submittedAt: new Date().toISOString() };
            // Strip any serverTimestamp objects that aren't JSON-serializable
            delete payload.submittedAt_server;

            const webhookRes = await fetch(ghlVipUrl.value(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!webhookRes.ok) {
                console.error('GHL VIP webhook returned', webhookRes.status);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('vipWebhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * ticketmasterProxy — proxies Ticketmaster Discovery API requests.
 * Called via Firebase Hosting rewrite at /api/ticketmaster?eventId=XXXXX
 */
exports.ticketmasterProxy = onRequest(
    { secrets: [tmApiKey] },
    async (req, res) => {
        setCorsHeaders(req, res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

        const eventId = req.query.eventId;
        if (!eventId || !/^[A-Za-z0-9]+$/.test(eventId)) {
            res.status(400).json({ error: 'Invalid or missing eventId' });
            return;
        }

        try {
            const url = `https://app.ticketmaster.com/discovery/v2/events/${eventId}.json?apikey=${tmApiKey.value()}`;
            const tmRes = await fetch(url);

            if (!tmRes.ok) {
                res.status(tmRes.status).json({ error: 'Upstream error' });
                return;
            }

            const data = await tmRes.json();
            // Cache at CDN/browser level for 15 minutes
            res.set('Cache-Control', 'public, max-age=900');
            res.json(data);
        } catch (error) {
            console.error('ticketmasterProxy error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);
