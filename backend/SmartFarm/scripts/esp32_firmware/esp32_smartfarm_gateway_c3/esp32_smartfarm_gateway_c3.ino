/*
 * ======================================================================================
 * SMARTFARM IOT TUTORIAL & FIRMWARE - ESP32-C3 CENTRAL LORA GATEWAY
 * ======================================================================================
 * Target Board: ESP32-C3 DevKitM-1 / ESP32-C3 SuperMini (RISC-V Single-Core)
 * Radio Module: EBYTE E32-Series LoRa (e.g., E32-433T20D / E32-433T30D / E32-915T20D)
 *
 * SECTION 1: SƠ ĐỒ ĐẤU NỐI DÂY CHI TIẾT (ESP32-C3 <--> LORA E32)
 * --------------------------------------------------------------------------------------
 * Chân trên ESP32-C3        Chân LoRa E32      Chức năng / Lưu ý kỹ thuật
 * --------------------------------------------------------------------------------------
 * 3V3                       VCC                Nguồn nuôi 3.3V DC (Tuyệt đối KHÔNG cắm 5V)
 * GND                       GND                Mass chung (Ground)
 * GPIO 6 (RX)       <---    TXD                Nhận dữ liệu từ LoRa E32 sang ESP32-C3
 * GPIO 7 (TX)       --->    RXD                ESP32-C3 truyền dữ liệu sang E32 (Logic 3.3V)
 * GPIO 3            --->    M0                 Điều khiển chế độ M0 (Mức LOW = Normal Mode)
 * GPIO 4            --->    M1                 Điều khiển chế độ M1 (Mức LOW = Normal Mode)
 * [BỎ TRỐNG]                AUX                Không nối dây (Tối ưu gọn mạch như phía Node)
 * GPIO 8                    Onboard LED        LED trạng thái (ESP32-C3 SuperMini/DevKit dùng chân 8)
 *
 * [!] VÌ SAO DÙNG CẶP CHÂN GPIO 6 & GPIO 7?
 * - Trên các bo mạch ESP32-C3 (đặc biệt là ESP32-C3 SuperMini), chân 20 và 21 thường 
 *   bị nối ngầm vào mạch cổng USB (USB D- và USB D+) nên không có hàng rào cắm ra ngoài.
 * - Chân 6 và 7 được in to rõ ràng ngay mép ngoài của bo mạch và hoạt động như UART1 cực kỳ ổn định.
 * ======================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ======================================================================================
// SECTION 2: [USER CONFIGURABLE SECTION] - THÔNG SỐ CẤU HÌNH HỆ THỐNG
// ======================================================================================

// --- 2.1 Thông tin Wi-Fi ---
const char* WIFI_SSID     = "HOME";          // Tên Wi-Fi nhà bạn
const char* WIFI_PASSWORD = "12345678@";     // Mật khẩu Wi-Fi

// --- 2.2 Máy chủ MQTT Broker (SmartFarm Backend) ---
const char* MQTT_BROKER_IP = "192.168.1.160"; // IP máy tính chạy SmartFarm.Api
const int   MQTT_BROKER_PORT = 1883;
const bool ENABLE_MQTT = false; // Tạm ngắt để kiểm tra riêng LoRa

// --- 2.3 Định danh Gateway ---
const char* GATEWAY_SERIAL = "GW-DEMO-001";

// --- 2.4 Cấu hình LoRa Radio E32 ---
const uint8_t LORA_NETWORK_ID = 0x11;   // Domain ID (0x11 = Farm A)
const uint8_t LORA_CHANNEL    = 0x1A;   // 0x1A = 436.0 MHz (Khớp với Combo Node)

// --- 2.5 Phân bổ chân phần cứng ESP32-C3 ---
// Cặp chân in sẵn rõ ràng trên mọi bo mạch ESP32-C3 / SuperMini:
const int PIN_E32_RX     = 6;   // Chân số 6 trên ESP32-C3: Nối vào TXD của E32
const int PIN_E32_TX     = 7;   // Chân số 7 trên ESP32-C3: Nối vào RXD của E32
const int PIN_E32_M0     = 4;   // Chân số 3 trên ESP32-C3: Nối vào M0 của E32
const int PIN_E32_M1     = 5;   // Chân số 4 trên ESP32-C3: Nối vào M1 của E32
const int PIN_STATUS_LED = 8;   // Onboard LED của ESP32-C3

// --- 2.6 Bảng định tuyến Node (Chỉ cấu hình duy nhất 1 Node) ---
struct NodeRoute {
  uint8_t     loraAddress;          // Địa chỉ vật lý LoRa
  const char* hardwareAddress;      // Mã định danh thiết bị trên Backend
  bool        isActuator;           // Có rơ-le điều khiển
};

const NodeRoute NODE_TABLE[] = {
  { 0x01, "NODE-ZONE1-01", true }, // Chỉ chạy duy nhất Node 1
  { 0x02, "NODE-ZONE1-02", true } // Chỉ chạy duy nhất Node 1
};
const uint8_t NODE_COUNT = sizeof(NODE_TABLE) / sizeof(NODE_TABLE[0]);

// --- 2.7 Chu kỳ đọc cảm biến & Timeout ---
const unsigned long SENSOR_POLL_INTERVAL_MS = 8000;  // 8 giây hỏi dữ liệu Node 1 lần
const unsigned long NODE_REPLY_TIMEOUT_MS   = 2000;  // Chờ phản hồi tối đa 2000ms an toàn

// ======================================================================================
// SECTION 3: [HỆ THỐNG XỬ LÝ TRUYỀN THÔNG & FREERTOS QUEUE]
// ======================================================================================

struct ActuatorCommandTask {
  char     nodeHardwareAddress[32];
  uint8_t  relayChannel;
  uint8_t  action;           // 1: TurnOn, 0: TurnOff
  uint16_t durationSeconds;
  char     commandId[64];
};

QueueHandle_t g_actuatorCmdQueue = NULL;

// ESP32-C3 sử dụng HardwareSerial 1 ánh xạ sang chân 6 và 7
HardwareSerial E32Serial(1);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

String g_macAddress = "";
String TOPIC_TELEMETRY;
String TOPIC_COMMANDS;
String TOPIC_FEEDBACK;

unsigned long g_lastPollTime = 0;
uint8_t g_currentPollingIndex = 0;

// --- 3.1 Tính toán CRC16 CCITT (Polynomial 0x1021) ---
uint16_t calculateCRC16(const uint8_t* data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= ((uint16_t)data[i] << 8);
    for (uint8_t bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return crc;
}

// --- 3.2 Đợi E32 rảnh (Không dùng chân AUX, dùng delay an toàn 25ms) ---
void waitE32Ready() {
  delay(25);
}

// --- 3.3 Thiết lập các chế độ hoạt động cho LoRa E32 ---
void setE32ModeNormal() {
  digitalWrite(PIN_E32_M0, LOW);
  digitalWrite(PIN_E32_M1, LOW);
  delay(50);
}

void setE32ModeSleep() {
  digitalWrite(PIN_E32_M0, HIGH);
  digitalWrite(PIN_E32_M1, HIGH);
  delay(50);
}

// --- 3.4 Tự động kiểm tra phần cứng module LoRa E32 (Self-Test Diagnostic) ---
bool checkE32HardwareStatus() {
  Serial.println(F("\n--- [KIỂM TRA PHẦN CỨNG LORA E32] ---"));
  
  // Đưa E32 vào chế độ Sleep/Configuration Mode (M0=1, M1=1) để đọc thông số cấu hình
  setE32ModeSleep();
  
  // Xóa sạch bộ đệm rác cũ
  while (E32Serial.available()) E32Serial.read();

  // Gửi lệnh truy vấn tham số [0xC1 0xC1 0xC1] theo chuẩn nhà sản xuất EBYTE
  uint8_t cmdReadParams[3] = { 0xC1, 0xC1, 0xC1 };
  E32Serial.write(cmdReadParams, 3);
  E32Serial.flush();

  // Chờ phản hồi trong 500ms
  unsigned long start = millis();
  uint8_t resp[6];
  uint8_t bytesRead = 0;

  while (millis() - start < 500 && bytesRead < 6) {
    if (E32Serial.available()) {
      resp[bytesRead++] = E32Serial.read();
    }
    delay(2);
  }

  // Đưa E32 quay trở lại chế độ truyền nhận bình thường (Normal Mode)
  setE32ModeNormal();

  if (bytesRead >= 4 && (resp[0] == 0xC0 || resp[0] == 0xC2)) {
    Serial.println(F("[OK] MODULE LORA E32 HOẠT ĐỘNG HOÀN HẢO!"));
    Serial.print(F(" -> Phản hồi từ E32: "));
    for (uint8_t i = 0; i < bytesRead; i++) {
      Serial.print(F("0x"));
      if (resp[i] < 0x10) Serial.print(F("0"));
      Serial.print(resp[i], HEX);
      Serial.print(F(" "));
    }
    Serial.println();
    Serial.print(F(" -> Kênh tần số hiện tại của E32: 0x"));
    Serial.println(resp[4], HEX);
    Serial.println(F("---------------------------------------\n"));
    return true;
  } else {
    Serial.println(F("[CẢNH BÁO] KHÔNG THẤY MODULE LORA E32 PHẢN HỒI!"));
    Serial.println(F(" -> Vui lòng kiểm tra lại:"));
    Serial.println(F("    1. Nguồn 3.3V và mass GND cắm vào E32 có chắc chắn không?"));
    Serial.println(F("    2. Đã cắm đúng chân chưa: ESP32 chân 6 <-> E32 TXD, chân 7 <-> E32 RXD?"));
    Serial.println(F("    3. Chân M0 (nối chân 3), M1 (nối chân 4) có cắm đúng không?"));
    Serial.println(F("---------------------------------------\n"));
    return false;
  }
}

// --- 3.5 Nhận lệnh điều khiển Relay từ Backend (MQTT Downlink) ---
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length) {
  String messageStr = "";
  for (unsigned int i = 0; i < length; i++) {
    messageStr += (char)payload[i];
  }

  Serial.print(F("[MQTT Downlink] Topic: "));
  Serial.println(topic);
  Serial.print(F("[MQTT Downlink] Payload: "));
  Serial.println(messageStr);

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, messageStr);
  if (err) {
    Serial.print(F("[ERR] JSON Parse thất bại: "));
    Serial.println(err.c_str());
    return;
  }

  ActuatorCommandTask task;
  const char* cmdId     = doc["commandId"] | "cmd-unknown";
  const char* nodeHw    = doc["nodeHardwareAddress"] | "";
  const char* actionStr = doc["action"] | "TurnOff";
  int channel           = doc["relayChannel"] | 1;
  int duration          = doc["durationSeconds"] | 10;

  strncpy(task.commandId, cmdId, sizeof(task.commandId) - 1);
  strncpy(task.nodeHardwareAddress, nodeHw, sizeof(task.nodeHardwareAddress) - 1);
  task.relayChannel = (uint8_t)channel;
  task.durationSeconds = (uint16_t)duration;
  task.action = (String(actionStr).equalsIgnoreCase("TurnOn")) ? 1 : 0;

  // Đưa vào hàng đợi ưu tiên cao
  if (g_actuatorCmdQueue != NULL) {
    xQueueSend(g_actuatorCmdQueue, &task, portMAX_DELAY);
    Serial.println(F("[QUEUE] Đã xếp hàng lệnh điều khiển để ưu tiên gửi ngay qua LoRa."));
  }
}

// --- 3.6 Báo cáo trạng thái điều khiển lên MQTT Feedback Topic ---
void publishActuatorFeedback(const char* cmdId, const char* nodeHw, uint8_t channel, const char* status, const char* state) {
  StaticJsonDocument<512> doc;
  doc["commandId"]           = cmdId;
  doc["nodeHardwareAddress"] = nodeHw;
  doc["relayChannel"]        = channel;
  doc["status"]              = status;
  doc["observedState"]       = state;

  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_FEEDBACK.c_str(), buffer);
  Serial.print(F("[MQTT Feedback]: "));
  Serial.println(buffer);
}

// --- 3.7 Truyền gói tin Fixed-Point Addressing qua E32 ---
void sendE32FixedFrame(uint8_t targetNetId, uint8_t targetNodeAddr, uint8_t targetChannel, const uint8_t* payload, size_t len) {
  waitE32Ready();

  // 3 byte định tuyến: [ADDH] [ADDL] [CHAN]
  E32Serial.write(targetNetId);
  E32Serial.write(targetNodeAddr);
  E32Serial.write(targetChannel);

  E32Serial.write(payload, len);
  E32Serial.flush();
}

// --- 3.8 Gửi lệnh điều khiển Actuator tới Node qua LoRa ---
void executeActuatorDownlink(const ActuatorCommandTask& cmd) {
  Serial.print(F("[LORA ACTUATE] Gửi lệnh đến Node: "));
  Serial.println(cmd.nodeHardwareAddress);

  // Tìm địa chỉ LoRa vật lý
  uint8_t targetAddr = 0;
  for (uint8_t i = 0; i < NODE_COUNT; i++) {
    if (strcmp(NODE_TABLE[i].hardwareAddress, cmd.nodeHardwareAddress) == 0) {
      targetAddr = NODE_TABLE[i].loraAddress;
      break;
    }
  }

  if (targetAddr == 0) {
    Serial.println(F("[ERR] Không tìm thấy địa chỉ phần cứng của Node trong bảng Route!"));
    publishActuatorFeedback(cmd.commandId, cmd.nodeHardwareAddress, cmd.relayChannel, "Failed", "UnknownNode");
    return;
  }

  // Khung lệnh điều khiển (8 byte gồm CRC):
  // [0xAA] [0x20] [Channel] [Action] [Dur_H] [Dur_L] [CRC_H] [CRC_L]
  uint8_t frame[8];
  frame[0] = 0xAA;
  frame[1] = 0x20;
  frame[2] = cmd.relayChannel;
  frame[3] = cmd.action;
  frame[4] = (uint8_t)(cmd.durationSeconds >> 8);
  frame[5] = (uint8_t)(cmd.durationSeconds & 0xFF);

  uint16_t crc = calculateCRC16(frame, 6);
  frame[6] = (uint8_t)(crc >> 8);
  frame[7] = (uint8_t)(crc & 0xFF);

  sendE32FixedFrame(LORA_NETWORK_ID, targetAddr, LORA_CHANNEL, frame, sizeof(frame));

  // Chờ phản hồi Ack từ Node
  unsigned long start = millis();
  bool ackReceived = false;
  uint8_t rxBuf[32];
  uint8_t rxLen = 0;

  while (millis() - start < NODE_REPLY_TIMEOUT_MS) {
    while (E32Serial.available()) {
      rxBuf[rxLen++] = E32Serial.read();
      if (rxLen >= sizeof(rxBuf)) break;
    }

    if (rxLen >= 7) {
      for (uint8_t i = 0; i <= rxLen - 7; i++) {
        if (rxBuf[i] == 0xAA && rxBuf[i+1] == 0x21) {
          uint16_t expectedCrc = calculateCRC16(&rxBuf[i], 5);
          uint16_t packetCrc = ((uint16_t)rxBuf[i+5] << 8) | rxBuf[i+6];
          if (expectedCrc == packetCrc) {
            ackReceived = true;
            uint8_t observedState = rxBuf[i+3];
            const char* stateStr = (observedState == 1) ? "TurnOn" : "TurnOff";
            publishActuatorFeedback(cmd.commandId, cmd.nodeHardwareAddress, cmd.relayChannel, "Acknowledged", stateStr);
            break;
          }
        }
      }
      if (ackReceived) break;
    }
    delay(5);
  }

  if (!ackReceived) {
    Serial.println(F("[WARN] Hết thời gian chờ Node xác nhận phản hồi lệnh Actuator."));
    publishActuatorFeedback(cmd.commandId, cmd.nodeHardwareAddress, cmd.relayChannel, "TimedOut", "NoResponse");
  }
}

// --- 3.9 Định kỳ gửi yêu cầu đọc dữ liệu cảm biến (Poll Telemetry) ---
void pollSensorNode(const NodeRoute& node) {
  Serial.print(F("[POLL] Đang gửi yêu cầu đo tới Node 0x0"));
  Serial.print(node.loraAddress, HEX);
  Serial.print(F(" ("));
  Serial.print(node.hardwareAddress);
  Serial.println(F(")..."));

  // Frame yêu cầu đọc: [0xAA] [0x10] [CRC_H] [CRC_L] (4 bytes)
  uint8_t pollFrame[4];
  pollFrame[0] = 0xAA;
  pollFrame[1] = 0x10;
  uint16_t crc = calculateCRC16(pollFrame, 2);
  pollFrame[2] = (uint8_t)(crc >> 8);
  pollFrame[3] = (uint8_t)(crc & 0xFF);

  // Xóa rác đệm serial cũ
  while (E32Serial.available()) E32Serial.read();

  sendE32FixedFrame(LORA_NETWORK_ID, node.loraAddress, LORA_CHANNEL, pollFrame, sizeof(pollFrame));

  unsigned long start = millis();
  uint8_t rxBuf[64];
  uint8_t rxLen = 0;
  bool validTelemetry = false;

  while (millis() - start < NODE_REPLY_TIMEOUT_MS) {
    while (E32Serial.available()) {
      rxBuf[rxLen++] = E32Serial.read();
      if (rxLen >= sizeof(rxBuf)) break;
    }

    if (rxLen > 0) {
      Serial.print(F("[DEBUG RX BYTES] "));
      Serial.print(rxLen);
      Serial.println(F(" bytes nhan duoc"));
    }

    // Khung nhận Telemetry từ Node (13 bytes):
    // [0xAA] [0x11] [Battery] [Soil_H] [Soil_L] [Temp_H] [Temp_L] [Hum_H] [Hum_L] [pH_H] [pH_L] [CRC_H] [CRC_L]
    if (rxLen >= 13) {
      for (uint8_t i = 0; i <= rxLen - 13; i++) {
        if (rxBuf[i] == 0xAA && rxBuf[i+1] == 0x11) {
          uint16_t expectedCrc = calculateCRC16(&rxBuf[i], 11);
          uint16_t packetCrc = ((uint16_t)rxBuf[i+11] << 8) | rxBuf[i+12];

          if (expectedCrc == packetCrc) {
            validTelemetry = true;

            uint8_t  batteryRaw = rxBuf[i+2];
            uint16_t soilRaw    = ((uint16_t)rxBuf[i+3] << 8) | rxBuf[i+4];
            int16_t  tempRaw    = ((int16_t)rxBuf[i+5] << 8)  | rxBuf[i+6];
            uint16_t humRaw     = ((uint16_t)rxBuf[i+7] << 8) | rxBuf[i+8];
            uint16_t phRaw      = ((uint16_t)rxBuf[i+9] << 8) | rxBuf[i+10];

            float soilMoisture = soilRaw / 10.0f;
            float temperature  = tempRaw / 10.0f;
            float airHumidity  = humRaw / 10.0f;
            float phValue      = phRaw / 100.0f;

            Serial.printf("[LORA RX] %s -> Đất: %.1f%% | Nhiệt: %.1fC | Không khí: %.1f%% | pH: %.2f | Pin: %d%%\n",
                          node.hardwareAddress, soilMoisture, temperature, airHumidity, phValue, batteryRaw);

            // Đóng gói JSON gửi lên MQTT Telemetry Topic
            StaticJsonDocument<768> doc;
            doc["gatewaySerial"]       = GATEWAY_SERIAL;
            doc["macAddress"]          = g_macAddress;
            doc["nodeHardwareAddress"] = node.hardwareAddress;

            JsonArray readings = doc.createNestedArray("readings");

            JsonObject r1 = readings.createNestedObject();
            r1["parameterCode"] = "SoilMoisture";
            r1["value"] = serialized(String(soilMoisture, 1));
            r1["unit"]  = "%";

            JsonObject r2 = readings.createNestedObject();
            r2["parameterCode"] = "Temperature";
            r2["value"] = serialized(String(temperature, 1));
            r2["unit"]  = "°C";

            JsonObject r3 = readings.createNestedObject();
            r3["parameterCode"] = "AirHumidity";
            r3["value"] = serialized(String(airHumidity, 1));
            r3["unit"]  = "%";

            JsonObject r4 = readings.createNestedObject();
            r4["parameterCode"] = "Ph";
            r4["value"] = serialized(String(phValue, 2));
            r4["unit"]  = "pH";

            char buffer[768];
            serializeJson(doc, buffer);
            // Publish len ca 2 topic: topic dinh danh gateway va topic chung de UI bat duoc
            mqttClient.publish(TOPIC_TELEMETRY.c_str(), buffer);
            mqttClient.publish("smartfarm/telemetry", buffer);
            Serial.print(F("[MQTT Published]: "));
            Serial.println(buffer);
            break;
          }
        }
      }
      if (validTelemetry) break;
    }
    delay(5);
  }

  if (!validTelemetry) {
    Serial.printf("[WARN] Node %s không phản hồi trong %d ms.\n", node.hardwareAddress, NODE_REPLY_TIMEOUT_MS);
  }
}

// --- 3.10 Quản lý kết nối Wi-Fi & MQTT ---
void connectWiFi() {
  Serial.print(F("Đang kết nối Wi-Fi: "));
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(F("."));
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
  digitalWrite(PIN_STATUS_LED, LOW);

  g_macAddress = WiFi.macAddress();
  Serial.println(F("\n[OK] Đã kết nối Wi-Fi!"));
  Serial.print(F("[INFO] Hardware MAC: "));
  Serial.println(g_macAddress);
  Serial.print(F("[INFO] IP Gateway: "));
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print(F("Đang kết nối MQTT Broker tại "));
    Serial.print(MQTT_BROKER_IP);
    Serial.print(F(":"));
    Serial.println(MQTT_BROKER_PORT);

    String clientId = "smartfarm-gateway-" + g_macAddress;

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(F("[OK] Đã kết nối MQTT Broker thành công!"));
      // Subscribe topic commands cua Gateway
      mqttClient.subscribe(TOPIC_COMMANDS.c_str());
      mqttClient.subscribe("smartfarm/gateways/+/commands");
      mqttClient.subscribe("smartfarm/commands");
      
      String emergTopic = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/emergency-stop";
      mqttClient.subscribe(emergTopic.c_str());
      Serial.print(F("[MQTT Subscribed]: "));
      Serial.println(TOPIC_COMMANDS);
    } else {
      Serial.print(F("[ERR] Lỗi kết nối MQTT, rc="));
      Serial.print(mqttClient.state());
      Serial.println(F(". Đang thử lại sau 3 giây..."));
      delay(3000);
    }
  }
}

// --- Setup ---
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n======================================================="));
  Serial.println(F("  SMARTFARM IOT - ESP32-C3 LORA CENTRAL GATEWAY"));
  Serial.println(F("======================================================="));

  // Cấu hình Topic TRƯỚC khi gọi connectMQTT()
  TOPIC_TELEMETRY = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/telemetry";
  TOPIC_COMMANDS  = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/commands";
  TOPIC_FEEDBACK  = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/feedback";

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_E32_M0, OUTPUT);
  pinMode(PIN_E32_M1, OUTPUT);

  // Khởi tạo UART1 trên ESP32-C3 cho LoRa E32: RX=Chân 6, TX=Chân 7 (9600 8N1)
  E32Serial.begin(9600, SERIAL_8N1, PIN_E32_RX, PIN_E32_TX);

  // TỰ ĐỘNG CHẨN ĐOÁN PHẦN CỨNG LORA E32 TẠI ĐÂY
  checkE32HardwareStatus();

  // Khởi tạo FreeRTOS Queue xử lý lệnh khẩn cấp
  g_actuatorCmdQueue = xQueueCreate(10, sizeof(ActuatorCommandTask));

  if (ENABLE_MQTT) {
    mqttClient.setServer(MQTT_BROKER_IP, MQTT_BROKER_PORT);
    mqttClient.setCallback(onMqttMessageReceived);
    mqttClient.setBufferSize(1024);
  }

  // Kết nối Wi-Fi & MQTT
  connectWiFi();
  if (ENABLE_MQTT) connectMQTT();
  else Serial.println(F("[INFO] MQTT tam thoi bi ngat de test LoRa."));
}

// --- Loop ---
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (ENABLE_MQTT) {
    if (!mqttClient.connected()) connectMQTT();
    mqttClient.loop();
  }

  // 1. ƯU TIÊN CAO: Nếu nhận lệnh bật/tắt rơ-le từ Dashboard, xử lý gửi ngay lập tức
  ActuatorCommandTask pendingCmd;
  if (xQueueReceive(g_actuatorCmdQueue, &pendingCmd, 0) == pdTRUE) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    executeActuatorDownlink(pendingCmd);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  // 2. LUÂN PHIÊN ĐỌC CẢM BIẾN TỪ CÁC NODE:
  unsigned long now = millis();
  if (now - g_lastPollTime >= SENSOR_POLL_INTERVAL_MS) {
    g_lastPollTime = now;

    digitalWrite(PIN_STATUS_LED, HIGH);
    pollSensorNode(NODE_TABLE[g_currentPollingIndex]);
    digitalWrite(PIN_STATUS_LED, LOW);

    // Chuyển sang node kế tiếp
    g_currentPollingIndex = (g_currentPollingIndex + 1) % NODE_COUNT;
  }

  delay(10);
}
