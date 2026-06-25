CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;
ALTER DATABASE CHARACTER SET utf8mb4;

CREATE TABLE `ApiRequestLogs` (
    `Id` bigint NOT NULL AUTO_INCREMENT,
    `UserId` char(36) COLLATE ascii_general_ci NULL,
    `HttpMethod` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Path` longtext CHARACTER SET utf8mb4 NOT NULL,
    `StatusCode` int NOT NULL,
    `DurationMs` int NOT NULL,
    `IpAddress` longtext CHARACTER SET utf8mb4 NULL,
    `UserAgent` longtext CHARACTER SET utf8mb4 NULL,
    `RequestBody` longtext CHARACTER SET utf8mb4 NULL,
    `ResponseBody` longtext CHARACTER SET utf8mb4 NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_ApiRequestLogs` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `Coins` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `Symbol` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
    `BaseAsset` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
    `QuoteAsset` varchar(10) CHARACTER SET utf8mb4 NOT NULL,
    `DisplayName` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Coins` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `Indicators` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `Name` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `DisplayName` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `Description` varchar(500) CHARACTER SET utf8mb4 NULL,
    `Category` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `ClassName` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `DefaultWeight` decimal(5,2) NOT NULL,
    `IsSystemDefault` tinyint(1) NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Indicators` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `SystemLogs` (
    `Id` bigint NOT NULL AUTO_INCREMENT,
    `Level` int NOT NULL,
    `Source` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Message` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Exception` longtext CHARACTER SET utf8mb4 NULL,
    `UserId` char(36) COLLATE ascii_general_ci NULL,
    `CorrelationId` longtext CHARACTER SET utf8mb4 NULL,
    `Context` longtext CHARACTER SET utf8mb4 NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_SystemLogs` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `Users` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Email` varchar(256) CHARACTER SET utf8mb4 NOT NULL,
    `PasswordHash` varchar(512) CHARACTER SET utf8mb4 NOT NULL,
    `FirstName` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `LastName` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `Role` int NOT NULL,
    `IsEmailVerified` tinyint(1) NOT NULL,
    `EmailVerifyToken` varchar(256) CHARACTER SET utf8mb4 NULL,
    `EmailVerifyTokenExpiry` datetime(6) NULL,
    `PasswordResetToken` longtext CHARACTER SET utf8mb4 NULL,
    `PasswordResetTokenExpiry` datetime(6) NULL,
    `RefreshToken` varchar(512) CHARACTER SET utf8mb4 NULL,
    `RefreshTokenExpiry` datetime(6) NULL,
    `LastLoginAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `IsDeleted` tinyint(1) NOT NULL,
    `DeletedAt` datetime(6) NULL,
    CONSTRAINT `PK_Users` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `CandleData` (
    `Id` bigint NOT NULL AUTO_INCREMENT,
    `CoinId` int NOT NULL,
    `Timeframe` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
    `OpenTime` datetime(6) NOT NULL,
    `CloseTime` datetime(6) NOT NULL,
    `Open` decimal(28,8) NOT NULL,
    `High` decimal(28,8) NOT NULL,
    `Low` decimal(28,8) NOT NULL,
    `Close` decimal(28,8) NOT NULL,
    `Volume` decimal(28,8) NOT NULL,
    `QuoteVolume` decimal(28,8) NOT NULL,
    `TradeCount` int NOT NULL,
    `IsClosed` tinyint(1) NOT NULL,
    CONSTRAINT `PK_CandleData` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_CandleData_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `IndicatorParameterDefinitions` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `IndicatorId` int NOT NULL,
    `ParameterKey` longtext CHARACTER SET utf8mb4 NOT NULL,
    `DisplayName` longtext CHARACTER SET utf8mb4 NOT NULL,
    `DataType` longtext CHARACTER SET utf8mb4 NOT NULL,
    `DefaultValue` longtext CHARACTER SET utf8mb4 NOT NULL,
    `MinValue` longtext CHARACTER SET utf8mb4 NULL,
    `MaxValue` longtext CHARACTER SET utf8mb4 NULL,
    `SelectOptions` longtext CHARACTER SET utf8mb4 NULL,
    `SortOrder` int NOT NULL,
    CONSTRAINT `PK_IndicatorParameterDefinitions` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_IndicatorParameterDefinitions_Indicators_IndicatorId` FOREIGN KEY (`IndicatorId`) REFERENCES `Indicators` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `BacktestRuns` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` varchar(200) CHARACTER SET utf8mb4 NULL,
    `CoinIds` nvarchar(max) NOT NULL,
    `Timeframe` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
    `StartDate` datetime(6) NOT NULL,
    `EndDate` datetime(6) NOT NULL,
    `InitialCapital` decimal(18,2) NOT NULL,
    `CommissionRate` decimal(6,5) NOT NULL,
    `StopLossPct` decimal(5,2) NULL,
    `TakeProfitPct` decimal(5,2) NULL,
    `StrategyConfig` nvarchar(max) NOT NULL,
    `Status` int NOT NULL,
    `FinalCapital` decimal(18,2) NULL,
    `NetPnl` decimal(18,2) NULL,
    `NetPnlPct` decimal(8,4) NULL,
    `WinRate` decimal(5,2) NULL,
    `TotalTrades` int NULL,
    `WinningTrades` int NULL,
    `MaxDrawdown` decimal(5,2) NULL,
    `SharpeRatio` decimal(8,4) NULL,
    `ErrorMessage` varchar(2000) CHARACTER SET utf8mb4 NULL,
    `CompletedAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_BacktestRuns` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_BacktestRuns_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `BalanceSnapshots` (
    `Id` bigint NOT NULL AUTO_INCREMENT,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `TotalValueUsdt` decimal(18,2) NOT NULL,
    `Assets` nvarchar(max) NOT NULL,
    `SnapshotAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_BalanceSnapshots` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_BalanceSnapshots_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `Notifications` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Type` int NOT NULL,
    `Title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `Body` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
    `Payload` nvarchar(max) NULL,
    `Channel` int NOT NULL,
    `IsRead` tinyint(1) NOT NULL,
    `IsSent` tinyint(1) NOT NULL,
    `SentAt` datetime(6) NULL,
    `ReadAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Notifications` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Notifications_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserBinanceAccounts` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ApiKeyEncrypted` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ApiSecretEncrypted` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ApiKeyHint` longtext CHARACTER SET utf8mb4 NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `IsTestnet` tinyint(1) NOT NULL,
    `LastConnectionAt` datetime(6) NULL,
    `LastConnectionStatus` longtext CHARACTER SET utf8mb4 NULL,
    `ConnectionErrorMessage` longtext CHARACTER SET utf8mb4 NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_UserBinanceAccounts` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserBinanceAccounts_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserIndicatorSettings` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `IndicatorId` int NOT NULL,
    `CoinId` int NULL,
    `IsEnabled` tinyint(1) NOT NULL,
    `Weight` decimal(5,2) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_UserIndicatorSettings` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserIndicatorSettings_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`),
    CONSTRAINT `FK_UserIndicatorSettings_Indicators_IndicatorId` FOREIGN KEY (`IndicatorId`) REFERENCES `Indicators` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_UserIndicatorSettings_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserRiskSettings` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `TradeMode` int NOT NULL,
    `MaxDailyLossUsdt` decimal(18,2) NULL,
    `MaxDailyLossPct` decimal(5,2) NULL,
    `MaxOpenPositions` int NOT NULL,
    `MaxPositionSizeUsdt` decimal(18,2) NULL,
    `MaxPositionSizePct` decimal(5,2) NULL,
    `DefaultStopLossPct` decimal(5,2) NULL,
    `DefaultTakeProfitPct` decimal(5,2) NULL,
    `IsStopLossRequired` tinyint(1) NOT NULL,
    `CloseOnDisconnect` tinyint(1) NOT NULL,
    `IsAutoTradeEnabled` tinyint(1) NOT NULL,
    `AllowedCoinIds` nvarchar(max) NULL,
    `BlockedCoinIds` nvarchar(max) NULL,
    `DailyLossUsedUsdt` decimal(18,2) NOT NULL,
    `DailyLossResetAt` datetime(6) NULL,
    `FlashCrashProtectionEnabled` tinyint(1) NOT NULL,
    `FlashCrashDropPct` decimal(65,30) NOT NULL,
    `FlashCrashWindowMinutes` int NOT NULL,
    `AutoTradePaused` tinyint(1) NOT NULL,
    `AutoTradePausedAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_UserRiskSettings` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserRiskSettings_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserStrategies` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NULL,
    `IndicatorId` int NULL,
    `Name` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
    `Timeframe` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
    `TrailingStopPct` decimal(65,30) NOT NULL,
    `StopLossPct` decimal(65,30) NOT NULL,
    `BuyThreshold` decimal(5,2) NOT NULL,
    `SellThreshold` decimal(5,2) NOT NULL,
    `StrongSellThreshold` decimal(5,2) NOT NULL,
    `IsEma200RuleEnabled` tinyint(1) NOT NULL,
    `Ema200MinCandles` int NOT NULL,
    `Ema200MaxCandles` int NOT NULL,
    `Ema200Timeframe` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `IsRealTradeEnabled` tinyint(1) NOT NULL,
    `ActivatedAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_UserStrategies` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserStrategies_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_UserStrategies_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserWatchlists` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `IsActive` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_UserWatchlists` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserWatchlists_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_UserWatchlists_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `BacktestTrades` (
    `Id` bigint NOT NULL AUTO_INCREMENT,
    `BacktestRunId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `Side` int NOT NULL,
    `EntryTime` datetime(6) NOT NULL,
    `EntryPrice` decimal(28,8) NOT NULL,
    `ExitTime` datetime(6) NULL,
    `ExitPrice` decimal(28,8) NULL,
    `ExitReason` int NULL,
    `Quantity` decimal(28,8) NOT NULL,
    `Commission` decimal(28,8) NOT NULL,
    `PnlUsdt` decimal(18,2) NULL,
    `PnlPct` decimal(8,4) NULL,
    `EntryScore` decimal(8,2) NULL,
    `IndicatorScores` nvarchar(max) NULL,
    CONSTRAINT `PK_BacktestTrades` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_BacktestTrades_BacktestRuns_BacktestRunId` FOREIGN KEY (`BacktestRunId`) REFERENCES `BacktestRuns` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_BacktestTrades_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserIndicatorParameterValues` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserIndicatorSettingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ParameterDefinitionId` int NOT NULL,
    `Value` longtext CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_UserIndicatorParameterValues` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserIndicatorParameterValues_IndicatorParameterDefinitions_P~` FOREIGN KEY (`ParameterDefinitionId`) REFERENCES `IndicatorParameterDefinitions` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_UserIndicatorParameterValues_UserIndicatorSettings_UserIndic~` FOREIGN KEY (`UserIndicatorSettingId`) REFERENCES `UserIndicatorSettings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `TradeSignals` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `StrategyId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Timeframe` varchar(5) CHARACTER SET utf8mb4 NOT NULL,
    `Direction` int NOT NULL,
    `TotalScore` decimal(8,2) NOT NULL,
    `CandleTime` datetime(6) NOT NULL,
    `Price` decimal(28,8) NOT NULL,
    `IndicatorScores` nvarchar(max) NOT NULL,
    `IsActedUpon` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_TradeSignals` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_TradeSignals_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_TradeSignals_UserStrategies_StrategyId` FOREIGN KEY (`StrategyId`) REFERENCES `UserStrategies` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_TradeSignals_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `UserStrategyCoins` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `UserStrategyId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `ReEntryState` int NOT NULL,
    `LastCheckedAt` datetime(6) NULL,
    `LastCheckedPrice` decimal(65,30) NULL,
    `LastCheckedReason` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_UserStrategyCoins` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_UserStrategyCoins_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_UserStrategyCoins_UserStrategies_UserStrategyId` FOREIGN KEY (`UserStrategyId`) REFERENCES `UserStrategies` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `TradeOrders` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `SignalId` char(36) COLLATE ascii_general_ci NULL,
    `BinanceOrderId` bigint NULL,
    `ClientOrderId` varchar(100) CHARACTER SET utf8mb4 NULL,
    `Side` int NOT NULL,
    `Type` int NOT NULL,
    `Status` int NOT NULL,
    `Quantity` decimal(28,8) NOT NULL,
    `Price` decimal(28,8) NULL,
    `FilledQuantity` decimal(28,8) NULL,
    `FilledPrice` decimal(28,8) NULL,
    `Commission` decimal(28,8) NULL,
    `CommissionAsset` varchar(10) CHARACTER SET utf8mb4 NULL,
    `IsAutomatic` tinyint(1) NOT NULL,
    `ErrorMessage` varchar(1000) CHARACTER SET utf8mb4 NULL,
    `BinanceCreatedAt` datetime(6) NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_TradeOrders` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_TradeOrders_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_TradeOrders_TradeSignals_SignalId` FOREIGN KEY (`SignalId`) REFERENCES `TradeSignals` (`Id`) ON DELETE SET NULL,
    CONSTRAINT `FK_TradeOrders_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE TABLE `Positions` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CoinId` int NOT NULL,
    `EntryOrderId` char(36) COLLATE ascii_general_ci NULL,
    `EntryPrice` decimal(28,8) NOT NULL,
    `EntryQuantity` decimal(28,8) NOT NULL,
    `EntryValueUsdt` decimal(28,8) NOT NULL,
    `StopLossPrice` decimal(28,8) NULL,
    `TakeProfitPrice` decimal(28,8) NULL,
    `TrailingStopPct` decimal(5,2) NULL,
    `TrailingStopHighWatermark` decimal(28,8) NULL,
    `Status` int NOT NULL,
    `CloseOrderId` char(36) COLLATE ascii_general_ci NULL,
    `ClosePrice` decimal(28,8) NULL,
    `CloseValueUsdt` decimal(28,8) NULL,
    `RealizedPnl` decimal(28,8) NULL,
    `RealizedPnlPct` decimal(8,4) NULL,
    `IsVirtual` tinyint(1) NOT NULL,
    `OpenedAt` datetime(6) NOT NULL,
    `ClosedAt` datetime(6) NULL,
    `CloseReason` longtext CHARACTER SET utf8mb4 NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Positions` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Positions_Coins_CoinId` FOREIGN KEY (`CoinId`) REFERENCES `Coins` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_Positions_TradeOrders_CloseOrderId` FOREIGN KEY (`CloseOrderId`) REFERENCES `TradeOrders` (`Id`) ON DELETE SET NULL,
    CONSTRAINT `FK_Positions_TradeOrders_EntryOrderId` FOREIGN KEY (`EntryOrderId`) REFERENCES `TradeOrders` (`Id`) ON DELETE SET NULL,
    CONSTRAINT `FK_Positions_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

CREATE INDEX `IX_BacktestRuns_UserId_Status` ON `BacktestRuns` (`UserId`, `Status`);

CREATE INDEX `IX_BacktestTrades_BacktestRunId` ON `BacktestTrades` (`BacktestRunId`);

CREATE INDEX `IX_BacktestTrades_CoinId` ON `BacktestTrades` (`CoinId`);

CREATE INDEX `IX_BalanceSnapshots_UserId_SnapshotAt` ON `BalanceSnapshots` (`UserId`, `SnapshotAt`);

CREATE UNIQUE INDEX `IX_CandleData_CoinId_Timeframe_OpenTime` ON `CandleData` (`CoinId`, `Timeframe`, `OpenTime`);

CREATE INDEX `IX_Coins_IsActive` ON `Coins` (`IsActive`);

CREATE UNIQUE INDEX `IX_Coins_Symbol` ON `Coins` (`Symbol`);

CREATE INDEX `IX_IndicatorParameterDefinitions_IndicatorId` ON `IndicatorParameterDefinitions` (`IndicatorId`);

CREATE UNIQUE INDEX `IX_Indicators_Name` ON `Indicators` (`Name`);

CREATE INDEX `IX_Notifications_IsSent` ON `Notifications` (`IsSent`);

CREATE INDEX `IX_Notifications_UserId_IsRead_CreatedAt` ON `Notifications` (`UserId`, `IsRead`, `CreatedAt`);

CREATE INDEX `IX_Positions_CloseOrderId` ON `Positions` (`CloseOrderId`);

CREATE INDEX `IX_Positions_CoinId` ON `Positions` (`CoinId`);

CREATE INDEX `IX_Positions_EntryOrderId` ON `Positions` (`EntryOrderId`);

CREATE INDEX `IX_Positions_UserId_CoinId_Status` ON `Positions` (`UserId`, `CoinId`, `Status`);

CREATE INDEX `IX_Positions_UserId_Status` ON `Positions` (`UserId`, `Status`);

CREATE INDEX `IX_TradeOrders_BinanceOrderId` ON `TradeOrders` (`BinanceOrderId`);

CREATE INDEX `IX_TradeOrders_CoinId` ON `TradeOrders` (`CoinId`);

CREATE INDEX `IX_TradeOrders_SignalId` ON `TradeOrders` (`SignalId`);

CREATE INDEX `IX_TradeOrders_Status` ON `TradeOrders` (`Status`);

CREATE INDEX `IX_TradeOrders_UserId_CoinId_Status` ON `TradeOrders` (`UserId`, `CoinId`, `Status`);

CREATE INDEX `IX_TradeOrders_UserId_CreatedAt` ON `TradeOrders` (`UserId`, `CreatedAt`);

CREATE INDEX `IX_TradeSignals_CoinId` ON `TradeSignals` (`CoinId`);

CREATE INDEX `IX_TradeSignals_Direction` ON `TradeSignals` (`Direction`);

CREATE INDEX `IX_TradeSignals_StrategyId` ON `TradeSignals` (`StrategyId`);

CREATE INDEX `IX_TradeSignals_UserId_CoinId` ON `TradeSignals` (`UserId`, `CoinId`);

CREATE INDEX `IX_TradeSignals_UserId_CreatedAt` ON `TradeSignals` (`UserId`, `CreatedAt`);

CREATE UNIQUE INDEX `IX_UserBinanceAccounts_UserId` ON `UserBinanceAccounts` (`UserId`);

CREATE INDEX `IX_UserIndicatorParameterValues_ParameterDefinitionId` ON `UserIndicatorParameterValues` (`ParameterDefinitionId`);

CREATE INDEX `IX_UserIndicatorParameterValues_UserIndicatorSettingId` ON `UserIndicatorParameterValues` (`UserIndicatorSettingId`);

CREATE INDEX `IX_UserIndicatorSettings_CoinId` ON `UserIndicatorSettings` (`CoinId`);

CREATE INDEX `IX_UserIndicatorSettings_IndicatorId` ON `UserIndicatorSettings` (`IndicatorId`);

CREATE UNIQUE INDEX `IX_UserIndicatorSettings_UserId_IndicatorId_CoinId` ON `UserIndicatorSettings` (`UserId`, `IndicatorId`, `CoinId`);

CREATE UNIQUE INDEX `IX_UserRiskSettings_UserId` ON `UserRiskSettings` (`UserId`);

CREATE UNIQUE INDEX `IX_Users_Email` ON `Users` (`Email`);

CREATE INDEX `IX_Users_IsActive_IsDeleted` ON `Users` (`IsActive`, `IsDeleted`);

CREATE INDEX `IX_UserStrategies_CoinId` ON `UserStrategies` (`CoinId`);

CREATE INDEX `IX_UserStrategies_UserId_IsActive` ON `UserStrategies` (`UserId`, `IsActive`);

CREATE INDEX `IX_UserStrategyCoins_CoinId` ON `UserStrategyCoins` (`CoinId`);

CREATE INDEX `IX_UserStrategyCoins_UserStrategyId` ON `UserStrategyCoins` (`UserStrategyId`);

CREATE INDEX `IX_UserWatchlists_CoinId` ON `UserWatchlists` (`CoinId`);

CREATE UNIQUE INDEX `IX_UserWatchlists_UserId_CoinId` ON `UserWatchlists` (`UserId`, `CoinId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260625181418_InitialMySql', '9.0.6');

COMMIT;

