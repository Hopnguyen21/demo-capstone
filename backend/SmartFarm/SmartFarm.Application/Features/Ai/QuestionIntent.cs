using SmartFarm.Domain.Enums;

namespace SmartFarm.Application.Features.Ai;

/// <summary>
/// Chủ đề của câu hỏi do AI phân loại. Đây là bộ từ vựng đóng (không phải danh sách câu hỏi): AI hiểu câu hỏi bằng ngôn ngữ tự nhiên
/// rồi chọn chủ đề, nên câu diễn đạt nào cũng được hiểu mà không cần thêm từ khóa vào mã.
/// </summary>
public static class QuestionTopics
{
    public const string SensorReadings = "sensor_readings";
    public const string Devices = "devices";
    public const string Gateways = "gateways";
    public const string Weather = "weather";
    public const string Alerts = "alerts";
    public const string Commands = "commands";
    public const string Schedules = "schedules";
    public const string Tasks = "tasks";
    public const string Season = "season";
    public const string ZoneInfo = "zone_info";
    public const string FarmInfo = "farm_info";
    public const string ZoneMembers = "zone_members";
    public const string UnsupportedData = "unsupported_data";
    public const string PlantCount = "plant_count";
    public const string AutoRules = "auto_rules";
    public const string DeviceHealth = "device_health";
    public const string IrrigationOrControl = "irrigation_or_control";
    public const string AgronomyKnowledge = "agronomy_knowledge";
    public const string Harvest = "harvest";
    public const string SmallTalk = "small_talk";
    public const string OutOfScope = "out_of_scope";

    public static readonly IReadOnlyList<string> All =
    [
        SensorReadings, Devices, Gateways, Weather, Alerts, Commands, Schedules, Tasks, Season, ZoneInfo, FarmInfo, ZoneMembers, UnsupportedData, PlantCount,
        AutoRules, DeviceHealth, IrrigationOrControl, AgronomyKnowledge, Harvest, SmallTalk, OutOfScope
    ];
}

/// <summary>Kết quả hiểu câu hỏi. Rỗng (<see cref="Unknown"/>) nghĩa là chưa phân loại được; khi đó câu hỏi đi thẳng tới AI tư vấn với đầy đủ ngữ cảnh.</summary>
public sealed record QuestionIntent(
    IReadOnlyList<string> Topics,
    IReadOnlyList<EnvironmentalParameterCode> Parameters,
    bool WantsHistory = false,
    bool WantsDeviceDetail = false,
    string DeviceScope = QuestionIntent.ScopeAll,
    /// <summary>Số bản ghi gần nhất người dùng muốn xem cho mỗi thông số (0 = chỉ hỏi giá trị hiện tại; tối đa <see cref="MaxHistoryCount"/>).</summary>
    int HistoryCount = 0,
    /// <summary>Số thứ tự node được nhắc tới ("node cảm biến 1" → 1); null = tất cả node.</summary>
    int? DeviceNumber = null,
    /// <summary>Từ khóa/thuật ngữ nông học đồng nghĩa với câu hỏi (do AI phân loại sinh ra) để tìm tài liệu khi không có embedding.</summary>
    IReadOnlyList<string>? SearchTerms = null,
    /// <summary>Số ngày gần nhất (tính cả hôm nay) người dùng muốn so sánh hoặc tổng hợp theo ngày ("hôm qua" = 2, "tuần qua" = 7); 0 = không hỏi.</summary>
    int HistoryDays = 0,
    /// <summary>Số ngày tới người dùng muốn xem lịch tưới ("2 ngày tới" = 2, "ngày mai" = 2, "tuần tới" = 7); 0 = không nêu (xem tối đa <see cref="MaxAheadDays"/> ngày).</summary>
    int AheadDays = 0)
{
    public const int MaxAheadDays = 7;
    public const int MaxHistoryDays = 14;
    public const int MaxHistoryCount = 20;
    public const int DefaultHistoryCount = 5;

    /// <summary>Phạm vi liệt kê thiết bị: chỉ cảm biến, chỉ thiết bị chấp hành, hoặc tất cả (mặc định, kể cả khi AI không nói rõ).</summary>
    public const string ScopeAll = "all";
    public const string ScopeSensors = "sensors";
    public const string ScopeActuators = "actuators";

    public static readonly QuestionIntent Unknown = new([], []);

    public bool Has(string topic) => Topics.Contains(topic);
}

/// <summary>Hiểu ý định của câu hỏi (chủ đề, thông số được hỏi) bằng AI. Trả null khi AI không khả dụng hoặc kết quả không hợp lệ.</summary>
public interface IQuestionIntentClassifier
{
    Task<QuestionIntent?> ClassifyAsync(string question, CancellationToken cancellationToken);
}
