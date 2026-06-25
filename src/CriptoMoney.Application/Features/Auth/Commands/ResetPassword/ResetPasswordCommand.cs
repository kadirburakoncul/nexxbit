using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.ResetPassword;

public record ResetPasswordCommand(string Token, string NewPassword) : IRequest<Result>;
