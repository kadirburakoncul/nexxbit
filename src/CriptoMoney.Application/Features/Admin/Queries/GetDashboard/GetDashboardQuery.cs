using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Admin.Queries.GetDashboard;

public record GetDashboardQuery : IRequest<Result<AdminDashboardDto>>;

public record AdminDashboardDto(
    int TotalUsers,
    int ActiveUsers,
    int ConnectedBinanceUsers,
    int TotalSignalsToday,
    int TotalOrdersToday,
    int ActiveBacktests,
    int TotalBacktests
);
