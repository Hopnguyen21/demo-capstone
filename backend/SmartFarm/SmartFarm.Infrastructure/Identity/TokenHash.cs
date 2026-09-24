using System.Security.Cryptography;
using System.Text;

namespace SmartFarm.Infrastructure.Identity;

internal static class TokenHash
{
    public static string Create(string token)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    }
}
