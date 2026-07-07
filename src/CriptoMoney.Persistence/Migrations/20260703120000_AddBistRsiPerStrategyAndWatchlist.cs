using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBistRsiPerStrategyAndWatchlist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // RSI fields on BistStrategies
            migrationBuilder.AddColumn<bool>(
                name: "IsRsiFilterEnabled",
                table: "BistStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RsiPeriod",
                table: "BistStrategies",
                type: "int",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<decimal>(
                name: "RsiBuyThreshold",
                table: "BistStrategies",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 50m);

            // BistWatchlistItems table
            migrationBuilder.CreateTable(
                name: "BistWatchlistItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStockId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistWatchlistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistWatchlistItems_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BistWatchlistItems_BistStocks_BistStockId",
                        column: x => x.BistStockId,
                        principalTable: "BistStocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BistWatchlistItems_UserId_BistStockId",
                table: "BistWatchlistItems",
                columns: new[] { "UserId", "BistStockId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "BistWatchlistItems");

            migrationBuilder.DropColumn(name: "IsRsiFilterEnabled", table: "BistStrategies");
            migrationBuilder.DropColumn(name: "RsiPeriod", table: "BistStrategies");
            migrationBuilder.DropColumn(name: "RsiBuyThreshold", table: "BistStrategies");
        }
    }
}
