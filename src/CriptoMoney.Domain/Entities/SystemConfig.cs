namespace CriptoMoney.Domain.Entities;

public class SystemConfig
{
    public int Id { get; set; } = 1;
    public bool RequireLoginOtp { get; set; } = false;
}
