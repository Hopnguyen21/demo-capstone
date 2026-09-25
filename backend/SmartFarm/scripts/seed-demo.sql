-- SmartFarm local/demo seed data.
-- Login password for every demo account: Demo@12345
-- Never run this script in production.

BEGIN;

INSERT INTO tenants (id, company_name, subdomain, tax_code, status, address, created_at_utc)
VALUES ('10000000-0000-0000-0000-000000000001', 'SmartFarm Demo', 'smartfarm-demo', 'DEMO-001', 'Active', 'Da Lat, Lam Dong', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name, status = EXCLUDED.status, address = EXCLUDED.address;

INSERT INTO farms (id, tenant_id, name, location_text, latitude, longitude, total_area_m2, time_zone, status, created_at_utc)
VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Demo Hydroponic Farm', 'Da Lat, Lam Dong', 11.9404, 108.4583, 10000, 'Asia/Ho_Chi_Minh', 'Operating', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, total_area_m2 = EXCLUDED.total_area_m2;

-- ASP.NET Core Identity V3 PBKDF2 hash for Demo@12345.
INSERT INTO app_users (id, email, normalized_email, full_name, phone, password_hash, role, status, tenant_id, farm_id, failed_login_attempts, created_at_utc)
VALUES
('20000000-0000-0000-0000-000000000001', 'owner@smartfarm.demo', 'OWNER@SMARTFARM.DEMO', 'Demo Farm Owner', '0900000001', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'FarmOwner', 'Active', '10000000-0000-0000-0000-000000000001', NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000002', 'farmer@smartfarm.demo', 'FARMER@SMARTFARM.DEMO', 'Demo Farmer', '0900000002', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'Farmer', 'Active', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000003', 'admin@smartfarm.demo', 'ADMIN@SMARTFARM.DEMO', 'Demo Platform Admin', NULL, 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformAdmin', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP),
('20000000-0000-0000-0000-000000000004', 'technician@smartfarm.demo', 'TECHNICIAN@SMARTFARM.DEMO', 'Demo Technician', '0900000004', 'AQAAAAIAAYagAAAAED44Ao15fVnkAKG52c1WD1sfkscGqyvTCHf1oKGDYnByteNojC+qbRByz87bxcNTcA==', 'PlatformTechnician', 'Active', NULL, NULL, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name, status = 'Active', failed_login_attempts = 0, locked_until_utc = NULL;

INSERT INTO fields (id, farm_id, name, area_m2, available_area_m2, soil_type, latitude, longitude, boundary, created_at_utc)
VALUES ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Demo Field A', 6000, 3500, 'Loam', 11.9404, 108.4583,
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.457,11.939],[108.460,11.939],[108.460,11.942],[108.457,11.942],[108.457,11.939]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, area_m2 = EXCLUDED.area_m2, available_area_m2 = EXCLUDED.available_area_m2, boundary = EXCLUDED.boundary;

INSERT INTO zones (id, field_id, name, area_m2, zone_type, notes, status, boundary, created_at_utc)
VALUES ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Demo Greenhouse Zone', 2500, 'Greenhouse', 'Zone used by Swagger demo data.', 'Operating',
        ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[108.4575,11.9395],[108.459,11.9395],[108.459,11.941],[108.4575,11.941],[108.4575,11.9395]]]}'), 4326)::geometry(Polygon,4326), CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, notes = EXCLUDED.notes, boundary = EXCLUDED.boundary;

INSERT INTO user_zone_accesses (app_user_id, zone_id, can_control, assigned_at_utc)
VALUES ('20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (app_user_id, zone_id) DO UPDATE SET can_control = TRUE, assigned_at_utc = EXCLUDED.assigned_at_utc;

INSERT INTO crops (id, tenant_id, created_by_user_id, name, normalized_name, scientific_name, description, is_system_defined, created_at_utc)
VALUES ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Cucumber', 'DEMO CUCUMBER', 'Cucumis sativus', 'Tenant crop for Swagger testing.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO crop_varieties (id, crop_id, tenant_id, created_by_user_id, name, normalized_name, description, is_system_defined, created_at_utc)
VALUES ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Green F1', 'DEMO GREEN F1', 'Greenhouse variety.', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO growth_profiles (id, crop_id, variety_id, tenant_id, created_by_user_id, name, normalized_name, description, is_default, is_system_defined, created_at_utc)
VALUES ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Cucumber Profile', 'DEMO CUCUMBER PROFILE', 'Tenant-owned profile.', TRUE, FALSE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_default = TRUE;

INSERT INTO growth_stages (id, growth_profile_id, name, stage_order, duration_days, created_at_utc)
VALUES ('43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'Vegetative', 1, 30, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, duration_days = EXCLUDED.duration_days;

INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit)
VALUES
('43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 65, '%'),
('43000000-0000-0000-0000-000000000001', 'Temperature', 20, 30, 25, 'C'),
('43000000-0000-0000-0000-000000000001', 'AirHumidity', 55, 80, 68, '%'),
('43000000-0000-0000-0000-000000000001', 'Ph', 5.5, 6.8, 6.2, 'pH')
ON CONFLICT (growth_stage_id, parameter_code) DO UPDATE SET min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value, target_value = EXCLUDED.target_value, unit = EXCLUDED.unit;

INSERT INTO planting_seasons (id, zone_id, crop_id, variety_id, growth_profile_id, current_growth_stage_id, name, start_date, expected_end_date, status, created_at_utc)
VALUES ('44000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'Demo Season 2026', CURRENT_DATE - 10, CURRENT_DATE + 80, 'InProgress', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET current_growth_stage_id = EXCLUDED.current_growth_stage_id, status = 'InProgress', expected_end_date = EXCLUDED.expected_end_date;

INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT '44000000-0000-0000-0000-000000000001', parameter_code, min_value, max_value, target_value, unit
FROM environmental_requirements WHERE growth_stage_id = '43000000-0000-0000-0000-000000000001'
ON CONFLICT (planting_season_id, parameter_code) DO UPDATE SET min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value, target_value = EXCLUDED.target_value, unit = EXCLUDED.unit;

INSERT INTO deployment_requests (id, tenant_id, farm_id, zone_id, planting_season_id, owner_user_id, technician_user_id, status, required_parameters_csv, owner_notes, submitted_at_utc, completed_at_utc, created_at_utc)
VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Completed', 'SoilMoisture,Temperature,AirHumidity,Ph', 'Demo deployment.', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '21 days')
ON CONFLICT (id) DO UPDATE SET status = 'Completed', technician_user_id = EXCLUDED.technician_user_id;

INSERT INTO gateways (id, farm_id, deployment_request_id, mac_address, gateway_serial, frequency_band, firmware_version, status, last_seen_at_utc, mqtt_client_id, client_certificate_fingerprint, created_at_utc)
VALUES ('51000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'AA:BB:CC:DD:EE:01', 'GW-DEMO-001', 'AS923', '1.0.0', 'Online', CURRENT_TIMESTAMP - INTERVAL '1 minute', 'smartfarm-demo-gateway', repeat('A', 64), CURRENT_TIMESTAMP - INTERVAL '16 days')
ON CONFLICT (id) DO UPDATE SET status = 'Online', last_seen_at_utc = EXCLUDED.last_seen_at_utc, firmware_version = EXCLUDED.firmware_version;

INSERT INTO devices (id, farm_id, gateway_id, deployment_request_id, zone_id, hardware_address, device_type, status, installation_notes, created_at_utc)
VALUES
('52000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'SENSOR-DEMO-001', 'SensorNode', 'Online', 'Demo telemetry sensor.', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('52000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'ACTUATOR-DEMO-001', 'ActuatorNode', 'Online', 'Demo irrigation pump.', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET zone_id = EXCLUDED.zone_id, status = 'Online', installation_notes = EXCLUDED.installation_notes;

INSERT INTO device_actuators (id, device_id, actuator_type, relay_channel, rated_power_watt, flow_rate_liters_per_minute, max_duration_minutes, created_at_utc)
VALUES ('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', 'IrrigationPump', 1, 1200, 10, 30, CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET rated_power_watt = 1200, flow_rate_liters_per_minute = 10, max_duration_minutes = 30;

INSERT INTO device_connection_tests (id, device_id, deployment_request_id, technician_user_id, succeeded, rssi, snr, round_trip_latency_ms, observed_at_utc, created_at_utc)
VALUES ('54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', TRUE, -72, 8.5, 45, CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes')
ON CONFLICT (id) DO UPDATE SET succeeded = TRUE, observed_at_utc = EXCLUDED.observed_at_utc;

INSERT INTO telemetry_readings (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
VALUES
('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'demo-soil-001', 'SoilMoisture', 48, '%', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes', CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'demo-temp-001', 'Temperature', 26.5, 'C', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '3 minutes', CURRENT_TIMESTAMP - INTERVAL '3 minutes'),
('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'demo-humidity-001', 'AirHumidity', 67, '%', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'demo-ph-001', 'Ph', 6.1, 'pH', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '1 minute')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, captured_at_utc = EXCLUDED.captured_at_utc, received_at_utc = EXCLUDED.received_at_utc;

INSERT INTO alert_rules (id, zone_id, growth_stage_id, parameter_code, min_threshold, max_threshold, severity, cooldown_minutes, is_active, is_system_generated, created_at_utc)
VALUES ('61000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 55, 75, 'Warning', 30, TRUE, TRUE, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET min_threshold = 55, max_threshold = 75, is_active = TRUE;

INSERT INTO alerts (id, tenant_id, farm_id, zone_id, device_id, alert_rule_id, planting_season_id, growth_stage_id, parameter_code, observed_value, min_threshold, max_threshold, unit, severity, status, title, created_at_utc)
VALUES ('62000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', 'SoilMoisture', 48, 55, 75, '%', 'Warning', 'Open', 'Demo soil moisture is below threshold', CURRENT_TIMESTAMP - INTERVAL '4 minutes')
ON CONFLICT (id) DO UPDATE SET observed_value = 48, status = 'Open', acknowledged_at_utc = NULL, resolved_at_utc = NULL;

INSERT INTO alert_history_events (id, alert_id, actor_user_id, event_type, notes, created_at_utc)
VALUES ('62100000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', NULL, 'Created', 'Created by demo seed.', CURRENT_TIMESTAMP - INTERVAL '4 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO actuator_commands (id, tenant_id, farm_id, zone_id, actuator_id, device_id, gateway_id, triggered_by_user_id, idempotency_key, trigger_source, action, duration_seconds, status, notes, queued_at_utc, sent_at_utc, acknowledged_at_utc, execution_ends_at_utc, terminal_at_utc, observed_state, created_at_utc)
VALUES ('63000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'demo-command-001', 'Manual', 'TurnOn', 600, 'Acknowledged', 'Demo completed irrigation command.', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '29 minutes', CURRENT_TIMESTAMP - INTERVAL '28 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', CURRENT_TIMESTAMP - INTERVAL '18 minutes', 'Stopped', CURRENT_TIMESTAMP - INTERVAL '30 minutes')
ON CONFLICT (id) DO UPDATE SET status = 'Acknowledged', acknowledged_at_utc = EXCLUDED.acknowledged_at_utc, terminal_at_utc = EXCLUDED.terminal_at_utc;

INSERT INTO actuator_command_events (id, command_id, event_kind, status, occurred_at_utc, detail, observed_state, created_at_utc)
VALUES ('63100000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000001', 'Feedback', 'Acknowledged', CURRENT_TIMESTAMP - INTERVAL '28 minutes', 'Demo device ACK.', 'Running', CURRENT_TIMESTAMP - INTERVAL '28 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_items ("Id", tenant_id, farm_id, name, normalized_name, material_type, unit, quantity_on_hand, low_stock_threshold, created_at_utc)
VALUES ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Demo NPK Fertilizer', 'DEMO NPK FERTILIZER', 'Fertilizer', 'kg', 35, 40, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT ("Id") DO UPDATE SET quantity_on_hand = 35, low_stock_threshold = 40;

INSERT INTO inventory_transactions ("Id", tenant_id, farm_id, inventory_item_id, movement_type, quantity, balance_after, actor_user_id, zone_id, notes, created_at_utc)
VALUES
('71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Receipt', 50, 50, '20000000-0000-0000-0000-000000000001', NULL, 'Demo initial receipt.', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Issue', 15, 35, '20000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', 'Used in demo Zone.', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET quantity = EXCLUDED.quantity, balance_after = EXCLUDED.balance_after;

INSERT INTO low_stock_alerts ("Id", tenant_id, farm_id, inventory_item_id, status, quantity_at_open, opened_at_utc, created_at_utc)
VALUES ('72000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Open', 35, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("Id") DO UPDATE SET status = 'Open', quantity_at_open = 35, resolved_at_utc = NULL;

INSERT INTO farm_tasks ("Id", tenant_id, farm_id, zone_id, title, description, requirements, due_at_utc, assigned_farmer_id, created_by_owner_id, status, result, accepted_at_utc, started_at_utc, submitted_at_utc, approved_at_utc, assignment_version, created_at_utc)
VALUES ('73000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'Inspect demo irrigation line', 'Check emitters and record result.', 'Confirm no leaks.', CURRENT_TIMESTAMP + INTERVAL '2 days', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Approved', 'No leaks found.', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 1, CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT ("Id") DO UPDATE SET status = 'Approved', result = EXCLUDED.result, assigned_farmer_id = EXCLUDED.assigned_farmer_id;

INSERT INTO farm_task_history ("Id", farm_task_id, actor_user_id, event_type, from_status, to_status, previous_assignee_id, new_assignee_id, notes, created_at_utc)
VALUES ('73100000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Approved', 'CompletedPendingReview', 'Approved', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Demo task approved.', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO finance_transactions (id, tenant_id, farm_id, transaction_type, expense_category, amount, occurred_at_utc, description, reference, created_by_owner_id, created_at_utc)
VALUES
('74000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Revenue', NULL, 20000000, CURRENT_TIMESTAMP - INTERVAL '5 days', 'Demo harvest revenue.', 'REV-DEMO-001', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '5 days'),
('74000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Expense', 'Material', 5000000, CURRENT_TIMESTAMP - INTERVAL '4 days', 'Demo material expense.', 'EXP-DEMO-001', '20000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '4 days')
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, occurred_at_utc = EXCLUDED.occurred_at_utc;

INSERT INTO service_requests (id, tenant_id, farm_id, zone_id, deployment_request_id, device_id, current_device_id, source, failure_code, description, status, created_by_owner_id, assigned_technician_id, inspection_notes, diagnosis, resolution_action, work_performed, accepted_at_utc, closed_at_utc, created_at_utc)
VALUES ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'Owner', 'DEMO_CHECK', 'Demo preventive maintenance request.', 'Closed', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Inspected wiring and relay.', 'Loose terminal.', 'Repair', 'Terminal tightened and retested.', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '8 days')
ON CONFLICT (id) DO UPDATE SET status = 'Closed', closed_at_utc = EXCLUDED.closed_at_utc, diagnosis = EXCLUDED.diagnosis, work_performed = EXCLUDED.work_performed;

INSERT INTO service_request_history (id, service_request_id, actor_user_id, event_type, from_status, to_status, notes, created_at_utc)
VALUES ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Closed', 'Verified', 'Closed', 'Demo maintenance completed.', CURRENT_TIMESTAMP - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Stable IDs useful in Swagger requests:
-- Farm:     30000000-0000-0000-0000-000000000001
-- Field:    31000000-0000-0000-0000-000000000001
-- Zone:     32000000-0000-0000-0000-000000000001
-- Season:   44000000-0000-0000-0000-000000000001
-- Gateway:  51000000-0000-0000-0000-000000000001
-- Sensor:   52000000-0000-0000-0000-000000000001
-- Actuator: 53000000-0000-0000-0000-000000000001
