using System.Security.Cryptography;
using System.Text;

namespace SmartFarm.Infrastructure.Platform;

/// <summary>
/// Mã hoá giá trị bí mật (khoá API) lưu trong platform_settings để lộ DB/backup không lộ khoá. AES-256-GCM, khoá dẫn xuất (HKDF) từ
/// Jwt:SigningKey của chính môi trường đó, nên không cần file khoá riêng khi triển khai. Đổi Jwt:SigningKey thì giá trị cũ không
/// giải mã được: coi như chưa cấu hình và Admin nhập lại.
/// </summary>
public static class SecretProtector
{
    public const string Prefix = "enc:v1:";
    private const int NonceSize = 12, TagSize = 16;

    public static bool IsProtected(string? value) => value is not null && value.StartsWith(Prefix, StringComparison.Ordinal);

    public static string Protect(string plaintext, string signingKey)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(DeriveKey(signingKey), TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Prefix + Convert.ToBase64String(nonce.Concat(tag).Concat(cipher).ToArray());
    }

    /// <summary>Giải mã; null khi định dạng sai hoặc khoá ký đã đổi.</summary>
    public static string? TryUnprotect(string? value, string signingKey)
    {
        if (!IsProtected(value)) return null;
        try
        {
            var data = Convert.FromBase64String(value![Prefix.Length..]);
            if (data.Length < NonceSize + TagSize) return null;
            var nonce = data[..NonceSize];
            var tag = data[NonceSize..(NonceSize + TagSize)];
            var cipher = data[(NonceSize + TagSize)..];
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(DeriveKey(signingKey), TagSize);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or ArgumentException)
        {
            return null;
        }
    }

    /// <summary>Chuỗi hiển thị cho Admin: chỉ 4 ký tự cuối, luôn chứa "****" để nhận ra là giá trị che.</summary>
    public static string Mask(string plaintext) => "********" + (plaintext.Length > 8 ? plaintext[^4..] : string.Empty);

    /// <summary>Giá trị gửi lên là chuỗi che (do chính màn hình lấy từ API) thì không được ghi đè khoá thật.</summary>
    public static bool LooksMasked(string value) => value.Contains("****", StringComparison.Ordinal);

    private static byte[] DeriveKey(string signingKey) =>
        HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(signingKey), 32, info: Encoding.UTF8.GetBytes("smartfarm-platform-secret-v1"));
}
