using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.Login;

public record LoginCommand(string Email, string Password) : IRequest<Result<LoginResponse>>;

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiry,
    Guid UserId,
    string Email,
    string FullName,
    string Role
);
