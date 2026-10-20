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

-- 5. Insert telemetry using the Farm and Tenant owning this Zone.
INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
SELECT gen_random_uuid(), farm.tenant_id, farm.id, z.id, d.id, d.gateway_id, reading.message_id,
       reading.parameter_code, reading.value, reading.unit, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM zones z
JOIN fields f ON f.id = z.field_id
JOIN farms farm ON farm.id = f.farm_id
JOIN devices d ON d.zone_id = z.id AND d.farm_id = farm.id AND d.device_type = 'SensorNode'
CROSS JOIN (VALUES
    ('msg-zone4-temp-01', 'Temperature', 28.5::numeric, 'C'),
    ('msg-zone4-hum-01', 'AirHumidity', 68.0::numeric, '%'),
    ('msg-zone4-soil-01', 'SoilMoisture', 58.2::numeric, '%'),
    ('msg-zone4-lux-01', 'LightIntensity', 42000.0::numeric, 'lux')
) AS reading(message_id, parameter_code, value, unit)
WHERE z.id = '32000000-0000-0000-0000-000000000004'
ON CONFLICT DO NOTHING;
