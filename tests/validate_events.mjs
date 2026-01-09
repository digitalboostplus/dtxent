import { LOCAL_EVENTS } from '../js/events-data.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../assets');

console.log('Validating Event Data...');

let errors = 0;

LOCAL_EVENTS.forEach(event => {
    // Check required fields
    if (!event.artistName) {
        console.error('Error: Missing artistName');
        errors++;
    }

    // Check Date format
    const date = new Date(event.eventDate);
    if (isNaN(date.getTime())) {
        console.error(`Error: Invalid date for ${event.artistName}: ${event.eventDate}`);
        errors++;
    }

    // Check Image Existence
    if (event.imageName) {
        const imagePath = path.join(ASSETS_DIR, event.imageName);
        if (!fs.existsSync(imagePath)) {
            console.error(`Error: Image not found for ${event.artistName}: ${event.imageName}`);
            errors++;
        }
    } else if (event.imageUrl) {
        // External URL, assume valid or check format if needed
        if (!event.imageUrl.startsWith('http')) {
            console.warn(`Warning: Invalid URL format for ${event.artistName}: ${event.imageUrl}`);
        }
    } else {
        console.warn(`Warning: No image specified for ${event.artistName}`);
    }
});

if (errors === 0) {
    console.log('All validations passed!');
    process.exit(0);
} else {
    console.error(`Found ${errors} errors.`);
    process.exit(1);
}
