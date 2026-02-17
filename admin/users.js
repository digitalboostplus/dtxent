// Admin Users Management
import { db, auth } from '../js/firebase-config.js';
import { requireAdminAccess, signOut } from '../js/auth.js';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const adminApp = document.getElementById('admin-app');
const adminEmail = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const adminsList = document.getElementById('admins-list');
const emptyState = document.getElementById('empty-state');
const newAdminEmailInput = document.getElementById('new-admin-email');
const addAdminBtn = document.getElementById('add-admin-btn');
const deleteModal = document.getElementById('delete-modal');
const deleteCancel = document.getElementById('delete-cancel');
const deleteConfirm = document.getElementById('delete-confirm');
const deleteMsg = document.getElementById('delete-msg');
const toastContainer = document.getElementById('toast-container');

// State
let admins = [];
let currentUserEmail = '';
let deletingAdminEmail = null;

// Initialize
async function init() {
    try {
        const user = await requireAdminAccess('/admin/login.html');
        currentUserEmail = user.email;
        adminEmail.textContent = user.email;
        hideLoading();
        showApp();
        await loadAdmins();
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

function setupEventListeners() {
    logoutBtn.addEventListener('click', handleLogout);

    addAdminBtn.addEventListener('click', handleAddAdmin);
    newAdminEmailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddAdmin();
    });

    deleteCancel.addEventListener('click', closeDeleteModal);
    deleteConfirm.addEventListener('click', handleDeleteConfirm);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDeleteModal();
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

// Load Admins
async function loadAdmins() {
    try {
        const snapshot = await getDocs(collection(db, 'admins'));
        admins = snapshot.docs.map(d => ({
            email: d.id,
            ...d.data()
        }));
        renderAdmins();
    } catch (error) {
        console.error('Error loading admins:', error);
        showToast('Error loading admin users', 'error');
    }
}

function renderAdmins() {
    if (admins.length === 0) {
        adminsList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    adminsList.innerHTML = admins.map(admin => {
        const addedAt = admin.addedAt?.toDate ? admin.addedAt.toDate().toLocaleDateString() : 'Unknown';
        const addedBy = admin.addedBy || 'System';
        const isSelf = admin.email === currentUserEmail;

        return `
            <div class="admin-user-card">
                <div class="admin-user-info">
                    <div class="admin-user-email">${escapeHtml(admin.email)}${isSelf ? ' (you)' : ''}</div>
                    <div class="admin-user-meta">Added by ${escapeHtml(addedBy)} on ${addedAt}</div>
                </div>
                <div class="admin-user-actions">
                    ${isSelf ? '' : `<button class="btn-icon delete remove-admin-btn" data-email="${escapeAttr(admin.email)}" title="Remove Admin">🗑️</button>`}
                </div>
            </div>
        `;
    }).join('');

    // Attach listeners
    adminsList.querySelectorAll('.remove-admin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deletingAdminEmail = btn.dataset.email;
            deleteMsg.textContent = `Remove ${deletingAdminEmail} from admin access? They will no longer be able to manage events.`;
            deleteModal.classList.add('active');
        });
    });
}

// Add Admin
async function handleAddAdmin() {
    const email = newAdminEmailInput.value.trim().toLowerCase();
    if (!email) {
        showToast('Please enter an email address.', 'error');
        return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Check if already exists
    if (admins.some(a => a.email === email)) {
        showToast('This user is already an admin.', 'error');
        return;
    }

    addAdminBtn.disabled = true;
    try {
        await setDoc(doc(db, 'admins', email), {
            email,
            addedBy: currentUserEmail,
            addedAt: serverTimestamp()
        });
        showToast(`${email} added as admin!`, 'success');
        newAdminEmailInput.value = '';
        await loadAdmins();
    } catch (error) {
        console.error('Error adding admin:', error);
        showToast('Error adding admin user.', 'error');
    } finally {
        addAdminBtn.disabled = false;
    }
}

// Delete Admin
function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deletingAdminEmail = null;
}

async function handleDeleteConfirm() {
    if (!deletingAdminEmail) return;

    try {
        await deleteDoc(doc(db, 'admins', deletingAdminEmail));
        showToast(`${deletingAdminEmail} removed from admins.`, 'success');
        closeDeleteModal();
        await loadAdmins();
    } catch (error) {
        console.error('Error removing admin:', error);
        showToast('Error removing admin user.', 'error');
    }
}

// UI Helpers
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

// Start
init();
