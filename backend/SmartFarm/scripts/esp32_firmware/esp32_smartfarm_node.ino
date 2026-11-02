#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. Wi-Fi and MQTT Configuration
// ==========================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// IP Address of the PC running SmartFarm.Api backend
const char* MQTT_BROKER   = "192.168.1.160";
const int   MQTT_PORT     = 1883;

// Gateway & Device Identity matching SmartFarm database seed
const char* GATEWAY_ID    = "51000000-0000-0000-0000-000000000001";
const char* SENSOR_DEV_ID = "52000000-0000-0000-0000-000000000001";
const char* ACTUATOR_DEV_ID = "52000000-0000-0000-0000-000000000002";
const char* ZONE_ID       = "32000000-0000-0000-0000-000000000001";

// MQTT Topics
String TOPIC_TELEMETRY;
String TOPIC_COMMANDS;
String TOPIC_FEEDBACK;

// ==========================================
// 2. Hardware Pin Definitions
// ==========================================
const int PIN_BUILTIN_LED = 2; // Onboard Blue LED (indicates Actuator activity)
const int PIN_RELAY       = 4; // Relay module signal IN pin (toggles pump/valve)

// Variables
WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 5000; // Emit simulated readings every 5 seconds

// State tracking
bool isActuatorActive = false;
unsigned long actuatorTurnOffTime = 0;
String activeCommandId = "";

// Simulated sensor values with smooth random walks
float currentSoilMoisture = 65.0f;
float currentTemperature  = 28.5f;
float currentAirHumidity  = 72.0f;
float currentPh           = 6.5f;
float currentEc           = 1.4f;
float currentLight        = 850.0f;

// ==========================================
// 3. MQTT Callback (Received Downlink Command)
// ==========================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String messageStr = "";
  for (unsigned int i = 0; i < length; i++) {
    messageStr += (char)payload[i];
  }

  Serial.print("[MQTT Downlink] Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  Serial.println(messageStr);

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, messageStr);
  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.f_str());
    return;
  }

  const char* commandId = doc["commandId"] | "";
  const char* action    = doc["action"] | "";
  int durationSeconds   = doc["durationSeconds"] | 10;

  activeCommandId = String(commandId);

  if (String(action) == "TurnOn") {
    // Turn ON physical relay and LED
    digitalWrite(PIN_RELAY, HIGH);
    digitalWrite(PIN_BUILTIN_LED, HIGH);
    isActuatorActive = true;
    actuatorTurnOffTime = millis() + ((unsigned long)durationSeconds * 1000);

    Serial.println("Actuator turned ON! Sending feedback...");

    // Send Feedback (Acknowledged / Executing)
    sendActuatorFeedback(activeCommandId, "Acknowledged", "TurnOn", nullptr, nullptr);
  } else if (String(action) == "TurnOff") {
    digitalWrite(PIN_RELAY, LOW);
    digitalWrite(PIN_BUILTIN_LED, LOW);
    isActuatorActive = false;

    Serial.println("Actuator turned OFF immediately. Sending feedback...");
    sendActuatorFeedback(activeCommandId, "TurnOff", "TurnOff", nullptr, nullptr);
  }
}

// ==========================================
// 4. Send Actuator Feedback
// ==========================================
void sendActuatorFeedback(String cmdId, const char* status, const char* observedState, const char* errCode, const char* errMsg) {
  StaticJsonDocument<512> doc;
  doc["commandId"]     = cmdId;
  doc["deviceId"]      = ACTUATOR_DEV_ID;
  doc["status"]        = status;
  doc["observedState"] = observedState;
  doc["occurredAtUtc"] = "2026-10-21T09:10:00Z";
  if (errCode != nullptr) doc["errorCode"] = errCode;
  if (errMsg != nullptr) doc["errorMessage"] = errMsg;

  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_FEEDBACK.c_str(), buffer);
  Serial.print("[MQTT Feedback Sent]: ");
  Serial.println(buffer);
}

// ==========================================
// 5. Publish Simulated Telemetry
// ==========================================
void publishSimulatedTelemetry() {
  // Apply realistic random drift
  currentSoilMoisture += (random(-5, 6) / 10.0f);
  if (currentSoilMoisture < 40.0f) currentSoilMoisture = 40.0f;
  if (currentSoilMoisture > 95.0f) currentSoilMoisture = 95.0f;

  currentTemperature += (random(-3, 4) / 10.0f);
  currentAirHumidity += (random(-5, 6) / 10.0f);

  StaticJsonDocument<1024> doc;
  doc["messageId"]     = "msg-" + String(millis());
  doc["deviceId"]      = SENSOR_DEV_ID;
  doc["zoneId"]        = ZONE_ID;
  doc["capturedAtUtc"] = "2026-10-21T09:10:00Z";

  JsonArray readings = doc.createNestedArray("readings");

  JsonObject r1 = readings.createNestedObject();
  r1["parameterCode"] = "SoilMoisture";
  r1["value"] = serialized(String(currentSoilMoisture, 2));
  r1["unit"]  = "%";

  JsonObject r2 = readings.createNestedObject();
  r2["parameterCode"] = "Temperature";
  r2["value"] = serialized(String(currentTemperature, 2));
  r2["unit"]  = "°C";

  JsonObject r3 = readings.createNestedObject();
  r3["parameterCode"] = "AirHumidity";
  r3["value"] = serialized(String(currentAirHumidity, 2));
  r3["unit"]  = "%";

  JsonObject r4 = readings.createNestedObject();
  r4["parameterCode"] = "Ph";
  r4["value"] = serialized(String(currentPh, 2));
  r4["unit"]  = "pH";

  JsonObject r5 = readings.createNestedObject();
  r5["parameterCode"] = "Ec";
  r5["value"] = serialized(String(currentEc, 2));
  r5["unit"]  = "mS/cm";

  JsonObject r6 = readings.createNestedObject();
  r6["parameterCode"] = "LightIntensity";
  r6["value"] = serialized(String(currentLight, 0));
  r6["unit"]  = "lux";

  char buffer[1024];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY.c_str(), buffer);

  Serial.print("[MQTT Telemetry Published]: ");
  Serial.println(buffer);
}

// ==========================================
// 6. Connect Wi-Fi and MQTT
// ==========================================
void connectWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_BUILTIN_LED, !digitalRead(PIN_BUILTIN_LED));
  }
  digitalWrite(PIN_BUILTIN_LED, LOW);
  Serial.println("\nWi-Fi Connected! IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to Embedded MQTT Broker at ");
    Serial.print(MQTT_BROKER);
    Serial.print("...");

    String clientId = "ESP32_SmartFarm_Client_" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("CONNECTED!");

      // Subscribe to command topic
      mqttClient.subscribe(TOPIC_COMMANDS.c_str());
      Serial.print("Subscribed to: ");
      Serial.println(TOPIC_COMMANDS);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 3 seconds...");
      delay(3000);
    }
  }
}

// ==========================================
// 7. Setup & Main Loop
// ==========================================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BUILTIN_LED, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_BUILTIN_LED, LOW);
  digitalWrite(PIN_RELAY, LOW);

  // Initialize topics
  TOPIC_TELEMETRY = String("smartfarm/gateways/") + GATEWAY_ID + "/telemetry";
  TOPIC_COMMANDS  = String("smartfarm/gateways/") + GATEWAY_ID + "/commands";
  TOPIC_FEEDBACK  = String("smartfarm/gateways/") + GATEWAY_ID + "/actuator-feedback";

  connectWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();

  // Handle Actuator automatic duration timeout
  if (isActuatorActive && millis() >= actuatorTurnOffTime) {
    digitalWrite(PIN_RELAY, LOW);
    digitalWrite(PIN_BUILTIN_LED, LOW);
    isActuatorActive = false;
    Serial.println("Actuator duration reached. Turning OFF and sending Completed feedback...");
    sendActuatorFeedback(activeCommandId, "TurnOff", "TurnOff", nullptr, nullptr);
  }

  // Periodic Telemetry publish
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    publishSimulatedTelemetry();
  }
}
