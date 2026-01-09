// Newsletter Handler - Firestore integration
import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Subscribe email to newsletter
 */
async function subscribeToNewsletter(email) {
    try {
        // Check if already subscribed
        const q = query(
            collection(db, 'newsletter'),
            where('email', '==', email.toLowerCase())
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return {
                success: false,
                message: "You're already subscribed!"
            };
        }

        // Add new subscriber
        await addDoc(collection(db, 'newsletter'), {
            email: email.toLowerCase(),
            subscribedAt: serverTimestamp(),
            source: 'landing_page',
            status: 'active'
        });

        return {
            success: true,
            message: 'Thanks for subscribing! Check your email for updates.'
        };

    } catch (error) {
        console.error('Newsletter subscription error:', error);
        return {
            success: false,
            message: 'Something went wrong. Please try again later.'
        };
    }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Show form message
 */
function showFormMessage(form, message, type) {
    // Remove existing message
    const existingMessage = form.parentElement.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create new message
    const messageEl = document.createElement('div');
    messageEl.className = `form-message ${type}`;
    messageEl.textContent = message;
    messageEl.setAttribute('role', 'alert');

    // Insert after form
    form.parentElement.insertBefore(messageEl, form.nextSibling);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

/**
 * Initialize newsletter form
 */
function initNewsletterForm() {
    const form = document.querySelector('.newsletter-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = form.querySelector('input[type="email"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const email = emailInput.value.trim();

        // Validate
        if (!isValidEmail(email)) {
            showFormMessage(form, 'Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Submit to Firestore
        const result = await subscribeToNewsletter(email);

        // Show result
        showFormMessage(form, result.message, result.success ? 'success' : 'error');

        // Reset form on success
        if (result.success) {
            form.reset();
        }

        // Remove loading state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsletterForm);
} else {
    initNewsletterForm();
}
