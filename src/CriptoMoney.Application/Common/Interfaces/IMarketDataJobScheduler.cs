namespace CriptoMoney.Application.Common.Interfaces;

public interface IMarketDataJobScheduler
{
    void EnqueueExport(Guid exportId);
    void EnqueueOptimization(Guid optimizationId);
}
