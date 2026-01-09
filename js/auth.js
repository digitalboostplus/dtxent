// Authentication Module
import { auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    browserLocalPersistence,
    setPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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
