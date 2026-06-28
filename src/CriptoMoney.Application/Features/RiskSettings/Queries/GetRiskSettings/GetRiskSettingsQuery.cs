using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.RiskSettings.Queries.GetRiskSettings;

public record GetRiskSettingsQuery(Guid UserId) : IRequest<Result<RiskSettingsDto>>;

public record RiskSettingsDto(
    Guid Id,
    TradeMode TradeMode,
    bool IsAutoTradeEnabled,
    decimal? MaxDailyLossUsdt,
    decimal? MaxDailyLossPct,
    int MaxOpenPositions,
    decimal? MaxPositionSizeUsdt,
    decimal? MaxPositionSizePct,
    decimal? DefaultStopLossPct,
    decimal? DefaultTakeProfitPct,
    bool IsStopLossRequired,
    bool CloseOnDisconnect,
    decimal DailyLossUsedUsdt,
    DateTime? DailyLossResetAt,
    bool FlashCrashProtectionEnabled,
    decimal FlashCrashDropPct,
    int FlashCrashWindowMinutes,
    bool AutoTradePaused,
    DateTime? AutoTradePausedAt,
    List<int> AllowedCoinIds,
    List<int> BlockedCoinIds,
    bool TelegramEnabled,
    string? TelegramBotToken,
    string? TelegramChatId
);
