namespace CriptoMoney.Application.Common.Interfaces;

public interface ICandleHubNotifier
{
    Task SendCandleUpdateAsync(string symbol, string interval, object payload);
}
