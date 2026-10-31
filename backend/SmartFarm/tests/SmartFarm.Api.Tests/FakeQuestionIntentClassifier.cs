using SmartFarm.Application.Features.Ai;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Api.Tests;

/// <summary>
/// Giả lập bước AI hiểu câu hỏi: mỗi câu hỏi dùng trong test được khai báo ý định mà AI sẽ trả về. Mã sản phẩm không có từ khóa nào;
/// câu hỏi chưa khai báo coi như AI không phân loại được (null), giống khi Gemini không khả dụng.
/// </summary>
internal sealed class FakeQuestionIntentClassifier : IQuestionIntentClassifier
{
    private readonly Dictionary<string, QuestionIntent> script = new(StringComparer.OrdinalIgnoreCase);

    internal int Calls { get; private set; }
    internal bool Throw { get; set; }

    internal FakeQuestionIntentClassifier() => ApplyDefaultScript();

    internal void Understands(string question, QuestionIntent intent) => script[question] = intent;

    public Task<QuestionIntent?> ClassifyAsync(string question, CancellationToken cancellationToken)
    {
        Calls++;
        if (Throw) throw new InvalidOperationException("Intent classifier is down.");
        return Task.FromResult(script.TryGetValue(question, out var intent) ? intent : null);
    }

    private static QuestionIntent Intent(string[] topics, EnvironmentalParameterCode[]? parameters = null, bool history = false, bool detail = false, string scope = QuestionIntent.ScopeAll) =>
        new(topics, parameters ?? [], history, detail, scope);

    private void ApplyDefaultScript()
    {
        const EnvironmentalParameterCode soil = EnvironmentalParameterCode.SoilMoisture;
        const EnvironmentalParameterCode air = EnvironmentalParameterCode.AirHumidity;

        void Many(QuestionIntent intent, params string[] questions)
        {
            foreach (var q in questions) script[q] = intent;
        }

        Many(Intent([QuestionTopics.IrrigationOrControl]),
            "Có nên tưới cho khu vực này bây giờ không?", "Có nên tưới nhỏ giọt bây giờ không?");
        Many(Intent([QuestionTopics.SensorReadings, QuestionTopics.IrrigationOrControl], [soil]),
            "Độ ẩm đất hiện tại thế nào, có cần tưới không?", "Độ ẩm đất thấp, có nên tưới ngay không?");
        Many(Intent([QuestionTopics.Weather]), "Thời tiết dự báo tiếp theo có thích hợp cho sự phát triển của cây không?");
        Many(Intent([QuestionTopics.Schedules]), "Có lịch tưới tự động nào sắp chạy trong hôm nay không?", "lịch tưới sắp tới của zone");
        Many(Intent([QuestionTopics.AgronomyKnowledge]),
            "Khi nào nên thu hoạch xà lách?", "Khi nào nên thu hoạch thanh long?", "Khi nào nên thu hoạch cà chua?",
            "Cách phòng trừ sâu bệnh hại cho cà chua là gì?", "nhiệt độ ảnh hưởng thế nào đến cây", "loại cây nào chịu hạn tốt",
            "cà chua thu hoạch sau bao nhiêu ngày", "cà chua giai đoạn ra hoa cần bón phân gì", "quy trình VietGAP ghi chép nhật ký");

        Many(Intent([QuestionTopics.SensorReadings]), "thông tin cảm biến hiện tại");
        Many(Intent([QuestionTopics.SensorReadings], [soil]), "độ ẩm đất của zone", "cho tôi biết độ ẩm đất hiện tại", "Độ ẩm đất hiện tại thế nào?");
        Many(Intent([QuestionTopics.SensorReadings], [soil, air]), "độ ẩm bao nhiêu");
        Many(Intent([QuestionTopics.SensorReadings], [EnvironmentalParameterCode.Temperature]), "nhiệt độ của zone");

        Many(Intent([QuestionTopics.Devices], scope: QuestionIntent.ScopeSensors), "danh sách các thiết bị cảm biến của zone", "các cảm biến trong zone", "Zone này có những cảm biến nào?");
        Many(Intent([QuestionTopics.Devices], scope: QuestionIntent.ScopeActuators), "2 thiết bị chấp hành là cái gì");
        Many(Intent([QuestionTopics.Devices], detail: true), "thông tin của các thiết bị này hiện tại");
        Many(Intent([QuestionTopics.Gateways]), "gateway của zone này thế nào?", "trạm trung tâm đang hoạt động không", "gateway đang thế nào");
        Many(Intent([QuestionTopics.Devices, QuestionTopics.Gateways]), "liệt kê các thiết bị và gateway của zone");

        Many(Intent([QuestionTopics.Alerts]), "có cảnh báo nào không", "zone đang có cảnh báo gì");
        Many(Intent([QuestionTopics.Commands]), "lệnh tưới gần đây là gì", "bơm đã chạy lần nào chưa");
        Many(Intent([QuestionTopics.Tasks]), "công việc sắp đến hạn", "có nhiệm vụ nào cần làm không");
        Many(Intent([QuestionTopics.Season]), "cây đang ở giai đoạn nào", "giai đoạn hiện tại của cây", "zone này đang trồng cây gì", "cây bao nhiêu ngày tuổi rồi");
        Many(Intent([QuestionTopics.ZoneInfo]), "diện tích zone là bao nhiêu", "thông tin zone này");
        Many(Intent([QuestionTopics.AutoRules]), "quy tắc tự động của zone");
        Many(Intent([QuestionTopics.DeviceHealth]), "pin các node còn bao nhiêu", "tín hiệu các node thế nào");
    }
}
