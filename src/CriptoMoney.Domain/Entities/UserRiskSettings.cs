using CriptoMoney.Domain.Enums;

namespace CriptoMoney.Domain.Entities;

public class UserRiskSettings : BaseEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public TradeMode TradeMode { get; set; } = TradeMode.SignalOnly;
    public decimal? MaxDailyLossUsdt { get; set; }
    public decimal? MaxDailyLossPct { get; set; }
    public int MaxOpenPositions { get; set; } = 5;
    public decimal? MaxPositionSizeUsdt { get; set; }
    public decimal? MaxPositionSizePct { get; set; } = 10.0m;
    public decimal? DefaultStopLossPct { get; set; }
    public decimal? DefaultTakeProfitPct { get; set; }
    public bool IsStopLossRequired { get; set; } = true;
    public bool CloseOnDisconnect { get; set; } = true;
    public bool IsAutoTradeEnabled { get; set; } = false;
    public string? AllowedCoinIds { get; set; }
    public string? BlockedCoinIds { get; set; }
    public decimal DailyLossUsedUsdt { get; set; } = 0;
    public DateTime? DailyLossResetAt { get; set; }

    // Flash crash koruma: BTC/USDT N dakikada % düşünce otomatik trade duraklar
    public bool FlashCrashProtectionEnabled { get; set; } = true;
    public decimal FlashCrashDropPct { get; set; } = 5.0m;   // Eşik (% düşüş)
    public int FlashCrashWindowMinutes { get; set; } = 15;    // Zaman penceresi
    public bool AutoTradePaused { get; set; } = false;
    public DateTime? AutoTradePausedAt { get; set; }

    // Telegram bildirimleri
    public string? TelegramBotToken { get; set; }
    public string? TelegramChatId { get; set; }
    public bool TelegramEnabled { get; set; } = false;

    public User User { get; set; } = null!;
}
