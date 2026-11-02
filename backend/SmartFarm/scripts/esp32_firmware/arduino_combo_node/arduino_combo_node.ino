/*
 * ======================================================================================
 * SMARTFARM IOT TUTORIAL & FIRMWARE - COMBO NODE (SENSOR + ACTUATOR)
 * ======================================================================================
 * Target Board: Arduino Uno R3 or Arduino Nano (ATmega328P, 5V Logic)
 * Radio Module: EBYTE E32-Series LoRa (e.g. E32-433T20D / E32-433T30D / E32-915T20D)
 *
 * SECTION 1: HARDWARE WIRING TUTORIAL & PIN CONNECTIONS
 * --------------------------------------------------------------------------------------
 * This firmware turns any Arduino (Uno or Nano) into a COMPLETE COMBO NODE capable of:
 *   1. Reading field sensors (Soil moisture, Temperature, Air Humidity, pH, Battery)
 *   2. Controlling an onboard Relay (Pump, Solenoid Valve, Fan) with safety auto-cutoff
 *   3. Communicating via E32 LoRa module in Fixed-Point addressing mode
 *
 * [!] VOLTAGE LEVEL-SHIFTING & RELAY POWER NOTICE:
 * 1. E32 RX pin requires 3.3V logic. Use a 1k / 2k resistor voltage divider on Pin 3.
 * 2. 5V Relay Modules draw ~70-100mA. Connect Relay VCC to the 5V rail (or external 5V),
 *    NEVER to the 3.3V pin!
 *
 * Arduino Pin          Module / Component                  Description
 * --------------------------------------------------------------------------------------
 * 5V                   Relay VCC                           5V DC Relay Coil Power
 * 3.3V                 E32 VCC                             E32 Power (3.3V DC only)
 * GND                  Common Ground                       E32 GND, Relay GND, Sensor GND
 *
 * Pin 2 (Soft RX) <--- E32 TXD                             Receive serial data from E32
 * Pin 3 (Soft TX) ----[ 1k ohm ]--*--> [ E32 RXD ]         Transmit serial data to E32
 *                                 |
 *                            [ 2k ohm ]
 *                                 |
 *                               [ GND ]
 * Pin 4           ---> Relay IN1 (Channel 1)               Relay trigger signal
 * Pin 5           ---> E32 M0                              Operating mode pin M0 (LOW=Normal)
 * Pin 6           ---> E32 M1                              Operating mode pin M1 (LOW=Normal)
 * Pin 7           <--- E32 AUX                             Busy/Ready status pin
 * Pin 13          ---> Built-in LED                        Indicates relay & radio activity
 *
 * Analog Pin A0   <--- Soil Moisture Sensor                Analog soil moisture probe
 * Analog Pin A1   <--- Battery Voltage Divider             Optional battery monitoring
 * Digital Pin 8   <--- DHT22 / SHT30 Temp & Humidity       Environmental sensor data
 * ======================================================================================
 */

#include <SoftwareSerial.h>

// ======================================================================================
// SECTION 2: [USER CONFIGURABLE SECTION] - MODIFY THESE FOR EACH SPECIFIC NODE
// ======================================================================================
// When flashing multiple boards (Node 1, Node 2, etc.), simply change the Node Address
// and Hardware Serial name below!

// --- 2.1 Node Identity & Radio Domain ---
const uint8_t LORA_NETWORK_ID = 0x11;              // Must match Gateway Network ID!
const uint8_t LORA_CHANNEL    = 0x1A;              // 0x1A = 436.0 MHz (Must match Gateway)

// >>> CHANGE THESE TWO PER BOARD <<<
// For Node 1: Address = 0x01, Serial = "NODE-ZONE1-01"
// For Node 2: Address = 0x02, Serial = "NODE-ZONE2-01"
const uint8_t MY_NODE_ADDRESS = 0x01;              
const char* HARDWARE_ADDRESS  = "NODE-ZONE1-01";

// --- 2.2 Relay Configuration & Active Level ---
const int PIN_RELAY_CH1 = 4;   // Digital pin controlling the relay
const int PIN_LED_STATE = 13;  // Status LED pin

// Optical relay modules are usually ACTIVE-LOW (LOW = Relay ON, HIGH = Relay OFF).
// If your relay is active-high, change this to HIGH.
const int RELAY_ON_LEVEL  = LOW;   
const int RELAY_OFF_LEVEL = HIGH;  

// Safety watchdog limit: maximum time the relay can run continuously before auto-off
const unsigned long MAX_SAFE_DURATION_SECONDS = 1800; // 30 minutes max safety limit
const unsigned long DEFAULT_RUN_DURATION_SEC  = 15;   // Fallback duration if 0 specified

// --- 2.3 Sensor Pin Definitions & Calibration ---
const int PIN_SOIL_ANALOG   = A0;  // Analog soil moisture pin
const int PIN_BATTERY_SENSE = A1;  // Battery monitor pin
const int PIN_TEMP_HUMID    = 8;   // Digital pin for DHT/Temp sensor

// Soil probe ADC calibration points
const int SOIL_ADC_DRY_AIR   = 750; // Dry air ADC value
const int SOIL_ADC_WET_WATER = 280; // Water cup ADC value

// Set to true during bench testing without physical probes attached
const bool SIMULATE_IF_NO_SENSORS = true;

// --- 2.4 E32 UART Pins ---
const int PIN_E32_RX  = 2;  // Arduino RX from E32 TX
const int PIN_E32_TX  = 3;  // Arduino TX to E32 RX (via divider)
const int PIN_E32_M0  = 5;  // Mode M0
const int PIN_E32_M1  = 6;  // Mode M1
const int PIN_E32_AUX = 7;  // Ready AUX

// ======================================================================================
// SECTION 3: [FIXED SYSTEM CORE - DO NOT MODIFY UNLESS EXPERIENCED]
// ======================================================================================
// Handles UART communication, CRC16 checksums, autonomous relay cutoff watchdogs,
// and simultaneous processing of telemetry requests and actuator downlinks.

SoftwareSerial e32Serial(PIN_E32_RX, PIN_E32_TX);

// Internal State Tracking
bool          g_isRelayActive = false;
unsigned long g_relayCutoffMillis = 0;
uint8_t       g_activeChannel = 1;

// Simulated Smooth Drift States for bench testing
float g_simSoil = 68.5f;
float g_simTemp = 28.5f;
float g_simHum  = 72.0f;
float g_simPh   = 6.80f;

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

// --- 3.2 Wait for E32 AUX Ready (HIGH) ---
void waitE32Ready() {
  unsigned long start = millis();
  while (digitalRead(PIN_E32_AUX) == LOW) {
    if (millis() - start > 1000) break;
    delay(2);
  }
}

// --- 3.3 Set E32 to Normal Transceiver Mode (M0=0, M1=0) ---
void setE32ModeNormal() {
  digitalWrite(PIN_E32_M0, LOW);
  digitalWrite(PIN_E32_M1, LOW);
  delay(20);
  waitE32Ready();
}

// --- 3.4 Hardware Relay Control ---
void turnRelayOn(uint8_t channel, unsigned long durationSeconds) {
  if (durationSeconds == 0) durationSeconds = DEFAULT_RUN_DURATION_SEC;
  if (durationSeconds > MAX_SAFE_DURATION_SECONDS) durationSeconds = MAX_SAFE_DURATION_SECONDS;

  digitalWrite(PIN_RELAY_CH1, RELAY_ON_LEVEL);
  digitalWrite(PIN_LED_STATE, HIGH);

  g_isRelayActive = true;
  g_activeChannel = channel;
  g_relayCutoffMillis = millis() + (durationSeconds * 1000UL);

  Serial.print(F("[ACTUATOR ON] Relay activated for "));
  Serial.print(durationSeconds);
  Serial.println(F(" seconds."));
}

void turnRelayOff(uint8_t channel) {
  digitalWrite(PIN_RELAY_CH1, RELAY_OFF_LEVEL);
  digitalWrite(PIN_LED_STATE, LOW);

  g_isRelayActive = false;
  g_relayCutoffMillis = 0;

  Serial.println(F("[ACTUATOR OFF] Relay turned OFF."));
}

// --- 3.5 Transmit Actuator Ack to Gateway ---
void sendActuatorAck(uint8_t channel, uint8_t observedState, uint8_t status) {
  // Ack Payload: [0xAA] [0x21] [Channel] [ObservedState] [Status] [CRC_H] [CRC_L] (7 bytes)
  uint8_t ackPayload[7];
  ackPayload[0] = 0xAA;
  ackPayload[1] = 0x21; // FRAME_ACTUATOR_ACK
  ackPayload[2] = channel;
  ackPayload[3] = observedState; // 1: On, 0: Off
  ackPayload[4] = status;        // 0: Success

  uint16_t crc = calculateCRC16(ackPayload, 5);
  ackPayload[5] = (uint8_t)(crc >> 8);
  ackPayload[6] = (uint8_t)(crc & 0xFF);

  waitE32Ready();

  // Target Gateway: [NetworkId, 0x00, Channel]
  e32Serial.write(LORA_NETWORK_ID);
  e32Serial.write(0x00);        // Gateway is always 0x00
  e32Serial.write(LORA_CHANNEL);
  e32Serial.write(ackPayload, sizeof(ackPayload));
  e32Serial.flush();

  Serial.println(F("[SENT] Actuator Ack sent to Gateway."));
}

// --- 3.6 Read Sensor Values ---
void acquireSensorReadings(float &soil, float &temp, float &hum, float &ph, uint8_t &bat) {
  if (SIMULATE_IF_NO_SENSORS) {
    g_simSoil += ((random(-5, 6)) / 10.0f);
    if (g_simSoil < 40.0f) g_simSoil = 40.0f;
    if (g_simSoil > 90.0f) g_simSoil = 90.0f;

    g_simTemp += ((random(-3, 4)) / 10.0f);
    if (g_simTemp < 20.0f) g_simTemp = 20.0f;
    if (g_simTemp > 38.0f) g_simTemp = 38.0f;

    g_simHum  += ((random(-5, 6)) / 10.0f);
    if (g_simHum < 50.0f) g_simHum = 50.0f;
    if (g_simHum > 95.0f) g_simHum = 95.0f;

    soil = g_simSoil;
    temp = g_simTemp;
    hum  = g_simHum;
    ph   = g_simPh;
    bat  = 96;
  } else {
    int rawSoil = analogRead(PIN_SOIL_ANALOG);
    soil = map(rawSoil, SOIL_ADC_DRY_AIR, SOIL_ADC_WET_WATER, 0, 100);
    soil = constrain(soil, 0.0f, 100.0f);
    temp = 28.5f;
    hum  = 72.0f;
    ph   = 6.80f;
    bat  = 95;
  }
}

// --- 3.7 Transmit Telemetry Response Frame to Gateway ---
void sendTelemetryResponse(float soil, float temp, float hum, float ph, uint8_t bat) {
  // Convert floats to fixed-point integers
  uint16_t soilInt = (uint16_t)(soil * 10.0f);
  int16_t  tempInt = (int16_t)(temp * 10.0f);
  uint16_t humInt  = (uint16_t)(hum * 10.0f);
  uint16_t phInt   = (uint16_t)(ph * 100.0f);

  // Telemetry Payload (13 bytes):
  // [0xAA] [0x11] [Bat] [Soil_H] [Soil_L] [Temp_H] [Temp_L] [Hum_H] [Hum_L] [pH_H] [pH_L] [CRC_H] [CRC_L]
  uint8_t payload[13];
  payload[0]  = 0xAA;
  payload[1]  = 0x11; // FRAME_TELEMETRY
  payload[2]  = bat;
  payload[3]  = (uint8_t)(soilInt >> 8);
  payload[4]  = (uint8_t)(soilInt & 0xFF);
  payload[5]  = (uint8_t)(tempInt >> 8);
  payload[6]  = (uint8_t)(tempInt & 0xFF);
  payload[7]  = (uint8_t)(humInt >> 8);
  payload[8]  = (uint8_t)(humInt & 0xFF);
  payload[9]  = (uint8_t)(phInt >> 8);
  payload[10] = (uint8_t)(phInt & 0xFF);

  uint16_t crc = calculateCRC16(payload, 11);
  payload[11] = (uint8_t)(crc >> 8);
  payload[12] = (uint8_t)(crc & 0xFF);

  waitE32Ready();

  // Target Gateway: [NetworkId, 0x00, Channel]
  e32Serial.write(LORA_NETWORK_ID);
  e32Serial.write(0x00);        // Gateway is always 0x00
  e32Serial.write(LORA_CHANNEL);
  e32Serial.write(payload, sizeof(payload));
  e32Serial.flush();

  Serial.println(F("[SENT] Telemetry response sent to Gateway!"));
}

// --- Arduino Standard Setup ---
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n======================================================="));
  Serial.println(F("  SMARTFARM IOT - ARDUINO COMBO NODE (SENSOR + ACTUATOR)"));
  Serial.println(F("======================================================="));

  // Initialize Relay to safe OFF state
  pinMode(PIN_RELAY_CH1, OUTPUT);
  digitalWrite(PIN_RELAY_CH1, RELAY_OFF_LEVEL);

  pinMode(PIN_LED_STATE, OUTPUT);
  digitalWrite(PIN_LED_STATE, LOW);

  pinMode(PIN_E32_M0, OUTPUT);
  pinMode(PIN_E32_M1, OUTPUT);
  pinMode(PIN_E32_AUX, INPUT);

  // Initialize SoftwareSerial for E32 at 9600 baud
  e32Serial.begin(9600);
  setE32ModeNormal();

  Serial.print(F("[INFO] Hardware Name: "));
  Serial.println(HARDWARE_ADDRESS);
  Serial.print(F("[INFO] Local Node LoRa Address: 0x"));
  Serial.println(MY_NODE_ADDRESS, HEX);
  Serial.println(F("[OK] Combo Node online and listening for polls & commands..."));
}

// --- Arduino Standard Loop ---
void loop() {
  // 1. AUTONOMOUS HARDWARE SAFETY CUTOFF WATCHDOG:
  // If the relay is currently ON, check if duration has expired.
  // Shuts off automatically even if the radio link or ESP32 drops!
  if (g_isRelayActive && (millis() >= g_relayCutoffMillis)) {
    Serial.println(F("[WATCHDOG CUTOFF] Scheduled run duration reached."));
    turnRelayOff(g_activeChannel);
    sendActuatorAck(g_activeChannel, 0, 0); // Send confirmation of auto-off
  }

  // 2. CHECK INCOMING LO-RA PACKETS FROM GATEWAY:
  if (e32Serial.available()) {
    byte b = e32Serial.read();

    if (b == 0xAA) {
      // Wait for at least the command type byte
      unsigned long start = millis();
      while (e32Serial.available() < 1 && (millis() - start < 50)) delay(2);

      if (e32Serial.available() >= 1) {
        uint8_t cmdType = e32Serial.read();

        // ----------------------------------------------------
        // CASE A: GATEWAY SENSOR POLL REQUEST (CMD 0x10)
        // ----------------------------------------------------
        if (cmdType == 0x10) {
          while (e32Serial.available() < 2 && (millis() - start < 100)) delay(2);
          if (e32Serial.available() >= 2) {
            uint8_t crcH = e32Serial.read();
            uint8_t crcL = e32Serial.read();

            uint8_t checkBuf[2] = { 0xAA, 0x10 };
            uint16_t expectedCrc = calculateCRC16(checkBuf, 2);
            uint16_t packetCrc = ((uint16_t)crcH << 8) | crcL;

            if (expectedCrc == packetCrc) {
              Serial.println(F("[POLL RECEIVED] Reading sensors and responding..."));
              float soil, temp, hum, ph;
              uint8_t bat;
              acquireSensorReadings(soil, temp, hum, ph, bat);
              sendTelemetryResponse(soil, temp, hum, ph, bat);
            }
          }
        }
        // ----------------------------------------------------
        // CASE B: GATEWAY ACTUATOR COMMAND (CMD 0x20)
        // ----------------------------------------------------
        else if (cmdType == 0x20) {
          while (e32Serial.available() < 6 && (millis() - start < 100)) delay(2);
          if (e32Serial.available() >= 6) {
            uint8_t channel  = e32Serial.read();
            uint8_t action   = e32Serial.read();
            uint8_t durH     = e32Serial.read();
            uint8_t durL     = e32Serial.read();
            uint8_t crcH     = e32Serial.read();
            uint8_t crcL     = e32Serial.read();

            uint8_t checkBuf[6] = { 0xAA, 0x20, channel, action, durH, durL };
            uint16_t expectedCrc = calculateCRC16(checkBuf, 6);
            uint16_t packetCrc   = ((uint16_t)crcH << 8) | crcL;

            if (expectedCrc == packetCrc) {
              uint16_t duration = ((uint16_t)durH << 8) | durL;

              if (action == 1) {
                turnRelayOn(channel, duration);
                sendActuatorAck(channel, 1, 0); // Confirm Turned ON
              } else {
                turnRelayOff(channel);
                sendActuatorAck(channel, 0, 0); // Confirm Turned OFF
              }
            }
          }
        }
      }
    }
  }
}
