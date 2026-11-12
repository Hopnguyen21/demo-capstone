# Bảo vệ dữ liệu khi dùng dịch vụ AI bên thứ ba

Tài liệu mô tả dữ liệu nào rời khỏi hệ thống, được xử lý ra sao, và những việc cần xác nhận ngoài mã nguồn.

## 1. Dữ liệu gửi ra ngoài

| Đích | Nội dung | Biện pháp |
|---|---|---|
| Gemini (tư vấn) | Câu hỏi, ngữ cảnh Zone (cây, giai đoạn, số đo cảm biến, thiết bị, lịch, cảnh báo), đoạn tri thức RAG | `AiPrivacySanitizer` che email, CCCD, điện thoại, mã hợp đồng, tên, địa chỉ; tên Zone/thiết bị/công việc đi qua `SanitizeFreeText`; đoạn tri thức đi qua `SanitizeDocumentText`; diện tích Zone làm tròn 100 m² |
| Gemini (embedding, kiểm tra và trích xuất tài liệu) | Nội dung tài liệu, câu truy vấn | Tài liệu: `SanitizeDocumentText` (email, CCCD, điện thoại, họ tên/địa chỉ có nhãn). Truy vấn: `SanitizeUserQuestion`. Mọi lời gọi `GeminiJsonClient` cũng qua `SanitizeDocumentText` |
| Open-Meteo (thời tiết) | Toạ độ, làm tròn 2 chữ số thập phân (~1 km) | Không gửi tên trang trại, tên người dùng, mã định danh |
| Prompt | Nhãn vùng cấp tỉnh/huyện (khi câu hỏi liên quan khí hậu) và `climate_region` (4 vùng thô) | `GeneralRegionSanitizer` kiểm theo danh mục tỉnh/thành; chỉ giữ huyện khi có tiền tố hành chính hoặc tên không chứa chữ số/cấp phường-xã trở xuống |

Không gửi: địa chỉ đầy đủ, toạ độ chính xác, thông tin liên hệ, hợp đồng, tên chủ trại, mã tenant.

## 2. Vùng khí hậu

Suy ra từ địa chỉ trang trại (tỉnh/thành), dự phòng bằng toạ độ khi địa chỉ không nhận diện được. Việc suy luận chạy trên máy chủ; chỉ nhãn thô (`north`, `central`, `highlands`, `south`) vào prompt và bộ lọc tài liệu.

## 3. Giới hạn đã biết

- Bộ che dùng mẫu chữ (regex): có thể bỏ sót tên người không kèm xưng hô hoặc nhãn, địa chỉ viết lạ, số điện thoại viết bằng chữ.
- Bộ che tài liệu cố ý thận trọng để không phá nội dung kỹ thuật, nên che ít hơn bộ che câu hỏi.
- Trích xuất VietGAP đối chiếu câu trích nguyên văn với văn bản gốc; đoạn đã bị che có thể làm trường tương ứng chuyển thành "không chắc chắn".
- Bản đồ trên ứng dụng di động tải ô bản đồ từ máy chủ bản đồ bên thứ ba, nên các máy chủ này biết khu vực đang xem.

## 4. Việc cần xác nhận ngoài mã nguồn (chưa kiểm chứng)

1. Điều khoản của gói Gemini API đang dùng: dữ liệu có được lưu giữ hoặc dùng để huấn luyện không, thời hạn lưu, vùng xử lý.
2. Thoả thuận xử lý dữ liệu với nhà cung cấp AI và Open-Meteo nếu phục vụ khách hàng thương mại.
3. Thông báo cho người dùng biết dữ liệu nào được gửi sang dịch vụ bên thứ ba và cơ sở pháp lý (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).
4. Rà soát định kỳ nhật ký để bảo đảm không ghi nội dung câu hỏi hay tài liệu thô (hiện chỉ ghi độ dài và số lượng).

## 5. Kiến trúc cổng riêng tư

Mục tiêu: một lỗi quên che ở một chỗ không thể làm rò dữ liệu.

- **Kiểu `SanitizedText`:** chỉ tạo được qua `SanitizedText.Question/FreeText/Document`, không có hàm khởi tạo nhận chuỗi thô. Ranh giới nằm ngay đầu `AskInternalAsync`: từ đó bước phân loại ý định và việc ghi bản chụp chỉ nhận kiểu này.
- **Một điểm ghi bản chụp:** `AiAdvisoryService.Snapshot(...)` là chỗ duy nhất ghi `ContextSnapshotJson`; tham số câu hỏi có kiểu `SanitizedText` nên không thể lưu câu hỏi gốc. Đoạn tri thức trong bản chụp cũng đã được che.
- **Che ngay tại cổng gọi ra ngoài:** `GeminiJsonClient.SendAsync` và `GeminiEmbeddingProvider` che mọi văn bản trước khi gửi; `AiPromptBuilder` che câu hỏi, trường tự do và đoạn tri thức.
- **Bí danh thiết bị:** prompt gửi `V1, V2…` thay cho GUID van; `TryResolveActuator` quy đổi ngược khi AI đề xuất điều khiển (vẫn chấp nhận GUID để tương thích).
- **Danh sách lớp được giữ `HttpClient`:** test `PRV_GW_003` làm đỏ khi có lớp mới trong namespace AI nhận `HttpClient` mà chưa được rà soát.
- **Rào chắn đầu ra:** `AiOutputGuard` che định danh, mã nội bộ và chặn nội dung giống quy tắc hệ thống.
