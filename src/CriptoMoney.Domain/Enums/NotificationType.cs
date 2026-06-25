namespace CriptoMoney.Domain.Enums;

public enum NotificationType
{
    BuySignal = 0,
    SellSignal = 1,
    StopLoss = 2,
    TakeProfit = 3,
    OrderFilled = 4,
    BinanceError = 5,
    DailyReport = 6,
    RiskAlert = 7,
    FlashCrash = 8,
    System = 9
}
