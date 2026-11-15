# SmartFarm IoT — Runbook kiểm thử end-to-end

Tài liệu này kiểm thử từ nhập kho đến OTA thực tế. Phạm vi hiện tại chỉ gồm Gateway ESP32 và Node Arduino Nano qua LoRa/E32; không gồm Controller Arduino Uno.

## 1. Nguyên tắc

- Không dùng Node, Gateway, telemetry, UUID, MAC, Serial hoặc tọa độ giả.
- `Provisioned` không đồng nghĩa `Online`.
- `Activated` không đồng nghĩa OTA thành công.
- Gateway Online chỉ khi Backend nhận heartbeat MQTT hoặc telemetry hợp lệ trong cửa sổ freshness.
- Nano nạp qua USB bằng Arduino IDE/PlatformIO; Nano không được hiển thị là OTA.
- Mỗi bước phải lưu ảnh UI, Serial log, API/DB evidence hoặc kết quả test.

## 2. Chuẩn bị môi trường

| Thành phần | Giá trị |
|---|---|
| Backend | `http://localhost:5144` |
| Frontend | `http://localhost:3000` |
| MQTT | `localhost:1883` |
| PostgreSQL | `localhost:5432` |
| Database | `smartfarmdb01` |
| Firmware repo | `E:\learning\smartfarm-firmware` |
| ESP serial | Ví dụ `COM11` |

Khởi động Backend:

```powershell
cd E:\learning\demo-capstone
$env:ConnectionStrings__SmartFarmDb='Host=localhost;Port=5432;Database=smartfarmdb01;Username=postgres;Password=12345'
dotnet run --no-build --project .\backend\SmartFarm\SmartFarm.Api\SmartFarm.Api.csproj --urls http://0.0.0.0:5144
```

Backend phải tự chạy migration. Nếu migration lỗi thì dừng test, sửa schema rồi khởi động lại.

Chạy preflight trước test:

```powershell
$env:PGPASSWORD='12345'
.\scripts\iot-preflight.ps1 -SerialPort COM11
```

Kết quả đầu quy trình có thể là `Gateway MQTT heartbeat = False`. Sau khi ESP chạy runtime, check này bắt buộc phải thành `True`.

## 3. Firmware Repository và Firmware Registry

### 3.1. GitHub Release

Kiểm tra GitHub Actions đã thành công và Release có:

- Gateway Bootstrap `.bin`/package.
- Gateway Runtime/OTA `.bin`/package.
- Nano `.hex`.
- `SHA256SUMS.txt`.
- Tag, Commit SHA, Artifact URL và Repository URL.

### 3.2. UI Platform Admin

Mở `Platform Admin → Firmware Registry`.

Kiểm tra:

- Đúng hardware target: `ESP32_GATEWAY` hoặc `ARDUINO_NANO_NODE`.
- Version, Git tag, Commit SHA, Repository URL đúng GitHub Release.
- Artifact mở được.
- SHA-256 khớp `SHA256SUMS.txt`.
- Source code có link tải.
- Release mới là `Chờ duyệt`.

Bấm `Duyệt`, kiểm tra trạng thái `Đã duyệt`. Chỉ release đã duyệt mới xuất hiện trong Hardware Preparation và OTA.

## 4. Bước 1 — Nhập thiết bị vào kho

### Người thực hiện

Platform Admin/Warehouse.

### Thao tác

1. Mở `Kho Vật tư & Linh kiện`.
2. Chọn Gateway ESP32 hoặc Node Arduino Nano.
3. Nhập model, nhà sản xuất, mã phần cứng, số lượng, vị trí kho.
4. Gateway bắt buộc có MAC Address và Serial Number thật.
5. Node bắt buộc có mã định danh riêng.

### Check UI

- Thiết bị xuất hiện đúng một lần.
- MAC/Serial đúng thiết bị thật.
- Trạng thái ban đầu `InWarehouse`.
- Chưa có Technician giữ thiết bị.
- Số lượng đúng thực tế.

## 5. Bước 2 — Cấp phát có phê duyệt

### Technician

1. Chọn Gateway/Node và số lượng.
2. Gửi yêu cầu cấp phát.

### Admin UI

Mở `Kho Vật tư & Linh kiện → Đơn cấp phát chờ duyệt`.

Kiểm tra:

- Hiển thị tên Technician, không chỉ User ID.
- Đúng thiết bị và số lượng.
- Trạng thái `Pending`.
- Có nút `Duyệt` và `Từ chối`.

Bấm `Duyệt`, sau đó kiểm tra:

- Đơn thành `Approved`.
- Thiết bị chuyển `InWarehouse → InTechnicianStock`.
- Technician Inventory hiển thị đúng người giữ và số lượng.
- Technician không thể lấy thẳng thiết bị trong kho mà bỏ qua đơn.

## 6. Bước 3 — Technician Inventory

Mở `Technician → Kho Vật tư & Linh kiện`.

Kiểm tra:

- Gateway và Node đang giữ.
- Số lượng còn lại.
- Trạng thái sử dụng.
- Lịch sử cấp phát.

Thử các thao tác:

- Tạo yêu cầu bổ sung.
- Báo thiết bị lỗi.
- Trả thiết bị về kho.
- Xem lịch sử.

## 7. Bước 4 — Hardware Preparation

Mở `Technician → Chuẩn bị phần cứng`.

### Gateway ESP32

1. Chọn Gateway trong Technician Stock.
2. Chọn Bootstrap Release đã duyệt.
3. Kiểm tra Source, Artifact, Commit SHA và SHA-256.
4. Tải và nạp Bootstrap qua USB.

Serial mong đợi:

```text
SMARTFARM_BOOTSTRAP_READY
WIFI_CONFIG_REQUIRED
```

Nếu Wi-Fi đã lưu:

```text
WIFI_CONNECTED
```

Vừa nạp Bootstrap không được tự động Enrollment nếu chưa có thao tác Enrollment hợp lệ.

### Node Nano

1. Chọn Nano Release đã duyệt.
2. Tải source code hoặc `.hex`.
3. Technician chỉnh code theo cảm biến được cắm thật.
4. Cấu hình Node ID và LoRa Address.
5. Nạp qua Arduino IDE/PlatformIO.
6. Ghi nhận định danh trên UI.

### Check UI Hardware Preparation

- Dropdown chỉ có release approved.
- Hiển thị Artifact URL, Source URL, Commit SHA và SHA-256.
- Gateway dùng MAC/Serial thật.
- Node dùng Node ID/LoRa Address thật.
- Connectivity evidence bắt buộc trước `ReadyForDeployment`.

## 8. Bước 5 — Wi-Fi và Enrollment

### Wi-Fi

Dùng provisioning AP/UI của ESP hoặc Serial command theo firmware:

```text
WIFI|SSID|PASSWORD
```

Log mong đợi:

```text
WIFI_SAVED_RESTART_REQUIRED
WIFI_CONNECTED
```

### Enrollment UI

Mở `Technician → Gateway Enrollment`.

1. Chọn Gateway đang cấp cho Technician.
2. Nhập MAC Address đọc từ ESP.
3. Nhập ESP32 Chip ID.
4. Nhập Gateway Serial.
5. Chọn Bootstrap version approved.
6. Bấm `Bắt đầu Enrollment`.

UI phải hiển thị Enrollment ID và trạng thái `Enrolled`.

Serial phải có:

```text
ENROLLMENT_OK
MAC=...
CHIP=...
```

Lỗi cần ghi nhận:

- `404`: enrollment/backend URL không đúng.
- `409`: enrollment đã dùng hoặc thiết bị đã đăng ký.
- `500`: Backend/schema/config lỗi.

## 9. Bước 6 — Activate Gateway runtime

Sau Enrollment:

1. Chọn Deployment Request hợp lệ.
2. Bấm `Activate Gateway runtime`.

### Check UI/Backend

- Gateway có Gateway ID.
- Có MQTT Client ID và certificate fingerprint.
- Có runtime configuration.
- Trạng thái là `Provisioned`.
- `last_seen_at_utc` có thể vẫn rỗng.
- Không được kết luận OTA thành công ở bước này.

## 10. Bước 7 — Heartbeat MQTT độc lập

Firmware ESP runtime mới gửi định kỳ:

```text
smartfarm/gateways/{gatewayId}/heartbeat
```

Payload gồm Gateway ID, Serial, ConfigVersion và uptime.

Serial mong đợi:

```text
MQTT_CONNECTED
HEARTBEAT_PUBLISHED
```

Broker phải:

1. Xác thực MQTT Client ID.
2. Kiểm tra Gateway ID trong topic khớp client.
3. Cập nhật `gateways.last_seen_at_utc`.
4. Chuyển `GatewayStatus = Online`.

### Check UI Gateway

Mở `Technician → Quản lý Gateway ESP32`:

- Bộ đếm `MQTT heartbeat thật` tăng.
- Hiển thị thời điểm heartbeat gần nhất.
- Badge chỉ là `Online` khi heartbeat còn mới.
- Nếu chỉ có `Provisioned`, hiển thị `Chưa nhận MQTT heartbeat thật`.

Lưu ý: ESP đang chạy firmware cũ phải được cập nhật sang release có heartbeat độc lập trước khi check này đạt.

## 11. Bước 8 — Gateway Configuration/Node Registry

1. Chọn Gateway Online.
2. Chọn các Node đã cấp phát.
3. Cấu hình polling interval, heartbeat interval, timeout và retry.
4. Lưu cấu hình.

### Backend/UI

- `ConfigVersion` tăng.
- Trạng thái trước ACK là `PendingApply`.
- MQTT publish gói `CONFIG`.
- Không tự thêm Node chưa có trong Backend.

### ESP

```text
CONFIG_RECEIVED version=...
CONFIG_ACK version=...
```

Sau ACK, UI/DB chuyển `ConfigSyncStatus` thành `Applied`. Nếu không có ACK, không được tự hiển thị Applied.

## 12. Bước 9 — Node LoRa và Telemetry

### Chuẩn bị

1. Bật Nano và cảm biến thật.
2. Kiểm tra Node ID/LoRa Address khớp Backend.
3. Kiểm tra Gateway có Node Registry.

### ESP Serial

Thành công:

```text
NODE_POLL address=... id=...
NODE_POLL_OK id=...
TELEMETRY_PUBLISHED node=...
```

Thất bại:

```text
NODE_POLL_TIMEOUT id=...
```

### Backend/UI

Telemetry phải lưu đúng:

- Gateway ID.
- Node ID.
- Zone ID.
- Parameter code.
- Giá trị và đơn vị.
- CapturedAtUtc/ReceivedAtUtc.

UI Monitoring/GIS phải:

- Hiển thị Node thật đúng Zone.
- Hiển thị đúng cảm biến đã khai báo trên Backend.
- Hiển thị giá trị/đơn vị từ telemetry thật.
- Hiển thị `Chưa nhận dữ liệu` nếu chưa có telemetry, không dùng số mặc định.

## 13. Bước 10 — GIS Deployment

Chỉ gán GIS khi:

- Hardware Preparation là `ReadyForDeployment`.
- Gateway có heartbeat thật.
- Node connection test thành công.
- Node có Device ID và tọa độ thật.

GIS không được tự sinh Node ID, MAC, Serial, trạng thái Online hoặc tọa độ.

## 14. Bước 11 — OTA Gateway

### Trên GitHub/Firmware Registry

1. Tạo Release mới.
2. Build Gateway Runtime `.bin`.
3. Tạo SHA256SUMS.
4. Đồng bộ release vào Firmware Registry.
5. Platform Admin bấm `Duyệt`.

### Trên UI

1. Chọn Gateway đã Activated.
2. Chọn release `Đã duyệt`.
3. Kiểm tra version, Artifact URL và SHA-256.
4. Bấm cập nhật OTA.

Trạng thái ban đầu phải là `Scheduled` hoặc `InProgress`, không phải `Succeeded`.

### ESP Serial

```text
OTA_JOB_RECEIVED
OTA_STARTED
OTA_APPLIED
```

Lỗi:

```text
OTA_SHA256_MISMATCH
OTA_WRITE_FAILED:...
OTA_RESULT_REPORTED
```

### Sau reboot

ESP phải:

1. Chạy firmware version mới.
2. Kết nối Wi-Fi.
3. Kết nối MQTT.
4. Gửi heartbeat mới.

Backend/UI chỉ chuyển job thành `Succeeded` sau device result hợp lệ. Reload UI phải vẫn hiển thị đúng kết quả đọc từ Backend.

## 15. Kiểm thử lỗi

| Tình huống | Kết quả đúng |
|---|---|
| MAC không thuộc Technician Stock | Enrollment bị từ chối |
| Enrollment ID đã dùng | HTTP 409 |
| Chưa cấu hình Wi-Fi | `WIFI_CONFIG_REQUIRED` |
| MQTT identity sai | Broker từ chối |
| Heartbeat sai Gateway ID | Broker từ chối/bỏ qua và ghi log |
| Chưa có heartbeat | Không hiển thị Online |
| Config version cũ | ESP từ chối |
| Node chưa cấp phát | Không cho vào Node Registry |
| LoRa không phản hồi | `NODE_POLL_TIMEOUT`, không tạo telemetry |
| Parameter chưa khai báo | Backend từ chối/bỏ qua theo policy |
| SHA-256 sai | `OTA_SHA256_MISMATCH` |
| Không có OTA device result | Job chuyển Failed/Timeout |
| Reload UI | Trạng thái đọc lại từ Backend |

## 16. Bằng chứng cần lưu

- Firmware Registry release approved.
- Kho và đơn cấp phát đã duyệt.
- Technician Inventory.
- Hardware Preparation.
- Enrollment `Enrolled`.
- Activation `Provisioned`.
- Serial log `ENROLLMENT_OK`.
- Serial log `MQTT_CONNECTED` và `HEARTBEAT_PUBLISHED`.
- UI Gateway có heartbeat thật.
- Serial log `NODE_POLL_OK` và `TELEMETRY_PUBLISHED`.
- UI telemetry/GIS.
- Serial log `OTA_APPLIED`.
- UI OTA `Succeeded` sau reboot.
- Kết quả `iot-preflight.ps1` trước/sau test.

## 17. Tiêu chí kết luận

Chỉ kết luận **Pass end-to-end** khi:

1. Thiết bị đi `InWarehouse → InTechnicianStock` qua đơn được duyệt.
2. Enrollment thành công với MAC/Chip ID/Serial thật.
3. Gateway Activated và nhận runtime config.
4. ESP gửi heartbeat MQTT độc lập.
5. UI hiển thị Online theo heartbeat thật.
6. Node phản hồi LoRa.
7. Telemetry thật được lưu và hiển thị đúng cảm biến.
8. GIS dùng Device ID/tọa độ thật.
9. OTA dùng release approved, kiểm tra SHA-256.
10. ESP reboot, chạy version mới và gửi heartbeat lại.
11. Backend chỉ ghi OTA thành công sau device result.

Nếu thiếu heartbeat, Node response hoặc OTA result sau reboot thì chỉ được kết luận **Code/Backend ready**, chưa phải **End-to-end Pass**.
