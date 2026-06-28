using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class User : SoftDeleteEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsEmailVerified { get; set; } = false;
    public bool SkipLoginOtp { get; set; } = false;
    public string? LoginOtpCode { get; set; }
    public DateTime? LoginOtpExpiry { get; set; }
    public string? EmailVerifyToken { get; set; }
    public DateTime? EmailVerifyTokenExpiry { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiry { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public UserBinanceAccount? BinanceAccount { get; set; }
    public UserRiskSettings? RiskSettings { get; set; }
    public ICollection<UserWatchlist> Watchlist { get; set; } = [];
    public ICollection<UserStrategy> Strategies { get; set; } = [];
    public ICollection<UserIndicatorSetting> IndicatorSettings { get; set; } = [];
    public ICollection<TradeSignal> Signals { get; set; } = [];
    public ICollection<TradeOrder> Orders { get; set; } = [];
    public ICollection<Position> Positions { get; set; } = [];
    public ICollection<BacktestRun> BacktestRuns { get; set; } = [];
    public ICollection<Notification> Notifications { get; set; } = [];
    public ICollection<BalanceSnapshot> BalanceSnapshots { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}";
}
