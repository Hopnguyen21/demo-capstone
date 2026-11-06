-- ==============================================================================
-- SmartFarm Comprehensive Local/Demo Seed Data for Testing All CRUD Features
-- Login password for all accounts: Demo@12345
-- ==============================================================================

BEGIN;

-- ── 1. TENANTS ─────────────────────────────────────────────────────────────────
INSERT INTO tenants (id, company_name, subdomain, tax_code, status, address, created_at_utc)
VALUES
('10000000-0000-0000-0000-000000000001', 'SmartFarm Demo Group', 'smartfarm-demo', 'DEMO-001', 'Active', 'Da Lat, Lam Dong', CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000002', 'VinEco Lam Dong HiTech', 'vineco-lamdong', 'VINECO-LD-002', 'Active', 'Duc Trong, Lam Dong', CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000003', 'Da Lat Fresh Greenhouses', 'dalat-fresh', 'DLFRESH-003', 'Active', 'Lac Duong, Lam Dong', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  status = EXCLUDED.status,
  address = EXCLUDED.address;

-- ── 2. APP USERS (Password for all: Demo@12345) ────────────────────────────────
-- Hash: AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==
INSERT INTO app_users (id, email, normalized_email, full_name, phone, password_hash, role, status, tenant_id, farm_id, failed_login_attempts, created_at_utc)
VALUES
('20000000-0000-0000-0000-000000000001', 'owner@smartfarm.demo', 'OWNER@SMARTFARM.DEMO', 'Demo Farm Owner', '0900000001', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'FarmOwner', 'Active', '10000000-0000-0000-0000-000000000001', NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000002', 'farmer@smartfarm.demo', 'FARMER@SMARTFARM.DEMO', 'Demo Farmer', '0900000002', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'Farmer', 'Active', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000003', 'admin@smartfarm.demo', 'ADMIN@SMARTFARM.DEMO', 'Demo Platform Admin', '0900000003', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformAdmin', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000004', 'technician@smartfarm.demo', 'TECHNICIAN@SMARTFARM.DEMO', 'Demo Technician', '0900000004', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformTechnician', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000005', 'farmer2@smartfarm.demo', 'FARMER2@SMARTFARM.DEMO', 'Nguyen Van Binh (Nông dân 2)', '0900000005', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'Farmer', 'Active', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000006', 'owner2@smartfarm.demo', 'OWNER2@SMARTFARM.DEMO', 'Tran Thi Mai (Chủ trang trại 2)', '0900000006', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'FarmOwner', 'Active', '10000000-0000-0000-0000-000000000002', NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000007', 'technician2@smartfarm.demo', 'TECHNICIAN2@SMARTFARM.DEMO', 'Le Hoang Nam (Kỹ thuật viên 2)', '0900000007', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformTechnician', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  status = 'Active',
  failed_login_attempts = 0,
  locked_until_utc = NULL;

-- ── 3. FARMS ───────────────────────────────────────────────────────────────────
INSERT INTO farms (id, tenant_id, name, location_text, latitude, longitude, total_area_m2, time_zone, status, created_at_utc)
VALUES
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Demo Hydroponic Farm', 'Da Lat, Lam Dong', 11.9404, 108.4583, 10000, 'Asia/Ho_Chi_Minh', 'Operating', CURRENT_TIMESTAMP),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Lam Vien Organic Farm', 'Duc Trong, Lam Dong', 11.7500, 108.3800, 15000, 'Asia/Ho_Chi_Minh', 'Operating', CURRENT_TIMESTAMP),
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'LangBiang Smart Berry Farm', 'Lac Duong, Lam Dong', 12.0300, 108.4300, 8000, 'Asia/Ho_Chi_Minh', 'Operating', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  total_area_m2 = EXCLUDED.total_area_m2;

-- ── 4. FIELDS ──────────────────────────────────────────────────────────────────
INSERT INTO fields (id, farm_id, name, area_m2, available_area_m2, soil_type, latitude, longitude, boundary, created_at_utc)
VALUES
('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Demo Field A (Nhà kính chính)', 6000, 3500, 'Loam', 11.9404, 108.4583,
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.457,11.939],[108.460,11.939],[108.460,11.942],[108.457,11.942],[108.457,11.939]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Demo Field B (Vườn ươm giống)', 4000, 2500, 'Hydroponic Substrate', 11.9415, 108.4590,
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.460,11.939],[108.462,11.939],[108.462,11.942],[108.460,11.942],[108.460,11.939]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Khu canh tác Hữu cơ Đức Trọng', 9000, 5000, 'Sandy Loam', 11.7500, 108.3800,
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.378,11.748],[108.382,11.748],[108.382,11.752],[108.378,11.752],[108.378,11.748]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'Khu đồi Dâu Tây Lạc Dương', 5000, 3000, 'Red Basalt', 12.0300, 108.4300,
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.428,12.028],[108.432,12.028],[108.432,12.032],[108.428,12.032],[108.428,12.028]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  area_m2 = EXCLUDED.area_m2,
  available_area_m2 = EXCLUDED.available_area_m2,
  boundary = EXCLUDED.boundary;

-- ── 5. ZONES ───────────────────────────────────────────────────────────────────
INSERT INTO zones (id, field_id, name, area_m2, zone_type, notes, status, boundary, created_at_utc)
VALUES
('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Demo Greenhouse Zone (Zone 1)', 2500, 'Greenhouse', 'Khu nhà màng dưa leo & rau ăn trái.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4575,11.9395],[108.459,11.9395],[108.459,11.941],[108.4575,11.941],[108.4575,11.9395]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', 'Demo Open Air Zone (Zone 2)', 2000, 'OpenField', 'Khu luống canh tác lộ thiên ngoài trời.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4591,11.9395],[108.460,11.9395],[108.460,11.941],[108.4591,11.941],[108.4591,11.9395]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002', 'Demo Hydroponic Nursery Zone (Zone 3)', 1500, 'Hydroponics', 'Dàn thủy canh NFT màng mỏng dinh dưỡng.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4605,11.9395],[108.4615,11.9395],[108.4615,11.941],[108.4605,11.941],[108.4605,11.9395]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('32000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000003', 'Organic Vegetable Zone (Zone 4)', 4000, 'OpenField', 'Khu rau màu hữu cơ tiêu chuẩn VietGAP.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.3785,11.7485],[108.3815,11.7485],[108.3815,11.7515],[108.3785,11.7515],[108.3785,11.7485]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP),
('32000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000004', 'Highland Strawberry Polyhouse (Zone 5)', 2000, 'Polyhouse', 'Nhà kính công nghệ cao dâu tây Hana.', 'Operating',
 ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4285,12.0285],[108.4315,12.0285],[108.4315,12.0315],[108.4285,12.0315],[108.4285,12.0285]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  boundary = EXCLUDED.boundary;

-- ── 6. USER ZONE ACCESSES ──────────────────────────────────────────────────────
INSERT INTO user_zone_accesses (app_user_id, zone_id, can_control, assigned_at_utc)
VALUES
('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', TRUE, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', TRUE, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000003', TRUE, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000004', TRUE, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000005', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (app_user_id, zone_id) DO UPDATE SET
  can_control = TRUE;

-- ── 7. CROPS & VARIETIES ───────────────────────────────────────────────────────
-- System Crops (is_system_defined = true, tenant_id = NULL)
INSERT INTO crops (id, tenant_id, created_by_user_id, name, normalized_name, scientific_name, description, is_system_defined, created_at_utc)
VALUES
('10000000-0000-0000-0000-000000000001', NULL, NULL, 'Cà chua (Tomato)', 'CA CHUA (TOMATO)', 'Solanum lycopersicum', 'Cây cà chua chuẩn hệ thống.', TRUE, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000010', NULL, NULL, 'Dâu tây (Strawberry)', 'DAU TAY (STRAWBERRY)', 'Fragaria ananassa', 'Cây dâu tây chuẩn hệ thống.', TRUE, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000020', NULL, NULL, 'Xà lách Thủy canh (Lettuce)', 'XA LACH THUY CANH (LETTUCE)', 'Lactuca sativa', 'Rau ăn lá thủy canh.', TRUE, CURRENT_TIMESTAMP),
-- Tenant Crops (is_system_defined = false, tenant_id != NULL)
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Dưa leo Baby (Demo Cucumber)', 'DUA LEO BABY (DEMO CUCUMBER)', 'Cucumis sativus', 'Giống dưa chuột baby năng suất cao.', FALSE, CURRENT_TIMESTAMP),
('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Ớt chuông Sweet Pepper', 'OT CHUONG SWEET PEPPER', 'Capsicum annuum', 'Ớt chuông ngọt Hà Lan trồng trong nhà màng.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Varieties
INSERT INTO crop_varieties (id, crop_id, tenant_id, created_by_user_id, name, normalized_name, description, is_system_defined, created_at_utc)
VALUES
('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', NULL, NULL, 'Beef F1', 'BEEF F1', 'Cà chua quả to xuất khẩu.', TRUE, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000010', NULL, NULL, 'Hana Nhật Bản', 'HANA NHAT BAN', 'Giống dâu quả ngọt thơm đậm.', TRUE, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000020', NULL, NULL, 'Lollo Bionda', 'LOLLO BIONDA', 'Xà lách xoăn xanh chịu nhiệt nhẹ.', TRUE, CURRENT_TIMESTAMP),
('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Green F1', 'DEMO GREEN F1', 'Dưa leo chùm quả sai ngọt giòn.', FALSE, CURRENT_TIMESTAMP),
('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Chuông Vàng Syngenta', 'CHUONG VANG SYNGENTA', 'Ớt chuông vàng quả đồng đều dày cơm.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Growth Profiles
INSERT INTO growth_profiles (id, crop_id, variety_id, tenant_id, created_by_user_id, name, normalized_name, description, is_default, is_system_defined, created_at_utc)
VALUES
('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', NULL, NULL, 'Quy trình Cà chua Beef Chuẩn', 'QUY TRINH CA CHUA BEEF CHUAN', 'Quy trình chuẩn nông nghiệp thông minh.', TRUE, TRUE, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000011', NULL, NULL, 'Quy trình Dâu tây Bán canh tác', 'QUY TRINH DAU TAY BAN CANH TAC', 'Quy trình dâu tây nhà kính công nghệ cao.', TRUE, TRUE, CURRENT_TIMESTAMP),
('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Quy trình Dưa leo Thủy canh Demo', 'QUY TRINH DUA LEO THUY CANH DEMO', 'Quy trình sinh trưởng dưa leo baby nhà màng.', TRUE, FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_default = TRUE;

-- Growth Stages
INSERT INTO growth_stages (id, growth_profile_id, name, stage_order, duration_days, created_at_utc)
VALUES
-- Profile 42000000-0000-0000-0000-000000000001
('43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'Vegetative', 1, 30, CURRENT_TIMESTAMP),
('43000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'Harvest', 2, 45, CURRENT_TIMESTAMP),
-- Profile 10000000-0000-0000-0000-000000000003
('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Seedling', 1, 20, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Vegetative', 2, 30, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'Flowering', 3, 25, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'Harvest', 4, 30, CURRENT_TIMESTAMP),
-- Profile 10000000-0000-0000-0000-000000000012
('10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000012', 'Ươm giống & Bén rễ', 1, 20, CURRENT_TIMESTAMP),
('10000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000012', 'Nuôi ngọn & Đậu quả', 2, 35, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_days = EXCLUDED.duration_days;

-- Environmental Requirements
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit)
VALUES
('43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 65, '%'),
('43000000-0000-0000-0000-000000000001', 'Temperature', 20, 30, 25, 'C'),
('43000000-0000-0000-0000-000000000001', 'AirHumidity', 55, 80, 68, '%'),
('43000000-0000-0000-0000-000000000001', 'Ph', 5.5, 6.8, 6.2, 'pH'),
('10000000-0000-0000-0000-000000000005', 'SoilMoisture', 60, 80, 70, '%'),
('10000000-0000-0000-0000-000000000005', 'Temperature', 18, 28, 24, 'C'),
('10000000-0000-0000-0000-000000000005', 'AirHumidity', 60, 85, 72, '%'),
('10000000-0000-0000-0000-000000000005', 'Ph', 5.8, 6.5, 6.2, 'pH'),
('10000000-0000-0000-0000-000000000013', 'SoilMoisture', 65, 85, 75, '%'),
('10000000-0000-0000-0000-000000000013', 'Temperature', 15, 25, 20, 'C'),
('10000000-0000-0000-0000-000000000013', 'AirHumidity', 65, 85, 75, '%'),
('10000000-0000-0000-0000-000000000013', 'Ph', 5.5, 6.5, 6.0, 'pH')
ON CONFLICT (growth_stage_id, parameter_code) DO UPDATE SET
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  target_value = EXCLUDED.target_value,
  unit = EXCLUDED.unit;

-- ── 8. PLANTING SEASONS ────────────────────────────────────────────────────────
INSERT INTO planting_seasons (id, zone_id, crop_id, variety_id, growth_profile_id, current_growth_stage_id, name, start_date, expected_end_date, status, created_at_utc)
VALUES
('44000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Vụ Dưa leo Baby Mùa Xuân 2026', CURRENT_DATE - 15, CURRENT_DATE + 75, 'InProgress', CURRENT_TIMESTAMP),
('44000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'Vụ Cà chua Beef Xuất khẩu Hè 2026', CURRENT_DATE - 5, CURRENT_DATE + 90, 'InProgress', CURRENT_TIMESTAMP),
('44000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000013', 'Vụ Dâu tây Hana Thu Đông 2026', CURRENT_DATE + 10, CURRENT_DATE + 120, 'Planned', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  expected_end_date = EXCLUDED.expected_end_date;

INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT '44000000-0000-0000-0000-000000000001', parameter_code, min_value, max_value, target_value, unit
FROM environmental_requirements WHERE growth_stage_id = '43000000-0000-0000-0000-000000000001'
ON CONFLICT (planting_season_id, parameter_code) DO UPDATE SET
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  target_value = EXCLUDED.target_value,
  unit = EXCLUDED.unit;

-- ── 9. GATEWAYS & DEVICES ──────────────────────────────────────────────────────
INSERT INTO deployment_requests (id, tenant_id, farm_id, zone_id, planting_season_id, owner_user_id, technician_user_id, status, required_parameters_csv, owner_notes, submitted_at_utc, completed_at_utc, created_at_utc)
VALUES
('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Completed', 'SoilMoisture,Temperature,AirHumidity,Ph', 'Triển khai hệ thống IoT Zone 1 & 2.', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '26 days'),
('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'PlanConfirmed', 'SoilMoisture,Temperature,AirHumidity', 'Yêu cầu lắp đặt cảm biến độ ẩm đất Farm Đà Lạt Zone 2.', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, CURRENT_TIMESTAMP - INTERVAL '4 days')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  technician_user_id = EXCLUDED.technician_user_id;

INSERT INTO gateways (id, farm_id, deployment_request_id, mac_address, gateway_serial, frequency_band, firmware_version, status, last_seen_at_utc, mqtt_client_id, client_certificate_fingerprint, created_at_utc)
VALUES
('51000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'AA:BB:CC:DD:EE:01', 'GW-DEMO-001', 'AS923', 'v2.1.0-release', 'Online', CURRENT_TIMESTAMP - INTERVAL '30 seconds', 'smartfarm-demo-gateway', repeat('A', 64), CURRENT_TIMESTAMP - INTERVAL '20 days'),
('51000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'AA:BB:CC:DD:EE:02', 'GW-ECO-002', 'AS923', 'v2.1.0-release', 'Online', CURRENT_TIMESTAMP - INTERVAL '1 minute', 'smartfarm-eco-gw-02', repeat('B', 64), CURRENT_TIMESTAMP - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET
  status = 'Online',
  last_seen_at_utc = EXCLUDED.last_seen_at_utc,
  firmware_version = EXCLUDED.firmware_version;

INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, installation_notes, created_at_utc)
VALUES
('52000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'SENSOR-DEMO-001', 'SensorNode', 'Online', 'Cụm cảm biến trung tâm Zone 1.', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('52000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'ACTUATOR-DEMO-001', 'ActuatorNode', 'Online', 'Tủ điều khiển tưới & quạt gió Zone 1.', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('52000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 'SENSOR-DEMO-002', 'SensorNode', 'Online', 'Cảm biến đất luống ngoài trời Zone 2.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('52000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 'ACTUATOR-DEMO-002', 'ActuatorNode', 'Online', 'Van solenoid tưới nhỏ giọt Zone 2.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('52000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', 'SENSOR-DEMO-003', 'SensorNode', 'Online', 'Bộ giám sát pH & EC bể dinh dưỡng thủy canh Zone 3.', CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET
  zone_id = EXCLUDED.zone_id,
  status = 'Online',
  installation_notes = EXCLUDED.installation_notes;

-- Actuators
INSERT INTO device_actuators (id, device_id, actuator_type, relay_channel, rated_power_watt, flow_rate_liters_per_minute, max_duration_minutes, created_at_utc)
VALUES
('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', 'IrrigationPump', 1, 1200, 10, 30, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('53000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'VentilationFan', 2, 550, 0, 30, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('53000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000002', 'MistSprayer', 3, 750, 4, 20, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('53000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000004', 'IrrigationPump', 1, 800, 15, 30, CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET
  rated_power_watt = EXCLUDED.rated_power_watt,
  flow_rate_liters_per_minute = EXCLUDED.flow_rate_liters_per_minute,
  max_duration_minutes = EXCLUDED.max_duration_minutes;

-- Sensors
INSERT INTO device_sensors (id, device_id, sensor_type, pin, model, interface, unit, min_value, max_value, sampling_interval_sec, created_at_utc)
VALUES
('55000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'SoilMoisture', 'A0', 'RS485-SM-10', 'RS485', '%', 0, 100, 30, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('55000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Temperature', 'I2C_SDA', 'SHT30-DIS', 'I2C', 'C', -10, 60, 30, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('55000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', 'AirHumidity', 'I2C_SCL', 'SHT30-DIS', 'I2C', '%', 0, 100, 30, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('55000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000001', 'Ph', 'A1', 'PH-4502C', 'Analog', 'pH', 0, 14, 60, CURRENT_TIMESTAMP - INTERVAL '20 days'),
('55000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000003', 'SoilMoisture', 'A0', 'RS485-SM-10', 'RS485', '%', 0, 100, 30, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('55000000-0000-0000-0000-000000000006', '52000000-0000-0000-0000-000000000003', 'Temperature', 'I2C_SDA', 'SHT30-DIS', 'I2C', 'C', -10, 60, 30, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('55000000-0000-0000-0000-000000000007', '52000000-0000-0000-0000-000000000005', 'Ph', 'A0', 'PH-INDUSTRIAL', 'Analog', 'pH', 0, 14, 30, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('55000000-0000-0000-0000-000000000008', '52000000-0000-0000-0000-000000000005', 'Ec', 'A1', 'EC-INDUSTRIAL', 'Analog', 'mS/cm', 0, 10, 30, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET
  model = EXCLUDED.model,
  unit = EXCLUDED.unit;

-- Connection tests
INSERT INTO device_connection_tests (id, device_id, deployment_request_id, technician_user_id, succeeded, rssi, snr, round_trip_latency_ms, observed_at_utc, created_at_utc)
VALUES
('54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', TRUE, -72, 8.5, 45, CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
('54000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', TRUE, -68, 9.2, 38, CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute')
ON CONFLICT (id) DO UPDATE SET succeeded = TRUE;

-- ── 10. TELEMETRY READINGS ─────────────────────────────────────────────────────
INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
VALUES
-- Zone 1
('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-soil-z1-1', 'SoilMoisture', 52.0, '%', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes'),
('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-temp-z1-1', 'Temperature', 26.5, 'C', CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP - INTERVAL '8 minutes', CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-hum-z1-1', 'AirHumidity', 68.0, '%', CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP - INTERVAL '6 minutes', CURRENT_TIMESTAMP - INTERVAL '6 minutes'),
('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-ph-z1-1', 'Ph', 6.2, 'pH', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-soil-z1-2', 'SoilMoisture', 49.5, '%', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'msg-temp-z1-2', 'Temperature', 28.0, 'C', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute'),
-- Zone 2
('60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 'msg-soil-z2-1', 'SoilMoisture', 62.0, '%', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
('60000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 'msg-temp-z2-1', 'Temperature', 24.2, 'C', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '3 minutes'),
-- Zone 3
('60000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000001', 'msg-ph-z3-1', 'Ph', 6.0, 'pH', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
('60000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000001', 'msg-ec-z3-1', 'Ec', 1.85, 'mS/cm', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes')
ON CONFLICT (id) DO UPDATE SET
  value = EXCLUDED.value,
  captured_at_utc = EXCLUDED.captured_at_utc;

-- ── 11. ALERT RULES & ALERTS ───────────────────────────────────────────────────
INSERT INTO alert_rules (id, zone_id, growth_stage_id, parameter_code, min_threshold, max_threshold, severity, cooldown_minutes, is_active, is_system_generated, created_at_utc)
VALUES
('61000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 'Warning', 30, TRUE, TRUE, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('61000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Temperature', 18, 32, 'Critical', 20, TRUE, TRUE, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('61000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'AirHumidity', 50, 85, 'Warning', 30, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('61000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Ph', 5.5, 6.8, 'Warning', 30, TRUE, FALSE, CURRENT_TIMESTAMP - INTERVAL '8 days')
ON CONFLICT (id) DO UPDATE SET
  min_threshold = EXCLUDED.min_threshold,
  max_threshold = EXCLUDED.max_threshold,
  is_active = TRUE;

INSERT INTO alerts (id, tenant_id, farm_id, zone_id, device_id, alert_rule_id, planting_season_id, growth_stage_id, parameter_code, observed_value, min_threshold, max_threshold, unit, severity, status, title, created_at_utc)
VALUES
('62000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 49.5, 55, 75, '%', 'Warning', 'Open', 'Độ ẩm đất Zone 1 thấp hơn ngưỡng an toàn (49.5% < 55%)', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
('62000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'AirHumidity', 88.0, 50, 85, '%', 'Warning', 'Acknowledged', 'Độ ẩm không khí nhà kính Zone 1 tăng cao (88% > 85%)', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
('62000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Ph', 5.2, 5.5, 6.8, 'pH', 'Warning', 'Open', 'Nồng độ pH Zone 1 giảm thấp (5.2 < 5.5)', CURRENT_TIMESTAMP - INTERVAL '5 minutes')
ON CONFLICT (id) DO UPDATE SET
  observed_value = EXCLUDED.observed_value,
  status = EXCLUDED.status;

INSERT INTO alert_history_events (id, alert_id, actor_user_id, event_type, notes, created_at_utc)
VALUES
('62100000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', NULL, 'Created', 'Phát hiện cảm biến độ ẩm dưới ngưỡng.', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
('62100000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Acknowledged', 'Chủ trang trại đã xem và chỉ đạo bật quạt gió.', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- ── 12. CONTROL SCHEDULES & AUTO RULES & COMMANDS ──────────────────────────────
INSERT INTO control_schedules (id, tenant_id, farm_id, zone_id, actuator_id, name, cron_expression, duration_seconds, enable_rain_delay, rain_threshold_percent, is_active, next_run_at_utc, created_at_utc)
VALUES
('64000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'Tưới nhỏ giọt buổi sáng Zone 1', '0 6 * * *', 600, TRUE, 70, TRUE, CURRENT_TIMESTAMP + INTERVAL '12 hours', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('64000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000002', 'Bật quạt thông gió giữa trưa Zone 1', '0 12 * * *', 900, FALSE, 0, TRUE, CURRENT_TIMESTAMP + INTERVAL '18 hours', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('64000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000003', 'Phun sương tạo ẩm buổi chiều Zone 1', '0 15 * * *', 300, FALSE, 0, TRUE, CURRENT_TIMESTAMP + INTERVAL '21 hours', CURRENT_TIMESTAMP - INTERVAL '8 days'),
('64000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000004', 'Tưới luống ngoài trời Zone 2', '30 6 * * *', 900, TRUE, 80, TRUE, CURRENT_TIMESTAMP + INTERVAL '12 hours 30 minutes', CURRENT_TIMESTAMP - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cron_expression = EXCLUDED.cron_expression,
  is_active = TRUE;

INSERT INTO auto_control_rules (id, tenant_id, farm_id, zone_id, actuator_id, name, parameter_code, operator, threshold, condition_duration_minutes, action, duration_seconds, priority, cooldown_minutes, enable_rain_delay, rain_threshold_percent, is_active, created_at_utc)
VALUES
('65000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'Tự động tưới khi đất khô Zone 1', 'SoilMoisture', 'LessThan', 50.0, 5, 'TurnOn', 600, 1, 60, TRUE, 70, TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('65000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000002', 'Bật quạt khi nhiệt độ phòng vượt ngưỡng Zone 1', 'Temperature', 'GreaterThan', 30.0, 3, 'TurnOn', 900, 2, 30, FALSE, 0, TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('65000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000003', 'Phun sương khi không khí hanh khô Zone 1', 'AirHumidity', 'LessThan', 55.0, 5, 'TurnOn', 300, 3, 45, FALSE, 0, TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  threshold = EXCLUDED.threshold,
  is_active = TRUE;

INSERT INTO actuator_commands (id, tenant_id, farm_id, zone_id, actuator_id, device_id, gateway_id, triggered_by_user_id, idempotency_key, trigger_source, action, duration_seconds, status, notes, queued_at_utc, sent_at_utc, acknowledged_at_utc, execution_ends_at_utc, terminal_at_utc, observed_state, created_at_utc)
VALUES
('63000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cmd-irrigate-001', 'Manual', 'TurnOn', 600, 'Acknowledged', 'Lệnh tưới bơm thủ công hoàn thành.', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '29 minutes', CURRENT_TIMESTAMP - INTERVAL '28 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', 'Stopped', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO UPDATE SET
  status = 'Acknowledged';

INSERT INTO actuator_command_events (id, command_id, event_kind, status, occurred_at_utc, detail, observed_state, created_at_utc)
VALUES
('63100000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'Feedback', 'Acknowledged', CURRENT_TIMESTAMP - INTERVAL '28 minutes', 'Thiết bị phản hồi thành công qua MQTT.', 'Running', CURRENT_TIMESTAMP - INTERVAL '28 minutes')
ON CONFLICT (id) DO NOTHING;

-- ── 13. PLATFORM HARDWARE ITEMS (Central Catalog & Inventory) ──────────────────
INSERT INTO "PlatformHardwareItems" ("Id", "Code", "Name", "Category", "Model", "Manufacturer", "SerialNumber", "MacAddress", "QuantityInStock", "LocationRack", "UnitPrice", "Status", "AssignedTechnicianId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES
('75000000-0000-0000-0000-000000000001', 'GW-ESP32-DL01', 'Trạm Central Gateway ESP32-LoRa Dual Antenna', 'GATEWAY', 'ESP32-S3 WROOM-32U', 'DFRobot IoT', 'SN-GW-2026-0089', '24:DC:C3:98:A1:04', 8, 'Kệ A1 - Tầng 2 (Kho Trung tâm)', 2800000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '30 days', NULL),
('75000000-0000-0000-0000-000000000002', 'GW-ESP32-DT02', 'Gateway Trạm Phụ ESP32-LoRa Outdoor IP67', 'GATEWAY', 'ESP32 LoRa IP67', 'Satech IoT', 'SN-GW-2026-0092', '24:DC:C3:98:B5:12', 4, 'Kệ A1 - Tầng 3', 2200000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '25 days', NULL),
('75000000-0000-0000-0000-000000000003', 'SN-SOIL-RS485', 'Cảm biến Độ ẩm & EC Đất Công nghiệp RS485', 'SOIL_SENSOR', 'FDR-RS485-M10', 'Davis Instruments', 'SN-SOIL-2026-041', '24:DC:C3:98:C3:22', 20, 'Kệ B1 - Tầng 2', 1250000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '20 days', NULL),
('75000000-0000-0000-0000-000000000004', 'SN-AIR-SHT30', 'Node Cảm biến Nhiệt độ - Độ ẩm Không khí Sensirion', 'AIR_SENSOR', 'Sensirion SHT30 + CO2', 'Sensirion AG', 'SN-AIR-2026-088', '24:DC:C3:98:AR-02', 15, 'Kệ B2 - Tầng 2', 850000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '18 days', NULL),
('75000000-0000-0000-0000-000000000005', 'ACT-VALVE-01', 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng', 'VALVE', 'Relay Module 4-CH 24V', 'Omron Automation', 'ACT-2026-VAL-01', '24:DC:C3:98:VL-01', 12, 'Kệ C1 - Tầng 1', 950000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '15 days', NULL),
('75000000-0000-0000-0000-000000000006', 'ACT-PUMP-02', 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động', 'PUMP', 'PWM Peristaltic Pump Driver', 'Kamoer Pump', 'ACT-2026-PMP-02', '24:DC:C3:98:PM-02', 6, 'Kệ C1 - Tầng 2', 1650000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '12 days', NULL),
('75000000-0000-0000-0000-000000000007', 'SP-BAT-37V', 'Pin Lithium 3.7V 5000mAh Solar Grade', 'SPARE_PART', 'Li-ion 21700 3.7V', 'Panasonic Energy', 'SN-BAT-2026-101', '', 30, 'Kệ D1 - Tầng 1', 280000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '10 days', NULL),
('75000000-0000-0000-0000-000000000008', 'SP-RELAY-4CH', 'Mạch Relay 4 Kênh Cách ly Quang 24V DC', 'SPARE_PART', 'Optocoupler Relay 24V', 'Finder Relays', 'SN-REL-2026-202', '', 18, 'Kệ D1 - Tầng 2', 190000, 'Available', NULL, CURRENT_TIMESTAMP - INTERVAL '10 days', NULL),
('75000000-0000-0000-0000-000000000009', 'SN-LORA-001', 'Node Cảm biến Vi khí hậu SN-TOM-01 (Đà Lạt A1)', 'SENSOR_NODE', 'Custom LoRa Node v2.1', 'SmartFarm Core', 'SN-NODE-9901', '24:DC:C3:88:11:01', 0, 'Đã xuất thực địa (Trang trại Đà Lạt)', 1100000, 'Deployed', '20000000-0000-0000-0000-000000000004', CURRENT_TIMESTAMP - INTERVAL '25 days', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "Name" = EXCLUDED."Name",
  "QuantityInStock" = EXCLUDED."QuantityInStock",
  "UnitPrice" = EXCLUDED."UnitPrice",
  "Status" = EXCLUDED."Status";

-- ── 14. PLATFORM SETTINGS ──────────────────────────────────────────────────────
INSERT INTO "PlatformSettings" ("Key", "Value", "Group", "DataType", "Description", "IsSecret", "UpdatedByUserId", "UpdatedAtUtc")
VALUES
('Gemini:ApiKey', 'AIzaSyDemoSmartFarmKeySecret12345', 'AI', 'String', 'API Key kết nối Google Gemini AI cho tính năng tư vấn nông nghiệp.', TRUE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
('Gemini:Model', 'gemini-2.5-flash', 'AI', 'String', 'Mô hình AI Gemini phục vụ phân tích khuyến nghị mùa vụ.', FALSE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
('Gemini:TimeoutSeconds', '30', 'AI', 'Integer', 'Thời gian chờ tối đa khi gửi yêu cầu AI (giây).', FALSE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
('Weather:ApiKey', 'mock-openmeteo-weather-key-999', 'Weather', 'String', 'Khóa xác thực dịch vụ dự báo thời tiết OpenMeteo.', FALSE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
('Mqtt:BrokerUrl', 'mqtt://broker.emqx.io:1883', 'IoT', 'String', 'Địa chỉ máy chủ MQTT Broker cho Gateways và Actuators.', FALSE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP),
('System:MaintenanceMode', 'false', 'System', 'Boolean', 'Kích hoạt chế độ bảo trì hệ thống toàn sàn.', FALSE, '20000000-0000-0000-0000-000000000003', CURRENT_TIMESTAMP)
ON CONFLICT ("Key") DO UPDATE SET
  "Value" = EXCLUDED."Value",
  "UpdatedAtUtc" = CURRENT_TIMESTAMP;

-- ── 15. AUDIT LOGS ─────────────────────────────────────────────────────────────
INSERT INTO "AuditLogs" ("Id", "ActorUserId", "ActorName", "ActorRole", "Action", "EntityName", "EntityId", "IpAddress", "UserAgent", "Details", "CreatedAtUtc")
VALUES
('76000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Demo Platform Admin', 'PlatformAdmin', 'LOGIN', 'AppUser', '20000000-0000-0000-0000-000000000003', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Đăng nhập trang quản trị Platform Admin thành công.', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('76000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Demo Farm Owner', 'FarmOwner', 'CREATE_FARM', 'Farm', '30000000-0000-0000-0000-000000000002', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Khởi tạo thành công trang trại mới: Lam Vien Organic Farm.', CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes'),
('76000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'Demo Technician', 'PlatformTechnician', 'PROVISION_GATEWAY', 'Gateway', '51000000-0000-0000-0000-000000000001', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Khai báo thiết bị Gateway GW-DEMO-001 kiểm tra tín hiệu LoRa.', CURRENT_TIMESTAMP - INTERVAL '1 hour 20 minutes'),
('76000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Demo Farm Owner', 'FarmOwner', 'CREATE_SCHEDULE', 'ControlSchedule', '64000000-0000-0000-0000-000000000001', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Tạo lịch tưới tự động Zone 1 lúc 06:00 mỗi ngày.', CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
('76000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Demo Farm Owner', 'FarmOwner', 'ACK_ALERT', 'Alert', '62000000-0000-0000-0000-000000000002', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Xác nhận cảnh báo độ ẩm không khí tăng cao Zone 1.', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT ("Id") DO NOTHING;

-- ── 16. INVENTORY ITEMS & TRANSACTIONS & LOW STOCK ALERTS ──────────────────────
INSERT INTO inventory_items ("Id", tenant_id, farm_id, name, normalized_name, material_type, unit, quantity_on_hand, low_stock_threshold, created_at_utc)
VALUES
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Demo NPK Fertilizer Haifa', 'DEMO NPK FERTILIZER HAIFA', 'Fertilizer', 'kg', 65, 30, CURRENT_TIMESTAMP - INTERVAL '15 days'),
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Dung dịch dinh dưỡng Thủy canh Hydro Umat V', 'DUNG DICH DINH DUONG THUY CANH HYDRO UMAT V', 'Fertilizer', 'lít', 120, 50, CURRENT_TIMESTAMP - INTERVAL '12 days'),
('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Giá thể xơ dừa vi sinh Bến Tre đã xử lý', 'GIA THE XO DUA VI SINH BEN TRE DA XU LY', 'GrowingMedium', 'bao', 25, 40, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Hạt giống Dưa leo F1 Green Valley', 'HAT GIONG DUA LEO F1 GREEN VALLEY', 'Seed', 'gói', 15, 10, CURRENT_TIMESTAMP - INTERVAL '8 days')
ON CONFLICT ("Id") DO UPDATE SET
  name = EXCLUDED.name,
  normalized_name = EXCLUDED.normalized_name,
  quantity_on_hand = EXCLUDED.quantity_on_hand,
  low_stock_threshold = EXCLUDED.low_stock_threshold;

INSERT INTO inventory_transactions ("Id", tenant_id, farm_id, inventory_item_id, movement_type, quantity, balance_after, actor_user_id, zone_id, notes, created_at_utc)
VALUES
('71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Receipt', 100, 100, '20000000-0000-0000-0000-000000000001', NULL, 'Nhập kho phân bón đầu vụ từ nhà cung cấp Haifa.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Issue', 35, 65, '20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'Xuất bón đợt 1 cho Zone 1.', CURRENT_TIMESTAMP - INTERVAL '4 days'),
('71000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'Receipt', 50, 50, '20000000-0000-0000-0000-000000000001', NULL, 'Nhập giá thể xơ dừa.', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('71000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'Issue', 25, 25, '20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'Vào bầu ươm Zone 1.', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET
  quantity = EXCLUDED.quantity,
  balance_after = EXCLUDED.balance_after;

INSERT INTO low_stock_alerts ("Id", tenant_id, farm_id, inventory_item_id, status, quantity_at_open, opened_at_utc, created_at_utc)
VALUES
('72000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'Open', 25, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET
  status = 'Open',
  quantity_at_open = 25;

-- ── 17. FARM TASKS ─────────────────────────────────────────────────────────────
INSERT INTO farm_tasks ("Id", tenant_id, farm_id, zone_id, title, description, requirements, due_at_utc, assigned_farmer_id, created_by_owner_id, status, result, accepted_at_utc, started_at_utc, submitted_at_utc, approved_at_utc, assignment_version, created_at_utc)
VALUES
('73000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Kiểm tra đường ống tưới nhỏ giọt Zone 1', 'Kiểm tra toàn bộ béc tưới và khớp nối xem có rò rỉ hay tắc nghẽn.', 'Xác nhận không còn điểm nghẹt.', CURRENT_TIMESTAMP + INTERVAL '2 days', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Approved', 'Đã thông 2 béc nghẹt, hệ thống hoạt động tốt.', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 1, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('73000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', 'Bổ sung dung dịch dinh dưỡng cho dàn thủy canh Zone 3', 'Pha dung dịch dinh dưỡng Hydro Umat V theo tỷ lệ EC 1.8 và pH 6.0.', 'Đo và ghi lại chỉ số sau khi pha.', CURRENT_TIMESTAMP + INTERVAL '1 day', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'InProgress', NULL, CURRENT_TIMESTAMP - INTERVAL '5 hours', CURRENT_TIMESTAMP - INTERVAL '4 hours', NULL, NULL, 1, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('73000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 'Tỉa cành phụ và buộc dây leo giàn cà chua Zone 2', 'Tỉa các nhánh phụ sát gốc, quấn thân cà chua vào dây đỡ.', 'Buộc chắc chắn không gãy ngọn.', CURRENT_TIMESTAMP + INTERVAL '3 days', '20000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Accepted', NULL, CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL, NULL, NULL, 1, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('73000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Vệ sinh tấm lưới lọc đầu nguồn và châm phân', 'Tháo cốc lọc đĩa, rửa sạch cặn phèn và lắp lại đúng gioăng.', 'Kiểm tra áp lực nước sau lọc.', CURRENT_TIMESTAMP + INTERVAL '1 day', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'CompletedPendingReview', 'Đã rửa sạch màng lọc, áp lực đạt 2.2 bar.', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '3 hours', NULL, 1, CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  result = EXCLUDED.result;

INSERT INTO farm_task_history ("Id", farm_task_id, actor_user_id, event_type, from_status, to_status, previous_assignee_id, new_assignee_id, notes, created_at_utc)
VALUES
('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Approved', 'CompletedPendingReview', 'Approved', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Chủ trang trại đã nghiệm thu hoàn thành.', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT ("Id") DO NOTHING;

-- ── 18. FINANCE TRANSACTIONS ───────────────────────────────────────────────────
INSERT INTO finance_transactions (id, tenant_id, farm_id, transaction_type, expense_category, amount, occurred_at_utc, description, reference, created_by_owner_id, created_at_utc)
VALUES
('74000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Revenue', NULL, 35000000, CURRENT_TIMESTAMP - INTERVAL '8 days', 'Doanh thu thu hoạch Cà chua Beef đợt 1', 'REV-2026-TOM-01', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '8 days'),
('74000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Revenue', NULL, 18500000, CURRENT_TIMESTAMP - INTERVAL '4 days', 'Doanh thu xuất kho Dưa leo Baby tuần 38', 'REV-2026-CUC-02', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '4 days'),
('74000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Expense', 'Material', 8200000, CURRENT_TIMESTAMP - INTERVAL '15 days', 'Mua phân bón NPK và hạt giống F1 đầu vụ', 'EXP-2026-MAT-01', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('74000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Expense', 'IoT', 3450000, CURRENT_TIMESTAMP - INTERVAL '10 days', 'Tiền điện bơm tưới và chiếu sáng LED nông nghiệp', 'EXP-2026-UTL-01', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('74000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Expense', 'Farmer', 4500000, CURRENT_TIMESTAMP - INTERVAL '5 days', 'Chi trả phụ cấp công nhật nông dân làm cỏ và tỉa cành', 'EXP-2026-LAB-01', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '5 days')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  occurred_at_utc = EXCLUDED.occurred_at_utc;

-- ── 19. SERVICE REQUESTS, QUOTATIONS & PAYMENTS ────────────────────────────────
INSERT INTO service_requests (id, tenant_id, farm_id, zone_id, deployment_request_id, device_id, current_device_id, source, failure_code, description, status, created_by_owner_id, assigned_technician_id, inspection_notes, diagnosis, resolution_action, work_performed, accepted_at_utc, closed_at_utc, created_at_utc)
VALUES
('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'Owner', 'DEMO_CHECK', 'Bảo dưỡng định kỳ tủ điều khiển bơm và van tưới.', 'Closed', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Kiểm tra đấu nối và tiếp điểm relay.', 'Lỏng đầu cốt dây bơm.', 'Repair', 'Siết chặt đầu cốt và bọc co nhiệt chống ẩm.', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '8 days'),
('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000003', 'Owner', 'NEW_INSTALL', 'Yêu cầu lắp đặt bổ sung cảm biến độ ẩm đất và van tưới Zone 2.', 'Assigned', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Khảo sát địa hình luống ngoài trời Zone 2.', 'Cần 1 node cảm biến và 1 van 24V.', 'Maintenance', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days', NULL, CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  assigned_technician_id = EXCLUDED.assigned_technician_id;

INSERT INTO service_request_history (id, service_request_id, actor_user_id, event_type, from_status, to_status, notes, created_at_utc)
VALUES
('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Closed', 'Verified', 'Closed', 'Hoàn tất bảo dưỡng hệ thống điều khiển.', CURRENT_TIMESTAMP - INTERVAL '6 days'),
('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Assigned', 'Open', 'Assigned', 'Admin phân công Kỹ thuật viên phụ trách.', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Quotation for Service Request 2
INSERT INTO "ServiceRequestQuotations" ("Id", "ServiceRequestId", "TechnicianUserId", "Subtotal", "VatPercent", "VatAmount", "TotalAmount", "Deposit30Percent", "Remaining70Percent", "Notes", "ContractTerms", "Status", "CreatedAtUtc", "UpdatedAtUtc")
VALUES
('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 5000000, 8, 400000, 5400000, 1620000, 3780000, 'Báo giá thiết bị lắp đặt cảm biến độ ẩm đất và van tưới Zone 2.', 'Bảo hành 12 tháng chính hãng. Đặt cọc 30% khi ký hợp đồng, 70% sau khi nghiệm thu.', 'DepositPaid', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "TotalAmount" = EXCLUDED."TotalAmount",
  "Status" = EXCLUDED."Status";

INSERT INTO "ServiceRequestQuotationItems" ("Id", "QuotationId", "HardwareItemCode", "HardwareItemName", "Category", "Unit", "Quantity", "UnitPrice", "VatPercent", "TotalAmount", "Notes")
VALUES
('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'SN-SOIL-RS485', 'Cảm biến Độ ẩm & EC Đất Công nghiệp RS485', 'SOIL_SENSOR', 'Bộ', 2, 1250000, 8, 2700000, 'Cắm trực tiếp tại luống cà chua.'),
('83000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', 'ACT-VALVE-01', 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng', 'VALVE', 'Bộ', 1, 950000, 8, 1026000, 'Lắp đặt tại tủ phân phối Zone 2.'),
('83000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', 'LABOR-INSTALL', 'Công khảo sát và thi công đấu nối thực địa', 'SERVICE', 'Gói', 1, 1550000, 8, 1674000, 'Bao gồm dây tín hiệu và ống bảo vệ.')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "ServiceRequestPayments" ("Id", "ServiceRequestId", "QuotationId", "PaymentStage", "Amount", "PaymentMethod", "TransactionReference", "SignerFullName", "SignatureHash", "Status", "PaidAtUtc", "ConfirmedByAdminId")
VALUES
('84000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', 'DEPOSIT_30', 1620000, 'BankTransfer', 'VNPAY-DEP-820001', 'Demo Farm Owner', 'SIG-SHA256-OWNER-DEMO-DEPOSIT', 'Confirmed', CURRENT_TIMESTAMP - INTERVAL '1 day', '20000000-0000-0000-0000-000000000003')
ON CONFLICT ("Id") DO NOTHING;

-- ── 20. AI CONSULTATION & RECOMMENDATIONS ──────────────────────────────────────
INSERT INTO ai_consultation_requests (id, tenant_id, farm_id, zone_id, requested_by_user_id, parent_recommendation_id, question, context_snapshot, missing_data_csv, status, provider_name, completed_at_utc, created_at_utc, updated_at_utc)
VALUES
('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', NULL, 'Độ ẩm đất đang giảm xuống 49.5%, tôi có nên tưới ngay không và thời lượng bao lâu?', '{"soil_moisture": 49.5, "temperature": 28.0, "stage": "Vegetative"}'::jsonb, '', 'Completed', 'Gemini-2.5-Flash', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '11 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes')
ON CONFLICT (id) DO UPDATE SET
  status = 'Completed';

INSERT INTO ai_recommendations (id, consultation_request_id, tenant_id, farm_id, zone_id, growth_stage_id, summary, details, limitations, confidence, status, is_actionable, valid_until_utc, proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc, updated_at_utc)
VALUES
('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Nên tưới nhỏ giọt 10 phút để đưa độ ẩm đất về ngưỡng tối ưu 65%', 'Độ ẩm đất hiện tại ở mức 49.5%, thấp hơn ngưỡng tối thiểu 55% của giai đoạn cây con. Nhiệt độ môi trường 28°C thuận lợi cho việc hấp thụ nước. Khuyến nghị bật bơm tưới nhỏ giọt trong 600 giây (10 phút).', 'Cần kiểm tra cảm biến sau khi tưới 15 phút để đảm bảo nước ngấm đều.', 0.92, 'Accepted', TRUE, CURRENT_TIMESTAMP + INTERVAL '2 hours', '53000000-0000-0000-0000-000000000001', 'TurnOn', 600, CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes')
ON CONFLICT (id) DO UPDATE SET
  summary = EXCLUDED.summary,
  confidence = EXCLUDED.confidence,
  status = 'Accepted';

INSERT INTO ai_recommendation_decisions (id, recommendation_id, owner_user_id, decision_type, reason, actuator_command_id, follow_up_consultation_id, created_at_utc, updated_at_utc)
VALUES
('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Accepted', 'Đồng ý với khuyến nghị AI và kích hoạt tưới tức thì.', '63000000-0000-0000-0000-000000000001', NULL, CURRENT_TIMESTAMP - INTERVAL '9 minutes', CURRENT_TIMESTAMP - INTERVAL '9 minutes')
ON CONFLICT (id) DO NOTHING;

COMMIT;
