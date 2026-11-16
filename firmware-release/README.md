# SmartFarm Firmware Release

Bộ firmware chính thức dùng cho Hardware Preparation. Không dùng các file trong `firmware-temp` cho production.

## Firmware targets

| Target | Source | Initial installation | OTA |
|---|---|---|---|
| `ESP32_GATEWAY` | `backend/SmartFarm/scripts/esp32_firmware/esp32_smartfarm_gateway_c3_v2/esp32_smartfarm_gateway_c3_v2.ino` | USB Bootstrap/runtime | Có, sau Enrollment/Activation |
| `ARDUINO_NANO_NODE` | `backend/SmartFarm/scripts/esp32_firmware/arduino_combo_node_custom/arduino_combo_node_custom.ino` | USB qua Arduino IDE/PlatformIO | Không |

## Quy trình release

1. Push source lên repository firmware.
2. Tạo Git tag, ví dụ `v1.0.0`.
3. GitHub Actions build các file `.bin`/`.hex`.
4. Tạo GitHub Release từ tag và đính kèm artifact.
5. Tính SHA-256 của artifact.
6. Tạo Firmware Release trong SmartFarm Firmware Registry.
7. Admin chuyển trạng thái sang `Approved`.
8. Technician refresh Hardware Preparation và chọn release.

`Artifact URL` phải trỏ tới file binary trong GitHub Release, không trỏ tới source `.ino`.

## Tự động đồng bộ Firmware Registry

Backend hỗ trợ webhook:

`POST /api/v1/integrations/github/firmware/webhook`

Cấu hình `FirmwareGitHub:WebhookSecret` bằng Secret Manager hoặc biến môi trường `FirmwareGitHub__WebhookSecret`, sau đó tạo GitHub Webhook cho sự kiện `Release` với content type `application/json`. Backend kiểm tra `X-Hub-Signature-256` và tự import các asset có tên chứa `gateway`/`esp32` hoặc `node`/`nano`.

Local PowerShell:

```powershell
$env:FirmwareGitHub__WebhookSecret = "replace-with-a-long-random-secret"
dotnet run --project backend/SmartFarm/SmartFarm.Api/SmartFarm.Api.csproj
```

Release tự động import luôn ở trạng thái `PendingReview`. Admin vẫn phải kiểm tra artifact SHA-256 và bấm `Approved`; Backend không tự đưa release mới lên thiết bị.

## Lưu ý bảo mật

Không commit Wi-Fi password, MQTT production secret, Bootstrap Token hoặc Tenant/Farm identity vào source.
