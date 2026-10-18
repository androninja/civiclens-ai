using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CivicLens.Api.Data;
using CivicLens.Api.DTOs;
using CivicLens.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CivicLens.Api.Services;

public interface IAuthService
{
    Task<AuthResponse> AuthenticateAsync(LoginRequest request);
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task SeedDefaultUsersAsync();
    string GenerateJwtToken(User user);
}

public class AuthService : IAuthService
{
    private readonly CivicLensDbContext _dbContext;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(CivicLensDbContext dbContext, IConfiguration config, ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _config = config;
        _logger = logger;
    }

    public async Task<AuthResponse> AuthenticateAsync(LoginRequest request)
    {
        var normalizedInput = request.UsernameOrEmail.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == normalizedInput || u.Email.ToLower() == normalizedInput);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid credentials.");
        }

        var token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Token = token,
            UserId = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            Email = user.Email
        };
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var existing = await _dbContext.Users.AnyAsync(u =>
            u.Username.ToLower() == request.Username.ToLower() || u.Email.ToLower() == request.Email.ToLower());

        if (existing)
        {
            throw new InvalidOperationException("A user with this username or email already exists.");
        }

        // Citizens can only self-register as Citizen
        var role = request.Role == UserRoles.Reviewer || request.Role == UserRoles.Admin 
            ? UserRoles.Citizen 
            : request.Role;

        var user = new User
        {
            Username = request.Username.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            FullName = request.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = role,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        var token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Token = token,
            UserId = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            Email = user.Email
        };
    }

    public string GenerateJwtToken(User user)
    {
        var keyString = _config["Jwt:Key"] ?? "CivicLens_AI_Master_Secret_Key_For_Hackathon_2026_Signing_Key_12345";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("FullName", user.FullName)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "CivicLensApi",
            audience: _config["Jwt:Audience"] ?? "CivicLensClient",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task SeedDefaultUsersAsync()
    {
        if (await _dbContext.Users.AnyAsync()) return;

        var users = new List<User>
        {
            new()
            {
                Id = "usr-citizen-01",
                Username = "citizen",
                Email = "citizen@civiclens.local",
                FullName = "Ananya Sharma (Citizen)",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Citizen123!"),
                Role = UserRoles.Citizen
            },
            new()
            {
                Id = "usr-reviewer-01",
                Username = "reviewer",
                Email = "reviewer@civiclens.local",
                FullName = "Vikram Patel (Municipal Reviewer)",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Reviewer123!"),
                Role = UserRoles.Reviewer
            },
            new()
            {
                Id = "usr-admin-01",
                Username = "admin",
                Email = "admin@civiclens.local",
                FullName = "Civic Operations Admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Role = UserRoles.Admin
            }
        };

        _dbContext.Users.AddRange(users);
        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Seeded default users for Citizen, Reviewer, and Admin roles.");
    }
}
