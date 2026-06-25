using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.Infrastructure.Indicators;

public class IndicatorRegistry(IEnumerable<IIndicator> indicators) : IIndicatorRegistry
{
    private readonly IReadOnlyDictionary<string, IIndicator> _map =
        indicators.ToDictionary(i => i.Name, StringComparer.OrdinalIgnoreCase);

    public IIndicator? Resolve(string name)
        => _map.TryGetValue(name, out var ind) ? ind : null;

    public IReadOnlyList<IIndicator> GetAll()
        => [.. _map.Values];
}
