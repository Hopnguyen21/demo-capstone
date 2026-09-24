# SmartFarm Backend

Nền tảng backend SmartFarm dùng .NET 8, ASP.NET Core, Clean Architecture và PostgreSQL với EF Core Code First. Các slice hiện có bao phủ Auth/Tenant, cấu trúc Farm, mùa vụ, IoT/telemetry/control, AI, kho/công việc, tài chính, bảo trì và báo cáo.

## Cấu trúc solution

- `SmartFarm.Domain`: entity, enum và mô hình miền; không tham chiếu framework hoặc project khác.
- `SmartFarm.Application`: contract/use-case abstraction cho Auth, User, Tenant và Technician; chỉ tham chiếu Domain.
- `SmartFarm.Infrastructure`: dịch vụ xác thực, PostgreSQL, EF Core DbContext, Fluent API configuration và migrations; tham chiếu Application và Domain.
- `SmartFarm.Api`: controller mỏng, JWT Bearer, composition root, Problem Details, CORS, correlation ID, Swagger ở Development và health endpoint.
- `tests/SmartFarm.Domain.Tests`: kiểm tra mô hình miền và bốn vai trò chuẩn.
- `tests/SmartFarm.Infrastructure.Tests`: kiểm tra EF Core model, unique index và composite key.
- `tests/SmartFarm.Architecture.Tests`: kiểm tra chiều phụ thuộc Clean Architecture.
- `tests/SmartFarm.Api.Tests`: integration test cho JWT/refresh/logout, role và tenant isolation bằng EF InMemory.

Schema gồm `Tenant`, `AppUser`, `RefreshToken`, `Farm`, `Field`, `Zone` và `UserZoneAccess`. Refresh token chỉ lưu SHA-256 hash; access token được liên kết bằng `jti` để logout/disable tài khoản có hiệu lực ngay. PostgreSQL lưu khóa chính bằng UUID, thời gian bằng `timestamp with time zone`, enum bằng chuỗi, đồng thời có các khóa ngoại, unique index và check constraint nền tảng. PostGIS, TimescaleDB và pgvector chưa được bật vì tài liệu yêu cầu xác nhận extension trước.

## Yêu cầu

- .NET SDK 8.0.x. `global.json` ghim SDK `8.0.100` và cho phép dùng patch mới nhất.
- PostgreSQL 16 hoặc phiên bản tương thích với Npgsql 8.
- `dotnet-ef` 8.0.11 để tạo hoặc áp dụng migration.

Các package persistence được ghim ở phiên bản `8.0.11`: `Microsoft.EntityFrameworkCore`, `Microsoft.EntityFrameworkCore.Design` và `Npgsql.EntityFrameworkCore.PostgreSQL`. JWT Bearer và Identity Core dùng `8.0.18`; `System.IdentityModel.Tokens.Jwt` dùng `7.1.2`.

## Cấu hình

Không lưu mật khẩu trong source control. API yêu cầu connection string qua biến môi trường. Ví dụ PowerShell:

```powershell
$env:ConnectionStrings__SmartFarmDb = "Host=localhost;Port=5432;Database=smartfarm;Username=smartfarm;Password=<password>"
$env:Jwt__SigningKey = "<at-least-32-random-characters>"
$env:ASPNETCORE_ENVIRONMENT = "Development"
```

Origin frontend mặc định ở Development là `http://localhost:5173` và `https://localhost:5173`. Có thể ghi đè theo môi trường:

```powershell
$env:Cors__AllowedOrigins__0 = "https://app.example.com"
```

## Restore, build và test

Chạy từ thư mục chứa `SmartFarm.sln`:

```powershell
dotnet restore SmartFarm.sln
dotnet build SmartFarm.sln --no-restore
dotnet test SmartFarm.sln --no-build
```

## Migration và database

Cài đúng major version của EF tool:

```powershell
dotnet tool install --global dotnet-ef --version 8.0.11
```

Migration đầu tiên nằm trong `SmartFarm.Infrastructure/Persistence/Migrations`. Áp dụng migration sau khi đã đặt biến môi trường connection string:

```powershell
dotnet ef database update `
  --project SmartFarm.Infrastructure `
  --startup-project SmartFarm.Api
```

Tạo migration tiếp theo:

```powershell
dotnet ef migrations add <MigrationName> `
  --project SmartFarm.Infrastructure `
  --startup-project SmartFarm.Api `
  --output-dir Persistence/Migrations
```

Luôn xem lại SQL migration trước khi áp dụng lên môi trường dùng chung hoặc production.

Các migration hiện có:

- `InitialCreate`: schema nền tảng.
- `AuthIdentity`: normalized email, trạng thái đăng nhập và refresh-token session.
- `AllowUnassignedFarmAccounts`: cho phép Owner/Farmer đăng ký trước khi được gắn tenant/farm.
- `FarmFieldZoneBoundaries`: thêm ranh giới GeoJSON `jsonb` và giới hạn diện tích Farm.
- `CropGrowthPlantingSeason`: catalog cây/giống, profile/stage/ngưỡng môi trường và vòng đời mùa vụ.
- `IoTPlanningDeploymentHardware`: đề xuất thiết bị, yêu cầu triển khai, khảo sát, Gateway/Device, lịch sử quyết định, kiểm tra kết nối và handoff bảo trì.
- `IoTServiceHandoffConstraints`: bổ sung khóa ngoại cho Service Request bàn giao từ triển khai lỗi.
- `IoTDiagnosticJobs`: lưu lệnh chẩn đoán bất đồng bộ, chờ phản hồi thực tế từ transport adapter.
- `TelemetryAlerts`: định danh MQTT Gateway, readings chống trùng, rule/state anti-flap, alerts và lịch sử xác nhận/xử lý.
- `ControlAutomation`: Schedule, AutoRule, command state machine, MQTT feedback và command-event audit log.
- `AiAdvisoryRecommendations`: yêu cầu tư vấn, context snapshot, Recommendation, quyết định Owner, rate-limit audit và liên kết lệnh `AI_APPROVED`.
- `InventoryAndFarmTasks`: kho vật tư, giao dịch nhập/xuất, cảnh báo tồn thấp, Task và lịch sử trạng thái.
- `FinanceAndDeviceServiceLifecycle`: khoản thu/chi, báo cáo dòng tiền, vòng đời Service Request, chẩn đoán, thay thế và liên kết thiết bị cũ–mới.
- `ReportingActuatorFlowRate`: bổ sung lưu lượng định mức của actuator làm nguồn tính lượng nước từ lệnh đã ACK.

## Chạy API

```powershell
dotnet run --project SmartFarm.Api
```

Health endpoint:

```http
GET /health
```

Phản hồi thành công có HTTP 200 và nội dung tương tự:

```json
{"status":"Healthy","checks":[]}
```

Mọi response đều có header `X-Correlation-ID`. Exception và HTTP error được chuyển sang RFC 7807 Problem Details khi client chấp nhận định dạng phù hợp. Swagger chỉ bật trong môi trường Development.

## Auth/User/Tenant API

Hợp đồng chuẩn nằm tại `docs/AUTH_CONTRACT_V1.md`. Các route đã triển khai:

- `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`
- `GET /api/v1/users`, `/api/v1/users/me`, `/api/v1/users/{userId}`
- `POST /api/v1/users/invite`, `PUT /api/v1/users/{userId}/zone-access`
- `POST /api/v1/tenants/register`, `GET|PUT /api/v1/tenants/me`
- `GET|POST /api/v1/platform/technicians`, `PUT /api/v1/platform/technicians/{userId}`

Chỉ có bốn role: `PlatformAdmin`, `PlatformTechnician`, `FarmOwner`, `Farmer`. Đăng ký công khai chỉ chấp nhận Owner hoặc Farmer. Owner tạo Tenant khi thiết lập Farm đầu tiên; lời mời Farmer chỉ gắn một tài khoản Farmer đã tồn tại vào đúng một Farm. API không sinh hoặc trả mật khẩu tạm.

## Farm Field Zone API

Hợp đồng và quyết định lưu polygon nằm tại `docs/FARM_STRUCTURE_CONTRACT_V1.md`. Field và Zone dùng GeoJSON Polygon lưu trong PostgreSQL `jsonb`; hệ thống hiện không giả định PostGIS đã được cài.

- Farm: `GET|POST /api/v1/farms`, `GET|PUT|DELETE /api/v1/farms/{farmId}`, `GET /api/v1/farms/{farmId}/structure`
- Field: `GET|POST /api/v1/farms/{farmId}/fields`, `GET|PUT|DELETE /api/v1/fields/{fieldId}`
- Zone: `GET|POST /api/v1/fields/{fieldId}/zones`, `GET|PUT|DELETE /api/v1/zones/{zoneId}`

Mọi route yêu cầu `FarmOwner`, lấy Tenant từ JWT và kiểm tra toàn bộ chuỗi cha. DELETE là archive, không xóa vật lý.

## Crop Growth và Planting Season API

Hợp đồng đã đối chiếu Flow 1 và API #33–#45 nằm tại `docs/CROP_GROWTH_CONTRACT_V1.md`.

- Crop/Variety: `GET|POST /api/v1/crops`, `GET|POST /api/v1/crops/{cropId}/varieties`
- Growth Profile: `GET /api/v1/crops/{cropId}/growth-profiles`, `POST /api/v1/growth-profiles`, `GET /api/v1/growth-profiles/{profileId}/stages`
- Requirement: `PUT /api/v1/growth-stages/{stageId}/requirements`
- Planting Season: `GET|POST /api/v1/zones/{zoneId}/planting-seasons`, `GET /api/v1/zones/{zoneId}/planting-seasons/{seasonId}`, `PUT .../stage`, `PUT .../close`

Migration seed một profile Tomato mặc định của hệ thống. Profile hệ thống chỉ đọc; tùy chỉnh tạo bản clone theo Tenant. PostgreSQL có filtered unique index bảo đảm mỗi Zone chỉ có tối đa một mùa vụ `InProgress`.

## IoT Planning Deployment và Hardware API

Hợp đồng bổ sung Flow 1 nằm tại `docs/IOT_DEPLOYMENT_CONTRACT_V1.md`. Nhóm `IOT-V1-01`–`IOT-V1-15` bao phủ lấy thông số cần đo, đề xuất, Owner điều chỉnh/gửi yêu cầu, Technician tiếp nhận/khảo sát/xác nhận/lắp đặt, lưu connection test, hoàn tất hoặc tạo handoff bảo trì.

Gateway/Device API #54–#68 đã được triển khai. Các thao tác provision, cấu hình và gán phần cứng chỉ được phép cho Technician đã nhận đúng Deployment Request; Farm, Zone, Gateway và Device phải cùng một chuỗi triển khai. `GET /devices/{deviceId}/ping` trả kết quả kiểm tra đã ghi nhận gần nhất, không giả lập MQTT ACK.

## Telemetry và Alert API

Hợp đồng MQTT và phần đối chiếu Flow 2/API #46–#49, #69–#75 nằm tại `docs/TELEMETRY_ALERT_CONTRACT_V1.md`.

- Telemetry: `GET /api/v1/zones/{zoneId}/telemetry/latest|history|stats`
- Alert Rule: `GET|POST /api/v1/zones/{zoneId}/alert-rules`, `PUT|DELETE /api/v1/zones/{zoneId}/alert-rules/{ruleId}`
- Alert: `GET /api/v1/farms/{farmId}/alerts`, `GET /api/v1/zones/{zoneId}/alerts`, `GET /api/v1/alerts/{alertId}`, `PUT .../acknowledge`, `PUT .../resolve`

MQTT không đi qua controller người dùng. Broker gọi `IMqttTelemetryAdapter` với topic `smartfarm/gateways/{gatewayId}/telemetry`, MQTT client ID, SHA-256 certificate fingerprint và payload JSON. Adapter chỉ làm xác thực/chuẩn hóa transport; `ITelemetryIngestionService` thực hiện validation, idempotency, persistence và anti-flap nên có thể kiểm thử không cần broker. Latest chỉ đánh dấu fresh trong cửa sổ 5 phút; telemetry cũ không đổi trạng thái Device/Gateway thành Online.

## Schedule AutoRule và Control API

Hợp đồng chuẩn hóa Flow 3 và API #50–#53, #76–#83 nằm tại `docs/CONTROL_CONTRACT_V1.md`.

- Schedule: `GET|POST /api/v1/zones/{zoneId}/schedules`, `PUT|DELETE /api/v1/zones/{zoneId}/schedules/{scheduleId}`
- AutoRule: `GET|POST /api/v1/zones/{zoneId}/rules`, `PUT|DELETE /api/v1/zones/{zoneId}/rules/{ruleId}`
- Control: `POST /api/v1/zones/{zoneId}/actuators/{actuatorId}/command`, `GET .../status`, `DELETE /api/v1/zones/{zoneId}/commands/{commandId}`, `GET /api/v1/zones/{zoneId}/actuators/history`

HTTP 202 chỉ xác nhận lệnh đã được lưu/gửi. Trạng thái thành công chỉ xuất hiện sau feedback xác thực từ Gateway qua `IActuatorFeedbackAdapter`. `IActuatorCommandTransport` và `IRainForecastProvider` mặc định từ chối an toàn khi chưa cấu hình tích hợp thật; integration test thay chúng bằng fake. Worker mỗi phút xử lý schedule đến hạn và command quá hạn ACK.

## AI Advisory API

Hợp đồng chuẩn hóa Flow 4 và API #84-#88 nằm tại `docs/AI_RECOMMENDATION_CONTRACT_V1.md`.

- `GET /api/v1/zones/{zoneId}/ai/context`
- `POST /api/v1/zones/{zoneId}/ai/ask`
- `POST /api/v1/zones/{zoneId}/ai/apply-recommendation`
- `GET|DELETE /api/v1/zones/{zoneId}/ai/history`

Context Farm/Zone, mùa vụ, Crop, Growth Stage, telemetry và thời tiết được dựng phía server trong Tenant từ JWT. `IAiAdvisoryProvider` và `IAiWeatherProvider` mặc định trả trạng thái không khả dụng thay vì bịa dữ liệu; môi trường triển khai phải đăng ký adapter thật. Chỉ FarmOwner có thể chấp nhận Recommendation còn hiệu lực và đủ confidence. Khi đó hệ thống mới tạo lệnh Control bất đồng bộ với `recommendation_id` và nguồn `AI_APPROVED`; thiết bị vẫn phải gửi ACK xác thực trước khi hiển thị thành công.

## Inventory và Farm Task API

Hợp đồng chuẩn hóa Flow 5–6 và API #96–#101 nằm tại `docs/INVENTORY_TASK_CONTRACT_V1.md`.

- Inventory: `GET|POST /api/v1/farms/{farmId}/inventory`, `POST .../inventory/{itemId}/receipts`, `PUT .../inventory/{itemId}/requirements`, `POST .../inventory/issues`, `GET .../inventory/low-stock-alerts`
- Task: `GET|POST /api/v1/farms/{farmId}/tasks`, `PUT /api/v1/farms/{farmId}/tasks/{taskId}`

Vật tư là duy nhất theo tên chuẩn hóa trong từng Farm; mọi nhập/xuất đều có sổ giao dịch và xuất kho không thể làm âm tồn. Nhu cầu vật tư liên kết đúng một Crop, Variety hoặc Growth Stage. Task dùng state machine có audit history; chỉ Farmer được giao mới có thể tiếp nhận/thực hiện/báo kết quả, còn Owner duyệt hoặc phân công lại Task thất bại/quá hạn. Flow `Manager`/`Employee` không tạo role mới mà ánh xạ sang `FarmOwner`/`Farmer`.

## Finance và Device Service API

Hợp đồng bổ sung Flow 7–8 nằm tại `docs/FINANCE_SERVICE_CONTRACT_V1.md`.

- Finance: CRUD khoản thu/chi tại `/api/v1/farms/{farmId}/finance/...`; `GET /api/v1/farms/{farmId}/cash-flow-report` trả `revenue - expense` theo khoảng UTC.
- Service Request: Owner tạo yêu cầu; PlatformAdmin phân công; đúng PlatformTechnician được giao mới có thể tiếp nhận, chẩn đoán, ghi công việc, thay thiết bị, ghi connection test và đóng yêu cầu.
- Hot-swap #95 giữ liên kết thiết bị cũ–mới và hai bản ghi lịch sử Zone. Chỉ được đóng sau test đạt của thiết bị hiện hành.

Nhóm chi phí chuẩn là `Material`, `Farmer`, `IoT`, `Maintenance`, `Other`; không thêm role Employee.

## Reporting API

Hợp đồng, công thức và bảng nguồn nằm tại `docs/REPORTING_CONTRACT_V1.md`; trạng thái đối chiếu đủ 103 endpoint nằm tại `docs/ENDPOINT_STATUS.md`.

- Catalog #91–#94: tổng quan Farm, tổng kết mùa vụ, nước và điện.
- `REPORT-V1-01..03`: tồn kho, công việc và lịch sử bảo trì.
- Catalog #102: dòng tiền ròng bằng tổng doanh thu trừ tổng chi phí.

Mọi báo cáo lấy Tenant từ JWT và kiểm Farm/Zone thuộc Tenant trước khi đọc. Nước và điện chỉ tính lệnh `TurnOn` đã nhận ACK; actuator thiếu lưu lượng/công suất bị loại khỏi tổng và được đếm riêng trong `unmeasuredCommandCount`, không được điền bằng hằng số giả định.

## Tài liệu nguồn

Trước khi triển khai endpoint nghiệp vụ, đọc `AGENTS.md`, `docs/DECISIONS.md`, `docs/API_CATALOG.md`, phần endpoint tương ứng trong `docs/reference/API .docx` và toàn bộ `docs/reference/SmartFarm_Flow.docx`. Thư mục `docs/reference` hiện chỉ có hai DOCX, dù yêu cầu ban đầu nhắc ba tài liệu. Không tự suy đoán tài liệu còn thiếu hoặc các hợp đồng đang mâu thuẫn.
