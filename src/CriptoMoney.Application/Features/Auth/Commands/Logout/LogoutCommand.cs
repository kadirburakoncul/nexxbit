using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.Logout;

public record LogoutCommand(Guid UserId) : IRequest<Result>;
