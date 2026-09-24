# SmartFarm Role-Permission Matrix

This document defines the RBAC security scope for SmartFarm's 4 roles based on `Data.txt` and `API .docx`.

---

## 1. Role Scope Definitions

- **PLATFORM_ADMIN** (`Platform Admin`): Platform-wide administrator. Governs SaaS tenants, system crop templates, global device catalog, system performance, and security audit logs.
- **PLATFORM_TECHNICIAN** (`Platform Technician`): Platform staff technician. Responsible for IoT deployment inspection, device provisioning (QR/MAC scanner), LoRa spectrum verification, hardware diagnostics, maintenance, and 1-to-1 hot-swap replacements.
- **FARM_OWNER** (`Farm Owner` - Tenant Root): SaaS Tenant owner. Full management over owned farms, fields, zones, crops, planting seasons, worker permissions, irrigation rules, manual control, AI recommendations, inventory, and support tickets.
- **FARMER** (`Farmer / Farm Worker` - Tenant Member): Hired agricultural worker. Restricted view limited strictly to explicitly assigned farms and zones. Executes field tasks, monitors assigned zone telemetry, acknowledges urgent field alerts, triggers permitted manual irrigation, and asks contextual AI questions.

---

## 2. Comprehensive Permissions Matrix

| Module / Feature | Platform Admin | Platform Technician | Farm Owner | Farmer / Worker |
|---|:---:|:---:|:---:|:---:|
| **Platform Management** | | | | |
| Tenant Registration & Approval | ✅ Full | ❌ | ❌ | ❌ |
| Global System Users | ✅ Full | ❌ | ❌ | ❌ |
| System Crop Library & Profiles | ✅ Full | ❌ | ❌ | ❌ |
| Master Device Catalog | ✅ Full | ❌ | ❌ | ❌ |
| Server & Service Health | ✅ Full | 👁️ Read | ❌ | ❌ |
| Global Audit Logs | ✅ Full | ❌ | ❌ | ❌ |
| **IoT & Infrastructure Setup** | | | | |
| View Deployment Requests | 👁️ Read | ✅ Full | 👁️ Tenant | ❌ |
| Device Provisioning & MAC Scan | ❌ | ✅ Full | ❌ | ❌ |
| LoRa Gateway Configuration | 👁️ Read | ✅ Full | 👁️ Read | ❌ |
| Hardware Diagnostics & Spectrum | ❌ | ✅ Full | ❌ | ❌ |
| Hardware Hot-Swap & Repair | ❌ | ✅ Full | ❌ | ❌ |
| Spare Parts Inventory | ❌ | ✅ Full | ❌ | ❌ |
| **Farm Organization** | | | | |
| Create / Edit Farms | ❌ | ❌ | ✅ Full | ❌ |
| Create / Edit Fields & Boundaries | ❌ | ❌ | ✅ Full | ❌ |
| Create / Edit Zones | ❌ | ❌ | ✅ Full | ❌ |
| Manage Farm Worker Accounts | ❌ | ❌ | ✅ Full | ❌ |
| Assign Worker Zone Access Scope | ❌ | ❌ | ✅ Full | ❌ |
| **Crop & Season Operations** | | | | |
| Custom Farm Crop Profiles | ❌ | ❌ | ✅ Full | 👁️ Read |
| Planting Season Management | ❌ | ❌ | ✅ Full | 👁️ Read |
| Growth Stage Transition | ❌ | ❌ | ✅ Full | 👁️ Read |
| **Environmental Telemetry & GIS** | | | | |
| Real-time Telemetry Dashboard | 👁️ Platform | 👁️ Technical | ✅ Tenant | 👁️ Assigned Zones |
| Historical Telemetry & Charts | 👁️ Platform | 👁️ Technical | ✅ Tenant | 👁️ Assigned Zones |
| Interactive GIS Map | 👁️ Platform | 👁️ Technical | ✅ Tenant | 👁️ Assigned Zones |
| Environmental Reports Export | 👁️ Platform | ❌ | ✅ Tenant | ❌ |
| **Control, Irrigation & Alerts** | | | | |
| Configure Alert Threshold Rules | ❌ | ❌ | ✅ Full | ❌ |
| View & Acknowledge Alerts | 👁️ Read | 👁️ Read | ✅ Full | ⚡ Assigned Zones |
| Manual Relay Control (Pump/Fan) | ❌ | ⚡ Diagnostics | ✅ Full | ⚡ If Permitted |
| Irrigation Schedules (Cron) | ❌ | ❌ | ✅ Full | 👁️ Read |
| Visual Automation Rules Engine | ❌ | ❌ | ✅ Full | 👁️ Read |
| **AI Advisory & Work Orders** | | | | |
| Gemini AI Agronomist Chat | 👁️ Demo | 👁️ Technical | ✅ Tenant Context | 👁️ Assigned Zone Context |
| Approve AI Recommendations | ❌ | ❌ | ✅ Full | ❌ |
| Task / Work Order Creation | ❌ | ❌ | ✅ Full | ❌ |
| Task Execution & Completion | ❌ | ❌ | 👁️ Manage | ✅ Assigned Tasks |
| Farm Material Stock & Inventory | ❌ | ❌ | ✅ Full | 👁️ Read |
| Support & Service Requests | 👁️ Overview | ✅ Resolution | ✅ Submit/View | ❌ |

---

## 3. Multi-Tenant Data Isolation Enforcement Rules
1. **Tenant Root Scope:** A `FARM_OWNER` user carries a `tenant_id`. Data queries for Farms, Fields, Zones, Devices, Readings, Alerts, Tasks, and Inventories automatically filter by `tenant_id`.
2. **Worker Access Scope:** A `FARMER` user carries a `tenant_id` AND explicit records in `employee_farm_access` and `employee_zone_access`. Route guards and API calls restrict visible components to those explicitly matched `zone_id`s.
3. **Technician Scope:** A `PLATFORM_TECHNICIAN` has global device reading ability but cannot alter tenant business entities (crops, tasks, staff, finance).
4. **Admin Scope:** A `PLATFORM_ADMIN` sees platform metrics and global catalogs, but business tenant data is scrubbed or aggregated.
