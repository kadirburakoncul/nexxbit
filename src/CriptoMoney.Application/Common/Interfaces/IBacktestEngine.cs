using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IBacktestEngine
{
    /// <summary>
    /// BacktestRun'ı alır, tarihsel candle verisini çekip simülasyonu çalıştırır,
    /// sonuçları BacktestRun ve BacktestTrade kayıtlarına yazar.
    /// onProgress(pct): 0-100 arasında ilerleme bildirimi (opsiyonel).
    /// </summary>
    Task RunAsync(BacktestRun run, CancellationToken ct = default, Func<int, Task>? onProgress = null);
}
