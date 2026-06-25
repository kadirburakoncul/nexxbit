using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Admin.Commands.SoftDeleteUser;

public record SoftDeleteUserCommand(Guid TargetUserId, bool Restore = false) : IRequest<Result>;
