using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace CivicLens.Api.Services;

public interface IStorageService
{
    Task<(string fileUrl, string storageProvider)> SaveFileAsync(Stream stream, string originalFileName, string contentType, string category = "media");
    bool IsAllowedFileType(string contentType, string extension);
    long MaxFileSizeBytes { get; }
    long MaxImageFileSizeBytes { get; }
}

public class StorageService : IStorageService
{
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;
    private readonly ILogger<StorageService> _logger;

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/webm",
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "audio/mp4",
        "audio/m4a",
        "video/webm",
        "video/mp4",
        "video/quicktime"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
        ".webm", ".wav", ".mp3", ".ogg", ".m4a",
        ".mp4", ".mov"
    };

    public long MaxFileSizeBytes => 2 * 1024 * 1024; // 2 MB
    public long MaxImageFileSizeBytes => 2 * 1024 * 1024; // 2 MB image size restriction

    public StorageService(IWebHostEnvironment env, IConfiguration config, ILogger<StorageService> logger)
    {
        _env = env;
        _config = config;
        _logger = logger;
    }

    public bool IsAllowedFileType(string contentType, string extension)
    {
        var validMime = AllowedMimeTypes.Contains(contentType.Split(';')[0].Trim());
        var validExt = AllowedExtensions.Contains(extension.ToLowerInvariant());
        return validMime || validExt;
    }

    public async Task<(string fileUrl, string storageProvider)> SaveFileAsync(
        Stream stream, string originalFileName, string contentType, string category = "media")
    {
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext))
        {
            ext = contentType.Contains("audio") ? ".webm" : ".jpg";
        }

        if (!IsAllowedFileType(contentType, ext))
        {
            throw new InvalidOperationException($"File type '{contentType}' or extension '{ext}' is not supported.");
        }

        var isImage = ext is ".jpg" or ".jpeg" or ".png" or ".webp";
        if (isImage && stream.CanSeek && stream.Length > MaxImageFileSizeBytes)
        {
            throw new InvalidOperationException($"Image size exceeds the maximum allowed limit of 2 MB ({MaxImageFileSizeBytes / (1024 * 1024)} MB).");
        }

        var uniqueFileName = $"{category}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{ext}";

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads");
        Directory.CreateDirectory(uploadsDir);

        // If it's an image, compress before saving to optimize storage and bandwidth
        if (isImage)
        {
            uniqueFileName = $"{category}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}.jpg";
            var compressedPath = Path.Combine(uploadsDir, uniqueFileName);
            try
            {
                if (stream.CanSeek) stream.Position = 0;
                using var image = await Image.LoadAsync(stream);
                if (image.Width > 1600 || image.Height > 1600)
                {
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(1600, 1600),
                        Mode = ResizeMode.Max
                    }));
                }
                await image.SaveAsJpegAsync(compressedPath, new JpegEncoder { Quality = 75 });
                return ($"/uploads/{uniqueFileName}", "Compressed Local Storage");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ImageSharp compression fallback, copying raw stream.");
                if (stream.CanSeek) stream.Position = 0;
            }
        }

        var filePath = Path.Combine(uploadsDir, uniqueFileName);
        using (var outputStream = File.Create(filePath))
        {
            await stream.CopyToAsync(outputStream);
        }

        var relativeUrl = $"/uploads/{uniqueFileName}";
        return (relativeUrl, "Local Development Storage Fallback (Demo Mode)");
    }
}
