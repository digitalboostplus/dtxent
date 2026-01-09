# Dynamic TX Entertainment (DTXENT) - Project Context

## Project Overview
This is the landing page and promotional website for **Dynamic TX Entertainment**, a company promoting live concerts and events in Texas (Payne Arena, South Padre Island). 

The project is a **static web application** hosted on **Firebase**, utilizing **vanilla JavaScript (ES Modules)** for dynamic content rendering and **Firebase services** (Firestore, Auth, Storage) for the backend content management system.

## Architecture & Tech Stack

*   **Frontend:** HTML5, CSS3 (Custom Properties, Grid/Flexbox), Vanilla JavaScript (ES6+ Modules).
*   **Hosting:** Firebase Hosting.
*   **Database:** Firebase Firestore (Stores event data - currently bypassed for public view in favor of local data).
*   **Authentication:** Firebase Auth (Used for the Admin Dashboard).
*   **Storage:** Firebase Storage (Stores event images).

## Directory Structure

*   **Root (`/`)**:
    *   `index.html`: Main landing page. Contains the layout skeleton.
    *   `styles.css`: Global styles, variables, and responsive definitions.
    *   `script.js`: UI logic (scroll effects, mobile menu, animations).
    *   `firebase.json`: Firebase Hosting configuration.
    *   `firestore.rules`: Security rules for the database.
*   **`js/`**: Core logic modules.
    *   `events-public.js`: Main script that loads and renders events on the landing page.
    *   `events-data.js`: **Current Data Source.** Contains the `LOCAL_EVENTS` array with hardcoded event data.
    *   `firebase-config.js`: Firebase SDK initialization.
    *   `auth.js`: Authentication helper functions.
*   **`admin/`**: Content Management System.
    *   `index.html` & `login.html`: Admin UI.
    *   `admin.js`: Logic for adding/editing/deleting events in Firestore and uploading images to Storage.
*   **`assets/`**: Images, logos, and icons.
*   **`tests/`**: Validation scripts (e.g., `validate_events.mjs` to check data integrity).

## Data Management & Workflows

### Public Event Display
*   **Current State:** Events are loaded from a local file (`js/events-data.js`) and rendered by `js/events-public.js`. This ensures zero-latency display and allows for manual updates via code.
*   **Legacy/Future State:** `js/events-public.js` contains commented-out logic to fetch "published" events directly from **Firestore**.

### Admin Dashboard (`/admin/`)
*   Accessible at `/admin/`.
*   Requires Firebase Authentication.
*   Allows creating, editing, and deleting events in **Firestore**.
*   **Note:** Changes made here will **not** currently appear on the public site unless the `loadPublicEvents` function in `js/events-public.js` is reverted to use Firestore fetching.

## Development & Deployment

### Running Locally
Since this is a static site using ES modules, you need a local server:
```bash
npx serve
# or
python -m http.server 8000
```

### Deployment
Deploy to Firebase Hosting using the CLI:
```bash
firebase deploy
```

### Validation
Run the event data validation script to ensure all referenced images exist:
```bash
node tests/validate_events.mjs
```

## Conventions
*   **CSS:** Use CSS Variables (defined in `:root`) for colors and fonts. Mobile-first responsive design.
*   **JS:** Use ES Modules (`import`/`export`). No bundlers (Webpack/Vite) are currently used; browsers load modules natively.
*   **Images:** WebP is preferred for performance. Store in `assets/`.
