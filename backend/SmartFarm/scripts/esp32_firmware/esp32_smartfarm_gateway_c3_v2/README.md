# SmartFarm ESP32-C3 Gateway v2

This is a new runtime-configured firmware. The original `esp32_smartfarm_gateway_c3` firmware is intentionally unchanged.

## First boot

1. Flash `esp32_smartfarm_gateway_c3_v2.ino` at 115200 baud.
2. Set the local Wi-Fi credentials in NVS using the configuration tool (the backend export must never contain the Wi-Fi password).
3. In SmartFarm, provision the Gateway and assign its Nodes.
4. Download the Gateway firmware JSON from the UI.
5. Paste the JSON as one line into Serial Monitor and press Enter.
6. Restart the board and verify `CONFIG VALID`, `WIFI_CONNECTED`, and `MQTT_CONNECTED`.

The Gateway topic is built from the provisioned UUID:

`smartfarm/gateways/{gatewayId}/telemetry`

This first version establishes the runtime identity/configuration path. The next implementation step is to add the C3 E32 polling/command frames using the runtime `nodes` array and replace the placeholder temperature reading with actual Node telemetry.
