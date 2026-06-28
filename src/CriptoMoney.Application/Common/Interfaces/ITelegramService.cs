namespace CriptoMoney.Application.Common.Interfaces;

public interface ITelegramService
{
    Task SendAsync(string botToken, string chatId, string message, CancellationToken ct = default);
    Task<bool> TestAsync(string botToken, string chatId, CancellationToken ct = default);
}
