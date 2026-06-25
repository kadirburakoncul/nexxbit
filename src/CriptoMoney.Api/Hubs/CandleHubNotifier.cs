using CriptoMoney.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CriptoMoney.API.Hubs;

public class CandleHubNotifier(IHubContext<CandleHub> hubContext) : ICandleHubNotifier
{
    public Task SendCandleUpdateAsync(string symbol, string interval, object payload)
        => hubContext.Clients.Group(CandleHub.RoomKey(symbol, interval))
                     .SendAsync("CandleUpdate", payload);
}
