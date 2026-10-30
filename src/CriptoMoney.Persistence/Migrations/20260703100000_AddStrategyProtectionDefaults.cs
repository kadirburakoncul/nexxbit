using CriptoMoney.Persistence.Context;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260703100000_AddStrategyProtectionDefaults")]
    public partial class AddStrategyProtectionDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxHoldHours",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 8);

            migrationBuilder.AddColumn<int>(
                name: "SlCooldownHours",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<bool>(
                name: "IsGreenCandleFilterEnabled",
                table: "UserStrategies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "MaxHoldHours",             table: "UserStrategies");
            migrationBuilder.DropColumn(name: "SlCooldownHours",          table: "UserStrategies");
            migrationBuilder.DropColumn(name: "IsGreenCandleFilterEnabled", table: "UserStrategies");
        }
    }
}
