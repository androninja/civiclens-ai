using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CivicLens.Api.Models;

public static class UserRoles
{
    public const string Citizen = "Citizen";
    public const string Reviewer = "Reviewer";
    public const string Admin = "Administrator";
}

public class User
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = UserRoles.Citizen;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class CasePriorities
{
    public const string P1 = "P1"; // Urgent safety concern
    public const string P2 = "P2"; // High priority
    public const string P3 = "P3"; // Normal priority
    public const string P4 = "P4"; // Low priority
}

public static class CaseStatuses
{
    public const string Submitted = "Submitted";
    public const string AIProcessing = "AI Processing";
    public const string NeedsReview = "Needs Review";
    public const string Acknowledged = "Acknowledged";
    public const string Assigned = "Assigned";
    public const string InProgress = "In Progress";
    public const string ResolutionSubmitted = "Resolution Submitted";
    public const string Resolved = "Resolved";
    public const string Reopened = "Reopened";
    public const string Rejected = "Rejected";

    public static readonly string[] ValidStatuses =
    [
        Submitted,
        AIProcessing,
        NeedsReview,
        Acknowledged,
        Assigned,
        InProgress,
        ResolutionSubmitted,
        Resolved,
        Reopened,
        Rejected
    ];

    public static bool CanTransition(string current, string next)
    {
        if (current == next) return true;

        return current switch
        {
            Submitted => next is AIProcessing or NeedsReview or Acknowledged or Rejected,
            AIProcessing => next is NeedsReview or Acknowledged or Rejected,
            NeedsReview => next is Acknowledged or Assigned or Rejected,
            Acknowledged => next is Assigned or InProgress or Rejected,
            Assigned => next is InProgress or NeedsReview or Rejected,
            InProgress => next is ResolutionSubmitted or Assigned or NeedsReview,
            ResolutionSubmitted => next is Resolved or InProgress or NeedsReview,
            Resolved => next is Reopened,
            Reopened => next is NeedsReview or Assigned or InProgress,
            Rejected => next is Reopened,
            _ => false
        };
    }
}

public static class IssueCategories
{
    public const string WasteSanitation = "Waste and sanitation";
    public const string WaterDrainage = "Water leakage and drainage";
    public const string RoadDamage = "Road damage and potholes";
    public const string Streetlights = "Broken streetlights";
    public const string PublicSafety = "Public safety and accessibility";
    public const string TrafficSignals = "Traffic signals and road signage";
    public const string ParksGreenery = "Parks, trees and public greenery";
    public const string StrayAnimals = "Stray animals and public health";
    public const string Pollution = "Air, noise and environmental pollution";
    public const string PublicTransport = "Public transport and bus shelters";
    public const string Encroachment = "Encroachment and illegal hoarding";
    public const string Other = "Other civic issues";

    public static readonly string[] All =
    [
        WasteSanitation,
        WaterDrainage,
        RoadDamage,
        Streetlights,
        PublicSafety,
        TrafficSignals,
        ParksGreenery,
        StrayAnimals,
        Pollution,
        PublicTransport,
        Encroachment,
        Other
    ];
}

public class CivicCase
{
    [Key]
    public string Id { get; set; } = string.Empty; // e.g. CASE-2026-0001

    [Required]
    public string CitizenId { get; set; } = string.Empty;

    public string CitizenName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string RawDescription { get; set; } = string.Empty;

    public string NormalizedDescription { get; set; } = string.Empty;

    public string ConciseSummary { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = IssueCategories.Other;

    [MaxLength(100)]
    public string Subcategory { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Language { get; set; } = "en";

    public string? AudioUrl { get; set; }

    public string? OriginalTranscript { get; set; }

    public string? EditedTranscript { get; set; }

    public string? PhotoUrl { get; set; }

    public string? LocationAddress { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public string? LocationContext { get; set; }

    [Required]
    [MaxLength(10)]
    public string Priority { get; set; } = CasePriorities.P3;

    [MaxLength(10)]
    public string SuggestedPriority { get; set; } = CasePriorities.P3;

    public string PriorityRationale { get; set; } = string.Empty;

    public string PriorityRulesTriggered { get; set; } = "[]";

    public bool IsPriorityOverridden { get; set; }

    public string? PriorityOverriddenBy { get; set; }

    public DateTime? PriorityOverriddenAt { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = CaseStatuses.Submitted;

    public string? RejectionReason { get; set; }

    public string? AssignedTeamId { get; set; }

    public string? AssignedTeamName { get; set; }

    public int? TargetResponseHours { get; set; }

    public DateTime? TargetResponseDate { get; set; }

    // Duplicate Detection Fields
    public bool IsDuplicate { get; set; }

    public string? PrimaryCaseId { get; set; }

    public double? DuplicateConfidence { get; set; }

    public string? DuplicateExplanation { get; set; }

    public string DuplicateReviewStatus { get; set; } = "None"; // None, Potential, Confirmed, Rejected

    // Resolution Evidence
    public string? ResolutionPhotoUrl { get; set; }

    public string? ResolutionDescription { get; set; }

    public DateTime? ResolutionDate { get; set; }

    public string? ResolutionReviewerId { get; set; }

    public string? ResolutionReviewerName { get; set; }

    public string? VerificationAssessment { get; set; }

    // Citizen Review Request
    public bool HasCitizenReviewRequest { get; set; }

    public string? CitizenReviewReason { get; set; }

    public DateTime? CitizenReviewRequestedAt { get; set; }

    // AI Insight Fields
    public string? SafetyConcerns { get; set; }

    public string? MissingInformation { get; set; }

    public string? RecommendedNextStep { get; set; }

    public string AIProcessingStatus { get; set; } = "Pending"; // Pending, Completed, Failed, Fallback

    public double? AIConfidence { get; set; }

    public string? AIModelUsed { get; set; }

    public DateTime? AIProcessedAt { get; set; }

    public string? AIError { get; set; }

    // Quality & Jurisdiction Flags
    public bool IsPhotoUnclear { get; set; }
    public string? PhotoQualityIssue { get; set; }

    public bool IsAudioUnclear { get; set; }
    public string? AudioQualityIssue { get; set; }

    public bool IsNonCivicIssue { get; set; }
    public string? NonCivicReason { get; set; }

    // Emergency & Crisis Intervention Flags
    public bool HasEmergencySafetyTrigger { get; set; }
    public string? EmergencyType { get; set; }
    public string? EmergencyHelplinesJson { get; set; }

    public bool IsDemo { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class DuplicateRelation
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string CaseId { get; set; } = string.Empty;

    [Required]
    public string PotentialDuplicateCaseId { get; set; } = string.Empty;

    public double SimilarityScore { get; set; }

    public double? DistanceMeters { get; set; }

    public string MatchReasons { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending"; // Pending, Confirmed, Rejected

    public string? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ServiceTeam
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string CategorySpecialty { get; set; } = string.Empty;

    public int TargetHoursP1 { get; set; } = 4;

    public int TargetHoursP2 { get; set; } = 24;

    public int TargetHoursP3 { get; set; } = 72;

    public int TargetHoursP4 { get; set; } = 168;

    public bool IsActive { get; set; } = true;
}

public class CaseActivityLog
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string CaseId { get; set; } = string.Empty;

    public string? UserId { get; set; }

    public string UserName { get; set; } = "System";

    [Required]
    [MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    public string? PreviousStatus { get; set; }

    public string? NewStatus { get; set; }

    public string? Notes { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class UserNotification
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string UserId { get; set; } = string.Empty;

    public string? CaseId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
