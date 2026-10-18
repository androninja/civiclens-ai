#!/usr/bin/env bash
# ==============================================================================
# CivicLens AI — Google Cloud Run & Cloud SQL Deployment Script
# AI Builder Cup 2026 | Category: Sustainability & Social Impact
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Project Configuration Variables
# ------------------------------------------------------------------------------
PROJECT_ID="${GCP_PROJECT_ID:-civiclens-ai-2026}"
REGION="${GCP_REGION:-us-central1}"
BACKEND_SERVICE="civiclens-api"
FRONTEND_SERVICE="civiclens-frontend"
DB_INSTANCE="civiclens-pg"
DB_NAME="civiclens"
DB_USER="civiclens_user"
STORAGE_BUCKET="${PROJECT_ID}-civiclens-evidence"
GEMINI_KEY="${GEMINI_API_KEY:-}"

echo "=========================================================================="
echo " Deploying CivicLens AI to Google Cloud Platform"
echo " Project: ${PROJECT_ID} | Region: ${REGION}"
echo "=========================================================================="

# Authenticate and set active project
gcloud config set project "${PROJECT_ID}"

# Enable necessary Google Cloud APIs
echo "==> Enabling required GCP APIs..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com

# ------------------------------------------------------------------------------
# 2. Secret Manager for Gemini AI API Key
# ------------------------------------------------------------------------------
if [ -n "${GEMINI_KEY}" ]; then
    echo "==> Configuring Gemini API key in Secret Manager..."
    if ! gcloud secrets describe gemini-api-key --project="${PROJECT_ID}" >/dev/null 2>&1; then
        echo -n "${GEMINI_KEY}" | gcloud secrets create gemini-api-key \
            --replication-policy="automatic" \
            --data-file=-
    else
        echo -n "${GEMINI_KEY}" | gcloud secrets versions add gemini-api-key \
            --data-file=-
    fi
else
    echo "==> Warning: GEMINI_API_KEY not provided. Deployment will start with CivicLens Demo Engine fallback."
fi

# ------------------------------------------------------------------------------
# 3. Google Cloud Storage Bucket for Evidence Photos & Voice Notes
# ------------------------------------------------------------------------------
echo "==> Creating Cloud Storage Bucket: gs://${STORAGE_BUCKET}..."
if ! gsutil ls -b "gs://${STORAGE_BUCKET}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${STORAGE_BUCKET}" \
        --location="${REGION}" \
        --uniform-bucket-level-access
fi

# ------------------------------------------------------------------------------
# 4. Cloud SQL PostgreSQL & PostGIS Setup (Optional Production DB)
# ------------------------------------------------------------------------------
echo "==> Checking Cloud SQL Instance ${DB_INSTANCE}..."
# In a full Cloud SQL setup, uncomment below:
# gcloud sql instances create ${DB_INSTANCE} \
#     --database-version=POSTGRES_15 \
#     --tier=db-custom-1-3840 \
#     --region=${REGION}
# gcloud sql databases create ${DB_NAME} --instance=${DB_INSTANCE}
# gcloud sql users create ${DB_USER} --instance=${DB_INSTANCE} --password=REPLACE_WITH_SECURE_PASSWORD

# ------------------------------------------------------------------------------
# 5. Build and Deploy Backend (ASP.NET Core 8 Web API) to Cloud Run
# ------------------------------------------------------------------------------
echo "==> Building and deploying Backend API to Cloud Run..."
cd "$(dirname "$0")/.."

gcloud run deploy "${BACKEND_SERVICE}" \
    --source . \
    --dockerfile docker/Dockerfile.backend \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars="GoogleCloud__ProjectId=${PROJECT_ID},GoogleCloud__StorageBucket=${STORAGE_BUCKET},ASPNETCORE_ENVIRONMENT=Production" \
    --memory 1Gi \
    --cpu 1

BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" --platform managed --region "${REGION}" --format 'value(status.url)')
echo "==> Backend API live at: ${BACKEND_URL}"

# ------------------------------------------------------------------------------
# 6. Build and Deploy Frontend (Angular 19 SPA) to Cloud Run
# ------------------------------------------------------------------------------
echo "==> Building and deploying Frontend to Cloud Run..."
gcloud run deploy "${FRONTEND_SERVICE}" \
    --source . \
    --dockerfile docker/Dockerfile.frontend \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars="BACKEND_URL=${BACKEND_URL}" \
    --memory 512Mi \
    --cpu 1

FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" --platform managed --region "${REGION}" --format 'value(status.url)')

echo "=========================================================================="
echo " CivicLens AI Deployment Complete!"
echo " Frontend URL: ${FRONTEND_URL}"
echo " Backend API : ${BACKEND_URL}/api"
echo " Health Check: ${BACKEND_URL}/api/admin/status"
echo "=========================================================================="
