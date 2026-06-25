using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class Notification : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Payload { get; set; }
    public NotificationChannel Channel { get; set; }
    public bool IsRead { get; set; } = false;
    public bool IsSent { get; set; } = false;
    public DateTime? SentAt { get; set; }
    public DateTime? ReadAt { get; set; }

    public User User { get; set; } = null!;
}
