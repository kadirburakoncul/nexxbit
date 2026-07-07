using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBistStrategyAndIndicatorSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BistStocks_IsInWatchlist",
                table: "BistStocks");

            migrationBuilder.DropIndex(
                name: "IX_BistSignals_BistStockId_CandleTime",
                table: "BistSignals");

            migrationBuilder.DropColumn(
                name: "IsInWatchlist",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastCheckedAt",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastCheckedReason",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastPrice",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastPriceAt",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastT3",
                table: "BistStocks");

            migrationBuilder.DropColumn(
                name: "LastT3UpDirection",
                table: "BistStocks");

            migrationBuilder.AddColumn<Guid>(
                name: "BistStrategyId",
                table: "BistSignals",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "BistSignals",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "BistIndicatorSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    T3Period = table.Column<int>(type: "int", nullable: false),
                    T3Factor = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    IsRsiFilterEnabled = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    RsiPeriod = table.Column<int>(type: "int", nullable: false),
                    RsiBuyThreshold = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistIndicatorSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistIndicatorSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BistStrategies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Timeframe = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistStrategies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistStrategies_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BistStrategyStocks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStrategyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStockId = table.Column<int>(type: "int", nullable: false),
                    LastPrice = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    LastPriceAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    LastT3 = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    LastT3UpDirection = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    LastCheckedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    LastCheckedReason = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistStrategyStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistStrategyStocks_BistStocks_BistStockId",
                        column: x => x.BistStockId,
                        principalTable: "BistStocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BistStrategyStocks_BistStrategies_BistStrategyId",
                        column: x => x.BistStrategyId,
                        principalTable: "BistStrategies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_BistStockId",
                table: "BistSignals",
                column: "BistStockId");

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_BistStrategyId_BistStockId_CandleTime",
                table: "BistSignals",
                columns: new[] { "BistStrategyId", "BistStockId", "CandleTime" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_UserId",
                table: "BistSignals",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BistIndicatorSettings_UserId",
                table: "BistIndicatorSettings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BistStrategies_IsActive",
                table: "BistStrategies",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_BistStrategies_UserId",
                table: "BistStrategies",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BistStrategyStocks_BistStockId",
                table: "BistStrategyStocks",
                column: "BistStockId");

            migrationBuilder.CreateIndex(
                name: "IX_BistStrategyStocks_BistStrategyId_BistStockId",
                table: "BistStrategyStocks",
                columns: new[] { "BistStrategyId", "BistStockId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_BistSignals_BistStrategies_BistStrategyId",
                table: "BistSignals",
                column: "BistStrategyId",
                principalTable: "BistStrategies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_BistSignals_Users_UserId",
                table: "BistSignals",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BistSignals_BistStrategies_BistStrategyId",
                table: "BistSignals");

            migrationBuilder.DropForeignKey(
                name: "FK_BistSignals_Users_UserId",
                table: "BistSignals");

            migrationBuilder.DropTable(
                name: "BistIndicatorSettings");

            migrationBuilder.DropTable(
                name: "BistStrategyStocks");

            migrationBuilder.DropTable(
                name: "BistStrategies");

            migrationBuilder.DropIndex(
                name: "IX_BistSignals_BistStockId",
                table: "BistSignals");

            migrationBuilder.DropIndex(
                name: "IX_BistSignals_BistStrategyId_BistStockId_CandleTime",
                table: "BistSignals");

            migrationBuilder.DropIndex(
                name: "IX_BistSignals_UserId",
                table: "BistSignals");

            migrationBuilder.DropColumn(
                name: "BistStrategyId",
                table: "BistSignals");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "BistSignals");

            migrationBuilder.AddColumn<bool>(
                name: "IsInWatchlist",
                table: "BistStocks",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastCheckedAt",
                table: "BistStocks",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastCheckedReason",
                table: "BistStocks",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "LastPrice",
                table: "BistStocks",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastPriceAt",
                table: "BistStocks",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastT3",
                table: "BistStocks",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "LastT3UpDirection",
                table: "BistStocks",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BistStocks_IsInWatchlist",
                table: "BistStocks",
                column: "IsInWatchlist");

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_BistStockId_CandleTime",
                table: "BistSignals",
                columns: new[] { "BistStockId", "CandleTime" },
                unique: true);
        }
    }
}
