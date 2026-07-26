using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBistPositionAndFilters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPositionTrackingEnabled",
                table: "BistStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "StopLossPct",
                table: "BistStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 8m);

            migrationBuilder.AddColumn<decimal>(
                name: "TrailingActivationPct",
                table: "BistStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 5m);

            migrationBuilder.AddColumn<decimal>(
                name: "TrailingStopPct",
                table: "BistStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 8m);

            migrationBuilder.AddColumn<bool>(
                name: "UseEma200Filter",
                table: "BistStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "BistPositions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStrategyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStockId = table.Column<int>(type: "int", nullable: false),
                    EntryPrice = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    EntryCandleTime = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    PeakPrice = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    PeakPriceAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    StopLossPrice = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ClosePrice = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CloseReason = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RealizedPnlPct = table.Column<decimal>(type: "decimal(10,4)", precision: 10, scale: 4, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistPositions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistPositions_BistStocks_BistStockId",
                        column: x => x.BistStockId,
                        principalTable: "BistStocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BistPositions_BistStrategies_BistStrategyId",
                        column: x => x.BistStrategyId,
                        principalTable: "BistStrategies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BistPositions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BistPositions_BistStockId",
                table: "BistPositions",
                column: "BistStockId");

            migrationBuilder.CreateIndex(
                name: "IX_BistPositions_BistStrategyId_BistStockId_Status",
                table: "BistPositions",
                columns: new[] { "BistStrategyId", "BistStockId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_BistPositions_OpenedAt",
                table: "BistPositions",
                column: "OpenedAt");

            migrationBuilder.CreateIndex(
                name: "IX_BistPositions_UserId",
                table: "BistPositions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BistPositions");

            migrationBuilder.DropColumn(
                name: "IsPositionTrackingEnabled",
                table: "BistStrategies");

            migrationBuilder.DropColumn(
                name: "StopLossPct",
                table: "BistStrategies");

            migrationBuilder.DropColumn(
                name: "TrailingActivationPct",
                table: "BistStrategies");

            migrationBuilder.DropColumn(
                name: "TrailingStopPct",
                table: "BistStrategies");

            migrationBuilder.DropColumn(
                name: "UseEma200Filter",
                table: "BistStrategies");
        }
    }
}
