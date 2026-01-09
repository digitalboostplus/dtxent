# GitHub Actions & Firebase Setup

To enable the automatic deployment workflow, you need to configure a Firebase Service Account secret in your GitHub repository.

## 1. Generate Firebase Service Account Key
1.  Go to the [Google Cloud Console Service Accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts?project=dtxent-web).
2.  Select the project **dtxent-web**.
3.  Look for a service account named `firebase-adminsdk` or similar. If one doesn't exist, create one with the "Firebase Admin SDK Administrator Service Agent" role.
4.  Click the **Actions** (three dots) button for that service account -> **Manage keys**.
5.  Click **Add Key** -> **Create new key**.
6.  Select **JSON** and click **Create**.
7.  A file will download to your computer. **Keep this file secure.**

## 2. Add Secret to GitHub
1.  Go to your GitHub repository page.
2.  Navigate to **Settings** > **Secrets and variables** > **Actions**.
3.  Click **New repository secret**.
4.  **Name:** `FIREBASE_SERVICE_ACCOUNT_DTXENT_WEB`
5.  **Secret:** Paste the entire contents of the JSON file you downloaded in step 1.
6.  Click **Add secret**.

## 3. Verify
Next time you push code to the `main` branch, the `Deploy to Firebase Hosting on merge` action will run.
1.  It will verify your event data using `tests/validate_events.mjs`.
2.  If the data is valid, it will deploy to `https://dtxent.com` (or your configured domain).
