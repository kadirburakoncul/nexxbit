using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Signals.Queries.GetMultiTimeframeSignals;

public class GetMultiTimeframeSignalsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetMultiTimeframeSignalsQuery, Result<List<MultiTimeframeSignalDto>>>
{
    public async Task<Result<List<MultiTimeframeSignalDto>>> Handle(
        GetMultiTimeframeSignalsQuery request, CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow.AddHours(-request.Hours);

        // Her coin+timeframe kombinasyonu için en son sinyali al
        var signals = await db.TradeSignals
            .Include(s => s.Coin)
            .Where(s => s.UserId == request.UserId && s.CreatedAt >= since)
            .ToListAsync(cancellationToken);

        var grouped = signals
            .GroupBy(s => s.CoinId)
            .Select(coinGroup =>
            {
                var coin = coinGroup.First().Coin;
                var tfSignals = coinGroup
                    .GroupBy(s => s.Timeframe)
                    .Select(tfGroup =>
                    {
                        var latest = tfGroup.OrderByDescending(s => s.CandleTime).First();
                        return new TimeframeSignalDto(
                            latest.Timeframe,
                            latest.Direction.ToString(),
                            latest.TotalScore,
                            latest.Price,
                            latest.CandleTime);
                    })
                    .OrderBy(t => TimeframeOrder(t.Timeframe))
                    .ToList();

                var confluence = CalculateConfluence(tfSignals);

                return new MultiTimeframeSignalDto(
                    coin.Id,
                    coin.Symbol,
                    tfSignals,
                    confluence);
            })
            .OrderByDescending(d => ConfluenceRank(d.Confluence))
            .ThenBy(d => d.CoinSymbol)
            .ToList();

        return Result<List<MultiTimeframeSignalDto>>.Success(grouped);
    }

    private static int TimeframeOrder(string tf) => tf switch
    {
        "1m" => 1, "5m" => 2, "15m" => 3, "30m" => 4,
        "1h" => 5, "2h" => 6, "4h" => 7, "6h" => 8,
        "12h" => 9, "1d" => 10, "3d" => 11, "1w" => 12,
        _ => 99
    };

    private static string CalculateConfluence(List<TimeframeSignalDto> tfs)
    {
        if (tfs.Count == 0) return "NEUTRAL";
        var buyCount = tfs.Count(t => t.Direction == nameof(SignalDirection.Buy));
        var sellCount = tfs.Count(t => t.Direction == nameof(SignalDirection.Sell));
        var total = tfs.Count;

        var buyRatio = (double)buyCount / total;
        var sellRatio = (double)sellCount / total;

        if (buyRatio >= 0.8) return "STRONG_BUY";
        if (buyRatio >= 0.5) return "BUY";
        if (sellRatio >= 0.8) return "STRONG_SELL";
        if (sellRatio >= 0.5) return "SELL";
        return "NEUTRAL";
    }

    private static int ConfluenceRank(string c) => c switch
    {
        "STRONG_BUY" => 5,
        "BUY" => 4,
        "STRONG_SELL" => 3,
        "SELL" => 2,
        _ => 1
    };
}
