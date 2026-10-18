using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CivicLens.Api.DTOs;

public class CreateCaseRequest
{
    [Required]
    public string Description { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string? Language { get; set; } = "en";

    public string? AudioUrl { get; set; }

    public string? OriginalTranscript { get; set; }

    public string? EditedTranscript { get; set; }

    public string? PhotoUrl { get; set; }

    public string? LocationAddress { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public bool? IsAudioUnclear { get; set; }

    public string? AudioQualityIssue { get; set; }

    public bool? IsPhotoUnclear { get; set; }

    public string? PhotoQualityIssue { get; set; }
}

public class AIAnalysisResult
{
    [JsonPropertyName("issue_category")]
    public string IssueCategory { get; set; } = string.Empty;

    [JsonPropertyName("issue_subcategory")]
    public string IssueSubcategory { get; set; } = string.Empty;

    [JsonPropertyName("concise_summary")]
    public string ConciseSummary { get; set; } = string.Empty;

    [JsonPropertyName("normalized_description")]
    public string NormalizedDescription { get; set; } = string.Empty;

    [JsonPropertyName("detected_language")]
    public string DetectedLanguage { get; set; } = "en";

    [JsonPropertyName("location_context")]
    public string? LocationContext { get; set; }

    [JsonPropertyName("severity_suggestion")]
    public string SeveritySuggestion { get; set; } = "P3";

    [JsonPropertyName("safety_concerns")]
    public string? SafetyConcerns { get; set; }

    [JsonPropertyName("missing_information")]
    public string? MissingInformation { get; set; }

    [JsonPropertyName("recommended_next_step")]
    public string? RecommendedNextStep { get; set; }

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; } = 0.85;

    [JsonPropertyName("rationale")]
    public string Rationale { get; set; } = string.Empty;

    [JsonPropertyName("is_photo_unclear")]
    public bool IsPhotoUnclear { get; set; }

    [JsonPropertyName("photo_quality_issue")]
    public string? PhotoQualityIssue { get; set; }

    [JsonPropertyName("is_audio_unclear")]
    public bool IsAudioUnclear { get; set; }

    [JsonPropertyName("audio_quality_issue")]
    public string? AudioQualityIssue { get; set; }

    [JsonPropertyName("is_non_civic_issue")]
    public bool IsNonCivicIssue { get; set; }

    [JsonPropertyName("non_civic_rationale")]
    public string? NonCivicRationale { get; set; }

    [JsonPropertyName("has_emergency_safety_trigger")]
    public bool HasEmergencySafetyTrigger { get; set; }

    [JsonPropertyName("emergency_type")]
    public string? EmergencyType { get; set; }

    [JsonPropertyName("emergency_helplines")]
    public List<EmergencyHelplineDto> EmergencyHelplines { get; set; } = new();
}

public class VerificationAssessmentResult
{
    [JsonPropertyName("is_consistent_with_resolution")]
    public bool IsConsistentWithResolution { get; set; }

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("visual_observations")]
    public string VisualObservations { get; set; } = string.Empty;

    [JsonPropertyName("remaining_concerns")]
    public string? RemainingConcerns { get; set; }

    [JsonPropertyName("advisory_recommendation")]
    public string AdvisoryRecommendation { get; set; } = string.Empty;
}

public class AssignTeamRequest
{
    [Required]
    public string TeamId { get; set; } = string.Empty;

    public int? TargetResponseHours { get; set; }

    public string? Notes { get; set; }
}

public class PriorityOverrideRequest
{
    [Required]
    public string Priority { get; set; } = string.Empty;

    [Required]
    public string Rationale { get; set; } = string.Empty;
}

public class UpdateStatusRequest
{
    [Required]
    public string Status { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public string? RejectionReason { get; set; }
}

public class SubmitResolutionRequest
{
    [Required]
    public string ResolutionPhotoUrl { get; set; } = string.Empty;

    [Required]
    public string ResolutionDescription { get; set; } = string.Empty;
}

public class VerifyResolutionRequest
{
    public bool Approved { get; set; }

    public string? RejectionReason { get; set; }

    public string? Notes { get; set; }
}

public class CitizenReviewRequest
{
    [Required]
    public string Reason { get; set; } = string.Empty;
}

public class DuplicateReviewRequest
{
    [Required]
    public string Action { get; set; } = "confirm"; // "confirm" or "reject"

    public string? PrimaryCaseId { get; set; }
}

public class LoginRequest
{
    [Required]
    public string UsernameOrEmail { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FullName { get; set; } = string.Empty;

    public string Role { get; set; } = "Citizen";
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class TranscriptionResponse
{
    public string Transcript { get; set; } = string.Empty;
    public string DetectedLanguage { get; set; } = "en";
    public double Confidence { get; set; } = 0.9;
    public string Provider { get; set; } = "Gemini/Cloud Speech";
    public bool IsAudioUnclear { get; set; }
    public string? AudioQualityIssue { get; set; }
    public bool IsCategoryAmbiguous { get; set; }
    public string? SuggestedCategory { get; set; }
    public bool HasEmergencyTrigger { get; set; }
    public string? EmergencyType { get; set; }
    public List<EmergencyHelplineDto> EmergencyHelplines { get; set; } = new();
}

public class EmergencyHelplineDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("number")]
    public string Number { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class DashboardMetrics
{
    public int TotalCases { get; set; }
    public int PendingReview { get; set; }
    public int InProgress { get; set; }
    public int Resolved { get; set; }
    public int P1Cases { get; set; }
    public int P2Cases { get; set; }
    public int P3Cases { get; set; }
    public int P4Cases { get; set; }
    public int DuplicateCount { get; set; }
    public Dictionary<string, int> CasesByCategory { get; set; } = new();
    public Dictionary<string, int> CasesByStatus { get; set; } = new();
}

public class SetApiKeyRequest
{
    [Required]
    public string ApiKey { get; set; } = string.Empty;
}

public class UpdateLocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? Address { get; set; }
}

public class UpdateCaseRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? LocationAddress { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PhotoUrl { get; set; }
}
