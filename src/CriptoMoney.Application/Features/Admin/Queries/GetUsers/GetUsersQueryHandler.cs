using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Application.Features.Admin.Queries.GetUsers;

public class GetUsersQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetUsersQuery, Result<AdminUsersResultDto>>
{
    public async Task<Result<AdminUsersResultDto>> Handle(
        GetUsersQuery request, CancellationToken cancellationToken)
    {
        // Admin panelde silinmiş kullanıcılar da görünür — global filter'ı bypass ediyoruz
        var query = db.Users.IgnoreQueryFilters()
            .Include(u => u.BinanceAccount)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.ToLower();
            query = query.Where(u =>
                u.Email.ToLower().Contains(s) ||
                u.FirstName.ToLower().Contains(s) ||
                u.LastName.ToLower().Contains(s));
        }

        var total = await query.CountAsync(cancellationToken);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(u => new AdminUserDto(
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.Role,
                u.IsEmailVerified,
                u.IsDeleted,
                u.BinanceAccount != null,
                u.CreatedAt,
                u.LastLoginAt))
            .ToListAsync(cancellationToken);

        return Result<AdminUsersResultDto>.Success(new AdminUsersResultDto(users, total));
    }
}
