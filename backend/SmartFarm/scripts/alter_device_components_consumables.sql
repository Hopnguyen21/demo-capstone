ALTER TABLE device_components ADD COLUMN IF NOT EXISTS unit varchar(30) NOT NULL DEFAULT 'Cái';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_device_component_not_actuator') THEN
    ALTER TABLE device_components ADD CONSTRAINT ck_device_component_not_actuator CHECK (upper(component_type) NOT IN ('RELAY','VALVE','PUMP','ACTUATOR'));
  END IF;
END $$;
