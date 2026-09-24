# SmartFarm – Tóm tắt chi tiết đề tài

## 1. Thông tin chung

- **Tên tiếng Anh:** SmartFarm: AI-powered Smart Agriculture Management Platform
- **Tên tiếng Việt:** SmartFarm: Nền tảng Quản lý Nông nghiệp Thông minh tích hợp AI
- **Lĩnh vực:** Software Engineering
- **Thời gian:** 09/2026 – 12/2026
- **GVHD:** Đặng Ngọc Minh Đức & Thân Thị Ngọc Vân

---

## 2. Định vị hệ thống

SmartFarm được định vị là một **multi-tenant smart agriculture SaaS platform** cung cấp dịch vụ cho nhiều Farm Owner.

```text
SMARTFARM PLATFORM
│
├── Platform Admin
│
├── Platform Technician
│
└── Farm Owner / Tenant
      │
      ├── Farmer / Farm Worker
      │
      └── One or More Farms
```

### Các role chính

| Role | Cấp | Vai trò |
|---|---|---|
| **Platform Admin** | Platform | Quản trị toàn bộ SmartFarm platform |
| **Platform Technician** | Platform | Cài đặt, cấu hình, giám sát và bảo trì IoT devices/gateways |
| **Farm Owner** | Tenant | Khách hàng/chủ trang trại; quản lý farm, farmers, crops, operations và dữ liệu của mình |
| **Farmer / Farm Worker** | Tenant | Nhân công của Farm Owner; thực hiện và theo dõi các công việc được phân quyền |

> **Không sử dụng role  trong phạm vi hệ thống.**

### Quan hệ Tenant – User – Farm

- **Farm Owner = Tenant**.
- Một Farm Owner có thể sở hữu **một hoặc nhiều Farm**.
- Một Farm Owner có thể có **nhiều Farmer / Farm Worker**.
- Farmer là user thuộc Tenant của Farm Owner, không phải tenant riêng.
- Platform Technician thuộc SmartFarm Platform và có thể hỗ trợ nhiều Tenant/Farm.

Ví dụ:

```text
Farm Owner A (Tenant A)
│
├── Farmer A1
├── Farmer A2
├── Farmer A3
│
├── Farm A
│   ├── Field 1
│   │   ├── Zone 1 – Tomato
│   │   └── Zone 2 – Chili
│   └── Field 2
│
└── Farm B
    └── Field 1
```

---

## 3. Bối cảnh và vấn đề

Nông nghiệp ngày càng ứng dụng công nghệ số để nâng cao năng suất, tối ưu tài nguyên và hỗ trợ canh tác bền vững. IoT, đặc biệt là LoRa, cho phép giám sát môi trường với phạm vi truyền xa và mức tiêu thụ năng lượng thấp, phù hợp với các khu vực canh tác phân tán.

Các giải pháp hiện có thường tập trung vào thu thập và trực quan hóa dữ liệu cảm biến nhưng còn hạn chế về:

- Quản lý trang trại tổng thể.
- Khả năng truy cập trên thiết bị di động.
- Quản lý thiết bị IoT tích hợp.
- Hỗ trợ ra quyết định thông minh.
- Liên kết dữ liệu cảm biến với hoạt động canh tác.

SmartFarm được đề xuất để tích hợp các năng lực này thành một nền tảng thống nhất.

---

## 4. Mục tiêu hệ thống

SmartFarm tích hợp:

- **LoRa-based IoT sensing**
- **Multi-tenant farm management**
- **Web Management Portal**
- **Cross-platform Mobile Application**
- **AI-assisted advisory**
- **Weather data integration**
- **Smart irrigation và environmental control**
- **Role-based access control**

Hệ thống cho phép:

1. Platform Admin quản trị platform.
2. Platform Technician hỗ trợ và bảo trì hạ tầng IoT.
3. Farm Owner quản lý một hoặc nhiều farm.
4. Farm Owner quản lý các Farmer/Farm Worker.
5. Farmer theo dõi và thực hiện các tác vụ trong phạm vi được phân quyền.
6. Quản lý field, zone, crop và planting season.
7. Quản lý gateway, LoRa node và sensor.
8. Thu thập dữ liệu môi trường theo thời gian thực từ nhiều sensor node.
9. Theo dõi lịch sử và xu hướng môi trường.
10. Điều khiển các thiết bị chấp hành.
11. Nhận cảnh báo khi điều kiện vượt ngưỡng.
12. Nhận tư vấn và khuyến nghị từ AI.
13. Theo dõi hoạt động và tài nguyên qua dashboard/report.

---

## 5. Mô hình phân cấp tài nguyên

```text
SmartFarm Platform
        │
     Tenant
   (Farm Owner)
        │
   ┌────┴────┐
  Farm     Farm
   │
 Field
   │
  Zone
   │
 Crop + Growth Stage
   │
 ┌─┴─────────────────┐
Sensor Nodes     Actuator Nodes
   │                   │
Sensors             Pump/Fan/Light
```

Một gateway có thể kết nối nhiều LoRa nodes; mỗi node có thể tích hợp nhiều sensor hoặc actuator.

---

## 6. Crop-aware Monitoring & Control

Một nguyên tắc cốt lõi của SmartFarm là:

> **Mỗi loại cây có growth profile khác nhau, vì vậy monitoring và control phải thích ứng theo Crop và Growth Stage.**

### Crop Profile

Mỗi crop có thể có:

- Growth stages.
- Khoảng độ ẩm đất khuyến nghị.
- Khoảng nhiệt độ.
- Khoảng độ ẩm không khí.
- Yêu cầu ánh sáng.
- Quy tắc tưới.
- Nhu cầu nước.
- Agricultural knowledge.

Ví dụ:

```text
Zone
 ↓
Crop = Tomato
 ↓
Growth Stage = Flowering
 ↓
Crop Profile
 ↓
Expected Environmental Range
 ↓
Sensor Data
 ↓
Monitoring / Alert / Control
```

Không nên áp dụng một rule cố định cho tất cả crop, ví dụ:

```text
soil moisture < 40% → Pump ON
```

Thay vào đó:

```text
Sensor Data
+
Crop Profile
+
Current Growth Stage
+
Weather
+
Configured Rules
        ↓
Decision Engine
        ↓
Monitoring / Recommendation / Control
```

Prototype nên giới hạn ở **2–3 loại crop định nghĩa trước**, nhưng architecture phải cho phép bổ sung crop mới mà không thay đổi business logic cốt lõi.

---

# 7. Bốn Core Flows

## CF1 – Tenant, Farm, Crop & IoT Setup

Thiết lập customer/tenant, farm, staff, crop và hạ tầng IoT.

```text
Farm Owner
     │
     ├── Manage Farmers / Farm Workers
     │
     ├── Create Farm
     │      ↓
     │    Field
     │      ↓
     │    Zone
     │      ↓
     │    Crop + Planting Season
     │
     └── IoT Setup
            ↓
        Gateway
            ↓
     Multiple Sensor / Actuator Nodes
            ↓
       Assign Nodes → Zone
            ↓
      Configure Crop Profile
            ↓
   Configure Monitoring / Control Rules
```

Platform Technician hỗ trợ phần technical:

```text
Platform Technician
       │
       ├── Register Gateway
       ├── Provision IoT Nodes
       ├── Configure Sensors
       ├── Assign Node → Zone
       └── Verify Connectivity
```

### Chức năng

- Tenant management.
- Farm management.
- Farmer/Farm Worker management.
- Field management.
- Crop management.
- Irrigation zone management.
- Planting season management.
- Gateway management.
- LoRa node management.
- Sensor management.
- Actuator management.
- Device configuration.
- Device health monitoring.
- Crop profile management.

---

## CF2 – Multi-tenant Multi-node Environmental Monitoring & Alert

```text
Multiple Sensor Nodes
        ↓ LoRa
    LoRa Gateway
        ↓ MQTT
 SmartFarm Backend
        ↓
 Time-series / PostgreSQL
        ↓
 Tenant / Farm / Zone Context
        ↓
 Crop Profile + Growth Stage
        ↓
 Dashboard + Monitoring + Alert Engine
```

### Dữ liệu

- Độ ẩm đất.
- Nhiệt độ.
- Độ ẩm không khí.
- Cường độ ánh sáng.
- Các cảm biến mở rộng tùy prototype.
- Weather data.

### Chức năng

- Real-time sensor monitoring.
- Historical environmental data.
- GIS-based node visualization.
- Interactive charts/reports.
- Crop-aware threshold configuration.
- Real-time notification.
- Alert acknowledgement.
- Alert history.
- Weather data integration.

### Multi-tenancy

Mọi dữ liệu business phải được giới hạn theo Tenant/Access Scope:

```text
Sensor Reading
 ├── tenant_id
 ├── farm_id
 ├── field_id
 ├── zone_id
 ├── node_id
 ├── sensor_id
 ├── timestamp
 └── value
```

Farm Owner/ Farmer chỉ được truy cập dữ liệu mà họ được phân quyền.

---

# 8. CF3 – Smart Environmental Control & Actuation

SmartFarm mở rộng Smart Irrigation thành **crop-aware environmental control**.

```text
Sensor Data
+
Crop Profile
+
Growth Stage
+
Schedule
+
Rules
+
Weather
+
AI Recommendation
        ↓
 Decision Engine
        ↓
 Control Command
        ↓
 LoRa Gateway
        ↓
 Actuator Node
        ↓
 ┌──────┬──────┬───────┐
 Pump   Valve   Fan   Grow Light
        ↓
 Status Feedback
```

### Sensors và Actuators

| Thông số | Sensor | Actuator phù hợp |
|---|---|---|
| Độ ẩm đất | Soil Moisture Sensor | Pump / Solenoid Valve |
| Nhiệt độ | Temperature Sensor | Fan |
| Độ ẩm không khí | Humidity Sensor | Fan / Misting |
| Ánh sáng | Light/Lux Sensor | Grow Light |
| Mưa | Rain Sensor / Weather API | Tác động đến quyết định tưới |
| Mực nước | Water Level Sensor | Water Pump |

### Prototype

**Sensors chính:**

- Soil Moisture
- Temperature
- Air Humidity
- Light Intensity

**Actuators chính:**

- Pump / Solenoid Valve
- Fan
- Grow Light

AI nên được định vị trước hết là **decision support/advisory**. Việc tự động điều khiển actuator nên dựa trên schedule/rule đã cấu hình hoặc cơ chế được kiểm soát rõ ràng.

---

# 9. CF4 – AI Advisory & Decision Support

AI phải hoạt động theo **tenant/farm/zone context** và access scope của user.

```text
Farm Owner / Farmer
        ↓
User Question / Request
        ↓
Access-controlled SmartFarm Context
        ↓
Farm / Zone / Crop / Growth Stage
        ↓
Sensor Data + Historical Data
        ↓
Weather
        ↓
Crop Profile + Agricultural Knowledge
        ↓
RAG / Semantic Search
        ↓
LLM / Gemini
        ↓
Explanation / Summary / Recommendation
        ↓
User
```

### Chức năng

- AI-powered semantic search.
- AI agricultural assistant.
- Giải thích dữ liệu sensor.
- Tóm tắt xu hướng môi trường.
- Khuyến nghị tưới.
- Hỗ trợ quyết định điều khiển môi trường.

Ví dụ:

> Farmer B hỏi: “Zone A có cần tưới hôm nay không?”

AI chỉ sử dụng dữ liệu của Zone A mà Farmer B được phép truy cập.

---

# 10. Weather Integration

Weather API là nguồn dữ liệu bên ngoài, không phải một core flow riêng.

Weather data được sử dụng trong:

- **CF2:** bổ sung bối cảnh môi trường.
- **CF3:** hỗ trợ quyết định điều khiển/tưới.
- **CF4:** làm context cho AI recommendation.

Dữ liệu hữu ích:

- Nhiệt độ.
- Độ ẩm.
- Điều kiện thời tiết.
- Dự báo mưa/lượng mưa.
- Forecast trong vài giờ/ngày tới.

Ví dụ:

```text
Soil Moisture thấp
        +
Rain forecast sắp xảy ra
        ↓
AI / Decision Engine
        ↓
Khuyến nghị trì hoãn tưới
```

---

# 11. Sensors, Nodes, Gateway và Actuators

## Sensor Node

Một LoRa node có thể tích hợp nhiều sensor:

```text
Sensor Node 01
 ├── Soil Moisture
 ├── Temperature
 ├── Humidity
 └── Light
       ↓
     LoRa
       ↓
 LoRa Gateway
```

Nhiều nodes cùng gửi dữ liệu về một gateway:

```text
Node 01 ─┐
Node 02 ─┤
Node 03 ─┼──→ LoRa Gateway → MQTT → Backend
Node 04 ─┤
Node N  ─┘
```

## Actuator Node

```text
Backend
   ↓ MQTT
Gateway
   ↓ LoRa
Actuator Node
   ├── Relay → Pump
   ├── Relay → Fan
   └── Relay → Grow Light
```

### Mapping cần lưu

- Gateway ↔ nhiều nodes.
- Node → Farm / Field / Zone.
- Sensor → Node.
- Sensor reading → Node/Sensor/Zone.
- Actuator → Node/Zone.
- Command → Actuator.
- Status feedback → Backend.

---

# 12. Device Provisioning – Technical Sub-flow

Device provisioning là technical sub-flow hỗ trợ CF1, không phải core business flow riêng.

```text
ESP32 Boot
   ↓
Captive Portal
   ↓
Configure WiFi / MQTT / Node ID
   ↓
Save to NVS
   ↓
Connect MQTT
   ↓
Register Device to Backend
   ↓
Device Ready
```

Platform Technician là actor chính trong các hoạt động provisioning, configuration, diagnosis và maintenance.

---

# 13. User & Access Control

## Role model

```text
Platform
│
├── Platform Admin
│
└── Platform Technician

Tenant
│
└── Farm Owner
      │
      └── Farmer / Farm Worker
```

### Access principles

- Platform Admin có quyền quản trị platform.
- Platform Technician có quyền technical support đối với các device/gateway được phân công hoặc được phép truy cập.
- Farm Owner quản lý tenant của mình.
- Farm Owner có thể quản lý nhiều farm.
- Farm Owner có thể quản lý nhiều Farmer/Farm Worker.
- Farmer chỉ truy cập farm/field/zone được phân quyền.
- Farmer không phải Tenant riêng.
- Dữ liệu giữa các Tenant phải được isolation.
- Các hoạt động quan trọng cần được audit log.

---

# 14. Functional Requirements

## User & Security

- Authentication.
- RBAC.
- User profile.
- Multi-tenant authorization.
- Farm/Field/Zone access scope.
- Audit logging.

## Tenant & Farm Management

- Farm Owner/Tenant.
- Farm.
- Field.
- Crop.
- Irrigation/Growing Zone.
- Planting Season.
- Farmer/Farm Worker management.
- Crop Profile.
- Growth Stage.

## Device Management

- LoRa node.
- Gateway.
- Sensor.
- Actuator.
- Device configuration.
- OTA firmware update.
- Device health.
- Device provisioning.

## Environmental Monitoring

- Real-time monitoring.
- Weather integration.
- Historical data.
- GIS node visualization.
- Charts/reports.
- Crop-aware monitoring.

## Smart Irrigation / Environmental Control

- Manual control.
- Automatic scheduling.
- Rule-based control.
- Irrigation history.
- Water consumption monitoring.
- Pump/valve/fan/light control.
- Crop-aware control.

## Alert Management

- Threshold configuration.
- Crop/growth-stage-aware thresholds.
- Real-time notifications.
- Alert acknowledgement.
- Alert history.

## AI Services

- Semantic search.
- Agricultural assistant.
- Sensor explanation.
- Irrigation recommendation.
- Environmental trend summarization.
- Decision support.

## Dashboard & Reporting

- Farm dashboard.
- Device dashboard.
- Environmental dashboard.
- Irrigation statistics.
- Resource consumption reports.
- Excel/PDF export.

## Platform Administration

- Tenant management.
- Platform user management.
- Technician management.
- Device/platform management.
- Audit logging.
- Backup & restore.

---

# 15. Proposed Architecture

```text
┌──────────────────────────────────────────────┐
│                  Clients                     │
│ Web Management Portal | Flutter Mobile App  │
└──────────────────────┬───────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────┐
│             ASP.NET Core Backend             │
│ Auth | Tenant | Farm | Device | Monitoring  │
│ Alert | Control | AI Context | Reporting    │
└───────────────┬──────────────┬───────────────┘
                │              │
              MQTT           REST API
                │              │
       ┌────────▼──────┐   ┌───▼──────────┐
       │ LoRa Gateway  │   │ AI Service   │
       └───────┬───────┘   └──────────────┘
               │ LoRa
        ┌──────┼──────┐
        ↓      ↓      ↓
      Node   Node   Node ... N
        │
   Sensors / Actuators
```

### Multi-tenant application layer

Backend phải xử lý:

```text
Request
  ↓
Authentication
  ↓
User / Role
  ↓
Tenant
  ↓
Farm / Field / Zone Scope
  ↓
Business Operation
```

---

# 16. Technology Stack

Theo proposal:

- **Web:** Responsive Web Application.
- **Mobile:** Flutter.
- **Backend:** ASP.NET Core.
- **API:** RESTful API.
- **Authentication:** JWT.
- **IoT communication:** LoRa.
- **Messaging:** MQTT.
- **Database:** PostgreSQL.
- **Deployment:** Docker.
- **AI:** AI Service integration via RESTful APIs.
- **Architecture:** Modular Software Architecture.

---

# 17. Expected Deliverables

1. SmartFarm Web Management Portal.
2. SmartFarm Mobile Application.
3. Multi-tenant Farm Management Module.
4. User & RBAC Module.
5. Farmer/Farm Worker Management.
6. Device Management Module.
7. Environmental Monitoring Module.
8. Smart Irrigation / Environmental Control Module.
9. Crop Profile & Growth Stage Module.
10. AI Assistant Module.
11. Dashboard & Reporting Module.
12. RESTful API Services.
13. Docker Deployment Package.
14. Software Documentation.

---

# 18. Work Packages

## WP1 – Requirements Analysis & System Design

- Requirement elicitation.
- Stakeholder/actor analysis.
- Multi-tenant business process modelling.
- RBAC and access-scope design.
- Software architecture.
- Database design.
- UI/UX.
- REST API specification.

## WP2 – IoT Platform & Farm Management

- LoRa integration.
- Device management.
- Farm management.
- Tenant management.
- Farmer management.
- Environmental monitoring.
- Alert management.
- Crop Profile / Growth Stage.

## WP3 – Mobile Application & AI Integration

- Flutter mobile application.
- AI Assistant.
- Semantic search.
- Agricultural recommendation services.
- Weather integration.
- Context-aware AI.

## WP4 – Dashboard & Analytics

- Dashboard.
- Environmental analytics.
- Resource consumption statistics.
- Data visualization.
- Report generation.

## WP5 – Testing & Deployment

- System integration.
- Functional testing.
- Multi-tenant isolation testing.
- RBAC testing.
- Performance testing.
- Docker deployment.
- User documentation.

---

# 19. Overall Core Loop

```text
CF1
Tenant / Farm / Crop / Zone / IoT Setup
              ↓
CF2
Multi-tenant Multi-node Monitoring & Alert
              ↓
CF4
AI Advisory & Decision Support
              ↓
CF3
Crop-aware Environmental Control & Actuation
              ↓
Environment changes
              ↓
CF2
New sensor data
              ↺
```

## Supporting technical flow

```text
Platform Technician
        ↓
Device Provisioning / Maintenance
        ↓
IoT Infrastructure
        ↓
CF2 Monitoring
```

---

# 20. Key Concept

SmartFarm không chỉ là hệ thống thu thập dữ liệu sensor.

Đây là một **multi-tenant smart agriculture platform** trong đó:

- **Multiple Farm Owners** sử dụng cùng một platform.
- Mỗi Farm Owner có thể có **multiple Farms**.
- Mỗi Farm Owner có **multiple Farmers/Farm Workers**.
- **Platform Technicians** hỗ trợ và bảo trì hạ tầng IoT.
- Mỗi Farm có nhiều Field/Zone.
- Mỗi Zone có Crop và Growth Stage.
- Một Gateway kết nối nhiều LoRa Nodes.
- Một Node có thể có nhiều Sensors/Actuators.
- Monitoring và Control phụ thuộc vào **Crop Profile + Growth Stage**.
- Weather bổ sung context cho monitoring, control và AI.
- AI cung cấp **decision support/advisory**.
- Rules/Automation thực hiện control có kiểm soát.
- Multi-tenant isolation bảo vệ dữ liệu giữa các Farm Owners.

### SmartFarm closed loop

> **Sense → Monitor → Understand → Decide → Act → Monitor again**

Trong đó:

- **LoRa + Multiple Sensor Nodes** = IoT sensing infrastructure.
- **Backend + Database** = multi-tenant data platform.
- **Rules/Automation + Actuators** = environmental control.
- **Crop Profile + Growth Stage** = crop-aware intelligence.
- **AI + Weather + Agricultural Knowledge** = decision support.
- **RBAC + Tenant/Access Scope** = secure multi-user SaaS operation.
- **Platform Technician** = technical operation and IoT maintenance.


## AI Chatbot & Context-aware Farm Advisory

SmartFarm should include an AI chatbot as the user-facing interface for agricultural advisory. The chatbot is not merely a generic LLM chatbot; it should use the context of the authenticated user, tenant, farm, zone, crop, growth stage, IoT data, historical data, weather information, and agricultural knowledge.

### Core chatbot capabilities

- Farm/zone status questions.
- Crop-care and growth-stage advice.
- IoT data analysis and explanation.
- Weather-aware recommendations.
- Alert explanation.
- Irrigation and environmental-control recommendations.
- Historical trend summarization.

### Context-aware AI flow

```text
User
  ↓
AI Chatbot
  ↓
User / Tenant Context
  ↓
Farm / Zone / Crop / Growth Stage
  ↓
Retrieve Context
  ├── Real-time IoT Data
  ├── Historical Data
  ├── Weather
  ├── Crop Profile
  └── Agricultural Knowledge
  ↓
RAG + LLM
  ↓
Answer / Explanation / Recommendation
  ↓
User
```

### AI and access control

The chatbot must respect RBAC and tenant isolation.

- Farm Owner can query farms belonging to their tenant.
- Farmer/Farm Worker can query only farms/zones they are authorized to access.
- Platform Technician can use AI for technical/device diagnostics within the scope of assigned support.
- AI must not expose another tenant's data.

### AI recommendation versus automatic control

In the initial implementation, AI should primarily provide recommendations. It should not directly actuate pumps, fans, or lights from a chatbot conversation.

```text
AI Recommendation
      ↓
User Approval
      ↓
Control Command
      ↓
Actuator
```

Automatic environmental control should instead be handled by configured schedules/rules and the control engine.


## User and Role Model

SmartFarm is a multi-tenant SaaS platform.

### Platform-level roles

- **Platform Admin** — manages the SmartFarm platform, tenants, users, services, and system configuration.
- **Platform Technician** — installs, provisions, configures, monitors, diagnoses, and maintains IoT gateways/nodes for supported tenants.

### Tenant-level roles

- **Farm Owner** — the customer/tenant who owns one or more farms and manages farmers/staff, farm resources, crops, operations, and authorized data.
- **Farmer / Farm Worker** — employees/workers of a Farm Owner who perform farm activities and access only the farms/zones/resources assigned to them.

> **Farm Manager is not included in the project scope.**

### Organization hierarchy

```text
SmartFarm Platform
│
├── Platform Admin
├── Platform Technician
│
└── Farm Owner / Tenant
      ├── Farmer / Farm Worker
      ├── Farm
      │    ├── Field
      │    │    └── Zone
      │    │         └── Crop + Growth Stage
      │    ├── LoRa Gateway
      │    ├── Sensor Nodes
      │    └── Actuator Nodes
      └── ...
```
