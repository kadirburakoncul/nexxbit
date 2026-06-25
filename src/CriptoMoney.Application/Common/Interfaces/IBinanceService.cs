using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Application.Common.Interfaces;

public record BinanceBalance(string Asset, decimal Free, decimal Locked);
public record BinanceCoinInfo(string Symbol, string BaseAsset, string QuoteAsset, bool IsTrading);
public record BinanceCandle(
    DateTime OpenTime, decimal Open, decimal High, decimal Low, decimal Close,
    decimal Volume, DateTime CloseTime, decimal QuoteVolume, int TradeCount, bool IsClosed);

public record PlaceOrderResult(
    long BinanceOrderId,
    string ClientOrderId,
    decimal ExecutedQty,
    decimal CummulativeQuoteQty,
    string Status);

public interface IBinanceService
{
    Task<Result> TestConnectionAsync(string apiKey, string apiSecret, bool isTestnet, CancellationToken ct = default);
    Task<Result<List<BinanceBalance>>> GetBalancesAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<BinanceCoinInfo>>> GetUsdtTradingPairsAsync(CancellationToken ct = default);
    Task<Result<List<BinanceCandle>>> GetCandlesAsync(string symbol, string interval, int limit, CancellationToken ct = default);
    Task<Result<List<BinanceCandle>>> GetHistoricalCandlesAsync(string symbol, string interval, DateTime startTime, DateTime endTime, CancellationToken ct = default);

    // Emir gönderme — SADECE Spot Buy/Sell, withdrawal çağrılmaz
    Task<Result<PlaceOrderResult>> PlaceMarketOrderAsync(
        Guid userId, string symbol, OrderSide side, decimal quoteQty, CancellationToken ct = default);
    Task<Result> CancelOrderAsync(Guid userId, string symbol, long binanceOrderId, CancellationToken ct = default);
    Task<decimal> GetUsdtBalanceAsync(Guid userId, CancellationToken ct = default);
    Task<decimal?> GetCurrentPriceAsync(string symbol, CancellationToken ct = default);
}
