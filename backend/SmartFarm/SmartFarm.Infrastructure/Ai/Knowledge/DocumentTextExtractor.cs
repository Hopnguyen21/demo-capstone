using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Trích xuất văn bản từ các định dạng tài liệu được hỗ trợ.
/// </summary>
public static class DocumentTextExtractor
{
    public const int MaxFileBytes = 15 * 1024 * 1024; // 15MB

    /// <summary>
    /// Kiểm tra chữ ký nhị phân (Magic Bytes / File Signature) để ngăn chặn giả mạo phần mở rộng file.
    /// </summary>
    public static void ValidateFileSignature(byte[] fileBytes, string fileType)
    {
        if (fileBytes == null || fileBytes.Length < 4)
            throw new InvalidOperationException("Tập tin rỗng hoặc không đủ kích thước hợp lệ.");

        var ext = fileType.ToLowerInvariant().TrimStart('.');
        switch (ext)
        {
            case "pdf":
                // %PDF = 0x25, 0x50, 0x44, 0x46
                if (fileBytes[0] != 0x25 || fileBytes[1] != 0x50 || fileBytes[2] != 0x44 || fileBytes[3] != 0x46)
                    throw new InvalidOperationException("Tập tin không đúng cấu trúc PDF hợp lệ (sai Magic Header %PDF).");
                break;

            case "docx":
                // ZIP header (DOCX là OpenXML ZIP archive) = PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04
                if (fileBytes[0] != 0x50 || fileBytes[1] != 0x4B || fileBytes[2] != 0x03 || fileBytes[3] != 0x04)
                    throw new InvalidOperationException("Tập tin không đúng cấu trúc DOCX hợp lệ (sai Zip/OpenXml Header PK).");
                break;

            case "txt":
                // Văn bản thuần UTF-8 không được chứa ký tự null byte nhị phân trong 512 byte đầu
                var checkLength = Math.Min(fileBytes.Length, 512);
                for (var i = 0; i < checkLength; i++)
                {
                    if (fileBytes[i] == 0x00)
                        throw new InvalidOperationException("Tập tin TXT chứa mã nhị phân không hợp lệ.");
                }
                break;

            default:
                throw new NotSupportedException($"Định dạng tập tin '{fileType}' không được hỗ trợ.");
        }
    }

    /// <summary>
    /// Trích xuất toàn bộ nội dung text từ file theo phần mở rộng sau khi đã kiểm tra an toàn Magic Bytes.
    /// </summary>
    public static string Extract(byte[] fileBytes, string fileType)
    {
        ValidateFileSignature(fileBytes, fileType);
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
                // page.Text nối các dòng không có khoảng trắng ("càchua"); ContentOrderTextExtractor giữ xuống dòng.
                // Nhãn [TRANG n] giống bản OCR để trích dẫn tính được số trang.
                sb.AppendLine($"[TRANG {page.Number}]");
                // Bỏ icon font (ký tự vùng dùng riêng) của bản in trang web.
                sb.AppendLine(Regex.Replace(ContentOrderTextExtractor.GetText(page), @"[-]", string.Empty)).AppendLine();
            }

            var text = sb.ToString().Trim();
            if (text.Length < 50)
                throw new InvalidOperationException("PDF không có đủ lớp văn bản để trích xuất. Nếu là PDF scan, hãy OCR/nhận dạng chữ rồi lưu thành PDF có thể tìm kiếm hoặc DOCX/TXT trước khi tải lên. Nếu file có mật khẩu, hãy mở khóa rồi tải lại.");

            return text;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException("Không đọc được nội dung PDF. Nếu tài liệu là bản scan, hãy OCR/nhận dạng chữ và lưu thành PDF có thể tìm kiếm hoặc DOCX/TXT; nếu file có mật khẩu, hãy mở khóa trước khi tải lên.", ex);
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
