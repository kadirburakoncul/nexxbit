using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Backtest.Commands.DeleteBacktest;

public record DeleteBacktestCommand(Guid RunId, Guid UserId) : IRequest<Result>;

public class DeleteBacktestCommandHandler(IApplicationDbContext db)
    : IRequestHandler<DeleteBacktestCommand, Result>
{
    public async Task<Result> Handle(DeleteBacktestCommand request, CancellationToken ct)
    {
        var run = await db.BacktestRuns
            .FirstOrDefaultAsync(r => r.Id == request.RunId && r.UserId == request.UserId, ct);

        if (run is null)
            return Result.Failure("Backtest bulunamadı.");

        db.BacktestRuns.Remove(run);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
