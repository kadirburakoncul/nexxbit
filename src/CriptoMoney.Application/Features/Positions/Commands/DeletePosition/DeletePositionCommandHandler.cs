using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Positions.Commands.DeletePosition;

public class DeletePositionCommandHandler(IApplicationDbContext db)
    : IRequestHandler<DeletePositionCommand, Result>,
      IRequestHandler<DeletePositionsCommand, Result>
{
    public async Task<Result> Handle(DeletePositionCommand request, CancellationToken ct)
    {
        var position = await db.Positions
            .FirstOrDefaultAsync(p => p.Id == request.PositionId && p.UserId == request.UserId, ct);

        if (position is null)
            return Result.Failure("Pozisyon bulunamadı.");

        await StopTrackingIfOpenAsync(position.UserId, position.CoinId, position.Status, ct);
        db.Positions.Remove(position);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> Handle(DeletePositionsCommand request, CancellationToken ct)
    {
        var positions = await db.Positions
            .Where(p => request.PositionIds.Contains(p.Id) && p.UserId == request.UserId)
            .ToListAsync(ct);

        foreach (var p in positions)
            await StopTrackingIfOpenAsync(p.UserId, p.CoinId, p.Status, ct);

        db.Positions.RemoveRange(positions);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // Açık pozisyon manuel silindiğinde re-entry durumunu Normal'e sıfırla
    // (WaitingForSell'e çekmek yanlış: kullanıcı pozisyonu silince yeniden normal akış başlamalı)
    private async Task StopTrackingIfOpenAsync(Guid userId, int coinId, PositionStatus status, CancellationToken ct)
    {
        if (status != PositionStatus.Open) return;

        var strategyCoin = await db.UserStrategyCoins
            .Include(sc => sc.UserStrategy)
            .FirstOrDefaultAsync(sc =>
                sc.CoinId == coinId &&
                sc.UserStrategy.UserId == userId &&
                sc.UserStrategy.IsActive, ct);

        if (strategyCoin is not null)
        {
            strategyCoin.ReEntryState = ReEntryState.Normal;
            await db.SaveChangesAsync(ct);
        }
    }
}
