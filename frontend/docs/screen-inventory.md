# SmartFarm Complete Screen Inventory

This document defines the 100% complete screen inventory across all 4 roles in the SmartFarm SaaS Platform.

---

## 1. Authentication & Onboarding Screens (Shared)
| Screen ID | Role | Route | Screen Name | Key Components & Purpose |
|---|---|---|---|---|
| AUTH-01 | All | `/login` | Login & Role Switcher | Login form + Quick Dev Role Switcher buttons (Admin, Technician, Owner, Farmer) |
| AUTH-02 | All | `/forgot-password` | Forgot Password | Email recovery request form |
| AUTH-03 | All | `/reset-password` | Reset Password | Token-based new password setup |
| AUTH-04 | All | `/profile` | Profile & Account | User profile settings, change password, MFA options |
| AUTH-05 | All | `/401` | Unauthorized | 401 Error feedback state |
| AUTH-06 | All | `/403` | Forbidden Scope | 403 Tenant/Role restricted feedback state |
| AUTH-07 | All | `/404` | Not Found | 404 Route not found state |

---

## 2. Role 1 — Platform Admin Screens (`/admin/*`)
| Screen ID | Role | Route | Screen Name | Key Components & Purpose |
|---|---|---|---|---|
| ADM-01 | Admin | `/admin/dashboard` | Platform Admin Dashboard | Platform KPIs (Tenants, Active Farms, Total Users, Gateways, Health, Sensor Volume), Activity log, Tenant Growth chart |
| ADM-02 | Admin | `/admin/tenants` | Tenant List | DataTable of SaaS Tenants with search, filter, status toggle & tenant creation modal |
| ADM-03 | Admin | `/admin/tenants/:id` | Tenant Details | Tenant statistics, associated farms, owner contacts, subscription status |
| ADM-04 | Admin | `/admin/users` | Platform User Management | Global user list, role assignments, user status management |
| ADM-05 | Admin | `/admin/crops` | System Crop Library | System-wide crops list (Tomato, Chili, Lettuce, Cucumber), crop properties & creation form |
| ADM-06 | Admin | `/admin/crops/:id` | Crop Detail | Varieties under crop, default growth profiles, agricultural knowledge base |
| ADM-07 | Admin | `/admin/varieties` | Crop Varieties | List of crop varieties across system crops |
| ADM-08 | Admin | `/admin/growth-profiles` | System Growth Profiles | Master growth profiles & stages configuration |
| ADM-09 | Admin | `/admin/growth-profiles/:id` | Growth Profile Detail | Order of stages, duration in days, environmental requirements editor |
| ADM-10 | Admin | `/admin/environmental-requirements` | Global Env Parameters | Master library of measurement types (Soil Moisture, Temp, Humidity, Light, EC, pH) & units |
| ADM-11 | Admin | `/admin/devices` | Global Device Catalog | Master device types (Gateways, Sensor Nodes, Actuators, Sensor types) |
| ADM-12 | Admin | `/admin/system-health` | Server & IoT Health | System resource usage, MQTT broker status, database latency, SignalR connections |
| ADM-13 | Admin | `/admin/audit-logs` | Platform Audit Logs | Global system activity stream with JSON diff viewer & user IP tracking |
| ADM-14 | Admin | `/admin/reports` | Platform SaaS Analytics | Tenant adoption reports, API usage metrics, global sensor telemetry stats |
| ADM-15 | Admin | `/admin/settings` | Platform Settings | Global SaaS configuration, mail settings, weather API credentials, Gemini API key |

---

## 3. Role 2 — Platform Technician Screens (`/technician/*`)
| Screen ID | Role | Route | Screen Name | Key Components & Purpose |
|---|---|---|---|---|
| TEC-01 | Tech | `/technician/dashboard` | Technician Operations Hub | Pending deployments, offline gateways/nodes, weak RSSI devices, low battery alerts, maintenance queue |
| TEC-02 | Tech | `/technician/deployments` | Deployment Requests | Queue of farm deployment requests from Farm Owners |
| TEC-03 | Tech | `/technician/deployments/:id` | Deployment Inspection | Requested vs confirmed hardware quantities, field inspection notes, approval action |
| TEC-04 | Tech | `/technician/provisioning` | Device Provisioning Wizard | Scanning MAC/Serial, LoRa 433MHz frequency binding, Captive Portal status, Gateway whitelist registration |
| TEC-05 | Tech | `/technician/gateways` | Gateway Management | List of physical ESP32 LoRa gateways, MAC addresses, firmware version, RSSI & last ping |
| TEC-06 | Tech | `/technician/gateways/:id` | Gateway Diagnostics | Connected nodes spectrum, MQTT connection status, raw payload logs, firmware flash modal |
| TEC-07 | Tech | `/technician/devices` | IoT Node Inventory | Full list of sensor nodes & actuator nodes across farms with battery levels & signal quality |
| TEC-08 | Tech | `/technician/devices/:id/diagnostics` | Node Hardware Diagnostics | Sensor calibration, relay test triggers, battery voltage curve, packet loss metrics |
| TEC-09 | Tech | `/technician/maintenance` | Maintenance & Repair | Service requests list assigned to technician, diagnostic logs & action reports |
| TEC-10 | Tech | `/technician/replacements` | Hardware Hot-Swap | 1-to-1 node/sensor replacement workflow, updating node IDs without losing historical telemetry |
| TEC-11 | Tech | `/technician/inventory` | Spare Parts Inventory | Spare gateways, LoRa chips, soil moisture sensors, relays, valves stock |
| TEC-12 | Tech | `/technician/reports` | Technical Service Summary | Field service completion reports, hardware failure rate charts |

---

## 4. Role 3 — Farm Owner Screens (`/owner/*`)
| Screen ID | Role | Route | Screen Name | Key Components & Purpose |
|---|---|---|---|---|
| OWN-01 | Owner | `/owner/dashboard` | Farm Owner Command Center | Context selector (Farm/Field/Zone), Live Environmental KPI cards, Urgent Alerts, Irrigation Status, Weather Widget, AI Recommendations, Farm GIS Map |
| OWN-02 | Owner | `/owner/farms` | Farm List | Grid/Table of owned farms with total fields, zones, devices, crop status |
| OWN-03 | Owner | `/owner/farms/create` | Multi-step Farm Setup | 8-step wizard: Basic info -> GPS -> Area -> Field -> Zone -> Crop -> Season -> IoT Request |
| OWN-04 | Owner | `/owner/farms/:id` | Farm Overview & Tabs | Multi-tab view: Overview, Fields, Zones, Crops, Devices, Telemetry, Control, Reports |
| OWN-05 | Owner | `/owner/fields` | Field Management | Fields list, total area, boundary coordinates, assigned zones |
| OWN-06 | Owner | `/owner/zones` | Zone Management | Growing zones (Greenhouses, open fields), active crop, current stage, environmental target ranges |
| OWN-07 | Owner | `/owner/zones/:id` | Zone Deep Dive | 360-degree zone view: Live telemetry, crop stage progress, active sensors, relays, control rules |
| OWN-08 | Owner | `/owner/crops` | Farm Crop Catalog | Crops cultivated on farm, variety selection, customized growth profiles |
| OWN-09 | Owner | `/owner/planting-seasons` | Planting Seasons | Active & historical planting seasons, crop growth stage progression timeline |
| OWN-10 | Owner | `/owner/planting-seasons/create` | New Season Form | Assign crop, variety, profile, zone, start date & expected yield |
| OWN-11 | Owner | `/owner/monitoring/realtime` | Real-time Telemetry | Live sensor metrics, threshold indicators, sparklines, online/offline sensor nodes |
| OWN-12 | Owner | `/owner/monitoring/history` | Historical Analytics | Multi-sensor comparative charts (Temp vs Soil Moisture vs Humidity), date range picker, CSV/Excel export |
| OWN-13 | Owner | `/owner/map` | Farm GIS Map View | Fullscreen Leaflet map displaying Farm boundary, Fields, Zones, Gateways, Nodes, click popups |
| OWN-14 | Owner | `/owner/alerts` | Alert Center | Active & resolved environmental alerts, threshold breach details, direct "Ask AI" button |
| OWN-15 | Owner | `/owner/alerts/rules` | Alert Rules Engine | Custom threshold rules per zone & growth stage (Min/Max limits, severity levels) |
| OWN-16 | Owner | `/owner/control` | Environmental & Irrigation Control | Manual pump/valve/fan/light override buttons with safety confirmations & real-time status feedback |
| OWN-17 | Owner | `/owner/schedules` | Irrigation Schedules | Cron-based and calendar-based irrigation timers per zone with start time, duration & days |
| OWN-18 | Owner | `/owner/automation` | Crop-Aware Rule Builder | Visual WHEN-IF-THEN rule editor (e.g. WHEN Soil Moisture < 45% AND Weather != Rain THEN Pump ON for 15 mins) |
| OWN-19 | Owner | `/owner/farmers` | Farm Worker Staff Management | List of hired farmers, employee codes, assigned farm & zone access permissions |
| OWN-20 | Owner | `/owner/farmers/create` | Invite / Create Worker | Worker profile setup & zone authorization checkboxes |
| OWN-21 | Owner | `/owner/tasks` | Work Order Management | Farm tasks list, priority, due date, assigned farmer, status (Pending, In Progress, Done) |
| OWN-22 | Owner | `/owner/inventory` | Farm Inventory | Seeds, fertilizers, pesticides, media stock levels, minimum stock alerts, usage log |
| OWN-23 | Owner | `/owner/ai` | Gemini AI Agronomist | Contextual chat assistant pre-loaded with selected Farm/Zone/Crop sensor data + recommendation cards |
| OWN-24 | Owner | `/owner/reports` | Business & Resource Reports | Water usage, electricity consumption, crop yield reports, alert frequency statistics |
| OWN-25 | Owner | `/owner/support` | Support & Service Tickets | Submit IoT hardware issue, view assigned technician progress & repair logs |
| OWN-26 | Owner | `/owner/settings` | Tenant & Farm Settings | Farm profile, weather API configuration, notification preferences |

---

## 5. Role 4 — Farmer / Farm Worker Screens (`/farmer/*`)
| Screen ID | Role | Route | Screen Name | Key Components & Purpose |
|---|---|---|---|---|
| FAR-01 | Farmer | `/farmer/home` | Farmer Field Dashboard | Mobile-optimized view: Assigned zones weather, today's tasks, active alerts, quick manual irrigation trigger |
| FAR-02 | Farmer | `/farmer/zones` | My Assigned Zones | Cards of zones authorized for this worker with live soil moisture & temp badges |
| FAR-03 | Farmer | `/farmer/zones/:id` | Zone Field Monitor | Simplified sensor readings, threshold status, growth stage info |
| FAR-04 | Farmer | `/farmer/monitoring` | Field Telemetry | Real-time gauge view of assigned zone environmental parameters |
| FAR-05 | Farmer | `/farmer/alerts` | Urgent Field Alerts | Real-time alert notifications with single-tap acknowledgement button |
| FAR-06 | Farmer | `/farmer/tasks` | My Task List | Daily task checklist, task detail modal, mark task in-progress/completed with photo/notes |
| FAR-07 | Farmer | `/farmer/irrigation` | Irrigation Control & Log | Permitted manual pump trigger button & history of recent irrigations |
| FAR-08 | Farmer | `/farmer/ai` | Farmer AI Assistant | Quick Voice/Text AI assistant to ask farming questions restricted to assigned zone data |
| FAR-09 | Farmer | `/farmer/notifications` | Notification List | In-app notification inbox |
| FAR-10 | Farmer | `/farmer/profile` | Worker Profile | Employee badge info, contact settings |
