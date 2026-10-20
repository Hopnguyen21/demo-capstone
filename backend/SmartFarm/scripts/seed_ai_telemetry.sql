-- Seed fresh telemetries matching exact table schema
DO $$
DECLARE
    z RECORD;
    d RECORD;
    msg_prefix TEXT;
BEGIN
    FOR z IN 
        SELECT zo.id AS zone_id, fa.tenant_id, fa.id AS farm_id
        FROM zones zo
        JOIN fields fi ON zo.field_id = fi.id
        JOIN farms fa ON fi.farm_id = fa.id
    LOOP
        -- Find sensor device and its gateway
        SELECT de.id AS device_id, de.gateway_id INTO d
        FROM devices de 
        WHERE de.zone_id = z.zone_id 
        LIMIT 1;

        IF d.device_id IS NOT NULL THEN
            msg_prefix := 'SIM-AI-' || to_char(NOW(), 'YYYYMMDDHH24MISSMS') || '-' || substr(z.zone_id::text, 1, 4);

            -- 1. Temperature: 34.2 C (High temperature, heat stress)
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-TEMP', 'Temperature', 34.2000, 'C', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;

            -- 2. AirHumidity: 46.5 % (Low humidity)
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-HUM', 'AirHumidity', 46.5000, '%', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;

            -- 3. SoilMoisture: 42.0 % (Low soil moisture, dry condition -> AI recommends irrigation)
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-SOIL', 'SoilMoisture', 42.0000, '%', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;

            -- 4. LightIntensity: 52000 lux (Intense sunlight)
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-LUX', 'LightIntensity', 52000.0000, 'lux', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;

            -- 5. EC: 2.10 mS/cm
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-EC', 'Ec', 2.1000, 'mS/cm', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;

            -- 6. Ph: 6.25 pH
            INSERT INTO telemetry_readings 
                (id, tenant_id, farm_id, zone_id, device_id, gateway_id, message_id, parameter_code, value, unit, captured_at_utc, received_at_utc, created_at_utc)
            VALUES 
                (gen_random_uuid(), z.tenant_id, z.farm_id, z.zone_id, d.device_id, d.gateway_id, msg_prefix || '-PH', 'Ph', 6.2500, 'pH', NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;
