using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Notifications.Queries.GetNotifications;

public class GetNotificationsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetNotificationsQuery, Result<NotificationsResultDto>>
{
    public async Task<Result<NotificationsResultDto>> Handle(
        GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Notifications.Where(n => n.UserId == request.UserId);

        if (request.UnreadOnly == true)
            query = query.Where(n => !n.IsRead);

        var unreadCount = await db.Notifications
            .CountAsync(n => n.UserId == request.UserId && !n.IsRead, cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(n => new NotificationDto(
                n.Id,
                n.Type.ToString(),
                n.Title,
                n.Body,
                n.Payload,
                n.IsRead,
                n.CreatedAt))
            .ToListAsync(cancellationToken);

        return Result<NotificationsResultDto>.Success(new NotificationsResultDto(items, unreadCount));
    }
}
