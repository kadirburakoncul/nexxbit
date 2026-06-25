using System.Security.Claims;
using CriptoMoney.Application.Common.Interfaces;

namespace CriptoMoney.API.Middleware;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var claim = Principal?.FindFirst(ClaimTypes.NameIdentifier)
                        ?? Principal?.FindFirst("sub");
            return claim is not null && Guid.TryParse(claim.Value, out var id) ? id : null;
        }
    }

    public string? Email => Principal?.FindFirst(ClaimTypes.Email)?.Value
                            ?? Principal?.FindFirst("email")?.Value;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public bool IsAdmin => Principal?.IsInRole("Admin") == true;
}
