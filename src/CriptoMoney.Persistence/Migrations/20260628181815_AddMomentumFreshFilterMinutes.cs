using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMomentumFreshFilterMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MomentumFreshFilterMinutes",
                table: "UserStrategies",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MomentumFreshFilterMinutes",
                table: "UserStrategies");
        }
    }
}
