using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLastCheckedToStrategyCoin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastCheckedAt",
                table: "UserStrategyCoins",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastCheckedPrice",
                table: "UserStrategyCoins",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastCheckedReason",
                table: "UserStrategyCoins",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastCheckedAt",
                table: "UserStrategyCoins");

            migrationBuilder.DropColumn(
                name: "LastCheckedPrice",
                table: "UserStrategyCoins");

            migrationBuilder.DropColumn(
                name: "LastCheckedReason",
                table: "UserStrategyCoins");
        }
    }
}
