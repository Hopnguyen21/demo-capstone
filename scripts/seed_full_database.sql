-- ==============================================================================
-- SMARTFARM COMPREHENSIVE SEED DATA (ALL 77 TABLES COVERED)
-- Login Credentials for 4 Core Roles:
-- 1. Khách / Farm Owner:       owner@smartfarm.demo       | Password: Demo@12345
-- 2. Quản trị viên / Admin:     admin@smartfarm.demo       | Password: Demo@12345
-- 3. Kỹ thuật viên / Tech:     technician@smartfarm.demo  | Password: Demo@12345
-- 4. Nông dân / Farmer:        farmer@smartfarm.demo      | Password: Demo@12345
--
-- Password Hash for Demo@12345:
-- AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==
-- ==============================================================================

BEGIN;

-- ── 1. TENANTS ────────────────────────────────────────────────────────────────
INSERT INTO tenants (id, company_name, subdomain, tax_code, status, address, created_at_utc)
VALUES
('10000000-0000-0000-0000-000000000001', 'SmartFarm Hi-Tech Agriculture JSC', 'smartfarm-demo', 'TAX-VN-001', 'Active', '12 Phù Đổng Thiên Vương, Phường 8, TP. Đà Lạt, Lâm Đồng', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  status = EXCLUDED.status,
  address = EXCLUDED.address;

-- ── 2. FARMS ──────────────────────────────────────────────────────────────────
INSERT INTO farms (id, tenant_id, name, location_text, latitude, longitude, total_area_m2, time_zone, status, created_at_utc)
VALUES
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Trang Trại Công Nghệ Cao Đà Lạt Eco', 'Phường 8, TP. Đà Lạt, Tỉnh Lâm Đồng', 11.9404, 108.4583, 10000, 'Asia/Ho_Chi_Minh', 'Operating', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  total_area_m2 = EXCLUDED.total_area_m2;

-- ── 3. APP USERS (4 ROLES) ────────────────────────────────────────────────────
INSERT INTO app_users (id, email, normalized_email, full_name, phone, password_hash, role, status, tenant_id, farm_id, failed_login_attempts, created_at_utc)
VALUES
('20000000-0000-0000-0000-000000000001', 'owner@smartfarm.demo', 'OWNER@SMARTFARM.DEMO', 'Nguyễn Văn Chủ (Farm Owner)', '0900000001', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'FarmOwner', 'Active', '10000000-0000-0000-0000-000000000001', NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000002', 'farmer@smartfarm.demo', 'FARMER@SMARTFARM.DEMO', 'Trần Văn Nông (Farmer)', '0900000002', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'Farmer', 'Active', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000003', 'admin@smartfarm.demo', 'ADMIN@SMARTFARM.DEMO', 'Tổng Quản Trị Hệ Thống (Platform Admin)', '0900000003', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformAdmin', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000004', 'technician@smartfarm.demo', 'TECHNICIAN@SMARTFARM.DEMO', 'Kỹ Thuật Viên LoRa (Platform Technician)', '0900000004', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformTechnician', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  status = 'Active',
  failed_login_attempts = 0,
  locked_until_utc = NULL;

-- ── 4. FIELDS ─────────────────────────────────────────────────────────────────
INSERT INTO fields (id, farm_id, name, area_m2, available_area_m2, soil_type, latitude, longitude, boundary, created_at_utc)
VALUES
('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Khu Nhà Màng A (Hi-Tech Greenhouses)', 6000, 3500, 'Loam', 11.9404, 108.4583,
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.457,11.939],[108.460,11.939],[108.460,11.942],[108.457,11.942],[108.457,11.939]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  area_m2 = EXCLUDED.area_m2,
  boundary = EXCLUDED.boundary;

-- ── 5. ZONES ──────────────────────────────────────────────────────────────────
INSERT INTO zones (id, field_id, name, area_m2, zone_type, notes, status, boundary, created_at_utc)
VALUES
('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Phân Khu 1 - Nhà Màng Dưa Leo Baby', 2500, 'Greenhouse', 'Phân khu ứng dụng tưới nhỏ giọt tự động LoRaWAN.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4575,11.9395],[108.459,11.9395],[108.459,11.941],[108.4575,11.941],[108.4575,11.9395]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  boundary = EXCLUDED.boundary;

-- ── 6. USER ZONE ACCESSES ─────────────────────────────────────────────────────
INSERT INTO user_zone_accesses (app_user_id, zone_id, can_control, assigned_at_utc)
VALUES
('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (app_user_id, zone_id) DO UPDATE SET can_control = TRUE;

-- ── 7. REFRESH TOKENS ─────────────────────────────────────────────────────────
INSERT INTO refresh_tokens (id, app_user_id, token_hash, access_token_jti, access_token_expires_at_utc, expires_at_utc, created_at_utc)
VALUES
('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'seed_refresh_token_owner_hash_001', 'seed-owner-jti-001', CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 8. CROPS & VARIETIES ──────────────────────────────────────────────────────
INSERT INTO crops (id, tenant_id, created_by_user_id, name, normalized_name, scientific_name, description, is_system_defined, created_at_utc)
VALUES
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Dưa leo Baby', 'DUA LEO BABY', 'Cucumis sativus', 'Cây dưa leo baby trồng giá thể hữu cơ nhà màng.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO crop_varieties (id, crop_id, tenant_id, created_by_user_id, name, normalized_name, description, is_system_defined, created_at_utc)
VALUES
('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Baby Green F1', 'BABY GREEN F1', 'Giống dưa leo baby F1 sai quả, giòn ngọt, kháng bệnh cao.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ── 9. GROWTH PROFILES & STAGES ───────────────────────────────────────────────
INSERT INTO growth_profiles (id, crop_id, variety_id, tenant_id, created_by_user_id, name, normalized_name, description, is_default, is_system_defined, created_at_utc)
VALUES
('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Quy trình Chuẩn Dưa leo Nhà màng', 'QUY TRINH CHUAN DUA LEO NHA MANG', 'Quy trình chuẩn hóa chu kỳ 75 ngày.', TRUE, FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_default = TRUE;

INSERT INTO growth_stages (id, growth_profile_id, name, stage_order, duration_days, created_at_utc)
VALUES
('43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'Vegetative', 1, 30, CURRENT_TIMESTAMP),
('43000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'Harvest', 2, 45, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_days = EXCLUDED.duration_days;

-- ── 10. GROWTH STAGE IRRIGATION SESSIONS ──────────────────────────────────────
INSERT INTO growth_stage_irrigation_sessions (id, growth_stage_id, sort_order, title, start_time, duration_seconds, enabled, method, water_per_plant_ml, created_at_utc)
VALUES
('45000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 1, 'Tưới nhỏ giọt buổi sáng', '06:30:00', 600, TRUE, 'Tưới nhỏ giọt bù áp', 500, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, duration_seconds = EXCLUDED.duration_seconds;

-- ── 11. ENVIRONMENTAL REQUIREMENTS ───────────────────────────────────────────
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit)
VALUES
('43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 65, '%'),
('43000000-0000-0000-0000-000000000001', 'Temperature', 20, 30, 25, 'C'),
('43000000-0000-0000-0000-000000000001', 'AirHumidity', 55, 80, 68, '%'),
('43000000-0000-0000-0000-000000000001', 'Ph', 5.5, 6.8, 6.2, 'pH')
ON CONFLICT (growth_stage_id, parameter_code) DO UPDATE SET min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value, target_value = EXCLUDED.target_value;

-- ── 12. FARMING SEASONS ───────────────────────────────────────────────────────
INSERT INTO "FarmingSeasons" ("Id", "TenantId", "Code", "Name", "Year", "StartDate", "EndDate", "Description", "Status", "IsActive", "CreatedAtUtc")
VALUES
('43900000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SEASON-2026-XUAN-HE', 'Vụ Xuân Hè Công Nghệ Cao 2026', 2026, CURRENT_DATE - 15, CURRENT_DATE + 75, 'Mùa vụ nông nghiệp công nghệ cao ứng dụng IoT.', 'Active', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "Status" = EXCLUDED."Status";

-- ── 13. PLANTING SEASONS ──────────────────────────────────────────────────────
INSERT INTO planting_seasons (id, zone_id, crop_id, variety_id, growth_profile_id, current_growth_stage_id, name, start_date, expected_end_date, status, created_at_utc)
VALUES
('44000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Vụ Dưa Leo Baby 2026', CURRENT_DATE - 10, CURRENT_DATE + 65, 'InProgress', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET current_growth_stage_id = EXCLUDED.current_growth_stage_id, status = 'InProgress';

-- ── 14. SEASON APPLIED REQUIREMENTS ───────────────────────────────────────────
INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
VALUES
('44000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 65, '%'),
('44000000-0000-0000-0000-000000000001', 'Temperature', 20, 30, 25, 'C'),
('44000000-0000-0000-0000-000000000001', 'AirHumidity', 55, 80, 68, '%'),
('44000000-0000-0000-0000-000000000001', 'Ph', 5.5, 6.8, 6.2, 'pH')
ON CONFLICT (planting_season_id, parameter_code) DO UPDATE SET min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value;

-- ── 15. SEASON STAGE TRANSITIONS ──────────────────────────────────────────────
INSERT INTO season_stage_transitions (id, planting_season_id, previous_growth_stage_id, current_growth_stage_id, changed_by_user_id, notes, created_at_utc)
VALUES
('49000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Chuyển sang giai đoạn thu hoạch dưa baby.', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 16. SEASON IRRIGATION PLANS, DAYS & SESSIONS ──────────────────────────────
INSERT INTO season_irrigation_plans (id, planting_season_id, start_date_snapshot, total_days_snapshot, growth_profile_id_snapshot, updated_by_user_id, created_at_utc)
VALUES
('46000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', CURRENT_DATE - 10, 75, '42000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO season_irrigation_days (id, season_irrigation_plan_id, day_number, created_at_utc)
VALUES
('47000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000001', 1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO season_irrigation_sessions (id, season_irrigation_day_id, sort_order, title, start_time, duration_seconds, enabled, method, water_per_plant_ml, created_at_utc)
VALUES
('48000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001', 1, 'Ca tưới ngày bắt đầu vụ', '07:00:00', 600, TRUE, 'Tưới nhỏ giọt', 500, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 17. DEVICE MODEL DEFINITIONS & CAPABILITIES ───────────────────────────────
INSERT INTO device_model_definitions (id, name, device_type, coverage_area_m2, is_active, created_at_utc)
VALUES
('20000000-0000-0000-0000-000000000001', 'Environmental Sensor Node 4-in-1', 'SensorNode', 250, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO device_model_capabilities (device_model_definition_id, parameter_code)
VALUES
('20000000-0000-0000-0000-000000000001', 'SoilMoisture'),
('20000000-0000-0000-0000-000000000001', 'Temperature'),
('20000000-0000-0000-0000-000000000001', 'AirHumidity'),
('20000000-0000-0000-0000-000000000001', 'Ph')
ON CONFLICT (device_model_definition_id, parameter_code) DO NOTHING;

-- ── 18. PLATFORM SETTINGS ─────────────────────────────────────────────────────
INSERT INTO "PlatformSettings" ("Key", "Value", "Group", "DataType", "Description", "IsSecret", "UpdatedAtUtc")
VALUES
('Platform:SystemName', 'SmartFarm IoT Platform', 'General', 'String', 'Tên hệ thống nông nghiệp số', FALSE, CURRENT_TIMESTAMP),
('Platform:Currency', 'VND', 'Finance', 'String', 'Đơn vị tiền tệ chính thức', FALSE, CURRENT_TIMESTAMP),
('Platform:SupportPhone', '1900-8888', 'Support', 'String', 'Hotline hỗ trợ kỹ thuật thực địa', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT ("Key") DO UPDATE SET "Value" = EXCLUDED."Value";

-- ── 19. PLATFORM HARDWARE ITEMS ───────────────────────────────────────────────
INSERT INTO "PlatformHardwareItems" ("Id", "Code", "Name", "Model", "Category", "QuantityInStock", "UnitPrice", "Status", "EstimateRole", "EstimateUnits", "CreatedAtUtc")
VALUES
('88000000-0000-0000-0000-000000000001', 'GW-LORA-8CH', 'Trạm LoRa Gateway Ngoài Trời SX1302 8 Kênh', 'GW-SX1302-IND', 'Gateway', 20, 4500000, 'Available', 'Gateway', 1, CURRENT_TIMESTAMP),
('88000000-0000-0000-0000-000000000002', 'NODE-ENV-4IN1', 'Node Cảm Biến Môi Trường Đất & Vi Khí Hậu 4 Trong 1', 'NODE-ESP32-S3', 'SensorNode', 50, 1800000, 'Available', 'SensorNode', 1, CURRENT_TIMESTAMP),
('88000000-0000-0000-0000-000000000003', 'NODE-ACTUATOR-2CH', 'Node Điều Khiển Bơm & Van Điện Từ 2 Kênh Relay', 'NODE-RELAY-16A', 'ActuatorNode', 35, 1600000, 'Available', 'ActuatorNode', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "UnitPrice" = EXCLUDED."UnitPrice", "QuantityInStock" = EXCLUDED."QuantityInStock";

-- ── 20. CONTRACT PACKAGES ─────────────────────────────────────────────────────
INSERT INTO "ContractPackages" ("Id", "PackageName", "Description", "DurationMonths", "MaxZones", "Price", "Currency", "Status", "CreatedByUserId", "IsCustom", "CreatedAtUtc")
VALUES
('89000000-0000-0000-0000-000000000001', 'Gói Nông Nghiệp Số Tiêu Chuẩn Nhà Màng 1 Ha', 'Trọn gói Gateway + 2 Node cảm biến + 1 Node điều khiển tưới', 12, 5, 25000000, 'VND', 0, '20000000-0000-0000-0000-000000000003', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO UPDATE SET "PackageName" = EXCLUDED."PackageName", "Price" = EXCLUDED."Price";

-- ── 21. DEPLOYMENT REQUESTS ───────────────────────────────────────────────────
INSERT INTO deployment_requests (id, tenant_id, farm_id, zone_id, planting_season_id, owner_user_id, technician_user_id, status, required_parameters_csv, owner_notes, submitted_at_utc, completed_at_utc, created_at_utc)
VALUES
('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Completed', 'SoilMoisture,Temperature,AirHumidity,Ph', 'Yêu cầu lắp đặt hoàn chỉnh hệ thống giám sát và tưới tự động.', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '21 days')
ON CONFLICT (id) DO UPDATE SET status = 'Completed', technician_user_id = EXCLUDED.technician_user_id;

-- ── 22. DEPLOYMENT PLAN ITEMS ─────────────────────────────────────────────────
INSERT INTO deployment_plan_items (id, deployment_request_id, device_model_definition_id, quantity, installation_notes, created_at_utc)
VALUES
('50100000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2, 'Kế hoạch triển khai 2 Node cảm biến tại trung tâm luống.', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 23. DEPLOYMENT ESTIMATE ITEMS ─────────────────────────────────────────────
INSERT INTO deployment_estimate_items (id, deployment_request_id, hardware_item_id, sort_order, code, name, model, role, quantity, unit_price, notes, created_at_utc)
VALUES
('50200000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000002', 1, 'NODE-ENV-4IN1', 'Node Cảm Biến Môi Trường 4 Trong 1', 'NODE-ESP32-S3', 'SensorNode', 2, 1800000, 'Dự toán thiết bị phục vụ đo độ ẩm, nhiệt độ đất', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 24. DEPLOYMENT SURVEYS ────────────────────────────────────────────────────
INSERT INTO deployment_surveys (id, deployment_request_id, technician_user_id, is_feasible, site_conditions, notes, created_at_utc)
VALUES
('50300000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', TRUE, 'Địa hình nhà màng bằng phẳng, nguồn điện lưới 220V ổn định, sóng LoRa đạt -72dBm.', 'Khảo sát đạt tiêu chuẩn kỹ thuật triển khai thi công.', CURRENT_TIMESTAMP - INTERVAL '19 days')
ON CONFLICT (id) DO NOTHING;

-- ── 25. DEPLOYMENT DECISION HISTORY ───────────────────────────────────────────
INSERT INTO deployment_decision_history (id, deployment_request_id, actor_user_id, decision_type, from_status, to_status, notes, created_at_utc)
VALUES
('50400000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'ApproveDeployment', 'Surveyed', 'Completed', 'Phê duyệt nghiệm thu toàn bộ trạm thiết bị IoT.', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

-- ── 26. GATEWAYS ──────────────────────────────────────────────────────────────
INSERT INTO gateways (id, farm_id, deployment_request_id, mac_address, gateway_serial, frequency_band, firmware_version, status, last_seen_at_utc, mqtt_client_id, client_certificate_fingerprint, created_at_utc)
VALUES
('51000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'AA:BB:CC:DD:EE:01', 'GW-DEMO-001', 'AS923', '1.0.0', 'Online', CURRENT_TIMESTAMP - INTERVAL '1 minute', 'smartfarm-demo-gateway', repeat('A', 64), CURRENT_TIMESTAMP - INTERVAL '16 days')
ON CONFLICT (id) DO UPDATE SET status = 'Online', last_seen_at_utc = EXCLUDED.last_seen_at_utc;

-- ── 27. FIRMWARE JOBS ─────────────────────────────────────────────────────────
INSERT INTO firmware_jobs (id, gateway_id, target_version, firmware_url, scheduled_at_utc, status, created_at_utc)
VALUES
('51100000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '1.0.0', 'https://ota.smartfarm.demo/gw/v1.0.0.bin', CURRENT_TIMESTAMP - INTERVAL '16 days', 'Completed', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 28. DEVICES ───────────────────────────────────────────────────────────────
INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, installation_notes, created_at_utc)
VALUES
('52000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'SENSOR-DEMO-001', 'SensorNode', 'Online', 'Node cảm biến môi trường 4 trong 1.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('52000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'ACTUATOR-DEMO-001', 'ActuatorNode', 'Online', 'Node điều khiển bơm tưới nhỏ giọt 2HP.', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET zone_id = EXCLUDED.zone_id, status = 'Online';

-- ── 29. DEVICE SENSORS & ACTUATORS ───────────────────────────────────────────
INSERT INTO device_sensors (id, device_id, sensor_type, pin, model, interface, unit, min_value, max_value, sampling_interval_sec, created_at_utc)
VALUES
('52400000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'SoilMoisture', 'PIN_A1', 'RS485-SOIL', 'RS485', '%', 0, 100, 60, CURRENT_TIMESTAMP),
('52400000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Temperature', 'PIN_A2', 'SHT30', 'I2C', 'C', -10, 60, 60, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO device_actuators (id, device_id, actuator_type, relay_channel, rated_power_watt, flow_rate_liters_per_minute, max_duration_minutes, created_at_utc)
VALUES
('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', 'IrrigationPump', 1, 1500, 25, 30, CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET rated_power_watt = 1500, max_duration_minutes = 30;

-- ── 30. DEVICE ASSIGNMENT HISTORY & CONNECTION TESTS ──────────────────────────
INSERT INTO device_assignment_history (id, device_id, zone_id, technician_user_id, action, notes, created_at_utc)
VALUES
('52300000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'AssignToZone', 'Gán Node cảm biến vào Phân Khu 1', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO device_connection_tests (id, device_id, deployment_request_id, technician_user_id, succeeded, rssi, snr, round_trip_latency_ms, observed_at_utc, created_at_utc)
VALUES
('54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', TRUE, -72, 8.5, 45, CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes')
ON CONFLICT (id) DO UPDATE SET succeeded = TRUE;

-- ── 31. DEVICE DIAGNOSTIC JOBS ────────────────────────────────────────────────
INSERT INTO device_diagnostic_jobs (id, device_id, technician_user_id, action, new_frequency_channel, increase_tx_power_dbm, status, created_at_utc)
VALUES
('52100000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'CalibrateAndTestRssi', 923.200, 2, 'Completed', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 32. SERVICE REQUESTS & HISTORY ────────────────────────────────────────────
INSERT INTO service_requests (id, tenant_id, farm_id, zone_id, deployment_request_id, device_id, current_device_id, source, failure_code, description, status, created_by_owner_id, assigned_technician_id, inspection_notes, diagnosis, resolution_action, work_performed, accepted_at_utc, closed_at_utc, created_at_utc)
VALUES
('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'Owner', 'MAINTENANCE_PREVENTIVE', 'Bảo dưỡng định kỳ trạm bơm và van điện từ', 'Closed', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Kiểm tra đấu nối relay và siết ốc terminal.', 'Tiếp điểm relay sạch, bơm chạy êm.', 'Repair', 'Vệ sinh và siết chặt các cọc đấu nối.', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
ON CONFLICT (id) DO UPDATE SET status = 'Closed';

INSERT INTO service_request_history (id, service_request_id, actor_user_id, event_type, from_status, to_status, notes, created_at_utc)
VALUES
('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Closed', 'Verified', 'Closed', 'Hoàn tất bảo trì trạm bơm.', CURRENT_TIMESTAMP - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- ── 33. DEVICE REPLACEMENTS ───────────────────────────────────────────────────
INSERT INTO device_replacements (id, service_request_id, old_device_id, new_device_id, zone_id, technician_user_id, created_at_utc)
VALUES
('52200000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 34. SERVICE REQUEST QUOTATIONS, ITEMS & PAYMENTS ──────────────────────────
INSERT INTO "ServiceRequestQuotations" ("Id", "ServiceRequestId", "TechnicianUserId", "Subtotal", "VatPercent", "VatAmount", "TotalAmount", "Deposit30Percent", "Remaining70Percent", "Notes", "ContractTerms", "Status", "CreatedAtUtc")
VALUES
('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 5000000, 8, 400000, 5400000, 1620000, 3780000, 'Báo giá lắp đặt thiết bị nhà màng.', 'Bảo hành 12 tháng.', 'Confirmed', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "ServiceRequestQuotationItems" ("Id", "QuotationId", "HardwareItemCode", "HardwareItemName", "Category", "Unit", "Quantity", "UnitPrice", "VatPercent", "TotalAmount", "Notes")
VALUES
('82100000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'NODE-ENV-4IN1', 'Node Cảm Biến Môi Trường', 'SensorNode', 'Bộ', 1, 1800000, 8, 1944000, 'Cảm biến đất và vi khí hậu')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "ServiceRequestPayments" ("Id", "ServiceRequestId", "QuotationId", "PaymentStage", "Amount", "PaymentMethod", "TransactionReference", "SignerFullName", "Status", "PaidAtUtc", "ConfirmedByAdminId")
VALUES
('82200000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'DEPOSIT_30', 1620000, 'BankTransfer', 'VNPAY-2026-001', 'Nguyễn Văn Chủ', 'Confirmed', CURRENT_TIMESTAMP - INTERVAL '10 days', '20000000-0000-0000-0000-000000000003')
ON CONFLICT ("Id") DO NOTHING;

-- ── 35. ZONE CONTRACTS & RENEWALS ─────────────────────────────────────────────
INSERT INTO "ZoneContracts" ("Id", "TenantId", "FarmId", "ZoneId", "CreatedByOwnerId", "ContractNumber", "CropType", "MonthlyRentVnd", "DepositVnd", "TotalContractValueVnd", "DiscountPercent", "DiscountVnd", "VatPercent", "VatAmountVnd", "StartDate", "EndDate", "Status", "LesseeName", "LesseePhone", "SignedAtUtc", "ContractPackageId", "CreatedAtUtc")
VALUES
('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'HD-ZONE-01-2026', 'Dưa leo Baby', 5000000, 10000000, 60000000, 5, 3000000, 10, 5700000, CURRENT_DATE - 30, CURRENT_DATE + 335, 0, 'Nguyễn Văn Chủ', '0900000001', CURRENT_TIMESTAMP - INTERVAL '30 days', '89000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO UPDATE SET "ContractNumber" = EXCLUDED."ContractNumber", "Status" = 0;

INSERT INTO "ZoneContractRenewals" ("Id", "ContractId", "CreatedByOwnerId", "NewEndDate", "NewMonthlyRentVnd", "RenewalValueVnd", "Notes", "CreatedAtUtc")
VALUES
('90100000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', CURRENT_DATE + 700, 5200000, 62400000, 'Gia hạn hợp đồng dịch vụ thêm 1 năm', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 36. DEVICE DEPRECIATIONS ──────────────────────────────────────────────────
INSERT INTO "DeviceDepreciations" ("Id", "TenantId", "ZoneId", "DeviceId", "CreatedByOwnerId", "OriginalCostVnd", "MonthlyDepreciationVnd", "AccumulatedDepreciationVnd", "CurrentBookValueVnd", "DepreciationLifetimeMonths", "Method", "StartDate", "Notes", "CreatedAtUtc")
VALUES
('90200000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1800000, 75000, 150000, 1650000, 24, 'StraightLine', CURRENT_DATE - 60, 'Khấu hao Node cảm biến 24 tháng', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 37. STOCK OUTS & STOCK OUT DETAILS ────────────────────────────────────────
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "CreatedAtUtc")
VALUES
('91000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'XK-2026-001', 3, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000002', 2, 'Xuất kho thiết bị lắp đặt nhà màng', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 38. STOCK INS & STOCK IN DETAILS ──────────────────────────────────────────
INSERT INTO "StockIns" ("Id", "TenantId", "FarmId", "StockInCode", "SupplierName", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc")
VALUES
('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'NK-2026-001', 'Công ty Phân Bón Sinh Học Lâm Đồng', 3, '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '15 days', 'Nhập kho đợt 1 phân bón vi sinh và vật tư.', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "StockInDetails" ("Id", "StockInId", "InventoryItemId", "Quantity", "UnitPrice", "Notes", "CreatedAtUtc")
VALUES
('92100000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 50, 45000, 'Nhập phân bón NPK tan chậm', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 39. BILLS ─────────────────────────────────────────────────────────────────
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "CreatedByUserId", "CreatedAtUtc")
VALUES
('93000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'BILL-2026-001', '90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Nguyễn Văn Chủ', 10000000, 10000000, 0, 3, CURRENT_DATE - 30, CURRENT_DATE - 15, CURRENT_TIMESTAMP - INTERVAL '25 days', 'Chuyển khoản Vietcombank', '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 40. INVENTORY ITEMS & MATERIAL REQUIREMENT LINKS ──────────────────────────
INSERT INTO inventory_items ("Id", tenant_id, farm_id, name, normalized_name, material_type, unit, quantity_on_hand, low_stock_threshold, created_at_utc)
VALUES
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Phân Bón NPK Cao Cấp 20-20-15', 'PHAN BON NPK CAO CAP 20-20-15', 'Fertilizer', 'kg', 35, 40, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT ("Id") DO UPDATE SET quantity_on_hand = 35, low_stock_threshold = 40;

INSERT INTO material_requirement_links ("Id", inventory_item_id, crop_id, variety_id, growth_stage_id, recommended_quantity, notes, created_at_utc)
VALUES
('70100000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', NULL, NULL, 25.5, 'Định mức phân bón lót giai đoạn sinh trưởng.', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 41. INVENTORY TRANSACTIONS & LOW STOCK ALERTS ──────────────────────────────
INSERT INTO inventory_transactions ("Id", tenant_id, farm_id, inventory_item_id, movement_type, quantity, balance_after, actor_user_id, zone_id, notes, created_at_utc)
VALUES
('71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Receipt', 50, 50, '20000000-0000-0000-0000-000000000001', NULL, 'Nhập kho ban đầu.', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Issue', 15, 35, '20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'Xuất dùng cho Phân Khu 1.', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO low_stock_alerts ("Id", tenant_id, farm_id, inventory_item_id, status, quantity_at_open, opened_at_utc, created_at_utc)
VALUES
('72000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Open', 35, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET status = 'Open';

-- ── 42. FARM TASKS, ASSIGNMENTS & HISTORY ──────────────────────────────────────
INSERT INTO farm_tasks ("Id", tenant_id, farm_id, zone_id, title, description, requirements, due_at_utc, created_by_owner_id, status, created_at_utc)
VALUES
('73000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Kiểm tra đường ống tưới nhỏ giọt', 'Kiểm tra các béc bù áp và đồng hồ áp suất.', 'Đảm bảo không rò rỉ nước.', CURRENT_TIMESTAMP + INTERVAL '2 days', '20000000-0000-0000-0000-000000000001', 'Approved', CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT ("Id") DO UPDATE SET title = EXCLUDED.title;

INSERT INTO farm_task_assignments ("Id", farm_task_id, farmer_id, assigned_by_owner_id, assigned_at_utc, status, progress_percent, result, accepted_at_utc, started_at_utc, submitted_at_utc, approved_at_utc, assignment_version, created_at_utc)
VALUES
('73200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Approved', 100, 'Đã kiểm tra 120 béc bù áp, áp suất ổn định 1.5 bar.', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 1, CURRENT_TIMESTAMP)
ON CONFLICT (farm_task_id, farmer_id) DO UPDATE SET status = 'Approved';

INSERT INTO farm_task_history ("Id", farm_task_id, actor_user_id, event_type, from_status, to_status, previous_assignee_id, new_assignee_id, subject_farmer_id, notes, created_at_utc)
VALUES
('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Approved', 'CompletedPendingReview', 'Approved', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Chủ trang trại duyệt hoàn thành tốt.', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT ("Id") DO NOTHING;

-- ── 43. FARM INVITATIONS ──────────────────────────────────────────────────────
INSERT INTO farm_invitations ("Id", tenant_id, farm_id, invited_by_owner_id, email, normalized_email, invitee_user_id, status, expires_at_utc, send_count, created_at_utc)
VALUES
('75000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'farmer@smartfarm.demo', 'FARMER@SMARTFARM.DEMO', '20000000-0000-0000-0000-000000000002', 'Accepted', CURRENT_TIMESTAMP + INTERVAL '7 days', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 44. FINANCE TRANSACTIONS ──────────────────────────────────────────────────
INSERT INTO finance_transactions (id, tenant_id, farm_id, transaction_type, expense_category, amount, occurred_at_utc, description, reference, created_by_owner_id, created_at_utc)
VALUES
('74000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Revenue', NULL, 25000000, CURRENT_TIMESTAMP - INTERVAL '5 days', 'Thu tiền bán dưa leo baby đợt 1', 'REV-2026-001', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

-- ── 45. TELEMETRY READINGS ────────────────────────────────────────────────────
INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
VALUES
('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-soil-demo-01', 'SoilMoisture', 52.4, '%', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP),
('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-temp-demo-01', 'Temperature', 25.8, 'C', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP),
('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-humid-demo-01', 'AirHumidity', 68.2, '%', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP),
('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-ph-demo-01', 'Ph', 6.2, 'pH', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

-- ── 46. ALERT RULES, EVALUATION STATES, ALERTS & HISTORY ──────────────────────
INSERT INTO alert_rules (id, zone_id, growth_stage_id, parameter_code, min_threshold, max_threshold, severity, cooldown_minutes, is_active, is_system_generated, created_at_utc)
VALUES
('61000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 'Warning', 30, TRUE, TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

INSERT INTO alert_rule_evaluation_states (alert_rule_id, device_id, consecutive_violation_count, last_violation_at_utc, last_alert_at_utc, last_message_id)
VALUES
('61000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 1, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'msg-soil-demo-01')
ON CONFLICT (alert_rule_id, device_id) DO UPDATE SET consecutive_violation_count = 1;

INSERT INTO alerts (id, tenant_id, farm_id, zone_id, device_id, alert_rule_id, planting_season_id, growth_stage_id, parameter_code, observed_value, min_threshold, max_threshold, unit, severity, status, title, created_at_utc)
VALUES
('62000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 52.4, 55, 75, '%', 'Warning', 'Open', 'Độ ẩm đất thấp hơn ngưỡng tối thiểu 55%', CURRENT_TIMESTAMP - INTERVAL '4 minutes')
ON CONFLICT (id) DO UPDATE SET observed_value = 52.4;

INSERT INTO alert_history_events (id, alert_id, actor_user_id, event_type, notes, created_at_utc)
VALUES
('62100000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Created', 'Cảnh báo độ ẩm đất sinh tự động', CURRENT_TIMESTAMP - INTERVAL '4 minutes')
ON CONFLICT (id) DO NOTHING;

-- ── 47. CONTROL SCHEDULES & AUTO CONTROL RULES ────────────────────────────────
INSERT INTO control_schedules (id, tenant_id, farm_id, zone_id, actuator_id, name, cron_expression, duration_seconds, enable_rain_delay, rain_threshold_percent, is_active, next_run_at_utc, created_at_utc)
VALUES
('64000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'Lịch tưới tự động 7h sáng', '0 7 * * *', 600, TRUE, 70, TRUE, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

INSERT INTO auto_control_rules (id, tenant_id, farm_id, zone_id, name, parameter_code, operator, threshold, condition_duration_minutes, actuator_id, action, duration_seconds, priority, cooldown_minutes, enable_rain_delay, rain_threshold_percent, is_active, created_at_utc)
VALUES
('65000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Tự động kích hoạt bơm khi độ ẩm < 50%', 'SoilMoisture', 'LessThan', 50, 5, '53000000-0000-0000-0000-000000000001', 'TurnOn', 600, 1, 60, TRUE, 80, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

-- ── 48. ACTUATOR COMMANDS & EVENTS ────────────────────────────────────────────
INSERT INTO actuator_commands (id, tenant_id, farm_id, zone_id, actuator_id, device_id, gateway_id, triggered_by_user_id, idempotency_key, trigger_source, action, duration_seconds, status, notes, queued_at_utc, sent_at_utc, acknowledged_at_utc, execution_ends_at_utc, terminal_at_utc, observed_state, created_at_utc)
VALUES
('63000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cmd-irrigate-001', 'Manual', 'TurnOn', 600, 'Acknowledged', 'Bật bơm tưới phân khu 1 bằng tay', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '29 minutes', CURRENT_TIMESTAMP - INTERVAL '28 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', 'Stopped', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO UPDATE SET status = 'Acknowledged';

INSERT INTO actuator_command_events (id, command_id, event_kind, status, occurred_at_utc, detail, observed_state, created_at_utc)
VALUES
('63100000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'Feedback', 'Acknowledged', CURRENT_TIMESTAMP - INTERVAL '28 minutes', 'Thiết bị phản hồi bật relay thành công.', 'Running', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 49. AI CONSULTATION, RECOMMENDATIONS & DECISIONS ──────────────────────────
INSERT INTO ai_consultation_requests (id, tenant_id, farm_id, zone_id, requested_by_user_id, question, context_snapshot, status, provider_name, completed_at_utc, created_at_utc)
VALUES
('66000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Cần tư vấn thời gian tưới cho dưa leo baby giai đoạn ra hoa khi độ ẩm đất 52%?', '{"soil_moisture": 52.4, "temp": 25.8}', 'Completed', 'GeminiAiAdvisoryProvider', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_recommendations (id, consultation_request_id, tenant_id, farm_id, zone_id, growth_stage_id, summary, details, confidence, status, is_actionable, proposed_actuator_id, proposed_action, proposed_duration_seconds, valid_until_utc, sources_json, created_at_utc)
VALUES
('67000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Nên tưới bù ẩm 10 phút vào buổi sáng sớm', 'Độ ẩm đất 52% đang dưới mức tối ưu 65%. Khuyến nghị bật bơm nhỏ giọt 600 giây kết hợp dinh dưỡng EC 1.8.', 0.92, 'Active', TRUE, '53000000-0000-0000-0000-000000000001', 'TurnOn', 600, CURRENT_TIMESTAMP + INTERVAL '1 day', '[]', CURRENT_TIMESTAMP - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_recommendation_decisions (id, recommendation_id, owner_user_id, decision_type, reason, created_at_utc)
VALUES
('68000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Accepted', 'Đồng ý với tư vấn của AI, kích hoạt tưới bổ sung.', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- ── 50. NOTIFICATIONS ─────────────────────────────────────────────────────────
INSERT INTO notifications (id, user_id, tenant_id, title, message, type, severity, is_read, target_url, created_at_utc)
VALUES
('69000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Cảnh báo độ ẩm đất Phân Khu 1', 'Độ ẩm đất hiện tại 52.4%, thấp hơn ngưỡng tối thiểu 55%.', 'Alert', 'Warning', FALSE, '/owner/alerts', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── 51. AUDIT LOGS ────────────────────────────────────────────────────────────
INSERT INTO "AuditLogs" ("Id", "ActorUserId", "ActorName", "ActorRole", "Action", "EntityName", "EntityId", "IpAddress", "Details", "CreatedAtUtc")
VALUES
('99000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Nguyễn Văn Chủ', 'FarmOwner', 'TriggerActuator', 'DeviceActuator', '53000000-0000-0000-0000-000000000001', '127.0.0.1', 'Bật bơm tưới 600 giây bằng tay trên Web Dashboard.', CURRENT_TIMESTAMP)
ON CONFLICT ("Id") DO NOTHING;

-- ── 52. AGRICULTURE DOCUMENTS & CHUNKS (RAG KNOWLEDGE) ────────────────────────
INSERT INTO agriculture_documents (id, title, file_name, file_type, content_text, author_organization, category, crop_scope, region_scope, is_public, review_status, document_type, created_at_utc)
VALUES
('98000000-0000-0000-0000-000000000001', 'Kỹ thuật Trồng Dưa Leo Baby Nhà Màng Công Nghệ Cao', 'ky-thuat-dua-leo-baby.pdf', 'pdf', 'Quy trình tưới nhỏ giọt và kiểm soát ẩm độ tối ưu cho dưa leo baby nhà màng. Duy trì ẩm độ đất từ 60% đến 75%, EC 1.8 - 2.2 mS/cm, pH từ 5.8 đến 6.5.', 'Viện Nghiên cứu Nông nghiệp Công nghệ cao', 'KyThuatCanhTac', 'Dưa leo Baby', 'Tây Nguyên, Lâm Đồng', TRUE, 'Approved', 'OfficialStandard', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO agriculture_knowledge_chunks (id, document_id, chunk_index, content, topic, crop_tags, keywords, status, created_at_utc)
VALUES
('98100000-0000-0000-0000-000000000001', '98000000-0000-0000-0000-000000000001', 1, 'Duy trì ẩm độ đất từ 60% đến 75%, EC 1.8 - 2.2 mS/cm, pH từ 5.8 đến 6.5. Tưới chia nhiều lần trong ngày vào các khung giờ mát.', 'general', 'Dưa leo Baby', 'độ ẩm, dinh dưỡng, tưới', 'Ready', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- ── Cập nhật cây hiện tại cho Zone ─────────────────────────────────────────────
UPDATE zones z SET crop_id = s.crop_id, crop_variety_id = s.variety_id
FROM planting_seasons s
WHERE s.zone_id = z.id AND s.status = 'InProgress'
  AND (SELECT COUNT(*) FROM planting_seasons x WHERE x.zone_id = z.id AND x.status = 'InProgress') = 1
  AND z.crop_id IS NULL;

COMMIT;
