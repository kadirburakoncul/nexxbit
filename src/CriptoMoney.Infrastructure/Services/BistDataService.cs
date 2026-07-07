using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Yahoo Finance'in resmi olmayan chart endpoint'inden BIST hisse verisi çeker.
/// Ücretsiz, ~15-20dk gecikmeli — al-sat amaçlı değil, sinyal/izleme amaçlıdır.
/// </summary>
public class BistDataService(IHttpClientFactory httpClientFactory, ILogger<BistDataService> logger) : IBistDataService
{
    private const string BaseUrl = "https://query1.finance.yahoo.com/v8/finance/chart/";

    public async Task<Result<List<BistCandle>>> GetCandlesAsync(
        string symbol, string interval, int limit, CancellationToken ct = default)
    {
        try
        {
            var client = httpClientFactory.CreateClient("yahoo-finance");
            var url = $"{BaseUrl}{symbol}.IS?interval={MapInterval(interval)}&range={RangeFor(interval)}";
            var response = await client.GetAsync(url, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("BIST veri alınamadı: {Symbol} HTTP {Status}", symbol, response.StatusCode);
                return Result<List<BistCandle>>.Failure($"Veri alınamadı: {response.StatusCode}");
            }

            using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var resultArr = doc.RootElement.GetProperty("chart").GetProperty("result");
            if (resultArr.ValueKind != JsonValueKind.Array || resultArr.GetArrayLength() == 0)
                return Result<List<BistCandle>>.Failure("Veri bulunamadı — sembol veya seans dışı olabilir.");

            var first = resultArr[0];
            var timestamps = first.GetProperty("timestamp").EnumerateArray().Select(t => t.GetInt64()).ToArray();
            var quote = first.GetProperty("indicators").GetProperty("quote")[0];

            var opens   = quote.GetProperty("open").EnumerateArray().ToArray();
            var highs   = quote.GetProperty("high").EnumerateArray().ToArray();
            var lows    = quote.GetProperty("low").EnumerateArray().ToArray();
            var closes  = quote.GetProperty("close").EnumerateArray().ToArray();
            var volumes = quote.GetProperty("volume").EnumerateArray().ToArray();

            var candles = new List<BistCandle>(timestamps.Length);
            for (var i = 0; i < timestamps.Length; i++)
            {
                if (i >= closes.Length || closes[i].ValueKind != JsonValueKind.Number) continue; // seans dışı / eksik bar

                var close = closes[i].GetDecimal();
                candles.Add(new BistCandle(
                    DateTimeOffset.FromUnixTimeSeconds(timestamps[i]).UtcDateTime,
                    i < opens.Length && opens[i].ValueKind == JsonValueKind.Number ? opens[i].GetDecimal() : close,
                    i < highs.Length && highs[i].ValueKind == JsonValueKind.Number ? highs[i].GetDecimal() : close,
                    i < lows.Length && lows[i].ValueKind == JsonValueKind.Number ? lows[i].GetDecimal() : close,
                    close,
                    i < volumes.Length && volumes[i].ValueKind == JsonValueKind.Number ? volumes[i].GetDecimal() : 0m
                ));
            }

            var trimmed = candles.Count > limit ? candles.Skip(candles.Count - limit).ToList() : candles;
            return Result<List<BistCandle>>.Success(trimmed);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "BIST veri çekme hatası: {Symbol}", symbol);
            return Result<List<BistCandle>>.Failure("Veri çekme hatası: " + ex.Message);
        }
    }

    public async Task<decimal?> GetCurrentPriceAsync(string symbol, CancellationToken ct = default)
    {
        var result = await GetCandlesAsync(symbol, "1d", 1, ct);
        return result.Succeeded && result.Data is { Count: > 0 } ? result.Data[^1].Close : null;
    }

    public async Task<List<BistQuote>> GetBulkQuotesAsync(IEnumerable<string> symbols, CancellationToken ct = default)
    {
        var syms = symbols.Select(s => s.Contains('.') ? s : $"{s}.IS").ToList();
        if (syms.Count == 0) return [];

        try
        {
            var client = httpClientFactory.CreateClient("yahoo-finance");
            var joined = string.Join(",", syms);
            var url = $"https://query1.finance.yahoo.com/v7/finance/quote?symbols={Uri.EscapeDataString(joined)}&fields=regularMarketPrice,regularMarketChangePercent,shortName";
            var response = await client.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return [];

            using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var result = doc.RootElement.GetProperty("quoteResponse").GetProperty("result");
            if (result.ValueKind != JsonValueKind.Array) return [];

            return result.EnumerateArray().Select(q =>
            {
                var raw = q.GetProperty("symbol").GetString() ?? "";
                var symbol = raw.EndsWith(".IS") ? raw[..^3] : raw;
                var name   = q.TryGetProperty("shortName", out var n) ? n.GetString() ?? symbol : symbol;
                decimal? price = q.TryGetProperty("regularMarketPrice", out var p) && p.ValueKind == JsonValueKind.Number
                    ? p.GetDecimal() : null;
                decimal? pct = q.TryGetProperty("regularMarketChangePercent", out var c) && c.ValueKind == JsonValueKind.Number
                    ? c.GetDecimal() : null;
                return new BistQuote(symbol, name, price, pct);
            }).ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Toplu fiyat çekme hatası");
            return [];
        }
    }

    private static string MapInterval(string interval) => interval switch
    {
        "1h" => "60m",
        _ => interval,
    };

    private static string RangeFor(string interval) => interval switch
    {
        "1m" => "5d",
        "5m" or "15m" or "30m" or "60m" or "1h" => "1mo",
        "1d" => "2y",
        _ => "1mo",
    };
}
