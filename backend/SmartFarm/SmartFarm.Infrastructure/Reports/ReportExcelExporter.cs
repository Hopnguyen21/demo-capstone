using ClosedXML.Excel;
using SmartFarm.Application.Features.Reports;

namespace SmartFarm.Infrastructure.Reports;

public static class ReportExcelExporter
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private static readonly XLColor PrimaryColor = XLColor.FromHtml("#119653");
    private static readonly XLColor PrimaryDarkColor = XLColor.FromHtml("#062326");
    private static readonly XLColor LightBgColor = XLColor.FromHtml("#F8FAFC");
    private static readonly XLColor BorderLightColor = XLColor.FromHtml("#E2E8F0");
    private static readonly XLColor BorderDarkColor = XLColor.FromHtml("#CBD5E1");
    private static readonly XLColor MutedTextColor = XLColor.FromHtml("#64748B");
    private static readonly XLColor DarkTextColor = XLColor.FromHtml("#1E293B");

    private const string IntegerFormat = "#,##0";
    private const string DecimalFormat = "#,##0.00";
    private const string SingleDecimalFormat = "#,##0.0";
    private const string PercentFormat = "0.0%";
    private const string CurrencyVndFormat = "#,##0 \"₫\"";
    private const string DateFormat = "yyyy-MM-dd";
    private const string DateTimeFormat = "yyyy-MM-dd HH:mm:ss";

    public static string SanitizeText(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        char first = text[0];
        if (first is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            return "'" + text;
        }
        var trimmed = text.TrimStart();
        if (trimmed.Length > 0 && (trimmed[0] is '=' or '+' or '-' or '@'))
        {
            return "'" + text;
        }
        return text;
    }

    public static void SetSafeCell(IXLCell cell, string? text)
    {
        var safe = SanitizeText(text);
        cell.SetValue(safe);
        cell.Style.NumberFormat.Format = "@";
    }

    public static string GenerateFileName(string reportCode, string entityName, DateTime? fromUtc, DateTime? toUtc)
    {
        var cleanEntity = CleanFileName(entityName);
        var dateSuffix = (fromUtc.HasValue && toUtc.HasValue)
            ? $"{fromUtc.Value:yyyyMMdd}_{toUtc.Value:yyyyMMdd}"
            : DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        return $"SmartFarm_Report_{reportCode}_{cleanEntity}_{dateSuffix}.xlsx";
    }

    private static string CleanFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Farm";
        var invalid = Path.GetInvalidFileNameChars().Concat(new[] { ' ', '/', '\\', ':', '*', '?', '"', '<', '>', '|' }).ToHashSet();
        var cleaned = new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray()).Trim('_');
        return string.IsNullOrEmpty(cleaned) ? "Data" : cleaned;
    }

    private static int AddReportHeader(IXLWorksheet ws, string title, string entityLabel, DateTime? fromUtc, DateTime? toUtc, DateTime generatedAtUtc)
    {
        ws.ShowGridLines = true;
        ws.Cell(1, 1).Value = "HỆ THỐNG NÔNG NGHIỆP THÔNG MINH SMARTFARM";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 9.5;
        ws.Cell(1, 1).Style.Font.FontColor = PrimaryColor;

        ws.Cell(2, 1).Value = title;
        ws.Cell(2, 1).Style.Font.Bold = true;
        ws.Cell(2, 1).Style.Font.FontSize = 15;
        ws.Cell(2, 1).Style.Font.FontColor = PrimaryDarkColor;

        SetSafeCell(ws.Cell(3, 1), entityLabel);
        ws.Cell(3, 1).Style.Font.Bold = true;
        ws.Cell(3, 1).Style.Font.FontSize = 10.5;
        ws.Cell(3, 1).Style.Font.FontColor = DarkTextColor;

        var rangeText = (fromUtc.HasValue && toUtc.HasValue)
            ? $"Khoảng thời gian: {fromUtc.Value:dd/MM/yyyy HH:mm} - {toUtc.Value:dd/MM/yyyy HH:mm} (UTC)"
            : "Khoảng thời gian: Toàn bộ dữ liệu";
        ws.Cell(4, 1).Value = rangeText;
        ws.Cell(4, 1).Style.Font.FontSize = 9;
        ws.Cell(4, 1).Style.Font.FontColor = MutedTextColor;

        ws.Cell(5, 1).Value = $"Thời điểm xuất báo cáo: {generatedAtUtc:dd/MM/yyyy HH:mm:ss} (UTC)";
        ws.Cell(5, 1).Style.Font.FontSize = 9;
        ws.Cell(5, 1).Style.Font.FontColor = MutedTextColor;

        return 7;
    }

    private static void StyleHeaderRow(IXLRange range)
    {
        range.Style.Fill.BackgroundColor = PrimaryColor;
        range.Style.Font.FontColor = XLColor.White;
        range.Style.Font.Bold = true;
        range.Style.Font.FontSize = 10;
        range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        range.Style.Border.OutsideBorderColor = XLColor.FromHtml("#0E8046");
        range.Worksheet.Row(range.RangeAddress.FirstAddress.RowNumber).Height = 24;
    }

    private static void StyleDataRange(IXLRange range)
    {
        range.Style.Font.FontSize = 9.5;
        range.Style.Font.FontColor = DarkTextColor;
        range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        range.Style.Border.InsideBorderColor = BorderLightColor;
        range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        range.Style.Border.OutsideBorderColor = BorderDarkColor;
    }

    private static void FinalizeSheet(IXLWorksheet ws, int headerRow, int lastRow, int colCount)
    {
        if (lastRow > headerRow)
        {
            var tableRange = ws.Range(headerRow, 1, lastRow, colCount);
            tableRange.SetAutoFilter(true);
        }
        ws.SheetView.FreezeRows(headerRow);
        ws.Columns(1, colCount).AdjustToContents(minWidth: 12, maxWidth: 45);
    }

    private static void AddEmptyDataNotice(IXLWorksheet ws, int row, int colCount, string message = "Không có dữ liệu trong khoảng thời gian đã chọn.")
    {
        var noticeRange = ws.Range(row, 1, row, colCount);
        noticeRange.Merge();
        noticeRange.Value = message;
        noticeRange.Style.Font.Italic = true;
        noticeRange.Style.Font.FontSize = 9.5;
        noticeRange.Style.Font.FontColor = MutedTextColor;
        noticeRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        noticeRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        noticeRange.Style.Fill.BackgroundColor = LightBgColor;
        noticeRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        noticeRange.Style.Border.OutsideBorderColor = BorderLightColor;
        ws.Row(row).Height = 24;
    }

    private static void AddFormulasSheet(XLWorkbook wb, IReadOnlyList<ReportFormula> formulas)
    {
        var ws = wb.Worksheets.Add("CanCu_CongThuc");
        ws.ShowGridLines = true;
        ws.Cell(1, 1).Value = "CĂN CỨ VÀ CÔNG THỨC TÍNH TOÁN BÁO CÁO";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 13;
        ws.Cell(1, 1).Style.Font.FontColor = PrimaryDarkColor;

        ws.Cell(2, 1).Value = "Các chỉ số trong báo cáo được trích xuất từ dữ liệu thực tế và tuân thủ định dạng Reporting Contract v1.";
        ws.Cell(2, 1).Style.Font.FontSize = 9;
        ws.Cell(2, 1).Style.Font.FontColor = MutedTextColor;

        int row = 4;
        string[] headers = ["Chỉ số (Metric)", "Công thức tính toán (Formula)", "Nguồn dữ liệu (Source)"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));

        int dataStart = ++row;
        if (formulas.Count == 0)
        {
            AddEmptyDataNotice(ws, row, headers.Length, "Không có công thức đặc thù.");
            row++;
        }
        else
        {
            foreach (var f in formulas)
            {
                SetSafeCell(ws.Cell(row, 1), f.Metric);
                ws.Cell(row, 1).Style.Font.Bold = true;
                SetSafeCell(ws.Cell(row, 2), f.Formula);
                SetSafeCell(ws.Cell(row, 3), f.Source);
                row++;
            }
            StyleDataRange(ws.Range(dataStart, 1, row - 1, headers.Length));
        }

        ws.Columns(1, headers.Length).AdjustToContents(minWidth: 15, maxWidth: 50);
        ws.SheetView.FreezeRows(4);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. FULL RESOURCE & OPERATIONAL REPORT (Matches ReportsPage.tsx)
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildResourceReport(
        string farmName,
        FarmOverviewReport overview,
        ResourceUsageReport water,
        ResourceUsageReport electricity,
        TaskReport tasks,
        DateTime fromUtc,
        DateTime toUtc)
    {
        using var wb = new XLWorkbook();
        var now = DateTime.UtcNow;

        // Sheet 1: Tổng quan & KPI
        var wsOverview = wb.Worksheets.Add("TongQuan_KPI");
        int row = AddReportHeader(wsOverview, "BÁO CÁO TÀI NGUYÊN & VẬN HÀNH NÔNG TRẠI", $"Nông trại: {farmName}", fromUtc, toUtc, now);

        string[] kpiHeaders = ["Chỉ số KPI", "Giá trị", "Đơn vị tính", "Ghi chú kỳ báo cáo"];
        for (int i = 0; i < kpiHeaders.Length; i++) wsOverview.Cell(row, i + 1).Value = kpiHeaders[i];
        StyleHeaderRow(wsOverview.Range(row, 1, row, kpiHeaders.Length));
        int kpiStart = ++row;

        void AddKpi(string metric, object value, string unit, string note, string? numFmt = null)
        {
            SetSafeCell(wsOverview.Cell(row, 1), metric);
            wsOverview.Cell(row, 1).Style.Font.Bold = true;
            var valCell = wsOverview.Cell(row, 2);
            if (value is decimal d) { valCell.Value = d; valCell.Style.NumberFormat.Format = numFmt ?? DecimalFormat; }
            else if (value is int n) { valCell.Value = n; valCell.Style.NumberFormat.Format = numFmt ?? IntegerFormat; }
            else { SetSafeCell(valCell, value?.ToString() ?? string.Empty); }
            SetSafeCell(wsOverview.Cell(row, 3), unit);
            SetSafeCell(wsOverview.Cell(row, 4), note);
            row++;
        }

        AddKpi("Tổng nước tưới tiêu thụ", water.Total, "Lít", $"{water.CountedCommandCount} lệnh điều khiển van đã xác nhận", SingleDecimalFormat);
        AddKpi("Điện năng tiêu thụ", electricity.Total, "kWh", $"{electricity.CountedCommandCount} lệnh điều khiển thiết bị đã xác nhận", SingleDecimalFormat);
        int unmeasured = water.UnmeasuredCommandCount + electricity.UnmeasuredCommandCount;
        AddKpi("Lệnh chưa đo lường", unmeasured, "Lệnh", "Thiết bị chưa khai báo lưu lượng hoặc công suất định mức", IntegerFormat);
        AddKpi("Tổng công việc trong kỳ", tasks.Total, "Công việc", "Bao gồm tất cả công việc không bị hủy", IntegerFormat);
        AddKpi("Công việc đã duyệt hoàn thành", tasks.Approved, "Công việc", "Nhiệm vụ nông trại được phê duyệt đạt", IntegerFormat);
        AddKpi("Công việc quá hạn", tasks.Overdue, "Công việc", "Nhiệm vụ chưa hoàn tất đúng hạn", IntegerFormat);
        AddKpi("Công việc thất bại", tasks.Failed, "Công việc", "Nhiệm vụ báo cáo thất bại", IntegerFormat);
        AddKpi("Tỷ lệ hoàn thành công việc", tasks.CompletionRatePercent / 100m, "%", "Tỷ lệ đã duyệt trên tổng công việc không hủy", PercentFormat);
        AddKpi("Cảnh báo chưa xử lý", overview.OpenAlertCount, "Cảnh báo", "Các cảnh báo nông trại đang chờ khắc phục", IntegerFormat);
        AddKpi("Cảnh báo 7 ngày qua", overview.AlertsLast7Days, "Cảnh báo", "Tổng số cảnh báo phát sinh 7 ngày gần nhất", IntegerFormat);
        AddKpi("Doanh thu tháng hiện tại", overview.RevenueCurrentMonth, "VNĐ", "Giao dịch thu trong tháng UTC", CurrencyVndFormat);
        AddKpi("Chi phí tháng hiện tại", overview.ExpenseCurrentMonth, "VNĐ", "Giao dịch chi trong tháng UTC", CurrencyVndFormat);
        AddKpi("Dòng tiền ròng tháng hiện tại", overview.NetCashFlowCurrentMonth, "VNĐ", "Doanh thu trừ chi phí tháng UTC", CurrencyVndFormat);
        AddKpi("Khu vực canh tác (Zones)", overview.ZoneCount, "Khu vực", "Tổng số Zone thuộc nông trại", IntegerFormat);
        AddKpi("Vụ mùa đang canh tác", overview.ActiveSeasonCount, "Vụ mùa", "Vụ mùa đang có trạng thái InProgress", IntegerFormat);
        AddKpi("Thiết bị trực tuyến", overview.OnlineDeviceCount, "Thiết bị", "Thiết bị IoT đang hoạt động online", IntegerFormat);

        StyleDataRange(wsOverview.Range(kpiStart, 1, row - 1, kpiHeaders.Length));
        FinalizeSheet(wsOverview, kpiStart - 1, row - 1, kpiHeaders.Length);

        // Sheet 2: Tiêu thụ nước theo tháng
        var wsWater = wb.Worksheets.Add("TieuThuNuoc");
        row = AddReportHeader(wsWater, "BÁO CÁO TIÊU THỤ NƯỚC TƯỚI", $"Nông trại: {farmName}", fromUtc, toUtc, now);
        string[] waterHeaders = ["Năm", "Tháng", "Khu vực canh tác", "Lượng nước (Lít)", "Số lệnh đã tính", "Số lệnh chưa đo"];
        for (int i = 0; i < waterHeaders.Length; i++) wsWater.Cell(row, i + 1).Value = waterHeaders[i];
        StyleHeaderRow(wsWater.Range(row, 1, row, waterHeaders.Length));
        int waterStart = ++row;
        if (water.Buckets.Count == 0)
        {
            AddEmptyDataNotice(wsWater, row++, waterHeaders.Length, "Chưa có lệnh tưới nào được ghi nhận trong kỳ này.");
        }
        else
        {
            foreach (var b in water.Buckets.OrderBy(b => b.Year).ThenBy(b => b.Month).ThenBy(b => b.ZoneName))
            {
                wsWater.Cell(row, 1).Value = b.Year; wsWater.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
                wsWater.Cell(row, 2).Value = b.Month; wsWater.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                SetSafeCell(wsWater.Cell(row, 3), b.ZoneName);
                wsWater.Cell(row, 4).Value = b.Value; wsWater.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat;
                wsWater.Cell(row, 5).Value = b.CountedCommandCount; wsWater.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                wsWater.Cell(row, 6).Value = b.UnmeasuredCommandCount; wsWater.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                row++;
            }
            // Total row
            wsWater.Cell(row, 3).Value = "TỔNG CỘNG";
            wsWater.Cell(row, 3).Style.Font.Bold = true;
            wsWater.Cell(row, 4).Value = water.Total;
            wsWater.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat;
            wsWater.Cell(row, 4).Style.Font.Bold = true;
            wsWater.Cell(row, 5).Value = water.CountedCommandCount;
            wsWater.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
            wsWater.Cell(row, 5).Style.Font.Bold = true;
            wsWater.Cell(row, 6).Value = water.UnmeasuredCommandCount;
            wsWater.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
            wsWater.Cell(row, 6).Style.Font.Bold = true;
            wsWater.Range(row, 1, row, waterHeaders.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(wsWater.Range(waterStart, 1, row - 1, waterHeaders.Length));
        }
        FinalizeSheet(wsWater, waterStart - 1, row - 1, waterHeaders.Length);

        // Sheet 3: Điện năng tiêu thụ theo tháng
        var wsPower = wb.Worksheets.Add("DienNang");
        row = AddReportHeader(wsPower, "BÁO CÁO ĐIỆN NĂNG TIÊU THỤ", $"Nông trại: {farmName}", fromUtc, toUtc, now);
        string[] powerHeaders = ["Năm", "Tháng", "Khu vực canh tác", "Điện năng (kWh)", "Số lệnh đã tính", "Số lệnh chưa đo"];
        for (int i = 0; i < powerHeaders.Length; i++) wsPower.Cell(row, i + 1).Value = powerHeaders[i];
        StyleHeaderRow(wsPower.Range(row, 1, row, powerHeaders.Length));
        int powerStart = ++row;
        if (electricity.Buckets.Count == 0)
        {
            AddEmptyDataNotice(wsPower, row++, powerHeaders.Length, "Chưa có lệnh điều khiển thiết bị điện nào trong kỳ này.");
        }
        else
        {
            foreach (var b in electricity.Buckets.OrderBy(b => b.Year).ThenBy(b => b.Month).ThenBy(b => b.ZoneName))
            {
                wsPower.Cell(row, 1).Value = b.Year; wsPower.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
                wsPower.Cell(row, 2).Value = b.Month; wsPower.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                SetSafeCell(wsPower.Cell(row, 3), b.ZoneName);
                wsPower.Cell(row, 4).Value = b.Value; wsPower.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
                wsPower.Cell(row, 5).Value = b.CountedCommandCount; wsPower.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                wsPower.Cell(row, 6).Value = b.UnmeasuredCommandCount; wsPower.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                row++;
            }
            // Total row
            wsPower.Cell(row, 3).Value = "TỔNG CỘNG";
            wsPower.Cell(row, 3).Style.Font.Bold = true;
            wsPower.Cell(row, 4).Value = electricity.Total;
            wsPower.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
            wsPower.Cell(row, 4).Style.Font.Bold = true;
            wsPower.Cell(row, 5).Value = electricity.CountedCommandCount;
            wsPower.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
            wsPower.Cell(row, 5).Style.Font.Bold = true;
            wsPower.Cell(row, 6).Value = electricity.UnmeasuredCommandCount;
            wsPower.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
            wsPower.Cell(row, 6).Style.Font.Bold = true;
            wsPower.Range(row, 1, row, powerHeaders.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(wsPower.Range(powerStart, 1, row - 1, powerHeaders.Length));
        }
        FinalizeSheet(wsPower, powerStart - 1, row - 1, powerHeaders.Length);

        // Sheet 4: Tài nguyên theo khu vực canh tác (Zone Breakdown)
        var wsZones = wb.Worksheets.Add("TheoKhuVuc");
        row = AddReportHeader(wsZones, "TÀI NGUYÊN THEO KHU VỰC CANH TÁC", $"Nông trại: {farmName}", fromUtc, toUtc, now);
        string[] zoneHeaders = ["Khu vực canh tác", "Nước tưới (Lít)", "Tỷ trọng nước (%)", "Điện năng (kWh)"];
        for (int i = 0; i < zoneHeaders.Length; i++) wsZones.Cell(row, i + 1).Value = zoneHeaders[i];
        StyleHeaderRow(wsZones.Range(row, 1, row, zoneHeaders.Length));
        int zoneStart = ++row;

        var waterByZone = water.Buckets.GroupBy(b => b.ZoneName).ToDictionary(g => g.Key, g => g.Sum(x => x.Value));
        var powerByZone = electricity.Buckets.GroupBy(b => b.ZoneName).ToDictionary(g => g.Key, g => g.Sum(x => x.Value));
        var allZones = waterByZone.Keys.Union(powerByZone.Keys).OrderBy(k => k).ToList();

        if (allZones.Count == 0)
        {
            AddEmptyDataNotice(wsZones, row++, zoneHeaders.Length, "Chưa có dữ liệu tiêu thụ tài nguyên theo khu vực.");
        }
        else
        {
            decimal totalW = water.Total;
            foreach (var zName in allZones)
            {
                var wVal = waterByZone.GetValueOrDefault(zName, 0m);
                var pVal = powerByZone.GetValueOrDefault(zName, 0m);
                var wShare = totalW > 0 ? (wVal / totalW) : 0m;

                SetSafeCell(wsZones.Cell(row, 1), zName);
                wsZones.Cell(row, 1).Style.Font.Bold = true;
                wsZones.Cell(row, 2).Value = wVal; wsZones.Cell(row, 2).Style.NumberFormat.Format = SingleDecimalFormat;
                wsZones.Cell(row, 3).Value = wShare; wsZones.Cell(row, 3).Style.NumberFormat.Format = PercentFormat;
                wsZones.Cell(row, 4).Value = pVal; wsZones.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
                row++;
            }
            // Total row
            wsZones.Cell(row, 1).Value = "TỔNG CỘNG";
            wsZones.Cell(row, 1).Style.Font.Bold = true;
            wsZones.Cell(row, 2).Value = water.Total;
            wsZones.Cell(row, 2).Style.NumberFormat.Format = SingleDecimalFormat;
            wsZones.Cell(row, 2).Style.Font.Bold = true;
            wsZones.Cell(row, 3).Value = totalW > 0 ? 1m : 0m;
            wsZones.Cell(row, 3).Style.NumberFormat.Format = PercentFormat;
            wsZones.Cell(row, 3).Style.Font.Bold = true;
            wsZones.Cell(row, 4).Value = electricity.Total;
            wsZones.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
            wsZones.Cell(row, 4).Style.Font.Bold = true;
            wsZones.Range(row, 1, row, zoneHeaders.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(wsZones.Range(zoneStart, 1, row - 1, zoneHeaders.Length));
        }
        FinalizeSheet(wsZones, zoneStart - 1, row - 1, zoneHeaders.Length);

        // Sheet 5: Phân công công việc theo nhân sự
        var wsTasks = wb.Worksheets.Add("CongViec_NhanSu");
        row = AddReportHeader(wsTasks, "TÌNH HÌNH CÔNG VIỆC THEO NHÂN SỰ", $"Nông trại: {farmName}", fromUtc, toUtc, now);
        string[] taskHeaders = ["Nhân sự phụ trách", "Chờ xử lý", "Đang thực hiện", "Đã duyệt", "Thất bại", "Quá hạn", "Tổng việc"];
        for (int i = 0; i < taskHeaders.Length; i++) wsTasks.Cell(row, i + 1).Value = taskHeaders[i];
        StyleHeaderRow(wsTasks.Range(row, 1, row, taskHeaders.Length));
        int taskStart = ++row;
        if (tasks.ByAssignee.Count == 0)
        {
            AddEmptyDataNotice(wsTasks, row++, taskHeaders.Length, "Chưa có phân công công việc nào trong kỳ.");
        }
        else
        {
            foreach (var a in tasks.ByAssignee)
            {
                SetSafeCell(wsTasks.Cell(row, 1), a.FarmerName);
                wsTasks.Cell(row, 1).Style.Font.Bold = true;
                wsTasks.Cell(row, 2).Value = a.Pending; wsTasks.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                wsTasks.Cell(row, 3).Value = a.InProgress; wsTasks.Cell(row, 3).Style.NumberFormat.Format = IntegerFormat;
                wsTasks.Cell(row, 4).Value = a.Approved; wsTasks.Cell(row, 4).Style.NumberFormat.Format = IntegerFormat;
                wsTasks.Cell(row, 5).Value = a.Failed; wsTasks.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                wsTasks.Cell(row, 6).Value = a.Overdue; wsTasks.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                int personTotal = a.Pending + a.InProgress + a.Approved + a.Failed + a.Overdue;
                wsTasks.Cell(row, 7).Value = personTotal; wsTasks.Cell(row, 7).Style.NumberFormat.Format = IntegerFormat;
                wsTasks.Cell(row, 7).Style.Font.Bold = true;
                row++;
            }
            // Total row
            wsTasks.Cell(row, 1).Value = "TỔNG CỘNG";
            wsTasks.Cell(row, 1).Style.Font.Bold = true;
            wsTasks.Cell(row, 2).Value = tasks.ByAssignee.Sum(x => x.Pending); wsTasks.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Cell(row, 3).Value = tasks.ByAssignee.Sum(x => x.InProgress); wsTasks.Cell(row, 3).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Cell(row, 4).Value = tasks.Approved; wsTasks.Cell(row, 4).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Cell(row, 5).Value = tasks.Failed; wsTasks.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Cell(row, 6).Value = tasks.Overdue; wsTasks.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Cell(row, 7).Value = tasks.Total; wsTasks.Cell(row, 7).Style.NumberFormat.Format = IntegerFormat;
            wsTasks.Range(row, 1, row, taskHeaders.Length).Style.Font.Bold = true;
            wsTasks.Range(row, 1, row, taskHeaders.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(wsTasks.Range(taskStart, 1, row - 1, taskHeaders.Length));
        }
        FinalizeSheet(wsTasks, taskStart - 1, row - 1, taskHeaders.Length);

        // Sheet 6: Căn cứ & Công thức
        var allFormulas = water.Formulas
            .Concat(electricity.Formulas)
            .Concat(tasks.Formulas)
            .Concat(overview.Formulas)
            .DistinctBy(f => f.Metric)
            .ToList();
        AddFormulasSheet(wb, allFormulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. OVERVIEW EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildOverviewReport(string farmName, FarmOverviewReport overview)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("TongQuan");
        int row = AddReportHeader(ws, "BÁO CÁO TỔNG QUAN NÔNG TRẠI", $"Nông trại: {farmName}", null, null, overview.GeneratedAtUtc);

        string[] headers = ["Chỉ số", "Giá trị", "Đơn vị", "Mô tả"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        void AddRow(string m, object v, string u, string d, string? fmt = null)
        {
            SetSafeCell(ws.Cell(row, 1), m); ws.Cell(row, 1).Style.Font.Bold = true;
            var c = ws.Cell(row, 2);
            if (v is decimal dec) { c.Value = dec; c.Style.NumberFormat.Format = fmt ?? DecimalFormat; }
            else if (v is int num) { c.Value = num; c.Style.NumberFormat.Format = fmt ?? IntegerFormat; }
            else { SetSafeCell(c, v?.ToString() ?? string.Empty); }
            SetSafeCell(ws.Cell(row, 3), u);
            SetSafeCell(ws.Cell(row, 4), d);
            row++;
        }

        AddRow("Số khu đất (Fields)", overview.FieldCount, "Khu đất", "Số lượng khu đất đang quản lý", IntegerFormat);
        AddRow("Số vùng canh tác (Zones)", overview.ZoneCount, "Vùng", "Tổng số nhà màng / ô đất đang hoạt động", IntegerFormat);
        AddRow("Vụ mùa đang canh tác", overview.ActiveSeasonCount, "Vụ mùa", "Vụ mùa đang trong giai đoạn InProgress", IntegerFormat);
        AddRow("Thiết bị trực tuyến", overview.OnlineDeviceCount, "Thiết bị", "Thiết bị IoT đang kết nối online", IntegerFormat);
        AddRow("Cảnh báo 7 ngày qua", overview.AlertsLast7Days, "Cảnh báo", "Tổng cảnh báo 7 ngày gần nhất", IntegerFormat);
        AddRow("Cảnh báo chưa xử lý", overview.OpenAlertCount, "Cảnh báo", "Cảnh báo tồn đọng", IntegerFormat);
        AddRow("Công việc đang mở", overview.OpenTaskCount, "Công việc", "Nhiệm vụ chưa phê duyệt hoặc chưa hoàn tất", IntegerFormat);
        AddRow("Vật tư sắp hết", overview.LowStockItemCount, "Mặt hàng", "Vật tư dưới ngưỡng tồn kho an toàn", IntegerFormat);
        AddRow("Yêu cầu sửa chữa mở", overview.OpenServiceRequestCount, "Yêu cầu", "Yêu cầu bảo trì chưa hoàn thành", IntegerFormat);
        AddRow("Doanh thu tháng này", overview.RevenueCurrentMonth, "VNĐ", "Tổng thu trong tháng UTC", CurrencyVndFormat);
        AddRow("Chi phí tháng này", overview.ExpenseCurrentMonth, "VNĐ", "Tổng chi trong tháng UTC", CurrencyVndFormat);
        AddRow("Dòng tiền ròng tháng này", overview.NetCashFlowCurrentMonth, "VNĐ", "Doanh thu trừ chi phí", CurrencyVndFormat);

        StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);

        AddFormulasSheet(wb, overview.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. WATER USAGE EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildWaterReport(string farmName, ResourceUsageReport report)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("TieuThuNuoc");
        int row = AddReportHeader(ws, "BÁO CÁO TIÊU THỤ NƯỚC TƯỚI", $"Nông trại: {farmName}", report.FromUtc, report.ToUtc, DateTime.UtcNow);

        string[] headers = ["Năm", "Tháng", "Khu vực canh tác", "Lượng nước (Lít)", "Lệnh đã tính", "Lệnh chưa đo"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        if (report.Buckets.Count == 0)
        {
            AddEmptyDataNotice(ws, row++, headers.Length);
        }
        else
        {
            foreach (var b in report.Buckets.OrderBy(b => b.Year).ThenBy(b => b.Month).ThenBy(b => b.ZoneName))
            {
                ws.Cell(row, 1).Value = b.Year; ws.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 2).Value = b.Month; ws.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                SetSafeCell(ws.Cell(row, 3), b.ZoneName);
                ws.Cell(row, 4).Value = b.Value; ws.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat;
                ws.Cell(row, 5).Value = b.CountedCommandCount; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 6).Value = b.UnmeasuredCommandCount; ws.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                row++;
            }
            ws.Cell(row, 3).Value = "TỔNG CỘNG"; ws.Cell(row, 3).Style.Font.Bold = true;
            ws.Cell(row, 4).Value = report.Total; ws.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat; ws.Cell(row, 4).Style.Font.Bold = true;
            ws.Cell(row, 5).Value = report.CountedCommandCount; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat; ws.Cell(row, 5).Style.Font.Bold = true;
            ws.Cell(row, 6).Value = report.UnmeasuredCommandCount; ws.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat; ws.Cell(row, 6).Style.Font.Bold = true;
            ws.Range(row, 1, row, headers.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        }

        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);
        AddFormulasSheet(wb, report.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. ELECTRICITY EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildElectricityReport(string farmName, ResourceUsageReport report)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("DienNang");
        int row = AddReportHeader(ws, "BÁO CÁO ĐIỆN NĂNG TIÊU THỤ", $"Nông trại: {farmName}", report.FromUtc, report.ToUtc, DateTime.UtcNow);

        string[] headers = ["Năm", "Tháng", "Khu vực canh tác", "Điện năng (kWh)", "Lệnh đã tính", "Lệnh chưa đo"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        if (report.Buckets.Count == 0)
        {
            AddEmptyDataNotice(ws, row++, headers.Length);
        }
        else
        {
            foreach (var b in report.Buckets.OrderBy(b => b.Year).ThenBy(b => b.Month).ThenBy(b => b.ZoneName))
            {
                ws.Cell(row, 1).Value = b.Year; ws.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 2).Value = b.Month; ws.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                SetSafeCell(ws.Cell(row, 3), b.ZoneName);
                ws.Cell(row, 4).Value = b.Value; ws.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
                ws.Cell(row, 5).Value = b.CountedCommandCount; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 6).Value = b.UnmeasuredCommandCount; ws.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                row++;
            }
            ws.Cell(row, 3).Value = "TỔNG CỘNG"; ws.Cell(row, 3).Style.Font.Bold = true;
            ws.Cell(row, 4).Value = report.Total; ws.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat; ws.Cell(row, 4).Style.Font.Bold = true;
            ws.Cell(row, 5).Value = report.CountedCommandCount; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat; ws.Cell(row, 5).Style.Font.Bold = true;
            ws.Cell(row, 6).Value = report.UnmeasuredCommandCount; ws.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat; ws.Cell(row, 6).Style.Font.Bold = true;
            ws.Range(row, 1, row, headers.Length).Style.Fill.BackgroundColor = LightBgColor;
            row++;
            StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        }

        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);
        AddFormulasSheet(wb, report.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. SEASON SUMMARY EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildSeasonSummaryReport(string zoneName, SeasonSummaryReport season)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("TongKetVuMua");
        int row = AddReportHeader(ws, "BÁO CÁO TỔNG KẾT VỤ MÙA", $"Khu vực canh tác: {zoneName}", null, null, DateTime.UtcNow);

        string[] headers = ["Thông số vụ mùa", "Giá trị", "Đơn vị"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        void AddRow(string label, object? val, string unit, string? fmt = null)
        {
            SetSafeCell(ws.Cell(row, 1), label); ws.Cell(row, 1).Style.Font.Bold = true;
            var c = ws.Cell(row, 2);
            if (val is decimal dec) { c.Value = dec; c.Style.NumberFormat.Format = fmt ?? DecimalFormat; }
            else if (val is int num) { c.Value = num; c.Style.NumberFormat.Format = fmt ?? IntegerFormat; }
            else if (val is DateOnly dt) { c.Value = dt.ToString("yyyy-MM-dd"); }
            else { SetSafeCell(c, val?.ToString() ?? "—"); }
            SetSafeCell(ws.Cell(row, 3), unit);
            row++;
        }

        AddRow("Tên vụ mùa", season.SeasonName, "");
        AddRow("Loại cây trồng", season.CropName, "");
        AddRow("Giống cây", season.VarietyName ?? "Tiêu chuẩn", "");
        AddRow("Giai đoạn sinh trưởng", season.GrowthStageName, "");
        AddRow("Trạng thái vụ mùa", season.Status.ToString(), "");
        AddRow("Ngày bắt đầu vụ", season.StartDate, "");
        AddRow("Ngày kết thúc vụ", season.EndDate, "");
        AddRow("Năng suất thực tế", season.ActualYieldKg, "kg", DecimalFormat);
        AddRow("Năng suất vụ trước", season.PreviousYieldKg, "kg", DecimalFormat);
        AddRow("Số lượng cảnh báo", season.AlertCount, "Cảnh báo", IntegerFormat);
        AddRow("Lệnh tưới đã xác nhận", season.AcknowledgedIrrigationCommandCount, "Lệnh", IntegerFormat);
        AddRow("Tổng nước tưới", season.WaterLiters, "Lít", SingleDecimalFormat);
        AddRow("Tổng điện năng", season.ElectricityKWh, "kWh", DecimalFormat);
        AddRow("Vật tư đã xuất kho", season.MaterialIssuedQuantity, "Đơn vị định mức", DecimalFormat);

        StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);

        AddFormulasSheet(wb, season.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. INVENTORY EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildInventoryReport(string farmName, InventoryReport report)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("TonKhoVatTu");
        int row = AddReportHeader(ws, "BÁO CÁO TỒN KHO & XUẤT NHẬP VẬT TƯ", $"Nông trại: {farmName}", report.FromUtc, report.ToUtc, DateTime.UtcNow);

        string[] headers = ["Mã vật tư", "Tên vật tư", "Đơn vị tính", "Tồn kho hiện tại", "Ngưỡng cảnh báo", "Sắp hết hàng?", "Tổng nhập trong kỳ", "Tổng xuất trong kỳ"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        if (report.Items.Count == 0)
        {
            AddEmptyDataNotice(ws, row++, headers.Length);
        }
        else
        {
            foreach (var item in report.Items)
            {
                SetSafeCell(ws.Cell(row, 1), item.ItemId.ToString().Substring(0, 8));
                SetSafeCell(ws.Cell(row, 2), item.Name); ws.Cell(row, 2).Style.Font.Bold = true;
                SetSafeCell(ws.Cell(row, 3), item.Unit);
                ws.Cell(row, 4).Value = item.QuantityOnHand; ws.Cell(row, 4).Style.NumberFormat.Format = DecimalFormat;
                ws.Cell(row, 5).Value = item.LowStockThreshold; ws.Cell(row, 5).Style.NumberFormat.Format = DecimalFormat;
                SetSafeCell(ws.Cell(row, 6), item.IsLowStock ? "CẢNH BÁO" : "Bình thường");
                if (item.IsLowStock)
                {
                    ws.Cell(row, 6).Style.Font.FontColor = XLColor.Red;
                    ws.Cell(row, 6).Style.Font.Bold = true;
                }
                ws.Cell(row, 7).Value = item.ReceivedQuantity; ws.Cell(row, 7).Style.NumberFormat.Format = DecimalFormat;
                ws.Cell(row, 8).Value = item.IssuedQuantity; ws.Cell(row, 8).Style.NumberFormat.Format = DecimalFormat;
                row++;
            }
            StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        }

        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);
        AddFormulasSheet(wb, report.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. TASKS EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildTasksReport(string farmName, TaskReport report)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("CongViec");
        int row = AddReportHeader(ws, "BÁO CÁO TIẾN ĐỘ & PHÂN CÔNG CÔNG VIỆC", $"Nông trại: {farmName}", report.FromUtc, report.ToUtc, DateTime.UtcNow);

        // KPI Summary Block
        ws.Cell(row, 1).Value = "TỔNG QUAN TIẾN ĐỘ";
        ws.Cell(row, 1).Style.Font.Bold = true;
        ws.Cell(row, 1).Style.Font.FontSize = 11;
        row++;

        string[] kpiH = ["Tổng công việc", "Đã duyệt", "Thất bại", "Quá hạn", "Tỷ lệ hoàn thành (%)"];
        for (int i = 0; i < kpiH.Length; i++) ws.Cell(row, i + 1).Value = kpiH[i];
        StyleHeaderRow(ws.Range(row, 1, row, kpiH.Length));
        row++;

        ws.Cell(row, 1).Value = report.Total; ws.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 2).Value = report.Approved; ws.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 3).Value = report.Failed; ws.Cell(row, 3).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 4).Value = report.Overdue; ws.Cell(row, 4).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 5).Value = report.CompletionRatePercent / 100m; ws.Cell(row, 5).Style.NumberFormat.Format = PercentFormat;
        ws.Range(row, 1, row, kpiH.Length).Style.Font.Bold = true;
        StyleDataRange(ws.Range(row, 1, row, kpiH.Length));
        row += 3;

        // Assignee Table
        ws.Cell(row, 1).Value = "CHI TIẾT THEO NHÂN SỰ";
        ws.Cell(row, 1).Style.Font.Bold = true;
        ws.Cell(row, 1).Style.Font.FontSize = 11;
        row++;

        string[] headers = ["Nhân sự phụ trách", "Chờ xử lý", "Đang thực hiện", "Đã duyệt", "Thất bại", "Quá hạn", "Tổng việc"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        if (report.ByAssignee.Count == 0)
        {
            AddEmptyDataNotice(ws, row++, headers.Length);
        }
        else
        {
            foreach (var a in report.ByAssignee)
            {
                SetSafeCell(ws.Cell(row, 1), a.FarmerName); ws.Cell(row, 1).Style.Font.Bold = true;
                ws.Cell(row, 2).Value = a.Pending; ws.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 3).Value = a.InProgress; ws.Cell(row, 3).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 4).Value = a.Approved; ws.Cell(row, 4).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 5).Value = a.Failed; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                ws.Cell(row, 6).Value = a.Overdue; ws.Cell(row, 6).Style.NumberFormat.Format = IntegerFormat;
                int sum = a.Pending + a.InProgress + a.Approved + a.Failed + a.Overdue;
                ws.Cell(row, 7).Value = sum; ws.Cell(row, 7).Style.NumberFormat.Format = IntegerFormat; ws.Cell(row, 7).Style.Font.Bold = true;
                row++;
            }
            StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        }

        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);
        AddFormulasSheet(wb, report.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. MAINTENANCE EXPORT
    // ─────────────────────────────────────────────────────────────────────────────
    public static byte[] BuildMaintenanceReport(string farmName, MaintenanceReport report)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("BaoTriThietBi");
        int row = AddReportHeader(ws, "BÁO CÁO BẢO TRÌ & THAY THẾ THIẾT BỊ", $"Nông trại: {farmName}", report.FromUtc, report.ToUtc, DateTime.UtcNow);

        // KPI Summary Block
        string[] kpiH = ["Tổng yêu cầu", "Đang mở", "Đã đóng", "Thời gian xử lý trung bình (Giờ)"];
        for (int i = 0; i < kpiH.Length; i++) ws.Cell(row, i + 1).Value = kpiH[i];
        StyleHeaderRow(ws.Range(row, 1, row, kpiH.Length));
        row++;

        ws.Cell(row, 1).Value = report.Total; ws.Cell(row, 1).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 2).Value = report.Open; ws.Cell(row, 2).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 3).Value = report.Closed; ws.Cell(row, 3).Style.NumberFormat.Format = IntegerFormat;
        ws.Cell(row, 4).Value = report.AverageClosedHours; ws.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat;
        ws.Range(row, 1, row, kpiH.Length).Style.Font.Bold = true;
        StyleDataRange(ws.Range(row, 1, row, kpiH.Length));
        row += 3;

        string[] headers = ["Mã yêu cầu", "Trạng thái", "Hành động xử lý", "Thời gian xử lý (Giờ)", "Số lần test", "Test gần nhất OK?", "Số lần thay thiết bị"];
        for (int i = 0; i < headers.Length; i++) ws.Cell(row, i + 1).Value = headers[i];
        StyleHeaderRow(ws.Range(row, 1, row, headers.Length));
        int startRow = ++row;

        if (report.Requests.Count == 0)
        {
            AddEmptyDataNotice(ws, row++, headers.Length);
        }
        else
        {
            foreach (var req in report.Requests)
            {
                SetSafeCell(ws.Cell(row, 1), req.ServiceRequestId.ToString().Substring(0, 8));
                SetSafeCell(ws.Cell(row, 2), req.Status.ToString());
                SetSafeCell(ws.Cell(row, 3), req.ResolutionAction?.ToString() ?? "—");
                ws.Cell(row, 4).Value = req.ElapsedHours; ws.Cell(row, 4).Style.NumberFormat.Format = SingleDecimalFormat;
                ws.Cell(row, 5).Value = req.TestCount; ws.Cell(row, 5).Style.NumberFormat.Format = IntegerFormat;
                SetSafeCell(ws.Cell(row, 6), req.LatestTestSucceeded.HasValue ? (req.LatestTestSucceeded.Value ? "Thành công" : "Thất bại") : "Chưa test");
                ws.Cell(row, 7).Value = req.ReplacementCount; ws.Cell(row, 7).Style.NumberFormat.Format = IntegerFormat;
                row++;
            }
            StyleDataRange(ws.Range(startRow, 1, row - 1, headers.Length));
        }

        FinalizeSheet(ws, startRow - 1, row - 1, headers.Length);
        AddFormulasSheet(wb, report.Formulas);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }
}
