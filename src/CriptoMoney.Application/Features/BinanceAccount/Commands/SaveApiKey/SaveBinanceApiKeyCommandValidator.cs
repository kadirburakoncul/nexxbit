using FluentValidation;

namespace CriptoMoney.Application.Features.BinanceAccount.Commands.SaveApiKey;

public class SaveBinanceApiKeyCommandValidator : AbstractValidator<SaveBinanceApiKeyCommand>
{
    public SaveBinanceApiKeyCommandValidator()
    {
        RuleFor(x => x.ApiKey)
            .NotEmpty().WithMessage("API Key boş olamaz.")
            .Length(64).WithMessage("Binance API Key 64 karakter olmalıdır.");

        RuleFor(x => x.ApiSecret)
            .NotEmpty().WithMessage("API Secret boş olamaz.")
            .Length(64).WithMessage("Binance API Secret 64 karakter olmalıdır.");
    }
}
