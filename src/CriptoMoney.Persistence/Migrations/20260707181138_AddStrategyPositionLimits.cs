using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategyPositionLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Yeni index önce oluşturulmalı — MySQL, FK kullanan composite index'i direkt silemez
            migrationBuilder.CreateIndex(
                name: "IX_BistWatchlistItems_UserId",
                table: "BistWatchlistItems",
                column: "UserId");

            migrationBuilder.DropIndex(
                name: "IX_BistWatchlistItems_UserId_BistStockId",
                table: "BistWatchlistItems");

            migrationBuilder.AddColumn<int>(
                name: "MaxOpenPositions",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxPositionSizePct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxPositionSizeUsdt",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinPositionSizeUsdt",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "RsiBuyThreshold",
                table: "BistStrategies",
                type: "decimal(65,30)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,2)",
                oldPrecision: 5,
                oldScale: 2);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BistWatchlistItems_UserId",
                table: "BistWatchlistItems");

            migrationBuilder.DropColumn(
                name: "MaxOpenPositions",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "MaxPositionSizePct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "MaxPositionSizeUsdt",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "MinPositionSizeUsdt",
                table: "UserStrategies");

            migrationBuilder.AlterColumn<decimal>(
                name: "RsiBuyThreshold",
                table: "BistStrategies",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)");

            migrationBuilder.CreateIndex(
                name: "IX_BistWatchlistItems_UserId_BistStockId",
                table: "BistWatchlistItems",
                columns: new[] { "UserId", "BistStockId" },
                unique: true);
        }
    }
}
