/*
 * ======================================================================================
 * SMARTFARM IOT TUTORIAL & FIRMWARE - BOARD 1: ESP32 CENTRAL LORA GATEWAY
 * ======================================================================================
 * Target Board: ESP32 Dev Module / ESP32-C3 / ESP32-WROOM-32
 * Radio Module: EBYTE E32-Series LoRa (e.g., E32-433T20D / E32-433T30D / E32-915T20D)
 *
 * SECTION 1: HARDWARE WIRING TUTORIAL & PIN CONNECTIONS
 * --------------------------------------------------------------------------------------
 * The EBYTE E32 module uses high-speed UART (Serial) communication and has 7 pins:
 *
 * ESP32 Pin              E32 LoRa Pin     Description & Purpose
 * --------------------------------------------------------------------------------------
 * 3V3                    VCC              Module Power (3.3V DC, Peak current ~120-600mA)
 * GND                    GND              Common Ground
 * GPIO 16 (RX2) <------- TXD              E32 Serial Transmit -> ESP32 Serial2 Receive
 * GPIO 17 (TX2) -------> RXD              ESP32 Serial2 Transmit -> E32 Serial Receive
 * GPIO 4        -------> M0               Operating Mode Control Pin 0 (Set to LOW for Normal)
 * GPIO 5        -------> M1               Operating Mode Control Pin 1 (Set to LOW for Normal)
 * GPIO 18       <------- AUX              Busy / Ready status indicator (HIGH = Ready, LOW = Busy)
 *
 * [!] POWER SUPPLY NOTE:
 * E32-T30D (1 Watt) requires high peak currents during transmit (~600mA).
 * If your ESP32 brown-outs or reboots, connect a 100uF-470uF electrolytic capacitor
 * across the VCC and GND pins of the E32 module.
 * ======================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ======================================================================================
// SECTION 2: [USER CONFIGURABLE SECTION] - MODIFY THESE FOR YOUR USE CASE
// ======================================================================================
// Notice: Any variables in this section can be freely edited to match your local Wi-Fi,
// broker IP, hardware serials, and node addresses.

// --- 2.1 Wi-Fi Network Credentials ---
const char* WIFI_SSID     = "HOME";          // Your local Wi-Fi SSID
const char* WIFI_PASSWORD = "12345678@";     // Your Wi-Fi Password

// --- 2.2 SmartFarm Backend Embedded MQTT Broker ---
// Set this to the local LAN IP address of your PC running SmartFarm.Api
const char* MQTT_BROKER_IP = "192.168.1.160";
const int   MQTT_BROKER_PORT = 1883;

// --- 2.3 Gateway Identification ---
// Human-readable factory serial matching your SmartFarm database configuration.
// (Notice: The physical MAC address is automatically read by the hardware at boot!).
const char* GATEWAY_SERIAL = "GW-DEMO-001";

// --- 2.4 E32 LoRa Radio & Network Configuration ---
// Must match across all nodes in the same farm network to avoid cross-talk.
const uint8_t LORA_NETWORK_ID = 0x11;   // Farm Network Domain ID (0x11 = Farm A)
const uint8_t LORA_CHANNEL    = 0x1A;   // 0x1A = 436.0 MHz (410 + 26). Avoids default 433.0 MHz

// --- 2.5 Hardware Pin Definitions for E32 Module ---
const int PIN_E32_RX2 = 6;  // ESP32 RX2 receives from E32 TX
const int PIN_E32_TX2 = 7;  // ESP32 TX2 transmits to E32 RX
const int PIN_E32_M0  = 4;   // Mode 0 control
const int PIN_E32_M1  = 5;   // Mode 1 control
const int PIN_E32_AUX = 18;  // Busy/Ready input pin

// Status LED Pin
const int PIN_STATUS_LED = 2; // Onboard LED for link activity indication

// --- 2.6 Local Node Routing Table (Lookup Table) ---
// Define the boards operating under this Gateway.
// You can add more nodes or change their hardware names here as your farm grows.
struct NodeRoute {
  uint8_t     loraAddress;          // 1-Byte physical address used over LoRa
  const char* hardwareAddress;      // Human-readable name used by backend
  bool        isActuator;           // True if node controls relays/pumps
};

const NodeRoute NODE_TABLE[] = {
  { 0x01, "NODE-ZONE1-01",   true  }, // Combo Node 1 (Zone 1): Sensors + Relay 1
  { 0x02, "NODE-ZONE2-01", true  }  // Combo Node 2 (Zone 2): Sensors + Relay 1
};
const uint8_t NODE_COUNT = sizeof(NODE_TABLE) / sizeof(NODE_TABLE[0]);

// --- 2.7 Scheduling & Timeout Constants ---
const unsigned long SENSOR_POLL_INTERVAL_MS = 30000; // Poll sensor nodes every 30 seconds
const unsigned long NODE_REPLY_TIMEOUT_MS   = 500;   // Wait up to 500ms for node response

// ======================================================================================
// SECTION 3: [FIXED SYSTEM CORE - DO NOT MODIFY UNLESS EXPERIENCED]
// ======================================================================================
// The code below handles E32 UART communication, binary packet validation, CRC16 checks,
// FreeRTOS queueing, and JSON serialization. Modifying this may break protocol integrity.

// --- FreeRTOS Data Structures for Command Priority Queue ---
struct ActuatorCommandTask {
  char    nodeHardwareAddress[32];
  uint8_t relayChannel;
  uint8_t action;           // 1: TurnOn, 0: TurnOff
  uint16_t durationSeconds;
  char    commandId[64];
};

QueueHandle_t g_actuatorCmdQueue = NULL;

// Global Instances
HardwareSerial E32Serial(2); // Use ESP32 HardwareSerial 2
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Dynamic Strings
String g_macAddress = "";
String TOPIC_TELEMETRY;
String TOPIC_COMMANDS;
String TOPIC_FEEDBACK;

// Timing Trackers
unsigned long g_lastPollTime = 0;
uint8_t g_currentPollingIndex = 0;

// --- 3.1 CRC16 CCITT Calculation (Polynomial 0x1021) ---
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

// --- 3.2 Wait for E32 AUX Pin to become Ready (HIGH) ---
void waitE32Ready() {
  unsigned long start = millis();
  while (digitalRead(PIN_E32_AUX) == LOW) {
    if (millis() - start > 1000) {
      Serial.println("[WARN] E32 AUX busy timeout!");
      break;
    }
    delay(2);
  }
}

// --- 3.3 Set E32 Operating Mode ---
// Mode 0: Normal Transceiver (M0=0, M1=0)
void setE32ModeNormal() {
  digitalWrite(PIN_E32_M0, LOW);
  digitalWrite(PIN_E32_M1, LOW);
  delay(20);
  waitE32Ready();
}

// --- 3.4 MQTT Message Callback (Incoming Downlinks from Backend) ---
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length) {
  String messageStr = "";
  for (unsigned int i = 0; i < length; i++) {
    messageStr += (char)payload[i];
  }

  Serial.print("[MQTT Downlink] Topic: ");
  Serial.println(topic);
  Serial.print("[MQTT Downlink] Payload: ");
  Serial.println(messageStr);

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, messageStr);
  if (err) {
    Serial.print("[ERR] MQTT deserializeJson failed: ");
    Serial.println(err.c_str());
    return;
  }

  // Parse command
  ActuatorCommandTask task;
  const char* cmdId = doc["commandId"] | "cmd-unknown";
  const char* nodeHw = doc["nodeHardwareAddress"] | "";
  const char* actionStr = doc["action"] | "TurnOff";
  int channel = doc["relayChannel"] | 1;
  int duration = doc["durationSeconds"] | 10;

  strncpy(task.commandId, cmdId, sizeof(task.commandId) - 1);
  strncpy(task.nodeHardwareAddress, nodeHw, sizeof(task.nodeHardwareAddress) - 1);
  task.relayChannel = (uint8_t)channel;
  task.durationSeconds = (uint16_t)duration;
  task.action = (String(actionStr).equalsIgnoreCase("TurnOn")) ? 1 : 0;

  // Enqueue to High-Priority Command Queue
  if (g_actuatorCmdQueue != NULL) {
    xQueueSend(g_actuatorCmdQueue, &task, portMAX_DELAY);
    Serial.println("[QUEUE] Actuator command queued for immediate LoRa dispatch.");
  }
}

// --- 3.5 Publish MQTT Actuator Feedback ---
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
  Serial.print("[MQTT Feedback Published]: ");
  Serial.println(buffer);
}

// --- 3.6 Transmit Fixed-Point Frame via E32 ---
void sendE32FixedFrame(uint8_t targetNetId, uint8_t targetNodeAddr, uint8_t targetChannel, const uint8_t* payload, size_t len) {
  waitE32Ready();

  // In E32 Fixed-Point Mode, the first 3 bytes specify destination:
  // [ADDH] [ADDL] [CHAN]
  E32Serial.write(targetNetId);
  E32Serial.write(targetNodeAddr);
  E32Serial.write(targetChannel);

  // Write payload
  E32Serial.write(payload, len);
  E32Serial.flush();
}

// --- 3.7 Dispatch Actuator Command over LoRa ---
void executeActuatorDownlink(const ActuatorCommandTask& cmd) {
  Serial.print("[LORA ACTUATE] Targeting node: ");
  Serial.println(cmd.nodeHardwareAddress);

  // Find physical node address from table
  uint8_t targetAddr = 0;
  for (uint8_t i = 0; i < NODE_COUNT; i++) {
    if (strcmp(NODE_TABLE[i].hardwareAddress, cmd.nodeHardwareAddress) == 0) {
      targetAddr = NODE_TABLE[i].loraAddress;
      break;
    }
  }

  if (targetAddr == 0) {
    Serial.println("[ERR] Target node hardware address not in routing table!");
    publishActuatorFeedback(cmd.commandId, cmd.nodeHardwareAddress, cmd.relayChannel, "Failed", "UnknownNode");
    return;
  }

  // Build Binary Actuator Command Frame (7 bytes payload + CRC)
  // Payload: [0xAA] [0x20] [Channel] [Action] [Duration MSB] [Duration LSB]
  uint8_t frame[8];
  frame[0] = 0xAA;                       // Magic byte
  frame[1] = 0x20;                       // CMD_ACTUATE
  frame[2] = cmd.relayChannel;           // Relay channel (1-8)
  frame[3] = cmd.action;                 // 1: TurnOn, 0: TurnOff
  frame[4] = (uint8_t)(cmd.durationSeconds >> 8);   // Duration MSB
  frame[5] = (uint8_t)(cmd.durationSeconds & 0xFF); // Duration LSB

  uint16_t crc = calculateCRC16(frame, 6);
  frame[6] = (uint8_t)(crc >> 8);
  frame[7] = (uint8_t)(crc & 0xFF);

  // Send via E32
  sendE32FixedFrame(LORA_NETWORK_ID, targetAddr, LORA_CHANNEL, frame, sizeof(frame));

  // Wait for Ack from Node
  unsigned long start = millis();
  bool ackReceived = false;
  uint8_t rxBuf[32];
  uint8_t rxLen = 0;

  while (millis() - start < NODE_REPLY_TIMEOUT_MS) {
    while (E32Serial.available()) {
      rxBuf[rxLen++] = E32Serial.read();
      if (rxLen >= sizeof(rxBuf)) break;
    }

    // Look for Ack frame (Frame type 0x21):
    // [0xAA] [0x21] [Channel] [ObservedState] [Status] [CRC_H] [CRC_L] (7 bytes)
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
    Serial.println("[WARN] Node Actuator Ack timed out.");
    publishActuatorFeedback(cmd.commandId, cmd.nodeHardwareAddress, cmd.relayChannel, "TimedOut", "NoResponse");
  }
}

// --- 3.8 Poll Sensor Node & Ingest In-Memory Telemetry ---
void pollSensorNode(const NodeRoute& node) {
  Serial.print("[POLL] Requesting telemetry from Node 0x");
  Serial.print(node.loraAddress, HEX);
  Serial.print(" (");
  Serial.print(node.hardwareAddress);
  Serial.println(")...");

  // Build Poll Request Frame: [0xAA] [0x10] [CRC_H] [CRC_L] (4 bytes)
  uint8_t pollFrame[4];
  pollFrame[0] = 0xAA;
  pollFrame[1] = 0x10; // CMD_POLL
  uint16_t crc = calculateCRC16(pollFrame, 2);
  pollFrame[2] = (uint8_t)(crc >> 8);
  pollFrame[3] = (uint8_t)(crc & 0xFF);

  // Clear serial buffer
  while (E32Serial.available()) E32Serial.read();

  // Transmit fixed frame to target node
  sendE32FixedFrame(LORA_NETWORK_ID, node.loraAddress, LORA_CHANNEL, pollFrame, sizeof(pollFrame));

  // Wait for Telemetry Response
  unsigned long start = millis();
  uint8_t rxBuf[64];
  uint8_t rxLen = 0;
  bool validTelemetry = false;

  while (millis() - start < NODE_REPLY_TIMEOUT_MS) {
    while (E32Serial.available()) {
      rxBuf[rxLen++] = E32Serial.read();
      if (rxLen >= sizeof(rxBuf)) break;
    }

    // Telemetry Response Frame (13 bytes total):
    // [0xAA] [0x11] [Battery] [Soil_H] [Soil_L] [Temp_H] [Temp_L] [Hum_H] [Hum_L] [pH_H] [pH_L] [CRC_H] [CRC_L]
    if (rxLen >= 13) {
      for (uint8_t i = 0; i <= rxLen - 13; i++) {
        if (rxBuf[i] == 0xAA && rxBuf[i+1] == 0x11) {
          uint16_t expectedCrc = calculateCRC16(&rxBuf[i], 11);
          uint16_t packetCrc = ((uint16_t)rxBuf[i+11] << 8) | rxBuf[i+12];

          if (expectedCrc == packetCrc) {
            validTelemetry = true;

            // Unpack binary fields
            uint8_t  batteryRaw = rxBuf[i+2];
            uint16_t soilRaw    = ((uint16_t)rxBuf[i+3] << 8) | rxBuf[i+4];
            int16_t  tempRaw    = ((int16_t)rxBuf[i+5] << 8)  | rxBuf[i+6];
            uint16_t humRaw     = ((uint16_t)rxBuf[i+7] << 8) | rxBuf[i+8];
            uint16_t phRaw      = ((uint16_t)rxBuf[i+9] << 8) | rxBuf[i+10];

            float soilMoisture = soilRaw / 10.0f;
            float temperature  = tempRaw / 10.0f;
            float airHumidity  = humRaw / 10.0f;
            float phValue      = phRaw / 100.0f;

            Serial.printf("[LORA RX] Soil: %.1f%% | Temp: %.1fC | Hum: %.1f%% | pH: %.2f | Bat: %d%%\n",
                          soilMoisture, temperature, airHumidity, phValue, batteryRaw);

            // Publish In-Memory Telemetry JSON to SmartFarm Backend Broker
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
            mqttClient.publish(TOPIC_TELEMETRY.c_str(), buffer);
            Serial.print("[MQTT Telemetry Published]: ");
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
    Serial.printf("[WARN] Node %s did not reply to poll within %d ms.\n", node.hardwareAddress, NODE_REPLY_TIMEOUT_MS);
  }
}

// --- 3.9 Network Connection Helpers ---
void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
  digitalWrite(PIN_STATUS_LED, LOW);

  g_macAddress = WiFi.macAddress();
  Serial.println("\n[OK] Wi-Fi Connected!");
  Serial.print("[INFO] Hardware MAC Address: ");
  Serial.println(g_macAddress);
  Serial.print("[INFO] Local Gateway IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT Broker at ");
    Serial.print(MQTT_BROKER_IP);
    Serial.print(":");
    Serial.println(MQTT_BROKER_PORT);

    String clientId = "smartfarm-gateway-" + g_macAddress;

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("[OK] Connected to Embedded MQTT Broker!");
      // Subscribe to command topics for this gateway
      mqttClient.subscribe(TOPIC_COMMANDS.c_str());
      String emergTopic = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/emergency-stop";
      mqttClient.subscribe(emergTopic.c_str());
      Serial.print("[MQTT Subscribed]: ");
      Serial.println(TOPIC_COMMANDS);
    } else {
      Serial.print("[ERR] MQTT connect failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(". Retrying in 3 seconds...");
      delay(3000);
    }
  }
}

// --- Arduino Standard Setup ---
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  SMARTFARM IOT - ESP32 E32 CENTRAL GATEWAY INITIALIZING");
  Serial.println("=======================================================");

  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_E32_M0, OUTPUT);
  pinMode(PIN_E32_M1, OUTPUT);
  pinMode(PIN_E32_AUX, INPUT);

  // Initialize E32 UART (9600 8N1)
  E32Serial.begin(9600, SERIAL_8N1, PIN_E32_RX2, PIN_E32_TX2);
  setE32ModeNormal();
  Serial.println("[OK] E32 LoRa Serial initialized in Normal Mode.");

  // Create High-Priority Actuator Command Queue
  g_actuatorCmdQueue = xQueueCreate(10, sizeof(ActuatorCommandTask));

  // Initialize Network & MQTT
  connectWiFi();

  // Configure Topics
  TOPIC_TELEMETRY = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/telemetry";
  TOPIC_COMMANDS  = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/commands";
  TOPIC_FEEDBACK  = "smartfarm/gateways/" + String(GATEWAY_SERIAL) + "/feedback";

  mqttClient.setServer(MQTT_BROKER_IP, MQTT_BROKER_PORT);
  mqttClient.setCallback(onMqttMessageReceived);
  mqttClient.setBufferSize(1024);
  connectMQTT();
}

// --- Arduino Standard Loop ---
void loop() {
  // 1. Maintain Wi-Fi and MQTT Connectivity
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  // 2. Preemptive Command Queue Check:
  // If an actuator command arrived from the UI, process it immediately before sensor polling!
  ActuatorCommandTask pendingCmd;
  if (xQueueReceive(g_actuatorCmdQueue, &pendingCmd, 0) == pdTRUE) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    executeActuatorDownlink(pendingCmd);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  // 3. Periodic Deterministic Sensor Polling:
  // Every SENSOR_POLL_INTERVAL_MS, iterate through registered sensor nodes
  unsigned long now = millis();
  if (now - g_lastPollTime >= SENSOR_POLL_INTERVAL_MS) {
    g_lastPollTime = now;

    // Check if current node is a sensor node
    if (true) { // All combo nodes support sensor telemetry polling
      digitalWrite(PIN_STATUS_LED, HIGH);
      pollSensorNode(NODE_TABLE[g_currentPollingIndex]);
      digitalWrite(PIN_STATUS_LED, LOW);
    }

    // Advance to next node for the next cycle
    g_currentPollingIndex = (g_currentPollingIndex + 1) % NODE_COUNT;
  }

  delay(10);
}
