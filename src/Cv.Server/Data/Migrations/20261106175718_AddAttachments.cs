using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cv.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttachmentIds",
                table: "applications",
                type: "TEXT",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    ContentType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SizeBytes = table.Column<long>(type: "INTEGER", nullable: false),
                    StoragePath = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_attachments_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_attachments_UserId_SortOrder",
                table: "attachments",
                columns: new[] { "UserId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attachments");

            migrationBuilder.DropColumn(
                name: "AttachmentIds",
                table: "applications");
        }
    }
}
