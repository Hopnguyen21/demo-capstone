-- 1. Create planting season for Zone 4
INSERT INTO planting_seasons (id, zone_id, crop_id, variety_id, growth_profile_id, current_growth_stage_id, name, start_date, expected_end_date, status, created_at_utc)
VALUES ('44000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'Vu Ca Chua Chuong F1 2026', CURRENT_DATE - 20, CURRENT_DATE + 70, 'InProgress', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Environmental requirements for the season
INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT '44000000-0000-0000-0000-000000000004', parameter_code, min_value, max_value, target_value, unit
FROM environmental_requirements WHERE growth_stage_id = '10000000-0000-0000-0000-000000000005'
ON CONFLICT (planting_season_id, parameter_code) DO NOTHING;

-- 3. Create sensor device & actuator device for Zone 4 if not exists
INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, created_at_utc)
SELECT '52000000-0000-0000-0000-000000000005', f.farm_id, '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000004', 'SENSOR-BELLPEPPER-001', 'SensorNode', 'Online', CURRENT_TIMESTAMP
FROM zones z JOIN fields f ON z.field_id = f.id WHERE z.id = '32000000-0000-0000-0000-000000000004'
ON CONFLICT (id) DO NOTHING;

INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, created_at_utc)
SELECT '52000000-0000-0000-0000-000000000006', f.farm_id, '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000004', 'ACTUATOR-BELLPEPPER-001', 'ActuatorNode', 'Online', CURRENT_TIMESTAMP
FROM zones z JOIN fields f ON z.field_id = f.id WHERE z.id = '32000000-0000-0000-0000-000000000004'
ON CONFLICT (id) DO NOTHING;

-- 4. Create device actuator for pump / fogger
INSERT INTO device_actuators (id, device_id, actuator_type, max_duration_minutes)
VALUES ('54000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000006', 'Pump', 30)
ON CONFLICT (id) DO NOTHING;

-- 5. Insert telemetry readings for Zone 4
INSERT INTO telemetry_readings (id, device_id, zone_id, parameter_code, value, unit, captured_at_utc, received_at_utc, raw_payload_json)
VALUES 
(gen_random_uuid(), '52000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000004', 'Temperature', 28.5, 'C', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'),
(gen_random_uuid(), '52000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000004', 'AirHumidity', 68.0, '%', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'),
(gen_random_uuid(), '52000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000004', 'SoilMoisture', 58.2, '%', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'),
(gen_random_uuid(), '52000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000004', 'Lux', 42000.0, 'lux', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}');
