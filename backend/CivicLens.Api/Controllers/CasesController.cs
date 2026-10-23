using System.Security.Claims;
using CivicLens.Api.DTOs;
using CivicLens.Api.Models;
using CivicLens.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CivicLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CasesController : ControllerBase
{
    private readonly ICaseService _caseService;

    public CasesController(ICaseService caseService)
    {
        _caseService = caseService;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? "anonymous";
    private string CurrentUserName => User.FindFirstValue("FullName") ?? User.FindFirstValue(ClaimTypes.Name) ?? "Guest Citizen";
    private string CurrentUserRole => User.FindFirstValue(ClaimTypes.Role) ?? UserRoles.Citizen;

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<List<CivicCase>>> GetCases(
        [FromQuery] string? category,
        [FromQuery] string? priority,
        [FromQuery] string? status,
        [FromQuery] string? assignedTeamId,
        [FromQuery] string? search)
    {
        // If citizen role, force filter to their own cases
        string? citizenFilter = CurrentUserRole == UserRoles.Citizen ? CurrentUserId : null;

        var cases = await _caseService.GetCasesAsync(category, priority, status, assignedTeamId, citizenFilter, search);
        return Ok(cases);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<CivicCase>> GetCaseById(string id)
    {
        try
        {
            var civicCase = await _caseService.GetCaseByIdAsync(id, CurrentUserId, CurrentUserRole);
            if (civicCase == null) return NotFound(new { message = $"Case '{id}' not found." });
            return Ok(civicCase);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<CivicCase>> CreateCase([FromBody] CreateCaseRequest request)
    {
        try
        {
            var created = await _caseService.CreateCaseAsync(request, CurrentUserId, CurrentUserName);
            return CreatedAtAction(nameof(GetCaseById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/location")]
    [Authorize]
    public async Task<ActionResult<CivicCase>> UpdateLocation(string id, [FromBody] UpdateLocationRequest request)
    {
        try
        {
            var updated = await _caseService.UpdateLocationAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<CivicCase>> UpdateCase(string id, [FromBody] UpdateCaseRequest request)
    {
        try
        {
            var updated = await _caseService.UpdateCaseAsync(id, request, CurrentUserId, CurrentUserRole, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult> DeleteCase(string id)
    {
        try
        {
            await _caseService.DeleteCaseAsync(id, CurrentUserId, CurrentUserRole);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpPost("{id}/assign")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> AssignTeam(string id, [FromBody] AssignTeamRequest request)
    {
        try
        {
            var updated = await _caseService.AssignTeamAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/status")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> UpdateStatus(string id, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var updated = await _caseService.UpdateStatusAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/priority-override")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> OverridePriority(string id, [FromBody] PriorityOverrideRequest request)
    {
        try
        {
            var updated = await _caseService.OverridePriorityAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/resolution")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> SubmitResolution(string id, [FromBody] SubmitResolutionRequest request)
    {
        try
        {
            var updated = await _caseService.SubmitResolutionAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/verify-resolution")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> VerifyResolution(string id, [FromBody] VerifyResolutionRequest request)
    {
        try
        {
            var updated = await _caseService.VerifyResolutionAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/dispute")]
    [Authorize]
    public async Task<ActionResult<CivicCase>> RequestCitizenReview(string id, [FromBody] CitizenReviewRequest request)
    {
        try
        {
            var updated = await _caseService.RequestCitizenReviewAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("{id}/reopen")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> ReopenCase(string id, [FromBody] CitizenReviewRequest request)
    {
        try
        {
            var updated = await _caseService.ReopenCaseAsync(id, request.Reason, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/review-duplicate")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<CivicCase>> ReviewDuplicate(string id, [FromBody] DuplicateReviewRequest request)
    {
        try
        {
            var updated = await _caseService.ReviewDuplicateAsync(id, request, CurrentUserId, CurrentUserName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("{id}/activity")]
    [Authorize]
    public async Task<ActionResult<List<CaseActivityLog>>> GetActivityLogs(string id)
    {
        var logs = await _caseService.GetActivityLogsAsync(id);
        return Ok(logs);
    }

    [HttpGet("{id}/duplicates")]
    [Authorize(Roles = $"{UserRoles.Reviewer},{UserRoles.Admin}")]
    public async Task<ActionResult<List<DuplicateRelation>>> GetDuplicates(string id)
    {
        var dups = await _caseService.GetDuplicatesAsync(id);
        return Ok(dups);
    }

    [HttpGet("notifications")]
    [Authorize]
    public async Task<ActionResult<List<UserNotification>>> GetNotifications()
    {
        var notifs = await _caseService.GetUserNotificationsAsync(CurrentUserId);
        return Ok(notifs);
    }
}
