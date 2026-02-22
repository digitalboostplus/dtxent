import { LOCAL_CLUBS, LOCAL_RESTAURANTS, LOCAL_HOTELS, DINING_RESTAURANTS } from './events-data.js';
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

    // For featured dining, we use a specialized renderer that handles the premium look
    // If we have firestoreRestaurants, we'll try to use those if they are marked as featured
    const firestoreFeatured = restaurants.filter(r => r.featured);
    if (firestoreFeatured.length > 0) {
        renderFeaturedDining(firestoreFeatured);
    } else {
        // Fallback to DINING_RESTAURANTS which has the enhanced metadata
        renderFeaturedDining(DINING_RESTAURANTS);
    }

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
 * Render 3-4 featured dining cards with logo-on-gradient style
 * @param {Array} dataSource - Array of restaurant objects
 */
function renderFeaturedDining(dataSource = DINING_RESTAURANTS) {
    const grid = document.getElementById('dining-grid');
    if (!grid) return;

    const featured = dataSource.filter(r => r.featured).slice(0, 4);
    if (featured.length === 0) {
        // Ultimate fallback to generic cards if no featured found
        renderGrid('dining-grid', dataSource, createDiningCard);
        return;
    }

    grid.innerHTML = featured.map(r => createFeaturedDiningCard(r)).join('');
}

function createFeaturedDiningCard(r) {
    const logoSrc = `assets/dining/logos/${r.logoFile}`;
    const bgImgSrc = r.imageFile ? `assets/dining/${r.imageFile}` : null;
    const websiteUrl = r.website ? (r.website.startsWith('http') ? r.website : `https://${r.website}`) : null;
    const ctaHref = websiteUrl || `https://instagram.com/${r.instagram}`;

    const bgStyle = bgImgSrc
        ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.8)), url('${bgImgSrc}');`
        : `background: linear-gradient(135deg, #1a1205 0%, #161616 40%, #1a1a1a 100%);`;

    return `
        <article class="lifestyle-card featured-dining-card" style="${bgStyle}">
            <div class="card-content">
                <div class="card-top-row">
                    <div class="card-tag">${r.category}</div>
                    <div class="dining-followers">${r.followers} followers</div>
                </div>
                <div class="featured-logo-holder">
                    <img src="${logoSrc}" alt="${r.name} logo" loading="lazy" width="140" height="70">
                </div>
                <h3 class="card-title">${r.name}</h3>
                <p class="card-desc">${r.bio}</p>
                <a href="${ctaHref}" target="_blank" rel="noopener noreferrer" class="card-link">Visit <span class="arrow">&rarr;</span></a>
            </div>
        </article>
    `;
}

/**
 * HTML Generators
 */

function createClubCard(item) {
    const logoSrc = item.logoFile ? `assets/dining/logos/${item.logoFile}` : null;

    return `
        <article class="lifestyle-card featured-nightlife-card" style="background: linear-gradient(135deg, #0d0d1a 0%, #161616 40%, #1a1a1a 100%);">
            <div class="card-content">
                <div class="card-top-row">
                    <div class="card-tag">${item.type}</div>
                    <div class="dining-followers">${item.city}</div>
                </div>
                ${logoSrc ? `<div class="featured-logo-holder"><img src="${logoSrc}" alt="${item.name} logo" loading="lazy" width="140" height="70"></div>` : ''}
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-meta">
                    <span class="location"><i class="location-icon"></i> ${item.city}</span>
                </div>
                <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="card-link">Explore <span class="arrow">&rarr;</span></a>
            </div>
        </article>
    `;
}

function createDiningCard(item) {
    return `
        <article class="lifestyle-card">
            <div class="card-image">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="card-tag">${item.type}</div>
            </div>
            <div class="card-body">
                <div class="card-header">
                    <h3 class="card-title">${item.name}</h3>
                    <span class="card-price">${item.price}</span>
                </div>
                <p class="card-desc">${item.description}</p>
                <div class="card-footer">
                    <span class="location">${item.city}</span>
                    <a href="${item.link}" class="btn btn-sm btn-outline" target="_blank">Menu</a>
                </div>
            </div>
        </article>
    `;
}

function createHotelCard(item) {
    return `
        <article class="lifestyle-card">
            <div class="card-image">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="card-tag">${item.stars} Stars</div>
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.name}</h3>
                <p class="card-desc">${item.description}</p>
                <div class="card-features">
                    ${item.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
                </div>
                <div class="card-footer">
                    <span class="location">${item.city}</span>
                    <a href="${item.link}" class="btn btn-sm btn-primary" target="_blank">Book Now</a>
                </div>
            </div>
        </article>
    `;
}

// Auto-load on DOM ready
document.addEventListener('DOMContentLoaded', loadLifestyleContent);
