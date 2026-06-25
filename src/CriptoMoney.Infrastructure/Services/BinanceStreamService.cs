using Binance.Net.Clients;
using Binance.Net.Enums;
using CriptoMoney.Application.Common.Interfaces;
using CryptoExchange.Net.Objects.Sockets;
using CryptoExchange.Net.Sockets;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class BinanceStreamService(
    ICandleHubNotifier notifier,
    ILogger<BinanceStreamService> logger) : IBinanceStreamService, IAsyncDisposable
{
    private readonly BinanceSocketClient _socketClient = new();
    private readonly Dictionary<string, UpdateSubscription> _subscriptions = new();
    private readonly SemaphoreSlim _lock = new(1, 1);

    public async Task SubscribeAsync(string symbol, string interval, CancellationToken ct = default)
    {
        if (!TryParseInterval(interval, out var klineInterval)) return;

        var key = $"{symbol}_{interval}";

        await _lock.WaitAsync(ct);
        try
        {
            if (_subscriptions.ContainsKey(key)) return;

            var result = await _socketClient.SpotApi.ExchangeData.SubscribeToKlineUpdatesAsync(
                symbol, klineInterval,
                async data =>
                {
                    var k = data.Data.Data;
                    var payload = new
                    {
                        symbol,
                        interval,
                        openTime = k.OpenTime,
                        open = k.OpenPrice,
                        high = k.HighPrice,
                        low = k.LowPrice,
                        close = k.ClosePrice,
                        volume = k.Volume,
                        closeTime = k.CloseTime,
                        isClosed = k.Final,
                    };
                    await notifier.SendCandleUpdateAsync(symbol, interval, payload);
                }, ct);

            if (result.Success)
            {
                _subscriptions[key] = result.Data;
                logger.LogInformation("Binance stream açıldı: {Key}", key);
            }
            else
            {
                logger.LogWarning("Binance stream açılamadı {Key}: {Error}", key, result.Error?.Message);
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task UnsubscribeAsync(string symbol, string interval, CancellationToken ct = default)
    {
        var key = $"{symbol}_{interval}";

        await _lock.WaitAsync(ct);
        try
        {
            if (!_subscriptions.TryGetValue(key, out var sub)) return;
            await _socketClient.UnsubscribeAsync(sub);
            _subscriptions.Remove(key);
            logger.LogInformation("Binance stream kapatıldı: {Key}", key);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task UnsubscribeAllAsync(CancellationToken ct = default)
    {
        await _socketClient.UnsubscribeAllAsync();
        _subscriptions.Clear();
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
            "4h" => KlineInterval.FourHour,
            "1d" => KlineInterval.OneDay,
            _ => KlineInterval.OneHour
        };
        return interval is "1m" or "3m" or "5m" or "15m" or "30m" or "1h" or "4h" or "1d";
    }

    public async ValueTask DisposeAsync()
    {
        await _socketClient.UnsubscribeAllAsync();
        _socketClient.Dispose();
        _lock.Dispose();
    }
}
