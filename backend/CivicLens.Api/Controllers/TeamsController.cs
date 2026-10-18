using CivicLens.Api.Data;
using CivicLens.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CivicLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly CivicLensDbContext _dbContext;

    public TeamsController(CivicLensDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<List<ServiceTeam>>> GetTeams()
    {
        var teams = await _dbContext.ServiceTeams.Where(t => t.IsActive).ToListAsync();
        return Ok(teams);
    }
}
