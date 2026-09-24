# API catalog

Copied from the numbered index in `reference/API .docx`. Detailed request, response, validation and business rules remain in that document. Intentional Auth/User/Tenant v1 differences are normative in `AUTH_CONTRACT_V1.md`. The headings elsewhere say 102; the numbered index has 103.

The code audit and status of every numbered endpoint is maintained in [`ENDPOINT_STATUS.md`](ENDPOINT_STATUS.md). Status is based on a concrete controller action plus non-placeholder application/infrastructure behavior, not route presence alone.

| # | Method | Path | Group | Actor |
| ---: | --- | --- | --- | --- |
| 1 | POST | `/api/v1/auth/login` | Auth | All registered roles |
| 2 | POST | `/api/v1/auth/logout` | Auth | All roles |
| 3 | POST | `/api/v1/auth/refresh` | Auth | All roles |
| 4 | POST | `/api/v1/auth/forgot-password` | Auth | All roles |
| 5 | POST | `/api/v1/auth/reset-password` | Auth | All roles |
| 6 | GET | `/api/v1/users` | User | FarmOwner |
| 7 | GET | `/api/v1/users/{userId}` | User | FarmOwner |
| 8 | PUT | `/api/v1/users/{userId}` | User | FarmOwner |
| 9 | DELETE | `/api/v1/users/{userId}` | User | FarmOwner |
| 10 | POST | `/api/v1/users/invite` | User | FarmOwner |
| 11 | GET | `/api/v1/users/me` | User | All roles |
| 12 | PUT | `/api/v1/users/me/password` | User | All roles |
| 13 | POST | `/api/v1/tenants/register` | Tenant | FarmOwner without Tenant |
| 14 | GET | `/api/v1/tenants/me` | Tenant | FarmOwner |
| 15 | PUT | `/api/v1/tenants/me` | Tenant | FarmOwner |
| 16 | GET | `/api/v1/farms` | Farm | FarmOwner |
| 17 | POST | `/api/v1/farms` | Farm | FarmOwner |
| 18 | GET | `/api/v1/farms/{farmId}` | Farm | FarmOwner |
| 19 | PUT | `/api/v1/farms/{farmId}` | Farm | FarmOwner |
| 20 | DELETE | `/api/v1/farms/{farmId}` | Farm | FarmOwner |
| 21 | GET | `/api/v1/farms/{farmId}/structure` | Farm | FarmOwner |
| 22 | POST | `/api/v1/farms/{farmId}/submit` | Farm | FarmOwner |
| 23 | GET | `/api/v1/farms/{farmId}/fields` | Field | FarmOwner |
| 24 | POST | `/api/v1/farms/{farmId}/fields` | Field | FarmOwner |
| 25 | GET | `/api/v1/fields/{fieldId}` | Field | FarmOwner |
| 26 | PUT | `/api/v1/fields/{fieldId}` | Field | FarmOwner |
| 27 | DELETE | `/api/v1/fields/{fieldId}` | Field | FarmOwner |
| 28 | GET | `/api/v1/fields/{fieldId}/zones` | Zone | FarmOwner |
| 29 | POST | `/api/v1/fields/{fieldId}/zones` | Zone | FarmOwner |
| 30 | GET | `/api/v1/zones/{zoneId}` | Zone | FarmOwner |
| 31 | PUT | `/api/v1/zones/{zoneId}` | Zone | FarmOwner |
| 32 | DELETE | `/api/v1/zones/{zoneId}` | Zone | FarmOwner |
| 33 | GET | `/api/v1/crops` | Crop | All roles |
| 34 | POST | `/api/v1/crops` | Crop | FarmOwner / Admin |
| 35 | GET | `/api/v1/crops/{cropId}/varieties` | CropVariety | All roles |
| 36 | POST | `/api/v1/crops/{cropId}/varieties` | CropVariety | FarmOwner / Admin |
| 37 | GET | `/api/v1/crops/{cropId}/growth-profiles` | GrowthProfile | All roles |
| 38 | POST | `/api/v1/growth-profiles` | GrowthProfile | FarmOwner / Admin |
| 39 | GET | `/api/v1/growth-profiles/{profileId}/stages` | GrowthStage | All roles |
| 40 | PUT | `/api/v1/growth-stages/{stageId}/requirements` | EnvRequirement | FarmOwner / Admin |
| 41 | GET | `/api/v1/zones/{zoneId}/planting-seasons` | Season | FarmOwner / Farmer |
| 42 | POST | `/api/v1/zones/{zoneId}/planting-seasons` | Season | FarmOwner |
| 43 | GET | `/api/v1/zones/{zoneId}/planting-seasons/{seasonId}` | Season | FarmOwner / Farmer |
| 44 | PUT | `/api/v1/zones/{zoneId}/planting-seasons/{seasonId}/stage` | Season | FarmOwner |
| 45 | PUT | `/api/v1/zones/{zoneId}/planting-seasons/{seasonId}/close` | Season | FarmOwner |
| 46 | GET | `/api/v1/zones/{zoneId}/alert-rules` | AlertRule | FarmOwner / Farmer |
| 47 | POST | `/api/v1/zones/{zoneId}/alert-rules` | AlertRule | FarmOwner |
| 48 | PUT | `/api/v1/zones/{zoneId}/alert-rules/{ruleId}` | AlertRule | FarmOwner |
| 49 | DELETE | `/api/v1/zones/{zoneId}/alert-rules/{ruleId}` | AlertRule | FarmOwner |
| 50 | GET | `/api/v1/zones/{zoneId}/schedules` | Schedule | FarmOwner / Farmer |
| 51 | POST | `/api/v1/zones/{zoneId}/schedules` | Schedule | FarmOwner |
| 52 | PUT | `/api/v1/zones/{zoneId}/schedules/{scheduleId}` | Schedule | FarmOwner |
| 53 | DELETE | `/api/v1/zones/{zoneId}/schedules/{scheduleId}` | Schedule | FarmOwner |
| 54 | GET | `/api/v1/farms/{farmId}/gateways` | Gateway | FarmOwner |
| 55 | POST | `/api/v1/gateways` | Gateway | PlatformTechnician |
| 56 | GET | `/api/v1/gateways/{gatewayId}` | Gateway | FarmOwner / Technician |
| 57 | PUT | `/api/v1/gateways/{gatewayId}/firmware` | Gateway | PlatformTechnician |
| 58 | GET | `/api/v1/farms/{farmId}/devices` | Device | FarmOwner / Technician |
| 59 | GET | `/api/v1/zones/{zoneId}/devices` | Device | FarmOwner |
| 60 | GET | `/api/v1/devices/{deviceId}` | Device | FarmOwner / Technician |
| 61 | POST | `/api/v1/devices/provision` | Device | PlatformTechnician |
| 62 | PUT | `/api/v1/devices/{deviceId}/sensors` | Device | PlatformTechnician |
| 63 | PUT | `/api/v1/devices/{deviceId}/actuators` | Device | PlatformTechnician |
| 64 | POST | `/api/v1/zones/{zoneId}/devices/{deviceId}/assign` | Device | PlatformTechnician |
| 65 | POST | `/api/v1/zones/{zoneId}/devices/{deviceId}/unassign` | Device | PlatformTechnician |
| 66 | GET | `/api/v1/devices/{deviceId}/ping` | Device | PlatformTechnician |
| 67 | POST | `/api/v1/devices/{deviceId}/diagnose` | Device | PlatformTechnician |
| 68 | DELETE | `/api/v1/devices/{deviceId}` | Device | PlatformTechnician |
| 69 | GET | `/api/v1/zones/{zoneId}/telemetry/latest` | Telemetry | FarmOwner / Farmer |
| 70 | GET | `/api/v1/zones/{zoneId}/telemetry/history` | Telemetry | FarmOwner / Farmer |
| 71 | GET | `/api/v1/zones/{zoneId}/telemetry/stats` | Telemetry | FarmOwner |
| 72 | GET | `/api/v1/farms/{farmId}/alerts` | Alert | FarmOwner / Farmer |
| 73 | GET | `/api/v1/zones/{zoneId}/alerts` | Alert | FarmOwner / Farmer |
| 74 | GET | `/api/v1/alerts/{alertId}` | Alert | FarmOwner / Farmer |
| 75 | PUT | `/api/v1/alerts/{alertId}/acknowledge` | Alert | FarmOwner / Farmer |
| 76 | POST | `/api/v1/zones/{zoneId}/rules` | AutoRule | FarmOwner |
| 77 | GET | `/api/v1/zones/{zoneId}/rules` | AutoRule | FarmOwner / Farmer |
| 78 | PUT | `/api/v1/zones/{zoneId}/rules/{ruleId}` | AutoRule | FarmOwner |
| 79 | DELETE | `/api/v1/zones/{zoneId}/rules/{ruleId}` | AutoRule | FarmOwner |
| 80 | POST | `/api/v1/zones/{zoneId}/actuators/{actuatorId}/command` | Control | FarmOwner |
| 81 | GET | `/api/v1/zones/{zoneId}/actuators/{actuatorId}/status` | Control | FarmOwner |
| 82 | DELETE | `/api/v1/zones/{zoneId}/commands/{commandId}` | Control | FarmOwner |
| 83 | GET | `/api/v1/zones/{zoneId}/actuators/history` | Control | FarmOwner |
| 84 | GET | `/api/v1/zones/{zoneId}/ai/context` | AI | FarmOwner |
| 85 | POST | `/api/v1/zones/{zoneId}/ai/ask` | AI | FarmOwner |
| 86 | POST | `/api/v1/zones/{zoneId}/ai/apply-recommendation` | AI | FarmOwner |
| 87 | GET | `/api/v1/zones/{zoneId}/ai/history` | AI | FarmOwner |
| 88 | DELETE | `/api/v1/zones/{zoneId}/ai/history` | AI | FarmOwner |
| 89 | GET | `/api/v1/ai/knowledge-base` | AI | PlatformAdmin |
| 90 | POST | `/api/v1/ai/knowledge-base` | AI | PlatformAdmin |
| 91 | GET | `/api/v1/farms/{farmId}/report/overview` | Report | FarmOwner |
| 92 | GET | `/api/v1/zones/{zoneId}/report/season-summary` | Report | FarmOwner |
| 93 | GET | `/api/v1/farms/{farmId}/report/water-usage` | Report | FarmOwner |
| 94 | GET | `/api/v1/farms/{farmId}/report/electricity` | Report | FarmOwner |
| 95 | POST | `/api/v1/zones/{zoneId}/devices/{oldDeviceId}/hot-swap` | Support | PlatformTechnician |
| 96 | GET | `/api/v1/farms/{farmId}/inventory` | Support | FarmOwner / Farmer |
| 97 | POST | `/api/v1/farms/{farmId}/inventory` | Support | FarmOwner |
| 98 | POST | `/api/v1/farms/{farmId}/inventory/issues` | Support | FarmOwner / Farmer |
| 99 | GET | `/api/v1/farms/{farmId}/tasks` | Support | FarmOwner / Farmer |
| 100 | POST | `/api/v1/farms/{farmId}/tasks` | Support | FarmOwner |
| 101 | PUT | `/api/v1/farms/{farmId}/tasks/{taskId}` | Support | FarmOwner / Farmer |
| 102 | GET | `/api/v1/farms/{farmId}/cash-flow-report` | Support | FarmOwner |
| 103 | GET | `/api/v1/farms/{farmId}/weather/forecast` | Weather | FarmOwner / Farmer |

## Auth v1 additions without source-index renumbering

| Contract ID | Method | Path | Actor | Purpose |
| --- | --- | --- | --- | --- |
| AUTH-V1-01 | POST | `/api/v1/auth/register` | Anonymous | Self-register an unassigned FarmOwner or Farmer account |
| USER-V1-01 | PUT | `/api/v1/users/{userId}/zone-access` | FarmOwner | Replace a Farmer's Zone access inside their assigned Farm |
| INVENTORY-V1-01 | POST | `/api/v1/farms/{farmId}/inventory/{itemId}/receipts` | FarmOwner | Receive stock with an audited movement |
| INVENTORY-V1-02 | PUT | `/api/v1/farms/{farmId}/inventory/{itemId}/requirements` | FarmOwner | Link material need to Crop, Variety, or Growth Stage |
| INVENTORY-V1-03 | GET | `/api/v1/farms/{farmId}/inventory/low-stock-alerts` | FarmOwner | List low-stock alert lifecycle |
| FINANCE-V1-01..05 | GET/POST/PUT/DELETE | `/api/v1/farms/{farmId}/finance/...` | FarmOwner | Auditable income and expense CRUD |
| SERVICE-V1-01 | POST | `/api/v1/farms/{farmId}/service-requests` | FarmOwner | Open a Device service request |
| SERVICE-V1-02..09 | GET/POST | `/api/v1/service-requests/...` | FarmOwner / PlatformAdmin / PlatformTechnician | Assignment, diagnosis, work, replacement, verification and closure |
| REPORT-V1-01 | GET | `/api/v1/farms/{farmId}/report/inventory` | FarmOwner | Inventory balance and movement report |
| REPORT-V1-02 | GET | `/api/v1/farms/{farmId}/report/tasks` | FarmOwner | Task outcome and workload report |
| REPORT-V1-03 | GET | `/api/v1/farms/{farmId}/report/maintenance` | FarmOwner | Service lifecycle and replacement history report |

Farm/Field/Zone implementation details, GeoJSON boundary storage and intentional differences for endpoints #16-#32 are defined in `FARM_STRUCTURE_CONTRACT_V1.md`. Endpoint #22 remains deferred until the planting-season and IoT provisioning slices exist.
Crop/Growth/Season implementation details and the system-profile clone contract for endpoints #33-#45 are defined in `CROP_GROWTH_CONTRACT_V1.md`.
Inventory and Task state transitions for endpoints #96-#101 and the three v1 additions are defined in `INVENTORY_TASK_CONTRACT_V1.md`.

## IoT deployment v1 additions without source-index renumbering

Flow 1 planning, survey, installation and failure handoff endpoints `IOT-V1-01` through `IOT-V1-15` are defined in `IOT_DEPLOYMENT_CONTRACT_V1.md`. Source Gateway/Device endpoints #54–#68 remain indexed and are constrained by that workflow where they mutate hardware.

## Telemetry v1 addition without source-index renumbering

Telemetry ingestion, current-stage anti-flap semantics, Farmer Zone access and freshness are defined in `TELEMETRY_ALERT_CONTRACT_V1.md`. It is normative for endpoints #46–#49 and #69–#75.

| Contract ID | Method | Path | Actor | Purpose |
| --- | --- | --- | --- | --- |
| ALERT-V1-01 | PUT | `/api/v1/alerts/{alertId}/resolve` | FarmOwner / assigned Farmer | Record action, resolve the alert and append history |

## Control v1 normalization

Asynchronous status, feedback authentication, schedule cron semantics, rule evaluation, Farmer Zone control and command history for endpoints #50–#53 and #76–#83 are defined in `CONTROL_CONTRACT_V1.md`.

## AI recommendation v1 normalization

Server-built context, explicit uncertainty, persisted Owner decisions, rate limiting and the Owner-approved handoff to Phase 7 for endpoints #84-#88 are defined in `AI_RECOMMENDATION_CONTRACT_V1.md`. Endpoint #86 does not directly prove or perform irrigation; it creates an asynchronous `AI_APPROVED` control command only after valid Owner acceptance. Knowledge-base endpoints #89-#90 remain deferred pending pgvector and ingestion-security decisions.

| PLATFORM-V1-01 | GET | `/api/v1/platform/technicians` | PlatformAdmin | List PlatformTechnician accounts |
| PLATFORM-V1-02 | POST | `/api/v1/platform/technicians` | PlatformAdmin | Create a PlatformTechnician account without returning password material |
| PLATFORM-V1-03 | PUT | `/api/v1/platform/technicians/{userId}` | PlatformAdmin | Update or disable a PlatformTechnician account |
