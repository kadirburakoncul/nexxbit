using Binance.Net;
using Binance.Net.Clients;
using CryptoExchange.Net.Authentication;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Per-request Binance REST client. Stateless — caller disposes.
/// </summary>
public static class BinanceClientFactory
{
    public static BinanceRestClient CreateRest(string apiKey, string apiSecret, bool isTestnet)
    {
        var client = new BinanceRestClient(opts =>
        {
            opts.ApiCredentials = new ApiCredentials(apiKey, apiSecret);
            if (isTestnet)
                opts.Environment = BinanceEnvironment.Testnet;
        });
        return client;
    }

    public static BinanceRestClient CreatePublicRest()
    {
        return new BinanceRestClient();
    }
}
