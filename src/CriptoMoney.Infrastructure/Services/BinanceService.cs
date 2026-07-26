using Binance.Net.Enums;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrderSide = CriptoMoney.Domain.Enums.OrderSide;

namespace CriptoMoney.Infrastructure.Services;

public class BinanceService(
    IApplicationDbContext dbContext,
    IEncryptionService encryption,
    ILogger<BinanceService> logger) : IBinanceService
{
    public async Task<Result> TestConnectionAsync(
        string apiKey, string apiSecret, bool isTestnet, CancellationToken ct = default)
    {
        using var client = BinanceClientFactory.CreateRest(apiKey, apiSecret, isTestnet);
        var result = await client.SpotApi.Account.GetAccountInfoAsync(ct: ct);

        if (!result.Success)
        {
            logger.LogWarning("Binance bağlantı testi başarısız: {Error}", result.Error?.Message);
            return Result.Failure(result.Error?.Message ?? "Binance bağlantısı kurulamadı.");
        }

        // Withdrawal yetkisi kesinlikle kullanılmıyor — sadece okuma + işlem yetkisi yeterli
        var permissions = result.Data.Permissions;
        if (permissions.Contains(AccountType.Margin))
            logger.LogInformation("Kullanıcı margin hesabına sahip (sadece spot işlem yapılacak)");

        return Result.Success();
    }

    public async Task<Result<List<BinanceBalance>>> GetBalancesAsync(
        Guid userId, CancellationToken ct = default)
    {
        var (client, error) = await GetAuthenticatedClientAsync(userId, ct);
        if (client is null)
            return Result<List<BinanceBalance>>.Failure(error!);

        using (client)
        {
            var result = await client.SpotApi.Account.GetAccountInfoAsync(ct: ct);
            if (!result.Success)
            {
                logger.LogWarning("Bakiye alınamadı: {Error}", result.Error?.Message);
                return Result<List<BinanceBalance>>.Failure(result.Error?.Message ?? "Bakiye alınamadı.");
            }

            var allBalances = result.Data.Balances?.ToList() ?? [];
            logger.LogInformation("Binance bakiye sayısı: {Count}, Ham: {Raw}",
                allBalances.Count,
                string.Join(", ", allBalances.Take(10).Select(b => $"{b.Asset}={b.Available}+{b.Locked}")));

            var balances = allBalances
                .Select(b => new BinanceBalance(b.Asset, b.Available, b.Locked))
                .ToList();

            return Result<List<BinanceBalance>>.Success(balances);
        }
    }

    public async Task<Result<List<BinanceCoinInfo>>> GetUsdtTradingPairsAsync(CancellationToken ct = default)
    {
        using var client = BinanceClientFactory.CreatePublicRest();
        var result = await client.SpotApi.ExchangeData.GetExchangeInfoAsync(ct: ct);

        if (!result.Success)
            return Result<List<BinanceCoinInfo>>.Failure(result.Error?.Message ?? "Coin listesi alınamadı.");

        var pairs = result.Data.Symbols
            .Where(s => s.QuoteAsset == "USDT"
                        && s.Status == SymbolStatus.Trading
                        && s.IsSpotTradingAllowed)
            .Select(s => new BinanceCoinInfo(s.Name, s.BaseAsset, s.QuoteAsset, true))
            .OrderBy(s => s.Symbol)
            .ToList();

        return Result<List<BinanceCoinInfo>>.Success(pairs);
    }

    public async Task<Result<List<BinanceCandle>>> GetCandlesAsync(
        string symbol, string interval, int limit, CancellationToken ct = default)
    {
        if (!TryParseInterval(interval, out var klineInterval))
            return Result<List<BinanceCandle>>.Failure($"Geçersiz timeframe: {interval}");

        using var client = BinanceClientFactory.CreatePublicRest();
        var result = await client.SpotApi.ExchangeData.GetKlinesAsync(symbol, klineInterval, limit: limit, ct: ct);

        if (!result.Success)
            return Result<List<BinanceCandle>>.Failure(result.Error?.Message ?? "Candle verisi alınamadı.");

        var candles = result.Data
            .Select(k => new BinanceCandle(
                k.OpenTime, k.OpenPrice, k.HighPrice, k.LowPrice, k.ClosePrice,
                k.Volume, k.CloseTime, k.QuoteVolume, (int)k.TradeCount, true))
            .ToList();

        return Result<List<BinanceCandle>>.Success(candles);
    }

    public async Task<Result<List<BinanceCandle>>> GetHistoricalCandlesAsync(
        string symbol, string interval, DateTime startTime, DateTime endTime, CancellationToken ct = default)
    {
        if (!TryParseInterval(interval, out var klineInterval))
            return Result<List<BinanceCandle>>.Failure($"Geçersiz timeframe: {interval}");

        using var client = BinanceClientFactory.CreatePublicRest();
        var allCandles = new List<BinanceCandle>();
        var batchStart = startTime;
        const int batchSize = 1000;

        while (batchStart < endTime)
        {
            ct.ThrowIfCancellationRequested();

            var result = await client.SpotApi.ExchangeData.GetKlinesAsync(
                symbol, klineInterval,
                startTime: batchStart, endTime: endTime,
                limit: batchSize, ct: ct);

            if (!result.Success)
                return Result<List<BinanceCandle>>.Failure(result.Error?.Message ?? "Tarihsel veri alınamadı.");

            var batch = result.Data.ToList();
            if (batch.Count == 0) break;

            allCandles.AddRange(batch.Select(k => new BinanceCandle(
                k.OpenTime, k.OpenPrice, k.HighPrice, k.LowPrice, k.ClosePrice,
                k.Volume, k.CloseTime, k.QuoteVolume, (int)k.TradeCount, true)));

            batchStart = batch[^1].CloseTime.AddMilliseconds(1);
            if (batch.Count < batchSize) break;

            await Task.Delay(100, ct); // Binance rate limit'e saygı
        }

        return Result<List<BinanceCandle>>.Success(allCandles);
    }

    public async Task<Result<PlaceOrderResult>> PlaceMarketOrderAsync(
        Guid userId, string symbol, OrderSide side, decimal qty, CancellationToken ct = default)
    {
        var (client, error) = await GetAuthenticatedClientAsync(userId, ct);
        if (client is null)
            return Result<PlaceOrderResult>.Failure(error!);

        using (client)
        {
            var binanceSide = side == OrderSide.Buy ? Binance.Net.Enums.OrderSide.Buy : Binance.Net.Enums.OrderSide.Sell;

            // BUY: quoteOrderQty = USDT miktarı harca
            // SELL: quantity = satılacak coin miktarı
            var result = side == OrderSide.Buy
                ? await client.SpotApi.Trading.PlaceOrderAsync(
                    symbol, binanceSide, SpotOrderType.Market,
                    quoteQuantity: qty, ct: ct)
                : await client.SpotApi.Trading.PlaceOrderAsync(
                    symbol, binanceSide, SpotOrderType.Market,
                    quantity: qty, ct: ct);

            if (!result.Success)
            {
                logger.LogError("Emir gönderilemedi: {Symbol} {Side} {Error}", symbol, side, result.Error?.Message);
                return Result<PlaceOrderResult>.Failure(result.Error?.Message ?? "Emir gönderilemedi.");
            }

            return Result<PlaceOrderResult>.Success(new PlaceOrderResult(
                result.Data.Id,
                result.Data.ClientOrderId,
                result.Data.QuantityFilled,
                result.Data.QuoteQuantityFilled,
                result.Data.Status.ToString()));
        }
    }

    public async Task<Result> CancelOrderAsync(
        Guid userId, string symbol, long binanceOrderId, CancellationToken ct = default)
    {
        var (client, error) = await GetAuthenticatedClientAsync(userId, ct);
        if (client is null)
            return Result.Failure(error!);

        using (client)
        {
            var result = await client.SpotApi.Trading.CancelOrderAsync(symbol, binanceOrderId, ct: ct);
            return result.Success ? Result.Success() : Result.Failure(result.Error?.Message ?? "İptal başarısız.");
        }
    }

    public async Task<decimal> GetUsdtBalanceAsync(Guid userId, CancellationToken ct = default)
    {
        var (client, _) = await GetAuthenticatedClientAsync(userId, ct);
        if (client is null) return 0;

        using (client)
        {
            var result = await client.SpotApi.Account.GetAccountInfoAsync(ct: ct);
            if (!result.Success) return 0;
            return result.Data.Balances.FirstOrDefault(b => b.Asset == "USDT")?.Available ?? 0;
        }
    }

    public async Task<decimal> GetCoinBalanceAsync(Guid userId, string asset, CancellationToken ct = default)
    {
        var (client, _) = await GetAuthenticatedClientAsync(userId, ct);
        if (client is null) return 0;

        using (client)
        {
            var result = await client.SpotApi.Account.GetAccountInfoAsync(ct: ct);
            if (!result.Success) return 0;
            return result.Data.Balances.FirstOrDefault(b => b.Asset == asset)?.Available ?? 0;
        }
    }

    // ─── Sembol işlem kuralları (LOT_SIZE / NOTIONAL) ────────────────────────────
    // Exchange info nadiren değişir; 6 saatlik cache ile her emirde API çağrısı yapılmaz.
    private static readonly SemaphoreSlim _rulesLock = new(1, 1);
    private static Dictionary<string, SymbolTradeRules>? _rulesCache;
    private static DateTime _rulesCachedAt = DateTime.MinValue;
    private static readonly TimeSpan RulesTtl = TimeSpan.FromHours(6);

    public async Task<SymbolTradeRules?> GetSymbolRulesAsync(string symbol, CancellationToken ct = default)
    {
        var cache = await GetRulesCacheAsync(ct);
        return cache is not null && cache.TryGetValue(symbol, out var rules) ? rules : null;
    }

    private async Task<Dictionary<string, SymbolTradeRules>?> GetRulesCacheAsync(CancellationToken ct)
    {
        if (_rulesCache is not null && DateTime.UtcNow - _rulesCachedAt < RulesTtl)
            return _rulesCache;

        await _rulesLock.WaitAsync(ct);
        try
        {
            // Bekleme sırasında başka thread doldurmuş olabilir
            if (_rulesCache is not null && DateTime.UtcNow - _rulesCachedAt < RulesTtl)
                return _rulesCache;

            using var client = BinanceClientFactory.CreatePublicRest();
            var result = await client.SpotApi.ExchangeData.GetExchangeInfoAsync(ct: ct);
            if (!result.Success)
            {
                logger.LogWarning("Exchange info alınamadı: {Error}", result.Error?.Message);
                return _rulesCache; // eski cache varsa onu kullan
            }

            var map = new Dictionary<string, SymbolTradeRules>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in result.Data.Symbols)
            {
                var lot = s.LotSizeFilter;
                var notional = s.NotionalFilter;
                map[s.Name] = new SymbolTradeRules(
                    s.Name,
                    lot?.StepSize ?? 0m,
                    lot?.MinQuantity ?? 0m,
                    notional?.MinNotional ?? s.MinNotionalFilter?.MinNotional ?? 0m);
            }

            _rulesCache = map;
            _rulesCachedAt = DateTime.UtcNow;
            logger.LogInformation("Sembol işlem kuralları yüklendi: {Count} sembol", map.Count);
            return _rulesCache;
        }
        finally
        {
            _rulesLock.Release();
        }
    }

    public async Task<decimal> ResolveSellQuantityAsync(
        Guid userId, string symbol, decimal desiredQty, decimal price, CancellationToken ct = default)
    {
        var baseAsset = ExtractBaseAsset(symbol);
        var walletQty = await GetCoinBalanceAsync(userId, baseAsset, ct);

        // Cüzdanda olandan fazlasını satamayız (komisyon nedeniyle alınan miktardan az olur)
        var qty = desiredQty > 0 ? Math.Min(desiredQty, walletQty) : walletQty;
        if (qty <= 0)
        {
            logger.LogWarning("Satış iptal: {Symbol} cüzdan bakiyesi yok (istenen={Want}, cüzdan={Have})",
                symbol, desiredQty, walletQty);
            return 0;
        }

        var rules = await GetSymbolRulesAsync(symbol, ct);
        if (rules is null)
        {
            logger.LogWarning("{Symbol} için işlem kuralı bulunamadı — ham miktar kullanılıyor", symbol);
            return qty;
        }

        var adjusted = rules.RoundQuantityDown(qty);
        if (!rules.IsSellable(adjusted, price))
        {
            logger.LogWarning(
                "Satış iptal: {Symbol} miktar kurallara uymuyor. qty={Qty} → {Adj} (step={Step} minQty={MinQ} minNotional={MinN} değer={Val:F2})",
                symbol, qty, adjusted, rules.StepSize, rules.MinQuantity, rules.MinNotional, adjusted * price);
            return 0;
        }

        return adjusted;
    }

    /// <summary>USDT/BTC/ETH/BNB/FDUSD/TRY quote'larını ayıklayarak base asset'i döndürür.</summary>
    private static string ExtractBaseAsset(string symbol)
    {
        foreach (var quote in new[] { "USDT", "FDUSD", "TUSD", "BUSD", "USDC", "TRY", "BTC", "ETH", "BNB" })
            if (symbol.EndsWith(quote, StringComparison.OrdinalIgnoreCase))
                return symbol[..^quote.Length];
        return symbol;
    }

    public async Task<decimal?> GetCurrentPriceAsync(string symbol, CancellationToken ct = default)
    {
        using var client = BinanceClientFactory.CreatePublicRest();
        var result = await client.SpotApi.ExchangeData.GetPriceAsync(symbol, ct: ct);
        if (!result.Success) return null;
        return result.Data.Price;
    }

    public async Task<Dictionary<string, decimal>> GetBulkPricesAsync(
        IEnumerable<string> symbols, CancellationToken ct = default)
    {
        var symbolList = symbols.ToList();
        if (symbolList.Count == 0) return new Dictionary<string, decimal>();
        try
        {
            using var client = BinanceClientFactory.CreatePublicRest();
            var result = await client.SpotApi.ExchangeData.GetPricesAsync(symbolList, ct: ct);
            if (!result.Success) return new Dictionary<string, decimal>();
            return result.Data.ToDictionary(p => p.Symbol, p => p.Price);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GetBulkPricesAsync hatası — fallback single-call");
            var prices = new Dictionary<string, decimal>();
            foreach (var sym in symbolList)
            {
                var p = await GetCurrentPriceAsync(sym, ct);
                if (p.HasValue) prices[sym] = p.Value;
            }
            return prices;
        }
    }

    public async Task<List<MomentumCoin>> GetTopGainersAsync(
        decimal minChangePercent = 3m, int limit = 25, CancellationToken ct = default)
    {
        try
        {
            using var client = BinanceClientFactory.CreatePublicRest();
            var result = await client.SpotApi.ExchangeData.GetTickersAsync(ct: ct);
            if (!result.Success)
            {
                logger.LogWarning("GetTopGainersAsync başarısız: {Error}", result.Error?.Message);
                return [];
            }

            return result.Data
                .Where(t => t.Symbol.EndsWith("USDT")
                         && t.PriceChangePercent >= minChangePercent
                         && t.QuoteVolume >= 1_000_000m)
                .OrderByDescending(t => t.PriceChangePercent)
                .Take(limit)
                .Select(t => new MomentumCoin(
                    t.Symbol,
                    t.Symbol[..^4], // "BTCUSDT" → "BTC"
                    Math.Round(t.PriceChangePercent, 2),
                    t.LastPrice,
                    Math.Round(t.QuoteVolume, 0),
                    t.HighPrice,
                    t.LowPrice))
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GetTopGainersAsync exception");
            return [];
        }
    }

    private async Task<(Binance.Net.Clients.BinanceRestClient? client, string? error)> GetAuthenticatedClientAsync(
        Guid userId, CancellationToken ct)
    {
        var account = await dbContext.UserBinanceAccounts
            .FirstOrDefaultAsync(a => a.UserId == userId, ct);

        if (account is null)
            return (null, "Bu kullanıcıya ait Binance API anahtarı bulunamadı.");

        try
        {
            var apiKey = encryption.Decrypt(account.ApiKeyEncrypted);
            var apiSecret = encryption.Decrypt(account.ApiSecretEncrypted);
            return (BinanceClientFactory.CreateRest(apiKey, apiSecret, account.IsTestnet), null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "API anahtarı çözme hatası, UserId={UserId}", userId);
            return (null, "API anahtarı okunamadı.");
        }
    }

    private static bool TryParseInterval(string interval, out KlineInterval result)
    {
        result = interval switch
        {
            "1m" => KlineInterval.OneMinute,
            "3m" => KlineInterval.ThreeMinutes,
            "5m" => KlineInterval.FiveMinutes,
            "15m" => KlineInterval.FifteenMinutes,
            "30m" => KlineInterval.ThirtyMinutes,
            "1h" => KlineInterval.OneHour,
            "2h" => KlineInterval.TwoHour,
            "4h" => KlineInterval.FourHour,
            "6h" => KlineInterval.SixHour,
            "8h" => KlineInterval.EightHour,
            "12h" => KlineInterval.TwelveHour,
            "1d" => KlineInterval.OneDay,
            "3d" => KlineInterval.ThreeDay,
            "1w" => KlineInterval.OneWeek,
            "1M" => KlineInterval.OneMonth,
            _ => KlineInterval.OneHour
        };
        return interval is "1m" or "3m" or "5m" or "15m" or "30m" or "1h"
            or "2h" or "4h" or "6h" or "8h" or "12h" or "1d" or "3d" or "1w" or "1M";
    }
}
