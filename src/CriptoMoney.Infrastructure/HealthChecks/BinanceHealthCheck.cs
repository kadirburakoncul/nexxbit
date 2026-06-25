using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CriptoMoney.Infrastructure.HealthChecks;

public class BinanceHealthCheck : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var resp = await http.GetAsync("https://api.binance.com/api/v3/ping", cancellationToken);
            return resp.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("Binance API erişilebilir")
                : HealthCheckResult.Degraded($"Binance API HTTP {(int)resp.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Binance API erişilemiyor", ex);
        }
    }
}
