using SmartFarm.Domain.Entities;
using SmartFarm.Domain.Enums;

namespace SmartFarm.Infrastructure.Inventory;

/// <summary>
/// Quy tắc dùng chung cho kho thiết bị phần cứng (PlatformHardwareItems): hàng theo serial và dòng của kho chính.
/// </summary>
internal static class HardwareStockRules
{
    /// <summary>
    /// Hàng theo SERIAL: Gateway/Node có số serial, mỗi dòng là MỘT thiết bị vật lý (đổi chủ nguyên dòng, tồn đúng 1).
    /// Gateway/Node không có serial (danh mục tồn kho theo số lượng) được xử lý như hàng số lượng (tách dòng, trừ tồn).
    /// </summary>
    public static bool IsSerialTracked(PlatformHardwareItem h) =>
        !string.IsNullOrWhiteSpace(h.SerialNumber)
        && (h.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase)
            || h.Category.Contains("NODE", StringComparison.OrdinalIgnoreCase));

    /// <summary>Dòng thuộc KHO CHÍNH (không thuộc ai): xét theo trạng thái, không theo AssignedTechnicianId (dữ liệu cũ có người giữ thừa).</summary>
    public static bool IsMainWarehouseStatus(string? status) => status is "InWarehouse" or "InStock";

    /// <summary>Trạng thái không nhận thêm hàng / không xuất được (đã triển khai, lỗi, bảo trì, ngừng dùng).</summary>
    public static bool IsClosedStatus(string? status) => status is "Deployed" or "Faulty" or "Maintenance" or "Retired";

    /// <summary>Hàng KHÔNG phải Node (Gateway, bộ lắp đặt, camera): không được dùng làm Node cảm biến/điều khiển.</summary>
    public static bool IsNonNode(PlatformHardwareItem h) =>
        h.EstimateRole is "Gateway" or "InstallKit"
        || h.Category.Contains("GATEWAY", StringComparison.OrdinalIgnoreCase)
        || h.Category.Contains("CAMERA", StringComparison.OrdinalIgnoreCase)
        || h.Category.Contains("PERIPHERAL", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Loại Node của hàng: vai trò Admin gán (SensorNode/ActuatorNode) nếu có; chưa gán thì suy từ chủng loại kho
    /// (VALVE/PUMP/RELAY/ACTUATOR → điều khiển, SENSOR → cảm biến). Không suy được → null.
    /// </summary>
    public static DeviceType? EffectiveNodeType(PlatformHardwareItem h)
    {
        if (h.EstimateRole == "SensorNode") return DeviceType.SensorNode;
        if (h.EstimateRole is "ActuatorNode" or "ValveNode" or "PumpNode") return DeviceType.ActuatorNode; // Van/Bơm là Node điều khiển
        var c = h.Category.ToUpperInvariant();
        if (c.Contains("ACTUATOR") || c.Contains("VALVE") || c.Contains("PUMP") || c.Contains("RELAY")) return DeviceType.ActuatorNode;
        if (c.Contains("SENSOR")) return DeviceType.SensorNode;
        return null;
    }

    /// <summary>
    /// Loại Node được cấp phát phải khớp hàng trong kho: không dùng cảm biến cho Node điều khiển và ngược lại, không dùng Gateway/camera/bộ lắp đặt làm Node.
    /// Hàng không xác định được loại (không vai trò, chủng loại lạ) không bị chặn để không làm hỏng dữ liệu cũ.
    /// </summary>
    public static bool RoleMatches(PlatformHardwareItem h, DeviceType deviceType)
    {
        if (IsNonNode(h)) return false;
        var role = EffectiveNodeType(h);
        return role is null || role == deviceType;
    }
}
