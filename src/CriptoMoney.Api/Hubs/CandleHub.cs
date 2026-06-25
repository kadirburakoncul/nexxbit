using CriptoMoney.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CriptoMoney.API.Hubs;

[Authorize]
public class CandleHub(IBinanceStreamService streamService) : Hub
{
    public async Task JoinRoom(string symbol, string interval)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomKey(symbol, interval));
        await streamService.SubscribeAsync(symbol, interval);
    }

    public async Task LeaveRoom(string symbol, string interval)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomKey(symbol, interval));
    }

    public static string RoomKey(string symbol, string interval) => $"{symbol}_{interval}";
}
