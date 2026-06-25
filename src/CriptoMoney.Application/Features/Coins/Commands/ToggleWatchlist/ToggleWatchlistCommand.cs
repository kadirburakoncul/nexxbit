using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.Coins.Commands.ToggleWatchlist;

public record ToggleWatchlistCommand(Guid UserId, int CoinId) : IRequest<Result<bool>>;
// Result<bool>: true = eklendi, false = kaldırıldı
