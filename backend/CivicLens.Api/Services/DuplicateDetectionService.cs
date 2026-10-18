using CivicLens.Api.Data;
using CivicLens.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CivicLens.Api.Services;

public record DuplicateCandidate(
    CivicCase ExistingCase,
    double SimilarityScore,
    double? DistanceMeters,
    string Explanation,
    bool LocationMissing);

public interface IDuplicateDetectionService
{
    Task<List<DuplicateCandidate>> FindPotentialDuplicatesAsync(
        CivicCase newCase,
        double scoreThreshold = 0.60,
        CancellationToken cancellationToken = default);

    double CalculateDistanceMeters(double lat1, double lon1, double lat2, double lon2);
}

public class DuplicateDetectionService : IDuplicateDetectionService
{
    private readonly CivicLensDbContext _dbContext;
    private readonly ILogger<DuplicateDetectionService> _logger;

    public DuplicateDetectionService(CivicLensDbContext dbContext, ILogger<DuplicateDetectionService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<DuplicateCandidate>> FindPotentialDuplicatesAsync(
        CivicCase newCase,
        double scoreThreshold = 0.60,
        CancellationToken cancellationToken = default)
    {
        // Query recent cases (within 60 days) that are not rejected
        var cutoff = DateTime.UtcNow.AddDays(-60);
        var candidates = await _dbContext.Cases
            .Where(c => c.Id != newCase.Id && c.CreatedAt >= cutoff && c.Status != CaseStatuses.Rejected)
            .OrderByDescending(c => c.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var results = new List<DuplicateCandidate>();

        foreach (var existing in candidates)
        {
            var (score, distance, explanation, locMissing) = EvaluatePair(newCase, existing);
            if (score >= scoreThreshold)
            {
                results.Add(new DuplicateCandidate(existing, score, distance, explanation, locMissing));
            }
        }

        return results.OrderByDescending(r => r.SimilarityScore).ToList();
    }

    public (double score, double? distanceMeters, string explanation, bool locationMissing) EvaluatePair(CivicCase a, CivicCase b)
    {
        double? distance = null;
        bool locMissing = false;
        double distanceScore = 0.0;

        if (a.Latitude.HasValue && a.Longitude.HasValue && b.Latitude.HasValue && b.Longitude.HasValue)
        {
            distance = CalculateDistanceMeters(a.Latitude.Value, a.Longitude.Value, b.Latitude.Value, b.Longitude.Value);
            if (distance.Value <= 100) distanceScore = 1.0;
            else if (distance.Value <= 300) distanceScore = 0.8;
            else if (distance.Value <= 750) distanceScore = 0.5;
            else if (distance.Value <= 1500) distanceScore = 0.2;
            else distanceScore = 0.0;
        }
        else
        {
            locMissing = true;
        }

        // Category match
        double categoryScore = string.Equals(a.Category, b.Category, StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;

        // Text similarity (Jaccard similarity on significant tokens)
        var textA = $"{a.Title} {a.RawDescription} {a.EditedTranscript}";
        var textB = $"{b.Title} {b.RawDescription} {b.EditedTranscript}";
        double textScore = ComputeTextSimilarity(textA, textB);

        // Time proximity (within 30 days is standard)
        var timeSpan = (a.CreatedAt - b.CreatedAt).Duration();
        double timeScore = timeSpan.TotalDays switch
        {
            <= 3 => 1.0,
            <= 10 => 0.8,
            <= 30 => 0.6,
            _ => 0.3
        };

        double totalScore;
        string explanation;

        if (!locMissing)
        {
            totalScore = (0.45 * distanceScore) + (0.25 * textScore) + (0.20 * categoryScore) + (0.10 * timeScore);
            explanation = $"Geographic proximity ({distance:F0}m apart), matching category '{a.Category}', text token similarity ({textScore * 100:F0}%), reported within {timeSpan.TotalDays:F1} days.";
        }
        else
        {
            // Location missing: higher weight on text and category, with explicit lower confidence disclaimer
            totalScore = (0.55 * textScore) + (0.30 * categoryScore) + (0.15 * timeScore);
            explanation = $"[Reduced Confidence: Missing geographic coordinates]. Text semantic overlap ({textScore * 100:F0}%), matching category '{a.Category}', reported within {timeSpan.TotalDays:F1} days.";
        }

        return (Math.Round(totalScore, 2), distance, explanation, locMissing);
    }

    public double CalculateDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double r = 6371000; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return r * c;
    }

    private static double ComputeTextSimilarity(string text1, string text2)
    {
        var tokens1 = Tokenize(text1);
        var tokens2 = Tokenize(text2);

        if (tokens1.Count == 0 || tokens2.Count == 0) return 0.0;

        var intersection = tokens1.Intersect(tokens2).Count();
        var union = tokens1.Union(tokens2).Count();

        return union == 0 ? 0.0 : (double)intersection / union;
    }

    private static HashSet<string> Tokenize(string text)
    {
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "the", "a", "an", "is", "are", "was", "were", "and", "or", "in", "on", "at", "to", "for", "with",
            "this", "that", "it", "of", "my", "our", "there", "has", "have", "been", "please", "help", "fix",
            "near", "front", "road", "street"
        };

        var words = text.ToLowerInvariant()
            .Split(new[] { ' ', ',', '.', ';', ':', '!', '?', '\n', '\r', '\t', '-', '(', ')' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 2 && !stopWords.Contains(w));

        return new HashSet<string>(words, StringComparer.OrdinalIgnoreCase);
    }
}
