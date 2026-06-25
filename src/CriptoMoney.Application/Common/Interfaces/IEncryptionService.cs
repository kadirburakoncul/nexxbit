namespace CriptoMoney.Application.Common.Interfaces;

public interface IEncryptionService
{
    string Encrypt(string plaintext);
    string Decrypt(string ciphertext);
}
