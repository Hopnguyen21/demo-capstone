using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;

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
    public static string Extract(byte[] fileBytes, string fileType)
    {
        var raw = fileType.ToLowerInvariant() switch
        {
            "pdf"  => ExtractFromPdf(fileBytes),
            "docx" => ExtractFromDocx(fileBytes),
            "txt"  => Encoding.UTF8.GetString(fileBytes),
            _      => throw new NotSupportedException($"File type '{fileType}' is not supported.")
        };
        return raw.Normalize(NormalizationForm.FormC);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  PDF: Trích xuất toàn diện trang và text bằng thư viện UglyToad.PdfPig
    // ────────────────────────────────────────────────────────────────────────
    private static string ExtractFromPdf(byte[] fileBytes)
    {
        try
        {
            using var pdf = PdfDocument.Open(fileBytes);
            var sb = new StringBuilder();
            foreach (var page in pdf.GetPages())
            {
                sb.AppendLine(page.Text).AppendLine();
            }

            var text = sb.ToString().Trim();
            if (text.Length < 50)
                throw new InvalidOperationException("Không trích xuất được văn bản (PDF dạng ảnh scan hoặc bị mã hóa).");

            return text;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException($"Lỗi phân tích cú pháp PDF: {ex.Message}", ex);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    //  DOCX: sử dụng DocumentFormat.OpenXml
    // ────────────────────────────────────────────────────────────────────────
    private static string ExtractFromDocx(byte[] fileBytes)
    {
        try
        {
            using var stream = new MemoryStream(fileBytes);
            using var doc = WordprocessingDocument.Open(stream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null)
                throw new InvalidOperationException("Tệp DOCX rỗng hoặc không có phần nội dung chính.");

            var sb = new StringBuilder();
            foreach (var paragraph in body.Descendants<DocumentFormat.OpenXml.Wordprocessing.Paragraph>())
            {
                var text = paragraph.InnerText;
                if (!string.IsNullOrWhiteSpace(text))
                    sb.AppendLine(text);
            }
            var result = sb.ToString().Trim();
            if (result.Length < 30)
                throw new InvalidOperationException("Nội dung tệp DOCX quá ngắn hoặc không chứa văn bản có thể trích xuất.");
            return result;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException($"Lỗi phân tích cú pháp DOCX: {ex.Message}", ex);
        }
    }
}
