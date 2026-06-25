using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Admin.Queries.GetDashboard;

public class GetDashboardQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetDashboardQuery, Result<AdminDashboardDto>>
{
    public async Task<Result<AdminDashboardDto>> Handle(
        GetDashboardQuery request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;

        var totalUsers = await db.Users.IgnoreQueryFilters().CountAsync(cancellationToken);
        var activeUsers = await db.Users.CountAsync(cancellationToken); // soft-delete filter aktif
        var binanceConnected = await db.UserBinanceAccounts.CountAsync(a => a.IsActive, cancellationToken);
        var signalsToday = await db.TradeSignals.CountAsync(s => s.CreatedAt >= today, cancellationToken);
        var ordersToday = await db.TradeOrders.CountAsync(o => o.CreatedAt >= today, cancellationToken);
        var activeBacktests = await db.BacktestRuns.CountAsync(
            b => b.Status == BacktestStatus.Running || b.Status == BacktestStatus.Pending,
            cancellationToken);
        var totalBacktests = await db.BacktestRuns.CountAsync(cancellationToken);

        return Result<AdminDashboardDto>.Success(new AdminDashboardDto(
            totalUsers,
            activeUsers,
            binanceConnected,
            signalsToday,
            ordersToday,
            activeBacktests,
            totalBacktests));
    }
}
