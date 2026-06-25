namespace CriptoMoney.Domain.Enums;

public enum ReEntryState
{
    Normal = 0,         // Yeni alım için hazır
    WaitingForSell = 1, // Trailing/stop loss sonrası indikatör SAT bekliyor
    WaitingForBuy = 2,  // İndikatör SAT geldi, şimdi AL bekliyor
}
