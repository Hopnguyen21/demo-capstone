-- Gỡ cây Xà Lách Cuộn theo yêu cầu: Zone "Luong 01" giữ lại nhưng bỏ cây/giống; xóa vụ đang chạy của Zone, cảnh báo và quy tắc cảnh báo gắn với giai đoạn của cây;
-- các khuyến nghị AI cũ giữ lại nhưng bỏ tham chiếu giai đoạn. Bản sao dữ liệu bị xóa/sửa: db_backup_2026-11-01/xl_*.csv
BEGIN;
UPDATE zones SET crop_id = NULL, crop_variety_id = NULL WHERE crop_id = '40000000-0000-0000-0000-000000000002';
UPDATE ai_recommendations SET growth_stage_id = NULL WHERE growth_stage_id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002');
DELETE FROM alerts WHERE planting_season_id = '44000000-0000-0000-0000-000000000002' OR growth_stage_id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002') OR alert_rule_id IN (SELECT id FROM alert_rules WHERE growth_stage_id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002'));
DELETE FROM alert_rules WHERE growth_stage_id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002');
DELETE FROM season_applied_requirements WHERE planting_season_id = '44000000-0000-0000-0000-000000000002';
DELETE FROM season_stage_transitions WHERE planting_season_id = '44000000-0000-0000-0000-000000000002';
DELETE FROM planting_seasons WHERE id = '44000000-0000-0000-0000-000000000002';
DELETE FROM environmental_requirements WHERE growth_stage_id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002');
DELETE FROM growth_stages WHERE id IN (select g.id from growth_stages g join growth_profiles p on p.id=g.growth_profile_id where p.crop_id='40000000-0000-0000-0000-000000000002');
DELETE FROM growth_profiles WHERE crop_id = '40000000-0000-0000-0000-000000000002';
DELETE FROM crop_varieties WHERE crop_id = '40000000-0000-0000-0000-000000000002';
DELETE FROM crops WHERE id = '40000000-0000-0000-0000-000000000002';
COMMIT;
