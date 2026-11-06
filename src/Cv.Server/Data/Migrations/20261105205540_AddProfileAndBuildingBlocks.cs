using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cv.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileAndBuildingBlocks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FirstName = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LastName = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    AcademicTitle = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    ProfessionalTitle = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Email = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Phone = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Street = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    PostalCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    City = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Country = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    DateOfBirth = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    PlaceOfBirth = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Nationality = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    MaritalStatus = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Website = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    LinkedIn = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    GitHub = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Xing = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Bio = table.Column<string>(type: "TEXT", maxLength: 4096, nullable: true),
                    PhotoPath = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profiles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Issuer = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    IssueDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    ExpiryDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    CredentialUrl = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    CredentialId = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_certificates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_certificates_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_custom_sections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_custom_sections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_custom_sections_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_educations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Degree = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    FieldOfStudy = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Institution = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    City = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Country = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    StartDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    EndDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    IsCurrent = table.Column<bool>(type: "INTEGER", nullable: false),
                    Grade = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 4096, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_educations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_educations_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_experiences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    JobTitle = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Employer = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    EmploymentType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    City = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Country = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    StartDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    EndDate = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    IsCurrent = table.Column<bool>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 4096, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_experiences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_experiences_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_interests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_interests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_interests_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_languages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Language = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Level = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_languages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_languages_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_skills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProfileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_skills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_skills_profiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_custom_section_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SectionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Subtitle = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    DateRange = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 4096, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_custom_section_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_profile_custom_section_items_profile_custom_sections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "profile_custom_sections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_profile_certificates_ProfileId",
                table: "profile_certificates",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_certificates_ProfileId_SortOrder",
                table: "profile_certificates",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_custom_section_items_SectionId",
                table: "profile_custom_section_items",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_custom_section_items_SectionId_SortOrder",
                table: "profile_custom_section_items",
                columns: new[] { "SectionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_custom_sections_ProfileId",
                table: "profile_custom_sections",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_custom_sections_ProfileId_SortOrder",
                table: "profile_custom_sections",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_educations_ProfileId",
                table: "profile_educations",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_educations_ProfileId_SortOrder",
                table: "profile_educations",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_experiences_ProfileId",
                table: "profile_experiences",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_experiences_ProfileId_SortOrder",
                table: "profile_experiences",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_interests_ProfileId",
                table: "profile_interests",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_interests_ProfileId_SortOrder",
                table: "profile_interests",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_languages_ProfileId",
                table: "profile_languages",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_languages_ProfileId_SortOrder",
                table: "profile_languages",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profile_skills_ProfileId",
                table: "profile_skills",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_profile_skills_ProfileId_SortOrder",
                table: "profile_skills",
                columns: new[] { "ProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_profiles_UserId",
                table: "profiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "profile_certificates");

            migrationBuilder.DropTable(
                name: "profile_custom_section_items");

            migrationBuilder.DropTable(
                name: "profile_educations");

            migrationBuilder.DropTable(
                name: "profile_experiences");

            migrationBuilder.DropTable(
                name: "profile_interests");

            migrationBuilder.DropTable(
                name: "profile_languages");

            migrationBuilder.DropTable(
                name: "profile_skills");

            migrationBuilder.DropTable(
                name: "profile_custom_sections");

            migrationBuilder.DropTable(
                name: "profiles");
        }
    }
}
