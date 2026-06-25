using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Notifications.Commands.MarkAsRead;

/// <summary>NotificationId null ise tüm bildirimleri okundu işaretler.</summary>
public record MarkAsReadCommand(Guid UserId, Guid? NotificationId) : IRequest<Result>;
