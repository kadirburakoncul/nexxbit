using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.RiskSettings.Queries.GetRiskSettings;

public class GetRiskSettingsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetRiskSettingsQuery, Result<RiskSettingsDto>>
{
    public async Task<Result<RiskSettingsDto>> Handle(
        GetRiskSettingsQuery request, CancellationToken cancellationToken)
    {
        var r = await db.UserRiskSettings
            .FirstOrDefaultAsync(x => x.UserId == request.UserId, cancellationToken);

        if (r is null)
            return Result<RiskSettingsDto>.Failure("Risk ayarları bulunamadı.");

        return Result<RiskSettingsDto>.Success(new RiskSettingsDto(
            r.Id,
            r.TradeMode,
            r.IsAutoTradeEnabled,
            r.MaxDailyLossUsdt,
            r.MaxDailyLossPct,
            r.MaxOpenPositions,
            r.MaxPositionSizeUsdt,
            r.MaxPositionSizePct,
            r.DefaultStopLossPct,
            r.DefaultTakeProfitPct,
            r.IsStopLossRequired,
            r.CloseOnDisconnect,
            r.DailyLossUsedUsdt,
            r.DailyLossResetAt,
            r.FlashCrashProtectionEnabled,
            r.FlashCrashDropPct,
            r.FlashCrashWindowMinutes,
            r.AutoTradePaused,
            r.AutoTradePausedAt,
            ParseIds(r.AllowedCoinIds),
            ParseIds(r.BlockedCoinIds),
            r.TelegramEnabled,
            r.TelegramBotToken,
            r.TelegramChatId));
    }

    private static List<int> ParseIds(string? json) =>
        string.IsNullOrEmpty(json)
            ? []
            : JsonSerializer.Deserialize<List<int>>(json) ?? [];
}
