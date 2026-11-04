using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Cv.Server.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<RecoveryCode> RecoveryCodes => Set<RecoveryCode>();

    public DbSet<Session> Sessions => Set<Session>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    public DbSet<ActivityEntry> ActivityLog => Set<ActivityEntry>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Username).HasMaxLength(64).IsRequired();
            e.Property(x => x.NormalizedUsername).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.NormalizedUsername).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
            e.Property(x => x.Role).HasMaxLength(16).IsRequired();
            e.Property(x => x.PasswordHash).IsRequired();
            e.Property(x => x.Language).HasMaxLength(8);
            e.Property(x => x.Theme).HasMaxLength(16).IsRequired();
            e.HasMany(x => x.RecoveryCodes).WithOne(x => x.User).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Sessions).WithOne(x => x.User).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<RecoveryCode>(e =>
        {
            e.ToTable("recovery_codes");
            e.HasKey(x => x.Id);
            e.Property(x => x.CodeHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => new { x.UserId, x.CodeHash }).IsUnique();
        });

        model.Entity<Session>(e =>
        {
            e.ToTable("sessions");
            e.HasKey(x => x.Id);
            e.Property(x => x.RevokedReason).HasMaxLength(32);
            e.Property(x => x.Ip).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(256);
            e.HasIndex(x => x.UserId);
            e.HasMany(x => x.RefreshTokens).WithOne(x => x.Session).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.SessionId);
        });

        model.Entity<AppSetting>(e =>
        {
            e.ToTable("app_settings");
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(64);
            e.Property(x => x.Value).IsRequired();
        });

        model.Entity<ActivityEntry>(e =>
        {
            e.ToTable("activity_log");
            e.HasKey(x => x.Id);
            e.Property(x => x.Action).HasMaxLength(64).IsRequired();
            e.Property(x => x.ActorName).HasMaxLength(64);
            e.Property(x => x.Target).HasMaxLength(256);
            e.Property(x => x.Ip).HasMaxLength(64);
            e.HasIndex(x => x.At);
            e.HasIndex(x => x.Action);
            e.HasIndex(x => x.ActorId);
        });

        // SQLite has no date type: values are stored as ISO text (sorts correctly) and always read back as UTC
        var utc = new ValueConverter<DateTime, DateTime>(v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(), v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullable = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime()) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
        foreach (var entity in model.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType == typeof(DateTime)) property.SetValueConverter(utc);
                else if (property.ClrType == typeof(DateTime?)) property.SetValueConverter(utcNullable);
            }
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        GuardActivityLog();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        GuardActivityLog();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>The activity log is append-only (also enforced by database triggers, see the initial migration).</summary>
    private void GuardActivityLog()
    {
        foreach (var entry in ChangeTracker.Entries<ActivityEntry>())
        {
            if (entry.State is EntityState.Modified or EntityState.Deleted)
            {
                throw new InvalidOperationException("The activity log is append-only.");
            }
        }
    }
}

/// <summary>Used only by the EF Core tools (dotnet ef migrations add ...); the running server configures the context in ServerApp.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=design-time.db").Options);
}
