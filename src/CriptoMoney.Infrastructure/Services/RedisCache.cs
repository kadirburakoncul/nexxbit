using System.Text.Json;
using CriptoMoney.Application.Common.Interfaces;
using StackExchange.Redis;

namespace CriptoMoney.Infrastructure.Services;

public class RedisCache(IConnectionMultiplexer redis) : ICacheService
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key);
        if (!value.HasValue) return default;
        return JsonSerializer.Deserialize<T>((string)value!);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);
        await _db.StringSetAsync(key, json, expiry);
    }

    public Task RemoveAsync(string key, CancellationToken ct = default)
        => _db.KeyDeleteAsync(key);

    public Task<bool> ExistsAsync(string key, CancellationToken ct = default)
        => _db.KeyExistsAsync(key);
}
