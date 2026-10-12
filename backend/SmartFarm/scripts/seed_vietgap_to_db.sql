-- ==============================================================================
-- CAP NHAT VA CHUAN HOA HO SO SINH TRUONG VIETGAP CHUAN TCVN 11892-1:2017
-- CHO CAC LOAI CAY NGAN HAN CANH TAC LUONG DAT VAO DATABASE
-- ==============================================================================

-- 1. Chuan hoa ten Crop va ten Profile thanh quy chuan VietGAP
UPDATE crops
SET name = 'Ca Chua Chuong (Sweet Pepper)',
    scientific_name = 'Capsicum annuum',
    description = 'Ca chua chuong F1 trong nha mang dat theo tieu chuan VietGAP'
WHERE id = '10000000-0000-0000-0000-000000000001';

UPDATE crops
SET name = 'Dau Tay Hana (Strawberry)',
    scientific_name = 'Fragaria x ananassa',
    description = 'Dau tay Nhat Hana canh tac luong dat phu mang theo tieu chuan VietGAP'
WHERE id = '40000000-0000-0000-0000-000000000003';

UPDATE crops
SET name = 'Xa Lach Cuon Dat (Batavia)',
    scientific_name = 'Lactuca sativa var. capitata',
    description = 'Xa lach cuon trong dat mo theo tieu chuan VietGAP'
WHERE id = '40000000-0000-0000-0000-000000000002';

-- 2. Cap nhat ten Growth Profiles
UPDATE growth_profiles
SET name = 'Quy trinh VietGAP Ca Chua Chuong Luong Dat (90-110 ngay)',
    description = 'Tieu chuan vi khi hau canh tac luong dat VietGAP: Do am dat 60-75%, Nhiet do 21-28 C, pH 6.0-6.8'
WHERE id = '10000000-0000-0000-0000-000000000003';

UPDATE growth_profiles
SET name = 'Quy trinh VietGAP Dau Tay Hana Luong Dat (90-120 ngay)',
    description = 'Tieu chuan vi khi hau luong dat phu mang: Do am dat nuoi trai 60-70%, Nhiet do 18-26 C, pH 5.8-6.5'
WHERE id = '42000000-0000-0000-0000-000000000003';

UPDATE growth_profiles
SET name = 'Quy trinh VietGAP Xa Lach Cuon Luong Dat (45-50 ngay)',
    description = 'Tieu chuan vi khi hau luong dat mo: Do am dat 65-75%, Nhiet do 18-24 C, pH 6.0-7.0'
WHERE id = '42000000-0000-0000-0000-000000000002';

-- 3. Xoa sach cac nguong vi khi hau cu va nap nguong chuan tu cac file PDF VietGAP
DELETE FROM environmental_requirements 
WHERE growth_stage_id IN (
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005',
    '43000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000003'
);

-- =====================================================================
-- NẠP DẢI NGƯỠNG VIETGAP CHO: CÀ CHUA CHUÔNG
-- =====================================================================
-- Giai đoạn 1: Seedling (Cây con)
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit) VALUES
('10000000-0000-0000-0000-000000000004', 'Temperature',    20.0, 27.0, 24.0, 'C'),
('10000000-0000-0000-0000-000000000004', 'SoilMoisture',   65.0, 75.0, 70.0, '%'),
('10000000-0000-0000-0000-000000000004', 'AirHumidity',    65.0, 75.0, 70.0, '%'),
('10000000-0000-0000-0000-000000000004', 'Ph',              6.0,  6.8,  6.4, 'pH'),
('10000000-0000-0000-0000-000000000004', 'LightIntensity', 25000, 45000, 35000, 'lux');

-- Giai đoạn 2: Vegetative (Sinh trưởng thân lá & Ra hoa)
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit) VALUES
('10000000-0000-0000-0000-000000000005', 'Temperature',    21.0, 28.0, 25.0, 'C'),
('10000000-0000-0000-0000-000000000005', 'SoilMoisture',   60.0, 75.0, 68.0, '%'),
('10000000-0000-0000-0000-000000000005', 'AirHumidity',    60.0, 75.0, 68.0, '%'),
('10000000-0000-0000-0000-000000000005', 'Ph',              6.0,  6.8,  6.5, 'pH'),
('10000000-0000-0000-0000-000000000005', 'LightIntensity', 30000, 50000, 42000, 'lux');

-- =====================================================================
-- NẠP DẢI NGƯỠNG VIETGAP CHO: XÀ LÁCH CUỘN ĐẤT
-- =====================================================================
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit) VALUES
('43000000-0000-0000-0000-000000000002', 'Temperature',    18.0, 25.0, 22.0, 'C'),
('43000000-0000-0000-0000-000000000002', 'SoilMoisture',   65.0, 75.0, 70.0, '%'),
('43000000-0000-0000-0000-000000000002', 'AirHumidity',    60.0, 75.0, 68.0, '%'),
('43000000-0000-0000-0000-000000000002', 'Ph',              6.0,  7.0,  6.5, 'pH'),
('43000000-0000-0000-0000-000000000002', 'LightIntensity', 20000, 40000, 30000, 'lux');

-- =====================================================================
-- NẠP DẢI NGƯỠNG VIETGAP CHO: DÂU TÂY HANA ĐẤT
-- =====================================================================
INSERT INTO environmental_requirements (growth_stage_id, parameter_code, min_value, max_value, target_value, unit) VALUES
('43000000-0000-0000-0000-000000000003', 'Temperature',    18.0, 26.0, 22.5, 'C'),
('43000000-0000-0000-0000-000000000003', 'SoilMoisture',   60.0, 70.0, 65.0, '%'),
('43000000-0000-0000-0000-000000000003', 'AirHumidity',    60.0, 75.0, 68.0, '%'),
('43000000-0000-0000-0000-000000000003', 'Ph',              5.8,  6.5,  6.2, 'pH'),
('43000000-0000-0000-0000-000000000003', 'LightIntensity', 25000, 45000, 35000, 'lux');

-- 4. Dong bo truc tiep vao season_applied_requirements cua cac vu mua dang hoat dong
DELETE FROM season_applied_requirements;

INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT ps.id, er.parameter_code, er.min_value, er.max_value, er.target_value, er.unit
FROM planting_seasons ps
JOIN environmental_requirements er ON er.growth_stage_id = ps.current_growth_stage_id;
