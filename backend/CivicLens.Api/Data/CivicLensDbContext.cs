using CivicLens.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CivicLens.Api.Data;

public class CivicLensDbContext : DbContext
{
    public CivicLensDbContext(DbContextOptions<CivicLensDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<CivicCase> Cases => Set<CivicCase>();
    public DbSet<DuplicateRelation> DuplicateRelations => Set<DuplicateRelation>();
    public DbSet<ServiceTeam> ServiceTeams => Set<ServiceTeam>();
    public DbSet<CaseActivityLog> CaseActivityLogs => Set<CaseActivityLog>();
    public DbSet<UserNotification> Notifications => Set<UserNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<CivicCase>(entity =>
        {
            entity.HasIndex(c => c.CitizenId);
            entity.HasIndex(c => c.Status);
            entity.HasIndex(c => c.Category);
            entity.HasIndex(c => c.Priority);
            entity.HasIndex(c => c.CreatedAt);
        });

        modelBuilder.Entity<DuplicateRelation>(entity =>
        {
            entity.HasIndex(d => d.CaseId);
            entity.HasIndex(d => d.PotentialDuplicateCaseId);
        });

        modelBuilder.Entity<CaseActivityLog>(entity =>
        {
            entity.HasIndex(l => l.CaseId);
        });

        modelBuilder.Entity<UserNotification>(entity =>
        {
            entity.HasIndex(n => n.UserId);
        });
    }
}
