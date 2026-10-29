namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// Chia một chuỗi văn bản dài thành các đoạn nhỏ (chunks) có phần chồng lấn (overlap)
/// để hạn chế mất ngữ cảnh ở ranh giới chunk.
/// Ưu tiên chia tại ranh giới câu/đoạn văn để giữ nguyên ý nghĩa nội dung.
/// </summary>
public static class TextChunker
{
    /// <summary>
    /// Chia văn bản thành các chunks.
    /// </summary>
    /// <param name="text">Văn bản đầu vào (đã được chuẩn hóa).</param>
    /// <param name="chunkSize">Kích thước tối đa mỗi chunk (ký tự). Mặc định 800.</param>
    /// <param name="overlap">Số ký tự chồng lấn giữa hai chunk liên tiếp. Mặc định 120.</param>
    public static List<string> Chunk(string text, int chunkSize = 800, int overlap = 120) => Split(text, chunkSize, overlap);

    public static List<string> Split(string text, int chunkSize = 800, int overlap = 120)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        if (chunkSize <= 0) throw new ArgumentOutOfRangeException(nameof(chunkSize));
        if (overlap < 0 || overlap >= chunkSize) throw new ArgumentOutOfRangeException(nameof(overlap));

        // Chuẩn hóa: thống nhất ngắt dòng Unix và gộp nhiều dòng trống liên tiếp thành một
        text = text.Replace("\r\n", "\n").Replace('\r', '\n');
        text = System.Text.RegularExpressions.Regex.Replace(text.Trim(), @"\n{3,}", "\n\n");

        var result = new List<string>();
        int start = 0;

        while (start < text.Length)
        {
            int end = Math.Min(start + chunkSize, text.Length);

            // Nếu không phải cuối văn bản, tìm ranh giới câu/đoạn gần nhất
            if (end < text.Length)
            {
                // Ưu tiên: xuống dòng đôi (đoạn văn) > dấu chấm > khoảng trắng
                int bestBreak = FindBestBreak(text, start, end);
                if (bestBreak > start) end = bestBreak;
            }

            var chunk = text[start..end].Trim();
            if (!string.IsNullOrWhiteSpace(chunk))
                result.Add(chunk);

            if (end >= text.Length) break;

            // Tiến tới chunk tiếp theo kèm overlap an toàn
            start = (end - start > overlap) ? (end - overlap) : end;
        }

        return result;
    }

    private static int FindBestBreak(string text, int start, int end)
    {
        int searchEnd = Math.Min(end - 1, text.Length - 1);
        int count = searchEnd - start + 1;
        if (count <= 0) return end;

        // Tìm đoạn văn mới (2 newlines) nếu đã gom được ít nhất 350 ký tự
        int pos = text.LastIndexOf("\n\n", searchEnd, count, StringComparison.Ordinal);
        if (pos > start + 350) return pos + 2;

        // Tìm xuống dòng đơn nếu đã gom được ít nhất 400 ký tự
        pos = text.LastIndexOf('\n', searchEnd, count);
        if (pos > start + 400) return pos + 1;

        // Tìm dấu chấm câu (., !, ?) nếu đã gom được ít nhất 400 ký tự
        pos = FindLastOf(text, ['.', '!', '?'], start, end);
        if (pos > start + 400 && pos + 1 < text.Length) return pos + 1;

        // Tìm khoảng trắng gần nhất
        pos = text.LastIndexOf(' ', searchEnd, Math.Min(count, 200));
        if (pos > start + 300) return pos + 1;

        return end;
    }

    private static int FindLastOf(string text, char[] chars, int start, int end)
    {
        for (int i = end - 1; i >= start; i--)
            if (Array.IndexOf(chars, text[i]) >= 0)
                return i;
        return -1;
    }
}
