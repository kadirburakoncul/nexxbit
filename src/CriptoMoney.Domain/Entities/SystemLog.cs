using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class SystemLog
{
    public long Id { get; set; }
    public AppLogLevel Level { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public Guid? UserId { get; set; }
    public string? CorrelationId { get; set; }
    public string? Context { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
