using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionTroughPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TroughPnlPct",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TroughPrice",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TroughPriceAt",
                table: "Positions",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TroughPnlPct",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "TroughPrice",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "TroughPriceAt",
                table: "Positions");
        }
    }
}
