# ==============================================================================
# CivicLens AI — Universal Full-Stack Production Container
# Angular 19 SPA + ASP.NET Core 8 Web API in a Single Unified Microservice
# Compatible with: Render.com, Google Cloud Run, Hugging Face Spaces, Koyeb, Railway
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Angular 19 SPA Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build -- --configuration production

# ------------------------------------------------------------------------------
# Stage 2: Build ASP.NET Core 8 Web API Backend
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-builder
WORKDIR /src

COPY backend/CivicLens.Api/CivicLens.Api.csproj CivicLens.Api/
RUN dotnet restore CivicLens.Api/CivicLens.Api.csproj

COPY backend/CivicLens.Api/ CivicLens.Api/
WORKDIR /src/CivicLens.Api
RUN dotnet publish CivicLens.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Copy backend binaries
COPY --from=backend-builder /app/publish .

# Copy Angular static assets into wwwroot
COPY --from=frontend-builder /app/frontend/dist/frontend/browser ./wwwroot

# Support dynamic port binding (Render: 10000, Cloud Run: 8080, HF Spaces: 7860, Koyeb: 8000)
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec dotnet CivicLens.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
