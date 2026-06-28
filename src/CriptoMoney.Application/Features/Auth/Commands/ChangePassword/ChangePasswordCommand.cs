using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Auth.Commands.ChangePassword;

public record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword)
    : IRequest<Result>;
