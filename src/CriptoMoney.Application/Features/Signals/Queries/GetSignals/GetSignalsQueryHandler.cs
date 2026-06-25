using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Signals.Queries.GetSignals;

public class GetSignalsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetSignalsQuery, Result<List<SignalDto>>>
{
    public async Task<Result<List<SignalDto>>> Handle(
        GetSignalsQuery request, CancellationToken cancellationToken)
    {
        var query = db.TradeSignals
            .Include(s => s.Coin)
            .Where(s => s.UserId == request.UserId);

        if (request.CoinId.HasValue)
            query = query.Where(s => s.CoinId == request.CoinId.Value);

        if (request.Direction.HasValue)
            query = query.Where(s => s.Direction == request.Direction.Value);

        var signals = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => new SignalDto(
                s.Id,
                s.CoinId,
                s.Coin.Symbol,
                s.Timeframe,
                s.Direction.ToString(),
                s.TotalScore,
                s.Price,
                s.CandleTime,
                s.IsActedUpon,
                s.IndicatorScores,
                s.CreatedAt))
            .ToListAsync(cancellationToken);

        return Result<List<SignalDto>>.Success(signals);
    }
}
