using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.BackgroundJobs.Jobs;
using Hangfire;

namespace CriptoMoney.BackgroundJobs.Services;

public class HangfireMarketDataJobScheduler(IBackgroundJobClient jobClient) : IMarketDataJobScheduler
{
    public void EnqueueExport(Guid exportId)
        => jobClient.Enqueue<MarketDataExportJob>(j => j.ExecuteAsync(exportId, CancellationToken.None));

    public void EnqueueOptimization(Guid optimizationId)
        => jobClient.Enqueue<IndicatorOptimizationJob>(j => j.ExecuteAsync(optimizationId, CancellationToken.None));
}
