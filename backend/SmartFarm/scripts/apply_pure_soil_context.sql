-- =========================================================================
-- CAP NHAT TOAN BO DATABASE SAN CANH TAC RUONG LUONG / DAT NGOAI TROI (SOIL)
-- LOAI BO HOAN TOAN CAC THUAT NGU VA MO HINH THUY CANH (NFT / HYDROPONIC)
-- =========================================================================

-- 1. Cap nhat Farm:
UPDATE farms 
SET name = 'Nong Trai Canh Tac Luong Dat Don Duong' 
WHERE id = '30000000-0000-0000-0000-000000000003';

UPDATE farms 
SET name = 'Trang Trai Canh Tac Luong Dat Cau Dat' 
WHERE id = '30000000-0000-0000-0000-000000000002';

UPDATE farms 
SET name = 'Nong Trai Canh Tac Dat Mau' 
WHERE id = '30000000-0000-0000-0000-000000000001';

-- 2. Cap nhat Fields (Lô ruộng):
UPDATE fields 
SET name = 'Khu Luong Dat Trong Ngoai Troi Lo A',
    soil_type = 'Dat thit phu sa'
WHERE id = '31000000-0000-0000-0000-000000000002';

UPDATE fields 
SET name = 'Khu Luong Dat Dau Tay Lo B',
    soil_type = 'Dat do bazan thoat nuoc tot'
WHERE id = '31000000-0000-0000-0000-000000000003';

UPDATE fields 
SET name = 'Khu Luong Dat Ca Chua Lo C',
    soil_type = 'Dat pha cat toi xop'
WHERE id = '31000000-0000-0000-0000-000000000004';

UPDATE fields 
SET name = 'Khu Luong Dat Thuc Nghiem Lo 00',
    soil_type = 'Dat thit pha set nhe'
WHERE id = '31000000-0000-0000-0000-000000000001';

-- 3. Cap nhat Zones (Luống trồng đất):
UPDATE zones 
SET name = 'Luong 01 - Trong Dat Xa Lach Cuon',
    zone_type = 'OpenField',
    notes = 'Canh tac len luong cao 25cm, he thong tuoi nho giot doc luong'
WHERE id = '32000000-0000-0000-0000-000000000002';

UPDATE zones 
SET name = 'Luong 02 - Trong Dat Dau Tay Hana',
    zone_type = 'OpenField',
    notes = 'Canh tac luong phu mang nylon den, tuoi nho giot duoi mang phu'
WHERE id = '32000000-0000-0000-0000-000000000003';

UPDATE zones 
SET name = 'Luong 03 - Trong Dat Ca Chua Chuong F1',
    zone_type = 'OpenField',
    notes = 'Luong cao 30cm co cam coc chong do, tuoi phun goc va tuoi tham'
WHERE id = '32000000-0000-0000-0000-000000000004';

UPDATE zones 
SET name = 'Luong 00 - Canh Tac Dat Dua Leo Mau',
    zone_type = 'OpenField',
    notes = 'Luong dat tieu chuan VietGAP'
WHERE id = '32000000-0000-0000-0000-000000000001';

-- 4. Cap nhat Crops:
UPDATE crops 
SET name = 'Xa Lach Cuon Dat (Batavia)',
    scientific_name = 'Lactuca sativa var. capitata'
WHERE id = '10000000-0000-0000-0000-000000000003';

-- 5. Cap nhat Thiet bi phan cung: Doi ten Actuator / Sensor sang tuoi nho giot luong dat
UPDATE devices
SET hardware_address = 'SENSOR-SOIL-BED-001'
WHERE id = '52000000-0000-0000-0000-000000000003';

UPDATE devices
SET hardware_address = 'ACTUATOR-DRIP-BED-001'
WHERE id = '52000000-0000-0000-0000-000000000004';

UPDATE device_actuators
SET actuator_type = 'IrrigationPump'
WHERE id = '53000000-0000-0000-0000-000000000002';

-- 6. Cap nhat Nguong yeu cau moi truong vu mua (Xoa bo thong so EC dung dich thuy canh, giu thong so Do am dat, Nhiet do, Do am KK, pH, Anh sang)
DELETE FROM season_applied_requirements WHERE parameter_code IN ('Ec', 'EC');

-- Dam bao co day du nguong Do am dat (SoilMoisture) cho cac vu mua dat
INSERT INTO season_applied_requirements (planting_season_id, parameter_code, min_value, max_value, target_value, unit)
SELECT ps.id, 'SoilMoisture', 60.0, 75.0, 68.0, '%'
FROM planting_seasons ps
ON CONFLICT (planting_season_id, parameter_code) 
DO UPDATE SET min_value = 60.0, max_value = 75.0, target_value = 68.0;

-- 7. Don sach cac hoi thoai cu co noi dung ve thuy canh trong AI History
DELETE FROM ai_consultation_requests WHERE question ILIKE '%thủy canh%' OR question ILIKE '%thuy canh%' OR question ILIKE '%hồi lưu%' OR question ILIKE '%hoi luu%';

-- 8. Seed bo du lieu AI History hoan toan moi chuan bối cảnh RUỘNG ĐẤT / LÊN LUỐNG
DO $$
DECLARE
    u_owner UUID := '20000000-0000-0000-0000-000000000001';
    t_id UUID := '10000000-0000-0000-0000-000000000001';

    -- Luong 01: Xa lach cuon dat
    z1_id UUID := '32000000-0000-0000-0000-000000000002';
    f1_id UUID := '30000000-0000-0000-0000-000000000002';
    act1_id UUID := '53000000-0000-0000-0000-000000000002';
    req1 UUID := gen_random_uuid();
    rec1 UUID := gen_random_uuid();

    -- Luong 02: Dau tay luong dat
    z2_id UUID := '32000000-0000-0000-0000-000000000003';
    f2_id UUID := '30000000-0000-0000-0000-000000000002';
    act2_id UUID := '54000000-0000-0000-0000-000000000007';
    req2 UUID := gen_random_uuid();
    rec2 UUID := gen_random_uuid();

    -- Luong 03: Ca chua chuong luong dat
    z3_id UUID := '32000000-0000-0000-0000-000000000004';
    f3_id UUID := '30000000-0000-0000-0000-000000000003';
    act3_id UUID := '54000000-0000-0000-0000-000000000005';
    req3 UUID := gen_random_uuid();
    rec3 UUID := gen_random_uuid();
BEGIN
    -- Câu hỏi 1: Luống xà lách đất
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req1, t_id, f1_id, z1_id, u_owner,
        'Đất thịt pha phù sa trên luống xà lách đang có độ ẩm 42.0%, có cần kích hoạt van tưới nhỏ giọt không?',
        '{"crop": "Xà lách cuộn", "farming": "Luống đất", "soil_moisture": 42.0, "soil_type": "Đất thịt phù sa"}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec1, req1, t_id, f1_id, z1_id,
        'Độ ẩm đất trên luống đang ở mức 42.0%, thấp hơn ngưỡng chuẩn sinh trưởng bẹ lá (65-75%), đề xuất kích hoạt hệ thống tưới nhỏ giọt dọc luống.',
        'Xà lách trồng luống đất có bộ rễ chùm ăn nông ở tầng đất mặt (0-15cm). Khi ẩm độ đất tụt xuống 42%, đất mặt bị đóng váng và rễ hút nước kém dẫn đến héo lá non. Khuyến nghị bật van tưới nhỏ giọt dọc luống trong 10 phút (600s) với lưu lượng 2 lít/giờ/đầu tưới để nước thấm sâu vào vùng rễ mà không làm xói lở đất luống.',
        'Tránh tưới ngập rãnh gây nghẹt rễ.',
        0.9500, 'Ready', true, NOW() + INTERVAL '24 hours',
        act1_id, 'TurnOn', 600, NOW() - INTERVAL '3 hours'
    );

    -- Câu hỏi 2: Luống dâu tây đất
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req2, t_id, f2_id, z2_id, u_owner,
        'Độ ẩm đất dưới màng phủ nylon luống dâu tây đang ở mức 42%, hãy khuyến nghị cách tưới phục hồi?',
        '{"crop": "Dâu tây Hana", "farming": "Luống đất phủ bạt", "soil_moisture": 42.0, "stage": "Ra hoa nuôi quả"}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec2, req2, t_id, f2_id, z2_id,
        'Độ ẩm đất 42% dưới luống phủ màng là mức báo động khô hạn cục bộ cho dâu tây giai đoạn nuôi trái, cần kích hoạt tưới nhỏ giọt ngầm.',
        'Đất đỏ bazan trồng dâu tây phủ màng nông nghiệp giữ ẩm tốt nhưng một khi đã khô sẽ co ngót làm đứt rễ non. Với nhiệt độ cao 34.2°C, cần cấp nước bù ẩm qua dây tưới nhỏ giọt dưới màng phủ trong 10 phút (600 giây). Nước sẽ lan đều từ từ trong mao dẫn đất mà không làm ướt trái dâu nằm trên bạt phủ.',
        'Theo dõi thêm cảm biến độ ẩm đất sau 30 phút tưới.',
        0.9600, 'Ready', true, NOW() + INTERVAL '24 hours',
        act2_id, 'TurnOn', 600, NOW() - INTERVAL '1 hour'
    );

    -- Câu hỏi 3: Luống cà chua chuông
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req3, t_id, f3_id, z3_id, u_owner,
        'Độ ẩm đất luống cà chua chuông hiện tại 42% có cần tưới nước gấp không? Đề xuất thời gian tưới thích hợp.',
        '{"crop": "Cà chua chuông F1", "farming": "Luống đất có cọc", "soil_moisture": 42.0, "temperature": 34.2}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec3, req3, t_id, f3_id, z3_id,
        'Độ ẩm đất 42% trên luống cà chua chuông đang dưới ngưỡng tối thiểu (60%), cần kích hoạt tưới rãnh/phun gốc ngay để bảo vệ sinh trưởng.',
        'Cây cà chua chuông tán lá rộng nên lượng thoát hơi nước qua lá rất lớn khi nhiệt độ đạt 34.2°C. Đất khô sẽ làm hoa bị thui và rụng lá già. Khuyến nghị bật bơm tưới nước vào gốc luống trong 15 phút (900s) để bổ sung lượng nước thiếu hụt trong tầng đất rễ.',
        'Kiểm tra độ ẩm rãnh thoát nước sau tưới tránh đọng nước chân luống.',
        0.9500, 'Ready', true, NOW() + INTERVAL '24 hours',
        act3_id, 'TurnOn', 900, NOW() - INTERVAL '20 minutes'
    );

END $$;
