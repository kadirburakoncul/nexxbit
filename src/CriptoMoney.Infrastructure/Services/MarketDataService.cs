using Binance.Net.Enums;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Toplu piyasa verisi çekme. Binance tek istekte en fazla 1000 bar döndürdüğü için
/// uzun aralıklar sayfalanarak alınır; istekler arasında bekleme ile rate limit korunur.
/// </summary>
public class MarketDataService(ILogger<MarketDataService> logger) : IMarketDataService
{
    private const int MaxBarsPerRequest = 1000;

    /// <summary>
    /// İstekler arası bekleme. Binance spot limiti dakikada 1200 ağırlık; klines
    /// isteği 1000 bar için 2 ağırlık. 120ms ≈ saniyede 8 istek ≈ dakikada 960 ağırlık —
    /// diğer servislerin (fiyat, bakiye) payı için tampon bırakır.
    /// </summary>
    private static readonly TimeSpan RequestDelay = TimeSpan.FromMilliseconds(120);

    private static readonly SemaphoreSlim SymbolCacheLock = new(1, 1);
    private static List<MarketSymbolInfo>? _symbolCache;
    private static DateTime _symbolCachedAt = DateTime.MinValue;
    private static readonly TimeSpan SymbolCacheTtl = TimeSpan.FromMinutes(10);

    // ─── Guardrail'ler ───────────────────────────────────────────────────────────
    // Sınırsız seçim gerçekçi değil: 400 coin x 1 yıl x 15dk yaklaşık 14 milyon bar,
    // ~14.000 API isteği ve 1 GB üzeri dosya demek. Kullanıcıyı isteğin boyutundan
    // haberdar etmek için tahmin üretip bu eşikleri aşınca uyarıyoruz.
    public const int MaxSymbols = 150;
    public const long MaxTotalBars = 5_000_000;

    public async Task<Result<List<MarketSymbolInfo>>> GetSymbolsByVolumeAsync(CancellationToken ct = default)
    {
        if (_symbolCache is not null && DateTime.UtcNow - _symbolCachedAt < SymbolCacheTtl)
            return Result<List<MarketSymbolInfo>>.Success(_symbolCache);

        await SymbolCacheLock.WaitAsync(ct);
        try
        {
            if (_symbolCache is not null && DateTime.UtcNow - _symbolCachedAt < SymbolCacheTtl)
                return Result<List<MarketSymbolInfo>>.Success(_symbolCache);

            using var client = BinanceClientFactory.CreatePublicRest();

            var tickers = await client.SpotApi.ExchangeData.GetTickersAsync(ct: ct);
            if (!tickers.Success)
                return Result<List<MarketSymbolInfo>>.Failure(tickers.Error?.Message ?? "Ticker verisi alınamadı.");

            // Sadece aktif spot USDT pariteleri. Kaldıraçlı token'lar (UP/DOWN/BULL/BEAR)
            // normal coin gibi davranmadığı için analiz dışı bırakılır.
            var exchangeInfo = await client.SpotApi.ExchangeData.GetExchangeInfoAsync(ct: ct);
            var tradable = exchangeInfo.Success
                ? exchangeInfo.Data.Symbols
                    .Where(s => s.QuoteAsset == "USDT" && s.Status == SymbolStatus.Trading && s.IsSpotTradingAllowed)
                    .Select(s => s.Name)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase)
                : null;

            var list = tickers.Data
                .Where(t => t.Symbol.EndsWith("USDT", StringComparison.OrdinalIgnoreCase))
                .Where(t => tradable is null || tradable.Contains(t.Symbol))
                .Where(t => !IsLeveragedToken(t.Symbol))
                .Select(t => new MarketSymbolInfo(
                    t.Symbol,
                    t.Symbol[..^4],
                    t.LastPrice,
                    Math.Round(t.PriceChangePercent, 2),
                    Math.Round(t.QuoteVolume, 0),
                    (int)t.TotalTrades))
                .OrderByDescending(s => s.QuoteVolume24h)
                .ToList();

            _symbolCache = list;
            _symbolCachedAt = DateTime.UtcNow;
            logger.LogInformation("Piyasa sembol listesi yenilendi: {Count} USDT paritesi", list.Count);

            return Result<List<MarketSymbolInfo>>.Success(list);
        }
        finally
        {
            SymbolCacheLock.Release();
        }
    }

    private static bool IsLeveragedToken(string symbol)
    {
        var baseAsset = symbol[..^4];
        return baseAsset.EndsWith("UP") || baseAsset.EndsWith("DOWN")
            || baseAsset.EndsWith("BULL") || baseAsset.EndsWith("BEAR");
    }

    public ExportEstimate Estimate(int symbolCount, string timeframe, DateTime startUtc, DateTime endUtc)
    {
        var spec = TimeframeHelper.Get(timeframe);
        if (spec is null)
            return new ExportEstimate(symbolCount, timeframe, 0, 0, 0, 0, 0, true, $"Desteklenmeyen periyot: {timeframe}");

        // 45m gibi türetilen periyotlarda kaynak bar sayısı daha fazladır.
        // API maliyeti hedef bar sayısına değil, çekilen kaynak barlara göre oluşur.
        var targetBars = TimeframeHelper.EstimateBarCount(timeframe, startUtc, endUtc);
        var sourceBars = targetBars * spec.AggregateCount;

        var totalTarget = targetBars * symbolCount;
        var requestsPerSymbol = (int)Math.Ceiling(sourceBars / (double)MaxBarsPerRequest);
        var totalRequests = Math.Max(1, requestsPerSymbol) * symbolCount;

        // CSV satırı yaklaşık 150 bayt (indikatör kolonlarıyla birlikte)
        var bytes = totalTarget * 150;
        var seconds = (int)(totalRequests * RequestDelay.TotalSeconds) + symbolCount / 2;

        string? warning = null;
        var exceeds = false;

        if (symbolCount > MaxSymbols)
        {
            exceeds = true;
            warning = $"En fazla {MaxSymbols} sembol seçilebilir (seçilen: {symbolCount}). Hacme göre ilk {MaxSymbols} coin piyasanın büyük kısmını zaten kapsar.";
        }
        else if (totalTarget > MaxTotalBars)
        {
            exceeds = true;
            warning = $"Tahmini {totalTarget:N0} satır, üst sınır {MaxTotalBars:N0}. Tarih aralığını daraltın, daha uzun bir periyot seçin veya daha az coin işaretleyin.";
        }
        else if (seconds > 900)
        {
            warning = $"Bu dışa aktarma yaklaşık {seconds / 60} dakika sürecek. Arka planda çalışır, sayfadan ayrılabilirsiniz.";
        }

        return new ExportEstimate(
            symbolCount, timeframe, targetBars, totalTarget, bytes, totalRequests, seconds, exceeds, warning);
    }

    public async Task<Result<List<BinanceCandle>>> GetCandlesRangeAsync(
        string symbol, string timeframe, DateTime startUtc, DateTime endUtc, CancellationToken ct = default)
    {
        var spec = TimeframeHelper.Get(timeframe);
        if (spec is null)
            return Result<List<BinanceCandle>>.Failure($"Desteklenmeyen periyot: {timeframe}");

        if (!TryParseInterval(spec.SourceInterval, out var klineInterval))
            return Result<List<BinanceCandle>>.Failure($"Binance periyodu çözümlenemedi: {spec.SourceInterval}");

        using var client = BinanceClientFactory.CreatePublicRest();

        var all = new List<BinanceCandle>();
        var cursor = startUtc;

        while (cursor < endUtc)
        {
            ct.ThrowIfCancellationRequested();

            var result = await client.SpotApi.ExchangeData.GetKlinesAsync(
                symbol, klineInterval, startTime: cursor, endTime: endUtc,
                limit: MaxBarsPerRequest, ct: ct);

            if (!result.Success)
            {
                // Rate limit veya geçici ağ hatasında bir kez daha dene
                logger.LogWarning("Kline isteği başarısız: {Symbol} {Error} - tekrar deneniyor", symbol, result.Error?.Message);
                await Task.Delay(TimeSpan.FromSeconds(3), ct);

                result = await client.SpotApi.ExchangeData.GetKlinesAsync(
                    symbol, klineInterval, startTime: cursor, endTime: endUtc,
                    limit: MaxBarsPerRequest, ct: ct);

                if (!result.Success)
                    return Result<List<BinanceCandle>>.Failure(
                        $"{symbol}: {result.Error?.Message ?? "veri alınamadı"}");
            }

            var batch = result.Data.ToList();
            if (batch.Count == 0) break;

            all.AddRange(batch.Select(k => new BinanceCandle(
                k.OpenTime, k.OpenPrice, k.HighPrice, k.LowPrice, k.ClosePrice,
                k.Volume, k.CloseTime, k.QuoteVolume, (int)k.TradeCount, true)));

            // Son barın kapanışından devam et; aynı barı iki kez almamak için +1ms
            var next = batch[^1].CloseTime.AddMilliseconds(1);
            if (next <= cursor) break;                  // ilerleme yoksa sonsuz döngüyü kes
            cursor = next;

            if (batch.Count < MaxBarsPerRequest) break; // veri bitti

            await Task.Delay(RequestDelay, ct);
        }

        // Devam eden (kapanmamış) son barı at - yarım bar yanıltıcıdır
        var cutoff = DateTime.UtcNow - spec.Duration;
        var closed = all.Where(c => c.OpenTime <= cutoff).ToList();

        var aggregated = TimeframeHelper.Aggregate(closed, spec);
        return Result<List<BinanceCandle>>.Success(aggregated);
    }

    private static bool TryParseInterval(string interval, out KlineInterval result)
    {
        result = interval switch
        {
            "1m"  => KlineInterval.OneMinute,
            "3m"  => KlineInterval.ThreeMinutes,
            "5m"  => KlineInterval.FiveMinutes,
            "15m" => KlineInterval.FifteenMinutes,
            "30m" => KlineInterval.ThirtyMinutes,
            "1h"  => KlineInterval.OneHour,
            "2h"  => KlineInterval.TwoHour,
            "4h"  => KlineInterval.FourHour,
            "6h"  => KlineInterval.SixHour,
            "8h"  => KlineInterval.EightHour,
            "12h" => KlineInterval.TwelveHour,
            "1d"  => KlineInterval.OneDay,
            "3d"  => KlineInterval.ThreeDay,
            "1w"  => KlineInterval.OneWeek,
            "1M"  => KlineInterval.OneMonth,
            _     => KlineInterval.OneHour,
        };
        return interval is "1m" or "3m" or "5m" or "15m" or "30m" or "1h" or "2h" or "4h"
            or "6h" or "8h" or "12h" or "1d" or "3d" or "1w" or "1M";
    }
}
