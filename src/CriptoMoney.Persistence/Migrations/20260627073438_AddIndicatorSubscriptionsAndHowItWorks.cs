using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIndicatorSubscriptionsAndHowItWorks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HowItWorks",
                table: "Indicators",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "UserIndicatorSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IndicatorId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserIndicatorSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserIndicatorSubscriptions_Indicators_IndicatorId",
                        column: x => x.IndicatorId,
                        principalTable: "Indicators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserIndicatorSubscriptions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorSubscriptions_IndicatorId",
                table: "UserIndicatorSubscriptions",
                column: "IndicatorId");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorSubscriptions_UserId_IndicatorId",
                table: "UserIndicatorSubscriptions",
                columns: new[] { "UserId", "IndicatorId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserIndicatorSubscriptions");

            migrationBuilder.DropColumn(
                name: "HowItWorks",
                table: "Indicators");
        }
    }
}
