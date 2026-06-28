namespace CriptoMoney.Application.Common.Interfaces;

public interface IBacktestProgressNotifier
{
    Task NotifyProgressAsync(Guid runId, int pct, CancellationToken ct = default);
    Task NotifyDoneAsync(Guid runId, string status, CancellationToken ct = default);
}
