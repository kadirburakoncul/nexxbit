using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Backtest.Commands.StartBacktest;

public record StartBacktestCommand(
    Guid UserId,
    string? Name,
    List<int> CoinIds,
    string Timeframe,
    DateTime StartDate,
    DateTime EndDate,
    decimal InitialCapital,
    decimal CommissionRate,
    decimal? StopLossPct,
    decimal? TakeProfitPct,
    string StrategyConfig   // BacktestConfig JSON
) : IRequest<Result<Guid>>;
