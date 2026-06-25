using CriptoMoney.Application.Common.Models;
using MediatR;

namespace CriptoMoney.Application.Features.RiskSettings.Commands.UpdateCoinLists;

public record UpdateCoinListsCommand(
    Guid UserId,
    List<int> AllowedCoinIds,   // Boş liste = tümüne izin ver
    List<int> BlockedCoinIds    // Boş liste = hiçbirini engelleme
) : IRequest<Result>;
