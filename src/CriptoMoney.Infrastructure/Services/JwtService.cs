using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CriptoMoney.Infrastructure.Services;

public class JwtService(IConfiguration configuration) : IJwtService
{
    private readonly string _secretKey = configuration["Jwt:SecretKey"]
        ?? throw new InvalidOperationException("Jwt:SecretKey yapılandırması eksik.");
    private readonly string _issuer = configuration["Jwt:Issuer"] ?? "CriptoMoney";
    private readonly string _audience = configuration["Jwt:Audience"] ?? "CriptoMoney";
    private readonly int _expiryMinutes = int.Parse(configuration["Jwt:ExpiryMinutes"] ?? "60");

    public DateTime AccessTokenExpiry => DateTime.UtcNow.AddMinutes(_expiryMinutes);

    public string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = AccessTokenExpiry;

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.CreateVersion7().ToString()),
            new Claim("firstName", user.FirstName),
            new Claim("lastName", user.LastName),
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: expiry,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}
