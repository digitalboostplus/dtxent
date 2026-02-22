/**
 * Event Detail Modal
 * Handles the display of detailed event information, real-time data, and seatmaps.
 */

import { getEventDetails } from './ticketmaster-api.js';

class EventDetailModal {
    constructor() {
        this.modal = null;
        this.init();
    }

    init() {
        // Prevent multiple initializations
        if (this.initialized) return;

        // Create modal structure if it doesn't exist
        if (!document.getElementById('event-modal')) {
            // Safety check for document body
            if (!document.body) {
                console.warn('[Modal] Document body not ready, deferring initialization');
                return;
            }

            const modalHTML = `
                <div id="event-modal" class="modal-overlay" role="dialog" aria-modal="true">
                    <div class="modal-container">
                        <button class="modal-close" aria-label="Close modal">&times;</button>
                        <div id="modal-content-area">
                            <!-- Content will be injected here -->
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modal = document.getElementById('event-modal');
        this.contentArea = document.getElementById('modal-content-area');
        this.closeBtn = this.modal.querySelector('.modal-close');

        // Event listeners
        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
                this.close();
            }
        });

        this.initialized = true;
    }

    async open(eventData) {
        if (!eventData) {
            console.error('[Modal] No event data provided');
            return;
        }

        try {
            // Ensure initialized
            if (!this.initialized) {
                this.init();
            }

            if (!this.modal) {
                throw new Error('Modal element not found after initialization');
            }

            // Prevent background scrolling
            document.body.style.overflow = 'hidden';

            // Initial render with local data
            this.renderInitial(eventData);
            this.modal.classList.add('active');

            // If it's a Ticketmaster event, fetch real-time data
            if (eventData.tmEventId) {
                this.showLoading();
                try {
                    const tmData = await getEventDetails(eventData.tmEventId);
                    if (tmData && this.modal.classList.contains('active')) {
                        this.renderTMData(eventData, tmData);
                    }
                } catch (tmError) {
                    console.warn('[Modal] Failed to fetch real-time data:', tmError);
                } finally {
                    this.hideLoading();
                }
            }
        } catch (err) {
            console.error('[Modal] Error opening modal:', err);
            // Restore scrolling if opening fails
            document.body.style.overflow = '';
            if (this.modal) {
                this.modal.classList.remove('active');
            }
        }
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        // Small delay to clear content after animation
        setTimeout(() => {
            this.contentArea.innerHTML = '';
        }, 300);
    }

    showLoading() {
        const loader = document.createElement('div');
        loader.className = 'modal-loader';
        loader.innerHTML = '<div class="loading-spinner"></div>';
        this.contentArea.appendChild(loader);
    }

    hideLoading() {
        const loader = this.contentArea.querySelector('.modal-loader');
        if (loader) loader.remove();
    }

    renderInitial(event) {
        const eventDate = event.eventDate instanceof Date ? event.eventDate : new Date(event.eventDate);
        const dateString = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const hasMultipleDates = event.dates && event.dates.length > 1;
        let datesHTML = '';

        if (hasMultipleDates) {
            datesHTML = `
                <section class="modal-dates-multi">
                    <h3 class="modal-section-title">Available Dates</h3>
                    <div class="modal-dates-list">
                        ${event.dates.map(d => {
                const dDate = new Date(d.eventDate || d.date);
                const day = dDate.toLocaleDateString('en-US', { weekday: 'short' });
                const mo = dDate.toLocaleDateString('en-US', { month: 'short' });
                const dt = dDate.getDate();
                const tm = dDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                return `
                                <div class="modal-date-row">
                                    <div class="date-info">
                                        <span class="date-day">${day}, ${mo} ${dt}</span>
                                        <span class="date-time">${tm}</span>
                                    </div>
                                    <a href="${d.ticketUrl}" target="_blank" class="btn btn-primary btn-sm">Tickets</a>
                                </div>
                            `;
            }).join('')}
                    </div>
                </section>
            `;
        }

        this.contentArea.innerHTML = `
            <div class="modal-hero">
                <img src="${event.imageUrl}" alt="${event.artistName}">
            </div>
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-event-date">${hasMultipleDates ? 'Multiple Dates Available' : dateString}</span>
                    <h2 class="modal-event-name">${event.artistName}</h2>
                    <p class="modal-info-text">${event.eventName || ''}</p>
                </div>

                <div class="modal-grid">
                    <div class="modal-main">
                        <section>
                            <h3 class="modal-section-title">Event Info</h3>
                            <p class="modal-info-text">
                                Get ready for an incredible night with <strong>${event.artistName}</strong> at ${event.venueName}. 
                                Join us for an unforgettable experience!
                            </p>
                        </section>
                        ${datesHTML}
                    </div>
                    <div class="modal-sidebar">
                        <div class="venue-info">
                            <div class="venue-info-item">
                                <span class="icon">📍</span>
                                <div>
                                    <h4>Venue</h4>
                                    <p>${event.venueName}<br>${event.venueCity}, ${event.venueState}</p>
                                </div>
                            </div>
                        </div>
                        
                        ${!hasMultipleDates ? `
                        <div class="modal-actions">
                            <a href="${event.ticketUrl}" target="_blank" class="btn btn-primary btn-block">Buy Tickets</a>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderTMData(localEvent, tm) {
        const priceRange = tm.priceRanges ? tm.priceRanges[0] : null;
        const seatmap = tm.seatmap ? tm.seatmap.staticUrl : null;
        const status = tm.dates.status.code;
        const info = tm.info || tm.pleaseNote || "";
        const presales = tm.sales.presales || [];
        const venue = tm._embedded.venues ? tm._embedded.venues[0] : null;

        // Update the content with real-time data
        const mainArea = this.contentArea.querySelector('.modal-main');
        const sidebar = this.contentArea.querySelector('.modal-sidebar');
        const header = this.contentArea.querySelector('.modal-header');

        // Add badges to header
        let badgesHTML = '<div class="modal-badges">';

        // Status Badge
        if (status === 'onsale') badgesHTML += '<span class="badge badge-onsale">ON SALE NOW</span>';
        else if (status === 'offsale') badgesHTML += '<span class="badge badge-soldout">OFF SALE</span>';
        else if (status === 'cancelled') badgesHTML += '<span class="badge badge-soldout">CANCELLED</span>';
        else if (status === 'postponed') badgesHTML += '<span class="badge badge-presale">POSTPONED</span>';

        // Price Badge
        if (priceRange) {
            const min = Math.round(priceRange.min);
            const max = Math.round(priceRange.max);
            badgesHTML += `<span class="badge badge-price">Tickets from $${min}</span>`;
        }

        badgesHTML += '</div>';
        header.insertAdjacentHTML('afterend', badgesHTML);

        // Update Info Section
        if (info) {
            mainArea.innerHTML = `
                <section>
                    <h3 class="modal-section-title">Show Details</h3>
                    <p class="modal-info-text">${info}</p>
                </section>
            `;
        }

        // Add Seatmap if available
        if (seatmap) {
            mainArea.insertAdjacentHTML('beforeend', `
                <section>
                    <h3 class="modal-section-title">Venue Seat Map</h3>
                    <div class="seatmap-container">
                        <img src="${seatmap}" alt="Venue Seating Chart">
                    </div>
                </section>
            `);
        }

        // Update Sidebar with Presales
        if (presales.length > 0) {
            const presaleHTML = `
                <section style="margin-top: 2rem;">
                    <h3 class="modal-section-title">On Sale Info</h3>
                    <ul class="presale-list">
                        ${presales.map(p => `
                            <li class="presale-item">
                                <h4>${p.name}</h4>
                                <p>${new Date(p.startDateTime).toLocaleDateString()} - ${new Date(p.endDateTime).toLocaleDateString()}</p>
                            </li>
                        `).join('')}
                    </ul>
                </section>
            `;
            sidebar.insertAdjacentHTML('afterbegin', presaleHTML);
        }

        // Update Venue info with full details
        if (venue) {
            const venueBox = sidebar.querySelector('.venue-info');
            venueBox.innerHTML = `
                <div class="venue-info-item">
                    <span class="icon">📍</span>
                    <div>
                        <h4>Venue</h4>
                        <p>${venue.name}<br>${venue.address.line1}<br>${venue.city.name}, ${venue.state.stateCode}</p>
                    </div>
                </div>
                ${venue.parkingDetail ? `
                <div class="venue-info-item">
                    <span class="icon">🚗</span>
                    <div>
                        <h4>Parking</h4>
                        <p>${venue.parkingDetail}</p>
                    </div>
                </div>` : ''}
            `;
        }
    }
}

// Export a single instance
export const eventModal = new EventDetailModal();
