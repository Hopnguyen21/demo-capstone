# Dữ liệu trong DB dev hiện tại (SmartFarmDB01)

Ảnh chụp lúc 01/11/2026 14:36 (giờ máy), đọc trực tiếp từ DB, không gồm mật khẩu hay token. Số liệu thay đổi khi hệ thống chạy (số đo, cảnh báo, lượt hỏi AI). Trạng thái hợp đồng hiển thị dạng mã số của enum.

## 1. Số dòng các bảng chính

| bang | so_dong |
| --- | --- |
| Tenant | 1 |
| Tài khoản | 4 |
| Farm | 4 |
| Field | 6 |
| Zone | 6 |
| Quyền Zone | 1 |
| Cây trồng | 9 |
| Giống | 11 |
| Hồ sơ sinh trưởng | 10 |
| Giai đoạn | 40 |
| Ngưỡng môi trường | 169 |
| Vụ trồng | 7 |
| Thiết bị | 18 |
| Cảm biến | 57 |
| Kênh chấp hành | 13 |
| Gateway | 4 |
| Số đo cảm biến | 102688 |
| Quy tắc cảnh báo | 9 |
| Cảnh báo | 20 |
| Lịch tưới | 5 |
| Lệnh điều khiển | 18 |
| Lượt hỏi AI | 370 |
| Tài liệu tri thức | 21 |
| Đoạn tài liệu | 183 |
| Công việc | 4 |
| Vật tư kho | 4 |
| Yêu cầu dịch vụ | 4 |
| Yêu cầu triển khai | 2 |
| Hợp đồng Zone | 4 |
| Hồ sơ khấu hao | 3 |

## 2. Tài khoản (không gồm mật khẩu)

| email | vai_tro | trang_thai | thuoc_tenant | thuoc_farm |
| --- | --- | --- | --- | --- |
| admin@smartfarm.demo | PlatformAdmin | Active | Không | Không |
| farmer@smartfarm.demo | Farmer | Active | Có | Có |
| owner@smartfarm.demo | FarmOwner | Active | Có | Không |
| technician@smartfarm.demo | PlatformTechnician | Active | Không | Không |

## 3. Farm, Field, Zone

| farm | trang_thai | mui_gio | field | dien_tich_field | con_trong | zone | dien_tich_zone | zone_status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nong Trai Canh Tac Dat Mau | Operating | Asia/Ho_Chi_Minh | Khu Luong Dat Thuc Nghiem Lo 00 | 6000.00 | 1296.00 | Khu ca chua 12 | 2204.00 | Inactive |
| Nong Trai Canh Tac Dat Mau | Operating | Asia/Ho_Chi_Minh | Khu Luong Dat Thuc Nghiem Lo 00 | 6000.00 | 1296.00 | Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | 2500.00 | Operating |
| Nong Trai Canh Tac Dat Mau | Operating | Asia/Ho_Chi_Minh | Lô D 1 | 3516.00 | 3516.00 |  |  |  |
| Nong Trai Canh Tac Luong Dat Don Duong | Operating | Asia/Ho_Chi_Minh | Khu Luong Dat Ca Chua Lo C | 18000.00 | 12000.00 | Luong 03 - Trong Dat Ca Chua Chuong F1 | 6000.00 | Operating |
| Trang Trai Canh Tac Luong Dat Cau Dat | Operating | Asia/Ho_Chi_Minh | Khu Luong Dat Dau Tay Lo B | 10000.00 | 6500.00 | Luong 02 - Trong Dat Dau Tay Hana | 3500.00 | Operating |
| Trang Trai Canh Tac Luong Dat Cau Dat | Operating | Asia/Ho_Chi_Minh | Khu Luong Dat Trong Ngoai Troi Lo A | 12000.00 | 8000.00 | Luong 01 - Trong Dat Xa Lach Cuon | 4000.00 | Operating |
| Trang trại Nông nghiệp Công nghệ cao Đà Lạt 02 | Active | Asia/Ho_Chi_Minh | Lô đất A1 - Phân khu Cà chua & Dưa | 13016.00 | 11090.00 | Nhà màng Z01 - Cà chua Beefsteak | 1926.00 | Operating |

## 4. Cây của từng Zone và các vụ

| zone | cay_cua_zone | giong | cac_vu |
| --- | --- | --- | --- |
| Khu ca chua 12 | Cà Chua Beefsteak (Tomato) | Beef F1 | InProgress: [Beef F1] Đợt 1 - Vụ Đông - Xuân 2026 |
| Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | Dưa leo màu | Dưa leo màu (Demo Green F1) | InProgress: Vụ dưa leo màu - Luong 00 |
| Luong 01 - Trong Dat Xa Lach Cuon | Xà Lách Cuộn (Batavia Lettuce) | Romaine Green F1 | InProgress: Vu Xa Lach Cuon Trong Dat - Q4/2026 |
| Luong 02 - Trong Dat Dau Tay Hana | Dau Tay Hana (Strawberry) | Hana | InProgress: Vu Dau Tay Hana Thu Dong 2026 |
| Luong 03 - Trong Dat Ca Chua Chuong F1 | Ca Chua Chuong (Sweet Pepper) | - | InProgress: Vu Ca Chua Chuong F1 2026 |
| Nhà màng Z01 - Cà chua Beefsteak | Cà Chua Beefsteak (Tomato) | Beef F1 | Planned: Vụ Ca Chua Chuong Đông Xuân 2026-2027; InProgress: Vụ Cà chua Beefsteak Nhà Màng 2026 |

## 5. Danh mục cây trồng

| cay | nhom | chu_ky_ngay | nhiet_do | do_am_dat | ph | so_giong | pham_vi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cà Chua Beefsteak (Tomato) | Rau ăn quả | 90 | 20.00-28.00 | 55.00-80.00 | 6.00-6.80 | 2 | Hệ thống |
| Ca Chua Chuong (Sweet Pepper) | Rau ăn quả | 90 | 20.00-28.00 | 55.00-80.00 | 6.00-6.80 | 1 | Hệ thống |
| Cải Bẹ Xanh (Mustard Greens) | Rau ăn lá | 40 | 20.00-28.00 | 55.00-75.00 | 6.00-6.80 | 1 | Hệ thống |
| Dau Tay Hana (Strawberry) | Rau ăn quả | 90 | 16.00-26.00 | 55.00-75.00 | 5.80-6.50 | 1 | Hệ thống |
| Dưa leo Baby VietGAP | Rau ăn quả | 60 | 20.00-28.00 | 65.00-85.00 | 6.00-6.80 | 1 | Hệ thống |
| Dưa leo màu | - | 30 | - | - | - | 1 | Tenant |
| Dưa Lưới (Muskmelon) | Rau ăn quả | 75 | 20.00-32.00 | 50.00-80.00 | 6.00-6.80 | 2 | Hệ thống |
| Xà Lách Cuộn (Batavia Lettuce) | Rau ăn lá | 48 | 16.00-25.00 | 55.00-75.00 | 6.00-7.00 | 1 | Hệ thống |
| Xà Lách Thủy Canh (Hydroponic Lettuce) | Rau ăn lá | 45 | 18.00-25.00 | 75.00-90.00 | 6.00-6.80 | 1 | Hệ thống |

## 6. Hồ sơ sinh trưởng và giai đoạn

| ho_so | cay | pham_vi | thu_tu | giai_doan | ngay | phan_bon | phong_tru |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Quy trình VietGAP Cà Chua Beefsteak Nhà Màng (90 ngày) | Cà Chua Beefsteak (Tomato) | Hệ thống | 1 | Cây con & Bén rễ | 14 | - | - |
| Quy trình VietGAP Cà Chua Beefsteak Nhà Màng (90 ngày) | Cà Chua Beefsteak (Tomato) | Hệ thống | 2 | Sinh trưởng thân lá | 25 | - | - |
| Quy trình VietGAP Cà Chua Beefsteak Nhà Màng (90 ngày) | Cà Chua Beefsteak (Tomato) | Hệ thống | 3 | Ra hoa & Đậu quả | 15 | - | - |
| Quy trình VietGAP Cà Chua Beefsteak Nhà Màng (90 ngày) | Cà Chua Beefsteak (Tomato) | Hệ thống | 4 | Nuôi trái phát triển | 26 | - | - |
| Quy trình VietGAP Cà Chua Beefsteak Nhà Màng (90 ngày) | Cà Chua Beefsteak (Tomato) | Hệ thống | 5 | Chín & Thu hoạch | 10 | - | - |
| Quy trình VietGAP Cà Chua Chuông / Ớt Ngọt (90 ngày) | Ca Chua Chuong (Sweet Pepper) | Hệ thống | 1 | Cây non & Bén rễ | 14 | - | - |
| Quy trình VietGAP Cà Chua Chuông / Ớt Ngọt (90 ngày) | Ca Chua Chuong (Sweet Pepper) | Hệ thống | 2 | Sinh trưởng thân cành | 25 | - | - |
| Quy trình VietGAP Cà Chua Chuông / Ớt Ngọt (90 ngày) | Ca Chua Chuong (Sweet Pepper) | Hệ thống | 3 | Ra hoa rộ & Đậu trái | 15 | - | - |
| Quy trình VietGAP Cà Chua Chuông / Ớt Ngọt (90 ngày) | Ca Chua Chuong (Sweet Pepper) | Hệ thống | 4 | Nuôi quả phình to & Đổi màu | 26 | - | - |
| Quy trình VietGAP Cà Chua Chuông / Ớt Ngọt (90 ngày) | Ca Chua Chuong (Sweet Pepper) | Hệ thống | 5 | Thu hoạch an toàn | 10 | - | - |
| Quy trình VietGAP Cải Bẹ Xanh Nhà Màng (40 ngày) | Cải Bẹ Xanh (Mustard Greens) | Hệ thống | 1 | Ươm mầm & Cây con | 10 | - | - |
| Quy trình VietGAP Cải Bẹ Xanh Nhà Màng (40 ngày) | Cải Bẹ Xanh (Mustard Greens) | Hệ thống | 2 | Phát triển thân lá sinh dưỡng | 15 | - | - |
| Quy trình VietGAP Cải Bẹ Xanh Nhà Màng (40 ngày) | Cải Bẹ Xanh (Mustard Greens) | Hệ thống | 3 | Tăng trưởng nhanh & Tích lũy | 10 | - | - |
| Quy trình VietGAP Cải Bẹ Xanh Nhà Màng (40 ngày) | Cải Bẹ Xanh (Mustard Greens) | Hệ thống | 4 | Thu hoạch an toàn | 5 | - | - |
| Quy trình VietGAP Dâu Tây Hana Nhà Màng (90 ngày) | Dau Tay Hana (Strawberry) | Hệ thống | 1 | Cây giống & Hồi xanh | 15 | - | - |
| Quy trình VietGAP Dâu Tây Hana Nhà Màng (90 ngày) | Dau Tay Hana (Strawberry) | Hệ thống | 2 | Phát triển sinh dưỡng & Đâm ngó | 25 | - | - |
| Quy trình VietGAP Dâu Tây Hana Nhà Màng (90 ngày) | Dau Tay Hana (Strawberry) | Hệ thống | 3 | Phân hóa mầm hoa & Nở hoa | 15 | - | - |
| Quy trình VietGAP Dâu Tây Hana Nhà Màng (90 ngày) | Dau Tay Hana (Strawberry) | Hệ thống | 4 | Nuôi trái & Chín đỏ | 25 | - | - |
| Quy trình VietGAP Dâu Tây Hana Nhà Màng (90 ngày) | Dau Tay Hana (Strawberry) | Hệ thống | 5 | Thu hoạch trái | 10 | - | - |
| Quy trình VietGAP Dưa Leo Baby Nhà Màng (60 ngày) | Dưa leo Baby VietGAP | Hệ thống | 1 | Cây con & Bén rễ | 12 | - | - |
| Quy trình VietGAP Dưa Leo Baby Nhà Màng (60 ngày) | Dưa leo Baby VietGAP | Hệ thống | 2 | Phát triển thân lá & Leo giàn | 18 | - | - |
| Quy trình VietGAP Dưa Leo Baby Nhà Màng (60 ngày) | Dưa leo Baby VietGAP | Hệ thống | 3 | Ra hoa & Nuôi quả non | 20 | - | - |
| Quy trình VietGAP Dưa Leo Baby Nhà Màng (60 ngày) | Dưa leo Baby VietGAP | Hệ thống | 4 | Thu hoạch liên tục | 10 | - | - |
| Quy trình dưa leo màu | Dưa leo màu | Tenant | 1 | Sinh trưởng thân lá | 30 | - | - |
| Hồ sơ Sinh trưởng VietGAP - Dưa Lưới (Muskmelon) | Dưa Lưới (Muskmelon) | Hệ thống | 1 | Cây con & Bén rễ (Dưa Lưới (Muskmelon)) | 22 | - | - |
| Hồ sơ Sinh trưởng VietGAP - Dưa Lưới (Muskmelon) | Dưa Lưới (Muskmelon) | Hệ thống | 2 | Phát triển thân lá (Dưa Lưới (Muskmelon)) | 22 | - | - |
| Hồ sơ Sinh trưởng VietGAP - Dưa Lưới (Muskmelon) | Dưa Lưới (Muskmelon) | Hệ thống | 3 | Ra hoa & Đậu quả (Dưa Lưới (Muskmelon)) | 22 | - | - |
| Hồ sơ Sinh trưởng VietGAP - Dưa Lưới (Muskmelon) | Dưa Lưới (Muskmelon) | Hệ thống | 4 | Nuôi quả & Thu hoạch (Dưa Lưới (Muskmelon)) | 24 | - | - |
| Quy trình VietGAP Dưa Lưới Nhà Màng (75 ngày) | Dưa Lưới (Muskmelon) | Hệ thống | 1 | Cây con & Bén rễ | 12 | - | - |
| Quy trình VietGAP Dưa Lưới Nhà Màng (75 ngày) | Dưa Lưới (Muskmelon) | Hệ thống | 2 | Phát triển thân leo & Tỉa nhánh | 20 | - | - |
| Quy trình VietGAP Dưa Lưới Nhà Màng (75 ngày) | Dưa Lưới (Muskmelon) | Hệ thống | 3 | Thụ phấn & Nuôi trái tạo lưới | 23 | - | - |
| Quy trình VietGAP Dưa Lưới Nhà Màng (75 ngày) | Dưa Lưới (Muskmelon) | Hệ thống | 4 | Tạo đường Brix & Thu hoạch | 20 | - | - |
| Quy trình VietGAP Xà Lách Cuộn Đất & Nhà Màng (48 ngày) | Xà Lách Cuộn (Batavia Lettuce) | Hệ thống | 1 | Cây con & Hồi xanh | 12 | - | - |
| Quy trình VietGAP Xà Lách Cuộn Đất & Nhà Màng (48 ngày) | Xà Lách Cuộn (Batavia Lettuce) | Hệ thống | 2 | Phát triển khung tán lá | 18 | - | - |
| Quy trình VietGAP Xà Lách Cuộn Đất & Nhà Màng (48 ngày) | Xà Lách Cuộn (Batavia Lettuce) | Hệ thống | 3 | Cuộn bắp & Chắc ruột | 12 | - | - |
| Quy trình VietGAP Xà Lách Cuộn Đất & Nhà Màng (48 ngày) | Xà Lách Cuộn (Batavia Lettuce) | Hệ thống | 4 | Thu hoạch an toàn | 6 | - | - |
| Quy trình VietGAP Xà Lách Thủy Canh NFT (45 ngày) | Xà Lách Thủy Canh (Hydroponic Lettuce) | Hệ thống | 1 | Ươm mầm trên giá thể | 10 | - | - |
| Quy trình VietGAP Xà Lách Thủy Canh NFT (45 ngày) | Xà Lách Thủy Canh (Hydroponic Lettuce) | Hệ thống | 2 | Lên máng NFT & Hồi xanh | 15 | - | - |
| Quy trình VietGAP Xà Lách Thủy Canh NFT (45 ngày) | Xà Lách Thủy Canh (Hydroponic Lettuce) | Hệ thống | 3 | Tăng trưởng sinh khối nhanh | 15 | - | - |
| Quy trình VietGAP Xà Lách Thủy Canh NFT (45 ngày) | Xà Lách Thủy Canh (Hydroponic Lettuce) | Hệ thống | 4 | Giảm dinh dưỡng & Thu hoạch | 5 | - | - |

## 7. Thiết bị

| zone | ma | loai | trang_thai | cam_bien | kenh_chap_hanh | pin | rssi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Khu ca chua 12 | 24:DC:C3:44:01:01 | ActuatorNode | Online | 0 | 4 | 100 | -65 |
| Khu ca chua 12 | 24:DC:C3:44:01:02 | ActuatorNode | Online | 0 | 4 | 100 | -65 |
| Khu ca chua 12 | 24:DC:C3:66:01:02 | SensorNode | Online | 6 | 0 | 100 | -65 |
| Khu ca chua 12 | 24:DC:C3:77:02:01 | SensorNode | Online | 6 | 0 | 100 | -65 |
| Khu ca chua 12 | 24:DC:C3:77:02:02 | SensorNode | Online | 6 | 0 | 100 | -65 |
| Khu ca chua 12 | 24:DC:C3:88:00:01 | SensorNode | Online | 6 | 0 | 100 | -65 |
| Khu ca chua 12 | SIM-NODE-84742C3A | SensorNode | Online | 6 | 0 | 95 | -70 |
| Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | ACTUATOR-DEMO-001 | ActuatorNode | Online | 0 | 1 | - | - |
| Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | SENSOR-DEMO-001 | SensorNode | MaintenanceRequired | 6 | 0 | - | - |
| Luong 01 - Trong Dat Xa Lach Cuon | ACTUATOR-DRIP-BED-001 | ActuatorNode | Online | 0 | 1 | - | - |
| Luong 01 - Trong Dat Xa Lach Cuon | SENSOR-SOIL-BED-001 | SensorNode | Online | 3 | 0 | - | - |
| Luong 02 - Trong Dat Dau Tay Hana | ACTUATOR-STRAWBERRY-001 | ActuatorNode | Online | 0 | 1 | - | - |
| Luong 02 - Trong Dat Dau Tay Hana | SENSOR-STRAWBERRY-001 | SensorNode | Online | 4 | 0 | - | - |
| Luong 03 - Trong Dat Ca Chua Chuong F1 | ACTUATOR-BELLPEPPER-001 | ActuatorNode | Online | 0 | 1 | - | - |
| Luong 03 - Trong Dat Ca Chua Chuong F1 | SENSOR-BELLPEPPER-001 | SensorNode | Online | 5 | 0 | - | - |
| Nhà màng Z01 - Cà chua Beefsteak | ACTUATOR-Z01-PUMP-01 | ActuatorNode | Online | 0 | 1 | - | - |
| Nhà màng Z01 - Cà chua Beefsteak | SIM-NODE-7A6AB3A8 | SensorNode | Online | 6 | 0 | - | - |

## 8. Số đo cảm biến theo Zone

| zone | so_dong | som_nhat | moi_nhat |
| --- | --- | --- | --- |
| Khu ca chua 12 | 24906 | 2026-10-30 15:30:25 | 2026-11-01 14:36:00 |
| Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | 28772 | 2026-10-09 15:18:16 | 2026-11-01 14:36:00 |
| Luong 01 - Trong Dat Xa Lach Cuon | 10388 | 2026-10-09 15:18:16 | 2026-11-01 14:36:00 |
| Luong 02 - Trong Dat Dau Tay Hana | 13852 | 2026-10-11 14:33:20 | 2026-11-01 14:36:00 |
| Luong 03 - Trong Dat Ca Chua Chuong F1 | 4004 | 2026-10-11 14:07:06 | 2026-10-28 22:20:50 |
| Nhà màng Z01 - Cà chua Beefsteak | 20766 | 2026-10-22 23:09:37 | 2026-11-01 14:36:00 |

## 9. Cảnh báo, lệnh điều khiển, lịch tưới

| muc | so_luong |
| --- | --- |
| Cảnh báo Open | 20 |
| Lệnh Acknowledged | 2 |
| Lệnh Failed | 5 |
| Lệnh TimedOut | 11 |
| Lịch tưới đang bật | 5 |

## 10. Tri thức (RAG) và AI

| trang_thai_tai_lieu | so_tai_lieu |
| --- | --- |
| Approved | 16 |
| NeedsCorrection | 1 |
| PendingReview | 4 |

| so_doan | co_vector |
| --- | --- |
| 183 | 0 |

| trang_thai_luot_hoi_ai | so_luong |
| --- | --- |
| Completed | 280 |
| Failed | 53 |
| Limited | 36 |
| Pending | 1 |

## 11. Kho vật tư

| vat_tu | don_vi | ton | nguong_thap |
| --- | --- | --- | --- |
| Chế phẩm Sinh học Trừ sâu Neem | Lít | 45.000 | 20.000 |
| Demo NPK Fertilizer | kg | 35.000 | 40.000 |
| Hạt giống Cà chua Cherry F1 | Gói | 120.000 | 30.000 |
| Phân hữu cơ vi sinh Quế Lâm | Bao (50kg) | 15.000 | 25.000 |

## 12. Hợp đồng và khấu hao

| zone | trang_thai_ma | bat_dau | ket_thuc |
| --- | --- | --- | --- |
| Khu ca chua 12 | 0 | 2026-10-30 | 2027-10-30 |
| Luong 01 - Trong Dat Xa Lach Cuon | 2 | 2024-10-22 | 2025-10-22 |
| Luong 01 - Trong Dat Xa Lach Cuon | 0 | 2026-04-22 | 2027-04-22 |
| Luong 02 - Trong Dat Dau Tay Hana | 1 | 2026-05-10 | 2026-11-09 |

| thiet_bi | zone | nguyen_gia | thang | bat_dau |
| --- | --- | --- | --- | --- |
| ACTUATOR-DEMO-001 | Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | 4800000 | 24 | 2024-12-22 |
| SENSOR-DEMO-001 | Líp 00 (Luống 00) - Canh Tác Đất Dưa Leo Màu | 12500000 | 36 | 2024-10-22 |
| SENSOR-SOIL-BED-001 | Luong 01 - Trong Dat Xa Lach Cuon | 3600000 | 24 | 2024-08-22 |

## 13. Vấn đề dữ liệu còn lại (đến lúc chụp)

- Chưa có vector (embedding) cho các đoạn tài liệu do hết quota; tìm tài liệu hiện chỉ theo từ khóa.
- Phân bón và phòng trừ theo giai đoạn gần như trống vì chưa có nguồn đã duyệt; EC, ánh sáng và lịch tưới của nhiều cây cũng trống.
- Cổng GW-DONDUONG-001 là bản ghi mẫu (Provisioned, chưa thấy lần nào) cho Farm Đơn Dương; hai thiết bị Bellpepper vẫn chưa gửi số đo từ 28/10.
- 20 cảnh báo vẫn ở trạng thái Open (từ 25/10), 16 trong 18 lệnh điều khiển hết thời gian chờ hoặc thất bại.
- Các bảng ZoneContracts, DeviceDepreciations, FarmingSeasons... (tên viết hoa) không có khóa ngoại.
- Đã xử lý ngày 01/11/2026: giống sai cây, diện tích Field, lịch AutoSync, khấu hao sai Zone, quyền Zone sai Farm, cây của Nhà màng Z01, cổng của thiết bị, đơn vị đo, chu kỳ Dưa Lưới.
