using CriptoMoney.Domain.Entities;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    DateTime AccessTokenExpiry { get; }
}
