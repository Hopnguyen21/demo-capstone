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
                AuthorOrganization = "Bộ Nông nghiệp và Phát triển Nông thôn (VietGAP)",
                Category = "irrigation",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
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
                    Kiểm tra EC (độ dẫn điện) dung dịch dinh dưỡng: cà chua cần EC 2.0-3.5 dS/m, dưa lưới 1.5-2.5 dS/m, dâu tây 1.0-2.0 dS/m.
                    pH nước tưới lý tưởng: 5.8-6.5 cho hầu hết rau màu VietGAP.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
                    "tưới nhỏ giọt,độ ẩm đất,EC,pH,VietGAP,nước tưới"),

                new(1, """
                    LỊCH TƯỚI THEO GIAI ĐOẠN SINH TRƯỞNG:
                    Cây con (0-15 ngày): Tưới 2-3 lần/ngày, lượng nhỏ (0.5-1 lít/cây/ngày), giữ độ ẩm đất 70-80%.
                    Sinh trưởng thân lá (15-40 ngày): Tưới 1-2 lần/ngày, 1-2 lít/cây/ngày.
                    Ra hoa đậu trái: Giảm lượng nước 10-15% để kích thích đậu trái, tránh thừa đạm.
                    Nuôi trái: Tưới đều đặn, tránh chênh lệch độ ẩm đột ngột gây nứt trái (cà chua, dưa lưới).
                    Thu hoạch: Giảm tưới 5-7 ngày trước thu hoạch để tăng độ Brix.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
                    "lịch tưới,giai đoạn sinh trưởng,cây con,ra hoa,đậu trái,nứt trái,thu hoạch"),

                new(2, """
                    PHÂN BÓN THEO PHƯƠNG PHÁP FERTIGATED (CHÂM PHÂN QUA HỆ THỐNG TƯỚI):
                    Giai đoạn cây con: NPK 20-20-20 + vi lượng, liều lượng 0.5-1g/lít.
                    Giai đoạn sinh trưởng: Tăng đạm N (NPK 30-10-10), bổ sung Ca-Mg.
                    Giai đoạn ra hoa: Chuyển sang NPK nhiều lân P và kali K (NPK 10-30-20).
                    Giai đoạn nuôi trái: Ưu tiên kali K cao (NPK 10-10-40), bổ sung Boron 0.3-0.5 ppm chống rụng trái.
                    Canxi (Ca): Phun qua lá 0.3-0.5% CaCl2 mỗi 7-10 ngày để phòng đầu thối (BER) ở cà chua, ớt.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
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
                AuthorOrganization = "Cục Bảo vệ Thực vật - Bộ NN&PTNT",
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
                    Test nhanh: Nhúng đoạn thân vào nước trong, quan sát dòng khuẩn trắng đục chảy ra từ mặt cắt.
                    Phòng ngừa: Xử lý đất bằng vôi bột (100 kg/1000m²) trước khi trồng, khử trùng nước tưới, dùng giống kháng Ralstonia.
                    Xử lý: Nhổ bỏ và tiêu hủy cây bệnh ngay. Tưới Copper oxychloride 0.2% quanh vùng cây bệnh.
                    """,
                    "cà chua,ớt",
                    "héo rũ,vi khuẩn,Ralstonia,solanacearum,mạch dẫn,vôi,copper,tiêu hủy"),

                new(1, """
                    BỆNH SƯƠNG MAI (Phytophthora infestans) - CÀ CHUA, ỚT:
                    Triệu chứng: Đốm úng nước trên lá, mặt dưới lá có lớp nấm trắng xám. Trái bị thối nhanh, màu nâu xỉn. Phát triển mạnh khi nhiệt độ 15-20°C, độ ẩm không khí > 85%.
                    Phòng ngừa IPM: Tỉa lá già phần gốc để thông thoáng, không tưới phun chiều tối.
                    Xử lý sinh học: Copper hydroxide (Kocide) 0.2%, luân phiên Mancozeb 0.2% mỗi 7 ngày.
                    Ngưỡng can thiệp: Phun ngay khi phát hiện 1-2 đốm bệnh đầu tiên.
                    """,
                    "cà chua,ớt",
                    "sương mai,Phytophthora,infestans,nấm,lá,trái,thối,độ ẩm,Copper,Mancozeb,IPM"),

                new(2, """
                    BỌ TRĨ (Thrips palmi, Frankliniella) - CÀ CHUA, ỚT, DƯA LEO:
                    Triệu chứng: Lá xoăn lại, đọt non biến dạng, hoa và trái non bị sẹo bạc. Mật độ cao trong mùa khô.
                    Phòng ngừa: Đặt bẫy dính vàng (yellow sticky trap) 5-10 cái/1000m². Phun nước lên lá buổi sáng.
                    Xử lý sinh học: Nhện săn mồi Amblyseius cucumeris. Chế phẩm Spinosad 0.1% phun 7-10 ngày/lần.
                    Cách ly thu hoạch: Spinosad: 3 ngày, Abamectin: 7 ngày.
                    """,
                    "cà chua,ớt,dưa leo",
                    "bọ trĩ,Thrips,bẫy dính,vàng,Spinosad,Abamectin,nhện,xoăn lá"),

                new(3, """
                    BỆNH PHẤN TRẮNG (Oidium) - CÀ CHUA, DƯA LEO, BÍ:
                    Triệu chứng: Lớp bột trắng phủ trên mặt lá, sau đó lá vàng và khô. Phát triển khi nhiệt độ 20-25°C.
                    Xử lý: Lưu huỳnh dạng bột (Sulfur) rắc lên lá sớm; hoặc Myclobutanil 0.1%, phun 7-14 ngày/lần.
                    Lưu ý: Lưu huỳnh không dùng khi nhiệt độ > 32°C (gây cháy lá).
                    """,
                    "cà chua,dưa leo,bí",
                    "phấn trắng,Oidium,bột trắng,Sulfur,Myclobutanil,lưu huỳnh")
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
                AuthorOrganization = "Viện Nghiên cứu Rau quả - Đà Lạt",
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
                    Nhiệt độ ban ngày: 18-25°C. Ban đêm: 10-15°C (chênh lệch ngày/đêm kích thích đường).
                    Độ ẩm không khí: 60-70%. Ẩm độ > 80% tăng nguy cơ nấm xám và thán thư.
                    Ánh sáng: Cần 8-12 giờ/ngày, PAR tối thiểu 300 µmol/m²/s để đậu trái tốt.
                    Độ ẩm đất: 60-70% giai đoạn sinh dưỡng; giảm xuống 50-60% trước thu hoạch 5 ngày.
                    EC đất/dung dịch: 0.8-1.5 dS/m (dâu tây nhạy với mặn hơn các loại khác).
                    """,
                    "dâu tây",
                    "dâu tây,nhiệt độ,độ ẩm,ánh sáng,EC,vi khí hậu,nhà màng,đường"),

                new(1, """
                    BỆNH THÁN THƯ DÂU TÂY (Colletotrichum fragariae):
                    Triệu chứng: Đốm nâu đen trên cuống, trái và lá. Trái bị thối nhũn, có vòng đồng tâm.
                    Phát triển mạnh khi nhiệt độ 25-30°C, ẩm ướt.
                    Phòng ngừa: Dùng màng phủ luống để hạn chế đất bắn lên trái. Không tưới phun trực tiếp lên trái và lá.
                    Xử lý: Azoxystrobin + Difenoconazole 0.1%, phun 10-14 ngày/lần. Carbendazim 0.15% phòng ngừa mùa mưa.
                    Nấm xám Botrytis: Xuất hiện khi ẩm độ > 80%. Xử lý: Iprodione 0.1%, cắt bỏ trái bệnh.
                    """,
                    "dâu tây",
                    "thán thư,Colletotrichum,nấm xám,Botrytis,trái thối,Azoxystrobin,Carbendazim,màng phủ"),

                new(2, """
                    QUẢN LÝ DINH DƯỠNG DÂU TÂY THEO GIAI ĐOẠN:
                    Cây con (0-30 ngày): N cao, P trung bình, K thấp. EC dung dịch: 0.8-1.0 dS/m.
                    Ra hoa (30-60 ngày): Giảm N, tăng P và K. Bổ sung Boron 0.3 ppm kích thích đậu hoa.
                    Nuôi trái (60-90 ngày): K cao nhất. EC: 1.2-1.5 dS/m. Calcium phun lá 0.3% CaCl2.
                    Lưu ý: Dâu tây rất nhạy với thừa muối. Luôn kiểm tra EC 2 lần/tuần.
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
                AuthorOrganization = "Viện Nghiên cứu Rau quả",
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
                    Nhiệt độ: Ban ngày 28-32°C, ban đêm 20-25°C. Chịu được tới 38°C nhưng ảnh hưởng đến đậu trái.
                    Độ ẩm không khí: 60-70%. Cao hơn 80% dễ sinh nấm (phấn trắng, sương mai).
                    Ánh sáng: Ưa sáng mạnh, cần >10 giờ/ngày. Thiếu sáng làm giảm hàm lượng đường.
                    Độ ẩm đất: 65-75% (tưới nhỏ giọt 2-3 lần/ngày).
                    EC: Cây con 1.0-1.5; ra hoa 2.0-2.5; nuôi trái 2.5-3.5 dS/m.
                    """,
                    "dưa lưới",
                    "dưa lưới,nhiệt độ,độ ẩm,ánh sáng,EC,vi khí hậu,đường"),

                new(1, """
                    KỸ THUẬT TẠO HÌNH VÀ THỤ PHẤN DƯA LƯỚI:
                    Bấm ngọn lần 1: Khi dây chính được 25-30cm, để 2-3 nhánh phụ.
                    Bấm ngọn lần 2: Bấm đầu nhánh phụ ở lá thứ 10-12 để kích thích hoa cái.
                    Thụ phấn nhân tạo: Lấy phấn hoa đực bôi lên nhụy hoa cái vào buổi sáng (6-9h). Có thể nuôi ong mật trong nhà màng.
                    Chỉ để 1-2 trái/cây cho trái lớn và ngọt. Tỉa bỏ trái xấu, trái bệnh sớm.
                    """,
                    "dưa lưới",
                    "bấm ngọn,thụ phấn,hoa cái,hoa đực,ong,trái,tỉa"),

                new(2, """
                    SÂU BỆNH PHỔ BIẾN TRÊN DƯA LƯỚI:
                    Bệnh phấn trắng: Dùng Sulfur dạng bột hoặc Myclobutanil 0.1%.
                    Bệnh héo đột ngột (Fusarium): Xử lý đất bằng Trichoderma trước khi trồng (5-10 kg/1000m²).
                    Nhện đỏ (Tetranychus urticae): Tăng độ ẩm không khí. Phun Abamectin 1.8% EC.
                    Ruồi đục trái (Bactrocera): Đặt bẫy pheromone Methyl eugenol, 3-5 bẫy/1000m².
                    """,
                    "dưa lưới",
                    "phấn trắng,héo,Fusarium,Trichoderma,nhện đỏ,Abamectin,ruồi đục trái,bẫy pheromone")
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
                AuthorOrganization = "Trung tâm Khuyến nông Quốc gia",
                Category = "climate",
                CropScope = "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
                IsPublic = true,
                Version = "2024",
                ContentText = "Quản lý vi khí hậu và thông gió nhà màng."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    THÔNG GIÓ VÀ KIỂM SOÁT NHIỆT ĐỘ NHÀ MÀNG:
                    Nhiệt độ nhà màng vào mùa hè thường cao hơn ngoài trời 5-15°C.
                    Mở cửa mái (roof vent) khi nhiệt độ > 30°C. Đóng lại khi có mưa hoặc nhiệt độ < 25°C vào ban đêm.
                    Quạt đối lưu: Bật khi nhiệt độ > 30°C hoặc độ ẩm không khí > 85%. Tốc độ gió tối ưu: 0.5-1.0 m/s.
                    Lưới cắt nắng (shading net): Dùng lưới cắt 50-70% ánh sáng vào mùa hè để giảm nhiệt.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
                    "thông gió,nhiệt độ,quạt,cửa mái,lưới cắt nắng,làm mát,ẩm độ"),

                new(1, """
                    ĐỘ ẨM KHÔNG KHÍ VÀ PHÒNG NGỪA NẤM BỆNH TRONG NHÀ MÀNG:
                    Ngưỡng nguy hiểm: Ẩm độ không khí > 85% trong nhiều giờ liên tục tạo điều kiện cho nấm bệnh Botrytis, sương mai, phấn trắng.
                    Biện pháp: Tăng thông gió, bật quạt đối lưu. Không tưới phun vào chiều tối.
                    Ẩm độ quá thấp (< 40%): Gây co rút khí khổng, cây mất nước. Giải pháp: Tưới nhỏ giọt liên tục, phun sương mịn.
                    Đo ẩm độ: Đặt cảm biến SHT31 hoặc DHT22 ở độ cao tán lá (1-1.5m so với mặt luống).
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
                    "ẩm độ không khí,nấm,Botrytis,thông gió,quạt,cảm biến,phun sương"),

                new(2, """
                    ÁNH SÁNG VÀ QUANG HỢP TRONG NHÀ MÀNG:
                    Cường độ ánh sáng tối thiểu cho quang hợp: 200 µmol/m²/s PAR.
                    Điểm bão hòa ánh sáng: Cà chua 700-1000; Dâu tây 400-600; Dưa lưới 800-1000 µmol/m²/s.
                    Thiếu sáng: Thân yếu, vươn cao bất thường, hoa dễ rụng, trái nhỏ và ít đường.
                    Cần chiếu sáng bổ sung (LED grow light) khi PAR < 200 µmol/m²/s hoặc ngày nhiều mây liên tục.
                    """,
                    "cà chua,dưa lưới,dưa leo,ớt,dâu tây",
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
                AuthorOrganization = "Trung tâm Nghiên cứu Rau hoa quả",
                Category = "general",
                CropScope = "ớt,ớt ngọt,ớt chuông",
                IsPublic = true,
                Version = "2024",
                ContentText = "Kỹ thuật canh tác ớt ngọt VietGAP."
            };
            var chunks = new List<SeedChunkData>
            {
                new(0, """
                    ĐIỀU KIỆN SINH TRƯỞNG VÀ PHÁT TRIỂN ỚT NGỌT:
                    Nhiệt độ: 20-30°C tối ưu. Dưới 15°C gây rụng hoa, trên 35°C gây vô phấn (hạt phấn chết).
                    Độ ẩm đất: 65-75%. Ớt chịu hạn tốt hơn cà chua nhưng không thể ngập úng lâu.
                    pH đất: 6.0-6.8. EC dung dịch tưới: 2.0-3.0 dS/m sinh trưởng; 3.0-3.5 dS/m nuôi trái.
                    Ánh sáng: > 8 giờ/ngày. Ớt cần nhiều ánh sáng để tạo màu sắc (đỏ, vàng, cam).
                    """,
                    "ớt,ớt ngọt,ớt chuông",
                    "ớt,nhiệt độ,độ ẩm,EC,pH,ánh sáng,vô phấn,hoa rụng"),

                new(1, """
                    BỆNH LỞ CỔ RỄ VÀ THỐI GỐC ỚT:
                    Nguyên nhân: Pythium, Phytophthora kết hợp với đất ẩm, thoát nước kém.
                    Triệu chứng: Cổ rễ bị thắt lại, thâm đen, cây đổ ngã. Thường xảy ra vào mùa mưa.
                    Phòng ngừa: Lên luống cao, phủ màng ngăn ẩm. Trộn Trichoderma vào đất trước khi trồng.
                    Xử lý: Tưới gốc Metalaxyl (Ridomil Gold) 0.15% khi phát hiện bệnh. Nhổ bỏ cây bệnh nặng.
                    """,
                    "ớt,ớt ngọt",
                    "lở cổ rễ,thối gốc,Pythium,Phytophthora,Trichoderma,Metalaxyl,Ridomil,thoát nước")
            };
            results.Add((doc, chunks));
        }

        return results;
    }
}
