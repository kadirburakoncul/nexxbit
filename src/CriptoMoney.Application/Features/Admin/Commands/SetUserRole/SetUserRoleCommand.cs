using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Admin.Commands.SetUserRole;

public record SetUserRoleCommand(Guid TargetUserId, UserRole Role) : IRequest<Result>;
