-- CivicLens AI Database Schema for PostgreSQL / Cloud SQL
-- Enables spatial and full-text indexing for civic issue management

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "Users" (
    "Id" VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "Username" VARCHAR(100) NOT NULL UNIQUE,
    "Email" VARCHAR(150) NOT NULL UNIQUE,
    "PasswordHash" VARCHAR(255) NOT NULL,
    "FullName" VARCHAR(150) NOT NULL,
    "Role" VARCHAR(50) NOT NULL DEFAULT 'Citizen',
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Service Teams Table
CREATE TABLE IF NOT EXISTS "ServiceTeams" (
    "Id" VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "Name" VARCHAR(100) NOT NULL,
    "Code" VARCHAR(50) NOT NULL,
    "Description" TEXT NOT NULL,
    "CategorySpecialty" VARCHAR(100) NOT NULL,
    "TargetHoursP1" INT NOT NULL DEFAULT 4,
    "TargetHoursP2" INT NOT NULL DEFAULT 24,
    "TargetHoursP3" INT NOT NULL DEFAULT 72,
    "TargetHoursP4" INT NOT NULL DEFAULT 168,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Civic Cases Table
CREATE TABLE IF NOT EXISTS "Cases" (
    "Id" VARCHAR(50) PRIMARY KEY, -- e.g. CASE-2026-0001
    "CitizenId" VARCHAR(100) NOT NULL REFERENCES "Users"("Id"),
    "CitizenName" VARCHAR(150) NOT NULL,
    "Title" VARCHAR(200) NOT NULL,
    "RawDescription" TEXT NOT NULL,
    "NormalizedDescription" TEXT NOT NULL,
    "ConciseSummary" TEXT NOT NULL,
    "Category" VARCHAR(100) NOT NULL,
    "Subcategory" VARCHAR(100) NOT NULL,
    "Language" VARCHAR(50) NOT NULL DEFAULT 'en',
    "AudioUrl" TEXT,
    "OriginalTranscript" TEXT,
    "EditedTranscript" TEXT,
    "PhotoUrl" TEXT,
    "LocationAddress" TEXT,
    "Latitude" DOUBLE PRECISION,
    "Longitude" DOUBLE PRECISION,
    "LocationContext" TEXT,
    "Priority" VARCHAR(10) NOT NULL DEFAULT 'P3',
    "SuggestedPriority" VARCHAR(10) NOT NULL DEFAULT 'P3',
    "PriorityRationale" TEXT NOT NULL,
    "PriorityRulesTriggered" TEXT NOT NULL DEFAULT '[]',
    "IsPriorityOverridden" BOOLEAN NOT NULL DEFAULT FALSE,
    "PriorityOverriddenBy" VARCHAR(150),
    "PriorityOverriddenAt" TIMESTAMP WITH TIME ZONE,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Needs Review',
    "RejectionReason" TEXT,
    "AssignedTeamId" VARCHAR(100) REFERENCES "ServiceTeams"("Id"),
    "AssignedTeamName" VARCHAR(150),
    "TargetResponseHours" INT,
    "TargetResponseDate" TIMESTAMP WITH TIME ZONE,
    "IsDuplicate" BOOLEAN NOT NULL DEFAULT FALSE,
    "PrimaryCaseId" VARCHAR(50),
    "DuplicateConfidence" DOUBLE PRECISION,
    "DuplicateExplanation" TEXT,
    "DuplicateReviewStatus" VARCHAR(50) NOT NULL DEFAULT 'None',
    "ResolutionPhotoUrl" TEXT,
    "ResolutionDescription" TEXT,
    "ResolutionDate" TIMESTAMP WITH TIME ZONE,
    "ResolutionReviewerId" VARCHAR(100),
    "ResolutionReviewerName" VARCHAR(150),
    "VerificationAssessment" TEXT,
    "HasCitizenReviewRequest" BOOLEAN NOT NULL DEFAULT FALSE,
    "CitizenReviewReason" TEXT,
    "CitizenReviewRequestedAt" TIMESTAMP WITH TIME ZONE,
    "SafetyConcerns" TEXT,
    "MissingInformation" TEXT,
    "RecommendedNextStep" TEXT,
    "AIProcessingStatus" VARCHAR(50) NOT NULL DEFAULT 'Completed',
    "AIConfidence" DOUBLE PRECISION,
    "AIModelUsed" VARCHAR(150),
    "AIProcessedAt" TIMESTAMP WITH TIME ZONE,
    "AIError" TEXT,
    "IsDemo" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IX_Cases_Category" ON "Cases"("Category");
CREATE INDEX IF NOT EXISTS "IX_Cases_Priority" ON "Cases"("Priority");
CREATE INDEX IF NOT EXISTS "IX_Cases_Status" ON "Cases"("Status");
CREATE INDEX IF NOT EXISTS "IX_Cases_CitizenId" ON "Cases"("CitizenId");
CREATE INDEX IF NOT EXISTS "IX_Cases_CreatedAt" ON "Cases"("CreatedAt");

-- 4. Duplicate Relations Table
CREATE TABLE IF NOT EXISTS "DuplicateRelations" (
    "Id" VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "CaseId" VARCHAR(50) NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "PotentialDuplicateCaseId" VARCHAR(50) NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "SimilarityScore" DOUBLE PRECISION NOT NULL,
    "DistanceMeters" DOUBLE PRECISION,
    "MatchReasons" TEXT NOT NULL,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "ReviewedBy" VARCHAR(150),
    "ReviewedAt" TIMESTAMP WITH TIME ZONE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Case Activity Log Table
CREATE TABLE IF NOT EXISTS "CaseActivityLogs" (
    "Id" VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "CaseId" VARCHAR(50) NOT NULL REFERENCES "Cases"("Id") ON DELETE CASCADE,
    "UserId" VARCHAR(100),
    "UserName" VARCHAR(150) NOT NULL,
    "Action" VARCHAR(100) NOT NULL,
    "PreviousStatus" VARCHAR(50),
    "NewStatus" VARCHAR(50),
    "Notes" TEXT,
    "Timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. User Notifications Table
CREATE TABLE IF NOT EXISTS "Notifications" (
    "Id" VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "UserId" VARCHAR(100) NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "CaseId" VARCHAR(50),
    "Title" VARCHAR(200) NOT NULL,
    "Message" TEXT NOT NULL,
    "IsRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
