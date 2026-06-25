using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CriptoMoney.API.Hubs;

/// <summary>
/// Admin kullanıcılarına gerçek zamanlı uygulama loglarını yayınlar.
/// Serilog SignalRSink tarafından push edilir.
/// </summary>
[Authorize(Roles = "Admin")]
public class LogHub : Hub
{
    public const string Group = "log-subscribers";

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, Group);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, Group);
        await base.OnDisconnectedAsync(exception);
    }
}
