-- Reset dữ liệu IoT/deployment để kiểm thử lại từ đầu.
-- Giữ nguyên: tài khoản, Tenant/Farm/Field/Zone, hợp đồng, Firmware Registry.
-- Xóa: telemetry, alert, connectivity evidence, enrollment, gateway runtime,
--       hardware preparation, firmware jobs/installations và deployment request.
-- Sau cùng đưa toàn bộ hardware item về kho Technician.

BEGIN;

-- Dữ liệu phát sinh trong vận hành IoT.
TRUNCATE TABLE
    telemetry_readings,
    alert_history_events,
    alerts,
    alert_rule_evaluation_states,
    alert_rules,
    device_connection_tests,
    device_assignment_history,
    device_diagnostic_jobs,
    firmware_jobs,
    firmware_installations,
    hardware_preparation_sessions,
    gateway_enrollments,
    device_sensors,
    device_actuators,
    devices,
    gateways,
    deployment_decision_history,
    deployment_surveys,
    deployment_plan_items,
    deployment_requests
CASCADE;

-- Không xóa platform_hardware_items: đây là inventory cần tái sử dụng.
-- Giữ AssignedTechnicianId hiện tại và đưa mọi item về kho Technician.
UPDATE "PlatformHardwareItems"
SET "Status" = 'InTechnicianStock',
    "UpdatedAtUtc" = NOW();

COMMIT;

-- Kiểm tra sau reset:
-- SELECT "Status", COUNT(*) FROM "PlatformHardwareItems" GROUP BY "Status";
-- SELECT COUNT(*) FROM "ZoneContracts";
-- SELECT COUNT(*) FROM firmware_releases;
