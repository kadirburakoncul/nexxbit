namespace CriptoMoney.Application.Common.Interfaces;

public interface IBacktestJobScheduler
{
    void Enqueue(Guid runId);
}
