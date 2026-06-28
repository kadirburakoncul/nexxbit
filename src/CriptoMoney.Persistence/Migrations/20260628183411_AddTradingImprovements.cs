using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTradingImprovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AtrPeriod",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "AtrSlMultiplier",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AtrTpMultiplier",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsVolumeSurgeFilterEnabled",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PartialTpClosePct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PartialTpPct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UseAtrBasedStops",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "UseMarketRegimeFilter",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "VolumeSurgeMultiplier",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsPartialTpHit",
                table: "Positions",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PartialRealizedPnlPct",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PartialTpHitPrice",
                table: "Positions",
                type: "decimal(65,30)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AtrPeriod",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "AtrSlMultiplier",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "AtrTpMultiplier",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "IsVolumeSurgeFilterEnabled",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "PartialTpClosePct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "PartialTpPct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseAtrBasedStops",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseMarketRegimeFilter",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "VolumeSurgeMultiplier",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "IsPartialTpHit",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PartialRealizedPnlPct",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PartialTpHitPrice",
                table: "Positions");
        }
    }
}
