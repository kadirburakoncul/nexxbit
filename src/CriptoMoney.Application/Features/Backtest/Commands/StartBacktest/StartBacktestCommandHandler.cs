using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Backtest.Commands.StartBacktest;

public class StartBacktestCommandHandler(
    IApplicationDbContext db,
    IBacktestJobScheduler jobScheduler) : IRequestHandler<StartBacktestCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(
        StartBacktestCommand request, CancellationToken cancellationToken)
    {
        if (request.EndDate <= request.StartDate)
            return Result<Guid>.Failure("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.");

        if (request.InitialCapital <= 0)
            return Result<Guid>.Failure("Başlangıç sermayesi 0'dan büyük olmalıdır.");

        if (request.CoinIds.Count == 0)
            return Result<Guid>.Failure("En az bir coin seçilmelidir.");

        var run = new BacktestRun
        {
            UserId = request.UserId,
            Name = request.Name ?? $"Backtest {DateTime.UtcNow:yyyy-MM-dd HH:mm}",
            CoinIds = JsonSerializer.Serialize(request.CoinIds),
            Timeframe = request.Timeframe,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            InitialCapital = request.InitialCapital,
            CommissionRate = request.CommissionRate,
            SlippagePct = request.SlippagePct,
            StopLossPct = request.StopLossPct,
            TakeProfitPct = request.TakeProfitPct,
            StrategyConfig = request.StrategyConfig,
            Status = BacktestStatus.Pending,
        };

        db.BacktestRuns.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        // Otomatik temizleme: 30 günden eski backtestleri sil
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var expired = await db.BacktestRuns
            .Where(r => r.UserId == request.UserId && r.CreatedAt < cutoff)
            .ToListAsync(cancellationToken);
        if (expired.Count > 0) db.BacktestRuns.RemoveRange(expired);

        // Max 10 backtest limiti: fazlaları en eskiden sil
        var overflow = await db.BacktestRuns
            .Where(r => r.UserId == request.UserId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip(10)
            .ToListAsync(cancellationToken);
        if (overflow.Count > 0) db.BacktestRuns.RemoveRange(overflow);

        if (expired.Count > 0 || overflow.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        // Hangfire job kuyruğuna ekle — scoped servis güvenliği için BacktestJob içinde çalışır
        jobScheduler.Enqueue(run.Id);

        return Result<Guid>.Success(run.Id);
    }
}
