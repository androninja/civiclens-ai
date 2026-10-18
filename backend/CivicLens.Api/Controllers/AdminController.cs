using CivicLens.Api.DTOs;
using CivicLens.Api.Models;
using CivicLens.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CivicLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly ICaseService _caseService;
    private readonly IGeminiService _geminiService;

    public AdminController(ICaseService caseService, IGeminiService geminiService)
    {
        _caseService = caseService;
        _geminiService = geminiService;
    }

    [HttpGet("metrics")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<DashboardMetrics>> GetMetrics()
    {
        var metrics = await _caseService.GetDashboardMetricsAsync();
        return Ok(metrics);
    }

    [HttpGet("status")]
    public ActionResult<object> GetSystemStatus()
    {
        return Ok(new
        {
            service = "CivicLens AI API",
            status = "Healthy",
            timestamp = DateTime.UtcNow,
            ai = new
            {
                isGeminiConfigured = _geminiService.IsConfigured,
                activeProvider = _geminiService.ProviderName
            }
        });
    }

    [HttpPost("set-api-key")]
    [Authorize]
    public ActionResult<object> SetApiKey([FromBody] SetApiKeyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.ApiKey))
        {
            return BadRequest(new { message = "API key cannot be empty." });
        }
        _geminiService.SetApiKey(request.ApiKey.Trim());
        return Ok(new
        {
            message = "Gemini API key configured successfully.",
            isGeminiConfigured = _geminiService.IsConfigured,
            provider = _geminiService.ProviderName
        });
    }

    [HttpPost("reset-demo")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<ActionResult<object>> ResetDemoData()
    {
        await _caseService.ResetDemoDataAsync();
        return Ok(new { message = "Demo data reset successfully to initial synthetic state." });
    }
}
