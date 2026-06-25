using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategyRealTradeAndCloseReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ActivatedAt",
                table: "UserStrategies",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRealTradeEnabled",
                table: "UserStrategies",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CloseReason",
                table: "Positions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActivatedAt",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "IsRealTradeEnabled",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "CloseReason",
                table: "Positions");
        }
    }
}
