using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IAutoTradeService
{
    /// <summary>
    /// Üretilen sinyale göre kullanıcının TradeMode'una uygun eylemi gerçekleştirir.
    /// SignalOnly  → sadece kaydet
    /// ManualApproval → kaydet + bildirim
    /// FullAuto    → kaydet + Binance'e emir gönder
    /// </summary>
    Task ProcessSignalAsync(TradeSignal signal, CancellationToken ct = default);

    /// <summary>ManualApproval modunda bekleyen sinyali onayla → emir gönder.</summary>
    Task<Result> ApproveSignalAsync(Guid signalId, Guid userId, CancellationToken ct = default);
}
