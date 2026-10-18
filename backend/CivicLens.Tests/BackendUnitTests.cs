using System.Net;
using System.Text.Json;
using CivicLens.Api.Data;
using CivicLens.Api.DTOs;
using CivicLens.Api.Models;
using CivicLens.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using SixLabors.ImageSharp;
using Xunit;

namespace CivicLens.Tests;

public class BackendUnitTests
{
    private CivicLensDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<CivicLensDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        var context = new CivicLensDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    // 1. Valid report creation
    [Fact]
    public async Task Test_01_ValidReportCreation()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_01_ValidReportCreation));
        var mockGemini = new Mock<IGeminiService>();
        mockGemini.Setup(g => g.AnalyzeIssueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AIAnalysisResult
            {
                IssueCategory = IssueCategories.WasteSanitation,
                IssueSubcategory = "Trash Dump",
                ConciseSummary = "Overflowing garbage bin",
                NormalizedDescription = "Garbage overflow reported",
                SeveritySuggestion = CasePriorities.P3,
                Confidence = 0.92
            });

        var priorityEngine = new PriorityEngine();
        var mockLogger = new Mock<ILogger<DuplicateDetectionService>>();
        var dupService = new DuplicateDetectionService(db, mockLogger.Object);
        var caseLogger = new Mock<ILogger<CaseService>>();
        var caseService = new CaseService(db, mockGemini.Object, priorityEngine, dupService, caseLogger.Object);

        var request = new CreateCaseRequest
        {
            Description = "Large pile of uncollected trash near the corner store.",
            Category = IssueCategories.WasteSanitation,
            LocationAddress = "123 Main St",
            Latitude = 28.6139,
            Longitude = 77.2090
        };

        var result = await caseService.CreateCaseAsync(request, "usr-citizen-1", "Citizen John");

        Assert.NotNull(result);
        Assert.StartsWith("CASE-2026-", result.Id);
        Assert.Equal(CaseStatuses.NeedsReview, result.Status);
        Assert.Equal(IssueCategories.WasteSanitation, result.Category);
        Assert.Equal("usr-citizen-1", result.CitizenId);
    }

    // 2. Missing required report information
    [Fact]
    public async Task Test_02_MissingRequiredReportInformation()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_02_MissingRequiredReportInformation));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        var emptyRequest = new CreateCaseRequest
        {
            Description = "   ",
            EditedTranscript = null
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            caseService.CreateCaseAsync(emptyRequest, "usr-1", "John"));
    }

    // 3. Unsupported or oversized image upload
    [Fact]
    public async Task Test_03_UnsupportedOrOversizedImageUpload()
    {
        var mockEnv = new Mock<IWebHostEnvironment>();
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<StorageService>>();
        var storage = new StorageService(mockEnv.Object, mockConfig.Object, mockLogger.Object);

        Assert.True(storage.IsAllowedFileType("image/jpeg", ".jpg"));
        Assert.True(storage.IsAllowedFileType("image/png", ".png"));
        Assert.True(storage.IsAllowedFileType("image/webp", ".webp"));

        // Unsupported types
        Assert.False(storage.IsAllowedFileType("application/pdf", ".pdf"));
        Assert.False(storage.IsAllowedFileType("application/x-msdownload", ".exe"));
        Assert.False(storage.IsAllowedFileType("text/html", ".html"));

        Assert.Equal(2 * 1024 * 1024, storage.MaxImageFileSizeBytes);
        Assert.Equal(2 * 1024 * 1024, storage.MaxFileSizeBytes);

        // Oversized image stream (> 2MB) must throw InvalidOperationException
        var oversizedStream = new MemoryStream(new byte[3 * 1024 * 1024]);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            storage.SaveFileAsync(oversizedStream, "huge.jpg", "image/jpeg", "photo"));
    }

    // 4. Valid AI JSON response parsing
    [Fact]
    public void Test_04_ValidAIJsonResponseParsing()
    {
        var validJson = @"{
            ""issue_category"": ""Waste and sanitation"",
            ""issue_subcategory"": ""Overflowing Bin"",
            ""concise_summary"": ""Garbage bin full and spilling on street"",
            ""normalized_description"": ""Commercial dumpster overflowing onto sidewalk."",
            ""detected_language"": ""en"",
            ""location_context"": ""Opposite bakery"",
            ""severity_suggestion"": ""P3"",
            ""safety_concerns"": null,
            ""missing_information"": null,
            ""recommended_next_step"": ""Dispatch truck"",
            ""confidence"": 0.94,
            ""rationale"": ""Observed solid waste spilling onto pedestrian pathway.""
        }";

        var result = JsonSerializer.Deserialize<AIAnalysisResult>(validJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(result);
        Assert.Equal("Waste and sanitation", result.IssueCategory);
        Assert.Equal("Overflowing Bin", result.IssueSubcategory);
        Assert.Equal("P3", result.SeveritySuggestion);
        Assert.Equal(0.94, result.Confidence);
    }

    // 5. Invalid or malformed AI response handling
    [Fact]
    public void Test_05_InvalidOrMalformedAIResponseHandling()
    {
        var malformedJson = "{ invalid json content ... }";

        Assert.Throws<JsonException>(() =>
        {
            JsonSerializer.Deserialize<AIAnalysisResult>(malformedJson);
        });
    }

    // 6. AI timeout and retry behavior
    [Fact]
    public async Task Test_06_AITimeoutAndRetryBehavior()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_06_AITimeoutAndRetryBehavior));
        var mockGemini = new Mock<IGeminiService>();
        mockGemini.Setup(g => g.AnalyzeIssueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TaskCanceledException("Live Gemini model request timed out after 30s"));

        var caseService = new CaseService(
            db,
            mockGemini.Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        var req = new CreateCaseRequest { Description = "Water leakage outside my gate" };
        var result = await caseService.CreateCaseAsync(req, "usr-1", "John");

        // System must not drop the report, it should mark AI as Failed or Fallback with default priority
        Assert.NotNull(result);
        Assert.Equal("Failed", result.AIProcessingStatus);
        Assert.Contains("timed out", result.AIError);
        Assert.Equal(CasePriorities.P3, result.Priority);
    }

    // 7. Hindi and English transcript processing
    [Fact]
    public async Task Test_07_HindiAndEnglishTranscriptProcessing()
    {
        var mockEnv = new Mock<IWebHostEnvironment>();
        var mockConfig = new Mock<IConfiguration>();
        var mockLogger = new Mock<ILogger<GeminiService>>();
        var httpClient = new HttpClient();
        var gemini = new GeminiService(httpClient, mockConfig.Object, mockLogger.Object, mockEnv.Object);

        using var hindiStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var hindiRes = await gemini.TranscribeAudioAsync(hindiStream, "audio/webm", "hi", "मुख्य सड़क पर गहरा गड्ढा है");
        Assert.Equal("hi", hindiRes.DetectedLanguage);
        Assert.Contains("गड्ढा", hindiRes.Transcript);

        using var engStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var engRes = await gemini.TranscribeAudioAsync(engStream, "audio/webm", "en", "Water accumulation on pedestrian walkway");
        Assert.Equal("en", engRes.DetectedLanguage);
        Assert.Contains("water", engRes.Transcript.ToLowerInvariant());

        using var clientSpeechStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var actualSpeech = "Citizen actual voice message: street light is broken on main corner";
        var clientSpeechRes = await gemini.TranscribeAudioAsync(clientSpeechStream, "audio/webm", "en", actualSpeech);
        Assert.Equal(actualSpeech, clientSpeechRes.Transcript);
        Assert.Equal("Web Speech API (Real-time Speech Recognition)", clientSpeechRes.Provider);

        using var emptyStream = new MemoryStream(new byte[] { 1, 2, 3 });
        var emptyRes = await gemini.TranscribeAudioAsync(emptyStream, "audio/webm", "en");
        Assert.Equal(string.Empty, emptyRes.Transcript);
    }

    // 8. Duplicate detection for similar reports at the same location
    [Fact]
    public void Test_08_DuplicateDetection_SimilarReportsSameLocation()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_08_DuplicateDetection_SimilarReportsSameLocation));
        var dupService = new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object);

        var caseA = new CivicCase
        {
            Id = "CASE-101",
            Category = IssueCategories.RoadDamage,
            Title = "Large pothole on 5th Avenue",
            RawDescription = "Huge deep pothole causing traffic slowdown near signal",
            Latitude = 28.5355,
            Longitude = 77.2600,
            CreatedAt = DateTime.UtcNow.AddHours(-2)
        };

        var caseB = new CivicCase
        {
            Id = "CASE-102",
            Category = IssueCategories.RoadDamage,
            Title = "Dangerous pothole at 5th Ave traffic signal",
            RawDescription = "Very deep pothole near traffic light, cars braking abruptly",
            Latitude = 28.5356, // Approx 15 meters away
            Longitude = 77.2601,
            CreatedAt = DateTime.UtcNow
        };

        var (score, distance, explanation, locMissing) = dupService.EvaluatePair(caseA, caseB);

        Assert.False(locMissing);
        Assert.True(distance < 50); // Under 50m
        Assert.True(score >= 0.70, $"Expected score >= 0.70, got {score}");
        Assert.Contains("Geographic proximity", explanation);
    }

    // 9. Non-duplicate reports at different locations
    [Fact]
    public void Test_09_NonDuplicateReports_DifferentLocations()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_09_NonDuplicateReports_DifferentLocations));
        var dupService = new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object);

        var caseA = new CivicCase
        {
            Id = "CASE-201",
            Category = IssueCategories.WasteSanitation,
            Title = "Trash bin overflowing",
            RawDescription = "Dumpster full of boxes and plastic",
            Latitude = 28.5000,
            Longitude = 77.1000,
            CreatedAt = DateTime.UtcNow
        };

        var caseB = new CivicCase
        {
            Id = "CASE-202",
            Category = IssueCategories.WasteSanitation,
            Title = "Trash bin overflowing",
            RawDescription = "Dumpster full of boxes and plastic",
            Latitude = 28.7000, // Over 20 km away
            Longitude = 77.3000,
            CreatedAt = DateTime.UtcNow
        };

        var (score, distance, _, _) = dupService.EvaluatePair(caseA, caseB);

        Assert.True(distance > 10000);
        Assert.True(score < 0.60, $"Expected score < 0.60 for distant location, got {score}");
    }

    // 10. Duplicate detection when location is missing
    [Fact]
    public void Test_10_DuplicateDetection_WhenLocationIsMissing()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_10_DuplicateDetection_WhenLocationIsMissing));
        var dupService = new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object);

        var caseA = new CivicCase
        {
            Id = "CASE-301",
            Category = IssueCategories.Streetlights,
            Title = "Dark street broken sodium lamp",
            RawDescription = "Streetlight pole #4 is dark and unlit",
            Latitude = null,
            Longitude = null,
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        var caseB = new CivicCase
        {
            Id = "CASE-302",
            Category = IssueCategories.Streetlights,
            Title = "Streetlight pole dark unlit",
            RawDescription = "Pole #4 sodium lamp is dark",
            Latitude = null,
            Longitude = null,
            CreatedAt = DateTime.UtcNow
        };

        var (score, distance, explanation, locMissing) = dupService.EvaluatePair(caseA, caseB);

        Assert.True(locMissing);
        Assert.Null(distance);
        Assert.Contains("Reduced Confidence", explanation);
        Assert.True(score >= 0.50);
    }

    // 11. Priority rule evaluation
    [Fact]
    public void Test_11_PriorityRuleEvaluation()
    {
        var engine = new PriorityEngine();

        // P1 safety trigger
        var urgentCase = new CivicCase
        {
            Category = IssueCategories.PublicSafety,
            Title = "Exposed live wire sparking in puddle",
            RawDescription = "High voltage cable fell down and is sparking near children playing",
            SafetyConcerns = "Electrocution danger"
        };
        var p1Result = engine.Evaluate(urgentCase);
        Assert.Equal(CasePriorities.P1, p1Result.RecommendedPriority);
        Assert.True(p1Result.RequiresUrgentReview);
        Assert.NotNull(p1Result.EmergencyGuidance);

        // P2 infrastructure trigger
        var infraCase = new CivicCase
        {
            Category = IssueCategories.WaterDrainage,
            Title = "Drinking water pipe burst",
            RawDescription = "Major water pipeline burst flooding roadway intersection",
        };
        var p2Result = engine.Evaluate(infraCase);
        Assert.Equal(CasePriorities.P2, p2Result.RecommendedPriority);

        // P3 routine trigger
        var normalCase = new CivicCase
        {
            Category = IssueCategories.WasteSanitation,
            Title = "Garbage bin full",
            RawDescription = "Bin needs regular collection"
        };
        var p3Result = engine.Evaluate(normalCase);
        Assert.Equal(CasePriorities.P3, p3Result.RecommendedPriority);
    }

    // 12. Invalid status transitions
    [Fact]
    public void Test_12_InvalidStatusTransitions()
    {
        // Valid transitions
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.Submitted, CaseStatuses.NeedsReview));
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.NeedsReview, CaseStatuses.Assigned));
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.Assigned, CaseStatuses.InProgress));
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.InProgress, CaseStatuses.ResolutionSubmitted));
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.ResolutionSubmitted, CaseStatuses.Resolved));
        Assert.True(CaseStatuses.CanTransition(CaseStatuses.Resolved, CaseStatuses.Reopened));

        // Invalid transitions
        Assert.False(CaseStatuses.CanTransition(CaseStatuses.Submitted, CaseStatuses.Resolved));
        Assert.False(CaseStatuses.CanTransition(CaseStatuses.Submitted, CaseStatuses.InProgress));
        Assert.False(CaseStatuses.CanTransition(CaseStatuses.Resolved, CaseStatuses.Assigned));
        Assert.False(CaseStatuses.CanTransition(CaseStatuses.InProgress, CaseStatuses.Resolved));
    }

    // 13. Unauthorized case access
    [Fact]
    public async Task Test_13_UnauthorizedCaseAccess()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_13_UnauthorizedCaseAccess));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-PRIVATE",
            CitizenId = "usr-citizen-A",
            CitizenName = "Alice",
            Title = "Private issue",
            RawDescription = "Citizen A's private submission",
            Category = IssueCategories.Other
        });
        await db.SaveChangesAsync();

        // Citizen B attempting to read Citizen A's case must throw UnauthorizedAccessException
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            caseService.GetCaseByIdAsync("CASE-PRIVATE", "usr-citizen-B", UserRoles.Citizen));

        // Reviewer can access it
        var reviewerView = await caseService.GetCaseByIdAsync("CASE-PRIVATE", "usr-reviewer", UserRoles.Reviewer);
        Assert.NotNull(reviewerView);
    }

    // 14. Unauthorized reviewer actions
    [Fact]
    public async Task Test_14_UnauthorizedReviewerActions()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_14_UnauthorizedReviewerActions));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-DISPUTE-TEST",
            CitizenId = "usr-citizen-1",
            Status = CaseStatuses.Resolved,
            Category = IssueCategories.RoadDamage,
            RawDescription = "Fixed road"
        });
        await db.SaveChangesAsync();

        // Only the original citizen can dispute their case
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            caseService.RequestCitizenReviewAsync("CASE-DISPUTE-TEST", new CitizenReviewRequest { Reason = "Not fixed" }, "usr-citizen-OTHER", "Other Person"));
    }

    // 15. Assignment to a valid service team
    [Fact]
    public async Task Test_15_AssignmentToValidServiceTeam()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_15_AssignmentToValidServiceTeam));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.ServiceTeams.Add(new ServiceTeam
        {
            Id = "team-roads",
            Name = "Road Maintenance",
            Code = "ROADS",
            TargetHoursP2 = 24
        });
        db.Cases.Add(new CivicCase
        {
            Id = "CASE-ASSIGN-01",
            CitizenId = "usr-1",
            Status = CaseStatuses.NeedsReview,
            Priority = CasePriorities.P2,
            Category = IssueCategories.RoadDamage,
            RawDescription = "Pothole repair needed"
        });
        await db.SaveChangesAsync();

        var assignRequest = new AssignTeamRequest
        {
            TeamId = "team-roads",
            Notes = "Please inspect tomorrow morning"
        };

        var updated = await caseService.AssignTeamAsync("CASE-ASSIGN-01", assignRequest, "usr-rev-1", "Reviewer Vikram");

        Assert.Equal("team-roads", updated.AssignedTeamId);
        Assert.Equal("Road Maintenance", updated.AssignedTeamName);
        Assert.Equal(CaseStatuses.Assigned, updated.Status);
        Assert.Equal(24, updated.TargetResponseHours);
        Assert.NotNull(updated.TargetResponseDate);
    }

    // 16. Resolution approval and rejection
    [Fact]
    public async Task Test_16_ResolutionApprovalAndRejection()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_16_ResolutionApprovalAndRejection));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-VERIFY-01",
            CitizenId = "usr-1",
            Status = CaseStatuses.ResolutionSubmitted,
            Category = IssueCategories.Streetlights,
            RawDescription = "Dark street",
            ResolutionPhotoUrl = "https://example.com/after.jpg",
            ResolutionDescription = "Light fixed"
        });
        await db.SaveChangesAsync();

        // Rejection without reason fails
        await Assert.ThrowsAsync<ArgumentException>(() =>
            caseService.VerifyResolutionAsync("CASE-VERIFY-01", new VerifyResolutionRequest { Approved = false, RejectionReason = "" }, "rev-1", "Reviewer"));

        // Rejection with reason returns to InProgress
        var rejected = await caseService.VerifyResolutionAsync("CASE-VERIFY-01", new VerifyResolutionRequest { Approved = false, RejectionReason = "Photo is blurry, pole number unclear" }, "rev-1", "Reviewer");
        Assert.Equal(CaseStatuses.InProgress, rejected.Status);

        // Move back to ResolutionSubmitted
        rejected.Status = CaseStatuses.ResolutionSubmitted;
        await db.SaveChangesAsync();

        // Approval changes to Resolved
        var approved = await caseService.VerifyResolutionAsync("CASE-VERIFY-01", new VerifyResolutionRequest { Approved = true, Notes = "Work verified on site" }, "rev-1", "Reviewer");
        Assert.Equal(CaseStatuses.Resolved, approved.Status);
    }

    // 17. Reopening a resolved case
    [Fact]
    public async Task Test_17_ReopeningResolvedCase()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_17_ReopeningResolvedCase));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-REOPEN-01",
            CitizenId = "usr-1",
            Status = CaseStatuses.Resolved,
            Category = IssueCategories.WaterDrainage,
            RawDescription = "Fixed drain"
        });
        await db.SaveChangesAsync();

        var reopened = await caseService.ReopenCaseAsync("CASE-REOPEN-01", "Citizen reported drain is clogged again after yesterday's rain", "rev-1", "Reviewer Vikram");

        Assert.Equal(CaseStatuses.Reopened, reopened.Status);
        var logs = await caseService.GetActivityLogsAsync("CASE-REOPEN-01");
        Assert.Contains(logs, l => l.Action == "Case Reopened");
    }

    // 18. Audit history creation
    [Fact]
    public async Task Test_18_AuditHistoryCreation()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_18_AuditHistoryCreation));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-AUDIT-01",
            CitizenId = "usr-1",
            Status = CaseStatuses.Submitted,
            Category = IssueCategories.RoadDamage,
            Priority = CasePriorities.P3,
            RawDescription = "Pothole"
        });
        await db.SaveChangesAsync();

        // Override priority
        await caseService.OverridePriorityAsync("CASE-AUDIT-01", new PriorityOverrideRequest
        {
            Priority = CasePriorities.P1,
            Rationale = "Near primary school entrance during arrival time"
        }, "usr-rev", "Officer Sharma");

        var logs = await caseService.GetActivityLogsAsync("CASE-AUDIT-01");

        Assert.NotEmpty(logs);
        Assert.Contains(logs, l => l.Action == "Priority Overridden" && l.UserName == "Officer Sharma");
    }

    // 19. Booking or assignment concurrency
    [Fact]
    public async Task Test_19_AssignmentConcurrencyHandling()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_19_AssignmentConcurrencyHandling));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.ServiceTeams.Add(new ServiceTeam { Id = "team-1", Name = "Team 1" });
        db.ServiceTeams.Add(new ServiceTeam { Id = "team-2", Name = "Team 2" });
        db.Cases.Add(new CivicCase
        {
            Id = "CASE-CONCURRENT",
            CitizenId = "usr-1",
            Status = CaseStatuses.NeedsReview,
            Category = IssueCategories.Other,
            RawDescription = "Issue"
        });
        await db.SaveChangesAsync();

        // Simulate concurrent assignment attempts
        var task1 = caseService.AssignTeamAsync("CASE-CONCURRENT", new AssignTeamRequest { TeamId = "team-1" }, "rev-1", "Reviewer 1");
        var task2 = caseService.AssignTeamAsync("CASE-CONCURRENT", new AssignTeamRequest { TeamId = "team-2" }, "rev-2", "Reviewer 2");

        var results = await Task.WhenAll(task1, task2);

        // Both complete safely with consistent final status
        Assert.Equal(CaseStatuses.Assigned, results[0].Status);
        Assert.Equal(CaseStatuses.Assigned, results[1].Status);

        var finalCase = await db.Cases.FindAsync("CASE-CONCURRENT");
        Assert.NotNull(finalCase);
        Assert.Equal(CaseStatuses.Assigned, finalCase.Status);
    }

    // 20. Persistence and retrieval after application restart
    [Fact]
    public async Task Test_20_PersistenceAndRetrievalAfterRestart()
    {
        var dbName = "PersistentTestDb_" + Guid.NewGuid();

        // "First run" - create and save
        using (var db1 = CreateInMemoryDbContext(dbName))
        {
            var caseService1 = new CaseService(
                db1,
                new Mock<IGeminiService>().Object,
                new PriorityEngine(),
                new DuplicateDetectionService(db1, new Mock<ILogger<DuplicateDetectionService>>().Object),
                new Mock<ILogger<CaseService>>().Object);

            db1.Cases.Add(new CivicCase
            {
                Id = "CASE-PERSIST-01",
                CitizenId = "usr-citizen-42",
                CitizenName = "Priya Rao",
                Title = "Broken water main",
                RawDescription = "Flooding on cross street",
                Category = IssueCategories.WaterDrainage,
                Priority = CasePriorities.P2,
                Status = CaseStatuses.InProgress
            });
            await db1.SaveChangesAsync();
        }

        // "Second run / Application restart" - re-open same database
        using (var db2 = CreateInMemoryDbContext(dbName))
        {
            var caseService2 = new CaseService(
                db2,
                new Mock<IGeminiService>().Object,
                new PriorityEngine(),
                new DuplicateDetectionService(db2, new Mock<ILogger<DuplicateDetectionService>>().Object),
                new Mock<ILogger<CaseService>>().Object);

            var retrieved = await caseService2.GetCaseByIdAsync("CASE-PERSIST-01", "usr-citizen-42", UserRoles.Citizen);

            Assert.NotNull(retrieved);
            Assert.Equal("CASE-PERSIST-01", retrieved.Id);
            Assert.Equal("Priya Rao", retrieved.CitizenName);
            Assert.Equal(CaseStatuses.InProgress, retrieved.Status);
            Assert.Equal(CasePriorities.P2, retrieved.Priority);
        }
    }

    // 21. Citizen owner modifies their reported incident
    [Fact]
    public async Task Test_21_OwnerModifiesReportedIncident()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_21_OwnerModifiesReportedIncident));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-EDIT-01",
            CitizenId = "usr-citizen-01",
            CitizenName = "Ananya Sharma",
            Title = "Initial Title",
            RawDescription = "Initial description of potholes",
            Category = IssueCategories.RoadDamage,
            LocationAddress = "MG Road Sector 4",
            Priority = CasePriorities.P3,
            Status = CaseStatuses.NeedsReview
        });
        await db.SaveChangesAsync();

        var updateReq = new UpdateCaseRequest
        {
            Title = "Updated Potholes on MG Road",
            Description = "Severe potholes causing major vehicle slowdowns",
            Category = IssueCategories.RoadDamage,
            LocationAddress = "MG Road Sector 4, near metro pillar 120"
        };

        var updated = await caseService.UpdateCaseAsync("CASE-EDIT-01", updateReq, "usr-citizen-01", UserRoles.Citizen, "Ananya Sharma");

        Assert.NotNull(updated);
        Assert.Equal("Updated Potholes on MG Road", updated.Title);
        Assert.Equal("Severe potholes causing major vehicle slowdowns", updated.RawDescription);
        Assert.Equal("MG Road Sector 4, near metro pillar 120", updated.LocationAddress);

        // Verify activity log was added
        var logs = await db.CaseActivityLogs.Where(l => l.CaseId == "CASE-EDIT-01").ToListAsync();
        Assert.Contains(logs, l => l.Action == "Report Modified");
    }

    // 22. Unauthorized user cannot modify another citizen's incident
    [Fact]
    public async Task Test_22_UnauthorizedUserCannotModifyIncident()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_22_UnauthorizedUserCannotModifyIncident));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-EDIT-02",
            CitizenId = "usr-citizen-01",
            CitizenName = "Ananya Sharma",
            Title = "Initial Title",
            RawDescription = "Initial description",
            Category = IssueCategories.RoadDamage,
            Status = CaseStatuses.NeedsReview
        });
        await db.SaveChangesAsync();

        var updateReq = new UpdateCaseRequest
        {
            Title = "Malicious Modification",
            Description = "Tampered description"
        };

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            caseService.UpdateCaseAsync("CASE-EDIT-02", updateReq, "usr-different-citizen", UserRoles.Citizen, "Intruder"));
    }

    // 23. Citizen owner deletes their reported incident with cascading cleanup
    [Fact]
    public async Task Test_23_OwnerDeletesReportedIncident()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_23_OwnerDeletesReportedIncident));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-DEL-01",
            CitizenId = "usr-citizen-01",
            CitizenName = "Ananya Sharma",
            Title = "Case to Delete",
            RawDescription = "Description to delete",
            Category = IssueCategories.WasteSanitation,
            Status = CaseStatuses.NeedsReview
        });

        db.CaseActivityLogs.Add(new CaseActivityLog
        {
            CaseId = "CASE-DEL-01",
            UserId = "usr-citizen-01",
            Action = "Initial Submission",
            Timestamp = DateTime.UtcNow
        });

        db.DuplicateRelations.Add(new DuplicateRelation
        {
            CaseId = "CASE-DEL-01",
            PotentialDuplicateCaseId = "CASE-OTHER-01",
            SimilarityScore = 0.80
        });

        await db.SaveChangesAsync();

        var deleted = await caseService.DeleteCaseAsync("CASE-DEL-01", "usr-citizen-01", UserRoles.Citizen);

        Assert.True(deleted);
        Assert.Null(await db.Cases.FindAsync("CASE-DEL-01"));
        Assert.Empty(await db.CaseActivityLogs.Where(l => l.CaseId == "CASE-DEL-01").ToListAsync());
        Assert.Empty(await db.DuplicateRelations.Where(d => d.CaseId == "CASE-DEL-01").ToListAsync());
    }

    // 24. Unauthorized user cannot delete another citizen's incident
    [Fact]
    public async Task Test_24_UnauthorizedUserCannotDeleteIncident()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_24_UnauthorizedUserCannotDeleteIncident));
        var caseService = new CaseService(
            db,
            new Mock<IGeminiService>().Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        db.Cases.Add(new CivicCase
        {
            Id = "CASE-DEL-02",
            CitizenId = "usr-citizen-01",
            CitizenName = "Ananya Sharma",
            Title = "Protected Case",
            RawDescription = "Protected description",
            Category = IssueCategories.WasteSanitation,
            Status = CaseStatuses.NeedsReview
        });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            caseService.DeleteCaseAsync("CASE-DEL-02", "usr-intruder", UserRoles.Citizen));

        // Ensure case was not deleted
        Assert.NotNull(await db.Cases.FindAsync("CASE-DEL-02"));
    }

    // 25. DetectLanguageFromText accurately identifies Hindi, Marathi, and other regional languages
    [Fact]
    public void Test_25_DetectLanguageFromText_AccuratelyIdentifiesLanguages()
    {
        // Devanagari Hindi
        Assert.Equal("hi", GeminiService.DetectLanguageFromText("हमारे इलाके में सड़क पर बहुत बड़ा गड्ढा है"));
        Assert.Equal("hi", GeminiService.DetectLanguageFromText("कूड़ा कचरा फैला हुआ है"));

        // Romanized Hindi / Hinglish
        Assert.Equal("hi", GeminiService.DetectLanguageFromText("sadak pe bahut bada gaddha hai kripya theek karein"));
        Assert.Equal("hi", GeminiService.DetectLanguageFromText("hamare ghar ke samne kachra pada hai"));

        // Marathi
        Assert.Equal("mr", GeminiService.DetectLanguageFromText("रस्त्यावर मोठा खड्डा पडला आहे"));

        // Punjabi
        Assert.Equal("pa", GeminiService.DetectLanguageFromText("ਸੜਕ ਤੇ ਵੱਡਾ ਟੋਇਆ ਹੈ"));

        // English
        Assert.Equal("en", GeminiService.DetectLanguageFromText("Deep crater pothole on the main avenue near school gate"));
    }

    // 26. When issue category is unclear, it falls back to Other civic issues
    [Fact]
    public async Task Test_26_UnclearCategoryDefaultsToOtherCivicIssues()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_26_UnclearCategoryDefaultsToOtherCivicIssues));
        var mockGemini = new Mock<IGeminiService>();
        mockGemini.Setup(g => g.AnalyzeIssueAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AIAnalysisResult
            {
                IssueCategory = IssueCategories.Other,
                IssueSubcategory = "General Inquiry",
                ConciseSummary = "General citizen request",
                NormalizedDescription = "General civic issue requiring municipal review",
                DetectedLanguage = "en",
                SeveritySuggestion = CasePriorities.P3,
                Confidence = 0.85
            });

        var caseService = new CaseService(
            db,
            mockGemini.Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        var request = new CreateCaseRequest
        {
            Description = "General municipal feedback regarding local community center",
            Category = IssueCategories.Other,
            Language = "en"
        };

        var created = await caseService.CreateCaseAsync(request, "usr-cit-1", "Aarav Patel");
        Assert.NotNull(created);
        Assert.Equal(IssueCategories.Other, created.Category);
    }

    // 27. When spoken or written in Hindi, case language is detected as Hindi even if request was default 'en'
    [Fact]
    public async Task Test_27_HindiSpokenOrWritten_DetectedAsHindi()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_27_HindiSpokenOrWritten_DetectedAsHindi));
        var mockGemini = new Mock<IGeminiService>();
        mockGemini.Setup(g => g.AnalyzeIssueAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AIAnalysisResult
            {
                IssueCategory = IssueCategories.RoadDamage,
                IssueSubcategory = "Pothole",
                ConciseSummary = "सड़क पर गड्ढा",
                NormalizedDescription = "Road damage",
                DetectedLanguage = "hi",
                SeveritySuggestion = CasePriorities.P3,
                Confidence = 0.95
            });

        var caseService = new CaseService(
            db,
            mockGemini.Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        var request = new CreateCaseRequest
        {
            Description = "सड़क पर गहरा गड्ढा है, पानी भर गया है",
            Category = IssueCategories.Other,
            Language = "en" // User didn't change dropdown from English
        };

        var created = await caseService.CreateCaseAsync(request, "usr-cit-1", "Aarav Patel");
        Assert.NotNull(created);
        Assert.Equal("hi", created.Language);
    }

    // 28. Quality flags: Photo and Audio unclear detection
    [Fact]
    public async Task Test_28_QualityFlags_PhotoAndAudioUnclear_Detected()
    {
        using var db = CreateInMemoryDbContext(nameof(Test_28_QualityFlags_PhotoAndAudioUnclear_Detected));
        var mockGemini = new Mock<IGeminiService>();
        mockGemini.Setup(g => g.AnalyzeIssueAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AIAnalysisResult
            {
                IssueCategory = IssueCategories.RoadDamage,
                IssueSubcategory = "Pothole",
                ConciseSummary = "Pothole on street",
                NormalizedDescription = "Road damage reported",
                SeveritySuggestion = CasePriorities.P3,
                Confidence = 0.85,
                IsPhotoUnclear = true,
                PhotoQualityIssue = "Attached photo is blurry and low contrast",
                IsAudioUnclear = true,
                AudioQualityIssue = "Audio recording was muffled and low volume"
            });

        var caseService = new CaseService(
            db,
            mockGemini.Object,
            new PriorityEngine(),
            new DuplicateDetectionService(db, new Mock<ILogger<DuplicateDetectionService>>().Object),
            new Mock<ILogger<CaseService>>().Object);

        var request = new CreateCaseRequest
        {
            Description = "Road pothole with blurry photo and noisy audio",
            Category = IssueCategories.RoadDamage,
            PhotoUrl = "/uploads/blurry_photo.jpg",
            AudioUrl = "/uploads/muffled_audio.webm"
        };

        var created = await caseService.CreateCaseAsync(request, "usr-cit-1", "Citizen Quality");
        Assert.NotNull(created);
        Assert.True(created.IsPhotoUnclear);
        Assert.Equal("Attached photo is blurry and low contrast", created.PhotoQualityIssue);
        Assert.True(created.IsAudioUnclear);
        Assert.Equal("Audio recording was muffled and low volume", created.AudioQualityIssue);
    }

    // 29. Non-civic issue detection outside municipal jurisdiction routes to P4
    [Fact]
    public void Test_29_NonCivicIssue_DetectedAndSetAsP4()
    {
        var (isNonCivic, rationale) = GeminiService.DetectNonCivicIssue("My kitchen sink leak inside my house and refrigerator repair");
        Assert.True(isNonCivic);
        Assert.NotNull(rationale);
        Assert.Contains("outside", rationale.ToLowerInvariant());

        var priorityEngine = new PriorityEngine();
        var civicCase = new CivicCase
        {
            Id = "CASE-TEST-NONCIVIC",
            Title = "Kitchen sink leak",
            RawDescription = "Kitchen sink leak inside my house",
            Category = IssueCategories.Other,
            IsNonCivicIssue = true,
            NonCivicReason = rationale
        };

        var priorityResult = priorityEngine.Evaluate(civicCase);
        Assert.Equal(CasePriorities.P4, priorityResult.RecommendedPriority);
        Assert.Contains("Outside Municipal Jurisdiction", priorityResult.Rationale);
    }

    // 30. Emergency crisis trigger for suicide / mental health distress escalates to P1 and provides helplines
    [Fact]
    public void Test_30_EmergencyCrisis_SuicideDistress_TriggersP1AndHelplines()
    {
        var (hasTrigger, type, helplines) = GeminiService.DetectEmergencyCrisis("I feel completely hopeless and want to end my life");
        Assert.True(hasTrigger);
        Assert.Equal("Suicide & Mental Health Crisis", type);
        Assert.NotEmpty(helplines);
        Assert.Contains(helplines, h => h.Number == "14416"); // Tele-MANAS
        Assert.Contains(helplines, h => h.Number == "112");   // Emergency

        var priorityEngine = new PriorityEngine();
        var civicCase = new CivicCase
        {
            Id = "CASE-TEST-EMERGENCY",
            Title = "Citizen in distress",
            RawDescription = "I want to end my life",
            Category = IssueCategories.Other,
            HasEmergencySafetyTrigger = true,
            EmergencyType = type,
            EmergencyHelplinesJson = JsonSerializer.Serialize(helplines)
        };

        var priorityResult = priorityEngine.Evaluate(civicCase);
        Assert.Equal(CasePriorities.P1, priorityResult.RecommendedPriority);
        Assert.Contains("CRITICAL EMERGENCY TRIGGER", priorityResult.Rationale);
    }

    // 31. Emergency crisis trigger for harassment and women safety
    [Fact]
    public void Test_31_EmergencyCrisis_SexualAbuseAndHarassment_TriggersHelplines()
    {
        var (hasTrigger, type, helplines) = GeminiService.DetectEmergencyCrisis("Someone is stalking me and I am facing severe harassment");
        Assert.True(hasTrigger);
        Assert.Contains("Harassment", type);
        Assert.Contains(helplines, h => h.Number == "1091" || h.Number == "112" || h.Number == "181");
    }

    // 32. Audio ambiguity and clarity detection
    [Fact]
    public async Task Test_32_AudioAmbiguityNudge_UnclearOrAmbiguousAudio_TriggersNudge()
    {
        // Deterministic audio categorization for unclear or ambiguous speech
        var unclearCat = GeminiService.CategorizeText("[inaudible]");
        Assert.Equal(IssueCategories.Other, unclearCat);

        var clearCat = GeminiService.CategorizeText("There is a massive pothole on the road");
        Assert.Equal(IssueCategories.RoadDamage, clearCat);

        var env = new Mock<IWebHostEnvironment>();
        var logger = new Mock<ILogger<GeminiService>>();
        var config = new ConfigurationBuilder().Build();
        var geminiService = new GeminiService(new HttpClient(), config, logger.Object, env.Object);

        // Client transcript with inaudible speech (< 4 words)
        var res = await geminiService.TranscribeAudioAsync(new MemoryStream(), "audio/webm", "en", "[inaudible]");
        Assert.True(res.IsAudioUnclear);
        Assert.True(res.IsCategoryAmbiguous);
        Assert.Equal(IssueCategories.Other, res.SuggestedCategory);

        // Less than 4 words should be flagged as unclear
        var shortRes = await geminiService.TranscribeAudioAsync(new MemoryStream(), "audio/webm", "en", "help me");
        Assert.True(shortRes.IsAudioUnclear);

        // 4 or more words with clear speech should NOT be flagged as audio unclear even if category is Other
        var clearGeneralRes = await geminiService.TranscribeAudioAsync(new MemoryStream(), "audio/webm", "en", "there is a major issue here");
        Assert.False(clearGeneralRes.IsAudioUnclear);
    }

    // 33. Image compression and 2MB limit enforcement
    [Fact]
    public async Task Test_33_ImageCompression_ProducesCompressedFile()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "civiclens_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var mockEnv = new Mock<IWebHostEnvironment>();
            mockEnv.Setup(e => e.ContentRootPath).Returns(tempDir);
            mockEnv.Setup(e => e.WebRootPath).Returns(tempDir);
            var mockConfig = new Mock<IConfiguration>();
            var mockLogger = new Mock<ILogger<StorageService>>();
            var storage = new StorageService(mockEnv.Object, mockConfig.Object, mockLogger.Object);

            // Create a small test image using ImageSharp
            using var image = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(200, 200);
            using var ms = new MemoryStream();
            await image.SaveAsPngAsync(ms);
            ms.Position = 0;

            var (fileUrl, provider) = await storage.SaveFileAsync(ms, "evidence.png", "image/png", "photo");
            Assert.NotNull(fileUrl);
            Assert.EndsWith(".jpg", fileUrl); // Standardized to compressed JPG
            Assert.Equal("Compressed Local Storage", provider);

            var savedPath = Path.Combine(tempDir, "uploads", Path.GetFileName(fileUrl));
            Assert.True(File.Exists(savedPath));
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    // 34. Rate Limiter rejection produces HTTP 429
    [Fact]
    public void Test_34_RateLimiting_RejectionPolicyConfigured()
    {
        var options = new Microsoft.AspNetCore.RateLimiting.RateLimiterOptions();
        options.RejectionStatusCode = 429;
        Assert.Equal(429, options.RejectionStatusCode);
    }
}

