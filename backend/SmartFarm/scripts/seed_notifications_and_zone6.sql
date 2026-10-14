-- Seed data for Notifications and Multi-Zone test cases
-- 1. Thêm các Notifications mẫu cho Farm Owner và Farmer
INSERT INTO notifications (id, user_id, tenant_id, title, message, type, severity, is_read, read_at_utc, target_url, reference_id, created_at_utc)
VALUES
(
    '70000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', -- Owner
    '10000000-0000-0000-0000-000000000001',
    'Cảnh báo vượt ngưỡng độ ẩm đất Zone 1',
    'Cảm biến ghi nhận độ ẩm đất 49.5% (dưới ngưỡng tối thiểu 55%) tại Khu nhà màng dưa leo.',
    'Alert',
    'Warning',
    FALSE,
    NULL,
    '/owner/alerts',
    '62000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '15 minutes'
),
(
    '70000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', -- Owner
    '10000000-0000-0000-0000-000000000001',
    'AI đề xuất kích hoạt tưới nhỏ giọt',
    'Trợ lý Nông học AI đề xuất tưới 10 phút tại Zone 1 do đất khô và nhiệt độ tăng.',
    'Advice',
    'Info',
    FALSE,
    NULL,
    '/owner/ai',
    '91000000-0000-0000-0000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '10 minutes'
),
(
    '70000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002', -- Farmer
    '10000000-0000-0000-0000-000000000001',
    'Nhiệm vụ mới: Kiểm tra bẫy côn trùng Zone 1',
    'Chủ trang trại đã phân công nhiệm vụ mới cho bạn tại Demo Greenhouse Zone (Zone 1).',
    'Task',
    'Info',
    FALSE,
    NULL,
    '/farmer/tasks',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '30 minutes'
),
(
    '70000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001', -- Owner
    '10000000-0000-0000-0000-000000000001',
    'Cảnh báo tồn kho: Phân bón NPK sắp hết',
    'Vật tư NPK 20-20-15 chỉ còn 15kg (dưới ngưỡng tối thiểu 20kg). Vui lòng đặt thêm.',
    'Inventory',
    'Warning',
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    '/owner/inventory',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Thêm dữ liệu Zone 6 (khu vực độc lập không đè, nằm trong Field A còn trống)
-- Field A tổng diện tích 6000m2, hiện Zone 1 (2500m2) + Zone 2 (2000m2) = 4500m2. Còn trống 1500m2.
-- Zone 6 diện tích 1000m2, tọa độ nằm gọn bên trong Field A, KHÔNG đè lên Zone 1 và Zone 2:
-- Tọa độ Zone 1: [108.4575, 11.9395] đến [108.4590, 11.9410]
-- Tọa độ Zone 2: [108.4591, 11.9395] đến [108.4600, 11.9410]
-- Tọa độ Zone 6 (không đè): [108.4575, 11.9411] đến [108.4590, 11.9419]
INSERT INTO zones (id, field_id, name, area_m2, zone_type, notes, status, boundary, created_at_utc)
VALUES
(
    '32000000-0000-0000-0000-000000000006',
    '31000000-0000-0000-0000-000000000001',
    'Zone 6 - Khu Thảo Dược Hữu Cơ (Test Non-overlap)',
    1000,
    'Greenhouse',
    'Khu thử nghiệm trồng thảo dược hương thảo và húng tây.',
    'Operating',
    ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4575,11.9411],[108.4590,11.9411],[108.4590,11.9419],[108.4575,11.9419],[108.4575,11.9411]]]}'), 4326)::geometry(Polygon,4326),
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    boundary = EXCLUDED.boundary,
    area_m2 = EXCLUDED.area_m2;

-- Cập nhật diện tích khả dụng của Field A
UPDATE fields SET available_area_m2 = 500 WHERE id = '31000000-0000-0000-0000-000000000001';

-- Cấp quyền truy cập Zone 6 cho Farmer
INSERT INTO user_zone_accesses (app_user_id, zone_id, can_control, assigned_at_utc)
VALUES ('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000006', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (app_user_id, zone_id) DO NOTHING;

-- Thêm thiết bị cảm biến cho Zone 6
INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, created_at_utc)
VALUES ('52000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000006', 'SENSOR-ZONE6-HERB-01', 'SensorNode', 'Online', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Telemetry cho Zone 6
INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
VALUES
(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000006', '52000000-0000-0000-0000-000000000009', '51000000-0000-0000-0000-000000000001', 'msg-z6-temp-1', 'Temperature', 24.5, 'C', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000006', '52000000-0000-0000-0000-000000000009', '51000000-0000-0000-0000-000000000001', 'msg-z6-soil-1', 'SoilMoisture', 63.8, '%', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
