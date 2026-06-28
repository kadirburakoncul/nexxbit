using CriptoMoney.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CriptoMoney.API.Hubs;

public class BacktestProgressNotifier(IHubContext<BacktestHub> hubContext) : IBacktestProgressNotifier
{
    public Task NotifyProgressAsync(Guid runId, int pct, CancellationToken ct = default)
        => hubContext.Clients.Group($"backtest-{runId}").SendAsync("Progress", new { runId, pct }, ct);

    public Task NotifyDoneAsync(Guid runId, string status, CancellationToken ct = default)
        => hubContext.Clients.Group($"backtest-{runId}").SendAsync("Done", new { runId, status }, ct);
}
