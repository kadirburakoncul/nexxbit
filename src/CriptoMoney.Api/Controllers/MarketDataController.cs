using System.Security.Claims;
using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;

using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MarketDataController(
    IApplicationDbContext db,
    IMarketDataService marketData,
    IIndicatorOptimizer optimizer,
    IMarketDataJobScheduler scheduler) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    // ─── Sembol listesi ──────────────────────────────────────────────────────────

    /// <summary>Tüm USDT pariteleri, 24 saatlik hacme göre azalan sırada.</summary>
    [HttpGet("symbols")]
    public async Task<IActionResult> GetSymbols(CancellationToken ct)
    {
        var result = await marketData.GetSymbolsByVolumeAsync(ct);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });

        return Ok(result.Data!.Select(s => new MarketSymbolDto(
            s.Symbol, s.BaseAsset, s.LastPrice, s.PriceChangePercent, s.QuoteVolume24h, s.TradeCount24h)));
    }

    /// <summary>Desteklenen periyotlar. 45m Binance'te yoktur, 15m'den türetilir.</summary>
    [HttpGet("timeframes")]
    public IActionResult GetTimeframes() =>
        Ok(TimeframeHelper.All.Select(t => new TimeframeDto(
            t.Key, t.DisplayName, t.AggregateCount > 1,
            t.AggregateCount > 1 ? $"{t.SourceInterval} barlardan türetilir" : "Binance'ten doğrudan")));

    /// <summary>İndirme başlamadan önce boyut/süre tahmini.</summary>
    [HttpPost("estimate")]
    public IActionResult Estimate([FromBody] EstimateRequest req)
    {
        var est = marketData.Estimate(req.SymbolCount, req.Timeframe, req.StartDate, req.EndDate);
        return Ok(est);
    }

    // ─── Dışa aktarma ────────────────────────────────────────────────────────────

    [HttpGet("exports")]
    public async Task<IActionResult> GetExports(CancellationToken ct)
    {
        var list = await db.MarketDataExports
            .Where(e => e.UserId == CurrentUserId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        return Ok(list.Select(ToExportDto));
    }

    [HttpPost("exports")]
    public async Task<IActionResult> CreateExport([FromBody] CreateExportRequest req, CancellationToken ct)
    {
        if (req.Symbols.Count == 0)
            return BadRequest(new { errors = new[] { "En az 1 coin seçin." } });

        if (!TimeframeHelper.IsSupported(req.Timeframe))
            return BadRequest(new { errors = new[] { $"Desteklenmeyen periyot: {req.Timeframe}" } });

        if (req.EndDate <= req.StartDate)
            return BadRequest(new { errors = new[] { "Bitiş tarihi başlangıçtan sonra olmalı." } });

        var est = marketData.Estimate(req.Symbols.Count, req.Timeframe, req.StartDate, req.EndDate);
        if (est.ExceedsLimits)
            return BadRequest(new { errors = new[] { est.Warning ?? "İstek sınırları aşıyor." } });

        var export = new MarketDataExport
        {
            UserId = CurrentUserId,
            Name = string.IsNullOrWhiteSpace(req.Name) ? $"Veri {DateTime.UtcNow:yyyyMMdd-HHmm}" : req.Name.Trim(),
            Symbols = JsonSerializer.Serialize(req.Symbols),
            SymbolCount = req.Symbols.Count,
            Timeframe = req.Timeframe,
            StartDate = DateTime.SpecifyKind(req.StartDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(req.EndDate, DateTimeKind.Utc),
            Format = req.Format == "json" ? "json" : "csv",
            IncludeIndicators = req.IncludeIndicators,
            Status = MarketDataExportStatus.Pending,
        };

        db.MarketDataExports.Add(export);
        await db.SaveChangesAsync(ct);

        scheduler.EnqueueExport(export.Id);
        return Ok(ToExportDto(export));
    }

    [HttpGet("exports/{id:guid}/download")]
    public async Task<IActionResult> DownloadExport(Guid id, CancellationToken ct)
    {
        var export = await db.MarketDataExports
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == CurrentUserId, ct);

        if (export is null) return NotFound();
        if (export.Status != MarketDataExportStatus.Completed || export.FilePath is null)
            return BadRequest(new { errors = new[] { "Dosya henüz hazır değil." } });
        if (!System.IO.File.Exists(export.FilePath))
            return NotFound(new { errors = new[] { "Dosya diskte bulunamadı — yeniden oluşturun." } });

        var contentType = export.Format == "json" ? "application/json" : "text/csv";
        var stream = new FileStream(export.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return File(stream, contentType, Path.GetFileName(export.FilePath));
    }

    [HttpDelete("exports/{id:guid}")]
    public async Task<IActionResult> DeleteExport(Guid id, CancellationToken ct)
    {
        var export = await db.MarketDataExports
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == CurrentUserId, ct);
        if (export is null) return NotFound();

        if (export.FilePath is not null && System.IO.File.Exists(export.FilePath))
        {
            try { System.IO.File.Delete(export.FilePath); } catch { /* dosya kilitli olabilir */ }
        }

        db.MarketDataExports.Remove(export);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── İndikatör optimizasyonu ─────────────────────────────────────────────────

    [HttpGet("optimizer/families")]
    public IActionResult GetFamilies() => Ok(optimizer.Families);

    [HttpGet("optimizations")]
    public async Task<IActionResult> GetOptimizations(CancellationToken ct)
    {
        var list = await db.IndicatorOptimizations
            .Where(o => o.UserId == CurrentUserId)
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        return Ok(list.Select(ToOptimizationDto));
    }

    [HttpGet("optimizations/{id:guid}")]
    public async Task<IActionResult> GetOptimization(Guid id, CancellationToken ct)
    {
        var run = await db.IndicatorOptimizations
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == CurrentUserId, ct);
        if (run is null) return NotFound();

        // Kayıtlı JSON'u ham geçirmek yerine tipli olarak okuyoruz.
        // Eski kayıtlar PascalCase ("ParamsLabel") yazılmıştı, yenileri camelCase;
        // ham geçirildiğinde frontend alanı bulamayıp sayfayı çökertiyordu.
        // Büyük/küçük harf duyarsız okuyup yeniden serileştirince her iki
        // nesil kayıt da aynı biçimde dönüyor — veri taşımaya gerek kalmıyor.
        var results = ReadResults(run.ResultsJson);

        return Ok(new { detail = ToOptimizationDto(run), results });
    }

    [HttpPost("optimizations")]
    public async Task<IActionResult> CreateOptimization([FromBody] CreateOptimizationRequest req, CancellationToken ct)
    {
        if (req.Symbols.Count == 0)
            return BadRequest(new { errors = new[] { "En az 1 coin seçin." } });

        if (req.Symbols.Count > 30)
            return BadRequest(new { errors = new[] { "Optimizasyon için en fazla 30 coin seçin — her coin tüm kombinasyonlarda yeniden test edilir." } });

        if (!TimeframeHelper.IsSupported(req.Timeframe))
            return BadRequest(new { errors = new[] { $"Desteklenmeyen periyot: {req.Timeframe}" } });

        if (!optimizer.Families.Contains(req.Family, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { errors = new[] { $"Bilinmeyen indikatör ailesi: {req.Family}" } });

        var run = new IndicatorOptimization
        {
            UserId = CurrentUserId,
            Name = string.IsNullOrWhiteSpace(req.Name) ? $"{req.Family} taraması {DateTime.UtcNow:yyyyMMdd-HHmm}" : req.Name.Trim(),
            Symbols = JsonSerializer.Serialize(req.Symbols),
            Timeframe = req.Timeframe,
            StartDate = DateTime.SpecifyKind(req.StartDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(req.EndDate, DateTimeKind.Utc),
            IndicatorFamily = req.Family.ToUpperInvariant(),
            CommissionPct = Math.Clamp(req.CommissionPct, 0m, 5m),
            MarketDataExportId = req.MarketDataExportId,
            Status = MarketDataExportStatus.Pending,
        };

        db.IndicatorOptimizations.Add(run);
        await db.SaveChangesAsync(ct);

        scheduler.EnqueueOptimization(run.Id);
        return Ok(ToOptimizationDto(run));
    }

    [HttpDelete("optimizations/{id:guid}")]
    public async Task<IActionResult> DeleteOptimization(Guid id, CancellationToken ct)
    {
        var run = await db.IndicatorOptimizations
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == CurrentUserId, ct);
        if (run is null) return NotFound();

        db.IndicatorOptimizations.Remove(run);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Optimizasyondan çıkan parametreleri kullanıcının indikatör ayarı olarak kaydeder.
    /// Yeni bir indikatör sınıfı yazmaz — mevcut indikatörün parametrelerini günceller.
    /// </summary>
    [HttpPost("optimizations/{id:guid}/apply")]
    public async Task<IActionResult> ApplyToIndicator(Guid id, [FromBody] ApplyIndicatorRequest req, CancellationToken ct)
    {
        var run = await db.IndicatorOptimizations
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == CurrentUserId, ct);
        if (run is null) return NotFound();

        if (run.Status != MarketDataExportStatus.Completed || run.BestParamsJson is null)
            return BadRequest(new { errors = new[] { "Optimizasyon tamamlanmamış." } });

        // AUTO ailesinde taşınan şey parametre değil, kuralın kendisi.
        // Kural, CustomRule indikatörünün RuleJson parametresine yazılır.
        if (run.IndicatorFamily.Equals("AUTO", StringComparison.OrdinalIgnoreCase)
            || run.IndicatorFamily.Equals("KURAL", StringComparison.OrdinalIgnoreCase))
            return await ApplyDiscoveredRuleAsync(run, req.RuleJson, ct);

        var paramsToApply = req.Parameters is { Count: > 0 }
            ? req.Parameters
            : JsonSerializer.Deserialize<Dictionary<string, decimal>>(run.BestParamsJson) ?? [];

        if (paramsToApply.Count == 0)
            return BadRequest(new { errors = new[] { "Uygulanacak parametre yok." } });

        // Aileyi uygulamadaki indikatöre eşle. T3 motoru kurulumlara göre
        // Level1 / Tillson / TillsonT3 adlarından biriyle kayıtlı olabilir,
        // bu yüzden tek isme bağlanmak yerine var olan ilki kullanılır.
        string[]? candidateNames = run.IndicatorFamily.ToUpperInvariant() switch
        {
            "T3"  => ["Level1", "Tillson", "TillsonT3"],
            "RSI" => ["RSI"],
            _     => null,
        };

        if (candidateNames is null)
            return BadRequest(new
            {
                errors = new[]
                {
                    $"{run.IndicatorFamily} ailesi için henüz uygulanabilir bir indikatör yok. " +
                    "Şu an yalnızca T3 (Level1) ve RSI parametreleri stratejiye aktarılabiliyor; " +
                    "diğer aileler analiz amaçlıdır."
                }
            });

        var indicator = await db.Indicators
            .Include(i => i.ParameterDefinitions)
            .FirstOrDefaultAsync(i => candidateNames.Contains(i.Name), ct);

        if (indicator is null)
            return NotFound(new
            {
                errors = new[] { $"Bu kurulumda {string.Join(" / ", candidateNames)} indikatörlerinden hiçbiri kayıtlı değil." }
            });

        var indicatorName = indicator.Name;

        var setting = await db.UserIndicatorSettings
            .Include(s => s.ParameterValues)
            .FirstOrDefaultAsync(s => s.UserId == CurrentUserId && s.IndicatorId == indicator.Id && s.CoinId == null, ct);

        if (setting is null)
        {
            setting = new UserIndicatorSetting
            {
                UserId = CurrentUserId,
                IndicatorId = indicator.Id,
                IsEnabled = true,
            };
            db.UserIndicatorSettings.Add(setting);
            await db.SaveChangesAsync(ct);
        }

        var applied = new List<string>();
        var definedKeys = indicator.ParameterDefinitions.Select(d => d.ParameterKey).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Optimizasyonun bulduğu her parametrenin indikatörde karşılığı olmayabilir
        // (örn. "kaç bar onay" T3'ün kendi ayarı değil, sinyal kuralının parçası).
        // Bunlar sessizce yutulmaz, kullanıcıya bildirilir.
        var skipped = paramsToApply.Keys.Where(k => !definedKeys.Contains(k)).ToList();

        foreach (var def in indicator.ParameterDefinitions)
        {
            if (!paramsToApply.TryGetValue(def.ParameterKey, out var value)) continue;

            var existing = setting.ParameterValues.FirstOrDefault(v => v.ParameterDefinitionId == def.Id);
            var text = def.DataType.Equals("int", StringComparison.OrdinalIgnoreCase)
                ? ((int)value).ToString(System.Globalization.CultureInfo.InvariantCulture)
                : value.ToString(System.Globalization.CultureInfo.InvariantCulture);

            if (existing is null)
            {
                db.UserIndicatorParameterValues.Add(new UserIndicatorParameterValue
                {
                    UserIndicatorSettingId = setting.Id,
                    ParameterDefinitionId = def.Id,
                    Value = text,
                });
            }
            else
            {
                existing.Value = text;
            }

            applied.Add($"{def.ParameterKey}={text}");
        }

        if (applied.Count == 0)
            return BadRequest(new
            {
                errors = new[] { $"{indicatorName} indikatörünün parametreleri optimizasyon sonucuyla eşleşmedi." }
            });

        await db.SaveChangesAsync(ct);

        var message = $"{indicatorName} indikatörü güncellendi: {string.Join(", ", applied)}.";
        if (skipped.Count > 0)
            message += $" Şu parametrelerin indikatörde karşılığı yok, uygulanmadı: {string.Join(", ", skipped)}"
                     + " — bunlar sinyal kuralının parçası, strateji ayarlarından elle girilmeli.";
        message += " Stratejiler sayfasından bu indikatörü kullanan stratejileri kontrol edin.";

        return Ok(new { indicator = indicatorName, applied, skipped, message });
    }

    /// <summary>
    /// Keşfedilen kuralı kullanıcının "Kendi İndikatörüm" ayarına yazar.
    /// Kuralın kendisi JSON olarak saklanır; CustomRuleIndicator bunu okuyup çalıştırır.
    /// </summary>
    private async Task<IActionResult> ApplyDiscoveredRuleAsync(
        IndicatorOptimization run, string? explicitRuleJson, CancellationToken ct)
    {
        var ruleJson = string.IsNullOrWhiteSpace(explicitRuleJson) ? run.BestParamsJson : explicitRuleJson;
        if (string.IsNullOrWhiteSpace(ruleJson))
            return BadRequest(new { errors = new[] { "Uygulanacak kural bulunamadı." } });

        var indicator = await db.Indicators
            .Include(i => i.ParameterDefinitions)
            .FirstOrDefaultAsync(i => i.Name == "CustomRule", ct);

        if (indicator is null)
            return NotFound(new
            {
                errors = new[] { "CustomRule indikatörü kayıtlı değil — veritabanı seed'i eksik olabilir." }
            });

        var def = indicator.ParameterDefinitions.FirstOrDefault(d => d.ParameterKey == "RuleJson");
        if (def is null)
            return NotFound(new { errors = new[] { "CustomRule indikatörünün RuleJson parametresi tanımlı değil." } });

        var setting = await db.UserIndicatorSettings
            .Include(s => s.ParameterValues)
            .FirstOrDefaultAsync(s => s.UserId == CurrentUserId && s.IndicatorId == indicator.Id && s.CoinId == null, ct);

        if (setting is null)
        {
            setting = new UserIndicatorSetting
            {
                UserId = CurrentUserId,
                IndicatorId = indicator.Id,
                IsEnabled = true,
            };
            db.UserIndicatorSettings.Add(setting);
            await db.SaveChangesAsync(ct);
        }

        var existing = setting.ParameterValues.FirstOrDefault(v => v.ParameterDefinitionId == def.Id);
        if (existing is null)
        {
            db.UserIndicatorParameterValues.Add(new UserIndicatorParameterValue
            {
                UserIndicatorSettingId = setting.Id,
                ParameterDefinitionId = def.Id,
                Value = ruleJson,
            });
        }
        else
        {
            existing.Value = ruleJson;
        }

        setting.IsEnabled = true;
        await db.SaveChangesAsync(ct);

        var text = DescribeSavedDefinition(ruleJson);

        return Ok(new
        {
            indicator = "CustomRule",
            applied = new[] { text },
            skipped = Array.Empty<string>(),
            message = $"Kendi indikatörünüz kaydedildi: {text}. "
                    + "İndikatörler sayfasında \"Kendi İndikatörüm\" olarak görünür; "
                    + "Analiz ve Backtest'te kullanabilirsiniz."
        });
    }

    /// <summary>Kaydedilen tanımı okunabilir metne çevirir (formül ya da koşul listesi).</summary>
    private static string DescribeSavedDefinition(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("kind", out var kind) && kind.GetString() == "formula")
            {
                var expr = doc.RootElement.GetProperty("expression").GetString() ?? "formül";
                var q = doc.RootElement.GetProperty("quantile").GetDouble();
                var gt = doc.RootElement.GetProperty("greaterThan").GetBoolean();
                return $"{expr} {(gt ? ">" : "<")} kendi {q * 100:0}. yüzdeliği";
            }
        }
        catch (JsonException) { /* koşul listesi olabilir */ }

        var rule = Infrastructure.Services.DiscoveredRule.FromJson(json);
        return rule is null
            ? "(tanım çözümlenemedi)"
            : string.Join(" VE ", rule.Conditions.Select(Infrastructure.Services.FeatureSet.Describe));
    }

    /// <summary>
    /// Kayıtlı sonuç listesini biçimden bağımsız okur. Bozuk/eski bir kayıt
    /// tüm sayfayı çökertmemeli — çözümlenemezse boş liste döner.
    /// </summary>
    private static List<OptimizationResultDto> ReadResults(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<OptimizationResultDto>>(json, CaseInsensitive) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static readonly JsonSerializerOptions CaseInsensitive = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // ─── DTO dönüşümleri ─────────────────────────────────────────────────────────

    private static MarketDataExportDto ToExportDto(MarketDataExport e) => new(
        e.Id, e.Name,
        JsonSerializer.Deserialize<List<string>>(e.Symbols) ?? [],
        e.SymbolCount, e.Timeframe, e.StartDate, e.EndDate, e.Format, e.IncludeIndicators,
        e.Status.ToString(), e.ProgressPct, e.ProcessedSymbols, e.TotalRows,
        e.FileSizeBytes, e.DataQualityNote, e.ErrorMessage, e.CreatedAt, e.CompletedAt);

    private static IndicatorOptimizationDto ToOptimizationDto(IndicatorOptimization o) => new(
        o.Id, o.Name,
        JsonSerializer.Deserialize<List<string>>(o.Symbols) ?? [],
        o.Timeframe, o.StartDate, o.EndDate, o.IndicatorFamily, o.CommissionPct,
        o.Status.ToString(), o.ProgressPct, o.TestedCombinations,
        o.BestParamsJson, o.BestReturnPct, o.BestWinRate, o.BestTradeCount,
        o.BuyHoldReturnPct, o.InSampleReturnPct, o.OutOfSampleReturnPct,
        o.Verdict, o.ErrorMessage, o.CreatedAt, o.CompletedAt);
}

// ─── İstek / yanıt modelleri ─────────────────────────────────────────────────────

public record MarketSymbolDto(
    string Symbol, string BaseAsset, decimal LastPrice,
    decimal PriceChangePercent, decimal QuoteVolume24h, int TradeCount24h);

public record TimeframeDto(string Key, string DisplayName, bool IsDerived, string SourceNote);

public record EstimateRequest(int SymbolCount, string Timeframe, DateTime StartDate, DateTime EndDate);

public record CreateExportRequest(
    string? Name, List<string> Symbols, string Timeframe,
    DateTime StartDate, DateTime EndDate,
    string Format = "csv", bool IncludeIndicators = true);

public record MarketDataExportDto(
    Guid Id, string Name, List<string> Symbols, int SymbolCount,
    string Timeframe, DateTime StartDate, DateTime EndDate,
    string Format, bool IncludeIndicators,
    string Status, int ProgressPct, int ProcessedSymbols, long TotalRows,
    long? FileSizeBytes, string? DataQualityNote, string? ErrorMessage,
    DateTime CreatedAt, DateTime? CompletedAt);

public record CreateOptimizationRequest(
    string? Name, List<string> Symbols, string Timeframe,
    DateTime StartDate, DateTime EndDate, string Family,
    decimal CommissionPct = 0.2m, Guid? MarketDataExportId = null);

public record IndicatorOptimizationDto(
    Guid Id, string Name, List<string> Symbols, string Timeframe,
    DateTime StartDate, DateTime EndDate, string Family, decimal CommissionPct,
    string Status, int ProgressPct, int TestedCombinations,
    string? BestParamsJson, decimal? BestReturnPct, decimal? BestWinRate, int? BestTradeCount,
    decimal? BuyHoldReturnPct, decimal? InSampleReturnPct, decimal? OutOfSampleReturnPct,
    string? Verdict, string? ErrorMessage, DateTime CreatedAt, DateTime? CompletedAt);

public record ApplyIndicatorRequest(Dictionary<string, decimal>? Parameters, string? RuleJson = null);

/// <summary>Optimizasyon sonucunun API'ye dönen biçimi (kayıtlı JSON buna okunur).</summary>
public record OptimizationResultDto(
    string Family,
    Dictionary<string, decimal> Parameters,
    string ParamsLabel,
    decimal ReturnPct,
    decimal BuyHoldPct,
    decimal EdgePct,
    decimal WinRate,
    int TradeCount,
    decimal MaxDrawdownPct,
    decimal InSamplePct,
    decimal OutOfSamplePct,
    int SymbolsBeatingBuyHold,
    int SymbolCount,
    /// <summary>Yalnızca AUTO ailesinde dolu — keşfedilen kuralın tanımı.</summary>
    string? RuleJson = null);
