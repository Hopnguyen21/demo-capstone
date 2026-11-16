-- =========================================================================================
-- Script: reset_database_keep_accounts.sql
-- Mục đích: Xóa sạch dữ liệu nghiệp vụ (trang trại, phân khu, thiết bị, hợp đồng, lịch sử test)
--          CHỈ GIỮ LẠI danh khoản người dùng (AppUsers) của tất cả các Roles.
-- Lưu ý: Không ảnh hưởng đến mã nguồn backend/frontend hay các file seed-demo.sql sau này.
-- =========================================================================================

BEGIN;

-- 1. Tắt tạm thời kiểm tra ràng buộc khóa ngoại (Foreign Key)
SET CONSTRAINTS ALL DEFERRED;

-- 2. Dọn dẹp dữ liệu đo đạc IoT, Cảnh báo, Lịch sử kiểm thử
TRUNCATE TABLE telemetry_readings CASCADE;
TRUNCATE TABLE alert_history_events CASCADE;
TRUNCATE TABLE alerts CASCADE;
TRUNCATE TABLE alert_rules CASCADE;
TRUNCATE TABLE device_connection_tests CASCADE;
TRUNCATE TABLE device_assignment_histories CASCADE;
TRUNCATE TABLE device_diagnostic_jobs CASCADE;
TRUNCATE TABLE firmware_jobs CASCADE;

-- 3. Dọn dẹp thiết bị, cảm biến, cơ cấu chấp hành và Gateway
TRUNCATE TABLE device_sensors CASCADE;
TRUNCATE TABLE device_actuators CASCADE;
TRUNCATE TABLE devices CASCADE;
TRUNCATE TABLE gateways CASCADE;
TRUNCATE TABLE platform_hardware_items CASCADE;
TRUNCATE TABLE device_model_capabilities CASCADE;
TRUNCATE TABLE device_model_definitions CASCADE;
TRUNCATE TABLE device_depreciations CASCADE;
TRUNCATE TABLE device_replacements CASCADE;

-- 4. Dọn dẹp quy trình triển khai & nghiệm thu (Deployment Requests)
TRUNCATE TABLE deployment_decision_histories CASCADE;
TRUNCATE TABLE deployment_surveys CASCADE;
TRUNCATE TABLE deployment_plan_items CASCADE;
TRUNCATE TABLE deployment_requests CASCADE;

-- 5. Dọn dẹp điều khiển, tự động hóa & AI
TRUNCATE TABLE actuator_command_events CASCADE;
TRUNCATE TABLE actuator_commands CASCADE;
TRUNCATE TABLE auto_control_rules CASCADE;
TRUNCATE TABLE control_schedules CASCADE;
TRUNCATE TABLE ai_recommendation_decisions CASCADE;
TRUNCATE TABLE ai_recommendations CASCADE;
TRUNCATE TABLE ai_consultation_requests CASCADE;

-- 6. Dọn dẹp mùa vụ, công việc nông vụ, kho vật tư nông nghiệp & tài chính
TRUNCATE TABLE season_stage_transitions CASCADE;
TRUNCATE TABLE season_applied_requirements CASCADE;
TRUNCATE TABLE planting_seasons CASCADE;
TRUNCATE TABLE farming_seasons CASCADE;
TRUNCATE TABLE farm_task_histories CASCADE;
TRUNCATE TABLE farm_task_assignments CASCADE;
TRUNCATE TABLE farm_tasks CASCADE;
TRUNCATE TABLE inventory_transactions CASCADE;
TRUNCATE TABLE low_stock_alerts CASCADE;
TRUNCATE TABLE material_requirement_links CASCADE;
TRUNCATE TABLE inventory_items CASCADE;
TRUNCATE TABLE finance_transactions CASCADE;
TRUNCATE TABLE service_request_payments CASCADE;
TRUNCATE TABLE service_request_quotations CASCADE;
TRUNCATE TABLE service_request_histories CASCADE;
TRUNCATE TABLE service_requests CASCADE;
TRUNCATE TABLE zone_contracts CASCADE;
TRUNCATE TABLE farm_invitations CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- 7. Dọn dẹp cấu trúc nông trại & phân khu (Farm Structure)
TRUNCATE TABLE user_zone_accesses CASCADE;
TRUNCATE TABLE zones CASCADE;
TRUNCATE TABLE fields CASCADE;
TRUNCATE TABLE farms CASCADE;
-- Không xóa tenants nếu cần giữ liên kết tenant của các account Owner, 
-- hoặc reset farm_id / tenant_id của users về null:
UPDATE app_users SET farm_id = NULL;

-- 8. Reset token đăng nhập & số lần đăng nhập thất bại
TRUNCATE TABLE refresh_tokens CASCADE;
UPDATE app_users SET failed_login_attempts = 0, status = 'Active';

COMMIT;

-- =========================================================================================
-- KIỂM TRA LẠI CÁC TÀI KHOẢN ĐƯỢC GIỮ LẠI:
-- =========================================================================================
-- SELECT id, email, full_name, role, status FROM app_users;
