using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMinVolumeToStrategy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MinVolumeUsdt",
                table: "UserStrategies",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinVolumeUsdt",
                table: "UserStrategies");
        }
    }
}
