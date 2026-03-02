// Newsletter Handler - Firestore integration
import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const GHL_NEWSLETTER_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/Kuo7nUJmD2RL3ZGpdRA4/webhook-trigger/4815405c-0190-4bfd-a17c-1dee361d7a19';

/**
 * Subscribe email to newsletter
 */
async function subscribeToNewsletter(name, email) {
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
            name: name,
            email: email.toLowerCase(),
            subscribedAt: serverTimestamp(),
            source: 'landing_page',
            status: 'active'
        });

        // Send to Go High Level Webhook
        try {
            await fetch(GHL_NEWSLETTER_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    email: email.toLowerCase(),
                    source: 'landing_page',
                    subscribedAt: new Date().toISOString()
                })
            });
        } catch (webhookError) {
            console.error('Error forwarding to CRM Webhook:', webhookError);
        }

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

        const nameInput = form.querySelector('input[type="text"]');
        const emailInput = form.querySelector('input[type="email"]');
        const submitBtn = form.querySelector('button[type="submit"]');

        const name = nameInput ? nameInput.value.trim() : 'Unknown';
        const email = emailInput.value.trim();

        // Validate
        if (nameInput && !name) {
            showFormMessage(form, 'Please enter your name', 'error');
            nameInput.focus();
            return;
        }

        if (!isValidEmail(email)) {
            showFormMessage(form, 'Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Submit to Firestore
        const result = await subscribeToNewsletter(name, email);

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
