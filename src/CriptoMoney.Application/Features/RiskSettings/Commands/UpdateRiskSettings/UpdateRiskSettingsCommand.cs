using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.RiskSettings.Commands.UpdateRiskSettings;

public record UpdateRiskSettingsCommand(
    Guid UserId,
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
    bool FlashCrashProtectionEnabled = true,
    decimal FlashCrashDropPct = 5.0m,
    int FlashCrashWindowMinutes = 15
) : IRequest<Result>;
