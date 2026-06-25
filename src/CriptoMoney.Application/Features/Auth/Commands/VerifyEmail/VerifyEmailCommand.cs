using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.VerifyEmail;

public record VerifyEmailCommand(string Token) : IRequest<Result>;
