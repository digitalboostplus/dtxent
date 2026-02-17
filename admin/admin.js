// Admin Dashboard - Event Management
import { db, storage, auth } from '../js/firebase-config.js';
import { requireAdminAccess, signOut, onAuthStateChanged } from '../js/auth.js';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const adminApp = document.getElementById('admin-app');
const adminEmail = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const eventsList = document.getElementById('events-list');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const addEventBtn = document.getElementById('add-event-btn');
const addFirstEventBtn = document.getElementById('add-first-event-btn');

// Schedule Elements
const scheduleContainer = document.getElementById('schedule-container');
const addScheduleBtn = document.getElementById('add-schedule-btn');

// Dates Elements
const datesContainer = document.getElementById('dates-container');
const addDateBtn = document.getElementById('add-date-btn');

// Image Type Elements
const imageTypeRadios = document.getElementsByName('imageType');
const externalUrlInput = document.getElementById('externalImageUrl');
const externalImagePreview = document.getElementById('external-image-preview');
const imageUrlInputContainer = document.getElementById('image-url-input');

// Modal Elements
const eventModal = document.getElementById('event-modal');
const modalTitle = document.getElementById('modal-title');
const eventForm = document.getElementById('event-form');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteCancel = document.getElementById('delete-cancel');
const deleteConfirm = document.getElementById('delete-confirm');

// Image Upload Elements
const imageUploadArea = document.getElementById('image-upload-area');
const imageInput = document.getElementById('eventImage');
const imagePreview = document.getElementById('image-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');

// Filter Elements
const filterSearch = document.getElementById('filter-search');
const filterStatus = document.getElementById('filter-status');
const filterVenue = document.getElementById('filter-venue');
const filterSort = document.getElementById('filter-sort');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const selectAllCheckbox = document.getElementById('select-all-checkbox');

// Bulk Elements
const bulkToolbar = document.getElementById('bulk-toolbar');
const bulkCount = document.getElementById('bulk-count');
const bulkPublishBtn = document.getElementById('bulk-publish-btn');
const bulkUnpublishBtn = document.getElementById('bulk-unpublish-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
const bulkDeleteModal = document.getElementById('bulk-delete-modal');
const bulkDeleteCancel = document.getElementById('bulk-delete-cancel');
const bulkDeleteConfirm = document.getElementById('bulk-delete-confirm');
const bulkDeleteMsg = document.getElementById('bulk-delete-msg');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statUpcoming = document.getElementById('stat-upcoming');
const statPast = document.getElementById('stat-past');
const statDrafts = document.getElementById('stat-drafts');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// State
let events = [];
let editingEventId = null;
let deletingEventId = null;
let deletingImagePath = null;
let selectedImageFile = null;
let selectedEventIds = new Set();
let currentUserRole = 'editor';

// Filter State
let filterState = {
    search: '',
    status: 'all',
    venue: 'all',
    sort: 'date-asc',
    dateFrom: '',
    dateTo: ''
};

// Month abbreviations
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Debounce helper
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Initialize
async function init() {
    try {
        const user = await requireAdminAccess('/admin/login.html');
        currentUserRole = user.role;
        adminEmail.textContent = user.email;
        hideLoading();
        showApp();
        await loadEvents();
        setupEventListeners();
    } catch (error) {
        console.error('Auth error:', error);
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
    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Add Event buttons
    addEventBtn.addEventListener('click', () => openModal());
    addFirstEventBtn.addEventListener('click', () => openModal());

    // Modal controls
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeModal();
    });

    // Form submission
    eventForm.addEventListener('submit', handleSubmit);

    // Image upload
    imageUploadArea.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);
    imageUploadArea.addEventListener('dragover', handleDragOver);
    imageUploadArea.addEventListener('drop', handleDrop);

    // Schedule handling
    addScheduleBtn.addEventListener('click', () => addScheduleItem());
    scheduleContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-schedule')) {
            e.target.parentElement.remove();
        }
    });

    // Dates handling
    addDateBtn.addEventListener('click', () => addDateItem());
    datesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-date')) {
            e.target.parentElement.remove();
        }
    });

    // Image Type Toggle
    imageTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => toggleImageType(e.target.value));
    });

    // External Image Preview
    externalUrlInput.addEventListener('input', (e) => {
        const url = e.target.value;
        if (url) {
            externalImagePreview.src = url;
            externalImagePreview.style.display = 'block';
            externalImagePreview.classList.add('visible');
        } else {
            externalImagePreview.style.display = 'none';
        }
    });

    // Delete modal
    deleteCancel.addEventListener('click', closeDeleteModal);
    deleteConfirm.addEventListener('click', handleDeleteConfirm);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Filter listeners
    filterSearch.addEventListener('input', debounce(() => {
        filterState.search = filterSearch.value.trim().toLowerCase();
        renderEvents();
    }, 150));

    filterStatus.addEventListener('change', () => {
        filterState.status = filterStatus.value;
        renderEvents();
    });

    filterVenue.addEventListener('change', () => {
        filterState.venue = filterVenue.value;
        renderEvents();
    });

    filterSort.addEventListener('change', () => {
        filterState.sort = filterSort.value;
        renderEvents();
    });

    filterDateFrom.addEventListener('change', () => {
        filterState.dateFrom = filterDateFrom.value;
        renderEvents();
    });

    filterDateTo.addEventListener('change', () => {
        filterState.dateTo = filterDateTo.value;
        renderEvents();
    });

    clearFiltersBtn.addEventListener('click', clearFilters);

    // Select All
    selectAllCheckbox.addEventListener('change', () => {
        const filtered = getFilteredEvents();
        if (selectAllCheckbox.checked) {
            filtered.forEach(e => selectedEventIds.add(e.id));
        } else {
            filtered.forEach(e => selectedEventIds.delete(e.id));
        }
        updateCheckboxes();
        updateBulkToolbar();
    });

    // Bulk actions
    bulkPublishBtn.addEventListener('click', handleBulkPublish);
    bulkUnpublishBtn.addEventListener('click', handleBulkUnpublish);
    bulkDeleteBtn.addEventListener('click', () => {
        bulkDeleteMsg.textContent = `This will permanently delete ${selectedEventIds.size} event(s) and their images. This cannot be undone.`;
        bulkDeleteModal.classList.add('active');
    });
    bulkCancelBtn.addEventListener('click', clearSelection);
    bulkDeleteCancel.addEventListener('click', () => bulkDeleteModal.classList.remove('active'));
    bulkDeleteConfirm.addEventListener('click', handleBulkDelete);
    bulkDeleteModal.addEventListener('click', (e) => {
        if (e.target === bulkDeleteModal) bulkDeleteModal.classList.remove('active');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
            bulkDeleteModal.classList.remove('active');
        }
    });
}

// Filters
function clearFilters() {
    filterSearch.value = '';
    filterStatus.value = 'all';
    filterVenue.value = 'all';
    filterSort.value = 'date-asc';
    filterDateFrom.value = '';
    filterDateTo.value = '';
    filterState = { search: '', status: 'all', venue: 'all', sort: 'date-asc', dateFrom: '', dateTo: '' };
    renderEvents();
}

function getFilteredEvents() {
    let filtered = [...events];
    const now = new Date();

    // Text search
    if (filterState.search) {
        const q = filterState.search;
        filtered = filtered.filter(e =>
            (e.artistName || '').toLowerCase().includes(q) ||
            (e.eventName || '').toLowerCase().includes(q) ||
            (e.venueName || '').toLowerCase().includes(q) ||
            (e.venueCity || '').toLowerCase().includes(q)
        );
    }

    // Status filter
    if (filterState.status === 'published') {
        filtered = filtered.filter(e => e.isPublished);
    } else if (filterState.status === 'draft') {
        filtered = filtered.filter(e => !e.isPublished);
    }

    // Venue filter
    if (filterState.venue !== 'all') {
        filtered = filtered.filter(e => e.venueName === filterState.venue);
    }

    // Date range filter
    if (filterState.dateFrom) {
        const from = new Date(filterState.dateFrom);
        filtered = filtered.filter(e => {
            const d = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);
            return d >= from;
        });
    }
    if (filterState.dateTo) {
        const to = new Date(filterState.dateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => {
            const d = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);
            return d <= to;
        });
    }

    // Sort
    filtered.sort((a, b) => {
        const dateA = a.eventDate?.toDate ? a.eventDate.toDate() : new Date(a.eventDate);
        const dateB = b.eventDate?.toDate ? b.eventDate.toDate() : new Date(b.eventDate);

        switch (filterState.sort) {
            case 'date-asc': return dateA - dateB;
            case 'date-desc': return dateB - dateA;
            case 'artist-az': return (a.artistName || '').localeCompare(b.artistName || '');
            case 'artist-za': return (b.artistName || '').localeCompare(a.artistName || '');
            case 'recent':
                const createdA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const createdB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return createdB - createdA;
            default: return 0;
        }
    });

    return filtered;
}

function populateVenueFilter() {
    const venues = [...new Set(events.map(e => e.venueName).filter(Boolean))].sort();
    filterVenue.innerHTML = '<option value="all">All Venues</option>';
    venues.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        filterVenue.appendChild(opt);
    });
    // Restore selection if still valid
    if (filterState.venue !== 'all' && venues.includes(filterState.venue)) {
        filterVenue.value = filterState.venue;
    }
}

// Stats
function updateStats() {
    const now = new Date();
    const total = events.length;
    let upcoming = 0, past = 0, drafts = 0;

    events.forEach(e => {
        const d = e.eventDate?.toDate ? e.eventDate.toDate() : new Date(e.eventDate);
        if (d >= now) upcoming++;
        else past++;
        if (!e.isPublished) drafts++;
    });

    statTotal.textContent = total;
    statUpcoming.textContent = upcoming;
    statPast.textContent = past;
    statDrafts.textContent = drafts;
}

// Logout
async function handleLogout() {
    try {
        await signOut();
        window.location.href = '/admin/login.html';
    } catch (error) {
        showToast('Error signing out', 'error');
    }
}

// Load Events from Firestore
async function loadEvents() {
    try {
        const q = query(collection(db, 'events'), orderBy('eventDate', 'asc'));
        const snapshot = await getDocs(q);
        events = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));
        populateVenueFilter();
        renderEvents();
    } catch (error) {
        console.error('Error loading events:', error);
        showToast('Error loading events', 'error');
    }
}

// Render Events List
function renderEvents() {
    updateStats();

    if (events.length === 0) {
        eventsList.innerHTML = '';
        noResultsState.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    const filtered = getFilteredEvents();

    if (filtered.length === 0) {
        eventsList.innerHTML = '';
        noResultsState.style.display = 'block';
        return;
    }

    noResultsState.style.display = 'none';
    eventsList.innerHTML = filtered.map(event => createEventCard(event)).join('');

    // Add event listeners to action buttons
    eventsList.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const eventId = btn.dataset.id;
            const event = events.find(e => e.id === eventId);
            if (event) openModal(event);
        });
    });

    eventsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentUserRole === 'editor') {
                showToast('You do not have permission to delete events.', 'error');
                return;
            }
            deletingEventId = btn.dataset.id;
            deletingImagePath = btn.dataset.imagepath;
            openDeleteModal();
        });
    });

    eventsList.querySelectorAll('.toggle-publish').forEach(btn => {
        btn.addEventListener('click', async () => {
            const eventId = btn.dataset.id;
            const currentStatus = btn.dataset.published === 'true';
            await togglePublish(eventId, currentStatus);
        });
    });

    // Checkbox listeners
    eventsList.querySelectorAll('.event-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedEventIds.add(cb.dataset.id);
            } else {
                selectedEventIds.delete(cb.dataset.id);
            }
            updateBulkToolbar();
            updateSelectAllState();
        });
    });
}

function createEventCard(event) {
    const date = event.eventDate?.toDate ? event.eventDate.toDate() : new Date(event.eventDate);
    const displayDate = `${event.displayMonth || MONTHS[date.getMonth()]} ${event.displayDay || date.getDate()}`;
    const isChecked = selectedEventIds.has(event.id) ? 'checked' : '';

    return `
        <div class="event-admin-card">
            <div class="event-checkbox-col">
                <input type="checkbox" class="event-checkbox" data-id="${event.id}" ${isChecked}>
            </div>
            <img src="${event.imageUrl || '../assets/dtxent-logo.png'}"
                 alt="${event.imageAlt || event.artistName}"
                 class="event-admin-image">
            <div class="event-admin-info">
                <h3>${escapeHtml(event.artistName)}</h3>
                <div class="event-admin-meta">
                    <span class="date">${displayDate}</span>
                    <span>${escapeHtml(event.venueFullName || `${event.venueName}, ${event.venueCity}, ${event.venueState}`)}</span>
                    <span class="status-badge ${event.isPublished ? 'published' : 'draft'}">
                        ${event.isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>
            </div>
            <div class="event-admin-actions">
                <button class="btn-icon toggle-publish"
                        data-id="${event.id}"
                        data-published="${event.isPublished}"
                        title="${event.isPublished ? 'Unpublish' : 'Publish'}">
                    ${event.isPublished ? '👁' : '👁‍🗨'}
                </button>
                <button class="btn-icon edit edit-btn" data-id="${event.id}" title="Edit">✏️</button>
                ${currentUserRole !== 'editor' ? `
                <button class="btn-icon delete delete-btn"
                        data-id="${event.id}"
                        data-imagepath="${event.imagePath || ''}"
                        title="Delete">🗑️</button>
                ` : ''}
            </div>
        </div>
    `;
}

// Bulk Operations
function updateBulkToolbar() {
    const count = selectedEventIds.size;
    if (count > 0) {
        bulkToolbar.style.display = 'flex';
        bulkCount.textContent = `${count} selected`;
    } else {
        bulkToolbar.style.display = 'none';
    }
}

function updateSelectAllState() {
    const filtered = getFilteredEvents();
    const allSelected = filtered.length > 0 && filtered.every(e => selectedEventIds.has(e.id));
    selectAllCheckbox.checked = allSelected;
}

function updateCheckboxes() {
    eventsList.querySelectorAll('.event-checkbox').forEach(cb => {
        cb.checked = selectedEventIds.has(cb.dataset.id);
    });
}

function clearSelection() {
    selectedEventIds.clear();
    selectAllCheckbox.checked = false;
    updateCheckboxes();
    updateBulkToolbar();
}

async function handleBulkPublish() {
    const ids = [...selectedEventIds];
    try {
        const results = await Promise.allSettled(
            ids.map(id => updateDoc(doc(db, 'events', id), { isPublished: true, updatedAt: serverTimestamp() }))
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            showToast(`Published ${ids.length - failed} events. ${failed} failed.`, 'error');
        } else {
            showToast(`Published ${ids.length} event(s)!`, 'success');
        }
        clearSelection();
        await loadEvents();
    } catch (error) {
        console.error('Bulk publish error:', error);
        showToast('Error publishing events.', 'error');
    }
}

async function handleBulkUnpublish() {
    const ids = [...selectedEventIds];
    try {
        const results = await Promise.allSettled(
            ids.map(id => updateDoc(doc(db, 'events', id), { isPublished: false, updatedAt: serverTimestamp() }))
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            showToast(`Unpublished ${ids.length - failed} events. ${failed} failed.`, 'error');
        } else {
            showToast(`Unpublished ${ids.length} event(s)!`, 'success');
        }
        clearSelection();
        await loadEvents();
    } catch (error) {
        console.error('Bulk unpublish error:', error);
        showToast('Error unpublishing events.', 'error');
    }
}

// Modal Functions
function toggleImageType(type) {
    if (type === 'upload') {
        imageUploadArea.style.display = 'block';
        imageUrlInputContainer.style.display = 'none';
    } else {
        imageUploadArea.style.display = 'none';
        imageUrlInputContainer.style.display = 'block';
    }
}

function addScheduleItem(time = '', description = '') {
    const div = document.createElement('div');
    div.className = 'schedule-item-row';
    div.innerHTML = `
        <input type="text" placeholder="Time" value="${escapeAttr(time)}" class="schedule-time" aria-label="Time">
        <input type="text" placeholder="Description" value="${escapeAttr(description)}" class="schedule-desc" aria-label="Description">
        <button type="button" class="btn-remove-schedule" title="Remove Item">&times;</button>
    `;
    scheduleContainer.appendChild(div);
}

function addDateItem(dateVal = '', ticketUrl = '') {
    const div = document.createElement('div');
    div.className = 'date-item-row';
    div.innerHTML = `
        <input type="date" value="${escapeAttr(dateVal)}" class="date-value" aria-label="Date">
        <input type="url" placeholder="Ticket URL" value="${escapeAttr(ticketUrl)}" class="date-ticket-url" aria-label="Ticket URL">
        <button type="button" class="btn-remove-date" title="Remove Date">&times;</button>
    `;
    datesContainer.appendChild(div);
}

function openModal(event = null) {
    editingEventId = event?.id || null;
    modalTitle.textContent = event ? 'Edit Event' : 'Add Event';
    btnText.textContent = event ? 'Update Event' : 'Save Event';

    // Reset UI
    scheduleContainer.innerHTML = '';
    datesContainer.innerHTML = '';

    // Determine Image Mode
    const isExternal = event?.imageUrl && !event.imagePath;
    const mode = isExternal ? 'url' : 'upload';

    // Set Radio
    Array.from(imageTypeRadios).find(r => r.value === mode).checked = true;
    toggleImageType(mode);

    if (event) {
        // Populate form with event data
        document.getElementById('artistName').value = event.artistName || '';
        document.getElementById('eventName').value = event.eventName || '';
        document.getElementById('performerType').value = event.performerType || 'Person';
        document.getElementById('venueName').value = event.venueName || '';
        document.getElementById('venueCity').value = event.venueCity || '';
        document.getElementById('venueState').value = event.venueState || '';
        document.getElementById('ticketUrl').value = event.ticketUrl || '';
        document.getElementById('imageAlt').value = event.imageAlt || '';
        document.getElementById('isPublished').checked = event.isPublished !== false;

        // Schedule
        if (event.schedule && Array.isArray(event.schedule)) {
            event.schedule.forEach(item => addScheduleItem(item.time, item.description));
        }

        // Additional dates (skip first entry which matches primary date)
        if (event.dates && Array.isArray(event.dates) && event.dates.length > 1) {
            event.dates.slice(1).forEach(d => {
                const dateStr = d.date || '';
                const url = d.ticketUrl || '';
                addDateItem(dateStr, url);
            });
        }

        // Handle date
        if (event.eventDate) {
            const date = event.eventDate.toDate ? event.eventDate.toDate() : new Date(event.eventDate);
            document.getElementById('eventDate').value = date.toISOString().split('T')[0];
        }

        // Show image
        if (mode === 'url') {
            externalUrlInput.value = event.imageUrl;
            externalImagePreview.src = event.imageUrl;
            externalImagePreview.style.display = 'block';
        } else if (event.imageUrl) {
            imagePreview.src = event.imageUrl;
            imagePreview.classList.add('visible');
            uploadPlaceholder.style.display = 'none';
            imageUploadArea.classList.add('has-image');
        }
    } else {
        eventForm.reset();
        document.getElementById('isPublished').checked = true;
        resetImageUpload();
        // Reset to upload mode default
        Array.from(imageTypeRadios).find(r => r.value === 'upload').checked = true;
        toggleImageType('upload');
    }

    selectedImageFile = null;
    eventModal.classList.add('active');
}

function closeModal() {
    eventModal.classList.remove('active');
    editingEventId = null;
    selectedImageFile = null;
    eventForm.reset();
    resetImageUpload();
}

function resetImageUpload() {
    imagePreview.src = '';
    imagePreview.classList.remove('visible');
    uploadPlaceholder.style.display = 'block';
    imageUploadArea.classList.remove('has-image');
}

// Delete Modal
function openDeleteModal() {
    deleteModal.classList.add('active');
}

async function handleBulkDelete() {
    if (currentUserRole === 'editor') {
        showToast('You do not have permission to delete events.', 'error');
        bulkDeleteModal.classList.remove('active');
        return;
    }
    bulkDeleteModal.classList.remove('active');
    const ids = [...selectedEventIds];
    try {
        const results = await Promise.allSettled(
            ids.map(async id => {
                const event = events.find(e => e.id === id);
                if (event?.imagePath) {
                    try {
                        await deleteObject(ref(storage, event.imagePath));
                    } catch (e) {
                        console.warn('Could not delete image:', e);
                    }
                }
                await deleteDoc(doc(db, 'events', id));
            })
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            showToast(`Deleted ${ids.length - failed} events. ${failed} failed.`, 'error');
        } else {
            showToast(`Deleted ${ids.length} event(s)!`, 'success');
        }
        clearSelection();
        await loadEvents();
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Error deleting events.', 'error');
    }
    deletingEventId = null;
    deletingImagePath = null;
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deletingEventId = null;
    deletingImagePath = null;
}

// Image Handling
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndPreviewImage(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    imageUploadArea.style.borderColor = 'var(--primary)';
}

function handleDrop(e) {
    e.preventDefault();
    imageUploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
        validateAndPreviewImage(file);
    }
}

function validateAndPreviewImage(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload JPG, PNG, WebP, or GIF.', 'error');
        return;
    }

    if (file.size > maxSize) {
        showToast('File too large. Maximum size is 2MB.', 'error');
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.add('visible');
        uploadPlaceholder.style.display = 'none';
        imageUploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

// Form Submission
async function handleSubmit(e) {
    e.preventDefault();

    // Validate image for new events
    const imageMode = document.querySelector('input[name="imageType"]:checked').value;
    const externalUrl = externalUrlInput.value.trim();

    if (!editingEventId) {
        if (imageMode === 'upload' && !selectedImageFile) {
            showToast('Please select an image for the event.', 'error');
            return;
        }
        if (imageMode === 'url' && !externalUrl) {
            showToast('Please enter an image URL.', 'error');
            return;
        }
    }

    setSubmitLoading(true);

    try {
        const formData = getFormData();
        let imageUrl = null;
        let imagePath = null;

        // Determine Image Logic
        if (imageMode === 'upload' && selectedImageFile) {
            const uploadResult = await uploadImage(selectedImageFile);
            imageUrl = uploadResult.url;
            imagePath = uploadResult.path;
        } else if (imageMode === 'url') {
            imageUrl = externalUrl;
            imagePath = null;
        }

        if (editingEventId) {
            await updateEvent(editingEventId, formData, imageUrl, imagePath, imageMode);
            showToast('Event updated successfully!', 'success');
        } else {
            await createEvent(formData, imageUrl, imagePath);
            showToast('Event created successfully!', 'success');
        }

        closeModal();
        await loadEvents();
    } catch (error) {
        console.error('Error saving event:', error);
        showToast('Error saving event. Please try again.', 'error');
    } finally {
        setSubmitLoading(false);
    }
}

function getFormData() {
    const eventDate = new Date(document.getElementById('eventDate').value);
    const ticketUrl = document.getElementById('ticketUrl').value.trim();

    // Collect Schedule
    const scheduleItems = [];
    document.querySelectorAll('.schedule-item-row').forEach(row => {
        const time = row.querySelector('.schedule-time').value.trim();
        const desc = row.querySelector('.schedule-desc').value.trim();
        if (time && desc) {
            scheduleItems.push({ time, description: desc });
        }
    });

    // Collect Additional Dates
    const additionalDates = [];
    document.querySelectorAll('.date-item-row').forEach(row => {
        const dateVal = row.querySelector('.date-value').value;
        const url = row.querySelector('.date-ticket-url').value.trim();
        if (dateVal) {
            additionalDates.push({ date: dateVal, ticketUrl: url || ticketUrl });
        }
    });

    const data = {
        artistName: document.getElementById('artistName').value.trim(),
        eventName: document.getElementById('eventName').value.trim(),
        eventDate: Timestamp.fromDate(eventDate),
        displayMonth: MONTHS[eventDate.getMonth()],
        displayDay: String(eventDate.getDate()).padStart(2, '0'),
        performerType: document.getElementById('performerType').value,
        venueName: document.getElementById('venueName').value.trim(),
        venueCity: document.getElementById('venueCity').value.trim(),
        venueState: document.getElementById('venueState').value,
        venueFullName: `${document.getElementById('venueName').value.trim()}, ${document.getElementById('venueCity').value.trim()}, ${document.getElementById('venueState').value}`,
        ticketUrl,
        imageAlt: document.getElementById('imageAlt').value.trim() ||
            `${document.getElementById('artistName').value.trim()} - ${document.getElementById('eventName').value.trim()}`,
        isPublished: document.getElementById('isPublished').checked,
        schedule: scheduleItems
    };

    // Only include dates array when there are additional dates
    if (additionalDates.length > 0) {
        const primaryDateStr = document.getElementById('eventDate').value;
        data.dates = [
            { date: primaryDateStr, ticketUrl },
            ...additionalDates
        ];
    }

    return data;
}

async function uploadImage(file) {
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const imageRef = ref(storage, `events/${filename}`);
    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);
    return { url, path: `events/${filename}` };
}

async function createEvent(formData, imageUrl, imagePath) {
    const eventDoc = {
        ...formData,
        imageUrl,
        imagePath,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
    };

    await addDoc(collection(db, 'events'), eventDoc);
}

async function updateEvent(eventId, formData, imageUrl, imagePath, imageMode) {
    const eventRef = doc(db, 'events', eventId);
    const updateData = {
        ...formData,
        updatedAt: serverTimestamp()
    };

    // If new image (either URL or Upload)
    if (imageUrl) {
        const oldEvent = events.find(e => e.id === eventId);

        if (oldEvent?.imagePath && (imagePath || imageMode === 'url')) {
            try {
                const oldImageRef = ref(storage, oldEvent.imagePath);
                await deleteObject(oldImageRef);
            } catch (e) {
                console.warn('Could not delete old image:', e);
            }
        }

        updateData.imageUrl = imageUrl;
        updateData.imagePath = imagePath || null;
    }

    await updateDoc(eventRef, updateData);
}

// Toggle Publish
async function togglePublish(eventId, currentStatus) {
    try {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
            isPublished: !currentStatus,
            updatedAt: serverTimestamp()
        });
        showToast(`Event ${!currentStatus ? 'published' : 'unpublished'}!`, 'success');
        await loadEvents();
    } catch (error) {
        console.error('Error toggling publish:', error);
        showToast('Error updating event status.', 'error');
    }
}

// Delete Event
async function handleDeleteConfirm() {
    if (!deletingEventId) return;

    try {
        // Delete image from storage
        if (deletingImagePath) {
            try {
                const imageRef = ref(storage, deletingImagePath);
                await deleteObject(imageRef);
            } catch (e) {
                console.warn('Could not delete image:', e);
            }
        }

        // Delete document
        await deleteDoc(doc(db, 'events', deletingEventId));

        showToast('Event deleted successfully!', 'success');
        closeDeleteModal();
        await loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Error deleting event.', 'error');
    }
}

// UI Helpers
function setSubmitLoading(isLoading) {
    submitBtn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'inline' : 'none';
}

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
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Start the app
init();
