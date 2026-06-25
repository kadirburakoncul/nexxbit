using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Positions.Commands.ClosePosition;

public record ClosePositionCommand(Guid PositionId, Guid UserId) : IRequest<Result>;
