using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IBacktestEngine
{
    /// <summary>
    /// BacktestRun'ı alır, tarihsel candle verisini çekip simülasyonu çalıştırır,
    /// sonuçları BacktestRun ve BacktestTrade kayıtlarına yazar.
    /// </summary>
    Task RunAsync(BacktestRun run, CancellationToken ct = default);
}
