using System.Net.Http.Json;
using CriptoMoney.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class TelegramService(IHttpClientFactory httpClientFactory, ILogger<TelegramService> logger)
    : ITelegramService
{
    public async Task SendAsync(string botToken, string chatId, string message, CancellationToken ct = default)
    {
        try
        {
            var client = httpClientFactory.CreateClient("telegram");
            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var payload = new { chat_id = chatId, text = message, parse_mode = "HTML" };
            var response = await client.PostAsJsonAsync(url, payload, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Telegram gönderimi başarısız: {Status} {Body}", response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram gönderimi exception");
        }
    }

    public async Task<bool> TestAsync(string botToken, string chatId, CancellationToken ct = default)
    {
        try
        {
            var client = httpClientFactory.CreateClient("telegram");
            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var payload = new { chat_id = chatId, text = "✅ <b>Nexxbit</b> Telegram bildirimleri aktif!", parse_mode = "HTML" };
            var response = await client.PostAsJsonAsync(url, payload, ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
