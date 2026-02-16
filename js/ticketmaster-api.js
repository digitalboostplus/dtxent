/**
 * Ticketmaster Discovery API v2 Wrapper
 * Handles fetching real-time event data, pricing, and seatmaps.
 * Includes client-side caching to stay within rate limits.
 */

const TM_API_BASE = 'https://app.ticketmaster.com/discovery/v2';
const TM_API_KEY = 'nZ2fivZWnA0Z3ViOdjpbGc4vOB2GGxyM';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Fetch event details by Ticketmaster Event ID
 * @param {string} eventId 
 * @returns {Promise<Object|null>}
 */
export async function getEventDetails(eventId) {
    if (!eventId) return null;

    // Check cache first
    const cachedData = getFromCache(`tm_event_${eventId}`);
    if (cachedData) return cachedData;

    try {
        const url = `${TM_API_BASE}/events/${eventId}.json?apikey=${TM_API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) console.error('Ticketmaster API Key is invalid or missing.');
            return null;
        }

        const data = await response.json();

        // Cache the result
        saveToCache(`tm_event_${eventId}`, data);

        return data;
    } catch (error) {
        console.error('Error fetching Ticketmaster event details:', error);
        return null;
    }
}

/**
 * Extract Ticketmaster Event ID from a TicketUrl
 * @param {string} url 
 * @returns {string|null}
 */
export function extractEventId(url) {
    if (!url || !url.includes('ticketmaster.com')) return null;
    // Common pattern: /event/3A00634E94D967D7
    const match = url.match(/\/event\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
}

/**
 * Helper to save data to sessionStorage with timestamp
 */
function saveToCache(key, data) {
    try {
        const cacheEntry = {
            timestamp: Date.now(),
            data: data
        };
        sessionStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) {
        // Handle potential QuotaExceededError or sessionStorage unavailability
        console.warn('Cache save failed', e);
    }
}

/**
 * Helper to get data from sessionStorage if not expired
 */
function getFromCache(key) {
    try {
        const entry = sessionStorage.getItem(key);
        if (!entry) return null;

        const cacheEntry = JSON.parse(entry);
        const age = Date.now() - cacheEntry.timestamp;

        if (age < CACHE_TTL) {
            return cacheEntry.data;
        } else {
            sessionStorage.removeItem(key);
            return null;
        }
    } catch (e) {
        return null;
    }
}
