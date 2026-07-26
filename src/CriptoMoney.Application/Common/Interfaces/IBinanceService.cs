using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Application.Common.Interfaces;

public record BinanceBalance(string Asset, decimal Free, decimal Locked);
public record BinanceCoinInfo(string Symbol, string BaseAsset, string QuoteAsset, bool IsTrading);
public record BinanceCandle(
    DateTime OpenTime, decimal Open, decimal High, decimal Low, decimal Close,
    decimal Volume, DateTime CloseTime, decimal QuoteVolume, int TradeCount, bool IsClosed);

public record MomentumCoin(
    string Symbol,
    string BaseAsset,
    decimal PriceChangePercent,
    decimal LastPrice,
    decimal QuoteVolume,
    decimal HighPrice,
    decimal LowPrice);

public record PlaceOrderResult(
    long BinanceOrderId,
    string ClientOrderId,
    decimal ExecutedQty,
    decimal CummulativeQuoteQty,
    string Status);

/// <summary>
/// Binance sembol işlem kuralları (LOT_SIZE / NOTIONAL filtreleri).
/// SELL miktarı bu kurallara uydurulmazsa emir reddedilir.
/// </summary>
public record SymbolTradeRules(
    string Symbol,
    decimal StepSize,
    decimal MinQuantity,
    decimal MinNotional)
{
    /// <summary>Miktarı stepSize'ın katına AŞAĞI yuvarlar (fazlası bakiyeyi aşar).</summary>
    public decimal RoundQuantityDown(decimal qty)
    {
        if (StepSize <= 0 || qty <= 0) return qty;
        return Math.Floor(qty / StepSize) * StepSize;
    }

    /// <summary>Yuvarlanmış miktar satılabilir mi? (minQty + minNotional kontrolü)</summary>
    public bool IsSellable(decimal qty, decimal price) =>
        qty > 0 && qty >= MinQuantity && qty * price >= MinNotional;
}

public interface IBinanceService
{
    Task<Result> TestConnectionAsync(string apiKey, string apiSecret, bool isTestnet, CancellationToken ct = default);
    Task<Result<List<BinanceBalance>>> GetBalancesAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<BinanceCoinInfo>>> GetUsdtTradingPairsAsync(CancellationToken ct = default);
    Task<Result<List<BinanceCandle>>> GetCandlesAsync(string symbol, string interval, int limit, CancellationToken ct = default);
    Task<Result<List<BinanceCandle>>> GetHistoricalCandlesAsync(string symbol, string interval, DateTime startTime, DateTime endTime, CancellationToken ct = default);

    // Emir gönderme — SADECE Spot Buy/Sell, withdrawal çağrılmaz
    // BUY: qty = USDT miktarı (quoteOrderQty)  |  SELL: qty = coin miktarı (quantity)
    Task<Result<PlaceOrderResult>> PlaceMarketOrderAsync(
        Guid userId, string symbol, OrderSide side, decimal qty, CancellationToken ct = default);
    Task<Result> CancelOrderAsync(Guid userId, string symbol, long binanceOrderId, CancellationToken ct = default);
    Task<decimal> GetUsdtBalanceAsync(Guid userId, CancellationToken ct = default);
    Task<decimal> GetCoinBalanceAsync(Guid userId, string asset, CancellationToken ct = default);

    /// <summary>Sembolün LOT_SIZE/NOTIONAL kurallarını döndürür (cache'li).</summary>
    Task<SymbolTradeRules?> GetSymbolRulesAsync(string symbol, CancellationToken ct = default);

    /// <summary>
    /// Satılabilir gerçek miktarı hesaplar: cüzdan bakiyesi ile sınırlar,
    /// stepSize'a aşağı yuvarlar, minQty/minNotional kontrolü yapar.
    /// Satılamıyorsa 0 döner.
    /// </summary>
    Task<decimal> ResolveSellQuantityAsync(
        Guid userId, string symbol, decimal desiredQty, decimal price, CancellationToken ct = default);
    Task<decimal?> GetCurrentPriceAsync(string symbol, CancellationToken ct = default);
    Task<Dictionary<string, decimal>> GetBulkPricesAsync(IEnumerable<string> symbols, CancellationToken ct = default);
    Task<List<MomentumCoin>> GetTopGainersAsync(decimal minChangePercent = 3m, int limit = 25, CancellationToken ct = default);
}
