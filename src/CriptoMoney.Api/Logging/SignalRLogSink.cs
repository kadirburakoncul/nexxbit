using CriptoMoney.API.Hubs;
using Microsoft.AspNetCore.SignalR;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Display;

namespace CriptoMoney.API.Logging;

/// <summary>
/// Serilog sink'i: her log olayını LogHub üzerinden admin kullanıcılara yayınlar.
/// IHubContext Singleton-safe olduğundan Serilog sink olarak güvenle kullanılabilir.
/// </summary>
public class SignalRLogSink(
    IHubContext<LogHub> hubContext,
    LogEventLevel minimumLevel = LogEventLevel.Information)
    : ILogEventSink
{
    private readonly MessageTemplateTextFormatter _formatter = new(
        "[{Level:u3}] {Timestamp:HH:mm:ss} {SourceContext:l} {Message:lj}{NewLine}{Exception}",
        null);

    public void Emit(LogEvent logEvent)
    {
        if (logEvent.Level < minimumLevel) return;

        // Serilog sink'i sync çağrı — fire-and-forget
        var writer = new StringWriter();
        _formatter.Format(logEvent, writer);

        var entry = new LogEntry(
            logEvent.Timestamp.UtcDateTime,
            logEvent.Level.ToString(),
            writer.ToString().TrimEnd(),
            logEvent.Properties.TryGetValue("SourceContext", out var ctx) ? ctx.ToString().Trim('"') : null,
            logEvent.Exception?.Message);

        _ = hubContext.Clients.Group(LogHub.Group).SendAsync("log", entry);
    }
}

public record LogEntry(
    DateTime Timestamp,
    string Level,
    string Message,
    string? Source,
    string? Exception
);
