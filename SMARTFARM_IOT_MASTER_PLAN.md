                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            # Kế hoạch tổng thể triển khai và quản lý IoT SmartFarm

> Tài liệu chuẩn để tiếp tục triển khai hệ thống. Nội dung Bước 1–4 đã được đối chiếu và điều chỉnh theo code hiện tại.

Runbook kiểm thử chi tiết từ đầu đến cuối: [SMARTFARM_IOT_E2E_TEST_RUNBOOK.md](SMARTFARM_IOT_E2E_TEST_RUNBOOK.md).

## 1. Phạm vi và nguyên tắc

Phạm vi phần cứng triển khai mới gồm:

- Gateway ESP32.
- Node Arduino Nano.
- Cảm biến, module LoRa và linh kiện đi kèm.

Controller Arduino Uno không nằm trong quy trình triển khai hiện tại. Các phần Controller/ActuatorNode còn trong code cũ phải được xem là legacy, không tạo thêm flow mới.

Backend là nguồn dữ liệu chính thức cho danh tính, quyền sở hữu, inventory, firmware, Node Registry, cấu hình và trạng thái triển khai. Gateway chỉ nhận bản sao cấu hình do Backend cấp; không tự quyết định Farm, Zone hoặc danh sách Node.

Không dùng thao tác thủ công hoặc dữ liệu ngẫu nhiên để đánh dấu Online, ConnectivityVerified hoặc hoàn tất triển khai.

## 2. Mô hình trạng thái

Các nhóm trạng thái phải tách biệt:

- Inventory: `InWarehouse`, `Allocated`, `InTechnicianStock`, `Deployed`, `Maintenance`, `Faulty`, `Returned`.
- Hardware Preparation: `HardwarePreparation`, `FirmwarePrepared`, `IdentityVerified`, `ConnectivityVerified`, `ReadyForDeployment`, `Faulty`, `Maintenance`.
- Firmware Release: `Imported`, `PendingReview`, `Approved`, `Denied`, `Deprecated`, `Revoked`.
- Enrollment: `Pending`, `Enrolled`, `Activated`, `Revoked`, `Failed`.
- Connection: `Online`, `Offline`, `Unknown`.
- Configuration: `Draft`, `Pending`, `Applying`, `Applied`, `Rejected`, `Failed`, `Outdated`.

Inventory status không đồng nghĩa Connection status. Một Gateway có thể `Deployed` nhưng `Offline`.

## 3. Bước 1 — Device Catalog

**Vai trò:** Admin.

Danh mục chuẩn:

| Nhóm | Thiết bị | Cách quản lý |
|---|---|---|
| Gateway | ESP32 Gateway | Theo Serial, MAC, Chip ID |
| Node | Arduino Nano | Theo Serial/Hardware ID, Node ID |
| Sensor | DHT22, Soil Moisture | Theo số lượng |
| Communication | LoRa SX1278/Ra-02 | Theo số lượng |
| Spare part | Relay, Pump, Valve | Theo số lượng hoặc mã tài sản |

Không tạo Controller flow mới. Nếu Controller cũ còn trong database/UI, đánh dấu legacy và không cho xuất hiện trong quy trình Bước 4 mới.

## 4. Bước 2 — Nhập kho và vòng đời

**Vai trò:** Admin/Warehouse.

Khi nhập kho:

1. Chọn loại thiết bị.
2. Nhập Model, Manufacturer và Hardware Revision.
3. Gateway bắt buộc Serial Number, MAC Address và nên có Chip ID.
4. Node bắt buộc Serial/Hardware ID.
5. Linh kiện nhập Quantity và Unit.
6. Gán Location/Rack.
7. Tạo audit record.
8. Đặt trạng thái ban đầu `InWarehouse`.

Thiết bị serialized chỉ được cấp phát từng item. Linh kiện được quản lý theo số lượng và phải cập nhật bằng transaction.

## 5. Bước 3 — Cấp phát cho Technician

### 5.1. Technician tạo request

Technician không lấy trực tiếp từ kho. Technician tạo Hardware Allocation Request gồm:

- Hardware Item.
- Quantity.
- Mục đích sử dụng.
- Ghi chú.

### 5.2. Admin phê duyệt

Admin có tab Approval riêng để:

- Xem request Pending.
- Kiểm tra tồn kho.
- Approve hoặc Reject.
- Ghi lý do.
- Cấp đúng số lượng.

Khi approve thành công:

```text
InWarehouse → Allocated → InTechnicianStock
```

Phải ghi lịch sử người duyệt, thời gian, số lượng và Technician nhận. Không cho approve vượt tồn kho hoặc tạo cấp phát trùng.

### 5.3. Technician Inventory

Technician xem:

- Gateway.
- Node Nano.
- Cảm biến và linh kiện.
- Số lượng còn lại.
- Trạng thái sử dụng.
- Lịch sử cấp phát.

Thao tác được phép:

- Tạo request bổ sung.
- Báo lỗi.
- Trả về kho.
- Xem lịch sử.

## 6. Bước 4 — Hardware Preparation

**Vai trò:** Technician.

Hardware Preparation chỉ được bắt đầu với item đang ở `InTechnicianStock`.

Luồng bắt buộc:

```text
HardwarePreparation
→ FirmwarePrepared
→ IdentityVerified
→ ConnectivityVerified
→ ReadyForDeployment
```

### 6.1. Firmware Release

Technician chỉ được chọn Firmware Release có trạng thái `Approved` từ Firmware Registry. Không ghi nhận version tự do.

Thông tin phải lưu:

- Firmware Release ID.
- Version.
- Hardware Target.
- Source Repository.
- Git Tag/Commit SHA.
- Artifact URL.
- SHA-256.
- Board Profile.
- Upload Method.
- Người thực hiện và thời gian.

### 6.2. Gateway ESP32

Lần đầu:

1. Kiểm tra phần cứng.
2. USB flash Bootstrap Firmware.
3. Đọc MAC Address và Chip ID.
4. Nhập Wi-Fi và Bootstrap Token qua kênh Bootstrap.
5. Gateway Enrollment với Backend.
6. Backend kiểm tra Gateway thuộc Technician và MAC khớp inventory.
7. Enrollment chuyển `Enrolled`.
8. Technician chọn Farm/Deployment Request và Activate runtime.
9. Backend tạo Gateway runtime, Gateway ID và MQTT identity.
10. Gateway nhận runtime configuration qua kênh an toàn.
11. Gateway gửi configuration ACK và heartbeat.
12. Chỉ khi heartbeat/MQTT evidence hợp lệ mới chuyển `ConnectivityVerified`.

Bootstrap Firmware không chứa production MQTT credentials, Tenant hoặc Farm cố định. Credential phải có cơ chế rotate/revoke.

OTA chỉ áp dụng cho các bản cập nhật sau khi Gateway đã Enrollment/Activated. Không ghi nhận Bootstrap lần đầu là OTA.

### 6.3. Node Arduino Nano

1. Kiểm tra bo mạch.
2. Chọn Firmware Release Approved.
3. Tải source/release hoặc artifact đã được phê duyệt.
4. Nạp qua USB bằng Arduino IDE/PlatformIO.
5. Ghi Node ID.
6. Ghi LoRa Address trong khoảng hợp lệ.
7. Backend kiểm tra Node ID không trùng.
8. Backend kiểm tra LoRa Address không trùng trong phạm vi quản lý.
9. Kiểm tra LoRa response.
10. Kiểm tra cảm biến.
11. Ghi connectivity evidence từ kiểm tra thực tế.
12. Chuyển `ConnectivityVerified`, sau đó `ReadyForDeployment`.

Nano không được tuyên bố hỗ trợ OTA khi phần cứng hiện tại chưa có bootloader/network capability phù hợp.

### 6.3.1. Khai báo cảm biến trên Node — không phải cấu hình firmware

Technician tự cấu hình code Node theo mạch và cảm biến thực tế, sau đó nạp firmware Node qua USB bằng Arduino IDE/PlatformIO. Backend không gửi pin, model hoặc cấu hình cảm biến xuống Node.

Sau khi nạp code, Technician chỉ khai báo trên Backend các cảm biến đang thực sự gắn trên Node:

```text
Kho Technician → chọn Node → Khai báo cảm biến đã lắp → lưu DeviceSensors
```

`DeviceSensors` là metadata để đối chiếu và hiển thị, gồm `SensorType/ParameterCode`, đơn vị, model, pin/interface tham chiếu và khoảng giá trị. Nó không phải lệnh provisioning firmware và không được dùng để tự sinh số đo.

Node phải tự trả `parameterCode` đúng với cảm biến đã nạp trong code. Gateway chỉ chuyển tiếp telemetry; Backend kiểm tra thông số Node gửi về có nằm trong danh sách đã khai báo hay không. Thông số chưa khai báo phải bị đánh dấu cảnh báo/không hợp lệ; cảm biến đã khai báo nhưng không có số đo phải hiển thị `Chưa có dữ liệu` hoặc `Stale`.

Không được dùng số đo mặc định, random drift, demo relay hoặc mock Node trên màn hình vận hành. Simulator chỉ được bật trong môi trường kiểm thử riêng và phải có nhãn rõ ràng.

### 6.4. Điều kiện ConnectivityVerified

Không chấp nhận chỉ một ghi chú thủ công. Evidence phải được gắn với đúng Hardware Preparation session.

- Gateway: Enrollment `Activated`, MQTT connection và heartbeat/ACK thực tế.
- Node: LoRa response, sensor response hoặc connection test thực tế.

Nếu kiểm tra thất bại, thiết bị chuyển `Faulty` hoặc `Maintenance`.

## 7. Gateway Enrollment và Activation

API chính:

```text
POST /api/v1/gateway-enrollment
POST /api/v1/gateway-enrollment/{enrollmentId}/activate
```

Enrollment phải kiểm tra:

- Hardware Item thuộc Technician.
- Item đang `InTechnicianStock`.
- MAC khớp inventory.
- Gateway chưa Enrollment.
- Bootstrap Token không lưu plaintext.

Activation phải kiểm tra:

- Enrollment đang `Enrolled`.
- Farm khớp Deployment Request.
- Gateway Serial/MAC chưa được đăng ký.
- Tạo Gateway runtime và MQTT identity.

## 8. Firmware Management

Quy trình:

```text
Git → Review → CI/CD Build → Release → Admin Approve → Technician Install
```

Firmware dùng chung theo Hardware Target. Không build firmware riêng chỉ vì mỗi Gateway có cấu hình khác nhau. Gateway-specific configuration phải là Config Package riêng.

Admin quản lý `Approve`, `Deny`, `Deprecated`, `Revoked`, `Recommended` và chính sách tương thích.

## 9. Gateway Configuration và Node Registry

Backend quản lý:

- Node ID.
- LoRa Address.
- Gateway Assignment.
- Farm/Zone.
- Sensor Assignment.
- Registry Version.
- Config Version.

Gateway chỉ nhận bản sao cấu hình. Mọi thay đổi phải có version, checksum, ACK và trạng thái đồng bộ. Không đánh dấu `Applied` chỉ vì người dùng bấm Save.

## 10. GIS Deployment

GIS chỉ nhận thiết bị khi:

- `Device.HardwareItemId` tồn tại.
- Hardware Preparation đạt `ReadyForDeployment`.
- Connectivity test thành công.
- Thiết bị thuộc đúng Technician/Deployment Request.
- Thiết bị chưa được đặt ở Zone khác.

GIS hiển thị Node module và gán Sensor cho Node. Gateway được quản lý ở ngoài Zone nhưng quan hệ Farm/Deployment phải rõ ràng.

Không provision Gateway hoặc chạy commissioning giả lập trực tiếp trong GIS.

## 11. Realtime Monitoring

Luồng đúng:

```text
Gateway/Node → MQTT → Backend Consumer → Validation/Deduplication → Realtime Service → GIS
```

GIS không kết nối trực tiếp MQTT Broker.

Backend cần quản lý Message ID, Sequence Number, ACK, Retry, Deduplication, Gap Detection và Store-and-Forward.

Nếu Gateway Offline, Node phía sau nên là `Unknown` hoặc `Unreachable via Gateway`, không kết luận ngay là Node hỏng.

## 12. Firmware Deployment sau khi vận hành

### Gateway

OTA cần có:

- Compatibility check.
- Deployment Job.
- HTTPS artifact download.
- Checksum/signature verification.
- A/B partition hoặc rollback.
- Reboot/verification.
- Kết quả trả về Backend.

### Node Nano

USB manual:

- Chọn release Approved.
- Tải artifact/source đã duyệt.
- Nạp bằng IDE/tool phù hợp.
- Kiểm tra version đang chạy.
- Ghi lịch sử Firmware Installation.

## 13. Handover, bảo trì và thay thế

Không hoàn tất bàn giao chỉ vì đã đặt Marker GIS.

Gateway phải có identity, firmware, MQTT, heartbeat, Config ACK và Node Registry sync. Node phải có identity, Gateway assignment, LoRa response, sensor data và firmware tương thích.

Khi hỏng:

1. Báo lỗi.
2. Chuyển `Maintenance` hoặc `Faulty`.
3. Gỡ khỏi Registry nếu cần.
4. Thu hồi credential Gateway cũ.
5. Cấp thiết bị thay thế.
6. Chạy lại Hardware Preparation/Enrollment.
7. Cập nhật GIS và lịch sử thay thế.

## 14. UI cần có

1. Device Catalog.
2. Device Inventory.
3. Allocation Approval.
4. Technician Inventory.
5. Hardware Preparation.
6. Gateway Enrollment/Activation.
7. Firmware Registry.
8. Gateway Configuration.
9. Node Registry.
10. GIS Deployment.
11. GIS Live Monitoring.
12. Device Details.
13. Anomaly/Annotation.
14. Maintenance/RMA.
15. Audit Log.

`Device Commissioning Popup` không còn là UI bắt buộc trong GIS; các kiểm tra trước triển khai thuộc Hardware Preparation. Nếu sau này cần popup, popup chỉ hiển thị kết quả backend evidence và không được tự sinh kết quả.

## 15. Thứ tự triển khai tiếp theo

### P0

- Hoàn thiện Bước 1–4 và migration.
- Firmware Registry Approved Release.
- Gateway Enrollment/Activation.
- MQTT credential thật, rotate/revoke.
- Hardware evidence thực tế.
- GIS readiness gate.

### P1

- Gateway Configuration version/ACK.
- Node Registry sync.
- MQTT Message/Telemetry contract.
- Sensor declaration/telemetry matching: Backend chỉ khai báo cảm biến, Node chịu trách nhiệm đọc và gắn đúng `parameterCode`.
- Sequence, ACK, Retry, Deduplication.
- Realtime GIS service.

### P2

- OTA Gateway và rollback.
- Handover.
- Anomaly/Annotation.
- Maintenance/RMA.
- Audit và báo cáo.

## 16. Các tiêu chí nghiệm thu

- Không thể Hardware Preparation nếu chưa cấp phát.
- Không thể FirmwarePrepared nếu firmware chưa Approved.
- Không thể IdentityVerified nếu Node ID/LoRa Address thiếu hoặc trùng.
- Không thể ConnectivityVerified nếu thiếu evidence thật.
- Không thể ReadyForDeployment nếu chưa qua connectivity.
- Không thể GIS Assignment nếu chưa ReadyForDeployment.
- Không thể đánh dấu Online bằng thao tác UI hoặc random simulation.
- Không hiển thị số đo cảm biến mặc định/random trên UI vận hành; chỉ hiển thị telemetry đã nhận từ Node/Gateway.
- Không tự suy ra loại cảm biến từ tên thiết bị khi đã có `DeviceSensors`; dùng khai báo Backend và `parameterCode` từ Node.
- Gateway lần đầu phải USB Bootstrap; OTA chỉ dùng sau Activation.
- Nano không được gắn nhãn OTA.
- Controller không thuộc flow triển khai mới.
- Mọi thay đổi quan trọng phải có audit history.

## 17. Checklist kiểm thử thực tế Bước 5–8

Các bước dưới đây là điều kiện để nâng đánh giá từ `code-level` lên nghiệm thu thiết bị thật. Arduino CLI/PlatformIO chỉ dùng trong CI hoặc máy kỹ thuật viên; không phải thành phần runtime của Backend.

### Bước 5 — Enrollment/Activation

- [ ] Gateway ESP32 được nạp Bootstrap từ Firmware Registry/GitHub Release bằng USB.
- [ ] Gửi MAC, Chip ID và Bootstrap Token; Backend xác minh thành công.
- [ ] Token không còn được dùng lại sau handshake.
- [ ] Admin/Technician chỉ Activate được enrollment đã handshake và đúng thiết bị được cấp phát.
- [ ] Gateway nhận được runtime identity sau Activation.

### Bước 6 — Configuration/Node Registry

- [ ] Technician chọn Node đã được cấp phát và lưu cấu hình Gateway trên UI.
- [ ] Backend tăng `ConfigVersion`, publish gói `CONFIG` qua MQTT.
- [ ] ESP32 nhận gói, từ chối version cũ, lưu NVS và áp dụng polling/heartbeat/retry.
- [ ] ESP32 gửi `CONFIG_ACK` đúng Gateway và version.
- [ ] Backend chuyển `PendingApply` sang `Applied` chỉ sau ACK hợp lệ.
- [ ] Node Registry trên Gateway khớp với danh sách Node trong Backend.

### Bước 7 — Connectivity/GIS

- [ ] Node phản hồi LoRa theo đúng Node ID/LoRa Address.
- [ ] Gateway gửi telemetry MQTT với Gateway ID, Node ID, Zone ID và timestamp hợp lệ.
- [ ] Backend ghi nhận heartbeat thật; không dùng nút mô phỏng để hoàn tất nghiệm thu.
- [ ] Ghi RSSI/SNR/latency hoặc evidence lỗi vào Device Connection Test.
- [ ] Chỉ sau khi Hardware Preparation là `ReadyForDeployment` và test thành công mới được gán GIS.

### Bước 8 — Firmware Registry/OTA

- [ ] Source được push lên firmware repository riêng và tạo Git tag.
- [ ] CI tạo `.bin` cho ESP32 và `.hex`/source package cho Nano, kèm SHA-256.
- [ ] Admin nhập Repository URL, Git tag, Commit SHA, Artifact URL và SHA-256 vào Firmware Registry.
- [ ] Chỉ release `Approved` mới xuất hiện trong Hardware Preparation và OTA.
- [ ] OTA Gateway tải artifact HTTPS từ GitHub Release, kiểm tra SHA-256, reboot và báo kết quả.
- [ ] Nano chỉ nạp USB bằng Arduino IDE/PlatformIO; không được hiển thị là OTA.

### Bổ sung sau — Ghi nhận kết quả OTA thực tế

`Activated` chỉ xác nhận Gateway đã được cấp quyền sử dụng và Backend đã tạo runtime. Không được dùng trạng thái này để kết luận OTA thành công.

Sau khi Gateway nhận và xử lý OTA, Gateway phải gửi một bản tin kết quả có xác thực về Backend, tối thiểu gồm:

- Gateway identity lấy từ MQTT transport, không tin identity tùy ý trong payload.
- Firmware version trước và sau cập nhật.
- OTA job/release ID hoặc version tương ứng.
- Kết quả: `Started`, `Succeeded` hoặc `Failed`.
- Mã lỗi và thông tin lỗi nếu thất bại.
- SHA-256 artifact đã kiểm tra.
- Thời điểm bắt đầu, hoàn tất và reboot.

Backend lưu kết quả vào lịch sử OTA, cập nhật trạng thái job và chỉ đánh dấu `OTA_SUCCESS` sau khi nhận được xác nhận hợp lệ từ Gateway. HTTP 200 khi tạo OTA job hoặc trạng thái `Activated` không phải là bằng chứng OTA thành công.

UI Gateway Enrollment/Gateway Management phải khôi phục trạng thái từ Backend sau reload và hiển thị tách biệt:

```text
Activated       = đã kích hoạt runtime
OTA_PENDING     = đang chờ Gateway nhận job
OTA_STARTED     = Gateway đã bắt đầu cập nhật
OTA_SUCCESS     = Gateway đã cập nhật và xác nhận thành công
OTA_FAILED      = Gateway cập nhật thất bại, kèm mã lỗi
MQTT_ONLINE     = Gateway đã kết nối MQTT sau OTA
```

Tiêu chí hoàn tất OTA end-to-end:

1. Release được Admin duyệt.
2. Backend tạo OTA job cho Gateway Activated.
3. Gateway nhận job và gửi `OTA_STARTED`.
4. Gateway tải artifact, kiểm tra SHA-256 và ghi firmware.
5. Gateway reboot, chạy firmware mới và gửi `OTA_SUCCESS`.
6. Gateway kết nối MQTT/heartbeat bằng runtime identity.
7. Backend cập nhật job, firmware version và thời điểm xác nhận.
8. UI hiển thị kết quả sau reload; không suy đoán thành công chỉ từ log hoặc nút Activate.

Nếu Gateway không gửi xác nhận trong thời gian timeout, Backend phải đánh dấu `OTA_FAILED` hoặc `OTA_TIMEOUT`, giữ nguyên lịch sử lỗi và cho phép Admin/Technician retry theo chính sách an toàn.

### Bằng chứng cần lưu

- Serial log của Bootstrap/Enrollment.
- MQTT log gồm `CONFIG`, `CONFIG_ACK`, telemetry và heartbeat.
- Ảnh hoặc export kết quả nạp firmware/OTA.
- Firmware version, Git commit, artifact URL và SHA-256.
- Device Connection Test và lịch sử chuyển trạng thái.

### Trạng thái triển khai hiện tại

- UI không còn nút xác nhận `CONFIG_ACK` giả; trạng thái `Applied` chỉ được cập nhật bởi MQTT topic `smartfarm/gateways/{gatewayId}/config-ack`.
- Firmware Registry tự đồng bộ release từ GitHub qua webhook có chữ ký; nếu webhook hoặc GitHub API không tới được backend local, worker và nút đồng bộ phiên bản dùng fallback đọc release public. Import là idempotent và release vẫn phải qua `Approved` trước khi cấp cho thiết bị.
- Quy tắc cảnh báo của Zone được đọc và ghi qua Alert Rules API của Backend; không khởi tạo ngưỡng demo trong màn hình vận hành.
- Màn hình lịch sử vi khí hậu truy vấn `/telemetry/history`; khi chưa có dữ liệu, hiển thị trạng thái trống thay vì đường cong mô phỏng.
- Dashboard không dùng giá trị mặc định cho thời tiết hoặc telemetry.
- Các simulator còn lại chỉ được phép trong test/development và không được dùng làm bằng chứng triển khai phần cứng thật.
- UI điều khiển không còn nhánh tạo actuator giả hoặc cập nhật trạng thái cục bộ; mọi lệnh phải đi qua API command và chỉ thành công khi có feedback Gateway.
- Frontend không còn fallback tên Zone/actuator hoặc trả kết quả thành công giả khi API lịch điều khiển/lệnh lỗi; thiếu `zoneId` không được tự thay bằng Zone mẫu.
- GIS không còn callback commissioning cũ; cấu hình sensor vẫn là khai báo Backend để diễn giải telemetry, còn firmware Node do Technician nạp/cấu hình thủ công.
- Đã xác minh: frontend production build thành công; toàn bộ backend test đạt 648/648 (Domain 2, Architecture 2, Infrastructure 293, API 351); nhóm `IoTDeploymentTests` đạt 7/7, gồm vòng đời OTA Scheduled → Started → Succeeded; Backend runtime config trả Gateway hợp lệ. Việc kiểm tra LoRa/sensor/relay vẫn cần Node và phần cứng thật.
- Gateway runtime config không còn tự sinh địa chỉ LoRa theo thứ tự danh sách; mỗi Node phải có `LoRaAddress` đã xác nhận trong Hardware Preparation, nếu thiếu Backend sẽ từ chối tạo cấu hình runtime.
- Cấu hình sensor trên GIS/Node gửi model, interface và unit đã khai báo từ kho/Deployment Contract vào `DeviceSensor`; không còn suy đoán unit bằng tên cảm biến. UI bắt buộc chọn sensor thật trước khi lưu.
- Đã biên dịch kiểm tra bằng Arduino CLI: Arduino Nano (`arduino:avr:nano:cpu=atmega328old`), ESP32 Gateway OTA và ESP32 Bootstrap (`esp32:esp32:esp32c3`) đều thành công.
- Firmware Node không được phát dữ liệu cảm biến giả khi DHT/pH/pin chưa có phần cứng hoặc lỗi đọc. Gói LoRa dùng sentinel rõ ràng (`-32768`, `0xFFFF`, `0xFF`); Gateway bỏ qua trường thiếu và chỉ publish các reading hợp lệ.
- Không có API hoặc nút vận hành nào được phép tự đánh dấu Gateway `Online`/`MQTT_CONNECTED` thay cho heartbeat thật; simulator IoT chỉ dành cho test/development và mặc định tắt.
- OTA job `InProgress` không bị treo vô hạn: worker nền kiểm tra mỗi phút và chuyển job không nhận được kết quả thiết bị trong 10 phút sang `Failed`, giải phóng Gateway cho lần thử lại an toàn.
- UI Gateway Enrollment có thể đọc lại OTA job mới nhất sau reload qua Backend và hiển thị riêng `Scheduled`, `InProgress`, `Succeeded` hoặc `Failed`; không còn dùng state trình duyệt để kết luận kết quả OTA.
- CF3 control header không còn hiển thị tĩnh `LoRa Gateway Online`; chỉ hiển thị Online khi dữ liệu API có heartbeat MQTT rõ ràng, nếu không sẽ hiển thị `Gateway chưa xác nhận online`.
- Loại bỏ các fallback IoT giả còn sót trong màn hình bảo trì: không tự tạo Zone/Node ID, không hiển thị pin ảo, không gán mặc định số Node GIS là `4`; khi thiếu dữ liệu thật UI báo chưa có dữ liệu hoặc yêu cầu người dùng chọn thiết bị hợp lệ.
- Rà soát tiếp các màn hình Zone/Support/Hot-Swap: đã bỏ các Zone/Farm/Node UUID mẫu dùng khi không có dữ liệu; thao tác chỉ tiếp tục khi có bản ghi thật từ API.
- Các service frontend IoT/Alert/Weather/Service Request không còn tự chèn Farm ID mẫu khi thiếu context; Zone Mapper chỉ nhận Node có `deviceId` thật và không tự sinh Serial/MAC/GIS Node.
- Bổ sung `scripts/iot-preflight.ps1`: kiểm tra Backend, MQTT, PostgreSQL, COM của ESP và bản ghi Gateway trước khi chạy test; script không reset/xóa dữ liệu.
- Preflight tách riêng `Gateway DB record` và `Gateway MQTT heartbeat`; có bản ghi trong DB không còn được coi là thiết bị Online.
- GIS Node Mapper không còn tự sinh MAC/Serial/Node ID từ mã sản phẩm hoặc số thứ tự; chỉ dùng identity lấy từ inventory/device API.
- Farmer/Owner GIS cũng chỉ dựng marker từ Device ID và tọa độ thật; không còn fallback Node ID, trạng thái Online, MAC hoặc tọa độ mẫu.
- Trang Gateway Technician hiển thị Online dựa trên heartbeat gần đây, tách khỏi trạng thái `Provisioned`; khi thiếu heartbeat sẽ báo rõ `Chưa nhận MQTT heartbeat thật`.
- Đã bổ sung heartbeat MQTT độc lập: ESP publish `smartfarm/gateways/{gatewayId}/heartbeat` theo `heartbeatIntervalSeconds`; Broker xác thực client/topic, cập nhật `last_seen_at_utc` và `GatewayStatus.Online`. Telemetry Node không còn là nguồn heartbeat duy nhất.
- Soil moisture hiện là giá trị ADC thật từ chân A0; pH và battery chỉ xuất hiện khi Node có triển khai phần cứng tương ứng. Không dùng giá trị mặc định để làm bằng chứng telemetry.
