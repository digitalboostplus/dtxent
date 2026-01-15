import { LOCAL_CLUBS, LOCAL_RESTAURANTS, LOCAL_HOTELS } from './events-data.js';

/**
 * Loads and renders lifestyle content (Clubs, Dining, Hotels)
 */
export function loadLifestyleContent() {
    renderGrid('nightlife-grid', LOCAL_CLUBS, createClubCard);
    renderGrid('dining-grid', LOCAL_RESTAURANTS, createDiningCard);
    renderGrid('stay-grid', LOCAL_HOTELS, createHotelCard);
}

/**
 * Generic render function for grid
 */
function renderGrid(elementId, data, cardCreator) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    grid.innerHTML = data.map(item => cardCreator(item)).join('');
}

/**
 * HTML Generators
 */

function createClubCard(item) {
    return `
        <article class="lifestyle-card" style="background-image: linear-gradient(to top, rgba(0,0,0,0.9), transparent), url('${item.image}');">
            <div class="card-content">
                <div class="card-tag">${item.type}</div>
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-meta">
                    <span class="location"><i class="location-icon"></i> ${item.city}</span>
                </div>
                <a href="${item.link}" target="_blank" class="card-link">Explore <span class="arrow">→</span></a>
            </div>
        </article>
    `;
}

function createDiningCard(item) {
    return `
        <article class="lifestyle-card" style="background-image: linear-gradient(to top, rgba(0,0,0,0.9), transparent), url('${item.image}');">
            <div class="card-content">
                <div class="card-top-row">
                    <div class="card-tag">${item.type}</div>
                    <div class="card-price">${item.price}</div>
                </div>
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-meta">
                    <span class="location">${item.city}</span>
                </div>
                <a href="${item.link}" target="_blank" class="card-link">Reserve Table <span class="arrow">→</span></a>
            </div>
        </article>
    `;
}

function createHotelCard(item) {
    return `
        <article class="lifestyle-card" style="background-image: linear-gradient(to top, rgba(0,0,0,0.9), transparent), url('${item.image}');">
            <div class="card-content">
                <div class="card-tag">${item.stars} Stars</div>
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <ul class="card-features">
                    ${item.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
                <a href="${item.link}" target="_blank" class="card-link">Book Now <span class="arrow">→</span></a>
            </div>
        </article>
    `;
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', loadLifestyleContent);
