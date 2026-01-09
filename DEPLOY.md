# Deployment Instructions

To update the live site with the latest changes (including the new 2026 events), follow these steps:

## Prerequisites
- Node.js installed
- Firebase CLI installed (`npm install -g firebase-tools`)

## Deploying
Run the following command in your terminal:

```bash
firebase deploy
```

This will upload the latest files from the current directory to Firebase Hosting.

## Event Data
The upcoming events are currently loaded from `js/events-data.js` to ensure they appear immediately.
The Firestore database connection in `js/events-public.js` has been bypassed in favor of this local data.
If you wish to manage events via the Admin Panel in the future, the data will need to be re-added to Firestore and the code reverted to use the database.
