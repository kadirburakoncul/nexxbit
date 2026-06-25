using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.RefreshToken;

public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<RefreshTokenResponse>>;

public record RefreshTokenResponse(string AccessToken, DateTime AccessTokenExpiry);
