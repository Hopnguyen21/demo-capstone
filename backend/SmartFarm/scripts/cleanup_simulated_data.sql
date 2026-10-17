-- Dọn dẹp toàn bộ dữ liệu do Worker IoT sinh ra (Telemetry, Alerts, Notifications)
-- 1. Xóa dữ liệu đo đạc cảm biến giả lập
DELETE FROM telemetry_readings WHERE message_id LIKE 'sim-%';

-- 2. Xóa lịch sử và bản ghi cảnh báo do worker sinh ra
DELETE FROM alert_history_events WHERE alert_id != '62000000-0000-0000-0000-000000000001';
DELETE FROM alerts WHERE id != '62000000-0000-0000-0000-000000000001';

-- 3. Xóa các thông báo sự cố thiết bị và cảnh báo môi trường mới sinh ra
DELETE FROM notifications WHERE type = 'Alert';

-- 4. Xóa thiết bị giả lập SIM-NODE và khôi phục trạng thái các thiết bị về Online
DELETE FROM devices WHERE hardware_address LIKE 'SIM-%';
UPDATE devices SET status = 'Online' WHERE status = 'MaintenanceRequired';
