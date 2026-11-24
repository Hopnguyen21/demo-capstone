# Trang-1

Source: `hardware.drawio`.

````mermaid
graph LR
    %% Định nghĩa Style nền trắng, viền đen chuẩn kỹ thuật
    classDef default fill:#ffffff,stroke:#000000,stroke-width:1px;
    classDef cluster fill:#ffffff,stroke:#000000,stroke-width:1.5px,stroke-dasharray: 3 3;

    subgraph NODES ["Sensor Nodes 1..n (Zone Z01..Z0n)"]
        direction TB
        ARDUINO["Arduino Nano/Uno<br/>(ATmega328P)"]
        SENS["DHT11/22 & Soil Sensor"]
        ACT["Relay 5V Module"]
        PUMP["Water Pump"]
        LORA["Module LoRa E32 (3.3V)"]
        
        SENS --> ARDUINO
        ARDUINO --> ACT
        ACT --> PUMP
        ARDUINO <--> LORA
    end

    subgraph GW ["LoRa Gateway"]
        GW_MCU["ESP32 / Raspberry Pi"]
        GW_LORA["LoRa Receiver Module"]
        GW_LORA <--> GW_MCU
    end

    subgraph CLOUD ["Backend Server & DB"]
        API["Backend API<br/>(Node.js / Python)"]
        DB[(Database<br/>PostgreSQL / MongoDB)]
        API <--> DB
    end

    %% Kết nối không dây LoRa với cơ chế Polling cho n Nodes
    LORA <== "LoRa RF Protocol<br/>(Request/Response Polling cho Nodes 1..n)" ==> GW_LORA

    %% Kết nối Internet/Cloud
    GW_MCU <== "Wi-Fi / Ethernet<br/>(MQTT / HTTP Protocol)" ==> API
````
