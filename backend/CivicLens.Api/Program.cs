using System.Text;
using System.Threading.RateLimiting;
using CivicLens.Api.Data;
using CivicLens.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CivicLens AI API — From Community Signal to Accountable Action",
        Version = "v1",
        Description = "Backend API for CivicLens AI hackathon platform with multimodal AI, duplicate detection, and transparent priority routing."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Database configuration: Default to SQLite for zero-config run, or Postgres if configured
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var postgresConn = builder.Configuration.GetConnectionString("PostgresConnection");
var usePostgres = builder.Configuration.GetValue<bool>("UsePostgres");

builder.Services.AddDbContext<CivicLensDbContext>(options =>
{
    if (usePostgres && !string.IsNullOrWhiteSpace(postgresConn))
    {
        options.UseNpgsql(postgresConn);
    }
    else
    {
        options.UseSqlite(connectionString ?? "Data Source=civiclens.db");
    }
});

// Register HTTP Client for Gemini Service
builder.Services.AddHttpClient<IGeminiService, GeminiService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Register Domain & Infrastructure Services
builder.Services.AddScoped<IStorageService, StorageService>();
builder.Services.AddScoped<IPriorityEngine, PriorityEngine>();
builder.Services.AddScoped<IDuplicateDetectionService, DuplicateDetectionService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICaseService, CaseService>();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("CivicLensCorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Rate Limiting Configuration: Return 429 Too Many Requests with descriptive message
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"Too many requests. Please slow down and try again later.\",\"statusCode\":429}",
            cancellationToken: token);
    };

    // Global limiter per IP: allows up to 120 requests per minute
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "default_client";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: clientIp,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });

    // Dedicated test rate limiter allowing only 2 requests per 10 seconds
    options.AddFixedWindowLimiter("TestRateLimiter", opt =>
    {
        opt.PermitLimit = 2;
        opt.Window = TimeSpan.FromSeconds(10);
        opt.QueueLimit = 0;
    });
});

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "CivicLens_AI_Master_Secret_Key_For_Hackathon_2026_Signing_Key_12345";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Migrate/Create Database & Seed Initial Demo Data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CivicLensDbContext>();
    db.Database.EnsureCreated();

    var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();
    await auth.SeedDefaultUsersAsync();

    var cases = scope.ServiceProvider.GetRequiredService<ICaseService>();
    await cases.SeedDemoDataAsync();
}

// Configure Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "CivicLens AI API v1");
    c.RoutePrefix = "swagger";
});

// Configure Static Files for Uploads (Local fallback)
var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var uploadsDir = Path.Combine(webRoot, "uploads");
Directory.CreateDirectory(uploadsDir);

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads"
});

app.UseCors("CivicLensCorsPolicy");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Dedicated endpoint to verify rate limiting behavior
app.MapGet("/api/admin/ratelimit-test", () => Results.Ok(new { message = "Request passed rate limiter", statusCode = 200 }))
   .RequireRateLimiting("TestRateLimiter");

// SPA fallback or root API status
if (File.Exists(Path.Combine(webRoot, "index.html")))
{
    app.MapFallbackToFile("index.html");
}
else
{
    app.MapGet("/", () => Results.Ok(new
    {
        app = "CivicLens AI — From Community Signal to Accountable Action",
        status = "Active",
        docs = "/swagger",
        health = "/api/admin/status",
        timestamp = DateTime.UtcNow
    }));
}

app.Run();

// Make Program class accessible for WebApplicationFactory in integration tests
public partial class Program { }
