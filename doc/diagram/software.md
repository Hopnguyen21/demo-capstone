# Trang-1

Source: `software.drawio`.

````mermaid
flowchart TD
    %% Vùng Client
    subgraph Client ["Client"]
        direction TB
        WebApp["Web App"]
        MobileApp["Mobile App"]
    end

    %% Vùng Server
    subgraph Server ["Server"]
        direction TB
        Backend["Backend"]
        Database["Database"]
    end

    %% Vùng External Service
    subgraph ExternalService ["External Service"]
        direction TB
        Gemini["Gemini"]
    end

    %% Vùng IoT
    subgraph IoT ["IoT"]
        direction TB
        Sensor["SENSOR"]
        Arduino["Arduino"]
        ESP32["ESP32"]
    end

    %% --- ĐƯỜNG KẾT NỐI ---

    %% 1. Client -> Server
    Client -->|HTTPS + JWT| Backend

    %% 2. Server internal
    Backend -->|SQL / ORM| Database

    %% 3. Server -> External Service
    Backend <-->|API / REST| Gemini

    %% 4. Luồng IoT nội bộ
    Sensor -->|Analog / Digital| Arduino
    Arduino -->|UART / I2C| ESP32

    %% 5. IoT -> Server
    ESP32 -->|HTTP / MQTT / Wi-Fi| Backend
````
