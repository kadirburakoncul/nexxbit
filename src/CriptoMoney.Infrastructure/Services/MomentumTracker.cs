using System.Collections.Concurrent;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// Hangi coinin momentum listesine ne zaman girdiğini takip eder.
/// Singleton — bellek içi, yeniden başlatmada sıfırlanır (kabul edilebilir).
/// </summary>
public class MomentumTracker
{
    // (userId, strategyId, symbol) → listeye ilk girdiği an
    private readonly ConcurrentDictionary<(Guid, Guid, string), DateTime> _firstSeen = new();

    // (userId, strategyId) → önceki çalışmada listedeki semboller
    private readonly ConcurrentDictionary<(Guid, Guid), HashSet<string>> _previousSymbols = new();

    /// <summary>
    /// Güncel momentum listesini alır; yeni girenlerin first-seen zamanını kaydeder,
    /// listeden çıkanları temizler. Filtre aktifse sadece son N dakikada girenleri döner.
    /// </summary>
    public IReadOnlyList<string> UpdateAndFilter(
        Guid userId, Guid strategyId,
        IReadOnlyList<string> currentSymbols,
        int freshWindowMinutes)
    {
        var key = (userId, strategyId);
        var now = DateTime.UtcNow;

        var previous = _previousSymbols.GetOrAdd(key, _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        var currentSet = new HashSet<string>(currentSymbols, StringComparer.OrdinalIgnoreCase);

        // Yeni girenler → first-seen kaydı
        foreach (var sym in currentSet)
        {
            if (!previous.Contains(sym))
                _firstSeen.TryAdd((userId, strategyId, sym), now);
        }

        // Listeden çıkanları temizle
        foreach (var sym in previous)
        {
            if (!currentSet.Contains(sym))
                _firstSeen.TryRemove((userId, strategyId, sym), out _);
        }

        _previousSymbols[key] = currentSet;

        // Filtre kapalıysa hepsini döndür
        if (freshWindowMinutes <= 0)
            return currentSymbols.ToList();

        var cutoff = now.AddMinutes(-freshWindowMinutes);
        return currentSymbols
            .Where(sym => _firstSeen.TryGetValue((userId, strategyId, sym), out var t) && t >= cutoff)
            .ToList();
    }
}
