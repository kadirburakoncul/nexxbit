using System.Security.Cryptography;
using System.Text;
using CriptoMoney.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CriptoMoney.Infrastructure.Services;

/// <summary>
/// AES-256-CBC with HMAC-SHA256 authentication (encrypt-then-MAC).
/// Master key lives in env var / Azure Key Vault, never in DB.
/// </summary>
public class EncryptionService(IConfiguration configuration) : IEncryptionService
{
    private readonly byte[] _masterKey = Convert.FromBase64String(
        configuration["Encryption:MasterKey"]
        ?? throw new InvalidOperationException("Encryption:MasterKey yapılandırması eksik."));

    public string Encrypt(string plaintext)
    {
        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Mode = CipherMode.CBC;
        aes.GenerateIV();

        var encKey = DeriveKey(_masterKey, "enc", 32);
        var macKey = DeriveKey(_masterKey, "mac", 32);

        aes.Key = encKey;
        byte[] cipherBytes;

        using (var encryptor = aes.CreateEncryptor())
        using (var ms = new MemoryStream())
        {
            using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
            using (var sw = new StreamWriter(cs, Encoding.UTF8))
                sw.Write(plaintext);
            cipherBytes = ms.ToArray();
        }

        var payload = new byte[aes.IV.Length + cipherBytes.Length];
        Buffer.BlockCopy(aes.IV, 0, payload, 0, aes.IV.Length);
        Buffer.BlockCopy(cipherBytes, 0, payload, aes.IV.Length, cipherBytes.Length);

        using var hmac = new HMACSHA256(macKey);
        var mac = hmac.ComputeHash(payload);

        var result = new byte[payload.Length + mac.Length];
        Buffer.BlockCopy(payload, 0, result, 0, payload.Length);
        Buffer.BlockCopy(mac, 0, result, payload.Length, mac.Length);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string ciphertext)
    {
        var data = Convert.FromBase64String(ciphertext);

        var encKey = DeriveKey(_masterKey, "enc", 32);
        var macKey = DeriveKey(_masterKey, "mac", 32);

        const int macLen = 32;
        var payload = data[..^macLen];
        var storedMac = data[^macLen..];

        using var hmac = new HMACSHA256(macKey);
        var expectedMac = hmac.ComputeHash(payload);
        if (!CryptographicOperations.FixedTimeEquals(storedMac, expectedMac))
            throw new CryptographicException("Şifre çözme başarısız: MAC doğrulaması hatalı.");

        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Mode = CipherMode.CBC;
        aes.Key = encKey;

        const int ivLen = 16;
        aes.IV = payload[..ivLen];
        var cipherBytes = payload[ivLen..];

        using var decryptor = aes.CreateDecryptor();
        using var ms = new MemoryStream(cipherBytes);
        using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
        using var sr = new StreamReader(cs, Encoding.UTF8);
        return sr.ReadToEnd();
    }

    private static byte[] DeriveKey(byte[] masterKey, string label, int outputBytes)
    {
        using var hmac = new HMACSHA256(masterKey);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(label))[..outputBytes];
    }
}
