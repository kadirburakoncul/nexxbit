using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TelegramBotToken",
                table: "UserRiskSettings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TelegramChatId",
                table: "UserRiskSettings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "TelegramEnabled",
                table: "UserRiskSettings",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TelegramBotToken",
                table: "UserRiskSettings");

            migrationBuilder.DropColumn(
                name: "TelegramChatId",
                table: "UserRiskSettings");

            migrationBuilder.DropColumn(
                name: "TelegramEnabled",
                table: "UserRiskSettings");
        }
    }
}
