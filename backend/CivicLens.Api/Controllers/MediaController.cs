using CivicLens.Api.DTOs;
using CivicLens.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CivicLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly IStorageService _storageService;
    private readonly IGeminiService _geminiService;
    private readonly ILogger<MediaController> _logger;

    public MediaController(
        IStorageService storageService,
        IGeminiService geminiService,
        ILogger<MediaController> logger)
    {
        _storageService = storageService;
        _geminiService = geminiService;
        _logger = logger;
    }

    [HttpPost("upload-photo")]
    [Authorize]
    [RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<ActionResult<object>> UploadPhoto([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No image file provided." });
        }

        if (file.Length > _storageService.MaxImageFileSizeBytes)
        {
            return BadRequest(new { message = $"Image exceeds the maximum allowed size of 2 MB." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_storageService.IsAllowedFileType(file.ContentType, ext))
        {
            return BadRequest(new { message = $"Unsupported media format '{file.ContentType}'. Allowed: JPEG, PNG, WebP, MP4, WebM." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var (fileUrl, provider) = await _storageService.SaveFileAsync(stream, file.FileName, file.ContentType, "photo");

            return Ok(new
            {
                url = fileUrl,
                storageProvider = provider,
                fileName = file.FileName,
                fileSizeBytes = file.Length,
                contentType = file.ContentType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload photo");
            return StatusCode(500, new { message = "Failed to upload photo: " + ex.Message });
        }
    }

    [HttpPost("transcribe-voice")]
    [Authorize]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<ActionResult<object>> TranscribeVoice(
        [FromForm] IFormFile audio,
        [FromForm] string? language = "en",
        [FromForm] string? clientTranscript = null)
    {
        if (audio == null || audio.Length == 0)
        {
            return BadRequest(new { message = "No audio recording provided." });
        }

        try
        {
            // 1. Save audio file persistently
            string audioUrl;
            string storageProvider;
            using (var uploadStream = audio.OpenReadStream())
            {
                (audioUrl, storageProvider) = await _storageService.SaveFileAsync(uploadStream, audio.FileName, audio.ContentType, "voice");
            }

            // 2. Transcribe using Gemini / Speech workflow
            using var transcribeStream = audio.OpenReadStream();
            var transcription = await _geminiService.TranscribeAudioAsync(
                transcribeStream,
                audio.ContentType,
                language ?? "en",
                clientTranscript);

            return Ok(new
            {
                transcript = transcription.Transcript,
                detectedLanguage = transcription.DetectedLanguage,
                confidence = transcription.Confidence,
                provider = transcription.Provider,
                isAudioUnclear = transcription.IsAudioUnclear,
                audioQualityIssue = transcription.AudioQualityIssue,
                isCategoryAmbiguous = transcription.IsCategoryAmbiguous,
                suggestedCategory = transcription.SuggestedCategory,
                hasEmergencyTrigger = transcription.HasEmergencyTrigger,
                emergencyType = transcription.EmergencyType,
                emergencyHelplines = transcription.EmergencyHelplines,
                audioUrl = audioUrl,
                storageProvider = storageProvider
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Voice transcription failed");
            return StatusCode(500, new { message = "Voice transcription failed: " + ex.Message });
        }
    }
}
