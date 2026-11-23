# Trang-2

Source: `hardware.drawio`.

````mermaid
graph TB
    %% Định nghĩa Style nền trắng, viền đen chuẩn kỹ thuật
    classDef default fill:#ffffff,stroke:#000000,stroke-width:1px;
    classDef mainBox fill:#ffffff,stroke:#000000,stroke-width:2px;

    subgraph POWER ["POWER DISTRIBUTION UNIT"]
        P5V["5V DC Power Rail"]
        P3V3["3.3V DC Power Rail"]
        PGND["Common GND Rail"]
    end

    subgraph NODE ["SMART FARM IOT NODE"]
        direction TB
        
        subgraph SENSING ["Sensing Unit"]
            DHT["DHT11 / DHT22<br/>(Temp & Hum Sensor)"]
            SOIL["Soil Moisture Sensor<br/>(Analog Soil)"]
        end

        subgraph ACTUATOR ["Actuator Unit"]
            RELAY["Module Relay 5V<br/>(Pump / Valve Control)"]
        end

        subgraph MCU ["Processing Unit"]
            ARDUINO["Arduino Nano / Uno<br/>(ATmega328P MCU)"]
        end

        subgraph COMM ["Communication Unit"]
            LORA["Module LoRa E32<br/>(Wireless Transceiver)"]
        end
    end

    %% Đấu nối đường nguồn
    P5V -. "5V DC" .-> DHT
    P5V -. "5V DC" .-> RELAY
    P5V -. "5V DC" .-> SOIL
    P3V3 -. "3.3V DC (Cấm cắm 5V)" .-> LORA
    PGND -. "GND chung" .-> ARDUINO

    %% Đấu nối chân tín hiệu chi tiết
    DHT -- "DATA Line -> [D2]" --> ARDUINO
    SOIL -- "AO Line -> [A0]" --> ARDUINO
    ARDUINO -- "IN Line <- [D5]" --> RELAY

    ARDUINO -- "Soft RX <- [D3]" --> LORA
    ARDUINO -- "Soft TX -> [D4]" --> LORA
    ARDUINO -- "Mode M0 -> [D6]" --> LORA
    ARDUINO -- "Mode M1 -> [D7]" --> LORA
````
