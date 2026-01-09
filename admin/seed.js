import { LOCAL_EVENTS } from '../js/events-data.js';
import { db, auth } from '../js/firebase-config.js';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const startBtn = document.getElementById('start-btn');
const logOutput = document.getElementById('log-output');
const authStatus = document.getElementById('auth-status');

// Auth Check
onAuthStateChanged(auth, (user) => {
    if (user) {
        authStatus.textContent = `Authenticated as: ${user.email}`;
        authStatus.style.color = '#4ade80';
        startBtn.disabled = false;
    } else {
        authStatus.textContent = 'Please log in to Admin Dashboard first.';
        authStatus.style.color = '#f87171';
        startBtn.disabled = true;
        setTimeout(() => window.location.href = 'login.html', 2000);
    }
});

function log(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logOutput.appendChild(div);
    logOutput.scrollTop = logOutput.scrollHeight;
}

startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Migrating...';

    try {
        log(`Found ${LOCAL_EVENTS.length} local events to process.`, 'info');

        let added = 0;
        let skipped = 0;
        let errors = 0;

        for (const event of LOCAL_EVENTS) {
            try {
                // Check duplicate by artistName
                const q = query(collection(db, 'events'), where('artistName', '==', event.artistName));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    log(`Skipping "${event.artistName}" - Already exists`, 'warn');
                    skipped++;
                    continue;
                }

                // Transform Data
                const firestoreEvent = {
                    artistName: event.artistName,
                    eventName: event.eventName,
                    eventDate: Timestamp.fromDate(new Date(event.eventDate)),
                    performerType: 'Person', // Default
                    venueName: event.venueName,
                    venueCity: event.venueCity,
                    venueState: event.venueState,
                    ticketUrl: event.ticketUrl || '#',
                    imageAlt: `${event.artistName} - ${event.eventName}`,
                    isPublished: event.isPublished,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    schedule: event.schedule || []
                };

                // Image Logic
                if (event.imageUrl) {
                    firestoreEvent.imageUrl = event.imageUrl;
                    // imagePath is optional, no need to send null if not present
                } else if (event.imageName) {
                    // We aren't uploading the file, just pointing to assets
                    firestoreEvent.imageUrl = `../assets/${event.imageName}`;
                }

                await addDoc(collection(db, 'events'), firestoreEvent);
                log(`Added "${event.artistName}"`, 'success');
                added++;

            } catch (err) {
                console.error(err);
                log(`Error processing "${event.artistName}": ${err.message}`, 'error');
                errors++;
            }
        }

        log(`Migration Complete! Added: ${added}, Skipped: ${skipped}, Errors: ${errors}`, 'success');

    } catch (error) {
        log(`Fatal Error: ${error.message}`, 'error');
    } finally {
        startBtn.textContent = 'Migration Finished';
    }
});
