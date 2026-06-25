using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.BackgroundJobs.Jobs;
using Hangfire;

namespace CriptoMoney.BackgroundJobs.Services;

public class HangfireBacktestJobScheduler(IBackgroundJobClient jobClient) : IBacktestJobScheduler
{
    public void Enqueue(Guid runId)
        => jobClient.Enqueue<BacktestJob>(j => j.ExecuteAsync(runId, CancellationToken.None));
}
