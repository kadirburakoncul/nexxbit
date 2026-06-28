using CriptoMoney.Application.Common.Models;
using CriptoMoney.Domain.Enums;
using MediatR;

namespace CriptoMoney.Application.Features.Admin.Queries.GetUsers;

public record GetUsersQuery(
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 20
) : IRequest<Result<AdminUsersResultDto>>;

public record AdminUsersResultDto(List<AdminUserDto> Items, int TotalCount);

public record AdminUserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    UserRole Role,
    bool IsEmailVerified,
    bool SkipLoginOtp,
    bool IsDeleted,
    bool HasBinanceAccount,
    DateTime CreatedAt,
    DateTime? LastLoginAt
);
