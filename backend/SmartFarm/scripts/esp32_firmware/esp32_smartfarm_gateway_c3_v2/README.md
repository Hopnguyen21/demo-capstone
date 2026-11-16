# SmartFarm ESP32-C3 Gateway v2

This is a new runtime-configured firmware. The original `esp32_smartfarm_gateway_c3` firmware is intentionally unchanged.

## First boot

1. Flash `esp32_smartfarm_gateway_c3_v2.ino` at 115200 baud.
2. Set local Wi-Fi credentials: `WIFI|SSID|PASSWORD`.
3. Create the Gateway Enrollment in SmartFarm and copy the enrollment ID and Bootstrap Token.
4. Send `ENROLL|BACKEND_URL|ENROLLMENT_ID|BOOTSTRAP_TOKEN` through Serial Monitor.
5. Restart the board. The Gateway sends MAC, Chip ID and token to the Backend.
6. Verify `ENROLLMENT_HANDSHAKE_OK`; only then may Technician activate the enrollment.
7. After activation, configure the Gateway from the Technician UI. Backend publishes a versioned `CONFIG` message to the Gateway command topic.
8. The Gateway validates and persists the JSON, publishes `CONFIG_ACK` to `smartfarm/gateways/{gatewayId}/config-ack`, and the UI changes from `PendingApply` to `Applied`.
9. For local recovery only, the same JSON can still be entered as `CONFIG=<json>` through Serial Monitor.
10. Verify `CONFIG_APPLIED`, `WIFI_CONNECTED`, and `MQTT_CONNECTED`.

The token is removed from NVS after a successful handshake. Use HTTPS for `BACKEND_URL` in production; the current HTTP client path is intended for local integration testing.

The Gateway topic is built from the provisioned UUID:

`smartfarm/gateways/{gatewayId}/telemetry`

Configuration changes are monotonic by `configVersion`; an older or duplicate version is ignored. The Gateway sends no ACK until the new configuration has been validated and written to NVS.
