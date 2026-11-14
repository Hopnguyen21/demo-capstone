# Configuration Matrix

Tham số nghiệp vụ của SmartFarm, nơi lưu, và Admin có đổi được ngay trên giao diện hay không.
Cập nhật lần cuối: 2026-11-13 (SR-28: đưa tham số nghiệp vụ vào `platform_settings`).

**Quy ước.** "Admin đổi được" nghĩa là sửa ở màn hình **Cấu hình Platform** (`/admin/settings`, `PUT /api/v1/platform/settings`)
và có hiệu lực ở lần đọc kế tiếp, không cần restart. Giá trị ngoài khoảng cho phép bị từ chối (400) và mỗi lần đổi ghi
`audit_logs` với action `PLATFORM_SETTING_UPDATED`. Dòng cấu hình còn thiếu hoặc không hợp lệ thì dùng giá trị mặc định ở cột "Mặc định".

## A. Đã nằm trong `platform_settings` (Admin đổi được)

| Key | Ý nghĩa | Mặc định | Khoảng | Nơi dùng | Demo |
|---|---|---|---|---|---|
| `control.rain_guard_threshold_percent` | Xác suất mưa (%) từ mức này trở lên thì chặn lệnh bật bơm thủ công; cũng là mặc định cho lịch tưới tự tạo từ hồ sơ sinh trưởng | 70 | 0 – 100 | `ControlService` (lệnh thủ công), `ScheduleSyncService` (lịch tự tạo) | ☐ |
| `contract.deposit_percent` | Tỷ lệ tạm ứng (%) trên tổng báo giá/hợp đồng | 30 | 1 – 100 | `QuotationService.CreateAsync`, `ZoneContractService` | ☐ |
| `contract.repeat_purchase_discount_percent` | Giảm giá (%) khi cùng bên thuê mua lại trong 60 ngày | 15 | 0 – 100 | `ZoneContractService` | ☐ |
| `contract.renewal_discount_percent` | Giảm giá (%) khi gia hạn từ hợp đồng gốc | 10 | 0 – 100 | `ZoneContractService` | ☐ |
| `ai.minimum_confidence` | Độ tin cậy tối thiểu (0 – 1) để đề xuất AI là Ready | 0.70 | 0 – 1 | `AiAdvisoryService` (hỏi, quyết định, ngữ cảnh) | ☐ |
| `ai.telemetry_freshness_minutes` | Số phút tối đa để số liệu cảm biến còn được coi là mới | 5 | 1 – 1440, số nguyên | `AiAdvisoryService` | ☐ |

Ghi chú:
- Cột tên `Deposit30Percent` / `Remaining70Percent` của báo giá giữ tên cũ (tránh migration) nhưng giá trị theo `contract.deposit_percent`.
- **Áp dụng theo hợp đồng:** đổi `contract.deposit_percent` chỉ áp cho báo giá `SentToOwner` mà Owner CHƯA xem: backend tính lại số tiền khi đọc; Owner xem lần đầu thì chốt số đang hiển thị (ghi dấu `QUOTATION_VIEWED_BY_OWNER` trong audit_logs), từ đó số này không đổi dù Admin sửa tỷ lệ. Báo giá đã ký (`SignedByOwner`), đã nghiệm thu (`Completed`) và hợp đồng Zone đã tạo giữ nguyên số đã chốt (cọc, còn lại, VAT); web/mobile suy nhãn tỷ lệ từ chính số tiền của hợp đồng đó. VAT hiện là số theo từng dòng báo giá (chưa phải tham số Platform); nếu sau này thành tham số thì áp cùng quy tắc này.
- Lịch tưới và luật tự động đã tạo vẫn giữ `RainThresholdPercent` riêng của từng bản ghi; đổi cấu hình chỉ ảnh hưởng bản ghi tạo sau đó.
- `Ai:MinimumConfidence` và `Ai:TelemetryFreshnessMinutes` trong `appsettings.json` chỉ còn là giá trị dự phòng khi dòng cấu hình thiếu.

## B. Còn trong `appsettings.json` (đổi cần sửa file và restart: vẫn bị coi là hardcode, cần chuyển tiếp)

| Tham số | Giá trị | Vị trí | Việc cần làm |
|---|---|---|---|
| `Ai:MaxRequestsPerWindow` | 10 | appsettings | Chuyển vào `platform_settings` |
| `Ai:RateLimitWindowMinutes` | 60 | appsettings | Chuyển vào `platform_settings` |
| `Ai:RecommendationValidityMinutes` | 15 | appsettings | Chuyển vào `platform_settings` |
| `Jwt:AccessTokenMinutes` / `RefreshTokenDays` | 60 / 30 | appsettings | Có thể giữ (cấu hình triển khai) |
| `Invitations:ExpiryDays` | 7 | appsettings | Chuyển vào `platform_settings` |

## C. Còn là hằng số trong code (chưa cấu hình được)

| Tham số | Giá trị | Vị trí | Việc cần làm |
|---|---|---|---|
| Số lần cảnh báo liên tiếp để mở alert | 2 | `TelemetryAlertService.cs` (`ConsecutiveViolationCount < 2`) | Chuyển vào `platform_settings` |
| Thời lượng tưới tối đa một lệnh | 1800 s | `ControlService.ValidateDuration` | Chuyển vào `platform_settings` |
| Số ngày tối thiểu của vụ mùa | 20 | `CropGrowthService.cs` (dòng 321, 396) | Chuyển vào `platform_settings` |
| Khoá tài khoản sau đăng nhập sai | 5 lần, khoá 15 phút | `AuthService.cs` (dòng 86 – 89) | Chuyển vào `platform_settings` |

Các mục B và C chưa làm trong thay đổi này; ghi lại để không bị coi là đã cấu hình được.
