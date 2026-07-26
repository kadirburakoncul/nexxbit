using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTraderSystemFilters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ConsecutiveLossCount",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "HigherTimeframe",
                table: "UserStrategies",
                type: "varchar(10)",
                nullable: false,
                defaultValue: "1h")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "MaxConsecutiveLosses",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<decimal>(
                name: "PauseOnDrawdownPct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 15m);

            migrationBuilder.AddColumn<DateTime>(
                name: "PausedUntil",
                table: "UserStrategies",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RiskPerTradePct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 1.0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RsiMaxValue",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 75m);

            migrationBuilder.AddColumn<bool>(
                name: "UseHigherTfConfirm",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "UseRiskBasedSizing",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "InSampleNetPnlPct",
                table: "BacktestRuns",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OutOfSampleNetPnlPct",
                table: "BacktestRuns",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OutOfSampleNote",
                table: "BacktestRuns",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "OutOfSampleWinRate",
                table: "BacktestRuns",
                type: "decimal(65,30)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsecutiveLossCount",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "HigherTimeframe",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "MaxConsecutiveLosses",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "PauseOnDrawdownPct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "PausedUntil",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "RiskPerTradePct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "RsiMaxValue",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseHigherTfConfirm",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "UseRiskBasedSizing",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "InSampleNetPnlPct",
                table: "BacktestRuns");

            migrationBuilder.DropColumn(
                name: "OutOfSampleNetPnlPct",
                table: "BacktestRuns");

            migrationBuilder.DropColumn(
                name: "OutOfSampleNote",
                table: "BacktestRuns");

            migrationBuilder.DropColumn(
                name: "OutOfSampleWinRate",
                table: "BacktestRuns");
        }
    }
}
