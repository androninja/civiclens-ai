using System.Text.Json;
using CivicLens.Api.Data;
using CivicLens.Api.DTOs;
using CivicLens.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CivicLens.Api.Services;

public interface ICaseService
{
    Task<CivicCase> CreateCaseAsync(CreateCaseRequest request, string citizenId, string citizenName);
    Task<CivicCase?> GetCaseByIdAsync(string id, string userId, string userRole);
    Task<List<CivicCase>> GetCasesAsync(
        string? category = null,
        string? priority = null,
        string? status = null,
        string? assignedTeamId = null,
        string? citizenId = null,
        string? search = null);
    Task<CivicCase> AssignTeamAsync(string caseId, AssignTeamRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> UpdateStatusAsync(string caseId, UpdateStatusRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> OverridePriorityAsync(string caseId, PriorityOverrideRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> SubmitResolutionAsync(string caseId, SubmitResolutionRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> VerifyResolutionAsync(string caseId, VerifyResolutionRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> RequestCitizenReviewAsync(string caseId, CitizenReviewRequest request, string citizenId, string citizenName);
    Task<CivicCase> ReopenCaseAsync(string caseId, string reason, string reviewerId, string reviewerName);
    Task<CivicCase> ReviewDuplicateAsync(string caseId, DuplicateReviewRequest request, string reviewerId, string reviewerName);
    Task<CivicCase> UpdateLocationAsync(string caseId, UpdateLocationRequest request, string userId, string userName);
    Task<CivicCase> UpdateCaseAsync(string caseId, UpdateCaseRequest request, string userId, string userRole, string userName);
    Task<bool> DeleteCaseAsync(string caseId, string userId, string userRole);
    Task<List<CaseActivityLog>> GetActivityLogsAsync(string caseId);
    Task<List<DuplicateRelation>> GetDuplicatesAsync(string caseId);
    Task<List<UserNotification>> GetUserNotificationsAsync(string userId);
    Task<DashboardMetrics> GetDashboardMetricsAsync();
    Task SeedDemoDataAsync();
    Task ResetDemoDataAsync();
}

public class CaseService : ICaseService
{
    private readonly CivicLensDbContext _dbContext;
    private readonly IGeminiService _geminiService;
    private readonly IPriorityEngine _priorityEngine;
    private readonly IDuplicateDetectionService _duplicateService;
    private readonly ILogger<CaseService> _logger;

    public CaseService(
        CivicLensDbContext dbContext,
        IGeminiService geminiService,
        IPriorityEngine priorityEngine,
        IDuplicateDetectionService duplicateService,
        ILogger<CaseService> logger)
    {
        _dbContext = dbContext;
        _geminiService = geminiService;
        _priorityEngine = priorityEngine;
        _duplicateService = duplicateService;
        _logger = logger;
    }

    private static readonly SemaphoreSlim _createCaseLock = new(1, 1);

    public async Task<CivicCase> CreateCaseAsync(CreateCaseRequest request, string citizenId, string citizenName)
    {
        if (string.IsNullOrWhiteSpace(request.Description) && string.IsNullOrWhiteSpace(request.EditedTranscript))
        {
            throw new ArgumentException("Report description or voice transcript is required.");
        }

        var initialDescription = !string.IsNullOrWhiteSpace(request.Description) 
            ? request.Description 
            : request.EditedTranscript!;

        var detectedLang = GeminiService.DetectLanguageFromText($"{initialDescription} {request.EditedTranscript}", request.Language);

        var tempCaseId = Guid.NewGuid().ToString();
        var civicCase = new CivicCase
        {
            Id = tempCaseId,
            CitizenId = citizenId,
            CitizenName = citizenName,
            Title = initialDescription.Length > 60 ? initialDescription[..57] + "..." : initialDescription,
            RawDescription = initialDescription,
            Category = !string.IsNullOrWhiteSpace(request.Category) ? request.Category : IssueCategories.Other,
            Language = detectedLang,
            AudioUrl = request.AudioUrl,
            OriginalTranscript = request.OriginalTranscript,
            EditedTranscript = request.EditedTranscript,
            PhotoUrl = request.PhotoUrl,
            LocationAddress = request.LocationAddress,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Status = CaseStatuses.NeedsReview,
            AIProcessingStatus = "Processing",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        List<DuplicateCandidate> duplicates = new();

        // 1. Run Gemini AI understanding
        try
        {
            var aiResult = await _geminiService.AnalyzeIssueAsync(
                civicCase.RawDescription,
                civicCase.EditedTranscript,
                civicCase.Language,
                civicCase.PhotoUrl,
                civicCase.LocationAddress);

            civicCase.ConciseSummary = aiResult.ConciseSummary;
            civicCase.NormalizedDescription = aiResult.NormalizedDescription;
            civicCase.Subcategory = aiResult.IssueSubcategory;
            civicCase.Category = !string.IsNullOrWhiteSpace(request.Category) && request.Category != IssueCategories.Other
                ? request.Category
                : (!string.IsNullOrWhiteSpace(aiResult.IssueCategory) ? aiResult.IssueCategory : IssueCategories.Other);
            if (!string.IsNullOrWhiteSpace(aiResult.DetectedLanguage) && 
                (civicCase.Language == "en" || aiResult.DetectedLanguage != "en"))
            {
                civicCase.Language = aiResult.DetectedLanguage;
            }
            civicCase.LocationContext = aiResult.LocationContext;
            civicCase.SafetyConcerns = aiResult.SafetyConcerns;
            civicCase.MissingInformation = aiResult.MissingInformation;
            civicCase.RecommendedNextStep = aiResult.RecommendedNextStep;
            civicCase.AIConfidence = aiResult.Confidence;
            civicCase.AIModelUsed = _geminiService.ProviderName;
            civicCase.AIProcessedAt = DateTime.UtcNow;
            civicCase.AIProcessingStatus = "Completed";

            // Transfer quality, non-civic and emergency flags
            civicCase.IsPhotoUnclear = request.IsPhotoUnclear ?? (aiResult.IsPhotoUnclear || (!string.IsNullOrWhiteSpace(civicCase.PhotoUrl) && (civicCase.PhotoUrl.Contains("blur") || civicCase.PhotoUrl.Contains("dark"))));
            civicCase.PhotoQualityIssue = request.PhotoQualityIssue ?? (aiResult.PhotoQualityIssue ?? (civicCase.IsPhotoUnclear ? "Attached photograph is blurry, dark, or has insufficient visibility." : null));
            
            var hasUnclearAudioMention = civicCase.RawDescription.ToLowerInvariant().Contains("unclear audio") || civicCase.RawDescription.ToLowerInvariant().Contains("audio not clear");
            civicCase.IsAudioUnclear = request.IsAudioUnclear ?? (aiResult.IsAudioUnclear || (!string.IsNullOrWhiteSpace(civicCase.AudioUrl) && string.IsNullOrWhiteSpace(civicCase.EditedTranscript)) || hasUnclearAudioMention);
            civicCase.AudioQualityIssue = request.AudioQualityIssue ?? (aiResult.AudioQualityIssue ?? (civicCase.IsAudioUnclear ? "Voice recording has low clarity or was muffled." : null));

            civicCase.IsNonCivicIssue = aiResult.IsNonCivicIssue;
            civicCase.NonCivicReason = aiResult.NonCivicRationale;
            civicCase.HasEmergencySafetyTrigger = aiResult.HasEmergencySafetyTrigger;
            civicCase.EmergencyType = aiResult.EmergencyType;
            civicCase.EmergencyHelplinesJson = aiResult.EmergencyHelplines != null && aiResult.EmergencyHelplines.Count > 0
                ? JsonSerializer.Serialize(aiResult.EmergencyHelplines)
                : null;

            // 2. Run Duplicate Detection
            duplicates = await _duplicateService.FindPotentialDuplicatesAsync(civicCase);
            if (duplicates.Count > 0)
            {
                var topMatch = duplicates[0];
                civicCase.IsDuplicate = true;
                civicCase.PrimaryCaseId = topMatch.ExistingCase.Id;
                civicCase.DuplicateConfidence = topMatch.SimilarityScore;
                civicCase.DuplicateExplanation = topMatch.Explanation;
                civicCase.DuplicateReviewStatus = "Potential";
            }

            // 3. Evaluate Priority Rules
            var repeatCount = duplicates.Count;
            var priorityResult = _priorityEngine.Evaluate(civicCase, repeatCount, aiResult.SeveritySuggestion);

            civicCase.Priority = priorityResult.RecommendedPriority;
            civicCase.SuggestedPriority = priorityResult.RecommendedPriority;
            civicCase.PriorityRationale = priorityResult.Rationale;
            civicCase.PriorityRulesTriggered = JsonSerializer.Serialize(priorityResult.TriggeredRules);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to analyze case with AI");
            civicCase.AIProcessingStatus = "Failed";
            civicCase.AIError = ex.Message;
            civicCase.Priority = CasePriorities.P3;
            civicCase.PriorityRationale = "Default P3 applied due to AI processing failure. Requires human review.";
        }

        // Thread-safe ID assignment and atomic persistence to avoid SQLite unique constraint collisions
        await _createCaseLock.WaitAsync();
        try
        {
            var maxNum = 0;
            var existingIds = await _dbContext.Cases.Select(c => c.Id).ToListAsync();
            foreach (var id in existingIds)
            {
                if (id.StartsWith("CASE-2026-") && int.TryParse(id[10..], out var n) && n > maxNum)
                {
                    maxNum = n;
                }
            }
            var nextNum = maxNum + 1;
            while (await _dbContext.Cases.AnyAsync(c => c.Id == $"CASE-2026-{nextNum:D4}"))
            {
                nextNum++;
            }
            var caseId = $"CASE-2026-{nextNum:D4}";
            civicCase.Id = caseId;

            if (duplicates.Count > 0)
            {
                foreach (var dup in duplicates.Take(3))
                {
                    _dbContext.DuplicateRelations.Add(new DuplicateRelation
                    {
                        CaseId = civicCase.Id,
                        PotentialDuplicateCaseId = dup.ExistingCase.Id,
                        SimilarityScore = dup.SimilarityScore,
                        DistanceMeters = dup.DistanceMeters,
                        MatchReasons = dup.Explanation,
                        Status = "Pending",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            _dbContext.Cases.Add(civicCase);

            // Activity log
            _dbContext.CaseActivityLogs.Add(new CaseActivityLog
            {
                CaseId = civicCase.Id,
                UserId = citizenId,
                UserName = citizenName,
                Action = "Case Submitted",
                NewStatus = civicCase.Status,
                Notes = $"Initial submission via CivicLens AI with category '{civicCase.Category}' and priority '{civicCase.Priority}'.",
                Timestamp = DateTime.UtcNow
            });

            // Citizen notification
            _dbContext.Notifications.Add(new UserNotification
            {
                UserId = citizenId,
                CaseId = civicCase.Id,
                Title = $"Report Received: {civicCase.Id}",
                Message = $"Your report regarding '{civicCase.Category}' has been logged and analyzed. Reference ID: {civicCase.Id}.",
                CreatedAt = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync();
            return civicCase;
        }
        finally
        {
            _createCaseLock.Release();
        }
    }

    public async Task<CivicCase?> GetCaseByIdAsync(string id, string userId, string userRole)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == id);
        if (civicCase == null) return null;

        // Security check: Citizen can only view their own cases
        if (userRole == UserRoles.Citizen && civicCase.CitizenId != userId)
        {
            throw new UnauthorizedAccessException("You are not authorized to view this civic case.");
        }

        return civicCase;
    }

    public async Task<List<CivicCase>> GetCasesAsync(
        string? category = null,
        string? priority = null,
        string? status = null,
        string? assignedTeamId = null,
        string? citizenId = null,
        string? search = null)
    {
        var query = _dbContext.Cases.AsQueryable();

        if (!string.IsNullOrWhiteSpace(citizenId))
            query = query.Where(c => c.CitizenId == citizenId);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);

        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(c => c.Priority == priority);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status);

        if (!string.IsNullOrWhiteSpace(assignedTeamId))
            query = query.Where(c => c.AssignedTeamId == assignedTeamId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(c =>
                c.Id.ToLower().Contains(s) ||
                c.Title.ToLower().Contains(s) ||
                c.RawDescription.ToLower().Contains(s) ||
                (c.LocationAddress != null && c.LocationAddress.ToLower().Contains(s)) ||
                (c.ConciseSummary != null && c.ConciseSummary.ToLower().Contains(s)));
        }

        return await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
    }

    public async Task<CivicCase> AssignTeamAsync(string caseId, AssignTeamRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        var team = await _dbContext.ServiceTeams.FirstOrDefaultAsync(t => t.Id == request.TeamId)
            ?? throw new ArgumentException($"Service team with ID '{request.TeamId}' not found.");

        int hours = request.TargetResponseHours ?? civicCase.Priority switch
        {
            CasePriorities.P1 => team.TargetHoursP1,
            CasePriorities.P2 => team.TargetHoursP2,
            CasePriorities.P3 => team.TargetHoursP3,
            _ => team.TargetHoursP4
        };

        var prevStatus = civicCase.Status;
        civicCase.AssignedTeamId = team.Id;
        civicCase.AssignedTeamName = team.Name;
        civicCase.TargetResponseHours = hours;
        civicCase.TargetResponseDate = DateTime.UtcNow.AddHours(hours);
        civicCase.Status = CaseStatuses.Assigned;
        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = reviewerId,
            UserName = reviewerName,
            Action = "Team Assigned",
            PreviousStatus = prevStatus,
            NewStatus = civicCase.Status,
            Notes = $"Assigned to '{team.Name}' with target response window of {hours} hours. Notes: {request.Notes}",
            Timestamp = DateTime.UtcNow
        });

        _dbContext.Notifications.Add(new UserNotification
        {
            UserId = civicCase.CitizenId,
            CaseId = civicCase.Id,
            Title = $"Case Assigned: {civicCase.Id}",
            Message = $"Your report has been assigned to '{team.Name}'. Target resolution within {hours} hours.",
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> UpdateStatusAsync(string caseId, UpdateStatusRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (!CaseStatuses.CanTransition(civicCase.Status, request.Status))
        {
            throw new InvalidOperationException($"Invalid status transition from '{civicCase.Status}' to '{request.Status}'.");
        }

        if (request.Status == CaseStatuses.Rejected && string.IsNullOrWhiteSpace(request.RejectionReason))
        {
            throw new ArgumentException("A mandatory rejection reason is required when rejecting a case.");
        }

        var prevStatus = civicCase.Status;
        civicCase.Status = request.Status;
        civicCase.UpdatedAt = DateTime.UtcNow;

        if (request.Status == CaseStatuses.Rejected)
        {
            civicCase.RejectionReason = request.RejectionReason;
        }

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = reviewerId,
            UserName = reviewerName,
            Action = $"Status Changed to {request.Status}",
            PreviousStatus = prevStatus,
            NewStatus = request.Status,
            Notes = request.Notes ?? request.RejectionReason,
            Timestamp = DateTime.UtcNow
        });

        _dbContext.Notifications.Add(new UserNotification
        {
            UserId = civicCase.CitizenId,
            CaseId = civicCase.Id,
            Title = $"Case Status Updated: {civicCase.Id}",
            Message = $"Status changed from {prevStatus} to {request.Status}.",
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> OverridePriorityAsync(string caseId, PriorityOverrideRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (request.Priority is not (CasePriorities.P1 or CasePriorities.P2 or CasePriorities.P3 or CasePriorities.P4))
        {
            throw new ArgumentException($"Invalid priority code '{request.Priority}'.");
        }

        var prevPriority = civicCase.Priority;
        civicCase.Priority = request.Priority;
        civicCase.IsPriorityOverridden = true;
        civicCase.PriorityOverriddenBy = reviewerName;
        civicCase.PriorityOverriddenAt = DateTime.UtcNow;
        civicCase.PriorityRationale = $"[Reviewer Override by {reviewerName}]: {request.Rationale} (Previous: {prevPriority})";
        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = reviewerId,
            UserName = reviewerName,
            Action = "Priority Overridden",
            Notes = $"Priority manually changed from {prevPriority} to {request.Priority}. Rationale: {request.Rationale}",
            Timestamp = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> SubmitResolutionAsync(string caseId, SubmitResolutionRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        civicCase.ResolutionPhotoUrl = request.ResolutionPhotoUrl;
        civicCase.ResolutionDescription = request.ResolutionDescription;
        civicCase.ResolutionDate = DateTime.UtcNow;
        civicCase.ResolutionReviewerId = reviewerId;
        civicCase.ResolutionReviewerName = reviewerName;
        civicCase.Status = CaseStatuses.ResolutionSubmitted;
        civicCase.UpdatedAt = DateTime.UtcNow;

        // Advisory verification assessment via Gemini multimodal
        try
        {
            var assessment = await _geminiService.AssessResolutionAsync(
                civicCase.ConciseSummary ?? civicCase.RawDescription,
                civicCase.PhotoUrl,
                request.ResolutionPhotoUrl,
                request.ResolutionDescription);

            civicCase.VerificationAssessment = JsonSerializer.Serialize(assessment);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI resolution verification assessment failed.");
        }

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = reviewerId,
            UserName = reviewerName,
            Action = "Resolution Evidence Submitted",
            PreviousStatus = CaseStatuses.InProgress,
            NewStatus = CaseStatuses.ResolutionSubmitted,
            Notes = $"Evidence submitted: {request.ResolutionDescription}",
            Timestamp = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> VerifyResolutionAsync(string caseId, VerifyResolutionRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        var prevStatus = civicCase.Status;

        if (request.Approved)
        {
            civicCase.Status = CaseStatuses.Resolved;
            _dbContext.CaseActivityLogs.Add(new CaseActivityLog
            {
                CaseId = caseId,
                UserId = reviewerId,
                UserName = reviewerName,
                Action = "Resolution Approved",
                PreviousStatus = prevStatus,
                NewStatus = CaseStatuses.Resolved,
                Notes = request.Notes ?? "Resolution verified and signed off by municipal reviewer.",
                Timestamp = DateTime.UtcNow
            });

            _dbContext.Notifications.Add(new UserNotification
            {
                UserId = civicCase.CitizenId,
                CaseId = civicCase.Id,
                Title = $"Issue Resolved: {civicCase.Id}",
                Message = "Your reported civic issue has been resolved. You can inspect the after-photo evidence and rate the resolution.",
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.RejectionReason))
            {
                throw new ArgumentException("A mandatory rejection reason is required when rejecting resolution evidence.");
            }

            civicCase.Status = CaseStatuses.InProgress;
            _dbContext.CaseActivityLogs.Add(new CaseActivityLog
            {
                CaseId = caseId,
                UserId = reviewerId,
                UserName = reviewerName,
                Action = "Resolution Rejected",
                PreviousStatus = prevStatus,
                NewStatus = CaseStatuses.InProgress,
                Notes = $"Resolution rejected: {request.RejectionReason}. Returned to active work queue.",
                Timestamp = DateTime.UtcNow
            });
        }

        civicCase.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> RequestCitizenReviewAsync(string caseId, CitizenReviewRequest request, string citizenId, string citizenName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (civicCase.CitizenId != citizenId)
        {
            throw new UnauthorizedAccessException("Only the original citizen can dispute or request a review.");
        }

        civicCase.HasCitizenReviewRequest = true;
        civicCase.CitizenReviewReason = request.Reason;
        civicCase.CitizenReviewRequestedAt = DateTime.UtcNow;
        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = citizenId,
            UserName = citizenName,
            Action = "Citizen Review Requested",
            Notes = $"Citizen disputed resolution: {request.Reason}",
            Timestamp = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> ReopenCaseAsync(string caseId, string reason, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        var prevStatus = civicCase.Status;
        civicCase.Status = CaseStatuses.Reopened;
        civicCase.HasCitizenReviewRequest = false;
        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = caseId,
            UserId = reviewerId,
            UserName = reviewerName,
            Action = "Case Reopened",
            PreviousStatus = prevStatus,
            NewStatus = CaseStatuses.Reopened,
            Notes = $"Reopened case: {reason}",
            Timestamp = DateTime.UtcNow
        });

        _dbContext.Notifications.Add(new UserNotification
        {
            UserId = civicCase.CitizenId,
            CaseId = civicCase.Id,
            Title = $"Case Reopened: {civicCase.Id}",
            Message = "Your case has been reopened by a municipal reviewer for further action.",
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> ReviewDuplicateAsync(string caseId, DuplicateReviewRequest request, string reviewerId, string reviewerName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (request.Action.Equals("confirm", StringComparison.OrdinalIgnoreCase))
        {
            civicCase.IsDuplicate = true;
            civicCase.DuplicateReviewStatus = "Confirmed";
            if (!string.IsNullOrEmpty(request.PrimaryCaseId))
            {
                civicCase.PrimaryCaseId = request.PrimaryCaseId;
            }

            _dbContext.CaseActivityLogs.Add(new CaseActivityLog
            {
                CaseId = caseId,
                UserId = reviewerId,
                UserName = reviewerName,
                Action = "Duplicate Confirmed",
                Notes = $"Confirmed as duplicate of primary incident {civicCase.PrimaryCaseId}.",
                Timestamp = DateTime.UtcNow
            });
        }
        else
        {
            civicCase.IsDuplicate = false;
            civicCase.DuplicateReviewStatus = "Rejected";

            _dbContext.CaseActivityLogs.Add(new CaseActivityLog
            {
                CaseId = caseId,
                UserId = reviewerId,
                UserName = reviewerName,
                Action = "Duplicate Rejected",
                Notes = "Reviewer determined this is a distinct incident from flagged duplicate candidates.",
                Timestamp = DateTime.UtcNow
            });
        }

        civicCase.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> UpdateLocationAsync(string caseId, UpdateLocationRequest request, string userId, string userName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        civicCase.Latitude = request.Latitude;
        civicCase.Longitude = request.Longitude;
        if (!string.IsNullOrWhiteSpace(request.Address))
        {
            civicCase.LocationAddress = request.Address.Trim();
        }
        else if (string.IsNullOrWhiteSpace(civicCase.LocationAddress))
        {
            civicCase.LocationAddress = $"GPS Location ({request.Latitude:F5}, {request.Longitude:F5})";
        }
        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = civicCase.Id,
            UserId = userId,
            UserName = userName,
            Action = "Location Shared",
            NewStatus = civicCase.Status,
            Notes = $"Precise GPS coordinates attached: {request.Latitude:F5}, {request.Longitude:F5}",
            Timestamp = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<CivicCase> UpdateCaseAsync(string caseId, UpdateCaseRequest request, string userId, string userRole, string userName)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (userRole == UserRoles.Citizen && civicCase.CitizenId != userId)
        {
            throw new UnauthorizedAccessException("You are only authorized to modify your own reports.");
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            civicCase.Title = request.Title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Description))
        {
            civicCase.RawDescription = request.Description.Trim();
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                civicCase.Title = civicCase.RawDescription.Length > 60 
                    ? civicCase.RawDescription[..57] + "..." 
                    : civicCase.RawDescription;
            }
            var detected = GeminiService.DetectLanguageFromText(civicCase.RawDescription, civicCase.Language);
            if (!string.IsNullOrWhiteSpace(detected))
            {
                civicCase.Language = detected;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            civicCase.Category = request.Category.Trim();
        }

        if (request.LocationAddress != null)
        {
            civicCase.LocationAddress = request.LocationAddress.Trim();
        }

        if (request.Latitude.HasValue)
        {
            civicCase.Latitude = request.Latitude.Value;
        }

        if (request.Longitude.HasValue)
        {
            civicCase.Longitude = request.Longitude.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.PhotoUrl))
        {
            civicCase.PhotoUrl = request.PhotoUrl.Trim();
        }

        civicCase.UpdatedAt = DateTime.UtcNow;

        _dbContext.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = civicCase.Id,
            UserId = userId,
            UserName = userName,
            Action = "Report Modified",
            NewStatus = civicCase.Status,
            Notes = "Citizen modified incident details (description, category, or location).",
            Timestamp = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();
        return civicCase;
    }

    public async Task<bool> DeleteCaseAsync(string caseId, string userId, string userRole)
    {
        var civicCase = await _dbContext.Cases.FirstOrDefaultAsync(c => c.Id == caseId)
            ?? throw new KeyNotFoundException($"Case {caseId} not found.");

        if (userRole == UserRoles.Citizen && civicCase.CitizenId != userId)
        {
            throw new UnauthorizedAccessException("You are only authorized to delete your own reports.");
        }

        // Clean up associated duplicate relations, logs, and notifications
        var dupRelations = await _dbContext.DuplicateRelations
            .Where(d => d.CaseId == caseId || d.PotentialDuplicateCaseId == caseId)
            .ToListAsync();
        _dbContext.DuplicateRelations.RemoveRange(dupRelations);

        var logs = await _dbContext.CaseActivityLogs
            .Where(l => l.CaseId == caseId)
            .ToListAsync();
        _dbContext.CaseActivityLogs.RemoveRange(logs);

        var notifs = await _dbContext.Notifications
            .Where(n => n.CaseId == caseId)
            .ToListAsync();
        _dbContext.Notifications.RemoveRange(notifs);

        _dbContext.Cases.Remove(civicCase);

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<List<CaseActivityLog>> GetActivityLogsAsync(string caseId)
    {
        return await _dbContext.CaseActivityLogs
            .Where(l => l.CaseId == caseId)
            .OrderByDescending(l => l.Timestamp)
            .ToListAsync();
    }

    public async Task<List<DuplicateRelation>> GetDuplicatesAsync(string caseId)
    {
        return await _dbContext.DuplicateRelations
            .Where(d => d.CaseId == caseId || d.PotentialDuplicateCaseId == caseId)
            .OrderByDescending(d => d.SimilarityScore)
            .ToListAsync();
    }

    public async Task<List<UserNotification>> GetUserNotificationsAsync(string userId)
    {
        return await _dbContext.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(30)
            .ToListAsync();
    }

    public async Task<DashboardMetrics> GetDashboardMetricsAsync()
    {
        var cases = await _dbContext.Cases.ToListAsync();

        return new DashboardMetrics
        {
            TotalCases = cases.Count,
            PendingReview = cases.Count(c => c.Status is CaseStatuses.Submitted or CaseStatuses.NeedsReview),
            InProgress = cases.Count(c => c.Status is CaseStatuses.Assigned or CaseStatuses.InProgress or CaseStatuses.ResolutionSubmitted),
            Resolved = cases.Count(c => c.Status == CaseStatuses.Resolved),
            P1Cases = cases.Count(c => c.Priority == CasePriorities.P1),
            P2Cases = cases.Count(c => c.Priority == CasePriorities.P2),
            P3Cases = cases.Count(c => c.Priority == CasePriorities.P3),
            P4Cases = cases.Count(c => c.Priority == CasePriorities.P4),
            DuplicateCount = cases.Count(c => c.IsDuplicate),
            CasesByCategory = cases.GroupBy(c => c.Category).ToDictionary(g => g.Key, g => g.Count()),
            CasesByStatus = cases.GroupBy(c => c.Status).ToDictionary(g => g.Key, g => g.Count())
        };
    }

    public async Task SeedDemoDataAsync()
    {
        // 1. Seed Service Teams
        if (!await _dbContext.ServiceTeams.AnyAsync())
        {
            var teams = new List<ServiceTeam>
            {
                new()
                {
                    Id = "team-sanitation",
                    Name = "Department of Sanitation & Waste Management",
                    Code = "SAN-DEPT",
                    Description = "Demo Team: Handles municipal waste clearance, illegal dumping, and sanitary bin maintenance.",
                    CategorySpecialty = IssueCategories.WasteSanitation,
                    TargetHoursP1 = 4, TargetHoursP2 = 12, TargetHoursP3 = 48, TargetHoursP4 = 96
                },
                new()
                {
                    Id = "team-water",
                    Name = "Water Supply & Urban Drainage Division",
                    Code = "WATER-DIV",
                    Description = "Demo Team: Inspects and repairs pipeline breaches, sewer backflows, and stormwater drainage.",
                    CategorySpecialty = IssueCategories.WaterDrainage,
                    TargetHoursP1 = 2, TargetHoursP2 = 8, TargetHoursP3 = 36, TargetHoursP4 = 72
                },
                new()
                {
                    Id = "team-roads",
                    Name = "Road Infrastructure & Pavement Maintenance",
                    Code = "ROADS-INFRA",
                    Description = "Demo Team: Rapid pothole repair, resurfacing, sidewalk accessibility, and traffic hazard clearance.",
                    CategorySpecialty = IssueCategories.RoadDamage,
                    TargetHoursP1 = 4, TargetHoursP2 = 24, TargetHoursP3 = 72, TargetHoursP4 = 168
                },
                new()
                {
                    Id = "team-lighting",
                    Name = "Public Street Lighting & Electrical Grid",
                    Code = "LIGHT-GRID",
                    Description = "Demo Team: Maintains street lighting circuits, poles, luminaires, and electrical safety.",
                    CategorySpecialty = IssueCategories.Streetlights,
                    TargetHoursP1 = 3, TargetHoursP2 = 18, TargetHoursP3 = 48, TargetHoursP4 = 120
                }
            };
            _dbContext.ServiceTeams.AddRange(teams);
            await _dbContext.SaveChangesAsync();
        }

        _logger.LogInformation("CivicLens operational service teams initialized successfully.");
    }

    public async Task ResetDemoDataAsync()
    {
        _dbContext.Notifications.RemoveRange(_dbContext.Notifications);
        _dbContext.CaseActivityLogs.RemoveRange(_dbContext.CaseActivityLogs);
        _dbContext.DuplicateRelations.RemoveRange(_dbContext.DuplicateRelations);
        _dbContext.Cases.RemoveRange(_dbContext.Cases);
        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("All citizen cases and activity history cleared successfully.");
    }
}
