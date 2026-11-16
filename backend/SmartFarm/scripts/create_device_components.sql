CREATE TABLE IF NOT EXISTS device_components (
 id uuid PRIMARY KEY,
 device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 hardware_item_id uuid NOT NULL REFERENCES "PlatformHardwareItems"("Id") ON DELETE RESTRICT,
 component_type varchar(50) NOT NULL,
 quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
 notes varchar(500),
 created_at_utc timestamptz NOT NULL DEFAULT NOW(),
 updated_at_utc timestamptz,
 CONSTRAINT uq_device_components_device_hardware UNIQUE (device_id, hardware_item_id)
);
CREATE INDEX IF NOT EXISTS ix_device_components_device_id ON device_components(device_id);
CREATE INDEX IF NOT EXISTS ix_device_components_hardware_item_id ON device_components(hardware_item_id);
