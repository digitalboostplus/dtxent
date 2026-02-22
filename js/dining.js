import { DINING_RESTAURANTS } from './events-data.js';

const CATEGORIES = [
    'All',
    'Fine Dining',
    'Steakhouse',
    'Seafood',
    'Brunch & Cafe',
    'Cocktail Bar',
    'Unique Experiences'
];

let activeCategory = 'All';

function init() {
    renderFilterBar();
    renderGrid();
    syncFromURL();
    setupGSAP();
}

/* ========================================
   FILTER BAR
   ======================================== */
function renderFilterBar() {
    const inner = document.querySelector('.filter-inner');
    if (!inner) return;

    const pills = CATEGORIES.map(cat => {
        const count = cat === 'All'
            ? DINING_RESTAURANTS.length
            : DINING_RESTAURANTS.filter(r => r.category === cat).length;
        return `<button class="filter-pill${cat === activeCategory ? ' active' : ''}"
                    data-category="${cat}"
                    aria-pressed="${cat === activeCategory}">${cat} (${count})</button>`;
    }).join('');

    const countEl = `<span class="filter-count" aria-live="polite">Showing ${DINING_RESTAURANTS.length} of ${DINING_RESTAURANTS.length} restaurants</span>`;

    inner.innerHTML = pills + countEl;

    inner.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        setCategory(pill.dataset.category);
    });
}

function setCategory(category) {
    activeCategory = category;

    // Update pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
        const isActive = pill.dataset.category === category;
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-pressed', isActive);
    });

    // Update URL
    const url = new URL(window.location);
    if (category === 'All') {
        url.searchParams.delete('category');
    } else {
        url.searchParams.set('category', category);
    }
    history.replaceState(null, '', url);

    filterCards();
}

function filterCards() {
    const wrappers = document.querySelectorAll('.dining-card-wrapper');
    let visibleCount = 0;

    wrappers.forEach(wrapper => {
        const cat = wrapper.dataset.category;
        const show = activeCategory === 'All' || cat === activeCategory;

        if (show) {
            wrapper.classList.remove('hidden');
            visibleCount++;
        } else {
            wrapper.classList.add('hidden');
        }
    });

    // Update count
    const countEl = document.querySelector('.filter-count');
    if (countEl) {
        countEl.textContent = `Showing ${visibleCount} of ${DINING_RESTAURANTS.length} restaurants`;
    }

    // Re-trigger GSAP if available
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
    }
}

function syncFromURL() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat && CATEGORIES.includes(cat)) {
        setCategory(cat);
    }
}

/* ========================================
   RESTAURANT GRID
   ======================================== */
function renderGrid() {
    const grid = document.getElementById('dining-grid');
    if (!grid) return;

    grid.innerHTML = DINING_RESTAURANTS.map(r => createCard(r)).join('');
}

function createCard(r) {
    const logoSrc = `../assets/dining/logos/${r.logoFile}`;
    const websiteUrl = r.website ? (r.website.startsWith('http') ? r.website : `https://${r.website}`) : null;

    const phoneHtml = r.phone
        ? `<a href="tel:${r.phone.replace(/[^\d+]/g, '')}">${r.phone}</a>`
        : '';
    const websiteHtml = websiteUrl
        ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';

    const ctaHref = websiteUrl || `https://instagram.com/${r.instagram}`;

    return `
        <div class="dining-card-wrapper" data-category="${r.category}">
            <article class="dining-card">
                <div class="dining-card-header">
                    <span class="dining-category-pill">${r.category}</span>
                    <span class="dining-followers">${r.followers}</span>
                </div>

                <div class="dining-logo-holder">
                    <img src="${logoSrc}"
                         alt="${r.name} logo"
                         loading="lazy"
                         width="160" height="80">
                </div>

                <h3 class="dining-card-name">${r.name}</h3>
                ${r.address ? `<p class="dining-card-address">${r.address}</p>` : ''}
                <p class="dining-card-bio">${r.bio}</p>

                ${(phoneHtml || websiteHtml) ? `
                <div class="dining-card-contact">
                    ${phoneHtml}
                    ${websiteHtml}
                </div>` : ''}

                <hr class="dining-card-divider">
                <a href="${ctaHref}" target="_blank" rel="noopener noreferrer" class="dining-card-cta">
                    Visit ${websiteUrl ? 'Website' : 'Instagram'} <span class="arrow">&rarr;</span>
                </a>
            </article>
        </div>
    `;
}

/* ========================================
   GSAP SCROLL ANIMATIONS
   ======================================== */
function setupGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    // Stagger cards on scroll
    gsap.utils.toArray('.dining-card-wrapper').forEach((card, i) => {
        gsap.from(card, {
            y: 40,
            opacity: 0,
            duration: 0.6,
            delay: (i % 3) * 0.1,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                once: true
            }
        });
    });

    // Hero text
    gsap.from('.dining-hero-content', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
}

/* ========================================
   INIT
   ======================================== */
document.addEventListener('DOMContentLoaded', init);
