using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Trích xuất văn bản từ các định dạng tài liệu được hỗ trợ.
/// </summary>
public static class DocumentTextExtractor
{
    public const int MaxFileBytes = 15 * 1024 * 1024; // 15MB

    /// <summary>
    /// Trích xuất toàn bộ nội dung text từ file theo phần mở rộng.
    /// </summary>
    public static string Extract(byte[] fileBytes, string fileType) =>
        fileType.ToLowerInvariant() switch
        {
            "pdf"  => ExtractFromPdf(fileBytes),
            "docx" => ExtractFromDocx(fileBytes),
            "txt"  => Encoding.UTF8.GetString(fileBytes),
            _      => throw new NotSupportedException($"File type '{fileType}' is not supported.")
        };

    // ────────────────────────────────────────────────────────────────────────
    //  PDF: parse text stream từ binary theo cú pháp PDF
    // ────────────────────────────────────────────────────────────────────────
    private static string ExtractFromPdf(byte[] fileBytes)
    {
        // Dùng regex để extract text từ PDF stream content operators (Tj, TJ, ')
        var pdf = Encoding.Latin1.GetString(fileBytes);
        var sb = new StringBuilder();

        // Match các text operators trong PDF content stream
        var matches = Regex.Matches(pdf,
            @"\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj|" +
            @"\[([^\[\]]*)\]\s*TJ|" +
            @"\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*'",
            RegexOptions.Singleline);

        foreach (Match m in matches)
        {
            var raw = m.Groups[1].Value + m.Groups[2].Value + m.Groups[3].Value;
            if (!string.IsNullOrWhiteSpace(raw))
            {
                // Giải mã escape sequences PDF
                raw = raw.Replace("\\n", "\n")
                         .Replace("\\r", "\r")
                         .Replace("\\t", "\t")
                         .Replace("\\(", "(")
                         .Replace("\\)", ")")
                         .Replace("\\\\", "\\");
                sb.Append(raw).Append(' ');
            }
        }

        var result = sb.ToString().Trim();
        // Nếu không extract được gì (PDF scanned/encrypted), trả về thông báo
        return result.Length < 50
            ? "[PDF có thể được mã hóa hoặc dạng ảnh scan, không thể trích xuất văn bản]"
            : result;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  DOCX: sử dụng DocumentFormat.OpenXml
    // ────────────────────────────────────────────────────────────────────────
    private static string ExtractFromDocx(byte[] fileBytes)
    {
        using var stream = new MemoryStream(fileBytes);
        using var doc = WordprocessingDocument.Open(stream, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        if (body is null) return string.Empty;

        var sb = new StringBuilder();
        foreach (var paragraph in body.Descendants<DocumentFormat.OpenXml.Wordprocessing.Paragraph>())
        {
            var text = paragraph.InnerText;
            if (!string.IsNullOrWhiteSpace(text))
                sb.AppendLine(text);
        }
        return sb.ToString();
    }
}
