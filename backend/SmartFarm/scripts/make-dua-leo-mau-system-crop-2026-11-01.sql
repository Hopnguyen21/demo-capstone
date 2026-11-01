-- Đưa "Dưa leo màu" (cây test do tenant tạo từ Swagger) về cùng dạng các cây khác: cây, giống và hồ sơ sinh trưởng là dữ liệu hệ thống (không thuộc tenant nào),
-- có nhóm cây và mô tả đúng. Khoảng tối ưu lấy từ ngưỡng đã có trong hồ sơ (cùng cách với backfill-crop-defaults.sql), không thêm số liệu mới.
-- Bản sao dòng gốc: db_backup_2026-11-01/dl_*.csv
BEGIN;
UPDATE crops SET tenant_id = NULL, created_by_user_id = NULL, is_system_defined = TRUE,
       normalized_name = UPPER(name), category = 'Rau ăn quả', description = 'Dưa leo màu (Cucumis sativus), nhóm rau ăn quả.', updated_at_utc = now()
WHERE id = '40000000-0000-0000-0000-000000000001';
UPDATE crop_varieties SET tenant_id = NULL, created_by_user_id = NULL, is_system_defined = TRUE WHERE crop_id = '40000000-0000-0000-0000-000000000001';
UPDATE growth_profiles SET tenant_id = NULL, created_by_user_id = NULL, is_system_defined = TRUE WHERE crop_id = '40000000-0000-0000-0000-000000000001';

WITH agg AS (
    SELECT p.crop_id, r.parameter_code, MIN(r.min_value) AS mn, MAX(r.max_value) AS mx, AVG(r.target_value) AS tgt
    FROM environmental_requirements r JOIN growth_stages s ON s.id = r.growth_stage_id JOIN growth_profiles p ON p.id = s.growth_profile_id
    WHERE p.crop_id = '40000000-0000-0000-0000-000000000001' GROUP BY p.crop_id, r.parameter_code
)
UPDATE crops c SET
    optimal_temperature_min   = (SELECT mn FROM agg a WHERE a.parameter_code = 'Temperature'),
    optimal_temperature_max   = (SELECT mx FROM agg a WHERE a.parameter_code = 'Temperature'),
    optimal_soil_moisture_min = (SELECT mn FROM agg a WHERE a.parameter_code = 'SoilMoisture'),
    optimal_soil_moisture_max = (SELECT mx FROM agg a WHERE a.parameter_code = 'SoilMoisture'),
    optimal_ph_min            = (SELECT mn FROM agg a WHERE a.parameter_code = 'Ph'),
    optimal_ph_max            = (SELECT mx FROM agg a WHERE a.parameter_code = 'Ph'),
    optimal_lux               = (SELECT ROUND(tgt, 0) FROM agg a WHERE a.parameter_code = 'LightIntensity')
WHERE c.id = '40000000-0000-0000-0000-000000000001';
COMMIT;
