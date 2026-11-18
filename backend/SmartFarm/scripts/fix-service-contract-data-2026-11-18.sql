-- Sửa dữ liệu hợp đồng Zone đã sinh trước 2026-11-18 (xem docs/DECISIONS.md, mục "Hợp đồng Zone là hợp đồng dịch vụ").
-- Chạy: psql -h localhost -U postgres -d SmartFarmDB01 -f fix-service-contract-data-2026-11-18.sql
-- Xem trước (không ghi gì):
SELECT "ContractNumber", "MonthlyRentVnd", "LesseePhone", "LesseeAddress"
FROM "ZoneContracts"
WHERE "ContractNumber" LIKE 'HD-SR-%'
  AND ("MonthlyRentVnd" > 0 OR "LesseePhone" = '0903666888' OR "LesseeAddress" = 'Trang trại thông minh SmartFarm');

BEGIN;
-- Phí dịch vụ/tháng của hợp đồng sinh từ báo giá từng bị gán = tổng báo giá / 12 (không phải phí thật) -> chưa thiết lập.
UPDATE "ZoneContracts" SET "MonthlyRentVnd" = 0
WHERE "ContractNumber" LIKE 'HD-SR-%' AND "MonthlyRentVnd" > 0;
-- Số điện thoại và địa chỉ điền cứng, không phải dữ liệu thật.
UPDATE "ZoneContracts" SET "LesseePhone" = NULL WHERE "LesseePhone" = '0903666888';
UPDATE "ZoneContracts" SET "LesseeAddress" = NULL WHERE "LesseeAddress" = 'Trang trại thông minh SmartFarm';
COMMIT;

-- Hồ sơ khấu hao do hệ thống tự sinh (giá gốc cố định, ngày bắt đầu ngẫu nhiên). XÓA DỮ LIỆU: bỏ comment sau khi đã xem.
-- SELECT count(*) FROM "DeviceDepreciations"
--   WHERE "Notes" LIKE '%theo dõi tự động từ CSDL%' OR "Notes" LIKE 'Hồ sơ khấu hao tự động%';
-- DELETE FROM "DeviceDepreciations"
--   WHERE "Notes" LIKE '%theo dõi tự động từ CSDL%' OR "Notes" LIKE 'Hồ sơ khấu hao tự động%';
