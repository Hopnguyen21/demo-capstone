# SmartFarm API-to-Frontend Mapping

This document maps all 103 RESTful API endpoints (from `API .docx`) to frontend features, HTTP methods, authorization roles, and request/response DTO interfaces.

---

## 1. Auth & Account Management
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/login` | All | Login Page | Xác thực người dùng, trả về JWT access token và refresh token | `authService.login(dto)` |
| 2 | POST | `/api/v1/auth/logout` | All | Topbar Logout | Hủy session, vô hiệu hóa token hiện tại | `authService.logout()` |
| 3 | POST | `/api/v1/auth/refresh` | All | Axios Interceptor | Cấp lại access token mới bằng refresh token hợp lệ | `authService.refreshToken()` |
| 4 | POST | `/api/v1/auth/forgot-password` | All | Forgot Password Page | Gửi email chứa link/mã OTP để khôi phục mật khẩu | `authService.forgotPassword(email)` |
| 5 | POST | `/api/v1/auth/reset-password` | All | Reset Password Page | Đặt lại mật khẩu mới sau khi xác thực OTP/Token thành công | `authService.resetPassword(dto)` |

---

## 2. User & Worker Management
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 6 | GET | `/api/v1/users` | Owner | Worker / User List | Lấy danh sách nhân viên, nông dân thuộc quyền quản lý | `userService.getUsers(params)` |
| 7 | GET | `/api/v1/users/{userId}` | Owner | User Detail Modal | Lấy thông tin chi tiết của một nhân viên cụ thể | `userService.getUserById(id)` |
| 8 | PUT | `/api/v1/users/{userId}` | Owner | Edit User Form | Cập nhật thông tin hồ sơ nhân viên (tên, role, trạng thái) | `userService.updateUser(id, dto)` |
| 9 | DELETE| `/api/v1/users/{userId}` | Owner | Deactivate User | Vô hiệu hóa (xóa mềm) tài khoản nhân viên | `userService.deleteUser(id)` |
| 10 | POST | `/api/v1/users/farmers` | Owner | Create Farmer Account | Đăng ký cấp mới tài khoản cho nhân viên nông dân (Farmer) | `userService.createFarmer(dto)` |
| 11 | POST | `/api/v1/users/farmers/{id}/access` | Owner | Assign Farm/Zone Access | Phân quyền truy cập cho nhân viên vào các Zone/Farm cụ thể | `userService.updateFarmerAccess(id, dto)` |
| 12 | GET | `/api/v1/users/farmers/{id}/access` | Owner | Access Scope Dialog | Xem danh sách các khu vực (Zone/Farm) mà nhân viên được phép quản lý | `userService.getFarmerAccess(id)` |

---

## 3. Tenant Management
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 13 | GET | `/api/v1/tenants` | Admin | Tenant List Page | Lấy danh sách tất cả các Tenant (Tổ chức/Doanh nghiệp) trên hệ thống | `tenantService.getTenants()` |
| 14 | POST | `/api/v1/tenants` | Admin | Create Tenant Modal | Tạo mới một Tenant và cấp phát tài khoản Owner cho Tenant đó | `tenantService.createTenant(dto)` |
| 15 | GET | `/api/v1/tenants/{id}` | Admin / Owner | Tenant Profile Page | Xem chi tiết cấu hình, gói dịch vụ của Tenant | `tenantService.getTenantById(id)` |

---

## 4. Farm, Field & Zone Management
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 16-22| GET/POST/PUT/DELETE | `/api/v1/farms` | Owner/Farmer | Farm Management & GIS | Quản lý vòng đời (CRUD) và dữ liệu GIS của cấp Trang trại (Farm) | `farmService.getFarms()`, `createFarm()`, `updateFarm()` |
| 23-27| GET/POST/PUT/DELETE | `/api/v1/fields` | Owner/Farmer | Field Boundary & List | Quản lý vòng đời (CRUD) của cấp Phân khu/Lô đất (Field) nằm trong Farm | `fieldService.getFields()`, `createField()` |
| 28-32| GET/POST/PUT/DELETE | `/api/v1/zones` | Owner/Farmer | Zone Monitor & Setup | Quản lý vòng đời (CRUD) của cấp Nhà màng/Khu vực (Zone) nằm trong Field | `zoneService.getZones()`, `getZoneById()` |

---

## 5. Crop Library, Profiles & Planting Seasons
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 33-36| GET/POST/PUT | `/api/v1/crops` & `/varieties` | Admin / Owner | System Crop Catalog | Quản lý danh sách các giống cây trồng hệ thống hỗ trợ | `cropService.getCrops()`, `getVarieties()` |
| 37-40| GET/POST/PUT | `/api/v1/growth-profiles` | Admin / Owner | Growth Profiles & Stages | Cấu hình biểu đồ sinh trưởng tiêu chuẩn (độ ẩm, nhiệt độ) | `cropService.getGrowthProfiles()` |
| 41-45| GET/POST/PUT | `/api/v1/planting-seasons` | Owner / Farmer | Planting Seasons & Stage | Quản lý mùa vụ gieo trồng thực tế tại các Zone, tiến độ thu hoạch | `seasonService.getSeasons()`, `transitionStage()` |

---

## 6. IoT Devices, Gateways & Provisioning
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 46-49| GET/POST/PUT | `/api/v1/gateways` | Tech / Owner | ESP32 Gateway List | Đăng ký, whitelist và quản lý kết nối của LoRa Gateways | `gatewayService.getGateways()`, `registerGateway()` |
| 50-60| GET/POST/PUT | `/api/v1/devices` & `/nodes` | Tech / Owner | Sensor & Actuator Nodes | Quản lý cấp phát thiết bị, gán vào Zone và chẩn đoán kết nối | `deviceService.getNodes()`, `provisionNode()`, `diagnose()` |

---

## 7. Realtime Telemetry & Alerts
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 61-63| GET | `/api/v1/telemetry/realtime` & `/history` | All Roles | Telemetry Charts & Gauges | Truy xuất dữ liệu cảm biến realtime hoặc dữ liệu biểu đồ lịch sử | `telemetryService.getRealtime()`, `getHistory()` |
| 64-67| GET/POST | `/api/v1/alert-rules` | Owner | Alert Rules Config | Cấu hình các ngưỡng cảnh báo (ví dụ: Nhiệt độ > 35°C) | `alertService.getRules()`, `createRule()` |
| 68-71| GET/POST/PUT | `/api/v1/alerts` | All Roles | Alert Inbox & Acknowledge | Lấy danh sách cảnh báo đã phát sinh, đánh dấu đã đọc (Ack) | `alertService.getAlerts()`, `acknowledgeAlert()` |

---

## 8. Control, Schedules & Automation Rules
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 72-75| GET/POST | `/api/v1/schedules` | Owner / Farmer | Irrigation Timers | Quản lý lịch tưới/chiếu sáng định kỳ (VD: Tưới lúc 6:00 AM) | `controlService.getSchedules()`, `createSchedule()` |
| 76-79| GET/POST | `/api/v1/auto-rules` | Owner | Visual Rules Engine | Thiết lập luật tự động hóa (VD: Ẩm < 40% thì bật bơm) | `controlService.getAutoRules()`, `createAutoRule()` |
| 80-83| POST/GET | `/api/v1/control/manual` & `/history` | Owner / Farmer | Relay Trigger Buttons | Bật/tắt thiết bị thủ công và xem lịch sử điều khiển | `controlService.triggerManual()`, `getControlHistory()` |

---

## 9. Gemini AI Assistant
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 84 | POST | `/api/v1/ai/conversations` | All | Start AI Chat Session | Bắt đầu phiên chat mới với trợ lý ảo Gemini | `aiService.createConversation(dto)` |
| 85 | GET | `/api/v1/ai/conversations` | All | Chat History Drawer | Lấy danh sách lịch sử chat các phiên trước đó | `aiService.getConversations()` |
| 86 | POST | `/api/v1/ai/conversations/{id}/messages` | All | Send Message to Gemini | Gửi prompt tới Gemini và nhận phản hồi | `aiService.sendMessage(convId, dto)` |
| 87 | GET | `/api/v1/ai/recommendations` | Owner | AI Recommendation List | Lấy danh sách các đề xuất hành động do AI gợi ý | `aiService.getRecommendations()` |
| 88 | POST | `/api/v1/ai/recommendations/{id}/apply` | Owner | Approve & Apply AI Action | Chủ trang trại phê duyệt và thực thi tự động đề xuất của AI | `aiService.applyRecommendation(id)` |
| 89 | POST | `/api/v1/ai/recommendations/{id}/reject` | Owner | Reject Recommendation | Bỏ qua đề xuất do AI gợi ý nếu thấy không hợp lý | `aiService.rejectRecommendation(id)` |
| 90 | GET | `/api/v1/ai/sensor-explanation` | All | Sensor Metric AI Explain | Phân tích và diễn giải dữ liệu cảm biến thành ngôn ngữ tự nhiên | `aiService.explainSensorData(params)` |

---

## 10. Reports, Inventory, Support & Audit
| EP # | Method | Endpoint | Role | Frontend Feature | Tác dụng (Purpose) | Frontend Component / Service Call |
|---|---|---|---|---|---|---|
| 91-94| GET | `/api/v1/reports/*` | All | Report Analytics | Trích xuất báo cáo thống kê môi trường, năng suất định kỳ | `reportService.getEnvironmentalReport()` |
| 95-97| GET/POST | `/api/v1/support/service-requests` | Owner / Tech | Service Tickets & Hot-Swap | Quản lý luồng ticket yêu cầu sửa chữa, cấp phát thiết bị | `supportService.getServiceRequests()` |
| 98-99| GET/POST | `/api/v1/inventory` & `/materials` | Owner | Material Stock & Usages | Quản lý kho vật tư (phân bón, hạt giống) và nhật ký tiêu hao | `supportService.getInventory()` |
| 100-101| GET/POST | `/api/v1/tasks` | Owner / Farmer | Worker Work Orders | Phân công và theo dõi tiến độ công việc hàng ngày cho nhân viên | `supportService.getTasks()`, `updateTask()` |
| 102-103| GET | `/api/v1/audit-logs` | Admin / Owner | System Audit Trail | Lưu trữ và truy xuất log thao tác của người dùng để đối soát | `supportService.getAuditLogs()` |
