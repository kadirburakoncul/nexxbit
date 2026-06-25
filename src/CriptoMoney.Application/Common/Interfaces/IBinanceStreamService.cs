namespace CriptoMoney.Application.Common.Interfaces;

public interface IBinanceStreamService
{
    Task SubscribeAsync(string symbol, string interval, CancellationToken ct = default);
    Task UnsubscribeAsync(string symbol, string interval, CancellationToken ct = default);
    Task UnsubscribeAllAsync(CancellationToken ct = default);
}
