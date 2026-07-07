using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionPeakPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PeakPnlPct",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PeakPrice",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PeakPriceAt",
                table: "Positions",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PeakPnlPct",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PeakPrice",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PeakPriceAt",
                table: "Positions");
        }
    }
}
