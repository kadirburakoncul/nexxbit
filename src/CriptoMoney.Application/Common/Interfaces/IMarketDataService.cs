using CriptoMoney.Application.Common.Models;

namespace CriptoMoney.Application.Common.Interfaces;

/// <summary>Binance'teki bir USDT paritesi ve 24 saatlik işlem hacmi.</summary>
public record MarketSymbolInfo(
    string Symbol,
    string BaseAsset,
    decimal LastPrice,
    decimal PriceChangePercent,
    /// <summary>24 saatlik USDT cinsinden hacim — listeleme bu değere göre sıralanır.</summary>
    decimal QuoteVolume24h,
    int TradeCount24h);

/// <summary>Dışa aktarma başlamadan önce gösterilen maliyet tahmini.</summary>
public record ExportEstimate(
    int SymbolCount,
    string Timeframe,
    long EstimatedBarsPerSymbol,
    long EstimatedTotalBars,
    long EstimatedFileSizeBytes,
    int EstimatedApiRequests,
    int EstimatedSeconds,
    bool ExceedsLimits,
    string? Warning);

public interface IMarketDataService
{
    /// <summary>Tüm USDT paritelerini 24s hacme göre azalan sırada döndürür (cache'li).</summary>
    Task<Result<List<MarketSymbolInfo>>> GetSymbolsByVolumeAsync(CancellationToken ct = default);

    /// <summary>
    /// Verilen aralıktaki mumları çeker. Binance'in desteklemediği periyotlar
    /// (örn. 45m) daha küçük bir periyottan türetilir.
    /// </summary>
    Task<Result<List<BinanceCandle>>> GetCandlesRangeAsync(
        string symbol, string timeframe, DateTime startUtc, DateTime endUtc, CancellationToken ct = default);

    ExportEstimate Estimate(int symbolCount, string timeframe, DateTime startUtc, DateTime endUtc);
}
