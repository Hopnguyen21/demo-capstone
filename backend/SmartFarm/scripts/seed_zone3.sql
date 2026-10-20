-- 1. Create crop Strawberry if not exists
INSERT INTO crops (id, name, normalized_name, scientific_name, description, is_system_defined, created_at_utc)
VALUES ('40000000-0000-0000-0000-000000000003', 'Dau Tay', 'dau tay', 'Fragaria ananassa', 'Cay dau tay gian cao tang', true, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Create variety
INSERT INTO crop_varieties (id, crop_id, name, normalized_name, description, days_to_maturity, is_system_defined, created_at_utc)
VALUES ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Hana', 'hana', 'Giong dau tay ngot Hana', 120, true, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 3. Create growth profile
INSERT INTO growth_profiles (id, crop_id, name, normalized_name, description, is_default, is_system_defined, created_at_utc)
VALUES ('42000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Quy Trinh Dau Tay Gian Cao Tang', 'quy trinh dau tay gian cao tang', 'Quy trinh VietGAP dau tay', true, true, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 4. Create growth stage
INSERT INTO growth_stages (id, growth_profile_id, name, stage_order, duration_days, created_at_utc)
VALUES ('43000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000003', 'Ra hoa & Nuoi qua', 1, 60, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 5. Environmental requirements for Strawberry
INSERT INTO environmental_requirements (id, growth_stage_id, parameter_code, min_value, max_value, target_value, unit, created_at_utc)
VALUES 
(gen_random_uuid(), '43000000-0000-0000-0000-000000000003', 'Temperature', 18.0, 26.0, 22.0, 'C', CURRENT_TIMESTAMP),
(gen_random_uuid(), '43000000-0000-0000-0000-000000000003', 'AirHumidity', 60.0, 80.0, 70.0, '%', CURRENT_TIMESTAMP),
(gen_random_uuid(), '43000000-0000-0000-0000-000000000003', 'SoilMoisture', 60.0, 75.0, 68.0, '%', CURRENT_TIMESTAMP),
(gen_random_uuid(), '43000000-0000-0000-0000-000000000003', 'LightIntensity', 25000.0, 50000.0, 35000.0, 'lux', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 6. Planting Season for Zone 3
INSERT INTO planting_seasons (id, zone_id, crop_id, variety_id, growth_profile_id, current_growth_stage_id, name, start_date, expected_end_date, status, created_at_utc)
VALUES ('44000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000003', '43000000-0000-0000-0000-000000000003', 'Vu Dau Tay Hana Thu Dong 2026', CURRENT_DATE - 30, CURRENT_DATE + 90, 'InProgress', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET status = 'InProgress';

-- 7. Season applied requirements
INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT '44000000-0000-0000-0000-000000000003', parameter_code, min_value, max_value, target_value, unit
FROM environmental_requirements WHERE growth_stage_id = '43000000-0000-0000-0000-000000000003'
ON CONFLICT (planting_season_id, parameter_code) DO NOTHING;

-- 8. Devices for Zone 3
INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, created_at_utc)
SELECT '52000000-0000-0000-0000-000000000007', f.farm_id, '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', 'SENSOR-STRAWBERRY-001', 'SensorNode', 'Online', CURRENT_TIMESTAMP
FROM zones z JOIN fields f ON z.field_id = f.id WHERE z.id = '32000000-0000-0000-0000-000000000003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, created_at_utc)
SELECT '52000000-0000-0000-0000-000000000008', f.farm_id, '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000003', 'ACTUATOR-STRAWBERRY-001', 'ActuatorNode', 'Online', CURRENT_TIMESTAMP
FROM zones z JOIN fields f ON z.field_id = f.id WHERE z.id = '32000000-0000-0000-0000-000000000003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO device_actuators (id, device_id, actuator_type, relay_channel, max_duration_minutes, created_at_utc)
VALUES ('54000000-0000-0000-0000-000000000007', '52000000-0000-0000-0000-000000000008', 'Pump', 1, 20, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 9. Telemetry readings for Zone 3
INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
SELECT gen_random_uuid(), farm.tenant_id, farm.id, z.id, '52000000-0000-0000-0000-000000000007', '51000000-0000-0000-0000-000000000001', reading.message_id, reading.parameter_code, reading.value, reading.unit, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM zones z
JOIN fields f ON f.id = z.field_id
JOIN farms farm ON farm.id = f.farm_id
CROSS JOIN (VALUES
    ('msg-zone3-temp-01', 'Temperature', 22.8::numeric, 'C'),
    ('msg-zone3-hum-01', 'AirHumidity', 72.5::numeric, '%'),
    ('msg-zone3-soil-01', 'SoilMoisture', 66.4::numeric, '%'),
    ('msg-zone3-lux-01', 'LightIntensity', 32000.0::numeric, 'lux')
) AS reading(message_id, parameter_code, value, unit)
WHERE z.id = '32000000-0000-0000-0000-000000000003'
ON CONFLICT DO NOTHING;
