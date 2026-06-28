using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Infrastructure.Indicators;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// BTC/USDT günlük EMA200'e bakarak bull/bear rejimini tespit eder.
/// Singleton — sonuç 15 dakika cache'lenir, her CheckAsync çağrısında yenilenir.
/// </summary>
public class MarketRegimeService(
    IServiceScopeFactory scopeFactory,
    ILogger<MarketRegimeService> logger)
{
    private volatile bool _isBull = true;
    private DateTime _lastUpdated = DateTime.MinValue;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(15);
    private readonly SemaphoreSlim _lock = new(1, 1);

    public bool IsBullMarket => _isBull;

    public async Task<bool> GetMarketRegimeAsync(CancellationToken ct = default)
    {
        if (DateTime.UtcNow - _lastUpdated < CacheTtl)
            return _isBull;

        if (!await _lock.WaitAsync(0, ct)) // başkası zaten yeniliyorsa beklemeden eski değeri dön
            return _isBull;

        try
        {
            if (DateTime.UtcNow - _lastUpdated < CacheTtl) // double-check
                return _isBull;

            using var scope = scopeFactory.CreateScope();
            var binance = scope.ServiceProvider.GetRequiredService<IBinanceService>();

            var candleResult = await binance.GetCandlesAsync("BTCUSDT", "1d", 210, ct);
            if (!candleResult.Succeeded || candleResult.Data is null || candleResult.Data.Count < 202)
            {
                logger.LogWarning("MarketRegimeService: BTC mum verisi alınamadı, bull kabul ediliyor.");
                return _isBull;
            }

            var closes = candleResult.Data.Select(c => c.Close).ToArray();
            var ema200 = TechnicalUtils.ComputeEma(closes, 200);

            // Son kapanmış bar [^2] (^1 henüz açık)
            var lastClose = closes[^2];
            var lastEma   = ema200[^2];

            var wasBull = _isBull;
            _isBull = lastClose > lastEma;
            _lastUpdated = DateTime.UtcNow;

            if (wasBull != _isBull)
                logger.LogWarning("Piyasa rejimi değişti: {Old} → {New}. BTC={Price:F0} EMA200={EMA:F0}",
                    wasBull ? "BULL" : "BEAR", _isBull ? "BULL" : "BEAR", lastClose, lastEma);
            else
                logger.LogDebug("Piyasa rejimi: {Regime} BTC={Price:F0} EMA200={EMA:F0}",
                    _isBull ? "BULL" : "BEAR", lastClose, lastEma);

            return _isBull;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "MarketRegimeService güncelleme hatası.");
            return _isBull;
        }
        finally
        {
            _lock.Release();
        }
    }
}
