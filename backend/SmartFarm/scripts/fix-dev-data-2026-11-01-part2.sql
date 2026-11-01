-- Phần 2: xử lý các vấn đề dữ liệu còn lại của DB dev (kiểm tra ngày 2026-11-01). Chạy một giao dịch.
BEGIN;

-- 1) Quyền Zone của Farmer ngoài Farm của Farmer (API không cho cấp, giao diện bị lỗi 404 khi lưu).
DELETE FROM user_zone_accesses a
USING app_users u, zones z, fields f
WHERE a.app_user_id = u.id AND a.zone_id = z.id AND z.field_id = f.id
  AND u.farm_id IS NOT NULL AND f.farm_id <> u.farm_id;

-- 2) Zone "Nhà màng Z01": tên Zone, tên vụ và giống Beef F1 đều là Cà chua Beefsteak, còn cây của vụ đang chạy bị ghi nhầm là Ớt ngọt.
--    Đưa vụ InProgress và Zone về Cà chua Beefsteak, dùng hồ sơ Beefsteak, giai đoạn 1 và chụp lại ngưỡng của giai đoạn đó.
--    Vụ Planned (Ớt ngọt, đợt sau) giữ nguyên.
UPDATE planting_seasons s SET
    crop_id = (SELECT c.id FROM crops c WHERE c.is_system_defined AND c.name LIKE 'C_ Chua Beefsteak%' LIMIT 1),
    variety_id = NULL,
    growth_profile_id = (SELECT p.id FROM growth_profiles p JOIN crops c ON c.id = p.crop_id WHERE p.is_system_defined AND c.name LIKE 'C_ Chua Beefsteak%' LIMIT 1),
    current_growth_stage_id = (SELECT g.id FROM growth_stages g JOIN growth_profiles p ON p.id = g.growth_profile_id JOIN crops c ON c.id = p.crop_id
                               WHERE p.is_system_defined AND c.name LIKE 'C_ Chua Beefsteak%' AND g.stage_order = 1 LIMIT 1)
FROM zones z
WHERE z.id = s.zone_id AND z.name LIKE 'Nh% m% Z01%' AND s.status = 'InProgress';

DELETE FROM season_applied_requirements r USING planting_seasons s, zones z
WHERE r.planting_season_id = s.id AND z.id = s.zone_id AND z.name LIKE 'Nh% m% Z01%' AND s.status = 'InProgress';

INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT s.id, r.parameter_code, r.min_value, r.max_value, r.target_value, r.unit
FROM planting_seasons s JOIN zones z ON z.id = s.zone_id
JOIN environmental_requirements r ON r.growth_stage_id = s.current_growth_stage_id
WHERE z.name LIKE 'Nh% m% Z01%' AND s.status = 'InProgress';

UPDATE zones z SET crop_id = c.id,
       crop_variety_id = (SELECT v.id FROM crop_varieties v WHERE v.crop_id = c.id AND v.name = 'Beef F1')
FROM crops c
WHERE z.name LIKE 'Nh% m% Z01%' AND c.is_system_defined AND c.name LIKE 'C_ Chua Beefsteak%';

-- 3) Thiết bị gắn cổng của Farm khác. Dâu tây dùng cổng GW-CAUDAT-001 của đúng Farm Cầu Đất.
UPDATE devices d SET gateway_id = g.id
FROM gateways g
WHERE g.gateway_serial = 'GW-CAUDAT-001' AND d.hardware_address LIKE '%STRAWBERRY%';

--    Farm Đơn Dương chưa có cổng nào: tạo một bản ghi cổng dự phòng ghi rõ là dữ liệu mẫu, chưa Online, chưa thấy lần nào.
INSERT INTO gateways (id, farm_id, deployment_request_id, mac_address, gateway_serial, frequency_band, firmware_version, status, last_seen_at_utc, created_at_utc, client_certificate_fingerprint, mqtt_client_id)
SELECT gen_random_uuid(), f.id, d.deployment_request_id, 'SEED-DONDUONG-01', 'GW-DONDUONG-001', 'AS923', 'seed', 'Provisioned', NULL, now(), 'SEED-FINGERPRINT-DONDUONG-01', 'seed-gw-donduong-001'
FROM farms f
JOIN devices d ON d.farm_id = f.id AND d.hardware_address LIKE '%BELLPEPPER%'
WHERE f.name LIKE '%Don Duong%'
  AND NOT EXISTS (SELECT 1 FROM gateways g WHERE g.gateway_serial = 'GW-DONDUONG-001')
LIMIT 1;

UPDATE devices d SET gateway_id = g.id
FROM gateways g
WHERE g.gateway_serial = 'GW-DONDUONG-001' AND d.hardware_address LIKE '%BELLPEPPER%';

-- 4) Dưa Lưới có hai hồ sơ (75 và 90 ngày): chu kỳ của cây lấy theo "Quy trình ... (75 ngày)" có tên và tổng giai đoạn cùng bằng 75.
UPDATE crops SET growth_cycle_days = 75
WHERE growth_cycle_days IS NULL AND name LIKE 'D%a L%i%' AND is_system_defined;

-- 5) Thống nhất cách viết đơn vị (giá trị số không đổi: 1 dS/m = 1 mS/cm).
UPDATE telemetry_readings SET unit = '°C'    WHERE unit = 'C';
UPDATE telemetry_readings SET unit = 'Lux'   WHERE unit = 'lux';
UPDATE telemetry_readings SET unit = 'mS/cm' WHERE unit = 'dS/m';
UPDATE environmental_requirements SET unit = '°C'  WHERE unit = 'C';
UPDATE environmental_requirements SET unit = 'Lux' WHERE unit = 'lux';
UPDATE season_applied_requirements SET unit = '°C'  WHERE unit = 'C';
UPDATE season_applied_requirements SET unit = 'Lux' WHERE unit = 'lux';

COMMIT;
