using SmartFarm.Domain.Entities;

namespace SmartFarm.Infrastructure.Ai.Knowledge;

/// <summary>
/// DTO trung gian cho seed data (trước khi có DocumentId từ DB).
/// </summary>
public sealed record SeedChunkData(int ChunkIndex, string Content, string CropTags, string Keywords);

/// <summary>
/// Dữ liệu khởi tạo kho tri thức VietGAP.
/// Bao gồm: cà chua, dưa lưới, dâu tây, ớt ngọt, dưa leo, vi khí hậu nhà màng.
/// </summary>
public static class KnowledgeBaseSeedData
{
    public static IReadOnlyList<(AgricultureDocument Document, IReadOnlyList<SeedChunkData> Chunks)> GetSeedDocuments()
    {
        var results = new List<(AgricultureDocument, IReadOnlyList<SeedChunkData>)>();

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 1: Quy trình tưới nhỏ giọt và quản lý nước tưới
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quy trình tưới nhỏ giọt và quản lý nước tưới VietGAP cho rau màu nhà màng",
                FileType = "seed",
                AuthorOrganization = "Bộ Nông nghiệp & PTNT - Cục Trồng trọt (TCVN 11892-1:2017)",
                Category = "irrigation",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quy trình tưới nhỏ giọt VietGAP cho nhà màng."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    NGUYÊN TẮC TƯỚI NHỎ GIỌT VIETGAP:
                    Tưới nhỏ giọt cung cấp nước và dinh dưỡng trực tiếp vào vùng rễ, giảm 40-60% lượng nước so với tưới phun.
                    Chỉ tưới khi độ ẩm đất dưới ngưỡng tiêu chuẩn (thường < 55-60% đối với cà chua, dưa leo).
                    Không tưới khi độ ẩm đất đang ở mức tối ưu (65-75%) hoặc đã vượt ngưỡng trên (> 80%).
                    Kiểm tra EC (độ dẫn điện) dung dịch dinh dưỡng: cà chua cần EC 2.0-3.5 dS/m, dưa lưới 1.5-2.5 dS/m, dâu tây 1.0-2.0 dS/m, xà lách 1.2-1.8 dS/m.
                    pH nước tưới lý tưởng: 5.8-6.5 cho hầu hết rau màu VietGAP.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "tưới nhỏ giọt,độ ẩm đất,EC,pH,VietGAP,nước tưới"),

                new(1, """
                    LỊCH TƯỚI THEO GIAI ĐOẠN SINH TRƯỞNG:
                    Cây con (0-15 ngày): Tưới 2-3 lần/ngày lượng nhỏ, duy trì độ ẩm đất 70-80%.
                    Sinh trưởng thân lá (15-40 ngày): Tưới 1-2 lần/ngày theo nhu cầu bốc thoát hơi nước.
                    Ra hoa đậu trái: Điều chỉnh lượng nước tưới hợp lý để kích thích đậu trái, tránh thừa đạm.
                    Nuôi trái: Tưới đều đặn, tránh chênh lệch độ ẩm đột ngột gây nứt trái (cà chua, dưa lưới).
                    Thu hoạch: Giảm tưới 5-7 ngày trước thu hoạch để tăng chất lượng đường và độ chắc trái.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "lịch tưới,giai đoạn sinh trưởng,cây con,ra hoa,đậu trái,nứt trái,thu hoạch"),

                new(2, """
                    PHÂN BÓN THEO PHƯƠNG PHÁP FERTIGATED (CHÂM PHÂN QUA HỆ THỐNG TƯỚI):
                    Giai đoạn cây con: Dinh dưỡng cân bằng kết hợp vi lượng để kích thích bộ rễ phát triển.
                    Giai đoạn sinh trưởng: Tăng cường đạm và trung lượng (Ca, Mg) phát triển thân lá.
                    Giai đoạn ra hoa: Chuyển dịch công thức sang tăng lân và kali thúc đẩy phân hóa mầm hoa.
                    Giai đoạn nuôi trái: Ưu tiên kali cao và bổ sung canxi bo phòng chống rụng và nứt trái.
                    Canxi và vi lượng: Bổ sung định kỳ theo hướng dẫn kỹ thuật nông học để phòng bệnh đầu thối (BER) ở cà chua, ớt.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "phân bón,NPK,fertigated,châm phân,đạm,lân,kali,canxi,boron,đầu thối,BER")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 2: Bệnh hại và IPM cà chua
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Bệnh hại phổ biến và quản lý dịch hại tổng hợp IPM cho cà chua VietGAP",
                FileType = "seed",
                AuthorOrganization = "Cục Bảo vệ Thực vật - Viện Khoa học Nông nghiệp Việt Nam (VAAS)",
                Category = "pest",
                CropScope = "cà chua,ớt",
                IsPublic = true,
                Version = "2024",
                ContentText = "Bệnh hại và IPM cà chua."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    BỆNH HÉO RŨ VI KHUẨN (Ralstonia solanacearum) - CÀ CHUA:
                    Triệu chứng: Cây héo đột ngột vào buổi trưa, phục hồi vào sáng sớm, sau đó héo vĩnh viễn. Cắt ngang thân thấy mạch dẫn nâu đen.
                    Test nhanh: Nhúng đoạn thân vào nước trong, quan sát dòng dịch khuẩn trắng đục chảy ra từ mặt cắt.
                    Phòng ngừa: Xử lý đất bằng vôi bột trước khi trồng, khử trùng nguồn nước tưới, dùng giống kháng bệnh.
                    Xử lý: Nhổ bỏ và tiêu hủy cây bệnh ngay để tránh lây lan. Xử lý vôi hoặc chế phẩm đồng quanh vùng cây bệnh.
                    """,
                    "cà chua,ớt",
                    "héo rũ,vi khuẩn,Ralstonia,solanacearum,mạch dẫn,vôi,copper,tiêu hủy"),

                new(1, """
                    BỆNH SƯƠNG MAI (Phytophthora infestans) - CÀ CHUA, ỚT:
                    Triệu chứng: Đốm úng nước trên lá, mặt dưới lá có lớp nấm trắng xám. Trái bị thối nhanh, màu nâu xỉn. Phát triển mạnh khi nhiệt độ 15-20°C, độ ẩm không khí > 85%.
                    Phòng ngừa IPM: Tỉa lá già phần gốc để thông thoáng tán, tuyệt đối không tưới phun chiều tối.
                    Xử lý sinh học: Phun chế phẩm sinh học đối kháng hoặc hoạt chất trừ nấm được cấp phép trong danh mục VietGAP.
                    Ngưỡng can thiệp: Thực hiện biện pháp phòng trừ ngay khi phát hiện đốm bệnh đầu tiên trên luống.
                    """,
                    "cà chua,ớt",
                    "sương mai,Phytophthora,infestans,nấm,lá,trái,thối,độ ẩm,IPM"),

                new(2, """
                    BỌ TRĨ (Thrips palmi, Frankliniella) - CÀ CHUA, ỚT, DƯA LEO:
                    Triệu chứng: Lá xoăn lại, đọt non biến dạng, hoa và trái non bị sẹo bạc. Mật độ cao trong mùa khô nắng gắt.
                    Phòng ngừa: Đặt bẫy dính màu vàng theo dõi mật độ côn trùng. Phun nước tạo ẩm bề mặt lá vào buổi sáng.
                    Xử lý sinh học: Thả thiên địch hoặc sử dụng chế phẩm sinh học thảo mộc / vi sinh theo khuyến cáo IPM.
                    Cách ly thu hoạch: Tuyệt đối tuân thủ thời gian cách ly (PHI) ghi trên nhãn thuốc bảo vệ thực vật.
                    """,
                    "cà chua,ớt,dưa leo",
                    "bọ trĩ,Thrips,bẫy dính,vàng,thiên địch,nhện,xoăn lá"),

                new(3, """
                    BỆNH PHẤN TRẮNG (Oidium) - CÀ CHUA, DƯA LEO, BÍ:
                    Triệu chứng: Lớp bột trắng phủ trên mặt lá, sau đó lá vàng và khô rụng. Phát triển khi nhiệt độ 20-25°C.
                    Xử lý: Sử dụng chế phẩm lưu huỳnh sinh học hoặc thuốc trừ nấm phấn trắng chuyên dụng theo danh mục cho phép.
                    Lưu ý an toàn: Không phun chế phẩm lưu huỳnh khi nhiệt độ nhà màng > 32°C vì dễ gây cháy sém lá non.
                    """,
                    "cà chua,dưa leo,bí",
                    "phấn trắng,Oidium,bột trắng,Sulfur,lưu huỳnh")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 3: Dâu tây
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Kỹ thuật canh tác và phòng trị bệnh dâu tây VietGAP nhà màng",
                FileType = "seed",
                AuthorOrganization = "Trung tâm Khuyến nông Quốc gia - Sở NN&PTNT Lâm Đồng",
                Category = "general",
                CropScope = "dâu tây",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác dâu tây VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    VI KHÍ HẬU TỐI ƯU CHO DÂU TÂY:
                    Nhiệt độ ban ngày: 18-25°C. Ban đêm: 10-15°C (chênh lệch ngày/đêm kích thích tích lũy đường).
                    Độ ẩm không khí: 60-70%. Ẩm độ > 80% tăng nguy cơ nấm xám và thán thư.
                    Ánh sáng: Cần 8-12 giờ/ngày, PAR tối thiểu 300 µmol/m²/s để đậu trái tốt.
                    Độ ẩm đất: 60-70% giai đoạn sinh dưỡng; giảm xuống 50-60% trước thu hoạch 5 ngày.
                    EC đất/dung dịch: 0.8-1.5 dS/m (dâu tây nhạy cảm với mặn hơn các loại cây rau ăn quả khác).
                    """,
                    "dâu tây",
                    "dâu tây,nhiệt độ,độ ẩm,ánh sáng,EC,vi khí hậu,nhà màng,đường"),

                new(1, """
                    BỆNH THÁN THƯ DÂU TÂY (Colletotrichum fragariae):
                    Triệu chứng: Đốm nâu đen trên cuống, trái và lá. Trái bị thối nhũn, có vòng đồng tâm. Phát triển mạnh khi nhiệt độ 25-30°C và ẩm ướt kéo dài.
                    Phòng ngừa: Dùng màng phủ luống hạn chế đất bắn lên trái. Không tưới phun trực tiếp lên hoa, trái và tán lá.
                    Xử lý: Sử dụng chế phẩm vi sinh đối kháng Trichoderma hoặc hoạt chất đặc trị nấm theo danh mục VietGAP.
                    Nấm xám Botrytis: Xuất hiện khi ẩm độ không khí > 80%. Biện pháp: Tăng cường quạt thông gió, thu gom tiêu hủy trái bệnh.
                    """,
                    "dâu tây",
                    "thán thư,Colletotrichum,nấm xám,Botrytis,trái thối,màng phủ"),

                new(2, """
                    QUẢN LÝ DINH DƯỠNG DÂU TÂY THEO GIAI ĐOẠN:
                    Cây con (0-30 ngày): N cao, P trung bình, K thấp. EC dung dịch: 0.8-1.0 dS/m.
                    Ra hoa (30-60 ngày): Giảm N, tăng P và K. Bổ sung vi lượng Boron kích thích đậu hoa.
                    Nuôi trái (60-90 ngày): Tăng cường K để trái ngọt và chắc. Bổ sung canxi định kỳ chống nứt thối trái.
                    Lưu ý: Dâu tây rất mẫn cảm với hiện tượng thừa muối khoáng. Luôn kiểm tra EC định kỳ 2 lần/tuần.
                    """,
                    "dâu tây",
                    "dinh dưỡng,dâu tây,NPK,Boron,Calcium,EC,nuôi trái,đầu thối")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 4: Dưa lưới
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Kỹ thuật canh tác dưa lưới (Cucumis melo) nhà màng theo tiêu chuẩn VietGAP",
                FileType = "seed",
                AuthorOrganization = "Bộ Nông nghiệp & PTNT - Cục Trồng trọt (TCVN 11892-1:2017)",
                Category = "general",
                CropScope = "dưa lưới",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác dưa lưới VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    VI KHÍ HẬU VÀ ĐIỀU KIỆN TỐI ƯU CHO DƯA LƯỚI:
                    Nhiệt độ: Ban ngày 28-32°C, ban đêm 20-25°C. Nhiệt độ > 38°C ảnh hưởng tiêu cực đến thụ phấn đậu trái.
                    Độ ẩm không khí: 60-70%. Cao hơn 80% tạo điều kiện bùng phát nấm phấn trắng và sương mai.
                    Ánh sáng: Ưa sáng mạnh, cần >10 giờ chiếu sáng/ngày. Thiếu sáng làm suy giảm độ ngọt (Brix).
                    Độ ẩm đất: 65-75% (tưới nhỏ giọt chia nhiều lần trong ngày).
                    EC dung dịch: Cây con 1.0-1.5; ra hoa 2.0-2.5; nuôi trái 2.5-3.5 dS/m.
                    """,
                    "dưa lưới",
                    "dưa lưới,nhiệt độ,độ ẩm,ánh sáng,EC,vi khí hậu,đường"),

                new(1, """
                    KỸ THUẬT TẠO HÌNH VÀ THỤ PHẤN DƯA LƯỚI:
                    Bấm ngọn lần 1: Khi dây chính đạt 25-30cm, chọn giữ 2-3 nhánh phụ phát triển khỏe mạnh.
                    Bấm ngọn lần 2: Bấm ngọn nhánh phụ ở vị trí thích hợp để tập trung dinh dưỡng nuôi hoa cái.
                    Thụ phấn: Thụ phấn nhân tạo vào buổi sáng sớm (6h-9h) hoặc đưa ong mật vào nhà màng.
                    Tuyển trái: Chỉ giữ 1-2 trái đạt chuẩn/cây để đảm bảo kích thước và độ ngọt đồng đều. Tỉa bỏ sớm trái dị hình.
                    """,
                    "dưa lưới",
                    "bấm ngọn,thụ phấn,hoa cái,hoa đực,ong,trái,tỉa"),

                new(2, """
                    SÂU BỆNH PHỔ BIẾN TRÊN DƯA LƯỚI:
                    Bệnh phấn trắng: Sử dụng chế phẩm lưu huỳnh sinh học hoặc thuốc đặc trị được phép theo VietGAP.
                    Bệnh héo rũ (Fusarium): Xử lý đất và giá thể bằng chế phẩm vi sinh đối kháng Trichoderma trước khi xuống giống.
                    Nhện đỏ (Tetranychus urticae): Tăng cường ẩm độ không khí, sử dụng chế phẩm dầu khoáng sinh học.
                    Ruồi đục trái (Bactrocera): Đặt bẫy bả dính pheromone sinh học kiểm soát mật độ trưởng thành.
                    """,
                    "dưa lưới",
                    "phấn trắng,héo,Fusarium,Trichoderma,nhện đỏ,ruồi đục trái,bẫy pheromone")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 5: Vi khí hậu nhà màng
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quản lý vi khí hậu và hệ thống thông gió nhà màng VietGAP",
                FileType = "seed",
                AuthorOrganization = "Viện Khoa học Nông nghiệp Việt Nam (VAAS)",
                Category = "climate",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quản lý vi khí hậu và thông gió nhà màng."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    THÔNG GIÓ VÀ KIỂM SOÁT NHIỆT ĐỘ NHÀ MÀNG:
                    Nhiệt độ nhà màng vào mùa nắng nóng thường cao hơn môi trường bên ngoài 5-15°C.
                    Mở cửa thông gió đỉnh mái khi nhiệt độ vượt 30°C. Đóng lại khi có mưa hoặc nhiệt độ đêm xuống thấp.
                    Quạt đối lưu: Kích hoạt khi nhiệt độ > 30°C hoặc độ ẩm không khí > 85% để tránh đọng sương trên mặt lá.
                    Lưới cắt nắng: Triển khai lưới chắn nắng tự động khi bức xạ mặt trời gay gắt vào buổi trưa.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "thông gió,nhiệt độ,quạt,cửa mái,lưới cắt nắng,làm mát,ẩm độ"),

                new(1, """
                    ĐỘ ẨM KHÔNG KHÍ VÀ PHÒNG NGỪA NẤM BỆNH TRONG NHÀ MÀNG:
                    Ngưỡng nguy hiểm: Ẩm độ không khí > 85% trong nhiều giờ liên tục tạo môi trường lý tưởng cho nấm Botrytis, sương mai, phấn trắng.
                    Biện pháp xử lý: Kích hoạt quạt thông gió đối lưu, không tưới đẫm vào chiều muộn.
                    Ẩm độ quá thấp (< 40%): Khiến cây khép khí khổng, ức chế quang hợp. Giải pháp: Duy trì tưới nhỏ giọt hoặc phun sương mịn giảm nhiệt.
                    Giám sát cảm biến: Đặt cảm biến đo vi khí hậu ở độ cao tán cây để phản ánh chính xác môi trường sinh lý.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "ẩm độ không khí,nấm,Botrytis,thông gió,quạt,cảm biến,phun sương"),

                new(2, """
                    ÁNH SÁNG VÀ QUANG HỢP TRONG NHÀ MÀNG:
                    Cường độ ánh sáng tối thiểu duy trì quang hợp hiệu quả: 200 µmol/m²/s PAR.
                    Điểm bão hòa ánh sáng tùy loài: Cà chua 700-1000, Dâu tây 400-600, Dưa lưới 800-1000 µmol/m²/s.
                    Thiếu sáng kéo dài: Thân vươn dài yếu ớt, hoa rụng nhiều, trái nhỏ và giảm độ ngọt.
                    Bổ sung ánh sáng bằng đèn chuyên dụng quang hợp khi thời tiết nhiều mây âm u liên tục nhiều ngày.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "ánh sáng,PAR,quang hợp,LED,grow light,chiếu sáng")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 6: Ớt ngọt
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Kỹ thuật canh tác ớt ngọt (Capsicum annuum) nhà màng theo VietGAP",
                FileType = "seed",
                AuthorOrganization = "Bộ Nông nghiệp & PTNT - Cục Trồng trọt (TCVN 11892-1:2017)",
                Category = "general",
                CropScope = "ớt,ớt ngọt,ớt chuông,sweet pepper,capsicum",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác ớt ngọt VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    ĐIỀU KIỆN SINH TRƯỞNG VÀ PHÁT TRIỂN ỚT NGỌT:
                    Nhiệt độ tối ưu: 20-30°C. Nhiệt độ < 15°C gây rụng nụ hoa, trên 35°C ảnh hưởng đến sức sống hạt phấn.
                    Độ ẩm đất: 65-75%. Ớt chịu hạn tương đối nhưng rất mẫn cảm với tình trạng ngập úng bí khí vùng rễ.
                    pH đất: 6.0-6.8. EC dung dịch tưới: 2.0-3.0 dS/m thời kỳ sinh trưởng; 3.0-3.5 dS/m thời kỳ nuôi trái.
                    Ánh sáng: Cần đủ ánh sáng quang hợp (> 8 giờ/ngày) để trái lên màu chuẩn và tích lũy vitamin.
                    """,
                    "ớt,ớt ngọt,ớt chuông,sweet pepper,capsicum",
                    "ớt,nhiệt độ,độ ẩm,EC,pH,ánh sáng,vô phấn,hoa rụng"),

                new(1, """
                    BỆNH LỞ CỔ RỄ VÀ THỐI GỐC ỚT:
                    Nguyên nhân: Do nấm thủy sinh (Pythium, Phytophthora) kết hợp đất ẩm ướt và thoát nước kém.
                    Triệu chứng: Vùng cổ rễ teo thắt lại, thâm đen, cây héo đổ gục rạp xuống luống.
                    Phòng ngừa: Lên luống cao ráo, xử lý nấm đối kháng Trichoderma vào đất/giá thể trước khi trồng.
                    Xử lý: Sử dụng chế phẩm vi sinh hoặc hoạt chất phòng trừ nấm đất theo khuyến cáo cán bộ kỹ thuật và hướng dẫn trên nhãn. Tiêu hủy triệt để cây bệnh nặng.
                    """,
                    "ớt,ớt ngọt,ớt chuông,sweet pepper,capsicum",
                    "lở cổ rễ,thối gốc,Pythium,Phytophthora,Trichoderma,thoát nước")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 7: Xà lách (Lactuca sativa) theo tiêu chuẩn VietGAP
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Kỹ thuật canh tác và dinh dưỡng xà lách (Lactuca sativa) theo tiêu chuẩn VietGAP",
                FileType = "seed",
                AuthorOrganization = "Bộ Nông nghiệp & PTNT - Cục Trồng trọt (TCVN 11892-1:2017)",
                Category = "general",
                CropScope = "xà lách,xa lach,lettuce,batavia,rau ăn lá",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác và dinh dưỡng xà lách VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    VI KHÍ HẬU VÀ DINH DƯỠNG CHO XÀ LÁCH VIETGAP:
                    Nhiệt độ tối ưu: 18-24°C, chịu lạnh tốt nhưng nhạy cảm với nhiệt độ cao (> 28°C dễ bật ngồng hoa, đắng lá, cháy mép lá).
                    Độ ẩm không khí: 65-75%, cần nhà màng thông thoáng để tán lá mau khô ráo sau khi tưới.
                    Độ ẩm đất/giá thể: 65-75%, duy trì ẩm độ ổn định, tránh khô hạn làm đứt rễ non.
                    EC dung dịch: 1.2-1.8 dS/m (xà lách mẫn cảm với độ mặn). pH nước tưới lý tưởng: 5.8-6.5.
                    Kiểm soát Nitrat (NO3-): Ngừng bón phân đạm hóa học trước thu hoạch tối thiểu 14 ngày để đảm bảo dư lượng nitrat an toàn theo tiêu chuẩn VietGAP.
                    """,
                    "xà lách,xa lach,lettuce,batavia,rau ăn lá",
                    "xà lách,nhiệt độ,độ ẩm,EC,pH,nitrat,thủy canh,đắng lá,bật ngồng,rau ăn lá"),

                new(1, """
                    QUẢN LÝ SÂU BỆNH HẠI TRÊN XÀ LÁCH VIETGAP:
                    Bệnh thối nhũn vi khuẩn (Pectobacterium / Erwinia): Vết bệnh úng nước, bốc mùi hôi thối đặc trưng. Phòng ngừa: Không tưới phun chiều tối, làm luống cao thoát nước, nhổ bỏ cây bệnh, rắc vôi khử trùng đất.
                    Bệnh đốm lá nấm: Đốm tròn màu nâu xám trên lá già. Xử lý: Phun chế phẩm sinh học đối kháng Trichoderma hoặc hoạt chất gốc đồng được phép.
                    Sâu hại (sâu tơ, sâu xanh, bọ nhảy): Đặt bẫy dính màu vàng kết hợp chế phẩm sinh học Bacillus thuringiensis (Bt) hoặc nấm xanh Metarhizium.
                    """,
                    "xà lách,xa lach,lettuce,batavia,rau ăn lá",
                    "thối nhũn,Erwinia,Pectobacterium,đốm lá,sâu tơ,bọ nhảy,Bt,Trichoderma,vôi"),

                new(2, """
                    QUY TRÌNH THU HOẠCH VÀ SƠ CHẾ XÀ LÁCH VIETGAP:
                    Thời điểm thu hoạch: Thu hái vào sáng sớm (5h-8h) khi thời tiết mát mẻ, lá căng mọng nước.
                    Dụng cụ: Kéo và dao cắt chuyên dụng được làm sạch và sát khuẩn trước khi sử dụng.
                    Nước sơ chế: Nước rửa sơ chế phải đạt quy chuẩn nước sinh hoạt QCVN 01-1:2018/BYT.
                    Đóng gói: Bao bì an toàn vệ sinh thực phẩm có đục lỗ thoát ẩm, bảo quản trong kho lạnh giữ độ tươi ngon.
                    """,
                    "xà lách,xa lach,lettuce,batavia,rau ăn lá",
                    "thu hoạch,sơ chế,nước rửa,QCVN,đóng gói,bảo quản,nhiệt độ mát,tươi")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 8: Dưa leo / Dưa chuột (Cucumis sativus) theo VietGAP
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quy trình kỹ thuật canh tác và phòng trừ sâu bệnh dưa leo (Cucumis sativus) nhà màng VietGAP",
                FileType = "seed",
                AuthorOrganization = "Cục Trồng trọt & Cục Bảo vệ Thực vật (TCVN 11892-1:2017)",
                Category = "general",
                CropScope = "dưa leo,dua leo,dưa chuột,dua chuot,cucumber",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quy trình kỹ thuật canh tác và phòng trừ sâu bệnh dưa leo VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    ĐIỀU KIỆN VI KHÍ HẬU VÀ CHẾ ĐỘ NƯỚC TƯỚI DƯA LEO NHÀ MÀNG:
                    Nhiệt độ thích hợp: Ban ngày 24-30°C, ban đêm 18-22°C. Nhiệt độ < 15°C hoặc > 35°C khiến hoa dễ rụng, quả cong vẹo dị dạng.
                    Độ ẩm không khí: 65-75%. Độ ẩm đất tối ưu: 70-80% (dưa leo háo nước do diện tích bản lá lớn).
                    Tưới nhỏ giọt: Chia nhiều lần tưới ngắn trong ngày duy trì ẩm độ rễ liên tục, tránh tưới ướt đẫm lúc chiều muộn.
                    EC dung dịch dinh dưỡng: Cây con 1.5-1.8 dS/m, sinh trưởng thân lá 2.0-2.2 dS/m, nuôi quả 2.2-2.5 dS/m. pH: 6.0-6.8.
                    """,
                    "dưa leo,dua leo,dưa chuột,dua chuot,cucumber",
                    "dưa leo,dưa chuột,cucumber,nhiệt độ,độ ẩm đất,nước tưới,tưới nhỏ giọt,EC,pH,cong quả"),

                new(1, """
                    KỸ THUẬT TỈA CÀNH, BẤM NGỌN VÀ THỤ PHẤN DƯA LEO:
                    Tỉa nhánh gốc: Từ nách lá thứ 1 đến thứ 5, tỉa sạch toàn bộ nhánh phụ và hoa để tập trung nuôi bộ rễ và thân chính vươn khỏe.
                    Bấm ngọn nhánh phụ: Từ nách lá thứ 6 trở lên, để nhánh phụ mang 1-2 lá và 1 quả rồi bấm ngọn nhánh phụ.
                    Treo dây và hạ giàn: Khi ngọn dưa leo chạm đỉnh giàn (2-2.2m), tiến hành hạ giàn 30-50cm và cuộn gốc gọn gàng để cây tiếp tục vươn ngọn cho quả liên tục.
                    """,
                    "dưa leo,dua leo,dưa chuột,dua chuot,cucumber",
                    "tỉa nhánh,bấm ngọn,hạ giàn,treo dây,hoa cái,nuôi quả,dưa leo"),

                new(2, """
                    PHÒNG TRỪ DỊCH HẠI BẢO VỆ THỰC VẬT DƯA LEO VIETGAP:
                    Bệnh giả sương mai (Pseudoperonospora cubensis): Đốm góc cạnh màu vàng trên mặt lá, mặt dưới có lớp nấm xám tím. Xử lý: Sử dụng chế phẩm sinh học đối kháng hoặc hoạt chất trừ nấm được cấp phép trong danh mục BVTV VietGAP.
                    Bệnh phấn trắng: Sử dụng chế phẩm lưu huỳnh sinh học hoặc hoạt chất chuyên dụng cho phép.
                    Bọ phấn trắng, bọ trĩ: Chích hút nhựa làm xoăn đọt, truyền virus khảm lá. Sử dụng bẫy vàng kết hợp chế phẩm sinh học dầu khoáng hoặc vi sinh.
                    Cách ly thu hoạch: Tuyệt đối tuân thủ nghiêm ngặt thời gian cách ly (PHI) ghi trên nhãn thuốc trước khi thu hoạch quả.
                    """,
                    "dưa leo,dua leo,dưa chuột,dua chuot,cucumber",
                    "giả sương mai,Pseudoperonospora,phấn trắng,bọ phấn trắng,bọ trĩ,bẫy vàng,dầu khoáng,cách ly,PHI")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 9: Quy trình thu hoạch và an toàn vệ sinh sản phẩm
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quy trình thu hoạch và an toàn vệ sinh sản phẩm theo VietGAP",
                FileType = "seed",
                AuthorOrganization = "Cục Quản lý Chất lượng Nông lâm sản và Thủy sản (NAFIQAD)",
                Category = "harvest",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quy trình thu hoạch và an toàn vệ sinh sản phẩm theo VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    QUY TRÌNH THU HOẠCH AN TOÀN VIETGAP:
                    Thu hoạch vào thời điểm mát trong ngày (sáng sớm hoặc chiều muộn), tránh thu hái lúc trời mưa hoặc nắng gắt làm giảm phẩm chất.
                    Dụng cụ thu hái (kéo, dao, giỏ đựng) phải được làm sạch và khử trùng định kỳ.
                    Nước rửa sơ chế phải đạt quy chuẩn nước sinh hoạt QCVN 01-1:2018/BYT.
                    Sản phẩm đóng gói bằng bao bì chuyên dụng có tem nhãn mã QR truy xuất nguồn gốc đầy đủ lịch sử canh tác.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "thu hoạch,an toàn vệ sinh,khử trùng,nước rửa,QCVN,bao bì,QR")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 10: Ghi chép nhật ký và truy xuất nguồn gốc
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Ghi chép nhật ký điện tử và truy xuất nguồn gốc VietGAP",
                FileType = "seed",
                AuthorOrganization = "Bộ Nông nghiệp & PTNT - Hệ thống Truy xuất Nguồn gốc Quốc gia",
                Category = "record",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Ghi chép nhật ký điện tử và truy xuất nguồn gốc VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    QUY ĐỊNH GHI CHÉP VÀ TRUY XUẤT NGUỒN GỐC VIETGAP:
                    VietGAP bắt buộc ghi chép minh bạch tất cả các hoạt động nông nghiệp: hạt giống, phân bón, chế phẩm bảo vệ thực vật, tưới tiêu, theo dõi sinh trưởng và thu hoạch.
                    Hồ sơ số hóa lưu trữ phục vụ truy xuất nguồn gốc khi có kiểm tra đánh giá hoặc kiểm định an toàn thực phẩm.
                    Mỗi lô sản phẩm phải xác định chính xác khu vực canh tác (Zone), ngày gieo trồng và ngày xuất kho.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "nhật ký điện tử,truy xuất nguồn gốc,lô sản phẩm,Zone,số hóa,VietGAP")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 11: Kỹ thuật canh tác và vi khí hậu chuyên sâu cho Cà chua
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Kỹ thuật canh tác và quản lý vi khí hậu chuyên sâu cho cà chua nhà màng VietGAP",
                FileType = "seed",
                AuthorOrganization = "Viện Nghiên cứu Rau quả (FAVRI) - VAAS",
                Category = "general",
                CropScope = "cà chua",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác và quản lý vi khí hậu cà chua VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    VI KHÍ HẬU VÀ NHU CẦU MÔI TRƯỜNG CHO CÀ CHUA NHÀ MÀNG:
                    Nhiệt độ tối ưu: Ban ngày 21-28°C, ban đêm 16-19°C. Nhiệt độ > 32°C gây rụng hoa và giảm sức sống hạt phấn; nhiệt độ < 12°C làm chậm phát triển rễ.
                    Độ ẩm không khí tối ưu: 60-70%. Độ ẩm > 85% kéo dài tạo điều kiện bùng phát nấm sương mai và mốc xám.
                    Ánh sáng: Cần tối thiểu 6-8 giờ chiếu sáng trực tiếp/ngày, cường độ sáng 30.000-50.000 Lux.
                    Độ ẩm đất/giá thể: Duy trì 65-75% trong giai đoạn sinh trưởng thân lá và nuôi quả; giảm xuống 60-65% giai đoạn chín thu hoạch.
                    """,
                    "cà chua",
                    "cà chua,nhiệt độ,độ ẩm không khí,độ ẩm đất,ánh sáng,Lux,vi khí hậu,nhà màng"),

                new(1, """
                    KỸ THUẬT TỈA CÀNH, BẤM NGỌN VÀ THỤ PHẤN CÀ CHUA:
                    Tỉa chồi nách: Thường xuyên tỉa bỏ chồi nách khi mới nhú 3-5cm, chỉ giữ lại 1 thân chính duy nhất để tập trung dinh dưỡng nuôi trái.
                    Hạ giàn: Khi cây đạt chiều cao 2m, tiến hành hạ dây giàn để cây tiếp tục vươn ngọn và cho các lứa chùm hoa mới.
                    Hỗ trợ thụ phấn: Rung giàn hoặc dùng quạt gió lưu thông vào khoảng 8h00 - 10h00 sáng khi độ ẩm không khí đạt 60-70% giúp hạt phấn phân tán tốt nhất.
                    Tỉa quả: Mỗi chùm chỉ để 4-6 quả cân đối, tỉa bỏ sớm các quả dị hình, quả còi cọc ở đầu chùm.
                    """,
                    "cà chua",
                    "tỉa chồi nách,hạ giàn,thụ phấn,rung giàn,tỉa quả,thân chính,chùm hoa"),

                new(2, """
                    RỐI LOẠN SINH LÝ CÀ CHUA VÀ PHÒNG CHỐNG THỐI ĐÍCH QUẢ (BER):
                    Bệnh thối đít trái (Blossom End Rot - BER): Nguyên nhân do thiếu hụt Canxi cục bộ tại mô đáy quả, thường xuất hiện khi độ ẩm đất biến động mạnh hoặc EC quá cao cản trở hút Ca.
                    Biện pháp phòng ngừa BER: Giữ ẩm độ đất ổn định 65-75%, không để giá thể khô kiệt rồi tưới đẫm; bổ sung Canxi-Bo dạng chelate qua hệ thống tưới nhỏ giọt định kỳ.
                    Nứt quả: Xảy ra khi tưới nước quá nhiều sau một đợt khô hạn hoặc chênh lệch nhiệt độ ngày đêm quá lớn. Cần điều tiết lượng nước tưới chia nhỏ nhiều lần trong ngày.
                    """,
                    "cà chua",
                    "thối đít trái,BER,Canxi,Calcium,nứt quả,dao động độ ẩm,rối loạn sinh lý")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 12: Quản lý dinh dưỡng và Fertigation theo tiêu chuẩn VietGAP
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quản lý dinh dưỡng cây trồng và kỹ thuật châm phân Fertigation theo tiêu chuẩn VietGAP",
                FileType = "seed",
                AuthorOrganization = "Viện Thổ nhưỡng Nông hóa (SFRI) - Bộ Nông nghiệp & PTNT",
                Category = "nutrition",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quản lý dinh dưỡng và kỹ thuật châm phân Fertigation VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    NGUYÊN TẮC QUẢN LÝ DINH DƯỠNG THEO CHUẨN VIETGAP:
                    Chỉ sử dụng các loại phân bón nằm trong danh mục được phép lưu hành tại Việt Nam.
                    Phân hữu cơ phải được ủ hoai mục hoàn toàn theo quy trình xử lý vi sinh vật, tuyệt đối không sử dụng phân chuồng tươi, phân bắc chưa qua xử lý.
                    Áp dụng bón phân cân đối theo tỷ lệ N:P:K phù hợp với từng thời kỳ sinh trưởng của cây trồng để tránh tích lũy Nitrat (NO3-) dư thừa trong sản phẩm thu hoạch.
                    Ngưỡng dư lượng Nitrat trong rau ăn lá theo VietGAP: ≤ 1500 mg/kg; rau ăn quả ≤ 500 mg/kg.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "dinh dưỡng,phân bón,VietGAP,hữu cơ hoai mục,Nitrat,NO3,dư lượng"),

                new(1, """
                    KỸ THUẬT CHÂM PHÂN FERTIGATION VÀ QUẢN LÝ EC, PH VÙNG RỄ:
                    Hệ thống châm phân tự động hòa tan phân bón hòa tan cao cấp (A, B tank) trực tiếp vào đường ống tưới nhỏ giọt.
                    Bể A chứa Canxi Nitrat và Sắt Chelate; Bể B chứa Kali, Photphat, Magie Sunfat và các vi lượng khác để tránh kết tủa Canxi Photphat và Canxi Sunfat.
                    Độ pH của dung dịch tưới duy trì nghiêm ngặt trong khoảng 5.8 - 6.5 để tối ưu hóa khả năng hấp thu của tất cả các chất dinh dưỡng.
                    Độ dẫn điện EC được kiểm soát theo từng loại cây: Cây con 1.0 - 1.5 dS/m; Cây trưởng thành và nuôi trái 2.0 - 2.8 dS/m; Xà lách thủy canh 1.2 - 1.6 dS/m.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "fertigation,châm phân,EC,pH,bể A,bể B,kết tủa,tưới nhỏ giọt"),

                new(2, """
                    CHẨN ĐOÁN RỐI LOẠN DINH DƯỠNG VÀ XỬ LÝ KHẮC PHỤC:
                    Thiếu Đạm (N): Cây sinh trưởng còi cọc, lá già chuyển vàng đồng đều từ cuống lá ra mép lá. Khắc phục: Tăng nhẹ tỷ lệ Nitrat.
                    Thiếu Lân (P): Lá bánh tẻ chuyển màu xanh đậm hoặc tím ánh đỏ ở gân mặt dưới lá, bộ rễ kém phát triển. Khắc phục: Bổ sung Photphat hòa tan.
                    Thiếu Kali (K): Mép lá già bị cháy vàng xém, thịt quả mềm, màu sắc kém tươi và độ đường thấp. Khắc phục: Bổ sung Kali Sunfat hoặc Kali Nitrat.
                    Thiếu Sắt (Fe): Đọt non bị bạc trắng, gân lá vẫn còn màu xanh. Khắc phục: Phun hoặc châm Fe-EDDHA hoặc Fe-EDTA.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "thiếu đạm,thiếu lân,thiếu kali,thiếu sắt,lá vàng,cháy mép lá,rối loạn dinh dưỡng")
            };
            results.Add((doc, chunks));
        }

        // ────────────────────────────────────────────────────────────────────
        // TÀI LIỆU 13: Tiêu chuẩn an toàn chất lượng nguồn nước tưới VietGAP
        // ────────────────────────────────────────────────────────────────────
        {
            var doc = new AgricultureDocument
            {
                Title = "Quy chuẩn an toàn chất lượng nguồn nước tưới nông nghiệp công nghệ cao theo QCVN 08-MT và VietGAP",
                FileType = "seed",
                AuthorOrganization = "Bộ Tài nguyên & Môi trường - QCVN 08-MT:2015/BTNMT",
                Category = "irrigation",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quy chuẩn an toàn nguồn nước tưới nông nghiệp công nghệ cao QCVN 08-MT và VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    QUY CHUẨN NGUỒN NƯỚC TƯỚI NÔNG NGHIỆP THEO QCVN 08-MT:2015/BTNMT:
                    Nước tưới tiêu nông nghiệp công nghệ cao và thủy canh VietGAP phải được xét nghiệm định kỳ tối thiểu 6 tháng/lần.
                    Giới hạn pH nguồn nước tưới tự nhiên: 5.5 - 8.5.
                    Tổng chất rắn hòa tan (TDS): < 1000 mg/L (để hạn chế tích lũy muối làm tăng EC không kiểm soát).
                    Chỉ số kim loại nặng cho phép: Asen (As) ≤ 0.05 mg/L; Chì (Pb) ≤ 0.05 mg/L; Cadimi (Cd) ≤ 0.01 mg/L; Thủy ngân (Hg) ≤ 0.001 mg/L.
                    Nguồn nước giếng khoan bị nhiễm sắt (phèn) phải qua hệ thống giàn mưa khử sắt và bể lọc cát thạch anh trước khi đưa vào bể chứa tưới.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "nước tưới,QCVN 08-MT,kim loại nặng,Asen,Chì,Cadimi,TDS,pH,khử phèn"),

                new(1, """
                    KIỂM SOÁT VI SINH VẬT TRONG NƯỚC TƯỚI VIETGAP:
                    Chỉ số vi sinh giới hạn trong nước tưới rau ăn lá và rau ăn sống: E. coli ≤ 100 CFU/100ml; Salmonella: Không được phát hiện trong 250ml mẫu nước.
                    Tuyệt đối không sử dụng nguồn nước thải công nghiệp, nước thải y tế hoặc nước ao tù ô nhiễm để tưới tiêu.
                    Hệ thống lọc nước nhà màng VietGAP: Sử dụng màng lọc đĩa 120-130 micron kết hợp đèn UV khử trùng nước hoặc ozone hóa để diệt sạch mầm bệnh nấm Fusarium và vi khuẩn trước khi châm phân tưới.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây,xà lách,dưa chuột,cucumber,lettuce",
                    "vi sinh,E. coli,Salmonella,nước thải,khử trùng,đèn UV,ozone,lọc đĩa")
            };
            results.Add((doc, chunks));
        }

        return results;
    }
}
