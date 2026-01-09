// Public Events Loader - Fetches and displays events on the landing page
import { LOCAL_EVENTS } from './events-data.js';

/**
 * Load and display published events (Locally Mocked)
 */
export async function loadPublicEvents() {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    // Show loading state
    eventsGrid.innerHTML = `
        <div class="events-loading">
            <div class="loading-spinner"></div>
            <p>Loading events...</p>
        </div>
    `;

    try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Process matches and unmatched
        const processedEvents = LOCAL_EVENTS.map(event => {
            const hasImage = event.imageName && event.imageName.length > 0;
            if (!hasImage) {
                console.warn(`[Event Warning] Unmatched image for show: ${event.artistName}`);
            }

            // Format dates
            const dateObj = new Date(event.eventDate);
            const monthShort = dateObj.toLocaleString('en-US', { month: 'short' });
            const dayNum = dateObj.getDate();

            return {
                ...event,
                id: `local-${event.artistName.replace(/\s+/g, '-').toLowerCase()}`,
                imageUrl: hasImage ? `assets/${event.imageName}` : 'assets/dtxent-logo.png',
                displayMonth: monthShort.toUpperCase(),
                displayDay: dayNum
            };
        });

        if (processedEvents.length === 0) {
            eventsGrid.innerHTML = `
                <div class="events-empty">
                    <p>No upcoming events at this time. Check back soon!</p>
                </div>
            `;
            return;
        }

        // Render event cards
        eventsGrid.innerHTML = processedEvents.map(event => createEventCardHTML(event)).join('');

        // Generate and inject Schema.org data
        injectSchemaOrg(processedEvents);

        // Re-initialize animations for dynamically loaded cards
        initEventAnimations();

    } catch (error) {
        console.error('Error loading events:', error);
        eventsGrid.innerHTML = `
            <div class="events-error">
                <p>Unable to load events. Please refresh the page.</p>
            </div>
        `;
    }
}

/**
 * Create HTML for a single event card
 */
function createEventCardHTML(event) {
    const imageUrl = event.imageUrl || 'assets/dtxent-logo.png';
    const imageAlt = event.imageAlt || `${event.artistName} - ${event.eventName}`;
    const venueFullName = event.venueFullName || `${event.venueName}, ${event.venueCity}, ${event.venueState}`;

    return `
        <article class="event-card" role="listitem">
            <div class="event-image">
                <div class="event-date">
                    <span class="month">${escapeHtml(event.displayMonth)}</span>
                    <span class="day">${escapeHtml(event.displayDay)}</span>
                </div>
                <img src="${escapeHtml(imageUrl)}"
                     alt="${escapeHtml(imageAlt)}"
                     loading="lazy">
            </div>
            <div class="event-details">
                <span class="event-venue">${escapeHtml(venueFullName)}</span>
                <h3 class="event-artist">${escapeHtml(event.artistName)}</h3>
                <p class="event-info">${escapeHtml(event.eventName)}</p>
                <a href="${escapeHtml(event.ticketUrl)}"
                   class="btn btn-primary btn-block"
                   target="_blank"
                   rel="noopener noreferrer">Get Tickets</a>
            </div>
        </article>
    `;
}

/**
 * Generate and inject Schema.org JSON-LD data for events
 */
function injectSchemaOrg(events) {
    // Remove existing events schema if present
    const existingSchema = document.querySelector('script[data-schema="events"]');
    if (existingSchema) {
        existingSchema.remove();
    }

    const eventSchemas = events.map(event => {
        const eventDate = event.eventDate?.toDate
            ? event.eventDate.toDate()
            : new Date(event.eventDate);

        return {
            "@type": "Event",
            "name": `${event.artistName} - ${event.eventName}`,
            "startDate": eventDate.toISOString().split('T')[0],
            "location": {
                "@type": "Place",
                "name": event.venueName,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": event.venueCity,
                    "addressRegion": event.venueState
                }
            },
            "offers": {
                "@type": "Offer",
                "url": event.ticketUrl,
                "availability": "https://schema.org/InStock"
            },
            "performer": {
                "@type": event.performerType || "Person",
                "name": event.artistName
            },
            "image": event.imageUrl
        };
    });

    const schema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": eventSchemas
    };

    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.setAttribute('data-schema', 'events');
    schemaScript.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(schemaScript);
}

/**
 * Initialize scroll animations for event cards
 */
function initEventAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -80px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add staggered animation delay
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) scale(1)';
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all event cards
    document.querySelectorAll('.event-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(40px) scale(0.95)';
        card.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(card);
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPublicEvents);
} else {
    loadPublicEvents();
}
