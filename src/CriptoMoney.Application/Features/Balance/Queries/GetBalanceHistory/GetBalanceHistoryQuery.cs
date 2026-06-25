using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Balance.Queries.GetBalanceHistory;

public record GetBalanceHistoryQuery(Guid UserId, int Days = 30) : IRequest<Result<List<BalanceSnapshotDto>>>;

public record BalanceSnapshotDto(
    decimal TotalValueUsdt,
    string Assets,
    DateTime SnapshotAt
);
