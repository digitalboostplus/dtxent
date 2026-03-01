import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-us-form');
    const formStatus = document.getElementById('form-status');
    const submitBtn = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Reset status
            formStatus.className = 'visually-hidden';
            formStatus.textContent = '';

            // Disable button and show loading state
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner" style="display:inline-block; margin-right:8px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; width:14px; height:14px; animation:spin 1s ease-in-out infinite;"></span> Sending...';

            // Add keyframes for spinner if not present
            if (!document.getElementById('spinner-style')) {
                const style = document.createElement('style');
                style.id = 'spinner-style';
                style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }

            try {
                // Get form data
                const formData = new FormData(contactForm);
                const contactRequest = {
                    name: formData.get('fullName').trim(),
                    email: formData.get('email').trim().toLowerCase(),
                    phone: formData.get('phone').trim(),
                    subject: formData.get('subject'),
                    message: formData.get('message').trim(),
                    createdAt: serverTimestamp(),
                    status: 'new'
                };

                // Basic validation
                if (!contactRequest.name || !contactRequest.email || !contactRequest.phone || !contactRequest.subject || !contactRequest.message) {
                    throw new Error('Please fill in all required fields.');
                }

                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactRequest.email)) {
                    throw new Error('Please enter a valid email address.');
                }

                // Save to Firestore
                await addDoc(collection(db, 'contact_requests'), contactRequest);

                // Show success message
                formStatus.textContent = 'Thank you! Your message has been received. Our team will contact you shortly.';
                formStatus.className = 'form-message success';

                // Clear form
                contactForm.reset();

            } catch (error) {
                console.error('Error submitting contact form:', error);

                // Show error message
                formStatus.textContent = error.message || 'There was an error submitting your request. Please try again later or call us directly.';
                formStatus.className = 'form-message error';
            } finally {
                // Restore button state
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
});
