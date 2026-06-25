using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Signals.Commands.ApproveSignal;

public record ApproveSignalCommand(Guid SignalId, Guid UserId) : IRequest<Result>;
