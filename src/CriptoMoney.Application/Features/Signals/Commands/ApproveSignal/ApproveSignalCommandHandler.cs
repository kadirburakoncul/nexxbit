using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Signals.Commands.ApproveSignal;

public class ApproveSignalCommandHandler(IAutoTradeService autoTradeService)
    : IRequestHandler<ApproveSignalCommand, Result>
{
    public Task<Result> Handle(ApproveSignalCommand request, CancellationToken cancellationToken)
        => autoTradeService.ApproveSignalAsync(request.SignalId, request.UserId, cancellationToken);
}
