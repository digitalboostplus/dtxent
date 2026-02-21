import { LOCAL_CLUBS, LOCAL_RESTAURANTS, LOCAL_HOTELS } from './events-data.js';
import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Loads lifestyle data from Firestore first, falls back to LOCAL_* arrays.
 */
async function loadFromFirestore(collectionName) {
    try {
        const q = query(collection(db, collectionName), orderBy('sortOrder', 'asc'));
        const snapshot = await getDocs(q);
        const items = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.isPublished !== false);
        return items.length > 0 ? items : null;
    } catch (error) {
        console.warn(`Firestore ${collectionName} load failed, using local data:`, error);
        return null;
    }
}

/**
 * Loads and renders lifestyle content (Clubs, Dining, Hotels)
 * Tries Firestore first, falls back to local data
 */
export async function loadLifestyleContent() {
    const [firestoreClubs, firestoreRestaurants, firestoreHotels] = await Promise.allSettled([
        loadFromFirestore('clubs'),
        loadFromFirestore('restaurants'),
        loadFromFirestore('hotels')
    ]);

    const clubs = (firestoreClubs.status === 'fulfilled' && firestoreClubs.value) || LOCAL_CLUBS;
    const restaurants = (firestoreRestaurants.status === 'fulfilled' && firestoreRestaurants.value) || LOCAL_RESTAURANTS;
    const hotels = (firestoreHotels.status === 'fulfilled' && firestoreHotels.value) || LOCAL_HOTELS;

    renderGrid('nightlife-grid', clubs, createClubCard);
    renderGrid('dining-grid', restaurants, createDiningCard);
    renderGrid('stay-grid', hotels, createHotelCard);
}

/**
 * Generic render function for grid
 */
function renderGrid(elementId, data, cardCreator) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    try {
        if (!data || data.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No content available at this time.</p>';
            return;
        }
        grid.innerHTML = data.map(item => cardCreator(item)).join('');
    } catch (err) {
        console.error(`Error rendering ${elementId}:`, err);
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Unable to load content. Please try again later.</p>';
    }
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
                <a href="${item.link}" target="_blank" class="card-link">Explore <span class="arrow">&rarr;</span></a>
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
                    <div class="card-price">${item.price || ''}</div>
                </div>
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-meta">
                    <span class="location">${item.city}</span>
                </div>
                <a href="${item.link}" target="_blank" class="card-link">Reserve Table <span class="arrow">&rarr;</span></a>
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
                    ${(item.features || []).map(f => `<li>${f}</li>`).join('')}
                </ul>
                <a href="${item.link}" target="_blank" class="card-link">Book Now <span class="arrow">&rarr;</span></a>
            </div>
        </article>
    `;
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', loadLifestyleContent);
