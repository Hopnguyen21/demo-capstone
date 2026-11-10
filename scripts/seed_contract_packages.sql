BEGIN;

-- 1. Insert or Update rich service packages
INSERT INTO "ContractPackages" ("Id", "PackageName", "Description", "DurationMonths", "MaxZones", "Price", "Currency", "Status", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES
(
    'a0000001-0000-0000-0000-000000000001',
    'Gói Starter (Nông hộ Thử nghiệm)',
    'Gói khởi đầu 6 tháng dành cho hộ nông dân hoặc vườn thực nghiệm nhỏ tối đa 1 phân khu canh tác. Cung cấp giám sát vi khí hậu thời gian thực và lịch tưới tiêu cơ bản.',
    6,
    1,
    5000000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000002',
    'Gói Standard (Trang trại Tiêu chuẩn)',
    'Gói 12 tháng tối ưu cho trang trại vừa và nhỏ với tối đa 2 phân khu nhà màng. Tích hợp luật cảnh báo nhiệt - ẩm tự động, điều khiển bơm tưới và dự báo thời tiết Open-Meteo.',
    12,
    2,
    9500000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000003',
    'Gói Professional (Hợp tác xã Công nghệ cao)',
    'Gói chuyên nghiệp 12 tháng dành cho hợp tác xã canh tác hiện đại lên tới 5 phân khu. Quản lý trọn gói: IoT LoRa ESP32, tưới châm phân dinh dưỡng tự động, quy chuẩn VietGAP và chẩn đoán nông học Gemini AI.',
    12,
    5,
    22000000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000004',
    'Gói Enterprise (Doanh nghiệp Nông nghiệp)',
    'Giải pháp toàn diện 24 tháng cho doanh nghiệp nông nghiệp quy mô lớn tối đa 12 phân khu. Không giới hạn số lượng thiết bị node, báo cáo kiểm toán xuất khẩu GlobalGAP và cam kết bảo hành phần cứng 24/7.',
    24,
    12,
    48000000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000005',
    'Gói Thủy canh Chuyên sâu (Hydroponics Advance)',
    'Gói 6 tháng chuyên biệt cho mô hình canh tác rau thủy canh hồi lưu và khí canh tối đa 3 phân khu. Tích hợp cảm biến EC/pH chuyên dụng, tự động điều chỉnh nồng độ dung dịch theo giai đoạn phát triển.',
    6,
    3,
    12500000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000006',
    'Gói Canh tác Cây ăn quả & Dâu tây (Highland Berry)',
    'Gói 12 tháng thiết kế đặc thù cho cây ăn quả giá trị cao và dâu tây nhà kính tối đa 4 phân khu. Tối ưu hệ thống béc tưới bù áp Rivulis, cảm biến độ ẩm rễ sâu và cảnh báo dịch bệnh sinh học.',
    12,
    4,
    18000000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000007',
    'Gói VietGAP Cơ bản (Mùa vụ 3 tháng)',
    'Gói ngắn hạn 3 tháng linh hoạt theo từng chu kỳ mùa vụ ngắn ngày (dưa leo, ớt ngọt, rau ăn lá) cho 1 phân khu. Hỗ trợ đầy đủ nhật ký đồng ruộng điện tử và tiêu chuẩn VietGAP TCVN 11892.',
    3,
    1,
    3200000.00,
    'VND',
    0, -- Active
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
),
(
    'a0000001-0000-0000-0000-000000000008',
    'Gói Khuyến mãi Khởi nghiệp 2024 (Legacy Promo)',
    'Chương trình hỗ trợ chuyển đổi số nông nghiệp niên vụ cũ 2024 cho 2 phân khu trong 6 tháng. Gói đã kết thúc đợt khuyến mãi và chuyển sang trạng thái lưu trữ.',
    6,
    2,
    4000000.00,
    'VND',
    1, -- Inactive
    '20000000-0000-0000-0000-000000000003',
    NOW(),
    NOW()
)
ON CONFLICT ("Id") DO UPDATE SET
    "PackageName" = EXCLUDED."PackageName",
    "Description" = EXCLUDED."Description",
    "DurationMonths" = EXCLUDED."DurationMonths",
    "MaxZones" = EXCLUDED."MaxZones",
    "Price" = EXCLUDED."Price",
    "Currency" = EXCLUDED."Currency",
    "Status" = EXCLUDED."Status",
    "UpdatedAtUtc" = NOW();

-- 2. Link existing 13 contracts to their appropriate service packages
-- Contract 76b1e56a-3935-4481-8d1f-f5a17a6a8d36 (HD-SR-A9694818 - Lê Văn An - Cà chua) -> Gói Standard
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000002' WHERE "Id" = '76b1e56a-3935-4481-8d1f-f5a17a6a8d36';

-- Contracts HD-ZN-2026-001 (LangBiang - Cà chua Cherry 144 triệu) -> Gói Professional
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000003' WHERE "ContractNumber" = 'HD-ZN-2026-001';

-- Contracts HD-ZN-2026-002 (GreenValley - Dâu tây Hana) -> Gói Highland Berry
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000006' WHERE "ContractNumber" = 'HD-ZN-2026-002';

-- Contracts HD-ZN-2025-089 (Trang trại An Nhiên - Ớt chuông 2024-2025) -> Gói Legacy Promo
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000008' WHERE "ContractNumber" = 'HD-ZN-2025-089';

-- Contract HD-ZN-202610-323 (An Nhiên - Demo Hydroponic Farm sz) -> Gói Thủy canh Chuyên sâu
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000005' WHERE "ContractNumber" = 'HD-ZN-202610-323';

-- Contract HD-ZN-202610-562 (An Nhiên - Farm + Field + Zone Test) -> Gói Standard
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000002' WHERE "ContractNumber" = 'HD-ZN-202610-562';

-- Contract HD-ZN-202610-863 (An Nhiên - Beef F1 - Hợp đồng chấm dứt) -> Gói Starter
UPDATE "ZoneContracts" SET "ContractPackageId" = 'a0000001-0000-0000-0000-000000000001' WHERE "ContractNumber" = 'HD-ZN-202610-863';

COMMIT;

