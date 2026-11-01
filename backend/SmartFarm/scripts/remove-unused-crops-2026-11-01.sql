-- Gỡ 3 cây không còn dùng (Dưa leo Baby VietGAP, Dưa Lưới, Xà Lách Thủy Canh) cùng hồ sơ sinh trưởng, giai đoạn, ngưỡng và giống của chúng.
-- Đã kiểm tra: không có Zone, vụ trồng, cảnh báo, quy tắc cảnh báo hay khuyến nghị AI nào tham chiếu tới. Bản sao dữ liệu bị xóa nằm trong db_backup_2026-11-01.
BEGIN;
CREATE TEMP TABLE gone_crops AS SELECT id FROM crops WHERE id IN
  ('8ead41ed-708d-417d-b026-55dd087b6d09', '50000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004');
DELETE FROM environmental_requirements WHERE growth_stage_id IN (SELECT g.id FROM growth_stages g JOIN growth_profiles p ON p.id = g.growth_profile_id WHERE p.crop_id IN (SELECT id FROM gone_crops));
DELETE FROM material_requirement_links WHERE crop_id IN (SELECT id FROM gone_crops);
DELETE FROM growth_stages WHERE growth_profile_id IN (SELECT id FROM growth_profiles WHERE crop_id IN (SELECT id FROM gone_crops));
DELETE FROM growth_profiles WHERE crop_id IN (SELECT id FROM gone_crops);
DELETE FROM crop_varieties WHERE crop_id IN (SELECT id FROM gone_crops);
DELETE FROM crops WHERE id IN (SELECT id FROM gone_crops);
COMMIT;
