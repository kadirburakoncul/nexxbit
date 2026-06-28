using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.RiskSettings.Commands.UpdateRiskSettings;

public class UpdateRiskSettingsCommandHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateRiskSettingsCommand, Result>
{
    public async Task<Result> Handle(UpdateRiskSettingsCommand request, CancellationToken cancellationToken)
    {
        var r = await db.UserRiskSettings
            .FirstOrDefaultAsync(x => x.UserId == request.UserId, cancellationToken);

        if (r is null)
            return Result.Failure("Risk ayarları bulunamadı.");

        r.TradeMode = request.TradeMode;
        r.IsAutoTradeEnabled = request.IsAutoTradeEnabled;
        r.MaxDailyLossUsdt = request.MaxDailyLossUsdt;
        r.MaxDailyLossPct = request.MaxDailyLossPct;
        r.MaxOpenPositions = request.MaxOpenPositions;
        r.MaxPositionSizeUsdt = request.MaxPositionSizeUsdt;
        r.MaxPositionSizePct = request.MaxPositionSizePct;
        r.DefaultStopLossPct = request.DefaultStopLossPct;
        r.DefaultTakeProfitPct = request.DefaultTakeProfitPct;
        r.IsStopLossRequired = request.IsStopLossRequired;
        r.CloseOnDisconnect = request.CloseOnDisconnect;
        r.FlashCrashProtectionEnabled = request.FlashCrashProtectionEnabled;
        r.FlashCrashDropPct = request.FlashCrashDropPct;
        r.FlashCrashWindowMinutes = request.FlashCrashWindowMinutes;
        r.TelegramEnabled = request.TelegramEnabled;
        r.TelegramBotToken = request.TelegramBotToken;
        r.TelegramChatId = request.TelegramChatId;

        db.UserRiskSettings.Update(r);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
