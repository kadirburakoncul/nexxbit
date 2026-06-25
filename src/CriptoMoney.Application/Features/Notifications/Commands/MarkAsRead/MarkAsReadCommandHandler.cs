using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Notifications.Commands.MarkAsRead;

public class MarkAsReadCommandHandler(IApplicationDbContext db)
    : IRequestHandler<MarkAsReadCommand, Result>
{
    public async Task<Result> Handle(MarkAsReadCommand request, CancellationToken cancellationToken)
    {
        if (request.NotificationId.HasValue)
        {
            var n = await db.Notifications
                .FirstOrDefaultAsync(x => x.Id == request.NotificationId && x.UserId == request.UserId,
                    cancellationToken);

            if (n is null) return Result.Failure("Bildirim bulunamadı.");

            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
        }
        else
        {
            // Tüm okunmamış bildirimleri toplu güncelle
            await db.Notifications
                .Where(x => x.UserId == request.UserId && !x.IsRead)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(n => n.IsRead, true)
                    .SetProperty(n => n.ReadAt, DateTime.UtcNow),
                    cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
