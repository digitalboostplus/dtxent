// Firebase Configuration
// Replace these values with your Firebase project credentials
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyAS5BRPwTKxbEIrR2dO0jhj9FiRgI9mXpM",
    authDomain: "dtxent-web.firebaseapp.com",
    projectId: "dtxent-web",
    storageBucket: "dtxent-web.firebasestorage.app",
    messagingSenderId: "723755195104",
    appId: "1:723755195104:web:a6889c8cbd746cdf8b8e85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
