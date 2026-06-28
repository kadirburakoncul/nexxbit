using CriptoMoney.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.BackgroundJobs.Jobs;

public class BacktestJob(
    IApplicationDbContext db,
    IBacktestEngine backtestEngine,
    IBacktestProgressNotifier notifier,
    ILogger<BacktestJob> logger)
{
    public async Task ExecuteAsync(Guid runId, CancellationToken ct = default)
    {
        var run = await db.BacktestRuns.FirstOrDefaultAsync(r => r.Id == runId, ct);
        if (run is null)
        {
            logger.LogWarning("BacktestJob: RunId bulunamadı: {RunId}", runId);
            return;
        }

        logger.LogInformation("Backtest başlıyor: {RunId} {Name}", runId, run.Name);

        await backtestEngine.RunAsync(run, ct, async pct =>
        {
            try { await notifier.NotifyProgressAsync(runId, pct, ct); }
            catch { /* SignalR hatası backtest'i durdurmasın */ }
        });

        try { await notifier.NotifyDoneAsync(runId, run.Status.ToString(), ct); }
        catch { }

        logger.LogInformation("Backtest bitti: {RunId} Status={Status}", runId, run.Status);
    }
}
