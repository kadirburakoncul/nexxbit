using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Indicators;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class SignalEngine(
    IApplicationDbContext db,
    IBinanceService binance,
    IIndicatorRegistry registry,
    ILogger<SignalEngine> logger) : ISignalEngine
{
    private const int CandleFetchLimit = 500;

    public async Task<TradeSignal?> GenerateSignalAsync(
        Guid userId, int coinId, string symbol, string timeframe, CancellationToken ct = default)
    {
        // 0. Whitelist/Blacklist kontrolü — engellenen coin için sinyal üretme
        if (!await IsCoinAllowedAsync(userId, coinId, ct))
        {
            logger.LogDebug("Coin engellendi veya whitelist'te yok: userId={UserId} coinId={CoinId}", userId, coinId);
            return null;
        }

        // 1. Kullanıcının bu coin+timeframe için stratejisini bul
        var strategy = await db.UserStrategies
            .FirstOrDefaultAsync(s => s.UserId == userId
                && (s.CoinId == coinId || s.CoinId == null)
                && s.Timeframe == timeframe
                && s.IsActive, ct);

        if (strategy is null)
        {
            logger.LogDebug("Strateji bulunamadı: userId={UserId} coinId={CoinId} tf={Timeframe}", userId, coinId, timeframe);
            return null;
        }

        // 2. Kullanıcının etkin indikatör ayarlarını yükle
        var userSettings = await db.UserIndicatorSettings
            .Include(s => s.Indicator)
            .Include(s => s.ParameterValues)
                .ThenInclude(v => v.ParameterDefinition)
            .Where(s => s.UserId == userId
                && (s.CoinId == coinId || s.CoinId == null)
                && s.IsEnabled)
            .ToListAsync(ct);

        if (userSettings.Count == 0)
        {
            logger.LogDebug("Aktif indikatör yok: userId={UserId}", userId);
            return null;
        }

        // 3. Candle verisi çek
        var candleResult = await binance.GetCandlesAsync(symbol, timeframe, CandleFetchLimit, ct);
        if (!candleResult.Succeeded || candleResult.Data is null)
        {
            logger.LogWarning("Candle alınamadı: {Symbol} {Timeframe}", symbol, timeframe);
            return null;
        }

        var candles = candleResult.Data
            .Select(c => new CandleInput(c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume))
            .ToList();

        // 4. İndikatör modu tespiti
        var hasT3   = userSettings.Any(s => s.Indicator.Name.Equals("Tillson",  StringComparison.OrdinalIgnoreCase) ||
                                             s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase));
        var hasEma  = userSettings.Any(s => s.Indicator.Name.Equals("Ema200",   StringComparison.OrdinalIgnoreCase));

        // Sadece T3 aktif → Easy İndikatör modu (pure T3)
        if (hasT3 && !hasEma)
            return await GenerateT3OnlySignalAsync(userId, coinId, strategy, candles, userSettings, ct);

        // T3 + EMA200 → kombine mod
        if (hasT3 && hasEma)
            return await GenerateT3Ema200SignalAsync(userId, coinId, strategy, candles, userSettings, ct);

        // 5. Skor tabanlı mod
        var indicatorScores = new Dictionary<string, decimal>();
        var totalWeightedScore = 0m;
        var totalWeight = 0m;

        foreach (var setting in userSettings)
        {
            var indicator = registry.Resolve(setting.Indicator.Name);
            if (indicator is null)
            {
                logger.LogWarning("İndikatör bulunamadı registry'de: {Name}", setting.Indicator.Name);
                continue;
            }

            if (candles.Count < indicator.MinCandlesRequired)
            {
                logger.LogDebug("Yetersiz mum: {Name} için {Min} gerekli, {Got} var", indicator.Name, indicator.MinCandlesRequired, candles.Count);
                continue;
            }

            var parameters = BuildParameters(setting);

            try
            {
                var result = indicator.Calculate(candles, parameters);
                var weight = setting.Weight > 0 ? setting.Weight : setting.Indicator.DefaultWeight;
                indicatorScores[result.IndicatorName] = result.Score;
                totalWeightedScore += result.Score * weight;
                totalWeight += weight;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "İndikatör hesaplama hatası: {Name}", indicator.Name);
            }
        }

        if (totalWeight == 0) return null;

        var normalizedScore = totalWeightedScore / totalWeight;

        if (strategy.IsEma200RuleEnabled)
            normalizedScore = ApplyEma200Rule(normalizedScore, candles, strategy);

        var direction = normalizedScore >= strategy.BuyThreshold ? SignalDirection.Buy
            : normalizedScore <= strategy.StrongSellThreshold ? SignalDirection.StrongSell
            : normalizedScore <= strategy.SellThreshold ? SignalDirection.Sell
            : SignalDirection.Hold;

        var lastCandle = candles[^1];

        return new TradeSignal
        {
            UserId = userId,
            CoinId = coinId,
            StrategyId = strategy.Id,
            Timeframe = timeframe,
            Direction = direction,
            TotalScore = Math.Round(normalizedScore, 4),
            CandleTime = lastCandle.OpenTime,
            Price = lastCandle.Close,
            IndicatorScores = JsonSerializer.Serialize(indicatorScores),
        };
    }

    /// <summary>
    /// Easy İndikatör (Pure T3) modu.
    /// buySignal  = T3 yukarı döndü (ve ReEntryState uygun)
    /// sellSignal = T3 aşağı döndü (ve açık pozisyon var)
    /// </summary>
    private async Task<TradeSignal?> GenerateT3OnlySignalAsync(
        Guid userId, int coinId, UserStrategy strategy,
        List<CandleInput> candles,
        List<UserIndicatorSetting> settings,
        CancellationToken ct)
    {
        // [^1] = açık (kapanmamış) mum; yön tespiti için son kapanmış mum [^2] kullanılır
        // Mum kapanmadan sinyal üretilmemesi için en az 5 mum gerekiyor ([^2],[^3],[^4])
        if (candles.Count < 11) return null;

        var t3Setting = settings.FirstOrDefault(s =>
            s.Indicator.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase) ||
            s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase));

        var t3Params = t3Setting is not null ? BuildParameters(t3Setting) : new Dictionary<string, string>();
        var t3Period = t3Params.TryGetValue("Period", out var p) ? int.Parse(p) : 3;
        var t3Factor = t3Params.TryGetValue("Factor", out var f)
            ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;

        var src  = candles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var t3   = TillsonIndicator.ComputeT3(src, t3Period, t3Factor);

        // Kapanmış son mum: [^2]; açık mum: [^1] (henüz kapanmadı — sinyal için kullanılmaz)
        var t3UpCurr   = t3[^2] > t3[^3];
        var t3UpPrev   = t3[^3] > t3[^4];
        var t3TurnUp   = t3UpCurr && !t3UpPrev;
        var t3TurnDown = !t3UpCurr && t3UpPrev;

        var lastCandle = candles[^2]; // son kapanmış mum
        var closePrice = lastCandle.Close;

        // Tek sorgu — tüm dallarda kullanılacak
        var strategyCoin = await db.UserStrategyCoins
            .FirstOrDefaultAsync(sc => sc.UserStrategyId == strategy.Id && sc.CoinId == coinId, ct);

        // lastCheckedAt'i her çalışmada güncelle (sinyal olsun ya da olmasın)
        if (strategyCoin is not null)
        {
            strategyCoin.LastCheckedAt = DateTime.UtcNow;
            strategyCoin.LastCheckedPrice = closePrice;
        }

        if (!t3TurnUp && !t3TurnDown)
        {
            if (strategyCoin is not null)
            {
                strategyCoin.LastCheckedReason = $"T3 {(t3UpCurr ? "yükseliyor" : "düşüyor")} — yön değişimi yok";
                await db.SaveChangesAsync(ct);
            }
            return null;
        }

        // Strateji aktive edilmeden önce oluşan T3 dönüşlerini yoksay
        if (strategy.ActivatedAt.HasValue && lastCandle.OpenTime < strategy.ActivatedAt.Value)
        {
            if (strategyCoin is not null)
            {
                strategyCoin.LastCheckedReason = "Strateji aktive edilmeden önceki sinyal — yoksayıldı";
                await db.SaveChangesAsync(ct);
            }
            return null;
        }

        var reEntryState = strategyCoin?.ReEntryState ?? Domain.Enums.ReEntryState.Normal;

        var hasOpenPosition = await db.Positions
            .AnyAsync(pos => pos.UserId == userId && pos.CoinId == coinId && pos.Status == Domain.Enums.PositionStatus.Open, ct);

        SignalDirection? dir = null;

        switch (reEntryState)
        {
            case Domain.Enums.ReEntryState.Normal:
                if (t3TurnUp && !hasOpenPosition)
                    dir = SignalDirection.Buy;
                else if (t3TurnDown && hasOpenPosition)
                    dir = SignalDirection.Sell;
                else if (strategyCoin is not null)
                {
                    // T3 döndü ama pozisyon durumu uyumsuz (örn. T3 yukarı ama pozisyon zaten açık)
                    strategyCoin.LastCheckedReason = t3TurnUp
                        ? "T3 yukarı döndü — pozisyon zaten açık"
                        : "T3 aşağı döndü — açık pozisyon yok";
                    await db.SaveChangesAsync(ct);
                }
                break;

            case Domain.Enums.ReEntryState.WaitingForSell:
                if (strategyCoin is not null)
                {
                    if (t3TurnDown)
                    {
                        strategyCoin.ReEntryState = Domain.Enums.ReEntryState.WaitingForBuy;
                        strategyCoin.LastCheckedReason = "SAT sinyali alındı → AL bekleniyor";
                        logger.LogInformation("Re-entry: SAT sinyali alındı, AL bekleniyor. Coin={CoinId}", coinId);
                    }
                    else
                    {
                        strategyCoin.LastCheckedReason = "SAT sinyali bekleniyor (Re-entry)";
                    }
                    await db.SaveChangesAsync(ct);
                }
                return null;

            case Domain.Enums.ReEntryState.WaitingForBuy:
                if (t3TurnUp && strategyCoin is not null)
                {
                    strategyCoin.ReEntryState = Domain.Enums.ReEntryState.Normal;
                    strategyCoin.LastCheckedReason = "AL sinyali alındı — normal moda geçildi";
                    await db.SaveChangesAsync(ct);
                    dir = SignalDirection.Buy;
                    logger.LogInformation("Re-entry: AL sinyali alındı, normal moda geçildi. Coin={CoinId}", coinId);
                }
                else if (strategyCoin is not null)
                {
                    strategyCoin.LastCheckedReason = "AL sinyali bekleniyor (Re-entry)";
                    await db.SaveChangesAsync(ct);
                }
                break;
        }

        if (dir is null) return null;

        var scores = new Dictionary<string, decimal>
        {
            ["T3"]         = Math.Round(t3[^1], 8),
            ["T3TurnUp"]   = t3TurnUp   ? 1 : 0,
            ["T3TurnDown"] = t3TurnDown ? 1 : 0,
        };

        logger.LogInformation("T3 Easy sinyali: Coin={CoinId} {Dir} (T3={T3:F6} close={C:F6})",
            coinId, dir, t3[^1], closePrice);

        return new TradeSignal
        {
            UserId = userId,
            CoinId = coinId,
            StrategyId = strategy.Id,
            Timeframe = strategy.Timeframe,
            Direction = dir.Value,
            TotalScore = dir == SignalDirection.Buy ? 1m : -1m,
            CandleTime = lastCandle.OpenTime,
            Price = closePrice,
            IndicatorScores = JsonSerializer.Serialize(scores),
        };
    }

    /// <summary>
    /// PineScript T3+EMA200 doğrudan sinyal modu.
    /// buySignal  = T3 yukarı döndü AND close > EMA200
    /// sellSignal = T3 aşağı döndü OR close &lt; EMA200
    /// Pozisyon yoksa BUY kontrolü, pozisyon varsa SELL kontrolü yapılır.
    /// </summary>
    private async Task<TradeSignal?> GenerateT3Ema200SignalAsync(
        Guid userId, int coinId, UserStrategy strategy,
        List<CandleInput> candles,
        List<UserIndicatorSetting> settings,
        CancellationToken ct)
    {
        // [^1] açık mum; yön tespiti kapanmış [^2] üzerinden yapılır → 204 mum gerekli
        if (candles.Count < 204) return null;

        // T3 parametrelerini settings'den oku
        var t3Setting = settings.FirstOrDefault(s =>
            s.Indicator.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase) ||
            s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase));

        var t3Params = t3Setting is not null ? BuildParameters(t3Setting) : new Dictionary<string, string>();
        var t3Period = t3Params.TryGetValue("Period", out var p) ? int.Parse(p) : 3;
        var t3Factor = t3Params.TryGetValue("Factor", out var f)
            ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;

        // PineScript kaynak: (high + low + 2*close) / 4
        var src    = candles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var closes = candles.Select(c => c.Close).ToArray();
        var t3     = TillsonIndicator.ComputeT3(src, t3Period, t3Factor);
        var ema200 = ComputeEma(closes, 200);

        // Kapanmış son mum [^2]; açık mum [^1] sinyal tespitinde kullanılmaz
        var t3UpCurr = t3[^2] > t3[^3];
        var t3UpPrev = t3[^3] > t3[^4];
        var t3TurnUp   = t3UpCurr && !t3UpPrev;
        var t3TurnDown = !t3UpCurr && t3UpPrev;

        var lastCandle  = candles[^2]; // son kapanmış mum
        var closePrice  = lastCandle.Close;
        var ema200Last  = ema200[^2];

        var buySignal  = t3TurnUp   && closePrice > ema200Last;
        var sellSignal = t3TurnDown || closePrice < ema200Last;

        if (!buySignal && !sellSignal)
            return null;

        // Açık pozisyon kontrolü (PineScript "inTrade" karşılığı)
        var hasOpenPosition = await db.Positions
            .AnyAsync(pos => pos.UserId == userId && pos.CoinId == coinId && pos.Status == Domain.Enums.PositionStatus.Open, ct);

        SignalDirection? dir = null;
        if (buySignal  && !hasOpenPosition) dir = SignalDirection.Buy;
        if (sellSignal &&  hasOpenPosition) dir = SignalDirection.Sell;

        if (dir is null) return null;

        var scores = new Dictionary<string, decimal>
        {
            ["T3"]    = Math.Round(t3[^1], 8),
            ["EMA200"] = Math.Round(ema200Last, 8),
            ["T3TurnUp"]   = t3TurnUp   ? 1 : 0,
            ["T3TurnDown"] = t3TurnDown ? 1 : 0,
        };

        logger.LogInformation("T3+EMA200 sinyali: {Symbol} {Dir} (T3={T3:F4} EMA={EMA:F4} close={C:F4})",
            strategy.Coin?.Symbol ?? coinId.ToString(), dir, t3[^1], ema200Last, closePrice);

        return new TradeSignal
        {
            UserId = userId,
            CoinId = coinId,
            StrategyId = strategy.Id,
            Timeframe = strategy.Timeframe,
            Direction = dir.Value,
            TotalScore = dir == SignalDirection.Buy ? 1m : -1m,
            CandleTime = lastCandle.OpenTime,
            Price = closePrice,
            IndicatorScores = JsonSerializer.Serialize(scores),
        };
    }

    public async Task<T3ChartResult?> GetT3ChartAsync(
        Guid userId, int coinId, string symbol, string timeframe,
        int limit = 200, CancellationToken ct = default)
    {
        var fetchLimit = Math.Max(limit + 50, 300);
        var candleResult = await binance.GetCandlesAsync(symbol, timeframe, fetchLimit, ct);
        if (!candleResult.Succeeded || candleResult.Data is null) return null;

        var allCandles = candleResult.Data
            .Select(c => new CandleInput(c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume))
            .ToList();

        // T3 parametrelerini kullanıcı ayarından al (yoksa default)
        var t3Setting = await db.UserIndicatorSettings
            .Include(s => s.Indicator)
            .Include(s => s.ParameterValues).ThenInclude(v => v.ParameterDefinition)
            .Where(s => s.UserId == userId && s.IsEnabled &&
                (s.Indicator.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase) ||
                 s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase)))
            .FirstOrDefaultAsync(ct);

        var t3Params = t3Setting is not null ? BuildParameters(t3Setting) : new Dictionary<string, string>();
        var t3Period = t3Params.TryGetValue("Period", out var p) ? int.Parse(p) : 3;
        var t3Factor = t3Params.TryGetValue("Factor", out var f)
            ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;

        var src = allCandles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var t3Full = TillsonIndicator.ComputeT3(src, t3Period, t3Factor);

        // Son `limit` mumu al
        var take = Math.Min(limit, allCandles.Count);
        var startIdx = allCandles.Count - take;
        var candles = allCandles.Skip(startIdx).ToList();
        var t3 = t3Full.Skip(startIdx).ToArray();

        // T3 yön tespiti (son 3 değer)
        var t3UpCurr = t3Full[^1] > t3Full[^2];
        var t3UpPrev = t3Full[^2] > t3Full[^3];
        var t3TurnUp   = t3UpCurr && !t3UpPrev;
        var t3TurnDown = !t3UpCurr && t3UpPrev;

        // Son 30 gün sinyal kayıtlarını çek (buy/sell markers için)
        var since = DateTime.UtcNow.AddDays(-30);
        var recentSignals = await db.TradeSignals
            .Where(s => s.UserId == userId && s.CoinId == coinId &&
                        s.Timeframe == timeframe && s.CandleTime >= since)
            .OrderBy(s => s.CandleTime)
            .ToListAsync(ct);

        var candleList = candles.Select(c => new T3ChartCandleDto(
            ((DateTimeOffset)c.OpenTime).ToUnixTimeSeconds(),
            c.Open, c.High, c.Low, c.Close, c.Volume
        )).ToList();

        var t3List = candles.Select((c, i) => new T3ChartValueDto(
            ((DateTimeOffset)c.OpenTime).ToUnixTimeSeconds(),
            Math.Round(t3[i], 8)
        )).Where(v => v.Value != 0).ToList();

        var markerList = recentSignals.Select(s => new T3ChartMarkerDto(
            ((DateTimeOffset)s.CandleTime).ToUnixTimeSeconds(),
            s.Direction == Domain.Enums.SignalDirection.Buy ? "buy" : "sell",
            s.Price
        )).ToList();

        return new T3ChartResult(
            candleList, t3List, markerList,
            t3UpCurr, t3TurnUp, t3TurnDown,
            Math.Round(t3Full[^1], 8),
            allCandles[^1].Close
        );
    }

    public async Task<SignalAnalysisResult> AnalyzeAsync(
        Guid userId, int coinId, string symbol, string timeframe, CancellationToken ct = default)
    {
        var noIndicators = new List<SignalIndicatorResult>();

        if (!await IsCoinAllowedAsync(userId, coinId, ct))
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL", "Coin kara listede veya beyaz listede yok.", null, null, null, false, null, noIndicators);

        var strategy = await db.UserStrategies
            .FirstOrDefaultAsync(s => s.UserId == userId
                && (s.CoinId == coinId || s.CoinId == null)
                && s.Timeframe == timeframe
                && s.IsActive, ct);

        if (strategy is null)
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL", $"Bu coin için aktif strateji yok ({timeframe} zaman diliminde).", null, null, null, false, null, noIndicators);

        var userSettings = await db.UserIndicatorSettings
            .Include(s => s.Indicator)
            .Include(s => s.ParameterValues).ThenInclude(v => v.ParameterDefinition)
            .Where(s => s.UserId == userId && (s.CoinId == coinId || s.CoinId == null) && s.IsEnabled)
            .ToListAsync(ct);

        if (userSettings.Count == 0)
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL", "Aktif indikatör yok — İndikatörler sayfasından aktif edin.", null, strategy.BuyThreshold, strategy.SellThreshold, strategy.IsEma200RuleEnabled, null, noIndicators);

        var candleResult = await binance.GetCandlesAsync(symbol, timeframe, CandleFetchLimit, ct);
        if (!candleResult.Succeeded || candleResult.Data is null)
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL", "Binance'den mum verisi alınamadı.", null, strategy.BuyThreshold, strategy.SellThreshold, strategy.IsEma200RuleEnabled, null, noIndicators);

        var candles = candleResult.Data
            .Select(c => new CandleInput(c.OpenTime, c.Open, c.High, c.Low, c.Close, c.Volume))
            .ToList();

        // T3 + EMA200 ikisi aktifse PineScript doğrudan analiz modu
        var analyzeHasT3  = userSettings.Any(s => s.Indicator.Name.Equals("Tillson",  StringComparison.OrdinalIgnoreCase) ||
                                                   s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase));
        var analyzeHasEma = userSettings.Any(s => s.Indicator.Name.Equals("Ema200",   StringComparison.OrdinalIgnoreCase));

        if (analyzeHasT3 && analyzeHasEma)
            return await AnalyzeT3Ema200Async(userId, coinId, symbol, timeframe, strategy, candles, userSettings, ct);

        var indicatorResults = new List<SignalIndicatorResult>();
        var totalWeightedScore = 0m;
        var totalWeight = 0m;

        foreach (var setting in userSettings)
        {
            var indicator = registry.Resolve(setting.Indicator.Name);
            if (indicator is null) continue;

            if (candles.Count < indicator.MinCandlesRequired)
            {
                indicatorResults.Add(new SignalIndicatorResult(
                    setting.Indicator.Name, setting.Indicator.DisplayName, 0, false,
                    $"Yetersiz mum: {candles.Count}/{indicator.MinCandlesRequired} gerekli"));
                continue;
            }

            var parameters = BuildParameters(setting);
            try
            {
                var result = indicator.Calculate(candles, parameters);
                var weight = setting.Weight > 0 ? setting.Weight : setting.Indicator.DefaultWeight;
                totalWeightedScore += result.Score * weight;
                totalWeight += weight;

                var passed = result.Score > 0.5m;
                var details = BuildIndicatorDetails(setting.Indicator.Name, result.Score, candles);
                indicatorResults.Add(new SignalIndicatorResult(setting.Indicator.Name, setting.Indicator.DisplayName, Math.Round(result.Score, 3), passed, details));
            }
            catch (Exception ex)
            {
                indicatorResults.Add(new SignalIndicatorResult(setting.Indicator.Name, setting.Indicator.DisplayName, 0, false, $"Hesaplama hatası: {ex.Message}"));
            }
        }

        if (totalWeight == 0)
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL", "Hiçbir indikatör skor üretemedi.", null, strategy.BuyThreshold, strategy.SellThreshold, strategy.IsEma200RuleEnabled, null, indicatorResults);

        var score = totalWeightedScore / totalWeight;
        string? ema200Result = null;

        if (strategy.IsEma200RuleEnabled)
        {
            var scoreBefore = score;
            score = ApplyEma200Rule(score, candles, strategy);
            if (score == 0 && scoreBefore > 0)
                ema200Result = "❌ EMA200 cross koşulu sağlanmadı — son pencerede fiyat EMA200'ü yukarı kesmedi";
            else if (scoreBefore > 0)
                ema200Result = "✓ EMA200 cross koşulu sağlandı";
            else
                ema200Result = "Satış sinyali — EMA200 cross kontrolü uygulanmadı";
        }

        var verdict = score >= strategy.BuyThreshold ? "BUY"
            : score <= strategy.StrongSellThreshold ? "STRONG_SELL"
            : score <= strategy.SellThreshold ? "SELL"
            : "HOLD";

        var reason = verdict switch {
            "BUY" => $"Alım sinyali ✓ Skor {score:F3} ≥ alım eşiği {strategy.BuyThreshold:F3}",
            "STRONG_SELL" => $"Güçlü satış ✓ Skor {score:F3} ≤ {strategy.StrongSellThreshold:F3}",
            "SELL" => $"Satış sinyali ✓ Skor {score:F3} ≤ {strategy.SellThreshold:F3}",
            _ => $"Sinyal yok — Skor {score:F3} eşikleri karşılamıyor (Alım ≥ {strategy.BuyThreshold:F3}, Satış ≤ {strategy.SellThreshold:F3})"
        };

        return new SignalAnalysisResult(symbol, timeframe, verdict, reason, Math.Round(score, 4), strategy.BuyThreshold, strategy.SellThreshold, strategy.IsEma200RuleEnabled, ema200Result, indicatorResults);
    }

    private async Task<SignalAnalysisResult> AnalyzeT3Ema200Async(
        Guid userId, int coinId, string symbol, string timeframe, UserStrategy strategy,
        List<CandleInput> candles, List<UserIndicatorSetting> settings, CancellationToken ct)
    {
        if (candles.Count < 203)
            return new SignalAnalysisResult(symbol, timeframe, "NO_SIGNAL",
                $"Yetersiz mum verisi: {candles.Count}/203 gerekli.", null, null, null, false, null, []);

        var t3Setting = settings.FirstOrDefault(s =>
            s.Indicator.Name.Equals("Tillson", StringComparison.OrdinalIgnoreCase) ||
            s.Indicator.Name.Equals("TillsonT3", StringComparison.OrdinalIgnoreCase));

        var t3Params = t3Setting is not null ? BuildParameters(t3Setting) : new Dictionary<string, string>();
        var t3Period = t3Params.TryGetValue("Period", out var p) ? int.Parse(p) : 3;
        var t3Factor = t3Params.TryGetValue("Factor", out var f)
            ? decimal.Parse(f, System.Globalization.CultureInfo.InvariantCulture) : 0.7m;

        var src    = candles.Select(c => (c.High + c.Low + 2m * c.Close) / 4m).ToArray();
        var closes = candles.Select(c => c.Close).ToArray();
        var t3     = TillsonIndicator.ComputeT3(src, t3Period, t3Factor);
        var ema200 = ComputeEma(closes, 200);

        var t3UpCurr   = t3[^1] > t3[^2];
        var t3UpPrev   = t3[^2] > t3[^3];
        var t3TurnUp   = t3UpCurr && !t3UpPrev;
        var t3TurnDown = !t3UpCurr && t3UpPrev;

        var closePrice = candles[^1].Close;
        var ema200Last = ema200[^1];

        var buySignal  = t3TurnUp   && closePrice > ema200Last;
        var sellSignal = t3TurnDown || closePrice < ema200Last;

        var hasOpenPosition = await db.Positions
            .AnyAsync(pos => pos.UserId == userId && pos.CoinId == coinId && pos.Status == Domain.Enums.PositionStatus.Open, ct);

        var indicators = new List<SignalIndicatorResult>
        {
            new("Tillson", "T3 Tillson", t3TurnUp ? 1 : (t3TurnDown ? -1 : 0), t3TurnUp,
                t3TurnUp   ? $"✓ T3 yukarı döndü — yön değişti (T3={t3[^1]:F6})" :
                t3TurnDown ? $"✗ T3 aşağı döndü (T3={t3[^1]:F6})" :
                             $"— T3 yön değişimi yok ({(t3UpCurr ? "yukarı" : "aşağı")} devam, T3={t3[^1]:F6})"),
            new("EMA200", "EMA 200", closePrice > ema200Last ? 1 : -1, closePrice > ema200Last,
                closePrice > ema200Last
                    ? $"✓ Fiyat({closePrice:F6}) > EMA200({ema200Last:F6}) — EMA üzerinde"
                    : $"✗ Fiyat({closePrice:F6}) < EMA200({ema200Last:F6}) — EMA altında"),
        };

        string verdict, reason;
        if (!hasOpenPosition)
        {
            verdict = buySignal ? "BUY" : "HOLD";
            reason = buySignal
                ? "✅ AL sinyali: T3 yukarı döndü VE fiyat EMA200 üzerinde"
                : (!t3TurnUp && !(closePrice > ema200Last) ? "❌ AL yok: T3 yön değişmedi VE fiyat EMA200 altında" :
                   !t3TurnUp ? "❌ AL yok: T3 henüz yukarı dönmedi" :
                               "❌ AL yok: Fiyat EMA200'ün altında");
        }
        else
        {
            verdict = sellSignal ? "SELL" : "HOLD";
            reason = sellSignal
                ? (t3TurnDown && closePrice < ema200Last ? "🔴 SAT sinyali: T3 aşağı döndü VE fiyat EMA200 altında" :
                   t3TurnDown ? "🔴 SAT sinyali: T3 aşağı döndü" :
                                "🔴 SAT sinyali: Fiyat EMA200'ün altına düştü")
                : "⏳ Açık pozisyon var, SAT koşulları henüz sağlanmadı";
        }

        return new SignalAnalysisResult(symbol, timeframe, verdict, reason, null, null, null, false,
            $"📌 Mod: T3+EMA200 PineScript — Pozisyon: {(hasOpenPosition ? "AÇIK" : "YOK")}",
            indicators);
    }

    private string BuildIndicatorDetails(string indicatorName, decimal score, List<CandleInput> candles)
    {
        var last = candles[^1];
        var name = indicatorName.ToLower();

        if (name == "ema200" && candles.Count >= 200)
        {
            var closes = candles.Select(c => c.Close).ToArray();
            var ema = ComputeEma(closes, 200);
            var emaVal = ema[^1];
            return last.Close > emaVal
                ? $"✓ Fiyat({last.Close:F4}) > EMA200({emaVal:F4}) — yukarıda"
                : $"✗ Fiyat({last.Close:F4}) < EMA200({emaVal:F4}) — aşağıda";
        }

        if (name == "tillsont3")
            return score > 0.5m
                ? $"✓ T3 yukarı döndü (skor: {score:F3})"
                : $"✗ T3 aşağı yönlü (skor: {score:F3})";

        return $"Skor: {score:F3}";
    }

    /// <summary>
    /// EMA200 cross + pencere kuralı:
    /// Buy sinyali yalnızca son Ema200MinCandles..Ema200MaxCandles mum içinde EMA200 kesişimi olduysa geçerlidir.
    /// Cross yoksa veya pencere dışındaysa skor sıfırlanır.
    /// </summary>
    private static decimal ApplyEma200Rule(
        decimal score, List<CandleInput> candles, UserStrategy strategy)
    {
        if (score <= 0) return score; // Sadece buy sinyali için kontrol

        var ema200Period = 200;
        if (candles.Count < ema200Period + strategy.Ema200MaxCandles + 1)
            return 0; // Yeterli veri yok → buy blokla

        var closes = candles.Select(c => c.Close).ToArray();
        var ema = ComputeEma(closes, ema200Period);

        // Son Ema200MaxCandles mum içinde cross arıyoruz
        var crossFound = false;
        var lookback = Math.Min(strategy.Ema200MaxCandles, candles.Count - 1);

        for (var i = candles.Count - strategy.Ema200MinCandles;
             i >= candles.Count - lookback - 1 && i > 0; i--)
        {
            var prevBelow = closes[i - 1] < ema[i - 1];
            var currAbove = closes[i] > ema[i];
            if (prevBelow && currAbove)
            {
                crossFound = true;
                break;
            }
        }

        return crossFound ? score : 0m;
    }

    private static decimal[] ComputeEma(decimal[] closes, int period)
    {
        var ema = new decimal[closes.Length];
        var k = 2m / (period + 1);
        var sum = 0m;
        for (var i = 0; i < period; i++) sum += closes[i];
        ema[period - 1] = sum / period;
        for (var i = period; i < closes.Length; i++)
            ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
        return ema;
    }

    private static Dictionary<string, string> BuildParameters(UserIndicatorSetting setting)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var pv in setting.ParameterValues)
            result[pv.ParameterDefinition.ParameterKey] = pv.Value;

        return result;
    }

    private async Task<bool> IsCoinAllowedAsync(Guid userId, int coinId, CancellationToken ct)
    {
        var risk = await db.UserRiskSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.UserId == userId, ct);

        if (risk is null) return true;

        // Blacklist: bu coin açıkça engellenmişse → izin verme
        if (!string.IsNullOrEmpty(risk.BlockedCoinIds))
        {
            var blocked = JsonSerializer.Deserialize<List<int>>(risk.BlockedCoinIds);
            if (blocked?.Contains(coinId) == true) return false;
        }

        // Whitelist: liste doluysa → sadece listede olanlar
        if (!string.IsNullOrEmpty(risk.AllowedCoinIds))
        {
            var allowed = JsonSerializer.Deserialize<List<int>>(risk.AllowedCoinIds);
            if (allowed is { Count: > 0 }) return allowed.Contains(coinId);
        }

        return true;
    }
}
