using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cv.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoverLetters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cover_letters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    SenderName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    SenderStreet = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    SenderPostalCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    SenderCity = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    SenderPhone = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    SenderEmail = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    RecipientCompany = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    RecipientDepartment = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    RecipientContactPerson = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    RecipientStreet = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    RecipientPostalCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    RecipientCity = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    RecipientCountry = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Place = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Date = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Subject = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Salutation = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Body = table.Column<string>(type: "TEXT", nullable: false),
                    Closing = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    SignatureName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    SignaturePath = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    AttachmentsNote = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Language = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Font = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    AccentColor = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cover_letters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cover_letters_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cover_letters_UserId_UpdatedAt",
                table: "cover_letters",
                columns: new[] { "UserId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cover_letters");
        }
    }
}
