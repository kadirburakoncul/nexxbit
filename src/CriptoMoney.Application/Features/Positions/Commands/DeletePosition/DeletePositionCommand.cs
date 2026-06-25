using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Positions.Commands.DeletePosition;

public record DeletePositionCommand(Guid PositionId, Guid UserId) : IRequest<Result>;

public record DeletePositionsCommand(List<Guid> PositionIds, Guid UserId) : IRequest<Result>;
