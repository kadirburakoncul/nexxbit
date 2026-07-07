using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsApprovedByAdmin",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            // Mevcut kullanıcılar önceden kayıtlıydı — hepsini onaylı işaretle
            migrationBuilder.Sql("UPDATE Users SET IsApprovedByAdmin = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsApprovedByAdmin",
                table: "Users");
        }
    }
}
