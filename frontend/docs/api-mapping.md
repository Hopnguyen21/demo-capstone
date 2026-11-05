# SmartFarm API-to-Frontend Mapping

This document maps all 103 RESTful API endpoints (from `API .docx`) to frontend features, HTTP methods, authorization roles, and request/response DTO interfaces.

---

## 1. Auth & Account Management
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/login` | All | Login Page | `authService.login(dto)` |
| 2 | POST | `/api/v1/auth/logout` | All | Topbar Logout | `authService.logout()` |
| 3 | POST | `/api/v1/auth/refresh` | All | Axios Interceptor | `authService.refreshToken()` |
| 4 | POST | `/api/v1/auth/forgot-password` | All | Forgot Password Page | `authService.forgotPassword(email)` |
| 5 | POST | `/api/v1/auth/reset-password` | All | Reset Password Page | `authService.resetPassword(dto)` |

---

## 2. User & Worker Management
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 6 | GET | `/api/v1/users` | Owner | Worker / User List | `userService.getUsers(params)` |
| 7 | GET | `/api/v1/users/{userId}` | Owner | User Detail Modal | `userService.getUserById(id)` |
| 8 | PUT | `/api/v1/users/{userId}` | Owner | Edit User Form | `userService.updateUser(id, dto)` |
| 9 | DELETE| `/api/v1/users/{userId}` | Owner | Deactivate User | `userService.deleteUser(id)` |
| 10 | POST | `/api/v1/users/farmers` | Owner | Create Farmer Account | `userService.createFarmer(dto)` |
| 11 | POST | `/api/v1/users/farmers/{id}/access` | Owner | Assign Farm/Zone Access | `userService.updateFarmerAccess(id, dto)` |
| 12 | GET | `/api/v1/users/farmers/{id}/access` | Owner | Access Scope Dialog | `userService.getFarmerAccess(id)` |

---

## 3. Tenant Management
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 13 | GET | `/api/v1/tenants` | Admin | Tenant List Page | `tenantService.getTenants()` |
| 14 | POST | `/api/v1/tenants` | Admin | Create Tenant Modal | `tenantService.createTenant(dto)` |
| 15 | GET | `/api/v1/tenants/{id}` | Admin / Owner | Tenant Profile Page | `tenantService.getTenantById(id)` |

---

## 4. Farm, Field & Zone Management
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 16-22| GET/POST/PUT/DELETE | `/api/v1/farms` | Owner/Farmer | Farm Management & GIS | `farmService.getFarms()`, `createFarm()`, `updateFarm()` |
| 23-27| GET/POST/PUT/DELETE | `/api/v1/fields` | Owner/Farmer | Field Boundary & List | `fieldService.getFields()`, `createField()` |
| 28-32| GET/POST/PUT/DELETE | `/api/v1/zones` | Owner/Farmer | Zone Monitor & Setup | `zoneService.getZones()`, `getZoneById()` |

---

## 5. Crop Library, Profiles & Planting Seasons
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 33-36| GET/POST/PUT | `/api/v1/crops` & `/varieties` | Admin / Owner | System Crop Catalog | `cropService.getCrops()`, `getVarieties()` |
| 37-40| GET/POST/PUT | `/api/v1/growth-profiles` | Admin / Owner | Growth Profiles & Stages | `cropService.getGrowthProfiles()` |
| 41-45| GET/POST/PUT | `/api/v1/planting-seasons` | Owner / Farmer | Planting Seasons & Stage | `seasonService.getSeasons()`, `transitionStage()` |

---

## 6. IoT Devices, Gateways & Provisioning
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 46-49| GET/POST/PUT | `/api/v1/gateways` | Tech / Owner | ESP32 Gateway List | `gatewayService.getGateways()`, `registerGateway()` |
| 50-60| GET/POST/PUT | `/api/v1/devices` & `/nodes` | Tech / Owner | Sensor & Actuator Nodes | `deviceService.getNodes()`, `provisionNode()`, `diagnose()` |

---

## 7. Realtime Telemetry & Alerts
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 61-63| GET | `/api/v1/telemetry/realtime` & `/history` | All Roles | Telemetry Charts & Gauges | `telemetryService.getRealtime()`, `getHistory()` |
| 64-67| GET/POST | `/api/v1/alert-rules` | Owner | Alert Rules Config | `alertService.getRules()`, `createRule()` |
| 68-71| GET/POST/PUT | `/api/v1/alerts` | All Roles | Alert Inbox & Acknowledge | `alertService.getAlerts()`, `acknowledgeAlert()` |

---

## 8. Control, Schedules & Automation Rules
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 72-75| GET/POST | `/api/v1/schedules` | Owner / Farmer | Irrigation Timers | `controlService.getSchedules()`, `createSchedule()` |
| 76-79| GET/POST | `/api/v1/auto-rules` | Owner | Visual Rules Engine | `controlService.getAutoRules()`, `createAutoRule()` |
| 80-83| POST/GET | `/api/v1/control/manual` & `/history` | Owner / Farmer | Relay Trigger Buttons | `controlService.triggerManual()`, `getControlHistory()` |

---

## 9. Gemini AI Assistant
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 84 | POST | `/api/v1/ai/conversations` | All | Start AI Chat Session | `aiService.createConversation(dto)` |
| 85 | GET | `/api/v1/ai/conversations` | All | Chat History Drawer | `aiService.getConversations()` |
| 86 | POST | `/api/v1/ai/conversations/{id}/messages` | All | Send Message to Gemini | `aiService.sendMessage(convId, dto)` |
| 87 | GET | `/api/v1/ai/recommendations` | Owner | AI Recommendation List | `aiService.getRecommendations()` |
| 88 | POST | `/api/v1/ai/recommendations/{id}/apply` | Owner | Approve & Apply AI Action | `aiService.applyRecommendation(id)` |
| 89 | POST | `/api/v1/ai/recommendations/{id}/reject` | Owner | Reject Recommendation | `aiService.rejectRecommendation(id)` |
| 90 | GET | `/api/v1/ai/sensor-explanation` | All | Sensor Metric AI Explain | `aiService.explainSensorData(params)` |

---

## 10. Reports, Inventory, Support & Audit
| EP # | Method | Endpoint | Role | Frontend Feature | Frontend Component / Service Call |
|---|---|---|---|---|---|
| 91-94| GET | `/api/v1/reports/*` | All | Report Analytics | `reportService.getEnvironmentalReport()` |
| 95-97| GET/POST | `/api/v1/support/service-requests` | Owner / Tech | Service Tickets & Hot-Swap | `supportService.getServiceRequests()` |
| 98-99| GET/POST | `/api/v1/inventory` & `/materials` | Owner | Material Stock & Usages | `supportService.getInventory()` |
| 100-101| GET/POST | `/api/v1/tasks` | Owner / Farmer | Worker Work Orders | `supportService.getTasks()`, `updateTask()` |
| 102-103| GET | `/api/v1/audit-logs` | Admin / Owner | System Audit Trail | `supportService.getAuditLogs()` |
