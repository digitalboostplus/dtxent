import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// TODO: Replace with your actual Go High Level Inbound Webhook URL
const GHL_WEBHOOK_URL = '';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('vip-lead-form');
    if (!form) return;

    const statusDiv = document.getElementById('form-status') || createStatusDiv();
    const submitBtn = form.querySelector('button[type="submit"]');

    // Helper: Create status div if not present in HTML layout
    function createStatusDiv() {
        const div = document.createElement('div');
        div.id = 'form-status';
        div.className = 'visually-hidden';
        div.setAttribute('role', 'status');
        div.setAttribute('aria-live', 'polite');
        div.style.marginTop = '1rem';
        div.style.textAlign = 'center';
        div.style.fontWeight = '600';
        form.appendChild(div);
        return div;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Gather form data
        const formData = new FormData(form);
        const fullName = formData.get('fullName').trim();
        const phone = formData.get('phone').trim();
        const email = formData.get('email').trim();
        const eventDetails = formData.get('eventDetails').trim();
        const groupSize = parseInt(formData.get('groupSize'), 10);
        const requestedServices = formData.get('requestedServices');
        const specialRequests = formData.get('specialRequests').trim();

        // 2. Client-side Validation
        if (!fullName || !phone || !email || !eventDetails || isNaN(groupSize) || !requestedServices) {
            showStatus('Please fill in all required fields.', 'error');
            return;
        }

        if (groupSize <= 0) {
            showStatus('Group size must be at least 1.', 'error');
            return;
        }

        // 3. UI Loading State
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        showStatus('Sending your request...', 'info');

        try {
            // 4. Construct Request Object matching firestore.rules
            const requestData = {
                fullName,
                phone,
                email,
                eventDetails,
                groupSize,
                requestedServices,
                status: 'new',
                submittedAt: serverTimestamp()
            };

            if (specialRequests) requestData.specialRequests = specialRequests;

            // 5. Submit to Firestore
            const quotesCollection = collection(db, 'vip_requests');
            await addDoc(quotesCollection, requestData);

            // 6. Send to Go High Level Webhook (if URL is configured)
            if (GHL_WEBHOOK_URL) {
                try {
                    // Create a plain object for the webhook payload
                    // (Ensure submittedAt is something JSON serializable if needed, here we use string)
                    const webhookPayload = {
                        ...requestData,
                        submittedAt: new Date().toISOString()
                    };

                    await fetch(GHL_WEBHOOK_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(webhookPayload)
                    });
                } catch (webhookError) {
                    // Log but don't fail the user request if Firestore succeeded
                    console.error('Error forwarding to CRM Webhook:', webhookError);
                }
            } else {
                console.warn('GHL Webhook URL is not configured. Skipping CRM sync.');
            }

            // 7. Success State
            form.reset();
            showStatus('Success! Your VIP request has been sent. Our concierge will contact you soon.', 'success');

            // Optional: reset button after a delay
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                statusDiv.className = 'visually-hidden';
            }, 5000);

        } catch (error) {
            console.error('Error submitting VIP request:', error);
            showStatus('There was an error submitting your request. Please try calling us instead.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = ''; // Remove hidden classes first

        if (type === 'error') {
            statusDiv.style.color = 'var(--error, #ef4444)';
        } else if (type === 'success') {
            statusDiv.style.color = 'var(--success, #22c55e)';
        } else {
            statusDiv.style.color = 'var(--text-muted, #b8b8b8)';
        }
    }
});
