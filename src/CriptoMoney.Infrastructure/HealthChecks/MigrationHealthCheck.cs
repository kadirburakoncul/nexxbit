using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CriptoMoney.Infrastructure.HealthChecks;

public class MigrationHealthCheck : IHealthCheck
{
    private static Exception? _lastError;
    private static bool _migrationCompleted;

    public static void ReportSuccess() => _migrationCompleted = true;
    public static void ReportFailure(Exception ex) => _lastError = ex;

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        if (_migrationCompleted)
            return Task.FromResult(HealthCheckResult.Healthy("Migrations OK"));

        if (_lastError is not null)
            return Task.FromResult(HealthCheckResult.Degraded($"Migration failed: {_lastError.Message}"));

        return Task.FromResult(HealthCheckResult.Degraded("Migration not yet completed"));
    }
}
