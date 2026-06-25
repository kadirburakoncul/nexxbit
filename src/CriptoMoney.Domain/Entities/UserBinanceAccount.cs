namespace CriptoMoney.Domain.Entities;

public class UserBinanceAccount : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public string ApiKeyEncrypted { get; set; } = string.Empty;
    public string ApiSecretEncrypted { get; set; } = string.Empty;
    public string ApiKeyHint { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsTestnet { get; set; } = false;
    public DateTime? LastConnectionAt { get; set; }
    public string? LastConnectionStatus { get; set; }
    public string? ConnectionErrorMessage { get; set; }

    public User User { get; set; } = null!;
}
