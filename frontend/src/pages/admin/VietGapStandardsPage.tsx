import React, { useState, useEffect } from 'react';
import { 
  FileText, Award, UploadCloud, CheckCircle2, ShieldCheck, 
  ExternalLink, Download, Search, Plus, Trash2, Edit3, ArrowRight,
  Sparkles, Layers, BookOpen, AlertCircle, RefreshCw, Droplets,
  Sprout, Beaker, ShieldAlert, Clock, ChevronDown, ChevronUp,
  FileCheck2, CheckSquare, Bookmark, HeartPulse, Microscope
} from 'lucide-react';
import { cropService, knowledgeService } from '../../services';
import { Crop } from '../../types';

export interface VietGapRegulationDetail {
  id: string;
  code: string;
  title: string;
  cropName: string;
  category: string;
  fileType: 'PDF' | 'DOCX' | 'TXT';
  fileSize: string;
  uploadDate: string;
  author: string;
  issuingAuthority: string;
  validityPeriod: string;
  status: 'VALIDATED' | 'PROCESSING' | 'DRAFT';
  profileGenerated: boolean;
  profileId?: string;
  chunks?: { id: string; chunkIndex: number; content: string; cropTags: string; keywords: string; hasEmbedding: boolean }[];
  contentText?: string;

  // 1. Quản lý Đất & Giá thể
  soilManagement: {
    soilType: string;
    heavyMetalLimits: string; // Giới hạn kim loại nặng (As, Pb, Cd, Hg)
    isolationDistance: string; // Khoảng cách cách ly vùng ô nhiễm
    soilPreparation: string; // Kỹ thuật xử lý đất/giá thể trước khi trồng
  };

  // 2. Quản lý Nước tưới & Dinh dưỡng
  waterManagement: {
    waterSourceStandard: string; // Nguồn nước theo QCVN 08-MT:2015/BTNMT
    eColiLimit: string; // Giới hạn vi sinh vật E.Coli & Salmonella
    phWaterRange: string;
    irrigationMethod: string; // Phương pháp tưới (nhỏ giọt/phun mưa)
  };

  // 3. Quy trình Sử dụng Phân bón
  fertilizerRules: {
    organicRequirements: string; // Quy định phân hữu cơ hoai mục
    chemicalFertilizerCeiling: string; // Ngưỡng N-P-K tối đa
    preHarvestIntervalDays: number; // Thời gian cách ly phân bón trước thu hoạch
    forbiddenFertilizers: string; // Phân bón cấm sử dụng
  };

  // 4. Bảo vệ Thực vật & Kiểm soát Sâu bệnh (IPM)
  pestManagementIPM: {
    ipmPrinciples: string; // Nguyên tắc phòng trừ dịch hại tổng hợp IPM
    permittedBioPesticides: string; // Thuốc BVTV sinh học được phép
    isolationQuarantineDays: number; // Thời gian cách ly thuốc BVTV (PHI)
    prohibitedChemicals: string; // Danh mục hoạt chất cấm tuyệt đối
  };

  // 5. Điều kiện Vi Khí Hậu & Kỹ Thuật Canh Tác
  climateRequirements: {
    tempOptimal: string;
    moistureOptimal: string;
    pHOptimal: string;
    ecOptimal: string;
    luxOptimal: string;
    growthDays: number;
    harvestNoticeDays: number;
  };

  // 6. Thu hoạch, Đóng gói & Truy xuất nguồn gốc
  harvestSafety: {
    harvestToolsStandard: string; // Vệ sinh dụng cụ chứa đựng
    waterWashingStandard: string; // Nước rửa sơ chế đạt chuẩn nước sinh hoạt
    packagingMaterial: string; // Bao bì đạt an toàn thực phẩm
    traceabilityQr: string; // Nhật ký điện tử và mã QR truy xuất
  };

  // 7. Các giai đoạn sinh trưởng để xuất ra GrowthProfile
  stagesOverview: { 
    name: string; 
    days: number; 
    temp: string; 
    moisture: string; 
    fertilizerAction: string;
    ipmAction: string;
  }[];
}

export const VietGapStandardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'CRITERIA_MATRIX' | 'IPM_PEST' | 'SOIL_WATER'>('DOCUMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<VietGapRegulationDetail | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedCropForConvert, setSelectedCropForConvert] = useState<string>('');
  const [convertingDoc, setConvertingDoc] = useState<VietGapRegulationDetail | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<'ALL' | 'IPM' | 'SOIL' | 'HARVEST'>('ALL');

  // Kho dữ liệu VietGAP nạp trực tiếp từ backend RAG
  const [documents, setDocuments] = useState<VietGapRegulationDetail[]>([]);
  const [profileThresholds, setProfileThresholds] = useState({
    tempMin: 20,
    tempMax: 28,
    moistMin: 65,
    moistMax: 75,
    phMin: 6.0,
    phMax: 6.8,
    ecMin: 1.8,
    ecMax: 2.5
  });

  
  // Form nạp tài liệu mới với trường nhập liệu xác thực từ người dùng / tệp tải lên
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    cropName: '',
    cropGroup: 'Rau ăn quả',
    category: 'general',
    code: '',
    author: '',
    issuingAuthority: '',
    validityPeriod: '',
    fileName: '',
    fileType: 'PDF' as 'PDF' | 'DOCX' | 'TXT',
    fileSize: '0 MB',

    soilType: '',
    heavyMetalLimits: '',
    isolationDistance: '',

    waterSourceStandard: '',
    eColiLimit: '',

    fertilizerRules: '',
    ipmRules: '',

    tempOptimal: '',
    moistureOptimal: '',
    pHOptimal: '',
    ecOptimal: '',
    growthDays: 0
  });

  useEffect(() => {
    loadCrops();
    loadBackendDocuments();
    if (documents.length > 0 && !selectedDoc) {
      setSelectedDoc(documents[0]);
    }
  }, []);

  const loadCrops = async () => {
    try {
      const res = await cropService.getCrops();
      setCrops(res || []);
    } catch {
      // fallback
    }
  };

  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isFullTextModalOpen, setIsFullTextModalOpen] = useState(false);

  // Trích xuất động thông số VietGAP từ nội dung PDF và cơ sở dữ liệu
  const deriveVietGapDetails = (d: any, detail?: any): VietGapRegulationDetail => {
    // Kết hợp toàn bộ văn bản từ tệp PDF/DB và các đoạn chunks
    const chunks = detail?.chunks || d.chunks || [];
    const contentText = detail?.contentText || d.contentText || '';
    const fullText = [contentText, ...chunks.map((c: any) => c.content || '')].filter(Boolean).join('\n');

    // Helper trích xuất câu hoặc đoạn ngắn chứa từ khóa
    const findSnippet = (keywords: string[]): string | null => {
      if (!fullText) return null;
      const lines = fullText.split('\n');
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          const trimmed = line.trim();
          if (trimmed.length > 10 && trimmed.length < 250) return trimmed;
        }
      }
      return null;
    };

    // 1. Trích xuất regex động từ văn bản nếu có
    const tempMatch = fullText.match(/(?:nhiệt độ|ban ngày|ngày)[^\n.]*?(\d{1,2})\s*[-–]\s*(\d{1,2})\s*°C/i);
    const moistMatch = fullText.match(/(?:độ ẩm đất|ẩm đất|độ ẩm)[^\n.]*?(\d{1,2}\s*[-–]\s*\d{1,2}\s*%)/i);
    const ecMatch = fullText.match(/EC[^\n.]*?(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?(?:\s*(?:dS\/m|mS\/cm))?)/i);
    const phMatch = fullText.match(/pH[^\n.]*?(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?)/i);
    const phiMatch = fullText.match(/(?:cách ly|PHI)[^\n.]*?(\d{1,2})\s*ngày/i);
    const ecoliMatch = fullText.match(/(?:E\.?\s*Coli|Salmonella)[^\n.]*?(?:<\s*|≤\s*)?(\d+[\w\/]*|âm tính)/i);
    const metalMatch = fullText.match(/(?:kim loại nặng|Cd|Pb|As)[^\n.]*?(?:QCVN\s*03|mg\/kg)/i);

    const cropName = d.cropScope || 'Áp dụng chung';

    // 1. Quản lý Đất & Giá thể
    const soilSnippet = findSnippet(['đất', 'giá thể', 'xơ dừa', 'làm luống']);
    const soilType = soilSnippet || 'Không có trong tài liệu';
    const heavyMetalLimits = metalMatch ? metalMatch[0].trim() : 'Không có trong tài liệu';
    const isolationDistance = findSnippet(['cách ly nguồn', 'khoảng cách ly', '100m', '150m']) || 'Không có trong tài liệu';
    const soilPreparation = findSnippet(['khử trùng', 'vôi bột', 'trichoderma', 'năng lượng mặt trời']) || 'Không có trong tài liệu';

    // 2. Quản lý Nước tưới
    const waterStandardSnippet = findSnippet(['qcvn 08', 'nguồn nước', 'nước tưới']);
    const waterSourceStandard = waterStandardSnippet || (fullText.includes('QCVN 08') ? 'QCVN 08-MT:2015/BTNMT' : 'Không có trong tài liệu');
    const eColiLimit = ecoliMatch ? ecoliMatch[0].trim() : (fullText.includes('E.Coli') ? 'Tuân thủ ngưỡng vi sinh theo QCVN' : 'Không có trong tài liệu');
    const phWaterRange = phMatch ? phMatch[1] : 'Không có trong tài liệu';
    const irrigationSnippet = findSnippet(['tưới nhỏ giọt', 'fertigation', 'tưới bù áp', 'lịch tưới']);
    const irrigationMethod = irrigationSnippet || 'Không có trong tài liệu';

    // 3. Quy trình Phân bón
    const organicSnippet = findSnippet(['phân hữu cơ', 'phân chuồng', 'ủ hoai']);
    const organicRequirements = organicSnippet || 'Không có trong tài liệu';
    const chemicalSnippet = findSnippet(['phân hóa học', 'n-p-k', 'châm phân', 'đạm nitrat']);
    const chemicalFertilizerCeiling = chemicalSnippet || 'Không có trong tài liệu';
    const preHarvestIntervalDays = phiMatch ? parseInt(phiMatch[1], 10) : 0;
    const forbiddenFertilizers = findSnippet(['phân cấm', 'phân tươi', 'rác thải']) || 'Không có trong tài liệu';

    // 4. IPM & Bảo vệ thực vật
    const ipmSnippet = findSnippet(['ipm', 'bảo vệ thực vật', 'phòng trừ', 'sâu bệnh']);
    const ipmPrinciples = ipmSnippet || 'Không có trong tài liệu';
    const bioSnippet = findSnippet(['sinh học', 'thảo mộc', 'bẫy dính', 'trichoderma', 'bt']);
    const permittedBioPesticides = bioSnippet || 'Không có trong tài liệu';
    const isolationQuarantineDays = preHarvestIntervalDays;
    const prohibitedChemicals = findSnippet(['hoạt chất cấm', 'danh mục cấm', 'thuốc cấm']) || 'Tuân thủ danh mục thuốc BVTV được phép sử dụng';

    // 5. Vi khí hậu
    const tempOptimal = tempMatch ? `${tempMatch[1]}°C - ${tempMatch[2]}°C` : 'Không có trong tài liệu';
    const moistureOptimal = moistMatch ? moistMatch[1] : 'Không có trong tài liệu';
    const pHOptimal = phMatch ? phMatch[1] : 'Không có trong tài liệu';
    const ecOptimal = ecMatch ? ecMatch[1] : 'Không có trong tài liệu';
    const growthDays = 0;

    // 6. Giai đoạn sinh trưởng: chỉ hiển thị các giai đoạn thực tế được đề cập
    const stagesOverview: any[] = [];
    if (fullText.toLowerCase().includes('giai đoạn') || fullText.toLowerCase().includes('thời kỳ')) {
      const stageMatches = fullText.match(/(?:Giai đoạn|Thời kỳ|Bước)\s*[:\d\-–]*\s*([^\n.]{5,60})/gi);
      if (stageMatches && stageMatches.length > 0) {
        stageMatches.slice(0, 5).forEach((sm) => {
          stagesOverview.push({
            name: sm.trim(),
            days: 0,
            temp: tempOptimal,
            moisture: moistureOptimal,
            fertilizerAction: 'Xem chi tiết trong văn bản quy chuẩn',
            ipmAction: 'Áp dụng theo hướng dẫn phòng trừ IPM'
          });
        });
      }
    }

    return {
      id: d.id,
      code: `TCVN / ${d.category || 'VietGAP'}`,
      title: d.title,
      cropName,
      category: d.category === 'irrigation' ? 'Tưới tiêu' : d.category === 'pest' ? 'Sâu bệnh (IPM)' : d.category === 'nutrition' ? 'Dinh dưỡng' : d.category === 'climate' ? 'Vi khí hậu' : d.category === 'harvest' ? 'Thu hoạch' : d.category === 'record' ? 'Nhật ký' : 'Quy chuẩn chung',
      fileType: (d.fileType?.toUpperCase() === 'DOCX' ? 'DOCX' : d.fileType?.toUpperCase() === 'TXT' ? 'TXT' : 'PDF') as 'PDF' | 'DOCX' | 'TXT',
      fileSize: `${chunks.length || d.chunkCount || 1} đoạn RAG`,
      uploadDate: d.createdAtUtc ? new Date(d.createdAtUtc).toLocaleDateString('vi-VN') : 'Mặc định',
      author: d.authorOrganization || 'Chưa xác định',
      issuingAuthority: d.authorOrganization || 'Chưa xác định',
      validityPeriod: d.validityPeriod || 'Theo quy định hiện hành',
      status: 'DRAFT' as const,
      profileGenerated: false,
      chunks,
      contentText,
      soilManagement: {
        soilType,
        heavyMetalLimits,
        isolationDistance,
        soilPreparation
      },
      waterManagement: {
        waterSourceStandard,
        eColiLimit,
        phWaterRange,
        irrigationMethod
      },
      fertilizerRules: {
        organicRequirements,
        chemicalFertilizerCeiling,
        preHarvestIntervalDays,
        forbiddenFertilizers
      },
      pestManagementIPM: {
        ipmPrinciples,
        permittedBioPesticides,
        isolationQuarantineDays,
        prohibitedChemicals
      },
      climateRequirements: {
        tempOptimal,
        moistureOptimal,
        pHOptimal,
        ecOptimal,
        luxOptimal: 'Không có trong tài liệu',
        growthDays,
        harvestNoticeDays: preHarvestIntervalDays
      },
      harvestSafety: {
        harvestToolsStandard: findSnippet(['thu hái', 'dụng cụ', 'kéo cắt']) || 'Không có trong tài liệu',
        waterWashingStandard: findSnippet(['nước rửa', 'qcvn 01']) || 'Không có trong tài liệu',
        packagingMaterial: findSnippet(['bao bì', 'tem', 'đóng gói']) || 'Không có trong tài liệu',
        traceabilityQr: findSnippet(['truy xuất', 'qr', 'mã số']) || 'Không có trong tài liệu'
      },
      stagesOverview
    };
  };

  const handleSelectDocument = async (doc: VietGapRegulationDetail) => {
    setSelectedDoc(doc);
    try {
      setIsLoadingDetail(true);
      const detail = await knowledgeService.getDocument(doc.id);
      if (detail) {
        const enriched = deriveVietGapDetails(detail, detail);
        setSelectedDoc(enriched);
        setDocuments(prev => prev.map(d => d.id === doc.id ? enriched : d));
      }
    } catch (err) {
      console.warn('Lỗi tải chi tiết tài liệu từ DB:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadBackendDocuments = async () => {
    try {
      const backendDocs = await knowledgeService.getDocuments();
      if (backendDocs && backendDocs.length > 0) {
        const mapped = backendDocs.map((d: any) => deriveVietGapDetails(d));
        setDocuments(mapped);

        // Nạp chi tiết và các đoạn chunks thực tế từ DB cho tài liệu đầu tiên
        const first = mapped[0];
        setSelectedDoc(first);
        try {
          setIsLoadingDetail(true);
          const detail = await knowledgeService.getDocument(first.id);
          if (detail) {
            const enrichedFirst = deriveVietGapDetails(detail, detail);
            setSelectedDoc(enrichedFirst);
            setDocuments(prev => prev.map(d => d.id === first.id ? enrichedFirst : d));
          }
        } catch (e) {
          console.warn('Lỗi nạp chi tiết ban đầu:', e);
        } finally {
          setIsLoadingDetail(false);
        }
      }
    } catch (e) {
      console.warn('Không tải được tài liệu RAG từ backend:', e);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.cropName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toUpperCase();
    const isPDF = ext === 'PDF';
    const isDOCX = ext === 'DOCX';
    const isTXT = ext === 'TXT';

    if (!isPDF && !isDOCX && !isTXT) {
      setNotification({ type: 'error', message: 'Vui lòng chỉ tải lên tệp định dạng .PDF, .DOCX hoặc .TXT (.DOC cũ không được hỗ trợ)' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setNotification({ type: 'error', message: 'Dung lượng tệp vượt quá giới hạn tối đa 15 MB!' });
      return;
    }

    setSelectedUploadFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setUploadFormData(prev => ({
      ...prev,
      fileName: file.name,
      fileType: isPDF ? 'PDF' : isDOCX ? 'DOCX' : 'TXT',
      fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      title: prev.title || `Quy chuẩn kỹ thuật VietGAP canh tác - ${cleanName}`,
      cropName: prev.cropName || cleanName
    }));
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      setNotification({ type: 'error', message: 'Vui lòng chọn tệp tài liệu (.pdf, .docx, .txt) để nạp vào hệ thống!' });
      return;
    }
    if (!uploadFormData.title || !uploadFormData.cropName) {
      setNotification({ type: 'error', message: 'Vui lòng nhập tên tài liệu và loại cây trồng liên quan!' });
      return;
    }

    setIsUploading(true);
    let backendDocId: string | null = null;
    try {
      const fd = new FormData();
      fd.append('file', selectedUploadFile);
      fd.append('title', uploadFormData.title.trim());
      fd.append('category', uploadFormData.category || 'general');
      if (uploadFormData.issuingAuthority || uploadFormData.author) {
        fd.append('authorOrganization', (uploadFormData.issuingAuthority || uploadFormData.author).trim());
      }
      if (uploadFormData.cropName) {
        const cropScopeCombined = uploadFormData.cropGroup 
          ? `${uploadFormData.cropName.trim()} (${uploadFormData.cropGroup})`
          : uploadFormData.cropName.trim();
        fd.append('cropScope', cropScopeCombined);
      }
      fd.append('isPublic', 'true');

      const uploadRes = await knowledgeService.uploadDocument(fd);
      if (uploadRes?.id || uploadRes?.documentId) {
        backendDocId = uploadRes.id || uploadRes.documentId;
      }
    } catch (err: any) {
      console.error('Backend RAG upload error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Tải lên tài liệu lên kho tri thức VietGAP thất bại.';
      setNotification({ type: 'error', message: `Lỗi tải lên: ${errMsg}` });
      setIsUploading(false);
      return;
    } finally {
      setIsUploading(false);
    }

    if (!backendDocId) {
      setNotification({ type: 'error', message: 'Máy chủ không phản hồi mã tài liệu sau khi tải lên. Vui lòng thử lại.' });
      return;
    }

    try {
      const detail = await knowledgeService.getDocument(backendDocId);
      const newDoc = deriveVietGapDetails(detail, detail);
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
    } catch {
      await loadBackendDocuments();
    }
    setIsUploadModalOpen(false);
    setSelectedUploadFile(null);
    setNotification({ type: 'success', message: `Đã nạp và lưu thành công hồ sơ chuẩn VietGAP toàn diện: ${uploadFormData.title}` });
  };

  const handleDeleteDocument = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tài liệu quy chuẩn VietGAP này khỏi hệ thống?')) {
      try {
        await knowledgeService.deleteDocument(id);
        const remaining = documents.filter(d => d.id !== id);
        setDocuments(remaining);
        if (selectedDoc?.id === id) {
          setSelectedDoc(remaining[0] || null);
        }
        setNotification({ type: 'success', message: 'Đã xóa tài liệu VietGAP thành công!' });
      } catch (err: any) {
        console.error('Backend delete document error:', err);
        const errMsg = err?.response?.data?.message || err?.message || 'Lỗi kết nối máy chủ';
        setNotification({ type: 'error', message: `Xóa tài liệu thất bại: ${errMsg}` });
      }
    }
  };

  // Kích hoạt Modal chuyển đổi từ VietGAP sang Crop Growth Profile
  const triggerConvertModal = (doc: VietGapRegulationDetail) => {
    setConvertingDoc(doc);
    const matched = crops.find(c => c.name.toLowerCase().includes(doc.cropName.toLowerCase()));
    setSelectedCropForConvert(matched?.cropId || (crops[0]?.cropId || ''));

    const tMin = matched?.optimalTemperatureMin ?? (Number(doc.climateRequirements?.tempOptimal?.split('-')[0]?.replace(/[^0-9.]/g, '')) || 20);
    const tMax = matched?.optimalTemperatureMax ?? (Number(doc.climateRequirements?.tempOptimal?.split('-')[1]?.replace(/[^0-9.]/g, '')) || 28);
    const mMin = matched?.optimalSoilMoistureMin ?? (Number(doc.climateRequirements?.moistureOptimal?.split('-')[0]?.replace(/[^0-9.]/g, '')) || 65);
    const mMax = matched?.optimalSoilMoistureMax ?? (Number(doc.climateRequirements?.moistureOptimal?.split('-')[1]?.replace(/[^0-9.]/g, '')) || 75);
    const pMin = matched?.optimalpHMin ?? (Number(doc.climateRequirements?.pHOptimal?.split('-')[0]?.replace(/[^0-9.]/g, '')) || 6.0);
    const pMax = matched?.optimalpHMax ?? (Number(doc.climateRequirements?.pHOptimal?.split('-')[1]?.replace(/[^0-9.]/g, '')) || 6.8);
    const eMin = matched?.optimalECMin ?? (Number(doc.climateRequirements?.ecOptimal?.split('-')[0]?.replace(/[^0-9.]/g, '')) || 1.8);
    const eMax = matched?.optimalECMax ?? (Number(doc.climateRequirements?.ecOptimal?.split('-')[1]?.replace(/[^0-9.]/g, '')) || 2.5);

    setProfileThresholds({
      tempMin: tMin,
      tempMax: tMax,
      moistMin: mMin,
      moistMax: mMax,
      phMin: pMin,
      phMax: pMax,
      ecMin: eMin,
      ecMax: eMax
    });

    setIsGenerateModalOpen(true);
  };

  // Chuyển đổi và tạo GrowthProfile
  const handleExecuteConvertToProfile = async () => {
    if (!convertingDoc) return;
    setIsProcessing(true);

    try {
      let targetCropId = selectedCropForConvert;

      if (!targetCropId) {
        const newCrop = await cropService.createCrop({
          name: convertingDoc.cropName,
          scientificName: `${convertingDoc.cropName} L.`,
          category: convertingDoc.category,
          growthCycleDays: convertingDoc.climateRequirements.growthDays,
          description: `Giống cây chuẩn hóa từ Quy chuẩn VietGAP ${convertingDoc.code} (${convertingDoc.title})`,
          optimalTemperatureMin: profileThresholds.tempMin,
          optimalTemperatureMax: profileThresholds.tempMax,
          optimalSoilMoistureMin: profileThresholds.moistMin,
          optimalSoilMoistureMax: profileThresholds.moistMax,
          optimalpHMin: profileThresholds.phMin,
          optimalpHMax: profileThresholds.phMax,
          optimalECMin: profileThresholds.ecMin,
          optimalECMax: profileThresholds.ecMax,
          optimalLux: 25000,
          isSystemDefined: true
        });
        targetCropId = newCrop.cropId;
        await loadCrops();
      }

      const profilePayload = {
        cropId: targetCropId,
        name: `Hồ sơ Sinh trưởng VietGAP - ${convertingDoc.cropName}`,
        description: `Kịch bản sinh trưởng vi khí hậu và nhật ký tưới bón đồng bộ từ Tiêu chuẩn ${convertingDoc.code} (Hồ sơ bản nháp DRAFT do quản trị viên thiết lập).`,
        isDefault: true,
        stages: convertingDoc.stagesOverview.map((stg, index) => {
          return {
            stageName: stg.name,
            stageOrder: index + 1,
            durationDays: stg.days,
            description: `Giai đoạn ${stg.name} - Tham chiếu VietGAP: Nhiệt độ ${profileThresholds.tempMin}-${profileThresholds.tempMax}°C, Ẩm đất ${profileThresholds.moistMin}-${profileThresholds.moistMax}%. Phân bón: ${stg.fertilizerAction}. IPM: ${stg.ipmAction}`,
            requirements: [
              { parameterName: 'Temperature', minValue: profileThresholds.tempMin, maxValue: profileThresholds.tempMax, optimalValue: Math.round(((profileThresholds.tempMin + profileThresholds.tempMax) / 2) * 10) / 10, unit: '°C' },
              { parameterName: 'SoilMoisture', minValue: profileThresholds.moistMin, maxValue: profileThresholds.moistMax, optimalValue: Math.round(((profileThresholds.moistMin + profileThresholds.moistMax) / 2) * 10) / 10, unit: '%' },
              { parameterName: 'Ph', minValue: profileThresholds.phMin, maxValue: profileThresholds.phMax, optimalValue: Math.round(((profileThresholds.phMin + profileThresholds.phMax) / 2) * 10) / 10, unit: 'pH' },
              { parameterName: 'Ec', minValue: profileThresholds.ecMin, maxValue: profileThresholds.ecMax, optimalValue: Math.round(((profileThresholds.ecMin + profileThresholds.ecMax) / 2) * 10) / 10, unit: 'mS/cm' }
            ]
          };
        })
      };

      await cropService.createGrowthProfile(profilePayload);

      setDocuments(prev => prev.map(d => d.id === convertingDoc.id ? { ...d, profileGenerated: true, profileId: `GP-${convertingDoc.id}` } : d));

      setNotification({
        type: 'success',
        message: `Đã sinh thành công Hồ sơ Sinh trưởng (Growth Profile) gồm ${convertingDoc.stagesOverview.length} giai đoạn từ Quy chuẩn VietGAP!`
      });
      setIsGenerateModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create growth profile:', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Lỗi khi tạo hồ sơ sinh trưởng';
      setNotification({
        type: 'error',
        message: `Tạo Hồ sơ Sinh trưởng thất bại: ${msg}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Thông báo Alert */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between border shadow-sm ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-sm font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Banner Tiêu Chuẩn VietGAP Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-950 rounded-2xl p-7 text-white shadow-xl relative overflow-hidden border border-emerald-700/40">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <Award size={340} />
        </div>
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <ShieldCheck className="w-4 h-4" /> Hệ Thống Tiêu Chuẩn Nông Nghiệp Tốt Quốc Gia
            </span>
            <span className="text-xs bg-slate-900/80 text-emerald-300 font-mono px-2.5 py-1 rounded-lg border border-emerald-500/30">
              TCVN 11892-1:2017 (Trồng trọt an toàn)
            </span>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/30">
              ISO/IEC 17065
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
            Trung Tâm Quản Lý Dữ Liệu Quy Chuẩn VietGAP
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed mb-6">
            Lưu trữ và kiểm soát toàn diện các quy chuẩn VietGAP bắt buộc: 
            <strong className="text-white"> Đất & Giá thể</strong>, 
            <strong className="text-white"> Nguồn nước tưới & Vi sinh E.Coli/Salmonella</strong>, 
            <strong className="text-white"> Quản lý dịch hại tổng hợp (IPM) & Thời gian cách ly PHI</strong>, 
            <strong className="text-white"> Phân bón an toàn</strong> và 
            <strong className="text-white"> Thu hoạch truy xuất nguồn gốc</strong>. 
            Đồng thời chuyển đổi chính xác thành <strong className="text-emerald-300">Hồ Sơ Sinh Trưởng (Growth Profile)</strong> tự động vận hành trong hệ thống SmartFarm.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <UploadCloud className="w-4 h-4" /> Nạp Tài Liệu VietGAP Mới (PDF/DOCX)
            </button>
            <a
              href="/admin/growth-profiles"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm backdrop-blur border border-white/10 transition-all"
            >
              <Layers className="w-4 h-4" /> Danh Sách Hồ Sơ Sinh Trưởng (Growth Profiles)
            </a>
          </div>
        </div>
      </div>

      {/* 4 Trụ Cột Quy Chuẩn VietGAP (Visual Indicators) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
            <Microscope className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">1. Đất & Giá Thể</div>
            <div className="text-sm font-bold text-slate-200">Giới hạn Kim loại nặng</div>
            <div className="text-[11px] text-emerald-400 font-mono">QCVN 03-MT:2015</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">2. Nguồn Nước Tưới</div>
            <div className="text-sm font-bold text-slate-200">Kiểm soát Vi sinh E.Coli</div>
            <div className="text-[11px] text-cyan-400 font-mono">QCVN 08-MT:2015</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">3. Bảo Vệ Thực Vật (IPM)</div>
            <div className="text-sm font-bold text-slate-200">Thời gian cách ly (PHI)</div>
            <div className="text-[11px] text-amber-400 font-mono">4 Đúng & Cấm thuốc cấm</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/15 text-purple-400">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">4. Thu Hoạch & Truy Xuất</div>
            <div className="text-sm font-bold text-slate-200">Mã QR GTIN-13</div>
            <div className="text-[11px] text-purple-400 font-mono">Nhật ký điện tử VietGAP</div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'DOCUMENTS' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Hồ Sơ Tài Liệu VietGAP ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('CRITERIA_MATRIX')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'CRITERIA_MATRIX' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bảng Ma Trận Đầy Đủ Tiêu Chuẩn
          </button>
          <button
            onClick={() => setActiveTab('IPM_PEST')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'IPM_PEST' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nguyên Tắc IPM & Cách Ly (PHI)
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên cây, mã TCVN, chỉ tiêu..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* VIEW 1: Danh sách tài liệu + Panel Chi tiết đầy đủ thông tin VietGAP */}
      {activeTab === 'DOCUMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột Trái: Danh Sách Tài Liệu (5 phần) */}
          <div className="lg:col-span-5 space-y-3.5">
            {filteredDocs.map((doc) => (
              <div 
                key={doc.id}
                onClick={() => handleSelectDocument(doc)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedDoc?.id === doc.id 
                    ? 'bg-slate-800/90 border-emerald-500 shadow-md ring-1 ring-emerald-500/50' 
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl font-bold text-xs uppercase flex flex-col items-center justify-center w-11 h-12 flex-shrink-0 ${
                    doc.fileType === 'PDF' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    <FileText className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px]">{doc.fileType}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/50">
                        {doc.code}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">• {doc.cropName}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white truncate mb-1">
                      {doc.title}
                    </h4>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Cơ quan: {doc.issuingAuthority}</span>
                      <span>•</span>
                      <span>{doc.fileSize}</span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      {doc.profileGenerated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã sinh Profile
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Chưa sinh Profile
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerConvertModal(doc);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" /> Sinh Profile
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cột Phải: Bảng Chi Tiết Toàn Diện Tiêu Chuẩn VietGAP (7 phần) */}
          <div className="lg:col-span-7">
            {selectedDoc ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-6 shadow-xl">
                {/* Header chi tiết */}
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                      {selectedDoc.code}
                    </span>
                    <span className="text-xs text-slate-400">Hiệu lực: {selectedDoc.validityPeriod}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-snug">{selectedDoc.title}</h3>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                    <span>Đơn vị ban hành: <strong className="text-slate-200">{selectedDoc.issuingAuthority}</strong></span>
                    <span>•</span>
                    <span>Tác giả: <strong className="text-slate-200">{selectedDoc.author}</strong></span>
                  </div>
                </div>

                {/* 1. Đất, Giá thể & Nguồn nước */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-2">
                    <Microscope className="w-4 h-4" /> 1. Kiểm Soát Đất, Giá Thể & Nguồn Nước
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Loại đất & Giá thể:</div>
                      <div className="text-slate-200 leading-relaxed">{selectedDoc.soilManagement.soilType}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Giới hạn Kim loại nặng:</div>
                      <div className="text-amber-300 leading-relaxed">{selectedDoc.soilManagement.heavyMetalLimits}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Tiêu chuẩn Nước & Vi sinh:</div>
                      <div className="text-cyan-300 leading-relaxed">{selectedDoc.waterManagement.waterSourceStandard} • {selectedDoc.waterManagement.eColiLimit}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Khoảng cách cách ly ô nhiễm:</div>
                      <div className="text-slate-200 leading-relaxed">{selectedDoc.soilManagement.isolationDistance}</div>
                    </div>
                  </div>
                </div>

                {/* 2. Quy định Phân bón & Phòng trừ dịch hại IPM */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-400 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> 2. Phân Bón, Thuốc BVTV (IPM) & Thời Gian Cách Ly (PHI)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Quy định Phân bón hữu cơ:</div>
                      <div className="text-slate-200 leading-relaxed">{selectedDoc.fertilizerRules.organicRequirements}</div>
                      <div className="mt-1 text-[11px] text-amber-400 font-medium">Cách ly trước thu hoạch: {selectedDoc.fertilizerRules.preHarvestIntervalDays} ngày</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-slate-400 font-semibold mb-1">Kiểm soát sâu bệnh IPM:</div>
                      <div className="text-slate-200 leading-relaxed">{selectedDoc.pestManagementIPM.ipmPrinciples}</div>
                      <div className="mt-1 text-[11px] text-emerald-400 font-medium">Thuốc sinh học: {selectedDoc.pestManagementIPM.permittedBioPesticides}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300">
                    <strong>Hóa chất cấm tuyệt đối:</strong> {selectedDoc.pestManagementIPM.prohibitedChemicals}
                  </div>
                </div>

                {/* 3. Vi khí hậu & Các giai đoạn sinh trưởng */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-sky-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> 3. Các Giai Đoạn Vận Hành Vi Khí Hậu ({selectedDoc.stagesOverview.length} Giai đoạn)
                    </h4>
                    <span className="text-xs text-purple-300 font-semibold">Chu kỳ: {selectedDoc.climateRequirements.growthDays} ngày</span>
                  </div>

                  <div className="space-y-2">
                    {selectedDoc.stagesOverview.map((stg, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-100">{i + 1}. {stg.name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[11px] border border-emerald-800/50">
                            {stg.days} ngày
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-1.5">
                          <div>Nhiệt độ: <strong className="text-emerald-400">{stg.temp}</strong></div>
                          <div>Độ ẩm: <strong className="text-cyan-400">{stg.moisture}</strong></div>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-500">Tưới & Bón:</span> {stg.fertilizerAction}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          <span className="text-slate-500">IPM / Bảo vệ:</span> {stg.ipmAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Thu hoạch & Bao gói an toàn */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-300 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" /> Vệ Sinh Thu Hoạch & Truy Xuất Nguồn Gốc (QR Code):
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    {selectedDoc.harvestSafety.harvestToolsStandard}. {selectedDoc.harvestSafety.waterWashingStandard}. {selectedDoc.harvestSafety.traceabilityQr}.
                  </p>
                </div>

                {/* 5. Nội dung & Đoạn Trích Xuất RAG Thực Tế Từ Tệp Gốc (PDF / DB Chunks) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> 5. Đoạn Trích Xuất RAG Từ Tệp Gốc & DB ({selectedDoc.chunks?.length || 0} Đoạn)
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {selectedDoc.fileType} • Nguồn: PostgreSQL
                    </span>
                  </div>

                  {isLoadingDetail ? (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      Đang tải trích xuất từ cơ sở dữ liệu...
                    </div>
                  ) : selectedDoc.chunks && selectedDoc.chunks.length > 0 ? (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {selectedDoc.chunks.map((chk) => (
                        <div key={chk.id || chk.chunkIndex} className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs hover:border-emerald-500/40 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Đoạn Trích #{chk.chunkIndex + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {chk.hasEmbedding && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800/60">
                                  Vector Embedding (768d)
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed font-sans whitespace-pre-line bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 mb-2">
                            {chk.content}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {chk.cropTags && (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                                Cây: {chk.cropTags}
                              </span>
                            )}
                            {chk.keywords && (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                                Từ khóa: {chk.keywords}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                      {selectedDoc.contentText ? (
                        <p className="leading-relaxed whitespace-pre-line text-xs text-slate-300">{selectedDoc.contentText}</p>
                      ) : (
                        <p className="italic">Chưa có đoạn băm nhỏ văn bản cho tài liệu này.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Hành động */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => triggerConvertModal(selectedDoc)}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Tạo Growth Profile Từ Tiêu Chuẩn Này
                  </button>
                  <button
                    onClick={() => setIsFullTextModalOpen(true)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400" /> Xem Văn Bản Gốc PDF
                  </button>
                  <button
                    onClick={() => alert(`Bắt đầu tải về tệp gốc ${selectedDoc.fileType}: ${selectedDoc.title}`)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Tải Tệp ({selectedDoc.fileSize})
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Chọn một hồ sơ VietGAP bên trái để xem đầy đủ thông tin kỹ thuật</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Ma Trận Đầy Đủ Tất Cả Tiêu Chuẩn VietGAP */}
      {activeTab === 'CRITERIA_MATRIX' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Ma Trận Đối Chiếu Tiêu Chuẩn VietGAP Toàn Diện (TCVN 11892-1:2017)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tổng hợp toàn bộ chỉ tiêu Đất, Nước, Phân bón, IPM và Ngưỡng thu hoạch cho từng giống cây</p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Thêm Quy Chuẩn Cây Mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Tên Cây / Mã TCVN</th>
                  <th className="py-3.5 px-4">Đất & Kim Loại Nặng</th>
                  <th className="py-3.5 px-4">Nước Tưới & Vi Sinh</th>
                  <th className="py-3.5 px-4">Phân Bón & Cách Ly</th>
                  <th className="py-3.5 px-4">Nguyên Tắc IPM</th>
                  <th className="py-3.5 px-4">Vi Khí Hậu (T° / Ẩm / pH / EC)</th>
                  <th className="py-3.5 px-4 text-right">Chuyển Đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div>{doc.cropName}</div>
                      <div className="text-[11px] font-mono text-emerald-400 font-normal">{doc.code}</div>
                      <div className="text-[10px] text-slate-500">{doc.category}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-200">{doc.soilManagement.soilType}</div>
                      <div className="text-amber-400 font-mono text-[11px] mt-0.5">{doc.soilManagement.heavyMetalLimits}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-cyan-300">{doc.waterManagement.waterSourceStandard}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{doc.waterManagement.eColiLimit}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div>{doc.fertilizerRules.organicRequirements}</div>
                      <div className="text-emerald-400 font-semibold text-[11px] mt-0.5">Cách ly PHI: {doc.fertilizerRules.preHarvestIntervalDays} ngày</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div>{doc.pestManagementIPM.ipmPrinciples}</div>
                      <div className="text-rose-400 text-[11px] mt-0.5">Cấm: {doc.pestManagementIPM.prohibitedChemicals}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>T: <span className="text-emerald-400">{doc.climateRequirements.tempOptimal}</span></div>
                      <div>Ẩm: <span className="text-cyan-400">{doc.climateRequirements.moistureOptimal}</span></div>
                      <div>pH/EC: <span className="text-amber-300">{doc.climateRequirements.pHOptimal} | {doc.climateRequirements.ecOptimal}</span></div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => triggerConvertModal(doc)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Sinh Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Quản Lý IPM & Thời Gian Cách Ly (PHI) */}
      {activeTab === 'IPM_PEST' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-800/40 rounded-2xl p-6">
            <h3 className="font-bold text-amber-300 text-lg flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5" /> Quản Lý Dịch Hại Tổng Hợp (IPM) & Thời Gian Cách Ly (PHI) Theo VietGAP
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed max-w-3xl">
              VietGAP yêu cầu kiểm soát dịch hại ưu tiên bằng biện pháp sinh học, cơ học và thiên địch. 
              Mọi loại thuốc BVTV được phép sử dụng phải tuân thủ nghiêm ngặt <strong>Thời gian cách ly (Pre-Harvest Interval - PHI)</strong> 
              để đảm bảo không còn dư lượng thuốc BVTV vượt ngưỡng an toàn thực phẩm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-white text-base">{doc.cropName}</h4>
                    <span className="text-xs text-emerald-400 font-mono">{doc.code}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PHI: {doc.pestManagementIPM.isolationQuarantineDays} Ngày
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Biện pháp IPM:</span>
                    <span className="text-slate-200">{doc.pestManagementIPM.ipmPrinciples}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Chế phẩm sinh học cho phép:</span>
                    <span className="text-emerald-300">{doc.pestManagementIPM.permittedBioPesticides}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Hoạt chất cấm tuyệt đối:</span>
                    <span className="text-rose-400">{doc.pestManagementIPM.prohibitedChemicals}</span>
                  </div>
                </div>

                <button
                  onClick={() => triggerConvertModal(doc)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Chuyển Sang Kịch Bản Sinh Trưởng
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Upload Tệp VietGAP */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Thêm Dữ Liệu Quy Chuẩn VietGAP Toàn Diện (PDF / DOCX)</h3>
                  <p className="text-xs text-slate-400">Nạp tài liệu kỹ thuật có đầy đủ chỉ tiêu Đất, Nước, Phân bón, IPM</p>
                </div>
              </div>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
              {/* Chọn File */}
              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-5 text-center transition-colors bg-slate-950/40">
                <input
                  type="file"
                  id="vietgap-file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="vietgap-file-input" className="cursor-pointer flex flex-col items-center">
                  <UploadCloud className="w-9 h-9 text-emerald-400 mb-2 animate-bounce" />
                  <span className="text-sm font-semibold text-slate-200">
                    {uploadFormData.fileName ? uploadFormData.fileName : 'Nhấn để chọn tệp tài liệu VietGAP (.PDF, .DOCX, .TXT)'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    {uploadFormData.fileSize !== '0 MB' ? `Dung lượng: ${uploadFormData.fileSize}` : 'Dung lượng tối đa: 15MB'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tiêu đề tài liệu quy chuẩn VietGAP *</label>
                <input
                  type="text"
                  required
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                  placeholder="VD: Quy trình kỹ thuật VietGAP canh tác Ớt chuông ngọt Đà Lạt"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tên cây trồng áp dụng *</label>
                  <input
                    type="text"
                    required
                    value={uploadFormData.cropName}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, cropName: e.target.value })}
                    placeholder="VD: Ớt chuông đỏ"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nhóm cây</label>
                  <select
                    value={uploadFormData.cropGroup}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, cropGroup: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Rau ăn quả">Rau ăn quả</option>
                    <option value="Rau ăn lá">Rau ăn lá</option>
                    <option value="Rau ăn củ">Rau ăn củ</option>
                    <option value="Cây ăn trái">Cây ăn trái</option>
                    <option value="Hoa - Cây cảnh">Hoa - Cây cảnh</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Danh mục kỹ thuật (RAG)</label>
                  <select
                    value={uploadFormData.category}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="general">Quy chuẩn chung (general)</option>
                    <option value="irrigation">Nước & Tưới tiêu (irrigation)</option>
                    <option value="pest">Sâu bệnh & IPM (pest)</option>
                    <option value="nutrition">Dinh dưỡng & Phân bón (nutrition)</option>
                    <option value="climate">Vi khí hậu & Môi trường (climate)</option>
                    <option value="harvest">Thu hoạch & Bảo quản (harvest)</option>
                    <option value="record">Nhật ký & Truy xuất (record)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Mã Quy chuẩn TCVN</label>
                  <input
                    type="text"
                    value={uploadFormData.code}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cơ quan ban hành / Thẩm định</label>
                  <input
                    type="text"
                    value={uploadFormData.issuingAuthority}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, issuingAuthority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Nhóm chỉ tiêu Đất & Nước */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 block text-xs">Chỉ tiêu Đất & Nước (QCVN 03 & 08):</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Giới hạn Kim loại nặng đất:</label>
                    <input
                      type="text"
                      value={uploadFormData.heavyMetalLimits}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, heavyMetalLimits: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Giới hạn Vi sinh nước:</label>
                    <input
                      type="text"
                      value={uploadFormData.eColiLimit}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, eColiLimit: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm Phân bón & IPM */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 block text-xs">Quy định Phân bón & Phòng trừ dịch hại IPM:</span>
                <div>
                  <label className="block text-slate-400 mb-1">Quy định phân bón & cách ly:</label>
                  <input
                    type="text"
                    value={uploadFormData.fertilizerRules}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, fertilizerRules: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Nguyên tắc IPM & cách ly PHI:</label>
                  <input
                    type="text"
                    value={uploadFormData.ipmRules}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, ipmRules: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                  />
                </div>
              </div>

              {/* Chỉ tiêu Vi khí hậu */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Nhiệt độ:</label>
                  <input
                    type="text"
                    value={uploadFormData.tempOptimal}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, tempOptimal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Độ ẩm đất:</label>
                  <input
                    type="text"
                    value={uploadFormData.moistureOptimal}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, moistureOptimal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Độ pH:</label>
                  <input
                    type="text"
                    value={uploadFormData.pHOptimal}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, pHOptimal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Chu kỳ (ngày):</label>
                  <input
                    type="number"
                    value={uploadFormData.growthDays}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, growthDays: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang Nạp & Lập Chỉ Mục RAG...
                    </>
                  ) : (
                    'Lưu & Thẩm Định Toàn Diện VietGAP'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chuyển Đổi Sang Growth Profile */}
      {isGenerateModalOpen && convertingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Tạo Hồ Sơ Sinh Trưởng (Growth Profile)</h3>
                  <p className="text-xs text-slate-400">Trích xuất quy chuẩn VietGAP thành kịch bản giai đoạn tự động</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="text-slate-400">Tài liệu nguồn VietGAP:</div>
                <div className="font-bold text-emerald-300 text-sm">{convertingDoc.title}</div>
                <div className="text-slate-500 font-mono">{convertingDoc.code} • Cây: {convertingDoc.cropName}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Gắn với Cây trồng trong Thư viện giống (Crop ID):
                </label>
                <select
                  value={selectedCropForConvert}
                  onChange={(e) => setSelectedCropForConvert(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-xs"
                >
                  <option value="">-- Tự động tạo Cây Trồng Mới mang tên "{convertingDoc.cropName}" --</option>
                  {crops.map((c) => (
                    <option key={c.cropId} value={c.cropId}>
                      {c.name} ({c.category || 'Mặc định'}) - {c.growthCycleDays || 90} ngày
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Thiết lập ngưỡng vận hành Profile (Quản trị viên tinh chỉnh):</span>
                  <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Bản nháp DRAFT</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Nhiệt độ min (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={profileThresholds.tempMin}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, tempMin: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Nhiệt độ max (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={profileThresholds.tempMax}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, tempMax: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Ẩm đất min (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={profileThresholds.moistMin}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, moistMin: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Ẩm đất max (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={profileThresholds.moistMax}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, moistMax: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">pH tối thiểu</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profileThresholds.phMin}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, phMin: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">pH tối đa</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profileThresholds.phMax}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, phMax: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">EC min (mS/cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profileThresholds.ecMin}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, ecMin: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">EC max (mS/cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profileThresholds.ecMax}
                      onChange={(e) => setProfileThresholds({ ...profileThresholds, ecMax: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-2">
                  Các Giai Đoạn (Growth Stages) Sẽ Được Sinh Tự Động Kèm Kế Hoạch Bón/Tưới & IPM:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {convertingDoc.stagesOverview.map((stg, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200">{i + 1}. {stg.name}</span>
                        <span className="text-emerald-400 font-mono">{stg.days} ngày</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Tưới bón: {stg.fertilizerAction}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  Hồ sơ sau khi sinh sẽ lập tức có mặt tại mục <strong>Hồ Sơ Sinh Trưởng</strong> để Farm Owner gán cho các khu vực nhà màng.
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecuteConvertToProfile}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang Chuyển Đổi...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Xác Nhận Sinh Profile VietGAP
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM TOÀN BỘ VĂN BẢN TRÍCH XUẤT TỪ PDF / DB */}
      {isFullTextModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 mr-2">
                  {selectedDoc.code}
                </span>
                <h3 className="font-bold text-white text-base inline">{selectedDoc.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Định dạng: <strong className="text-slate-200">{selectedDoc.fileType}</strong> • 
                  Cơ quan: <strong className="text-slate-200">{selectedDoc.issuingAuthority}</strong> • 
                  Số đoạn RAG: <strong className="text-emerald-400">{selectedDoc.chunks?.length || 0} đoạn</strong>
                </p>
              </div>
              <button
                onClick={() => setIsFullTextModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line bg-slate-950/80">
              {selectedDoc.contentText || selectedDoc.chunks?.map(c => c.content).join('\n\n---\n\n') || (
                <div className="text-center text-slate-500 py-10">Không có văn bản trích xuất trực tiếp.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900">
              <span className="text-xs text-slate-400">
                Độ dài văn bản: {selectedDoc.contentText?.length || 0} ký tự
              </span>
              <button
                onClick={() => setIsFullTextModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
