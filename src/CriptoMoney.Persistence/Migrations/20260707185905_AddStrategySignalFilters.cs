using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategySignalFilters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AdxMinValue",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "AdxPeriod",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "BreakevenTriggerPct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "UseAdxFilter",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "UseBreakevenStop",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "UseMacdFilter",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdxMinValue",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "AdxPeriod",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "BreakevenTriggerPct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseAdxFilter",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseBreakevenStop",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseMacdFilter",
                table: "UserStrategies");
        }
    }
}
