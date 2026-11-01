-- Khai báo kênh chấp hành cho 2 node điều khiển "Van Solenoid tưới nhỏ giọt 4 cổng" của Zone "Khu ca chua 12".
-- Cấu hình theo đúng tên phần cứng: mỗi node 4 van, relay 1-4, thời gian chạy tối đa 20 phút (giới hạn phần cứng là 30 phút).
-- Chưa biết công suất và lưu lượng nên để trống (NULL), không bịa. Chạy lại nhiều lần không tạo trùng.
BEGIN;

INSERT INTO device_actuators (id, device_id, actuator_type, relay_channel, rated_power_watt, max_duration_minutes, created_at_utc, flow_rate_liters_per_minute)
SELECT gen_random_uuid(), d.id, 'IrrigationValve', ch.n, NULL, 20, now(), NULL
FROM devices d
CROSS JOIN generate_series(1, 4) AS ch(n)
WHERE d.hardware_address IN ('24:DC:C3:44:01:01', '24:DC:C3:44:01:02')
  AND d.device_type = 'ActuatorNode'
  AND d.decommissioned_at_utc IS NULL
  AND NOT EXISTS (SELECT 1 FROM device_actuators a WHERE a.device_id = d.id AND a.relay_channel = ch.n);

COMMIT;
