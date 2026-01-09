$PROJECT_ID = "dtxent-web"
$REPO = "digitalboostplus/dtxent"
$POOL_NAME = "github-actions-pool-1"
$PROVIDER_NAME = "github-actions-provider-1"
$C_SERVICE_ACCOUNT_ID = "github-action-deploy"

Write-Host "Setting up Workload Identity Federation for Project: $PROJECT_ID"
Write-Host "Repository: $REPO"

# 1. Enable IAM Credentials API
Write-Host "Enabling IAM Credentials API..."
gcloud services enable iamcredentials.googleapis.com --project "$PROJECT_ID"

# 2. Create Workload Identity Pool
Write-Host "Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create "$POOL_NAME" --project="$PROJECT_ID" --location="global" --display-name="GitHub Actions Pool"

# Get the full pool name
$WORKLOAD_IDENTITY_POOL_ID = gcloud iam workload-identity-pools describe "$POOL_NAME" --project="$PROJECT_ID" --location="global" --format="value(name)"

# 3. Create Workload Identity Provider
Write-Host "Creating Workload Identity Provider..."
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" --project="$PROJECT_ID" --location="global" --workload-identity-pool="$POOL_NAME" --display-name="GitHub Repo Provider" --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" --issuer-uri="https://token.actions.githubusercontent.com"

# 4. Create Service Account
Write-Host "Creating Service Account..."
gcloud iam service-accounts create "$C_SERVICE_ACCOUNT_ID" --project="$PROJECT_ID" --display-name="GitHub Actions Deployment"

# 5. Grant Permissions to Service Account (Firebase Hosting Admin)
Write-Host "Granting Firebase Hosting Admin role..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$C_SERVICE_ACCOUNT_ID@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/firebasehosting.admin"

# 6. Allow GitHub Actions to impersonate Service Account
Write-Host "Allowing GitHub Actions to impersonate Service Account..."
gcloud iam service-accounts add-iam-policy-binding "$C_SERVICE_ACCOUNT_ID@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${REPO}"

Write-Host "`n----------------------------------------------------------------"
Write-Host "SETUP COMPLETE!"
Write-Host "----------------------------------------------------------------"
Write-Host "Using the values below, please update your .github/workflows/firebase-hosting-merge.yml file:"
Write-Host "`nworkload_identity_provider: projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
Write-Host "service_account: $C_SERVICE_ACCOUNT_ID@$PROJECT_ID.iam.gserviceaccount.com"
Write-Host "----------------------------------------------------------------"
