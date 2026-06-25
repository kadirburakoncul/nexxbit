using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Entities;
using MediatR;

namespace CriptoMoney.Application.Features.BinanceAccount.Commands.SaveApiKey;

public class SaveBinanceApiKeyCommandHandler(
    IUnitOfWork uow,
    IBinanceService binanceService,
    IEncryptionService encryption)
    : IRequestHandler<SaveBinanceApiKeyCommand, Result<SaveBinanceApiKeyResponse>>
{
    public async Task<Result<SaveBinanceApiKeyResponse>> Handle(
        SaveBinanceApiKeyCommand request, CancellationToken cancellationToken)
    {
        // Bağlantıyı kaydetmeden önce test et
        var testResult = await binanceService.TestConnectionAsync(
            request.ApiKey, request.ApiSecret, request.IsTestnet, cancellationToken);

        if (!testResult.Succeeded)
            return Result<SaveBinanceApiKeyResponse>.Failure(testResult.Errors);

        var account = await uow.UserBinanceAccounts.FirstOrDefaultAsync(
            a => a.UserId == request.UserId, cancellationToken);

        var encryptedKey = encryption.Encrypt(request.ApiKey);
        var encryptedSecret = encryption.Encrypt(request.ApiSecret);
        var hint = request.ApiKey[^4..];
        var now = DateTime.UtcNow;

        if (account is null)
        {
            account = new UserBinanceAccount
            {
                UserId = request.UserId,
                ApiKeyEncrypted = encryptedKey,
                ApiSecretEncrypted = encryptedSecret,
                ApiKeyHint = hint,
                IsTestnet = request.IsTestnet,
                LastConnectionAt = now,
            };
            uow.UserBinanceAccounts.Add(account);
        }
        else
        {
            account.ApiKeyEncrypted = encryptedKey;
            account.ApiSecretEncrypted = encryptedSecret;
            account.ApiKeyHint = hint;
            account.IsTestnet = request.IsTestnet;
            account.LastConnectionAt = now;
            account.ConnectionErrorMessage = null;
            uow.UserBinanceAccounts.Update(account);
        }

        await uow.CommitAsync(cancellationToken);
        return Result<SaveBinanceApiKeyResponse>.Success(new SaveBinanceApiKeyResponse(hint, request.IsTestnet, now));
    }
}
