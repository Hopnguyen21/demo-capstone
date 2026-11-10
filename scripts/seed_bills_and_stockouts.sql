-- Transaction start
BEGIN;

-- 1. Ensure inventory items exist for farms that don't have them yet
-- Farms:
-- Farm 1: 30000000-0000-0000-0000-000000000001 (Demo Hydroponic Farm) - already has some items
-- Farm 2: ab48fbeb-201f-453f-b17f-facd724b8a93 (QA Test Farm LangBiang)
-- Farm 3: b92089c2-6249-403f-958f-8f2c8931c116 (QA Test Farm GreenValley)
-- Farm 4: 78a79da4-cf2b-4c6f-86e5-78701cec05ee (Farm + Field + Zone Test)

INSERT INTO inventory_items ("Id", tenant_id, farm_id, name, normalized_name, material_type, unit, quantity_on_hand, low_stock_threshold, created_at_utc)
VALUES
-- Farm 2 (ab48fbeb-201f-453f-b17f-facd724b8a93)
('81000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ab48fbeb-201f-453f-b17f-facd724b8a93', 'Phân bón NPK YaraMila Complex 12-11-18', 'PHAN BON NPK YARAMILA COMPLEX 12-11-18', 'Fertilizer', 'kg', 250.000, 50.000, NOW()),
('81000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ab48fbeb-201f-453f-b17f-facd724b8a93', 'Hạt giống Cà chua Cherry F1 Đà Lạt', 'HAT GIONG CA CHUA CHERRY F1 DA LAT', 'Seed', 'gói', 80.000, 15.000, NOW()),
('81000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'ab48fbeb-201f-453f-b17f-facd724b8a93', 'Chế phẩm vi sinh Trichoderma Điền Trang', 'CHE PHAM VI SINH TRICHODERMA DIEN TRANG', 'Pesticide', 'gói', 120.000, 20.000, NOW()),
('81000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'ab48fbeb-201f-453f-b17f-facd724b8a93', 'Đầu tưới nhỏ giọt bù áp Rivulis 4L/h', 'DAU TUOI NHO GIOT BU AP RIVULIS 4L/H', 'Equipment', 'cái', 450.000, 50.000, NOW()),

-- Farm 3 (b92089c2-6249-403f-958f-8f2c8931c116)
('82000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'b92089c2-6249-403f-958f-8f2c8931c116', 'Cây giống Dâu tây Hana Nhật Bản (F1)', 'CAY GIONG DAU TAY HANA NHAT BAN (F1)', 'Seed', 'cây', 500.000, 100.000, NOW()),
('82000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'b92089c2-6249-403f-958f-8f2c8931c116', 'Dung dịch dinh dưỡng Thủy canh Bio Dâu tây', 'DUNG DICH DINH DUONG THUY CANH BIO DAU TAY', 'Fertilizer', 'lít', 180.000, 30.000, NOW()),
('82000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'b92089c2-6249-403f-958f-8f2c8931c116', 'Giá thể Peatman chuyên dụng dâu tây', 'GIA THE PEATMAN CHUYEN DUNG DAU TAY', 'GrowingMedium', 'bao', 90.000, 20.000, NOW()),

-- Farm 4 (78a79da4-cf2b-4c6f-86e5-78701cec05ee)
('83000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '78a79da4-cf2b-4c6f-86e5-78701cec05ee', 'Phân hữu cơ vi sinh Quế Lâm', 'PHAN HUU CO VI SINH QUE LAM', 'Fertilizer', 'bao', 150.000, 30.000, NOW()),
('83000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '78a79da4-cf2b-4c6f-86e5-78701cec05ee', 'Ống tưới PE 16mm Dekko', 'ONG TUOI PE 16MM DEKKO', 'Equipment', 'mét', 600.000, 100.000, NOW())
ON CONFLICT ("Id") DO NOTHING;

-- 2. Clear existing Bills and StockOuts to ensure clean idempotent seed
DELETE FROM "StockOutDetails";
DELETE FROM "StockOuts";
DELETE FROM "Bills";

-- 3. SEED BILLS (Hóa Đơn Thu Phí theo 13 Hợp đồng hiện có)
-- Admin User: 20000000-0000-0000-0000-000000000003
-- Tenant: 10000000-0000-0000-0000-000000000001

-- Contract 1: 76b1e56a-3935-4481-8d1f-f5a17a6a8d36 (HD-SR-A9694818 - Lê Văn An - 13.500.000đ)
-- Bill 1: Đặt cọc 30% -> Paid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202610-001',
    '76b1e56a-3935-4481-8d1f-f5a17a6a8d36',
    '10000000-0000-0000-0000-000000000001',
    'Lê Văn An (Chủ Trang Trại)',
    4050000.00,
    4050000.00,
    0.00,
    3, -- Paid
    '2026-10-25',
    '2026-11-05',
    '2026-10-26 09:30:00+07',
    'Chuyển khoản Vietcombank',
    'Thu tiền đặt cọc 30% theo Hợp đồng HD-SR-A9694818',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-25 10:00:00+07',
    '2026-10-26 09:30:00+07'
);

-- Bill 2: Thanh toán đợt 2 (70%) -> Issued (Chờ thanh toán)
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202611-002',
    '76b1e56a-3935-4481-8d1f-f5a17a6a8d36',
    '10000000-0000-0000-0000-000000000001',
    'Lê Văn An (Chủ Trang Trại)',
    9450000.00,
    0.00,
    9450000.00,
    1, -- Issued
    '2026-11-01',
    '2026-11-15',
    NULL,
    NULL,
    'Hóa đơn thanh toán định kỳ đợt 2 Hợp đồng HD-SR-A9694818',
    '20000000-0000-0000-0000-000000000003',
    '2026-11-01 08:30:00+07',
    NULL
);

-- Contract 2: 83f7715a-e006-42f1-b5db-adcbc707da6d (HD-ZN-2026-001 - HTX LangBiang - 144.000.000đ)
-- Bill 3: Thanh toán đợt 1 -> Paid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202604-003',
    '83f7715a-e006-42f1-b5db-adcbc707da6d',
    '10000000-0000-0000-0000-000000000001',
    'Hợp tác xã Nông nghiệp Công nghệ cao LangBiang',
    72000000.00,
    72000000.00,
    0.00,
    3, -- Paid
    '2026-04-25',
    '2026-05-10',
    '2026-04-28 14:15:00+07',
    'Chuyển khoản BIDV',
    'Thanh toán 50% đợt 1 hạ tầng IoT và thuê phân khu nhà màng',
    '20000000-0000-0000-0000-000000000003',
    '2026-04-25 09:00:00+07',
    '2026-04-28 14:15:00+07'
);

-- Bill 4: Thanh toán đợt 2 -> PartiallyPaid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202610-004',
    '83f7715a-e006-42f1-b5db-adcbc707da6d',
    '10000000-0000-0000-0000-000000000001',
    'Hợp tác xã Nông nghiệp Công nghệ cao LangBiang',
    72000000.00,
    40000000.00,
    32000000.00,
    2, -- PartiallyPaid
    '2026-10-20',
    '2026-11-20',
    '2026-10-26 11:00:00+07',
    'Chuyển khoản BIDV',
    'Thanh toán đợt 2 (Đã tạm ứng 40.000.000đ, còn lại 32.000.000đ)',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-20 08:00:00+07',
    '2026-10-26 11:00:00+07'
);

-- Contract 3: 471f7db8-176e-4bd1-afb2-de9f08ecac5e (HD-ZN-2026-002 - GreenValley - 90.000.000đ)
-- Bill 5: Đặt cọc 45.000.000đ -> Paid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202605-005',
    '471f7db8-176e-4bd1-afb2-de9f08ecac5e',
    '10000000-0000-0000-0000-000000000001',
    'Công ty TNHH Nông sản Sạch GreenValley',
    45000000.00,
    45000000.00,
    0.00,
    3, -- Paid
    '2026-05-13',
    '2026-05-25',
    '2026-05-15 16:00:00+07',
    'Chuyển khoản Vietcombank',
    'Thu tiền ký quỹ và cọc 3 tháng Hợp đồng Dâu tây Hana',
    '20000000-0000-0000-0000-000000000003',
    '2026-05-13 14:00:00+07',
    '2026-05-15 16:00:00+07'
);

-- Bill 6: Phí dịch vụ 6 tháng cuối -> Issued
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202611-006',
    '471f7db8-176e-4bd1-afb2-de9f08ecac5e',
    '10000000-0000-0000-0000-000000000001',
    'Công ty TNHH Nông sản Sạch GreenValley',
    45000000.00,
    0.00,
    45000000.00,
    1, -- Issued
    '2026-11-05',
    '2026-11-25',
    NULL,
    NULL,
    'Hóa đơn gia hạn chu kỳ canh tác đợt 2',
    '20000000-0000-0000-0000-000000000003',
    '2026-11-05 10:00:00+07',
    NULL
);

-- Contract 4: 1dd9a943-c9c9-4ba5-800f-6237cbb706fb (HD-ZN-202610-323 - Trang trại An Nhiên - 108.864.000đ)
-- Bill 7: Toàn bộ hợp đồng -> Paid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202610-007',
    '1dd9a943-c9c9-4ba5-800f-6237cbb706fb',
    '10000000-0000-0000-0000-000000000001',
    'Trang trại Hữu cơ An Nhiên',
    108864000.00,
    108864000.00,
    0.00,
    3, -- Paid
    '2026-10-25',
    '2026-11-10',
    '2026-10-27 15:45:00+07',
    'Chuyển khoản Techcombank',
    'Thanh toán trọn gói 1 năm Hợp đồng phân khu sz Demo Hydroponic Farm',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-25 15:00:00+07',
    '2026-10-27 15:45:00+07'
);

-- Contract 5: 963a2ebd-2efc-4361-8d83-1963f913ce89 (HD-ZN-202610-562 - An Nhiên Farm Test - 108.864.000đ)
-- Bill 8: Đợt 1 -> Issued
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202610-008',
    '963a2ebd-2efc-4361-8d83-1963f913ce89',
    '10000000-0000-0000-0000-000000000001',
    'Trang trại Hữu cơ An Nhiên',
    54432000.00,
    0.00,
    54432000.00,
    1, -- Issued
    '2026-10-26',
    '2026-11-15',
    NULL,
    NULL,
    'Hóa đơn phát hành đợt 1 phân khu thử nghiệm Farm + Field + Zone Test',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-26 11:30:00+07',
    NULL
);

-- Contract 6: ac1559e2-1805-46b7-a2d0-beafb4fc2b56 (HD-ZN-2025-089 - Hợp đồng 2024-2025 đã kết thúc)
-- Bill 9: Tất toán HĐ 2025 -> Paid
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202410-009',
    'ac1559e2-1805-46b7-a2d0-beafb4fc2b56',
    '10000000-0000-0000-0000-000000000001',
    'Trang trại Hữu cơ An Nhiên',
    120000000.00,
    120000000.00,
    0.00,
    3, -- Paid
    '2024-10-25',
    '2024-11-15',
    '2024-11-02 10:00:00+07',
    'Chuyển khoản Vietcombank',
    'Hóa đơn tất toán hợp đồng niên vụ 2024-2025 (Đã kết thúc đúng hạn)',
    '20000000-0000-0000-0000-000000000003',
    '2024-10-25 09:00:00+07',
    '2024-11-02 10:00:00+07'
);

-- Contract 7: 3f817985-3791-4b00-a56a-ef48f5615f5d (HD-ZN-202610-863 - Hợp đồng bị thanh lý)
-- Bill 10: Hóa đơn bị hủy do thanh lý hợp đồng -> Cancelled
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202610-010',
    '3f817985-3791-4b00-a56a-ef48f5615f5d',
    '10000000-0000-0000-0000-000000000001',
    'Trang trại Hữu cơ An Nhiên',
    108864000.00,
    0.00,
    108864000.00,
    5, -- Cancelled
    '2026-10-25',
    '2026-11-10',
    NULL,
    NULL,
    'Hóa đơn đã hủy theo quyết định chấm dứt hợp đồng canh tác trước hạn',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-25 10:00:00+07',
    '2026-10-28 16:30:00+07'
);

-- Bill 11: Hóa đơn quá hạn thanh toán -> Overdue
INSERT INTO "Bills" ("Id", "TenantId", "BillCode", "ContractId", "CustomerTenantId", "LesseeName", "Amount", "PaidAmount", "RemainingAmount", "Status", "IssueDate", "DueDate", "PaidDate", "PaymentMethod", "Notes", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    '91000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    'BILL-202609-011',
    'e87a65dd-4958-4cb2-9a21-fd519069e753',
    '10000000-0000-0000-0000-000000000001',
    'Hợp tác xã Nông nghiệp Công nghệ cao LangBiang',
    35000000.00,
    0.00,
    35000000.00,
    4, -- Overdue
    '2026-09-15',
    '2026-10-15',
    NULL,
    NULL,
    'Phí duy tu bảo dưỡng thiết bị IoT cảm biến độ ẩm đất (Quá hạn 25 ngày)',
    '20000000-0000-0000-0000-000000000003',
    '2026-09-15 08:00:00+07',
    NULL
);


-- 4. SEED STOCK OUT (PHIẾU XUẤT KHO) & DETAILS
-- Users:
-- Admin: 20000000-0000-0000-0000-000000000003
-- Technician: 20000000-0000-0000-0000-000000000004
-- Tenant: 10000000-0000-0000-0000-000000000001

-- 4.1 StockOut 1: Farm 30000000-0000-0000-0000-000000000001 (Demo Hydroponic Farm)
-- Zone: 32000000-0000-0000-0000-000000000001 (Khu A1 - Cà chua bi chất lượng cao)
-- Status: 3 (Completed)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'PXK-202610-001',
    3, -- Completed
    '20000000-0000-0000-0000-000000000004', -- Technician
    '20000000-0000-0000-0000-000000000003', -- Admin
    '2026-10-26 14:00:00+07',
    'Xuất vật tư dinh dưỡng thủy canh và hạt giống dưa leo theo Hợp đồng canh tác HD-SR-A9694818',
    '2026-10-26 09:00:00+07',
    '2026-10-26 14:00:00+07'
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 20.0000, 'Dung dịch dinh dưỡng Thủy canh Hydro Umat V pha bồn tuần hoàn', NOW()),
('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 5.0000, 'Hạt giống Dưa leo F1 Green Valley xuống bầu ươm đợt 1', NOW()),
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 10.0000, 'Giá thể xơ dừa vi sinh lót khay', NOW());

-- 4.2 StockOut 2: Farm 30000000-0000-0000-0000-000000000001 (Demo Hydroponic Farm)
-- Zone: 32000000-0000-0000-0000-000000000002 (Demo Open Air Zone)
-- Status: 2 (Approved)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000002',
    'PXK-202611-002',
    2, -- Approved
    '20000000-0000-0000-0000-000000000004', -- Technician
    '20000000-0000-0000-0000-000000000003', -- Admin
    NULL,
    'Cấp phát phân bón NPK Haifa phục vụ đợt bón thúc thời kỳ ra hoa kết trái',
    '2026-11-02 10:15:00+07',
    '2026-11-03 08:30:00+07'
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 15.0000, 'Demo NPK Fertilizer Haifa bón gốc', NOW());

-- 4.3 StockOut 3: Farm 30000000-0000-0000-0000-000000000001 (Demo Hydroponic Farm)
-- Zone: d22ad0d3-200a-47ad-86c0-6ab02511f84a (sz)
-- Status: 1 (Pending)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'd22ad0d3-200a-47ad-86c0-6ab02511f84a',
    'PXK-202611-003',
    1, -- Pending
    '20000000-0000-0000-0000-000000000004', -- Technician
    NULL,
    NULL,
    'Yêu cầu cấp phát phân hữu cơ Bio-Organic bổ sung cho vụ thu đông (Chờ Admin duyệt)',
    '2026-11-08 14:00:00+07',
    NULL
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003', '7664c554-db36-45c9-88d6-2ee81bcdd85e', 25.0000, 'Phân bón Bio-Organic E2E', NOW());

-- 4.4 StockOut 4: Farm ab48fbeb-201f-453f-b17f-facd724b8a93 (QA Test Farm LangBiang)
-- Zone: 79f1be57-cc7a-4dc7-b196-3ffb139d72c1
-- Status: 3 (Completed)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'ab48fbeb-201f-453f-b17f-facd724b8a93',
    '79f1be57-cc7a-4dc7-b196-3ffb139d72c1',
    'PXK-202610-004',
    3, -- Completed
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000003',
    '2026-10-28 16:00:00+07',
    'Xuất vật tư thiết bị tưới bù áp Rivulis và hạt giống Cà chua Cherry theo HĐ HD-ZN-2026-001',
    '2026-10-28 08:30:00+07',
    '2026-10-28 16:00:00+07'
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000004', 150.0000, 'Đầu tưới nhỏ giọt bù áp Rivulis 4L/h lắp đặt hệ thống mới', NOW()),
('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', 20.0000, 'Hạt giống Cà chua Cherry F1 gieo ươm', NOW());

-- 4.5 StockOut 5: Farm b92089c2-6249-403f-958f-8f2c8931c116 (QA Test Farm GreenValley)
-- Zone: e4e79c88-6c33-4be4-8e13-b8bccfe472c2
-- Status: 3 (Completed)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'b92089c2-6249-403f-958f-8f2c8931c116',
    'e4e79c88-6c33-4be4-8e13-b8bccfe472c2',
    'PXK-202605-005',
    3, -- Completed
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000003',
    '2026-05-18 11:00:00+07',
    'Xuất cây giống Dâu tây Hana F1 và giá thể Peatman phục vụ Hợp đồng HD-ZN-2026-002',
    '2026-05-18 07:30:00+07',
    '2026-05-18 11:00:00+07'
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000001', 200.0000, 'Cây giống Dâu tây Hana Nhật Bản (F1) trồng luống nhà màng', NOW()),
('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000003', 35.0000, 'Giá thể Peatman đóng chậu', NOW());

-- 4.6 StockOut 6: Farm 78a79da4-cf2b-4c6f-86e5-78701cec05ee (Farm + Field + Zone Test)
-- Zone: cd59c906-3328-4aff-913f-99ea28b2b966
-- Status: 2 (Approved)
INSERT INTO "StockOuts" ("Id", "TenantId", "FarmId", "ZoneId", "StockOutCode", "Status", "CreatedByUserId", "ApprovedByUserId", "CompletedAtUtc", "Notes", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (
    'a1000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '78a79da4-cf2b-4c6f-86e5-78701cec05ee',
    'cd59c906-3328-4aff-913f-99ea28b2b966',
    'PXK-202610-006',
    2, -- Approved
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000003',
    NULL,
    'Cấp phát phân hữu cơ vi sinh và đường ống tưới Dekko phục vụ thử nghiệm phân khu',
    '2026-10-27 10:00:00+07',
    '2026-10-27 15:00:00+07'
);

INSERT INTO "StockOutDetails" ("Id", "StockOutId", "InventoryItemId", "Quantity", "Notes", "CreatedAtUtc")
VALUES
('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000001', 30.0000, 'Phân hữu cơ vi sinh Quế Lâm bón lót cải tạo đất', NOW()),
('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000006', '83000000-0000-0000-0000-000000000002', 120.0000, 'Ống tưới PE 16mm Dekko kéo tuyến tưới', NOW());

COMMIT;

