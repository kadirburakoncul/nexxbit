using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTrailingActivationPct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Varsayılan 1.0: mevcut stratejiler de düzeltilmiş davranışa geçsin.
            // 0 bırakılsaydı trailing girişten itibaren aktif kalır ve kârlı
            // pozisyonların zararla kapanmasına yol açan eski hata sürerdi.
            migrationBuilder.AddColumn<decimal>(
                name: "TrailingActivationPct",
                table: "UserStrategies",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 1.0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TrailingActivationPct",
                table: "UserStrategies");
        }
    }
}
