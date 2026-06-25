using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserStrategyCoins : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Positions_TradeOrders_EntryOrderId",
                table: "Positions");

            migrationBuilder.AddColumn<decimal>(
                name: "StopLossPct",
                table: "UserStrategies",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TrailingStopPct",
                table: "UserStrategies",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<Guid>(
                name: "EntryOrderId",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.CreateTable(
                name: "UserStrategyCoins",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserStrategyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    ReEntryState = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStrategyCoins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserStrategyCoins_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserStrategyCoins_UserStrategies_UserStrategyId",
                        column: x => x.UserStrategyId,
                        principalTable: "UserStrategies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserStrategyCoins_CoinId",
                table: "UserStrategyCoins",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_UserStrategyCoins_UserStrategyId",
                table: "UserStrategyCoins",
                column: "UserStrategyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Positions_TradeOrders_EntryOrderId",
                table: "Positions",
                column: "EntryOrderId",
                principalTable: "TradeOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Positions_TradeOrders_EntryOrderId",
                table: "Positions");

            migrationBuilder.DropTable(
                name: "UserStrategyCoins");

            migrationBuilder.DropColumn(
                name: "StopLossPct",
                table: "UserStrategies");

            migrationBuilder.DropColumn(
                name: "TrailingStopPct",
                table: "UserStrategies");

            migrationBuilder.AlterColumn<Guid>(
                name: "EntryOrderId",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Positions_TradeOrders_EntryOrderId",
                table: "Positions",
                column: "EntryOrderId",
                principalTable: "TradeOrders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
