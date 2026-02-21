// Admin Settings - Site Configuration Management
import { db, auth } from '../js/firebase-config.js';
import { requireAdminAccess, signOut } from '../js/auth.js';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    addDoc,
    query,
    orderBy,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const adminApp = document.getElementById('admin-app');
const adminEmail = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const toastContainer = document.getElementById('toast-container');

// Lifestyle Modal Elements
const lifestyleModal = document.getElementById('lifestyle-modal');
const lifestyleModalTitle = document.getElementById('lifestyle-modal-title');
const lifestyleForm = document.getElementById('lifestyle-form');
const lifestyleModalClose = document.getElementById('lifestyle-modal-close');
const lifestyleModalCancel = document.getElementById('lifestyle-modal-cancel');
const lifestyleSubmitBtn = document.getElementById('lifestyle-submit-btn');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteCancel = document.getElementById('delete-cancel');
const deleteConfirm = document.getElementById('delete-confirm');

// State
let currentUserEmail = '';
let currentLifestyleCollection = '';
let editingLifestyleId = null;
let deletingItem = null; // { collection, id }

// Lifestyle data cache
let lifestyleData = {
    clubs: [],
    restaurants: [],
    hotels: []
};

// Initialize
async function init() {
    try {
        const user = await requireAdminAccess('/admin/login.html');
        // Only admin and owner can access settings
        if (user.role === 'editor') {
            window.location.href = '/admin/index.html?error=insufficient_permissions';
            throw new Error('Insufficient permissions');
        }
        currentUserEmail = user.email;
        adminEmail.textContent = user.email;
        hideLoading();
        showApp();
        setupEventListeners();
        await loadAllConfig();
    } catch (error) {
        console.error('Auth error:', error);
        hideLoading();
        if (!error.message.includes('Not authenticated') && !error.message.includes('Insufficient')) {
            alert('Authentication Error: ' + error.message);
        }
    }
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showApp() {
    adminApp.style.display = 'flex';
}

// Event Listeners
function setupEventListeners() {
    logoutBtn.addEventListener('click', handleLogout);

    // Tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Save buttons
    document.getElementById('save-hero').addEventListener('click', saveHero);
    document.getElementById('save-sections').addEventListener('click', saveSections);
    document.getElementById('save-social').addEventListener('click', saveSocial);
    document.getElementById('save-footer').addEventListener('click', saveFooter);
    document.getElementById('save-newsletter').addEventListener('click', saveNewsletter);
    document.getElementById('save-seo').addEventListener('click', saveSeo);
    document.getElementById('save-theme').addEventListener('click', saveTheme);

    // Color picker sync
    syncColorPicker('theme-primary', 'theme-primary-hex');
    syncColorPicker('theme-primary-hover', 'theme-primary-hover-hex');
    syncColorPicker('theme-dark-bg', 'theme-dark-bg-hex');
    syncColorPicker('theme-card-bg', 'theme-card-bg-hex');

    // Lifestyle add buttons
    document.getElementById('add-club-btn').addEventListener('click', () => openLifestyleModal('clubs'));
    document.getElementById('add-restaurant-btn').addEventListener('click', () => openLifestyleModal('restaurants'));
    document.getElementById('add-hotel-btn').addEventListener('click', () => openLifestyleModal('hotels'));

    // Lifestyle modal
    lifestyleModalClose.addEventListener('click', closeLifestyleModal);
    lifestyleModalCancel.addEventListener('click', closeLifestyleModal);
    lifestyleModal.addEventListener('click', (e) => {
        if (e.target === lifestyleModal) closeLifestyleModal();
    });
    lifestyleForm.addEventListener('submit', handleLifestyleSubmit);

    // Delete modal
    deleteCancel.addEventListener('click', closeDeleteModal);
    deleteConfirm.addEventListener('click', handleDeleteConfirm);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLifestyleModal();
            closeDeleteModal();
        }
    });
}

function syncColorPicker(colorId, hexId) {
    const colorInput = document.getElementById(colorId);
    const hexInput = document.getElementById(hexId);
    colorInput.addEventListener('input', () => {
        hexInput.value = colorInput.value.toUpperCase();
    });
    hexInput.addEventListener('input', () => {
        const val = hexInput.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            colorInput.value = val;
        }
    });
}

async function handleLogout() {
    try {
        await signOut();
        window.location.href = '/admin/login.html';
    } catch (error) {
        showToast('Error signing out', 'error');
    }
}

// ============================================
// Load All Configuration
// ============================================
async function loadAllConfig() {
    try {
        const [hero, sections, social, footer, newsletter, seo, theme] = await Promise.allSettled([
            getDoc(doc(db, 'siteConfig', 'hero')),
            getDoc(doc(db, 'siteConfig', 'sections')),
            getDoc(doc(db, 'siteConfig', 'social')),
            getDoc(doc(db, 'siteConfig', 'footer')),
            getDoc(doc(db, 'siteConfig', 'newsletter')),
            getDoc(doc(db, 'siteConfig', 'seo')),
            getDoc(doc(db, 'siteConfig', 'theme'))
        ]);

        if (hero.status === 'fulfilled' && hero.value.exists()) populateHero(hero.value.data());
        if (sections.status === 'fulfilled' && sections.value.exists()) populateSections(sections.value.data());
        if (social.status === 'fulfilled' && social.value.exists()) populateSocial(social.value.data());
        if (footer.status === 'fulfilled' && footer.value.exists()) populateFooter(footer.value.data());
        if (newsletter.status === 'fulfilled' && newsletter.value.exists()) populateNewsletter(newsletter.value.data());
        if (seo.status === 'fulfilled' && seo.value.exists()) populateSeo(seo.value.data());
        if (theme.status === 'fulfilled' && theme.value.exists()) populateTheme(theme.value.data());

        // Load lifestyle collections
        await Promise.allSettled([
            loadLifestyleCollection('clubs'),
            loadLifestyleCollection('restaurants'),
            loadLifestyleCollection('hotels')
        ]);
    } catch (error) {
        console.error('Error loading config:', error);
        showToast('Error loading settings', 'error');
    }
}

// ============================================
// Populate Forms
// ============================================
function populateHero(data) {
    if (data.title) document.getElementById('hero-title').value = data.title;
    if (data.highlightedText) document.getElementById('hero-highlighted').value = data.highlightedText;
    if (data.subtitle) document.getElementById('hero-subtitle').value = data.subtitle;
    if (data.ctaText) document.getElementById('hero-cta-text').value = data.ctaText;
    if (data.ctaLink) document.getElementById('hero-cta-link').value = data.ctaLink;
    if (data.backgroundImageUrl) document.getElementById('hero-bg-url').value = data.backgroundImageUrl;
}

function populateSections(data) {
    const sectionKeys = ['upcoming', 'nightlife', 'dining', 'stay', 'newsletter'];
    sectionKeys.forEach(key => {
        const card = document.querySelector(`.settings-card[data-section="${key}"]`);
        if (!card || !data[key]) return;
        const s = data[key];
        if (s.title) card.querySelector('.section-title-input').value = s.title;
        if (s.highlightedWord) card.querySelector('.section-highlight-input').value = s.highlightedWord;
        if (s.description) card.querySelector('.section-desc-input').value = s.description;
    });
}

function populateSocial(data) {
    if (data.facebook) document.getElementById('social-facebook').value = data.facebook;
    if (data.instagram) document.getElementById('social-instagram').value = data.instagram;
    if (data.twitter) document.getElementById('social-twitter').value = data.twitter;
}

function populateFooter(data) {
    if (data.copyrightText) document.getElementById('footer-copyright').value = data.copyrightText;
}

function populateNewsletter(data) {
    if (data.placeholderText) document.getElementById('newsletter-placeholder').value = data.placeholderText;
    if (data.buttonText) document.getElementById('newsletter-button').value = data.buttonText;
}

function populateSeo(data) {
    if (data.pageTitle) document.getElementById('seo-title').value = data.pageTitle;
    if (data.metaDescription) document.getElementById('seo-description').value = data.metaDescription;
    if (data.keywords) document.getElementById('seo-keywords').value = data.keywords;
    if (data.ogImageUrl) document.getElementById('seo-og-image').value = data.ogImageUrl;
}

function populateTheme(data) {
    const fields = [
        { key: 'primaryColor', color: 'theme-primary', hex: 'theme-primary-hex' },
        { key: 'primaryHoverColor', color: 'theme-primary-hover', hex: 'theme-primary-hover-hex' },
        { key: 'darkBgColor', color: 'theme-dark-bg', hex: 'theme-dark-bg-hex' },
        { key: 'cardBgColor', color: 'theme-card-bg', hex: 'theme-card-bg-hex' }
    ];
    fields.forEach(f => {
        if (data[f.key]) {
            document.getElementById(f.color).value = data[f.key];
            document.getElementById(f.hex).value = data[f.key].toUpperCase();
        }
    });
}

// ============================================
// Save Config Handlers
// ============================================
async function saveHero() {
    const data = {
        title: document.getElementById('hero-title').value.trim(),
        highlightedText: document.getElementById('hero-highlighted').value.trim(),
        subtitle: document.getElementById('hero-subtitle').value.trim(),
        ctaText: document.getElementById('hero-cta-text').value.trim(),
        ctaLink: document.getElementById('hero-cta-link').value.trim(),
        backgroundImageUrl: document.getElementById('hero-bg-url').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('hero', data, 'Hero settings saved!');
}

async function saveSections() {
    const data = { updatedAt: serverTimestamp(), updatedBy: currentUserEmail };
    const sectionKeys = ['upcoming', 'nightlife', 'dining', 'stay', 'newsletter'];
    sectionKeys.forEach(key => {
        const card = document.querySelector(`.settings-card[data-section="${key}"]`);
        if (!card) return;
        data[key] = {
            title: card.querySelector('.section-title-input').value.trim(),
            highlightedWord: card.querySelector('.section-highlight-input').value.trim(),
            description: card.querySelector('.section-desc-input').value.trim()
        };
    });
    await saveConfig('sections', data, 'Section headers saved!');
}

async function saveSocial() {
    const data = {
        facebook: document.getElementById('social-facebook').value.trim(),
        instagram: document.getElementById('social-instagram').value.trim(),
        twitter: document.getElementById('social-twitter').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('social', data, 'Social links saved!');
}

async function saveFooter() {
    const data = {
        copyrightText: document.getElementById('footer-copyright').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('footer', data, 'Footer saved!');
}

async function saveNewsletter() {
    const data = {
        placeholderText: document.getElementById('newsletter-placeholder').value.trim(),
        buttonText: document.getElementById('newsletter-button').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('newsletter', data, 'Newsletter settings saved!');
}

async function saveSeo() {
    const data = {
        pageTitle: document.getElementById('seo-title').value.trim(),
        metaDescription: document.getElementById('seo-description').value.trim(),
        keywords: document.getElementById('seo-keywords').value.trim(),
        ogImageUrl: document.getElementById('seo-og-image').value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('seo', data, 'SEO settings saved!');
}

async function saveTheme() {
    const data = {
        primaryColor: document.getElementById('theme-primary').value,
        primaryHoverColor: document.getElementById('theme-primary-hover').value,
        darkBgColor: document.getElementById('theme-dark-bg').value,
        cardBgColor: document.getElementById('theme-card-bg').value,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
    };
    await saveConfig('theme', data, 'Theme colors saved!');
}

async function saveConfig(docId, data, successMsg) {
    try {
        await setDoc(doc(db, 'siteConfig', docId), data, { merge: true });
        showToast(successMsg, 'success');
    } catch (error) {
        console.error(`Error saving ${docId}:`, error);
        showToast(`Error saving ${docId} settings.`, 'error');
    }
}

// ============================================
// Lifestyle Collection CRUD
// ============================================
async function loadLifestyleCollection(collectionName) {
    try {
        const q = query(collection(db, collectionName), orderBy('sortOrder', 'asc'));
        const snapshot = await getDocs(q);
        lifestyleData[collectionName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLifestyleGrid(collectionName);
    } catch (error) {
        console.error(`Error loading ${collectionName}:`, error);
        // Collection may not exist yet, that's fine
        lifestyleData[collectionName] = [];
        renderLifestyleGrid(collectionName);
    }
}

function renderLifestyleGrid(collectionName) {
    const gridId = collectionName === 'clubs' ? 'clubs-grid' :
                   collectionName === 'restaurants' ? 'restaurants-grid' : 'hotels-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const items = lifestyleData[collectionName];
    if (items.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No items yet. Click the button above to add one.</p>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="lifestyle-admin-card">
            ${item.image ? `<img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}" class="lifestyle-admin-card-image">` : ''}
            <div class="lifestyle-admin-card-body">
                <h4>${escapeHtml(item.name)}</h4>
                <div class="card-meta-text">
                    ${item.type ? escapeHtml(item.type) : ''} ${item.city ? '&middot; ' + escapeHtml(item.city) : ''}
                    ${item.isPublished === false ? ' &middot; <span style="color: var(--primary);">Draft</span>' : ''}
                </div>
            </div>
            <div class="lifestyle-admin-card-actions">
                <button class="btn-icon edit ls-edit-btn" data-collection="${collectionName}" data-id="${item.id}" title="Edit">&#9998;</button>
                <button class="btn-icon delete ls-delete-btn" data-collection="${collectionName}" data-id="${item.id}" title="Delete">&#128465;</button>
            </div>
        </div>
    `).join('');

    // Attach listeners
    grid.querySelectorAll('.ls-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const col = btn.dataset.collection;
            const id = btn.dataset.id;
            const item = lifestyleData[col].find(i => i.id === id);
            if (item) openLifestyleModal(col, item);
        });
    });

    grid.querySelectorAll('.ls-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deletingItem = { collection: btn.dataset.collection, id: btn.dataset.id };
            deleteModal.classList.add('active');
        });
    });
}

function openLifestyleModal(collectionName, item = null) {
    currentLifestyleCollection = collectionName;
    editingLifestyleId = item?.id || null;

    const typeLabel = collectionName === 'clubs' ? 'Club' :
                      collectionName === 'restaurants' ? 'Restaurant' : 'Hotel';
    lifestyleModalTitle.textContent = item ? `Edit ${typeLabel}` : `Add ${typeLabel}`;
    lifestyleSubmitBtn.querySelector('.btn-text').textContent = item ? 'Update' : 'Save';

    if (item) {
        document.getElementById('ls-name').value = item.name || '';
        document.getElementById('ls-type').value = item.type || '';
        document.getElementById('ls-city').value = item.city || '';
        document.getElementById('ls-description').value = item.description || '';
        document.getElementById('ls-image').value = item.image || '';
        document.getElementById('ls-link').value = item.link || '';
        document.getElementById('ls-price').value = item.price || '';
        document.getElementById('ls-stars').value = item.stars || '';
        document.getElementById('ls-features').value = (item.features || []).join(', ');
        document.getElementById('ls-sort-order').value = item.sortOrder ?? 0;
        document.getElementById('ls-published').checked = item.isPublished !== false;
    } else {
        lifestyleForm.reset();
        document.getElementById('ls-published').checked = true;
        document.getElementById('ls-sort-order').value = 0;
    }

    lifestyleModal.classList.add('active');
}

function closeLifestyleModal() {
    lifestyleModal.classList.remove('active');
    editingLifestyleId = null;
    currentLifestyleCollection = '';
    lifestyleForm.reset();
}

async function handleLifestyleSubmit(e) {
    e.preventDefault();

    const btnText = lifestyleSubmitBtn.querySelector('.btn-text');
    const btnLoading = lifestyleSubmitBtn.querySelector('.btn-loading');
    lifestyleSubmitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
        const featuresStr = document.getElementById('ls-features').value.trim();
        const colToReload = currentLifestyleCollection;
        const data = {
            name: document.getElementById('ls-name').value.trim(),
            type: document.getElementById('ls-type').value.trim(),
            city: document.getElementById('ls-city').value.trim(),
            description: document.getElementById('ls-description').value.trim(),
            image: document.getElementById('ls-image').value.trim(),
            link: document.getElementById('ls-link').value.trim(),
            price: document.getElementById('ls-price').value.trim(),
            stars: parseInt(document.getElementById('ls-stars').value) || null,
            features: featuresStr ? featuresStr.split(',').map(f => f.trim()).filter(Boolean) : [],
            sortOrder: parseInt(document.getElementById('ls-sort-order').value) || 0,
            isPublished: document.getElementById('ls-published').checked,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail
        };

        if (editingLifestyleId) {
            await setDoc(doc(db, colToReload, editingLifestyleId), data, { merge: true });
            showToast('Item updated!', 'success');
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, colToReload), data);
            showToast('Item added!', 'success');
        }

        closeLifestyleModal();
        await loadLifestyleCollection(colToReload);
    } catch (error) {
        console.error('Error saving lifestyle item:', error);
        showToast('Error saving item.', 'error');
    } finally {
        lifestyleSubmitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deletingItem = null;
}

async function handleDeleteConfirm() {
    if (!deletingItem) return;

    try {
        await deleteDoc(doc(db, deletingItem.collection, deletingItem.id));
        showToast('Item deleted!', 'success');
        const col = deletingItem.collection;
        closeDeleteModal();
        await loadLifestyleCollection(col);
    } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Error deleting item.', 'error');
    }
}

// ============================================
// UI Helpers
// ============================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function escapeAttr(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Start
init();
