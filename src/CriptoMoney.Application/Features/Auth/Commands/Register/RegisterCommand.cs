using MediatR;
using CriptoMoney.Application.Common.Models;

namespace CriptoMoney.Application.Features.Auth.Commands.Register;

public record RegisterCommand(
    string Email,
    string Password,
    string FirstName,
    string LastName
) : IRequest<Result<RegisterResponse>>;

public record RegisterResponse(Guid UserId, string Email, string FullName);
