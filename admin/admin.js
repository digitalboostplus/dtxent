// Admin Dashboard - Event Management
import { db, storage, auth } from '../js/firebase-config.js';
import { requireAuth, signOut, onAuthStateChanged } from '../js/auth.js';
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
const addEventBtn = document.getElementById('add-event-btn');
const addFirstEventBtn = document.getElementById('add-first-event-btn');

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

// Toast Container
const toastContainer = document.getElementById('toast-container');

// State
let events = [];
let editingEventId = null;
let deletingEventId = null;
let deletingImagePath = null;
let selectedImageFile = null;

// Month abbreviations
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Initialize
async function init() {
    try {
        const user = await requireAuth('/admin/login.html');
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

    // Delete modal
    deleteCancel.addEventListener('click', closeDeleteModal);
    deleteConfirm.addEventListener('click', handleDeleteConfirm);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
        }
    });
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
        events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderEvents();
    } catch (error) {
        console.error('Error loading events:', error);
        showToast('Error loading events', 'error');
    }
}

// Render Events List
function renderEvents() {
    if (events.length === 0) {
        eventsList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    eventsList.innerHTML = events.map(event => createEventCard(event)).join('');

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
}

function createEventCard(event) {
    const date = event.eventDate?.toDate ? event.eventDate.toDate() : new Date(event.eventDate);
    const displayDate = `${event.displayMonth || MONTHS[date.getMonth()]} ${event.displayDay || date.getDate()}`;

    return `
        <div class="event-admin-card">
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
                <button class="btn-icon delete delete-btn"
                        data-id="${event.id}"
                        data-imagepath="${event.imagePath || ''}"
                        title="Delete">🗑️</button>
            </div>
        </div>
    `;
}

// Modal Functions
function openModal(event = null) {
    editingEventId = event?.id || null;
    modalTitle.textContent = event ? 'Edit Event' : 'Add Event';
    btnText.textContent = event ? 'Update Event' : 'Save Event';

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

        // Handle date
        if (event.eventDate) {
            const date = event.eventDate.toDate ? event.eventDate.toDate() : new Date(event.eventDate);
            document.getElementById('eventDate').value = date.toISOString().split('T')[0];
        }

        // Show existing image
        if (event.imageUrl) {
            imagePreview.src = event.imageUrl;
            imagePreview.classList.add('visible');
            uploadPlaceholder.style.display = 'none';
            imageUploadArea.classList.add('has-image');
        }
    } else {
        eventForm.reset();
        document.getElementById('isPublished').checked = true;
        resetImageUpload();
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
    if (!editingEventId && !selectedImageFile) {
        showToast('Please select an image for the event.', 'error');
        return;
    }

    setSubmitLoading(true);

    try {
        const formData = getFormData();
        let imageUrl = null;
        let imagePath = null;

        // Upload image if selected
        if (selectedImageFile) {
            const uploadResult = await uploadImage(selectedImageFile);
            imageUrl = uploadResult.url;
            imagePath = uploadResult.path;
        }

        if (editingEventId) {
            await updateEvent(editingEventId, formData, imageUrl, imagePath);
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

    return {
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
        ticketUrl: document.getElementById('ticketUrl').value.trim(),
        imageAlt: document.getElementById('imageAlt').value.trim() ||
            `${document.getElementById('artistName').value.trim()} - ${document.getElementById('eventName').value.trim()}`,
        isPublished: document.getElementById('isPublished').checked
    };
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

async function updateEvent(eventId, formData, imageUrl, imagePath) {
    const eventRef = doc(db, 'events', eventId);
    const updateData = {
        ...formData,
        updatedAt: serverTimestamp()
    };

    // If new image uploaded, delete old one and update URLs
    if (imageUrl && imagePath) {
        const oldEvent = events.find(e => e.id === eventId);
        if (oldEvent?.imagePath) {
            try {
                const oldImageRef = ref(storage, oldEvent.imagePath);
                await deleteObject(oldImageRef);
            } catch (e) {
                console.warn('Could not delete old image:', e);
            }
        }
        updateData.imageUrl = imageUrl;
        updateData.imagePath = imagePath;
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

// Start the app
init();
