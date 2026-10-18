using CivicLens.Api.Models;

namespace CivicLens.Api.Services;

public record PriorityEvaluationResult(
    string RecommendedPriority,
    string Rationale,
    List<string> TriggeredRules,
    double Confidence,
    bool RequiresUrgentReview,
    string? EmergencyGuidance);

public interface IPriorityEngine
{
    PriorityEvaluationResult Evaluate(
        CivicCase civicCase,
        int repeatReportsCount = 0,
        string? aiSuggestedSeverity = null);
}

public class PriorityEngine : IPriorityEngine
{
    public PriorityEvaluationResult Evaluate(
        CivicCase civicCase,
        int repeatReportsCount = 0,
        string? aiSuggestedSeverity = null)
    {
        // Priority Rule: Critical Emergency Safety Trigger (Suicide, Sexual Abuse, Child Abuse, Harassment)
        if (civicCase.HasEmergencySafetyTrigger)
        {
            var emergencyType = civicCase.EmergencyType ?? "Crisis Intervention";
            return new PriorityEvaluationResult(
                CasePriorities.P1,
                $"CRITICAL EMERGENCY TRIGGER ({emergencyType}): Immediate life/safety priority escalation. Relevant emergency crisis helplines provided.",
                new List<string> { $"RULE-EMERGENCY-00: Critical crisis or personal safety trigger ({emergencyType}) detected." },
                1.0,
                true,
                "CRITICAL NOTICE: Life/personal safety crisis detected. Please call 112 / specialized national helplines immediately."
            );
        }

        // Priority Rule: Non-Civic Matter / Outside Municipal Jurisdiction
        if (civicCase.IsNonCivicIssue)
        {
            return new PriorityEvaluationResult(
                CasePriorities.P4,
                $"Outside Municipal Jurisdiction: {civicCase.NonCivicReason ?? "Internal private matter"}. Routed as P4 informational / non-actionable.",
                new List<string> { "RULE-NON-CIVIC-00: Issue identified as outside government/municipal body jurisdiction (private/internal matter)." },
                0.95,
                false,
                null
            );
        }

        var triggeredRules = new List<string>();
        var text = $"{civicCase.Title} {civicCase.RawDescription} {civicCase.EditedTranscript} {civicCase.SafetyConcerns}".ToLowerInvariant();

        bool hasUrgentSafety = false;
        bool hasHighPriority = false;
        string? emergencyGuidance = null;

        // Rule 1: Imminent Public Safety Danger / Exposed Electrical Hazard / Open Deep Manhole
        if (text.Contains("electric") || text.Contains("live wire") || text.Contains("spark") ||
            text.Contains("open manhole") || text.Contains("deep crater") || text.Contains("gas leak") ||
            text.Contains("collapsed wall") || text.Contains("fire hazard") || text.Contains("खतरा") || text.Contains("करंट") ||
            civicCase.Category == IssueCategories.PublicSafety && (text.Contains("danger") || text.Contains("urgent")))
        {
            hasUrgentSafety = true;
            triggeredRules.Add("RULE-SAFETY-01: Critical immediate danger to life or physical safety detected in report content.");
            emergencyGuidance = "CRITICAL NOTICE: Potential imminent hazard. This platform is not a 911/112 emergency dispatch. If someone is injured or in immediate peril, please contact emergency rescue services directly.";
        }

        // Rule 2: Water Main Burst or Major Drainage Flooding
        if (civicCase.Category == IssueCategories.WaterDrainage &&
            (text.Contains("burst") || text.Contains("flooding") || text.Contains("overflowing sewer") || text.Contains("contamination") || text.Contains("बाढ़")))
        {
            hasHighPriority = true;
            triggeredRules.Add("RULE-INFRA-02: Water main rupture or sewer overflow causing extensive property or environmental contamination.");
        }

        // Rule 3: Major Arterial Road Obstruction or Dangerous Pothole
        if (civicCase.Category == IssueCategories.RoadDamage &&
            (text.Contains("highway") || text.Contains("main road") || text.Contains("accident") || text.Contains("bus route") || text.Contains("deep")))
        {
            hasHighPriority = true;
            triggeredRules.Add("RULE-TRANS-03: Pothole or road surface failure on high-traffic transit corridor or causing vehicular accidents.");
        }

        // Rule 4: Repeat Reports Escalation
        if (repeatReportsCount >= 3)
        {
            hasHighPriority = true;
            triggeredRules.Add($"RULE-ESCALATE-04: High citizen impact confirmed by {repeatReportsCount} repeated reports in the same geographic radius.");
        }

        // Rule 5: AI Suggested Severity Validation (Guardrail: AI cannot independently force P1 without rule confirmation)
        if (!string.IsNullOrEmpty(aiSuggestedSeverity))
        {
            if (aiSuggestedSeverity == CasePriorities.P1 && hasUrgentSafety)
            {
                triggeredRules.Add("RULE-AI-VALIDATION-05: AI suggested P1 was corroborated by deterministic safety keyword and category evaluation.");
            }
            else if (aiSuggestedSeverity == CasePriorities.P1 && !hasUrgentSafety)
            {
                triggeredRules.Add("RULE-AI-GUARDRAIL-06: AI requested P1, but system guardrail lowered to P2 pending human reviewer verification due to lack of verified critical life-safety indicators.");
                hasHighPriority = true;
            }
            else if (aiSuggestedSeverity == CasePriorities.P2)
            {
                hasHighPriority = true;
                triggeredRules.Add("RULE-AI-CORROB-07: AI suggested P2 high priority aligned with infrastructure risk assessment.");
            }
        }

        // Final Priority Calculation
        string finalPriority;
        string rationale;
        double confidence;

        if (hasUrgentSafety)
        {
            finalPriority = CasePriorities.P1;
            confidence = 0.95;
            rationale = "Assigned P1 (Urgent Safety) due to verified public safety risk factors requiring rapid dispatch within 4 hours.";
        }
        else if (hasHighPriority)
        {
            finalPriority = CasePriorities.P2;
            confidence = 0.90;
            rationale = "Assigned P2 (High Priority) due to significant infrastructure impairment, transit disruption, or multiple citizen complaints.";
        }
        else if (civicCase.Category == IssueCategories.Streetlights || civicCase.Category == IssueCategories.WasteSanitation)
        {
            finalPriority = CasePriorities.P3;
            confidence = 0.88;
            rationale = "Assigned P3 (Normal Priority) consistent with standard municipal service maintenance schedules.";
            triggeredRules.Add("RULE-DEFAULT-08: Standard municipal service request category without urgent safety escalators.");
        }
        else
        {
            finalPriority = CasePriorities.P4;
            confidence = 0.85;
            rationale = "Assigned P4 (Low Priority) as a routine civic observation or cosmetic municipal item.";
            triggeredRules.Add("RULE-ROUTINE-09: Routine maintenance item with minimal direct disruption.");
        }

        return new PriorityEvaluationResult(
            finalPriority,
            rationale,
            triggeredRules,
            confidence,
            hasUrgentSafety,
            emergencyGuidance);
    }
}
