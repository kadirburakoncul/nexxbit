using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CriptoMoney.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApiRequestLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    HttpMethod = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StatusCode = table.Column<int>(type: "int", nullable: false),
                    DurationMs = table.Column<int>(type: "int", nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RequestBody = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ResponseBody = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiRequestLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Coins",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Symbol = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BaseAsset = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    QuoteAsset = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Coins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Indicators",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ClassName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DefaultWeight = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    IsSystemDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Indicators", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SystemLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Exception = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CorrelationId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Context = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    IsEmailVerified = table.Column<bool>(type: "bit", nullable: false),
                    EmailVerifyToken = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    RefreshToken = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandleData",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    Timeframe = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    OpenTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CloseTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Open = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    High = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    Low = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    Close = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    Volume = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    QuoteVolume = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    TradeCount = table.Column<int>(type: "int", nullable: false),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandleData", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandleData_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IndicatorParameterDefinitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IndicatorId = table.Column<int>(type: "int", nullable: false),
                    ParameterKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DataType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DefaultValue = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MinValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaxValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SelectOptions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndicatorParameterDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IndicatorParameterDefinitions_Indicators_IndicatorId",
                        column: x => x.IndicatorId,
                        principalTable: "Indicators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BacktestRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CoinIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Timeframe = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InitialCapital = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CommissionRate = table.Column<decimal>(type: "decimal(6,5)", precision: 6, scale: 5, nullable: false),
                    StopLossPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    TakeProfitPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    StrategyConfig = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    FinalCapital = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    NetPnl = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    NetPnlPct = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: true),
                    WinRate = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    TotalTrades = table.Column<int>(type: "int", nullable: true),
                    WinningTrades = table.Column<int>(type: "int", nullable: true),
                    MaxDrawdown = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    SharpeRatio = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: true),
                    ErrorMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BacktestRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BacktestRuns_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BalanceSnapshots",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TotalValueUsdt = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Assets = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SnapshotAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BalanceSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BalanceSnapshots_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Payload = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Channel = table.Column<int>(type: "int", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    IsSent = table.Column<bool>(type: "bit", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserBinanceAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApiKeyEncrypted = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ApiSecretEncrypted = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ApiKeyHint = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsTestnet = table.Column<bool>(type: "bit", nullable: false),
                    LastConnectionAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastConnectionStatus = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConnectionErrorMessage = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBinanceAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserBinanceAccounts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserIndicatorSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IndicatorId = table.Column<int>(type: "int", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: true),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    Weight = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserIndicatorSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserIndicatorSettings_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_UserIndicatorSettings_Indicators_IndicatorId",
                        column: x => x.IndicatorId,
                        principalTable: "Indicators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserIndicatorSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRiskSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TradeMode = table.Column<int>(type: "int", nullable: false),
                    MaxDailyLossUsdt = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MaxDailyLossPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    MaxOpenPositions = table.Column<int>(type: "int", nullable: false),
                    MaxPositionSizeUsdt = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MaxPositionSizePct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    DefaultStopLossPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    DefaultTakeProfitPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    IsStopLossRequired = table.Column<bool>(type: "bit", nullable: false),
                    CloseOnDisconnect = table.Column<bool>(type: "bit", nullable: false),
                    IsAutoTradeEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AllowedCoinIds = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BlockedCoinIds = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DailyLossUsedUsdt = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DailyLossResetAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRiskSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRiskSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserStrategies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Timeframe = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    BuyThreshold = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    SellThreshold = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    StrongSellThreshold = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    IsEma200RuleEnabled = table.Column<bool>(type: "bit", nullable: false),
                    Ema200MinCandles = table.Column<int>(type: "int", nullable: false),
                    Ema200MaxCandles = table.Column<int>(type: "int", nullable: false),
                    Ema200Timeframe = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStrategies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserStrategies_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserStrategies_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserWatchlists",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserWatchlists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserWatchlists_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserWatchlists_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BacktestTrades",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BacktestRunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    Side = table.Column<int>(type: "int", nullable: false),
                    EntryTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EntryPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    ExitTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExitPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    ExitReason = table.Column<int>(type: "int", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    Commission = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    PnlUsdt = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    PnlPct = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: true),
                    EntryScore = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: true),
                    IndicatorScores = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BacktestTrades", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BacktestTrades_BacktestRuns_BacktestRunId",
                        column: x => x.BacktestRunId,
                        principalTable: "BacktestRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BacktestTrades_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserIndicatorParameterValues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserIndicatorSettingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParameterDefinitionId = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserIndicatorParameterValues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserIndicatorParameterValues_IndicatorParameterDefinitions_ParameterDefinitionId",
                        column: x => x.ParameterDefinitionId,
                        principalTable: "IndicatorParameterDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserIndicatorParameterValues_UserIndicatorSettings_UserIndicatorSettingId",
                        column: x => x.UserIndicatorSettingId,
                        principalTable: "UserIndicatorSettings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TradeSignals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    StrategyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Timeframe = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    Direction = table.Column<int>(type: "int", nullable: false),
                    TotalScore = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    CandleTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    IndicatorScores = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActedUpon = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TradeSignals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TradeSignals_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TradeSignals_UserStrategies_StrategyId",
                        column: x => x.StrategyId,
                        principalTable: "UserStrategies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TradeSignals_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TradeOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    SignalId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BinanceOrderId = table.Column<long>(type: "bigint", nullable: true),
                    ClientOrderId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Side = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    Price = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    FilledQuantity = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    FilledPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    Commission = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    CommissionAsset = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    IsAutomatic = table.Column<bool>(type: "bit", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    BinanceCreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TradeOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TradeOrders_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TradeOrders_TradeSignals_SignalId",
                        column: x => x.SignalId,
                        principalTable: "TradeSignals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TradeOrders_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Positions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoinId = table.Column<int>(type: "int", nullable: false),
                    EntryOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntryPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    EntryQuantity = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    EntryValueUsdt = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: false),
                    StopLossPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    TakeProfitPrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    TrailingStopPct = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    TrailingStopHighWatermark = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CloseOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ClosePrice = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    CloseValueUsdt = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    RealizedPnl = table.Column<decimal>(type: "decimal(28,8)", precision: 28, scale: 8, nullable: true),
                    RealizedPnlPct = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: true),
                    OpenedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Positions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Positions_Coins_CoinId",
                        column: x => x.CoinId,
                        principalTable: "Coins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Positions_TradeOrders_CloseOrderId",
                        column: x => x.CloseOrderId,
                        principalTable: "TradeOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Positions_TradeOrders_EntryOrderId",
                        column: x => x.EntryOrderId,
                        principalTable: "TradeOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Positions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BacktestRuns_UserId_Status",
                table: "BacktestRuns",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_BacktestTrades_BacktestRunId",
                table: "BacktestTrades",
                column: "BacktestRunId");

            migrationBuilder.CreateIndex(
                name: "IX_BacktestTrades_CoinId",
                table: "BacktestTrades",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_BalanceSnapshots_UserId_SnapshotAt",
                table: "BalanceSnapshots",
                columns: new[] { "UserId", "SnapshotAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CandleData_CoinId_Timeframe_OpenTime",
                table: "CandleData",
                columns: new[] { "CoinId", "Timeframe", "OpenTime" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Coins_IsActive",
                table: "Coins",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Coins_Symbol",
                table: "Coins",
                column: "Symbol",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IndicatorParameterDefinitions_IndicatorId",
                table: "IndicatorParameterDefinitions",
                column: "IndicatorId");

            migrationBuilder.CreateIndex(
                name: "IX_Indicators_Name",
                table: "Indicators",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IsSent",
                table: "Notifications",
                column: "IsSent",
                filter: "[IsSent] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_CloseOrderId",
                table: "Positions",
                column: "CloseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_CoinId",
                table: "Positions",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_EntryOrderId",
                table: "Positions",
                column: "EntryOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_UserId_CoinId_Status",
                table: "Positions",
                columns: new[] { "UserId", "CoinId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_UserId_Status",
                table: "Positions",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_BinanceOrderId",
                table: "TradeOrders",
                column: "BinanceOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_CoinId",
                table: "TradeOrders",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_SignalId",
                table: "TradeOrders",
                column: "SignalId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_Status",
                table: "TradeOrders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_UserId_CoinId_Status",
                table: "TradeOrders",
                columns: new[] { "UserId", "CoinId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeOrders_UserId_CreatedAt",
                table: "TradeOrders",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeSignals_CoinId",
                table: "TradeSignals",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeSignals_Direction",
                table: "TradeSignals",
                column: "Direction");

            migrationBuilder.CreateIndex(
                name: "IX_TradeSignals_StrategyId",
                table: "TradeSignals",
                column: "StrategyId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeSignals_UserId_CoinId",
                table: "TradeSignals",
                columns: new[] { "UserId", "CoinId" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeSignals_UserId_CreatedAt",
                table: "TradeSignals",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserBinanceAccounts_UserId",
                table: "UserBinanceAccounts",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorParameterValues_ParameterDefinitionId",
                table: "UserIndicatorParameterValues",
                column: "ParameterDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorParameterValues_UserIndicatorSettingId",
                table: "UserIndicatorParameterValues",
                column: "UserIndicatorSettingId");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorSettings_CoinId",
                table: "UserIndicatorSettings",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorSettings_IndicatorId",
                table: "UserIndicatorSettings",
                column: "IndicatorId");

            migrationBuilder.CreateIndex(
                name: "IX_UserIndicatorSettings_UserId_IndicatorId_CoinId",
                table: "UserIndicatorSettings",
                columns: new[] { "UserId", "IndicatorId", "CoinId" },
                unique: true,
                filter: "[CoinId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserRiskSettings_UserId",
                table: "UserRiskSettings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsActive_IsDeleted",
                table: "Users",
                columns: new[] { "IsActive", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_UserStrategies_CoinId",
                table: "UserStrategies",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_UserStrategies_UserId_IsActive",
                table: "UserStrategies",
                columns: new[] { "UserId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_UserWatchlists_CoinId",
                table: "UserWatchlists",
                column: "CoinId");

            migrationBuilder.CreateIndex(
                name: "IX_UserWatchlists_UserId_CoinId",
                table: "UserWatchlists",
                columns: new[] { "UserId", "CoinId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApiRequestLogs");

            migrationBuilder.DropTable(
                name: "BacktestTrades");

            migrationBuilder.DropTable(
                name: "BalanceSnapshots");

            migrationBuilder.DropTable(
                name: "CandleData");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "Positions");

            migrationBuilder.DropTable(
                name: "SystemLogs");

            migrationBuilder.DropTable(
                name: "UserBinanceAccounts");

            migrationBuilder.DropTable(
                name: "UserIndicatorParameterValues");

            migrationBuilder.DropTable(
                name: "UserRiskSettings");

            migrationBuilder.DropTable(
                name: "UserWatchlists");

            migrationBuilder.DropTable(
                name: "BacktestRuns");

            migrationBuilder.DropTable(
                name: "TradeOrders");

            migrationBuilder.DropTable(
                name: "IndicatorParameterDefinitions");

            migrationBuilder.DropTable(
                name: "UserIndicatorSettings");

            migrationBuilder.DropTable(
                name: "TradeSignals");

            migrationBuilder.DropTable(
                name: "Indicators");

            migrationBuilder.DropTable(
                name: "UserStrategies");

            migrationBuilder.DropTable(
                name: "Coins");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
