using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cv.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationsAndTracker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "applications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    JobTitle = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Company = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Location = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    ContactPerson = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    ContactEmail = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    ContactPhone = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    JobPostingUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    JobDescription = table.Column<string>(type: "TEXT", nullable: true),
                    SalaryExpectation = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    FollowUpAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CoverLetterId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CvDesign = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    CvAccentColor = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    CvFont = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    CvLanguage = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    CvShowPhoto = table.Column<bool>(type: "INTEGER", nullable: false),
                    CvPhotoShape = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    IncludeCoverSheet = table.Column<bool>(type: "INTEGER", nullable: false),
                    ArchivedPdfPath = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_applications_cover_letters_CoverLetterId",
                        column: x => x.CoverLetterId,
                        principalTable: "cover_letters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_applications_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "application_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Note = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_application_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_application_events_applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_application_events_ApplicationId_Date",
                table: "application_events",
                columns: new[] { "ApplicationId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_applications_CoverLetterId",
                table: "applications",
                column: "CoverLetterId");

            migrationBuilder.CreateIndex(
                name: "IX_applications_UserId_Status",
                table: "applications",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_applications_UserId_UpdatedAt",
                table: "applications",
                columns: new[] { "UserId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "application_events");

            migrationBuilder.DropTable(
                name: "applications");
        }
    }
}
