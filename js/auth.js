// Authentication Module
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    browserLocalPersistence,
    setPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Sign in user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 */
export async function signIn(email, password) {
    await setPersistence(auth, browserLocalPersistence);
    return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOut() {
    return firebaseSignOut(auth);
}

/**
 * Listen to authentication state changes
 * @param {function} callback - Called with user object or null
 * @returns {function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {User|null}
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return auth.currentUser !== null;
}

/**
 * Protect a page - redirect to login if not authenticated
 * @param {string} loginUrl - URL to redirect to if not authenticated
 * @returns {Promise<User>} - Resolves with user if authenticated
 */
export function requireAuth(loginUrl = '/admin/login.html') {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged((user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.href = loginUrl;
                reject(new Error('Not authenticated'));
            }
        });
    });
}

/**
 * Protect a page - require both Firebase Auth AND admin role in Firestore
 * @param {string} loginUrl - URL to redirect to if not authenticated/authorized
 * @returns {Promise<User>} - Resolves with user if authenticated and authorized
 */
export async function requireAdminAccess(loginUrl = '/admin/login.html') {
    const user = await requireAuth(loginUrl);

    // Check if user's email exists in the admins collection
    const adminDoc = await getDoc(doc(db, 'admins', user.email));
    if (!adminDoc.exists()) {
        await firebaseSignOut(auth);
        window.location.href = loginUrl + '?error=unauthorized';
        throw new Error('Not authorized as admin');
    }

    const adminData = adminDoc.data();
    return { ...user, role: adminData.role || 'admin' };
}

/**
 * Protect a page - require Owner role
 * @param {string} loginUrl
 * @returns {Promise<User>}
 */
export async function requireOwnerAccess(loginUrl = '/admin/login.html') {
    const user = await requireAdminAccess(loginUrl);
    if (user.role !== 'owner') {
        window.location.href = '/admin/index.html?error=insufficient_permissions';
        throw new Error('Insufficient permissions');
    }
    return user;
}

/**
 * Redirect to dashboard if already authenticated
 * @param {string} dashboardUrl - URL to redirect to if authenticated
 */
export function redirectIfAuthenticated(dashboardUrl = '/admin/index.html') {
    onAuthStateChanged((user) => {
        if (user) {
            window.location.href = dashboardUrl;
        }
    });
}
