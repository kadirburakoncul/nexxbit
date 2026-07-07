using System.Security.Cryptography;
using System.Text;

namespace CriptoMoney.Application.Common.Security;

/// <summary>
/// Refresh token / şifre sıfırlama token'ları DB'de düz metin tutulmasın diye hash'ler.
/// DB sızıntısı olsa bile token'lar doğrudan kullanılamaz hale gelir.
/// Token'ların kendisi zaten kriptografik olarak rastgele üretildiği için tuzlamaya (salt) gerek yok.
/// </summary>
public static class TokenHasher
{
    public static string Hash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }
}
