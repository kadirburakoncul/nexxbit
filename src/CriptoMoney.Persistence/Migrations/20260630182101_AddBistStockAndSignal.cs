using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBistStockAndSignal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BistStocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Symbol = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DisplayName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Sector = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsInWatchlist = table.Column<bool>(type: "tinyint(1)", nullable: false),
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
                    table.PrimaryKey("PK_BistStocks", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BistSignals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BistStockId = table.Column<int>(type: "int", nullable: false),
                    Direction = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    CandleTime = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Reason = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BistSignals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BistSignals_BistStocks_BistStockId",
                        column: x => x.BistStockId,
                        principalTable: "BistStocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_BistStockId_CandleTime",
                table: "BistSignals",
                columns: new[] { "BistStockId", "CandleTime" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BistSignals_CandleTime",
                table: "BistSignals",
                column: "CandleTime");

            migrationBuilder.CreateIndex(
                name: "IX_BistStocks_IsInWatchlist",
                table: "BistStocks",
                column: "IsInWatchlist");

            migrationBuilder.CreateIndex(
                name: "IX_BistStocks_Symbol",
                table: "BistStocks",
                column: "Symbol",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BistSignals");

            migrationBuilder.DropTable(
                name: "BistStocks");
        }
    }
}
