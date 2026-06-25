using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Commands.SaveApiKey;

public record SaveBinanceApiKeyCommand(
    Guid UserId,
    string ApiKey,
    string ApiSecret,
    bool IsTestnet = false
) : IRequest<Result<SaveBinanceApiKeyResponse>>;

public record SaveBinanceApiKeyResponse(string ApiKeyHint, bool IsTestnet, DateTime ConnectedAt);
