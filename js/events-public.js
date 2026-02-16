// Public Events Loader - Fetches and displays events on the landing page (Real-time)
import { db } from './firebase-config.js';
import { collection, query, where, orderBy, Timestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Store unsubscribe function for cleanup
let unsubscribeEvents = null;
import { LOCAL_EVENTS } from './events-data.js';
import { eventModal } from './event-detail-modal.js';
import { getEventDetails } from './ticketmaster-api.js';

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

    // Step 1: Initial load from LOCAL_EVENTS for zero-latency
    console.log('Performing initial load from local data...');
    const now = new Date();
    const pastCutoff = new Date(now.getTime() - (6 * 60 * 60 * 1000));

    const initialLocalEvents = LOCAL_EVENTS.filter(event => {
        const eventDate = new Date(event.eventDate);
        return !isNaN(eventDate.getTime()) && eventDate >= pastCutoff;
    });

    if (initialLocalEvents.length > 0) {
        renderEventsList(processEventsForDisplay(initialLocalEvents), eventsGrid);
    } else {
        // Show skeleton while waiting for Firestore
        eventsGrid.innerHTML = `
            <div class="skeleton-grid">
                ${[1, 2, 3].map(() => `
                    <div class="skeleton-card" role="article" aria-label="Loading event">
                        <div class="skeleton-image"></div>
                        <div class="skeleton-content">
                            <div class="skeleton-line skeleton-line-sm"></div>
                            <div class="skeleton-line skeleton-line-lg"></div>
                            <div class="skeleton-line skeleton-line-md"></div>
                            <div class="skeleton-button"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Step 2: Set up real-time listener from Firestore
    try {
        const q = query(
            collection(db, 'events'),
            where('isPublished', '==', true),
            orderBy('eventDate', 'asc')
        );

        unsubscribeEvents = onSnapshot(q, (querySnapshot) => {
            const firestoreEvents = [];
            querySnapshot.forEach((doc) => {
                const event = doc.data();
                let eventDate = event.eventDate;
                if (eventDate instanceof Timestamp) {
                    eventDate = eventDate.toDate();
                } else if (eventDate && eventDate.seconds) {
                    eventDate = new Date(eventDate.seconds * 1000);
                }

                firestoreEvents.push({
                    ...event,
                    id: doc.id,
                    eventDate: eventDate
                });
            });

            const upcomingFirestore = firestoreEvents.filter(e => e.eventDate >= pastCutoff);

            if (upcomingFirestore.length > 0) {
                console.log(`Loaded ${upcomingFirestore.length} events from Firestore.`);
                renderEventsList(processEventsForDisplay(upcomingFirestore), eventsGrid);
            } else {
                console.log('Firestore is empty or has no upcoming events. Staying with/reverting to local data.');
                // If Firestore is empty but we have local data, ensure local data is shown
                const upcomingLocal = LOCAL_EVENTS.filter(event => {
                    const eventDate = new Date(event.eventDate);
                    return !isNaN(eventDate.getTime()) && eventDate >= pastCutoff;
                });

                if (upcomingLocal.length > 0) {
                    renderEventsList(processEventsForDisplay(upcomingLocal), eventsGrid);
                } else {
                    eventsGrid.innerHTML = `
                        <div class="events-empty">
                            <p>No upcoming events at this time. Check back soon!</p>
                        </div>
                    `;
                }
            }
        }, (error) => {
            console.warn('Firestore listener error, continuing with local data:', error);
            // Error case: already handled by initial load, but let's re-verify local data
            if (eventsGrid.querySelector('.skeleton-grid')) {
                const upcomingLocal = LOCAL_EVENTS.filter(event => {
                    const eventDate = new Date(event.eventDate);
                    return !isNaN(eventDate.getTime()) && eventDate >= pastCutoff;
                });
                renderEventsList(processEventsForDisplay(upcomingLocal), eventsGrid);
            }
        });
    } catch (err) {
        console.error('Error setting up event listener:', err);
    }
}

/**
 * Process raw event data for display
 */
function processEventsForDisplay(events) {
    return events.map(event => {
        const hasLocalImage = event.imageName && event.imageName.length > 0;
        const hasExternalImage = event.imageUrl && event.imageUrl.length > 0;

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
        let dateObj;
        if (event.eventDate && event.eventDate.seconds) {
            dateObj = new Date(event.eventDate.seconds * 1000);
        } else {
            dateObj = new Date(event.eventDate);
        }

        if (isNaN(dateObj.getTime())) {
            dateObj = new Date(); // Fallback if invalid
        }

        const monthShort = dateObj.toLocaleString('en-US', { month: 'short' });
        const dayNum = dateObj.getDate();

        return {
            ...event,
            id: event.id || Math.random().toString(36).substr(2, 9),
            imageUrl: finalImageUrl,
            displayMonth: monthShort.toUpperCase(),
            displayDay: dayNum,
            eventDate: dateObj // Ensure it's a Date object
        };
    });
}

/**
 * Render the list of events to the grid
 */
function renderEventsList(displayEvents, container) {
    // Render event cards
    container.innerHTML = displayEvents.map(event => createEventCardHTML(event)).join('');

    // Attach click handlers for modal
    attachEventClickHandlers(displayEvents);

    // Enrich Ticketmaster events with real-time data
    enrichTicketmasterEvents(displayEvents);

    // Generate and inject Schema.org data
    injectSchemaOrg(displayEvents);

    // Re-initialize animations for dynamically loaded cards
    initEventAnimations();

    // Initialize countdown timers
    initCountdownTimers();

    // Announce to screen readers
    announceEventsLoaded(displayEvents.length);
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
    const eventDateISO = event.eventDate instanceof Date
        ? event.eventDate.toISOString()
        : new Date(event.eventDate).toISOString();

    const eventId = event.id || Math.random().toString(36).substr(2, 9);

    return `
        <article class="event-card" role="listitem" data-event-id="${eventId}" ${event.tmEventId ? `data-tm-id="${event.tmEventId}"` : ''}>
            <div class="card-glow"></div>
            <div class="event-image">
                <div class="event-date">
                    <span class="month">${escapeHtml(event.displayMonth)}</span>
                    <span class="day">${escapeHtml(event.displayDay)}</span>
                </div>
                <div class="event-status-tag" id="status-${eventId}"></div>
                <img src="${escapeHtml(imageUrl)}"
                     alt="${escapeHtml(imageAlt)}"
                     loading="lazy">
                <div class="event-price-range" id="price-${eventId}" style="display: none;"></div>
            </div>
            <div class="event-details">
                <span class="event-venue">${escapeHtml(venueFullName)}</span>
                <h3 class="event-artist">${escapeHtml(event.artistName)}</h3>
                <p class="event-info">${escapeHtml(event.eventName)}</p>

                <div class="event-countdown" data-date="${eventDateISO}">
                    <div class="countdown-item">
                        <span class="countdown-value days">--</span>
                        <span class="countdown-label">Days</span>
                    </div>
                    <div class="countdown-item">
                        <span class="countdown-value hours">--</span>
                        <span class="countdown-label">Hours</span>
                    </div>
                    <div class="countdown-item">
                        <span class="countdown-value mins">--</span>
                        <span class="countdown-label">Mins</span>
                    </div>
                </div>

                ${event.schedule && event.schedule.length > 0 ? `
                <div class="event-schedule">
                    ${event.schedule.map(item => `
                        <div class="schedule-item">
                            <span class="time">${escapeHtml(item.time)}</span>
                            <span class="desc">${escapeHtml(item.description)}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div class="event-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-outline btn-block show-details-btn">View Details</button>
                    <a href="${escapeHtml(event.ticketUrl)}"
                       class="btn btn-primary btn-block btn-icon"
                       target="_blank"
                       rel="noopener noreferrer"
                       onclick="event.stopPropagation()">
                       Tickets
                    </a>
                </div>
            </div>
        </article>
    `;
}

/**
 * Attach click handlers to event cards
 */
function attachEventClickHandlers(events) {
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open modal if clicking the ticket link directly
            if (e.target.closest('a')) return;

            const eventId = card.dataset.eventId;
            const eventData = events.find(ev => ev.id === eventId);
            if (eventData) {
                eventModal.open(eventData);
            }
        });
    });
}

/**
 * Enrich Ticketmaster events with real-time price and status
 */
async function enrichTicketmasterEvents(events) {
    const tmEvents = events.filter(e => e.tmEventId);

    // Process in parallel with rate limiting (Discovery API allows 5/sec)
    for (const event of tmEvents) {
        getEventDetails(event.tmEventId).then(data => {
            if (!data) return;

            const priceEl = document.getElementById(`price-${event.id}`);
            const statusEl = document.getElementById(`status-${event.id}`);

            // Update Price
            if (data.priceRanges && data.priceRanges.length > 0 && priceEl) {
                const min = Math.round(data.priceRanges[0].min);
                priceEl.textContent = `From $${min}`;
                priceEl.style.display = 'block';
            }

            // Update Status Badge
            if (data.dates.status.code && statusEl) {
                const status = data.dates.status.code;
                if (status === 'onsale') {
                    statusEl.innerHTML = '<span class="badge badge-onsale">On Sale</span>';
                } else if (status === 'offsale' || status === 'cancelled') {
                    statusEl.innerHTML = `<span class="badge badge-soldout">${status === 'cancelled' ? 'Cancelled' : 'Sold Out'}</span>`;
                }
            }
        });
    }
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

/**
 * Initialize and update countdown timers
 */
let countdownInterval = null;

function initCountdownTimers() {
    // Clear existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const updateAllCountdowns = () => {
        document.querySelectorAll('.event-countdown').forEach(countdown => {
            const eventDate = new Date(countdown.dataset.date).getTime();
            const now = Date.now();
            const distance = eventDate - now;

            if (distance < 0) {
                countdown.innerHTML = '<span class="event-starting">Event Started!</span>';
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            const daysEl = countdown.querySelector('.days');
            const hoursEl = countdown.querySelector('.hours');
            const minsEl = countdown.querySelector('.mins');

            if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
        });
    };

    // Initial update
    updateAllCountdowns();

    // Update every minute
    countdownInterval = setInterval(updateAllCountdowns, 60000);
}

/**
 * Announce events loaded to screen readers
 */
function announceEventsLoaded(count) {
    const status = document.getElementById('events-status');
    if (status) {
        status.textContent = `${count} upcoming events loaded`;
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPublicEvents);
} else {
    loadPublicEvents();
}
