import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const VIP_WEBHOOK_PROXY = '/api/vip-webhook';

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

            // 6. Forward to CRM via server-side proxy (keeps webhook URL secret)
            try {
                await fetch(VIP_WEBHOOK_PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...requestData, submittedAt: new Date().toISOString() })
                });
            } catch (webhookError) {
                console.error('Error forwarding to CRM:', webhookError);
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
