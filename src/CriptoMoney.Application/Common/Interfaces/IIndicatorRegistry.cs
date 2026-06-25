namespace CriptoMoney.Application.Common.Interfaces;

public interface IIndicatorRegistry
{
    IIndicator? Resolve(string name);
    IReadOnlyList<IIndicator> GetAll();
}
