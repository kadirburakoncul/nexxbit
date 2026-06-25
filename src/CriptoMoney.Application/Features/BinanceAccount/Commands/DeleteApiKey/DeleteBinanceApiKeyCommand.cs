using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Commands.DeleteApiKey;

public record DeleteBinanceApiKeyCommand(Guid UserId) : IRequest<Result>;
