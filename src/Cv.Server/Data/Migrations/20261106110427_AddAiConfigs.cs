using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cv.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_ai_configs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Provider = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Model = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    BaseUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    ApiKeyProtected = table.Column<string>(type: "TEXT", nullable: true),
                    Pseudonymize = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ai_configs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_ai_configs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_ai_configs_UserId",
                table: "user_ai_configs",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_ai_configs");
        }
    }
}
