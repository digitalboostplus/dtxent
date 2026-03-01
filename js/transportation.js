import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('transportation-lead-form');
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
        const eventDate = formData.get('eventDate');
        const passengers = parseInt(formData.get('passengers'), 10);
        const vehiclePreference = formData.get('vehiclePreference');
        const pickupLocation = formData.get('pickupLocation').trim();
        const eventShow = formData.get('eventShow').trim();
        const additionalNotes = formData.get('additionalNotes').trim();

        // 2. Client-side Validation
        if (!fullName || !phone || !email || !eventDate || isNaN(passengers) || !vehiclePreference || !pickupLocation) {
            showStatus('Please fill in all required fields.', 'error');
            return;
        }

        if (passengers <= 0) {
            showStatus('Number of passengers must be at least 1.', 'error');
            return;
        }

        // 3. UI Loading State
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        showStatus('Sending your request...', 'info');

        try {
            // 4. Construct Quote Object matching firestore.rules
            const quoteData = {
                fullName,
                phone,
                email,
                eventDate,
                passengers,
                vehiclePreference,
                pickupLocation,
                status: 'new', // Matches rule "data.status is string"
                submittedAt: serverTimestamp()
            };

            // Add optional fields if provided
            if (eventShow) quoteData.eventShow = eventShow;
            if (additionalNotes) quoteData.additionalNotes = additionalNotes;

            // 5. Submit to Firestore
            const quotesCollection = collection(db, 'transportation_quotes');
            await addDoc(quotesCollection, quoteData);

            // 6. Success State
            form.reset();
            showStatus('Success! Your quote request has been sent. We will contact you soon.', 'success');

            // Optional: reset button after a delay
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                statusDiv.className = 'visually-hidden';
            }, 5000);

        } catch (error) {
            console.error('Error submitting quote:', error);
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
