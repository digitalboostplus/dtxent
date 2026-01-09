// Public Events Loader - Fetches and displays events on the landing page (Real-time)
import { db } from './firebase-config.js';
import { collection, query, where, orderBy, Timestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Store unsubscribe function for cleanup
let unsubscribeEvents = null;

/**
 * Load and display published events with real-time updates (From Firestore)
 */
export function loadPublicEvents() {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    // Clean up any existing listener
    if (unsubscribeEvents) {
        unsubscribeEvents();
    }

    // Show loading state
    eventsGrid.innerHTML = `
        <div class="events-loading">
            <div class="loading-spinner"></div>
            <p>Loading events...</p>
        </div>
    `;

    // Set up real-time listener
    const q = query(
        collection(db, 'events'),
        where('isPublished', '==', true),
        orderBy('eventDate', 'asc')
    );

    unsubscribeEvents = onSnapshot(q, (querySnapshot) => {
        const processedEvents = [];

        querySnapshot.forEach((doc) => {
            const event = doc.data();
            // Convert Firestore Timestamp to Date string/object for compatibility
            let eventDate = event.eventDate;
            if (eventDate instanceof Timestamp) {
                eventDate = eventDate.toDate();
            } else if (eventDate && eventDate.seconds) {
                eventDate = new Date(eventDate.seconds * 1000);
            }

            processedEvents.push({
                ...event,
                id: doc.id,
                eventDate: eventDate
            });
        });

        // Process events for display
        const displayEvents = processedEvents.map(event => {
            const hasLocalImage = event.imageName && event.imageName.length > 0;
            const hasExternalImage = event.imageUrl && event.imageUrl.length > 0;

            if (!hasLocalImage && !hasExternalImage) {
                console.warn(`[Event Warning] Unmatched image for show: ${event.artistName}`);
            }

            // Determine final image URL
            let finalImageUrl = 'assets/dtxent-logo.png';

            // First check for migrated assets path (../assets/)
            if (event.imageUrl && event.imageUrl.startsWith('../assets/')) {
                finalImageUrl = event.imageUrl.replace('../', '');
            } else if (hasExternalImage) {
                finalImageUrl = event.imageUrl;
            } else if (hasLocalImage) {
                if (event.imageName.startsWith('http')) {
                    finalImageUrl = event.imageName;
                } else {
                    finalImageUrl = `assets/${event.imageName}`;
                }
            }

            // Format dates
            const dateObj = new Date(event.eventDate);
            const monthShort = dateObj.toLocaleString('en-US', { month: 'short' });
            const dayNum = dateObj.getDate();

            return {
                ...event,
                id: event.id,
                imageUrl: finalImageUrl,
                displayMonth: monthShort.toUpperCase(),
                displayDay: dayNum
            };
        });

        if (displayEvents.length === 0) {
            eventsGrid.innerHTML = `
                <div class="events-empty">
                    <p>No upcoming events at this time. Check back soon!</p>
                </div>
            `;
            return;
        }

        // Render event cards
        eventsGrid.innerHTML = displayEvents.map(event => createEventCardHTML(event)).join('');

        // Generate and inject Schema.org data
        injectSchemaOrg(displayEvents);

        // Re-initialize animations for dynamically loaded cards
        initEventAnimations();

    }, (error) => {
        console.error('Error loading events:', error);
        eventsGrid.innerHTML = `
            <div class="events-error">
                <p>Unable to load events. Please refresh the page.</p>
            </div>
        `;
    });
}

/**
 * Stop listening for event updates (cleanup)
 */
export function stopEventUpdates() {
    if (unsubscribeEvents) {
        unsubscribeEvents();
        unsubscribeEvents = null;
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
                
                ${event.schedule ? `
                <div class="event-schedule">
                    ${event.schedule.map(item => `
                        <div class="schedule-item">
                            <span class="time">${escapeHtml(item.time)}</span>
                            <span class="desc">${escapeHtml(item.description)}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

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
