-- Sửa dữ liệu dev đã kiểm tra ngày 2026-11-01. Chỉ sửa chỗ sai rõ ràng, không đoán cây hay giống mới.
BEGIN;

-- 1) Giống thuộc cây khác (vd. "Beef F1" của Cà chua Beefsteak gắn vào Cà chua chuông): bỏ giống, giữ nguyên cây.
--    Hồ sơ, vụ và Zone cùng bỏ giống để vẫn khớp nhau; giống đúng của cây do Owner chọn lại khi cần.
UPDATE growth_profiles p SET variety_id = NULL
WHERE p.variety_id IS NOT NULL AND EXISTS (SELECT 1 FROM crop_varieties v WHERE v.id = p.variety_id AND v.crop_id <> p.crop_id);

UPDATE planting_seasons s SET variety_id = NULL
WHERE s.variety_id IS NOT NULL AND EXISTS (SELECT 1 FROM crop_varieties v WHERE v.id = s.variety_id AND v.crop_id <> s.crop_id);

UPDATE zones z SET crop_variety_id = NULL
WHERE z.crop_variety_id IS NOT NULL AND EXISTS (SELECT 1 FROM crop_varieties v WHERE v.id = z.crop_variety_id AND v.crop_id <> z.crop_id);

-- 2) Diện tích còn trống của Field = diện tích Field - tổng diện tích các Zone chưa lưu trữ.
UPDATE fields f SET available_area_m2 = f.area_m2 - COALESCE((SELECT SUM(z.area_m2) FROM zones z WHERE z.field_id = f.id AND z.status <> 'Archived'), 0)
WHERE f.available_area_m2 <> f.area_m2 - COALESCE((SELECT SUM(z.area_m2) FROM zones z WHERE z.field_id = f.id AND z.status <> 'Archived'), 0);

-- 3) Lịch [AutoSync] dùng cron 6 trường (có giây) mà bộ chạy lịch không đọc được nên chưa từng chạy:
--    đổi sang 5 trường và đặt lần chạy kế tiếp (theo giờ Việt Nam) cho lịch hằng ngày.
UPDATE control_schedules s SET
    cron_expression = split_part(s.cron_expression, ' ', 2) || ' ' || split_part(s.cron_expression, ' ', 3) || ' * * *',
    next_run_at_utc = (
        CASE WHEN (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + make_interval(hours => split_part(s.cron_expression, ' ', 3)::int, mins => split_part(s.cron_expression, ' ', 2)::int)) <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
             THEN date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 day' + make_interval(hours => split_part(s.cron_expression, ' ', 3)::int, mins => split_part(s.cron_expression, ' ', 2)::int)
             ELSE date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + make_interval(hours => split_part(s.cron_expression, ' ', 3)::int, mins => split_part(s.cron_expression, ' ', 2)::int)
        END) AT TIME ZONE 'Asia/Ho_Chi_Minh'
WHERE s.name LIKE '[AutoSync]%' AND array_length(string_to_array(trim(s.cron_expression), ' '), 1) = 6;

COMMIT;

-- 4) Vụ có giống nhưng hồ sơ là hồ sơ chung của cây (không nêu giống): kiểm tra ngưỡng tưới yêu cầu giống của vụ khớp hồ sơ.
-- Giống của Zone vẫn được giữ.
BEGIN;
UPDATE planting_seasons s SET variety_id = NULL
FROM growth_profiles p
WHERE p.id = s.growth_profile_id AND p.variety_id IS NULL AND s.variety_id IS NOT NULL;
COMMIT;

-- 5) Hồ sơ khấu hao phải thuộc đúng Zone của thiết bị (seed gán lệch Zone).
BEGIN;
UPDATE "DeviceDepreciations" d SET "ZoneId" = x.zone_id
FROM devices x
WHERE x.id = d."DeviceId" AND x.zone_id IS NOT NULL AND x.zone_id <> d."ZoneId";
COMMIT;
