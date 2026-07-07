using CriptoMoney.Application.Common.Models;

namespace CriptoMoney.Application.Common.Interfaces;

public record BistCandle(
    DateTime OpenTime, decimal Open, decimal High, decimal Low, decimal Close, decimal Volume);

/// <summary>
/// BIST hisseleri için ücretsiz, gecikmeli (~15-20dk) piyasa verisi.
/// Yahoo Finance'in resmi olmayan chart endpoint'ini kullanır — al-sat amaçlı DEĞİL, sadece sinyal/izleme.
/// </summary>
public record BistQuote(string Symbol, string DisplayName, decimal? Price, decimal? ChangePercent);

public interface IBistDataService
{
    Task<Result<List<BistCandle>>> GetCandlesAsync(string symbol, string interval, int limit, CancellationToken ct = default);
    Task<decimal?> GetCurrentPriceAsync(string symbol, CancellationToken ct = default);
    Task<List<BistQuote>> GetBulkQuotesAsync(IEnumerable<string> symbols, CancellationToken ct = default);
}
