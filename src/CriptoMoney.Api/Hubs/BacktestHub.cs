using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CriptoMoney.API.Hubs;

[Authorize]
public class BacktestHub : Hub
{
    public Task JoinRun(string runId) => Groups.AddToGroupAsync(Context.ConnectionId, $"backtest-{runId}");
    public Task LeaveRun(string runId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"backtest-{runId}");
}
