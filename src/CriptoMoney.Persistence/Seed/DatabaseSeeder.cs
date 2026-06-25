using CriptoMoney.Domain.Entities;
using CriptoMoney.Domain.Enums;
using CriptoMoney.Persistence.Context;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Persistence.Seed;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        await SeedCoinsAsync(context);
        await SeedIndicatorsAsync(context);
    }

    private static async Task SeedCoinsAsync(AppDbContext context)
    {
        if (await context.Coins.AnyAsync()) return;

        var coins = new List<Coin>
        {
            new() { Symbol = "BTCUSDT", BaseAsset = "BTC", QuoteAsset = "USDT", DisplayName = "Bitcoin" },
            new() { Symbol = "ETHUSDT", BaseAsset = "ETH", QuoteAsset = "USDT", DisplayName = "Ethereum" },
            new() { Symbol = "BNBUSDT", BaseAsset = "BNB", QuoteAsset = "USDT", DisplayName = "BNB" },
            new() { Symbol = "SOLUSDT", BaseAsset = "SOL", QuoteAsset = "USDT", DisplayName = "Solana" },
            new() { Symbol = "XRPUSDT", BaseAsset = "XRP", QuoteAsset = "USDT", DisplayName = "XRP" },
        };

        await context.Coins.AddRangeAsync(coins);
        await context.SaveChangesAsync();
    }

    private static async Task SeedIndicatorsAsync(AppDbContext context)
    {
        if (await context.Indicators.AnyAsync()) return;

        var indicators = new List<Indicator>
        {
            new()
            {
                Name = "Tillson",
                DisplayName = "Easy İndikatör (T3)",
                Description = "Tillson T3 — düşük gecikmeli trend çizgisi. T3 yukarı döndüğünde AL, aşağı döndüğünde SAT sinyali üretir.",
                Category = "Trend",
                ClassName = "CriptoMoney.Infrastructure.Indicators.TillsonIndicator",
                DefaultWeight = 1.0m,
                IsSystemDefault = true,
                ParameterDefinitions =
                [
                    new() { ParameterKey = "Period", DisplayName = "T3 Periyot", DataType = "int", DefaultValue = "3", MinValue = "2", MaxValue = "20", SortOrder = 0 },
                    new() { ParameterKey = "Factor", DisplayName = "T3 Faktör", DataType = "decimal", DefaultValue = "0.7", MinValue = "0.1", MaxValue = "1.0", SortOrder = 1 }
                ]
            }
        };

        await context.Indicators.AddRangeAsync(indicators);
        await context.SaveChangesAsync();
    }
}
