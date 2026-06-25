using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Notifications.Queries.GetNotifications;

public record GetNotificationsQuery(
    Guid UserId,
    bool? UnreadOnly = null,
    int PageNumber = 1,
    int PageSize = 30
) : IRequest<Result<NotificationsResultDto>>;

public record NotificationsResultDto(
    List<NotificationDto> Items,
    int UnreadCount
);

public record NotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Body,
    string? Payload,
    bool IsRead,
    DateTime CreatedAt
);
