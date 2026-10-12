-- Seed rich AI Consultation History and Recommendations for all zones
DO $$
DECLARE
    u_owner UUID := '20000000-0000-0000-0000-000000000001';
    t_id UUID := '10000000-0000-0000-0000-000000000001';
    
    -- Zone 2: Thủy Canh Xà Lách
    z2_id UUID := '32000000-0000-0000-0000-000000000002';
    f2_id UUID := '30000000-0000-0000-0000-000000000002';
    act2_id UUID := '53000000-0000-0000-0000-000000000002';
    req2 UUID := gen_random_uuid();
    rec2 UUID := gen_random_uuid();

    -- Zone 3: Dâu Tây Giàn Cao Tầng
    z3_id UUID := '32000000-0000-0000-0000-000000000003';
    f3_id UUID := '30000000-0000-0000-0000-000000000002';
    act3_id UUID := '54000000-0000-0000-0000-000000000007';
    req3 UUID := gen_random_uuid();
    rec3 UUID := gen_random_uuid();

    -- Zone 4: Cà Chua Chuông F1
    z4_id UUID := '32000000-0000-0000-0000-000000000004';
    f4_id UUID := '30000000-0000-0000-0000-000000000003';
    act4_id UUID := '54000000-0000-0000-0000-000000000005';
    req4 UUID := gen_random_uuid();
    rec4 UUID := gen_random_uuid();
BEGIN
    -- ========================================================
    -- 1. AI Recommendation cho Zone 2: Rau Xà Lách Thủy Canh NFT
    -- ========================================================
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req2, t_id, f2_id, z2_id, u_owner,
        'Nồng độ dinh dưỡng EC 2.1 và pH 6.25 hiện tại có làm cháy lá cây xà lách thủy canh không?',
        '{"crop": "Xà Lách Romaine", "stage": "Phát triển bẹ lá", "ec": 2.1, "ph": 6.25, "temperature": 32.5}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec2, req2, t_id, f2_id, z2_id,
        'Nồng độ EC 2.1 mS/cm hơi cao so với ngưỡng tối ưu của Xà lách thủy canh (1.4 - 1.8 mS/cm) trong điều kiện nhiệt độ cao, khuyến nghị châm thêm nước ngọt pha loãng.',
        'Trong điều kiện nhiệt độ ban ngày tăng cao (trên 30°C), cây thoát hơi nước nhanh dẫn đến hiện tượng hút dinh dưỡng quá mức, dễ gây cháy viền lá (tipburn). Cần kích hoạt bơm cấp nước ngọt tuần hoàn trong 15 phút để hạ chỉ số EC về khoảng 1.6 mS/cm, đồng thời kiểm soát pH ở mức 5.8 - 6.2.',
        'Khuyến nghị căn cứ trên cảm biến đo hồi lưu tại bồn trung tâm.',
        0.9400, 'Ready', true, NOW() + INTERVAL '24 hours',
        act2_id, 'TurnOn', 900, NOW() - INTERVAL '2 hours'
    );

    -- ========================================================
    -- 2. AI Recommendation cho Zone 3: Dâu Tây Hana
    -- ========================================================
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req3, t_id, f3_id, z3_id, u_owner,
        'Độ ẩm đất 42% có gây rụng hoa dâu tây không? Có nên kích hoạt hệ thống tưới nhỏ giọt ngay không?',
        '{"crop": "Dâu Tây Hana", "stage": "Ra hoa & Nuôi quả", "soil_moisture": 42.0, "air_temp": 34.2}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '40 minutes'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec3, req3, t_id, f3_id, z3_id,
        'Độ ẩm đất 42% thấp nghiêm trọng dưới ngưỡng yêu cầu (60-70%) trong giai đoạn ra hoa, cần tưới nước ngay để tránh teo quả non và khô phấn hoa.',
        'Dâu tây giai đoạn nuôi hoa và đậu quả cực kỳ nhạy cảm với hạn cục bộ. Với nhiệt độ nhà màng đạt 34.2°C và ẩm đất chỉ 42%, rễ cây đang chịu áp lực lớn. Khuyến nghị bật van tưới nhỏ giọt phân đoạn trong 10 phút (600s), sau đó nghỉ 20 phút để nước ngấm đều giá thể xơ dừa.',
        'Tránh tưới phun từ trên cao làm ướt cánh hoa.',
        0.9600, 'Ready', true, NOW() + INTERVAL '24 hours',
        act3_id, 'TurnOn', 600, NOW() - INTERVAL '40 minutes'
    );

    -- ========================================================
    -- 3. AI Recommendation cho Zone 4: Cà Chua Chuông F1
    -- ========================================================
    INSERT INTO ai_consultation_requests (
        id, tenant_id, farm_id, zone_id, requested_by_user_id, question, 
        context_snapshot, status, provider_name, completed_at_utc, created_at_utc
    ) VALUES (
        req4, t_id, f4_id, z4_id, u_owner,
        'Nhiệt độ 34.2°C và cường độ ánh sáng 52,000 lux có cần kéo lưới cắt nắng hoặc bật quạt đối lưu không?',
        '{"crop": "Cà Chua Chuông F1", "stage": "Sinh trưởng sinh dưỡng", "temperature": 34.2, "lux": 52000}',
        'Completed', 'Google Gemini 2.5 Flash', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'
    );

    INSERT INTO ai_recommendations (
        id, consultation_request_id, tenant_id, farm_id, zone_id, summary, details, 
        limitations, confidence, status, is_actionable, valid_until_utc, 
        proposed_actuator_id, proposed_action, proposed_duration_seconds, created_at_utc
    ) VALUES (
        rec4, req4, t_id, f4_id, z4_id,
        'Cường độ ánh sáng và nhiệt độ vượt ngưỡng chịu đựng của cà chua chuông (ngưỡng an toàn < 30°C), cần bật hệ thống làm mát / phun sương giảm nhiệt.',
        'Cà chua chuông khi gặp nhiệt độ trên 32°C sẽ giảm khả năng quang hợp và có nguy cơ rụng mầm non. Đề xuất bật cụm quạt thông gió đối lưu và hệ thống phun sương làm mát trong thời gian 15 phút (900 giây) để hạ nhiệt độ vi khí hậu trong nhà màng xuống mức 27 - 28°C.',
        'Đảm bảo độ ẩm không khí không vượt quá 85% để ngăn ngừa nấm mốc phấn trắng.',
        0.9300, 'Ready', true, NOW() + INTERVAL '24 hours',
        act4_id, 'TurnOn', 900, NOW() - INTERVAL '15 minutes'
    );

END $$;
