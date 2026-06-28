using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategyIdToPosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StrategyId",
                table: "Positions",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StrategyId",
                table: "Positions");
        }
    }
}
