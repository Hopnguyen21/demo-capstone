# Thiết kế VietGAP Knowledge Base và RAG v1

## Mục tiêu

Tài liệu VietGAP được lưu như các nguồn tri thức độc lập để trợ lý AI tra cứu theo câu hỏi. Hệ thống **không tạo Growth/Crop Profile từ tài liệu VietGAP**. Crop Profile và vụ mùa hiện tại là dữ liệu nghiệp vụ riêng, được tạo và quản lý theo luồng riêng.

Một tài liệu không cần bao quát mọi chủ đề. Ví dụ, tài liệu A có thể chỉ hướng dẫn tưới; tài liệu B chỉ nói về đất. Cả hai vẫn có thể hữu ích cho câu hỏi cần cả hai nội dung.

## Các khái niệm cần phân biệt

### Tài liệu VietGAP

Tệp hoặc văn bản gốc được quản trị viên đưa vào kho tri thức. Tài liệu có thể là quy chuẩn chung, hướng dẫn kỹ thuật cho một cây, hoặc tài liệu chuyên đề.

### Crop Profile

Hồ sơ sinh trưởng có cấu trúc được quản lý riêng trong hệ thống. Profile **không được tự sinh hoặc cập nhật từ tài liệu VietGAP** trong thiết kế này. Không dùng checklist đủ trường của Profile để chặn việc lưu một tài liệu RAG chuyên đề.

### Cây hiện tại của Zone

Cây trong vụ mùa đang hoạt động của Zone. Đây là ngữ cảnh mặc định cho câu hỏi không nêu tên cây. Việc tải tài liệu lên không tự thay đổi cây hiện tại hoặc vụ mùa của Zone.

## Luồng thêm và duyệt tài liệu

1. Quản trị viên tải PDF, DOCX hoặc TXT lên.
2. Hệ thống trích xuất nội dung, giữ thông tin trang/mục nếu có, và lưu file gốc để đối chiếu.
3. Người tải khai báo hoặc xác nhận metadata:
   - tên tài liệu;
   - cây áp dụng: chọn một/nhiều cây từ danh mục DB, nhập cây khác, hoặc đánh dấu áp dụng chung;
   - loại tài liệu và danh mục;
   - chủ đề tài liệu bao quát, nếu biết;
   - cơ quan/đơn vị ban hành và phiên bản/ngày hiệu lực nếu có.
4. Hệ thống có thể nhận diện cây/chủ đề được nhắc đến và hiển thị kết quả như gợi ý để người duyệt đối chiếu. Tên cây hoặc từ khóa xuất hiện trong nội dung không tự chứng minh phạm vi áp dụng.
5. Tài liệu được lưu ở trạng thái chờ duyệt. PDF scan không có lớp văn bản bị từ chối kèm hướng dẫn OCR bên ngoài SmartFarm. Người duyệt so sánh metadata và phần chữ đã đọc được với file gốc rồi duyệt hoặc yêu cầu sửa.
6. Chỉ tài liệu đã duyệt mới đủ điều kiện đưa vào RAG. Tài liệu chưa duyệt, bị thay thế hoặc ngoài quyền tenant không được truy xuất.

Việc duyệt một tài liệu xác nhận tài liệu có thể được dùng làm nguồn tri thức đã kiểm tra; bản thân việc duyệt không chứng nhận trang trại/cây trồng đạt VietGAP.

## Metadata và chunks dùng cho RAG

### Cấp tài liệu

- `documentId`, tiêu đề, tên file và loại file;
- `cropScope`: danh sách cây chuẩn hóa hoặc phạm vi chung;
- `topics`: chủ đề khai báo;
- `detectedTopics`: chủ đề hệ thống nhận diện, chỉ dùng như gợi ý;
- loại tài liệu, danh mục, đơn vị ban hành, mã tiêu chuẩn, phiên bản/ngày hiệu lực;
- trạng thái duyệt, tenant/public scope và hash nội dung;
- file gốc và toàn văn trích xuất.

### Cấp chunk

- `chunkId`, `documentId`;
- nội dung chunk và embedding;
- cây áp dụng kế thừa từ tài liệu;
- chủ đề của chunk, được nhận diện từ nội dung;
- số trang, tiêu đề mục và thông tin nguồn cần thiết để trích dẫn.

Chủ đề khai báo ở tài liệu giúp mô tả phạm vi tổng quát. Chủ đề của chunk giúp tìm đúng phần nội dung. Không yêu cầu một chunk hoặc tài liệu có đủ mọi chủ đề.

## Luồng hỏi AI và chọn nguồn

1. Xác định cây:
   - Nếu câu hỏi nêu rõ cây, dùng cây được hỏi.
   - Nếu câu hỏi không nêu cây, dùng cây của vụ mùa đang hoạt động trong Zone.
   - Nếu không xác định được cây, chỉ dùng tài liệu áp dụng chung; không đoán từ tài liệu của cây khác.
2. Xác định ý/chủ đề cần trả lời từ câu hỏi, ví dụ đất, tưới và thu hoạch.
3. Chỉ tìm trong tài liệu đã duyệt, đúng phạm vi tenant và:
   - áp dụng cho cây vừa xác định; hoặc
   - được khai báo là áp dụng chung.
4. Tìm các chunk liên quan bằng semantic/vector search và keyword fallback. Dùng chủ đề chunk, độ liên quan và phạm vi cây để xếp hạng; giới hạn số chunk mỗi tài liệu để có thể tổng hợp nhiều nguồn.
5. Chỉ gửi các chunk đủ liên quan cho AI. Không yêu cầu mỗi tài liệu chứa đủ thông tin của câu hỏi hoặc một Crop Profile.
6. AI trả lời theo nguồn đã gửi, gắn trích dẫn theo từng ý. Nếu chỉ tìm thấy một phần câu trả lời, trả phần có căn cứ và nêu rõ phần chưa tìm được nguồn.
7. Nếu không có chunk đã duyệt đủ liên quan, báo chưa tìm thấy tài liệu phù hợp; không trả lời kiến thức kỹ thuật như thể có nguồn.

### Ví dụ tổng hợp nhiều tài liệu

Zone đang trồng cà chua. Người dùng hỏi: “Cà chua cần loại đất nào và tưới ra sao?”

- Tài liệu A: phạm vi cà chua, có hướng dẫn tưới.
- Tài liệu B: phạm vi cà chua, có hướng dẫn đất.

RAG có thể lấy chunk về tưới từ A và chunk về đất từ B trong cùng truy vấn. AI trả lời từng phần và trích dẫn nguồn tương ứng. Không cần gộp A và B thành một tài liệu hoặc tạo Crop Profile.

## Khi các tài liệu không thống nhất

- Giữ nguồn riêng, không ghi đè nội dung giữa các tài liệu.
- Khi kết quả liên quan có thông tin trái nhau, AI phải nêu rõ khác biệt và trích dẫn từng nguồn.
- Chỉ ưu tiên phiên bản/ngày ban hành mới hơn nếu metadata đó có sẵn, được kiểm chứng và phạm vi áp dụng tương đương.
- Không kết luận nguồn nào còn hiệu lực chỉ dựa vào điểm similarity.
- Nếu không đủ metadata để phân biệt phiên bản hoặc hiệu lực, nói rõ chưa xác định được tài liệu nào áp dụng; cần người có chuyên môn đối chiếu.

## Những việc không thuộc luồng RAG tài liệu

- Không tự tạo hoặc cập nhật Crop Profile từ file VietGAP.
- Không yêu cầu tài liệu RAG phải có thời lượng sinh trưởng, đủ các ngưỡng Profile hoặc đủ checklist của một Profile.
- Không đổi cây/vụ mùa đang hoạt động của Zone khi thêm tài liệu.
- Không dùng tài liệu chưa duyệt làm căn cứ trả lời.
- Không suy diễn số liệu còn thiếu hoặc khẳng định tuân thủ VietGAP chỉ từ nội dung tài liệu.

## Phân định với Crop Profile và tư vấn theo mùa vụ

- Crop Profile tiếp tục được tạo/chỉnh sửa bằng luồng quản trị Profile riêng, không lấy tài liệu RAG làm đầu vào tự động.
- Vụ mùa hiện tại của Zone tiếp tục tham chiếu Crop và Profile đã được gán theo nghiệp vụ.
- AI hỏi đáp tri thức dùng RAG tài liệu độc lập với yêu cầu phải có Profile đầy đủ.
- Câu hỏi về cảm biến, tưới tự động hoặc hành động điều khiển vẫn phải tuân thủ kiểm tra an toàn và yêu cầu dữ liệu realtime hiện hành. RAG không thay thế các kiểm tra đó.

## Checklist đồng bộ triển khai

- [ ] Gỡ hoặc ẩn hành động “tạo Crop Profile từ tài liệu” trên web và mobile nếu quyết định sản phẩm là không hỗ trợ luồng này.
- [ ] Gỡ endpoint/logic sinh Profile từ tài liệu chỉ sau khi xác nhận không còn client hoặc integration nào sử dụng.
- [ ] Giữ API tạo/chỉnh sửa Crop Profile riêng biệt.
- [ ] Đảm bảo upload không bị chặn bởi completeness checklist của Profile.
- [ ] Kiểm tra metadata cây/chủ đề ở FE, mobile và backend được gửi/đọc thống nhất.
- [x] Ưu tiên cây của Zone đang hỏi (vụ mùa, rồi tên Zone); chỉ dùng cây nêu trong câu hỏi khi Zone chưa cho biết cây. Quyết định: trợ lý chỉ phục vụ đúng Zone hiện tại.
- [ ] Chỉ đưa passage đủ liên quan vào prompt và hiển thị nguồn tương ứng.
- [ ] Thêm chính sách xử lý mâu thuẫn dựa trên phiên bản/ngày hiệu lực và phạm vi có thể xác minh.
- [ ] Thêm test cho lọc cây, tài liệu chung, nhiều nguồn/nhiều chủ đề, nguồn mâu thuẫn, tài liệu chưa duyệt và trường hợp thiếu nguồn.

## Trạng thái tài liệu

Tài liệu này ghi nhận **hướng thiết kế mong muốn**. Nó không khẳng định toàn bộ checklist triển khai ở trên đã được thực hiện trong code. Khi cập nhật hệ thống, cần đối chiếu từng mục với API, FE, mobile, DB migration và test hiện có.

## Tải tài liệu chỉ cần file: nhận diện metadata kèm bằng chứng

Người dùng chỉ chọn PDF, DOCX hoặc TXT. Backend (`VietGapMetadataExtractor.Detect`) đọc nội dung bằng quy tắc xác định và lưu kết quả trong `agriculture_documents.metadata_detection` (JSON), không dùng AI để suy đoán metadata. Không dùng AI để OCR hoặc trích xuất metadata; nội dung file được đọc bằng parser cục bộ và quy tắc xác định. AI chỉ có thể kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp hay không; không đánh giá đúng/sai kỹ thuật hoặc chứng nhận VietGAP.

| Trường | Cách nhận diện | Trạng thái |
| --- | --- | --- |
| Tiêu đề | Dòng tên tài liệu đầu tiên (bỏ khung trang web, nhãn, mục đánh số); thiếu thì tên file | `detected` khi dòng có từ khóa tiêu đề, còn lại `uncertain` |
| Cây áp dụng | Dòng nhãn "Cây trồng áp dụng", hoặc cây nêu trong tiêu đề; cây lặp ≥ 3 lần trong thân bài là `uncertain`; nhiều cây hoặc nhắc thoáng qua là `not_found` (kèm danh sách `candidates`) | `detected` / `uncertain` / `not_found` |
| Áp dụng chung | Chỉ khi file có cụm rõ ràng ("áp dụng chung cho tất cả các loại rau...") hoặc người duyệt xác nhận | `detected` / `not_found` |
| Đơn vị ban hành, mã tiêu chuẩn, phiên bản, ngày hiệu lực | Dòng nhãn hoặc mẫu cơ quan/mã; năm suy ra từ mã tiêu chuẩn chỉ là `uncertain` và không được dùng làm phiên bản | `detected` / `uncertain` / `not_found` |
| Loại tài liệu | Từ tiêu đề (tiêu chuẩn / hướng dẫn / chuyên đề); xung đột hoặc không rõ thì `Unspecified` | không bao giờ mặc định `OfficialStandard` |
| Chủ đề | Theo từ khóa trong từng đoạn; chỉ là gợi ý tìm kiếm | không yêu cầu đủ mọi chủ đề |

Mỗi giá trị kèm câu trích nguyên văn và số trang (nếu file có nhãn `[TRANG n]`). Tài liệu luôn lưu ở `PendingReview`. Không nhận diện được cây **không** có nghĩa là áp dụng chung (`CropScope` rỗng chỉ là chung khi có bằng chứng hoặc người duyệt xác nhận).

Điều kiện duyệt (`POST .../review`): loại tài liệu phải khác `Unspecified`; phạm vi cây phải được xác định (có cây, hoặc áp dụng chung có bằng chứng/xác nhận bằng `confirmGeneralScope`). Người duyệt có thể sửa `title`, `cropScope`, `authorOrganization`, `version`, `documentType` cùng lúc. Tài liệu nạp trước tính năng này (không có `metadata_detection`) giữ nguyên metadata và không bị áp điều kiện phạm vi mới.

PDF scan không có lớp văn bản không được xử lý bằng AI; người dùng cần OCR bên ngoài SmartFarm và tải lại PDF có thể tìm kiếm hoặc DOCX/TXT.

## AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp

Hệ thống **không dùng AI để trích xuất trường kỹ thuật** (đất, phân bón, IPM, thu hoạch, giai đoạn, ngưỡng): lớp trích xuất, endpoint `POST .../documents/{id}/extract`, bước worker và giao diện tương ứng đã gỡ; các cột `structured_extraction`, `extraction_attempted_at_utc`, `extraction_rules_version` được giữ để đọc dữ liệu cũ nhưng không còn được ghi.

Hai chức năng tách biệt:

1. **Nhận diện metadata** (quy tắc xác định, mục trên): tiêu đề, cây, đơn vị, mã, phiên bản, loại, chủ đề kèm bằng chứng.
2. **AI kiểm tra chủ đề** (`VietGapDocumentVerifier`): chỉ xác nhận tài liệu **có thuộc lĩnh vực nông nghiệp hay không**. Không đối chiếu quy chuẩn, không đánh giá kỹ thuật đúng/sai, không chứng nhận VietGAP, không viết lại tài liệu.

### Luồng

1. Tải file → đọc lớp văn bản bằng parser cục bộ → nhận diện metadata theo quy tắc → lưu file gốc, toàn văn và chunk ở `PendingReview` (chunk chưa embedding), `verification_status = Pending`.
2. Worker nền gọi AI. Kết quả lưu ở `agriculture_documents.verification_result` (JSON) và `verification_status`:
   - `Agricultural`: AI nhận định thuộc nông nghiệp **và** có ít nhất một câu trích nguyên văn có thật trong file **và** độ tin cậy ≥ 0,5.
   - `NotAgricultural`: AI nhận định không thuộc nông nghiệp, cũng với câu trích và độ tin cậy như trên.
   - `Uncertain`: AI không kết luận, câu trích không có trong file hoặc độ tin cậy thấp. Không bao giờ suy ra là nông nghiệp.
   - `VerificationError`: AI lỗi/quá tải/chưa cấu hình. Tài liệu vẫn được lưu và chờ duyệt; chạy lại bằng `POST .../documents/{id}/verify`.
3. Kết quả gồm nhận định, loại tài liệu AI mô tả, độ tin cậy, lý do, các câu trích kèm trang, model, phiên bản prompt, thời điểm.
4. Trạng thái do hệ thống tính từ nhận định đã kiểm chứng; trường `status` do model tự đặt bị bỏ qua. Nội dung file bọc trong thẻ, bị loại thẻ tự đóng/mở, prompt dặn bỏ qua mọi chỉ dẫn trong dữ liệu.
5. Chỉ quản trị viên duyệt. Kết quả AI không bao giờ tự đổi `ReviewStatus`, mở RAG hay tạo embedding (worker chỉ embedding chunk của tài liệu `Approved`). Duyệt khi AI báo `NotAgricultural` cần ghi chú lý do vẫn duyệt (≥ 20 ký tự).

### Giới hạn

Chỉ phần đầu (30.000 ký tự) được gửi cho AI. `Agricultural` chỉ nói tài liệu bàn về nông nghiệp, không bảo đảm nội dung kỹ thuật đúng hay phù hợp VietGAP; người duyệt vẫn phải đối chiếu file gốc.
