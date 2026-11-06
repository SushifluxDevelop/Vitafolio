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

    public DbSet<UserProfile> Profiles => Set<UserProfile>();

    public DbSet<Experience> Experiences => Set<Experience>();

    public DbSet<Education> Educations => Set<Education>();

    public DbSet<Skill> Skills => Set<Skill>();

    public DbSet<LanguageSkill> Languages => Set<LanguageSkill>();

    public DbSet<Certificate> Certificates => Set<Certificate>();

    public DbSet<Interest> Interests => Set<Interest>();

    public DbSet<CustomSection> CustomSections => Set<CustomSection>();

    public DbSet<CustomSectionItem> CustomSectionItems => Set<CustomSectionItem>();

    public DbSet<CoverLetter> CoverLetters => Set<CoverLetter>();

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
            e.HasOne(x => x.Profile).WithOne(x => x.User).HasForeignKey<UserProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
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

        model.Entity<UserProfile>(e =>
        {
            e.ToTable("profiles");
            e.HasKey(x => x.Id);
            e.Property(x => x.FirstName).HasMaxLength(64).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(64).IsRequired();
            e.Property(x => x.AcademicTitle).HasMaxLength(32);
            e.Property(x => x.ProfessionalTitle).HasMaxLength(128);
            e.Property(x => x.Email).HasMaxLength(128);
            e.Property(x => x.Phone).HasMaxLength(64);
            e.Property(x => x.Street).HasMaxLength(128);
            e.Property(x => x.PostalCode).HasMaxLength(32);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.Country).HasMaxLength(64);
            e.Property(x => x.DateOfBirth).HasMaxLength(32);
            e.Property(x => x.PlaceOfBirth).HasMaxLength(128);
            e.Property(x => x.Nationality).HasMaxLength(64);
            e.Property(x => x.MaritalStatus).HasMaxLength(64);
            e.Property(x => x.Website).HasMaxLength(256);
            e.Property(x => x.LinkedIn).HasMaxLength(256);
            e.Property(x => x.GitHub).HasMaxLength(256);
            e.Property(x => x.Xing).HasMaxLength(256);
            e.Property(x => x.Bio).HasMaxLength(4096);
            e.Property(x => x.PhotoPath).HasMaxLength(256);
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasMany(x => x.Experiences).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Educations).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Skills).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Languages).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Certificates).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Interests).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.CustomSections).WithOne(x => x.Profile).HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Experience>(e =>
        {
            e.ToTable("profile_experiences");
            e.HasKey(x => x.Id);
            e.Property(x => x.JobTitle).HasMaxLength(128).IsRequired();
            e.Property(x => x.Employer).HasMaxLength(128).IsRequired();
            e.Property(x => x.EmploymentType).HasMaxLength(64);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.Country).HasMaxLength(64);
            e.Property(x => x.StartDate).HasMaxLength(32).IsRequired();
            e.Property(x => x.EndDate).HasMaxLength(32);
            e.Property(x => x.Description).HasMaxLength(4096);
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<Education>(e =>
        {
            e.ToTable("profile_educations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Degree).HasMaxLength(128).IsRequired();
            e.Property(x => x.FieldOfStudy).HasMaxLength(128);
            e.Property(x => x.Institution).HasMaxLength(128).IsRequired();
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.Country).HasMaxLength(64);
            e.Property(x => x.StartDate).HasMaxLength(32).IsRequired();
            e.Property(x => x.EndDate).HasMaxLength(32);
            e.Property(x => x.Grade).HasMaxLength(32);
            e.Property(x => x.Description).HasMaxLength(4096);
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<Skill>(e =>
        {
            e.ToTable("profile_skills");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(128).IsRequired();
            e.Property(x => x.Category).HasMaxLength(64);
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<LanguageSkill>(e =>
        {
            e.ToTable("profile_languages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Language).HasMaxLength(64).IsRequired();
            e.Property(x => x.Level).HasMaxLength(32).IsRequired();
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<Certificate>(e =>
        {
            e.ToTable("profile_certificates");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(128).IsRequired();
            e.Property(x => x.Issuer).HasMaxLength(128);
            e.Property(x => x.IssueDate).HasMaxLength(32);
            e.Property(x => x.ExpiryDate).HasMaxLength(32);
            e.Property(x => x.CredentialUrl).HasMaxLength(256);
            e.Property(x => x.CredentialId).HasMaxLength(128);
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<Interest>(e =>
        {
            e.ToTable("profile_interests");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(128).IsRequired();
            e.Property(x => x.Category).HasMaxLength(64);
            e.Property(x => x.Description).HasMaxLength(1024);
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
        });

        model.Entity<CustomSection>(e =>
        {
            e.ToTable("profile_custom_sections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(128).IsRequired();
            e.HasIndex(x => x.ProfileId);
            e.HasIndex(x => new { x.ProfileId, x.SortOrder });
            e.HasMany(x => x.Items).WithOne(x => x.Section).HasForeignKey(x => x.SectionId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<CustomSectionItem>(e =>
        {
            e.ToTable("profile_custom_section_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(128).IsRequired();
            e.Property(x => x.Subtitle).HasMaxLength(128);
            e.Property(x => x.DateRange).HasMaxLength(64);
            e.Property(x => x.Description).HasMaxLength(4096);
            e.HasIndex(x => x.SectionId);
            e.HasIndex(x => new { x.SectionId, x.SortOrder });
        });

        model.Entity<CoverLetter>(e =>
        {
            e.ToTable("cover_letters");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(128).IsRequired();
            e.Property(x => x.SenderName).HasMaxLength(128);
            e.Property(x => x.SenderStreet).HasMaxLength(128);
            e.Property(x => x.SenderPostalCode).HasMaxLength(32);
            e.Property(x => x.SenderCity).HasMaxLength(128);
            e.Property(x => x.SenderPhone).HasMaxLength(64);
            e.Property(x => x.SenderEmail).HasMaxLength(256);
            e.Property(x => x.RecipientCompany).HasMaxLength(128).IsRequired();
            e.Property(x => x.RecipientDepartment).HasMaxLength(128);
            e.Property(x => x.RecipientContactPerson).HasMaxLength(128);
            e.Property(x => x.RecipientStreet).HasMaxLength(128);
            e.Property(x => x.RecipientPostalCode).HasMaxLength(32);
            e.Property(x => x.RecipientCity).HasMaxLength(128).IsRequired();
            e.Property(x => x.RecipientCountry).HasMaxLength(64);
            e.Property(x => x.Place).HasMaxLength(128);
            e.Property(x => x.Date).HasMaxLength(64);
            e.Property(x => x.Subject).HasMaxLength(256).IsRequired();
            e.Property(x => x.Salutation).HasMaxLength(128).IsRequired();
            e.Property(x => x.Body).IsRequired();
            e.Property(x => x.Closing).HasMaxLength(128).IsRequired();
            e.Property(x => x.SignatureName).HasMaxLength(128);
            e.Property(x => x.SignaturePath).HasMaxLength(256);
            e.Property(x => x.AttachmentsNote).HasMaxLength(128);
            e.Property(x => x.Language).HasMaxLength(8).IsRequired();
            e.Property(x => x.Font).HasMaxLength(64);
            e.Property(x => x.AccentColor).HasMaxLength(16);

            e.HasOne(x => x.User)
                .WithMany(u => u.CoverLetters)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => new { x.UserId, x.UpdatedAt });
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
