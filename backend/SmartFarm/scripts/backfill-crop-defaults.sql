-- Bổ sung thông tin cấp cây trồng từ dữ liệu ĐÃ CÓ trong hồ sơ sinh trưởng hệ thống. Chỉ điền ô đang trống (NULL), không ghi đè,
-- và không bịa số liệu: khoảng tối ưu của cây = khoảng thấp nhất / cao nhất của ngưỡng các giai đoạn trong profile hệ thống.
-- Không điền phân bón, phòng trừ sâu bệnh hay loại đất vì hệ thống chưa có nguồn số liệu đã duyệt cho các mục này.
BEGIN;

-- Nhóm cây (phân loại chung, không phải số liệu kỹ thuật).
UPDATE crops SET category = CASE
    WHEN name ILIKE '%xà lách%' OR name ILIKE '%xa lach%' OR name ILIKE '%cải%' OR name ILIKE '%cai %' THEN 'Rau ăn lá'
    WHEN name ILIKE '%cà chua%' OR name ILIKE '%ca chua%' OR name ILIKE '%dưa%' OR name ILIKE '%dua%' OR name ILIKE '%dâu tây%' OR name ILIKE '%dau tay%' THEN 'Rau ăn quả'
  END
WHERE category IS NULL AND is_system_defined;

WITH agg AS (
    SELECT p.crop_id, r.parameter_code, MIN(r.min_value) AS mn, MAX(r.max_value) AS mx, AVG(r.target_value) AS tgt
    FROM environmental_requirements r
    JOIN growth_stages s ON s.id = r.growth_stage_id
    JOIN growth_profiles p ON p.id = s.growth_profile_id
    WHERE p.is_system_defined
    GROUP BY p.crop_id, r.parameter_code
)
UPDATE crops c SET
    optimal_temperature_min   = COALESCE(c.optimal_temperature_min,   (SELECT mn FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Temperature')),
    optimal_temperature_max   = COALESCE(c.optimal_temperature_max,   (SELECT mx FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Temperature')),
    optimal_soil_moisture_min = COALESCE(c.optimal_soil_moisture_min, (SELECT mn FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'SoilMoisture')),
    optimal_soil_moisture_max = COALESCE(c.optimal_soil_moisture_max, (SELECT mx FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'SoilMoisture')),
    optimal_ph_min            = COALESCE(c.optimal_ph_min,            (SELECT mn FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Ph')),
    optimal_ph_max            = COALESCE(c.optimal_ph_max,            (SELECT mx FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Ph')),
    optimal_ec_min            = COALESCE(c.optimal_ec_min,            (SELECT mn FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Ec')),
    optimal_ec_max            = COALESCE(c.optimal_ec_max,            (SELECT mx FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'Ec')),
    optimal_lux               = COALESCE(c.optimal_lux,               (SELECT ROUND(tgt, 0) FROM agg a WHERE a.crop_id = c.id AND a.parameter_code = 'LightIntensity'))
WHERE c.is_system_defined;

-- Số ngày chu kỳ: tổng số ngày các giai đoạn khi cây chỉ có MỘT profile hệ thống (cây có nhiều profile khác nhau thì giữ trống).
UPDATE crops c SET growth_cycle_days = x.total
FROM (
    SELECT p.crop_id, SUM(s.duration_days)::int AS total
    FROM growth_profiles p JOIN growth_stages s ON s.growth_profile_id = p.id
    WHERE p.is_system_defined
      AND p.crop_id IN (SELECT crop_id FROM growth_profiles WHERE is_system_defined GROUP BY crop_id HAVING COUNT(*) = 1)
    GROUP BY p.crop_id
) x
WHERE c.id = x.crop_id AND c.growth_cycle_days IS NULL;

COMMIT;
