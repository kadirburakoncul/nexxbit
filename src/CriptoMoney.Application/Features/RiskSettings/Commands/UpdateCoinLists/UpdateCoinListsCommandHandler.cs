using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.RiskSettings.Commands.UpdateCoinLists;

public class UpdateCoinListsCommandHandler(IApplicationDbContext db)
    : IRequestHandler<UpdateCoinListsCommand, Result>
{
    public async Task<Result> Handle(UpdateCoinListsCommand request, CancellationToken cancellationToken)
    {
        var risk = await db.UserRiskSettings
            .FirstOrDefaultAsync(r => r.UserId == request.UserId, cancellationToken);

        if (risk is null)
            return Result.Failure("Risk ayarları bulunamadı.");

        // Girilen coin ID'lerinin DB'de var olduğunu doğrula
        var allRequestedIds = request.AllowedCoinIds.Concat(request.BlockedCoinIds).Distinct().ToList();
        if (allRequestedIds.Count > 0)
        {
            var existingIds = await db.Coins
                .Where(c => allRequestedIds.Contains(c.Id))
                .Select(c => c.Id)
                .ToListAsync(cancellationToken);

            var missing = allRequestedIds.Except(existingIds).ToList();
            if (missing.Count > 0)
                return Result.Failure($"Geçersiz coin ID'leri: {string.Join(", ", missing)}");
        }

        // Aynı coin hem whitelist hem blacklist'te olamaz
        var overlap = request.AllowedCoinIds.Intersect(request.BlockedCoinIds).ToList();
        if (overlap.Count > 0)
            return Result.Failure($"Bir coin hem izin verilenler hem engellenenler listesinde olamaz. ID: {string.Join(", ", overlap)}");

        risk.AllowedCoinIds = request.AllowedCoinIds.Count > 0
            ? JsonSerializer.Serialize(request.AllowedCoinIds)
            : null;

        risk.BlockedCoinIds = request.BlockedCoinIds.Count > 0
            ? JsonSerializer.Serialize(request.BlockedCoinIds)
            : null;

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
