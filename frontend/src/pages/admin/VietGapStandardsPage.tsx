import { Link } from 'react-router-dom';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Award, UploadCloud, CheckCircle2, ShieldCheck, 
  ExternalLink, Download, Search, Plus, Trash2, Edit3, ArrowRight,
  Sparkles, Layers, BookOpen, AlertCircle, RefreshCw, Droplets,
  Sprout, Beaker, ShieldAlert, Clock, ChevronDown, ChevronUp,
  FileCheck2, CheckSquare, Bookmark, HeartPulse, Microscope,
  QrCode, PackageCheck, Loader2, Thermometer, Zap
} from 'lucide-react';
import { cropService, knowledgeService } from '../../services';
import { Crop, VietGapStructuredExtraction } from '../../types';
import { checkVietGapCompleteness, MIN_NOTES_FOR_INCOMPLETE_APPROVAL, DOCUMENT_TYPE_INFO, AgricultureDocumentType } from './vietGapCompleteness';
import { canonicalCrop } from './cropNames';

export interface VietGapRegulationDetail {
  id: string;
  code: string;
  version?: string;
  title: string;
  fileName?: string;
  cropName: string;
  category: string;
  fileType: 'PDF' | 'DOCX' | 'TXT';
  isCropStandard?: boolean;
  fileSize: string;
  uploadDate: string;
  author: string;
  issuingAuthority: string;
  validityPeriod: string;
  status: 'VALIDATED' | 'PROCESSING' | 'DRAFT';
  profileGenerated: boolean;
  profileId?: string;
  profileName?: string;
  isThematicStandard?: boolean;
  chunks?: { id: string; chunkIndex: number; content: string; cropTags: string; keywords: string; hasEmbedding: boolean }[];
  contentText?: string;
  reviewStatus: 'PendingReview' | 'Approved' | 'NeedsCorrection' | string;
  reviewNotes?: string;
  hasOriginalFile: boolean;

  // 1. Quản lý Đất & Giá thể
  soilManagement: {
    soilType: string;
    heavyMetalLimits: string; // Giới hạn kim loại nặng (As, Pb, Cd, Hg)
    isolationDistance: string; // Khoảng cách cách ly vùng ô nhiễm
    soilPreparation: string; // Kỹ thuật xử lý đất/giá thể trước khi trồng
  };

  // 2. Quản lý Nước tưới & Dinh dưỡng
  waterManagement: {
    waterSourceStandard: string; // Nguồn nước theo quy chuẩn áp dụng đã xác minh
    eColiLimit: string; // Giới hạn vi sinh vật E.Coli & Salmonella
    phWaterRange: string;
    irrigationMethod: string; // Phương pháp tưới (nhỏ giọt/phun mưa)
  };

  // 3. Quy trình Sử dụng Phân bón
  fertilizerRules: {
    organicRequirements: string; // Quy định phân hữu cơ hoai mục
    chemicalFertilizerCeiling: string; // Ngưỡng N-P-K tối đa
    preHarvestIntervalDays: number | null; // Thời gian cách ly phân bón trước thu hoạch
    forbiddenFertilizers: string; // Phân bón cấm sử dụng
  };

  // 4. Bảo vệ Thực vật & Kiểm soát Sâu bệnh (IPM)
  pestManagementIPM: {
    ipmPrinciples: string; // Nguyên tắc phòng trừ dịch hại tổng hợp IPM
    permittedBioPesticides: string; // Thuốc BVTV sinh học được phép
    isolationQuarantineDays: number | null; // Thời gian cách ly thuốc BVTV (PHI)
    prohibitedChemicals: string; // Danh mục hoạt chất cấm tuyệt đối
  };

  // 5. Điều kiện Vi Khí Hậu & Kỹ Thuật Canh Tác
  climateRequirements: {
    tempOptimal: string;
    moistureOptimal: string;
    pHOptimal: string;
    ecOptimal: string;
    luxOptimal: string;
    growthDays: number | null;
    harvestNoticeDays: number | null;
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
    ph?: string;
    ec?: string;
    fertilizerAction: string;
    ipmAction: string;
    evidence?: string; // Câu trích nguyên văn chứng minh giai đoạn
    page?: number;
  }[];

  // Câu trích nguyên văn (và số trang) cho từng trường, theo khóa của mẫu trích xuất ở backend.
  evidence: Record<string, { quote: string; page?: number }>;
  extractionStatus: 'extracted' | 'not_extracted';
  extractedBy?: string;
  extraction?: VietGapStructuredExtraction | null; // Kết quả gốc để hiển thị thời điểm, phiên bản và số liệu kiểm chứng
  documentType: AgricultureDocumentType;
  rawCategory: string; // Category gốc (irrigation, pest...) — quyết định chuyên đề của tài liệu Thematic
  topics: string; // Các mảng tài liệu bao quát, phân tách bằng dấu phẩy
  detectedTopics: string; // Mảng hệ thống nhận diện từ nội dung các đoạn
  cropScope: string; // Phạm vi cây trồng gốc (có thể nhiều cây, phân tách bằng dấu phẩy)
}

// Lỗi tải tài liệu: 503 = chưa xác minh được; 422 được giữ để hiển thị lỗi từ backend cũ.
const describeIngestError = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  if (err?.response?.status === 422) {
    const items: string[] = [...(data?.missingRequirements || []), ...(data?.issues || [])];
    const kind = data?.documentType ? ` (${data.documentType})` : '';
    return `Backend từ chối lưu tài liệu vì chưa đủ thông tin${kind}. Hãy cập nhật backend để lưu vào trạng thái chờ rà soát.`
      + (items.length ? ` Cần bổ sung: ${items.map(i => `• ${i}`).join(' ')}` : '')
      + (data?.summary ? ` — ${data.summary}` : '');
  }
  if (err?.response?.status === 503) return data?.detail || 'Chưa xác minh được tài liệu bằng AI; tài liệu chưa được lưu. Vui lòng thử lại sau.';
  return data?.detail || data?.message || err?.message || fallback;
};

// Nguồn của một trường: số trang, kèm câu trích khi giá trị là số liệu rút ra từ câu đó (giá trị chữ đã chính là câu trích).
const SourceTag: React.FC<{ doc: VietGapRegulationDetail; field: string }> = ({ doc, field }) => {
  const source = doc.evidence?.[field];
  if (!source) return null;
  return (
    <div className="mt-1 text-[10px] text-slate-500 italic" title={source.quote}>
      Nguồn{source.page ? `: trang ${source.page}` : ''}
      {/(?:Optimal|Range|Days)$/.test(field) &&<> · “{source.quote.length > 160 ? source.quote.slice(0, 160) + '…' : source.quote}”</>}
    </div>
  );
};

// Chủ đề tài liệu (khớp TopicClassifier ở backend).
const TOPIC_OPTIONS = [
  { value: 'soil', label: 'Đất / giá thể' },
  { value: 'irrigation', label: 'Tưới & nguồn nước' },
  { value: 'nutrition', label: 'Phân bón' },
  { value: 'pest', label: 'Sâu bệnh / IPM' },
  { value: 'climate', label: 'Khí hậu / thời vụ' },
  { value: 'harvest', label: 'Thu hoạch & sơ chế' },
  { value: 'record', label: 'Ghi chép & truy xuất' },
];

// Phiên bản quy tắc kiểm chứng hiện hành (VietGapStructuredExtractor.RulesVersion ở backend).
const EXTRACTION_RULES_VERSION = 2;

const NOT_EXTRACTED_TEXT = '[Chưa trích xuất — bấm "Trích xuất bằng AI"]';
const MISSING_IN_SOURCE_TEXT = '[Không có trong tài liệu]';

// Số ngày không có trong tài liệu nguồn phải hiển thị là thiếu, không phải "0 ngày".
const formatDays = (days: number | null | undefined): string =>
  days == null ? '[chưa có trong tài liệu]' : `${days} ngày`;

export interface EditableGrowthStage {
  stageOrder: number;
  name: string;
  durationDays: number;
  tempMin: number;
  tempMax: number;
  tempOptimal: number;
  moistMin: number;
  moistMax: number;
  moistOptimal: number;
  phMin: number;
  phMax: number;
  phOptimal?: number;
  ecMin: number;
  ecMax: number;
  ecOptimal?: number;
  airHumidityMin?: number;
  airHumidityMax?: number;
  airHumidityOptimal?: number;
  lightMin?: number;
  lightMax?: number;
  lightOptimal?: number;
  description: string;
  fertilizerAction: string;
  ipmAction: string;
}

export const VietGapStandardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'CRITERIA_MATRIX' | 'IPM_PEST' | 'SOIL_WATER' | 'HARVEST_TRACE'>('DOCUMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<VietGapRegulationDetail | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [growthProfiles, setGrowthProfiles] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedCropForConvert, setSelectedCropForConvert] = useState<string>('');
  const [convertingDoc, setConvertingDoc] = useState<VietGapRegulationDetail | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<'ALL' | 'IPM' | 'SOIL' | 'HARVEST'>('ALL');
  const [matrixFilter, setMatrixFilter] = useState<'CROPS_ONLY' | 'ALL'>('CROPS_ONLY');
  const [docFilter, setDocFilter] = useState<'CROPS_ONLY' | 'ALL' | 'BY_CROP'>('CROPS_ONLY');
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);

  // Quản lý giai đoạn sinh trưởng tùy biến & Kiểm duyệt cuối
  const [editableStages, setEditableStages] = useState<EditableGrowthStage[]>([]);
  const [convertStep, setConvertStep] = useState<'BUILDER' | 'REVIEW'>('BUILDER');
  const [activeStagePreset, setActiveStagePreset] = useState<number>(4);
  const [reviewerName, setReviewerName] = useState('Quản trị viên Kỹ thuật Nông nghiệp (Platform Admin)');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [aiSourceEvidence, setAiSourceEvidence] = useState<string[]>([]);
  const [reviewerConfirmed, setReviewerConfirmed] = useState(false);
  const [isAiDraftingProfile, setIsAiDraftingProfile] = useState(false);
  const [isFallbackProfile, setIsFallbackProfile] = useState(false);
  const [customProfileName, setCustomProfileName] = useState('');

  // Quản lý Cập nhật & Nâng cấp phiên bản tài liệu (V1 -> V2)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updatingDoc, setUpdatingDoc] = useState<VietGapRegulationDetail | null>(null);
  const [updateFormData, setUpdateFormData] = useState({
    title: '',
    version: 'V2.0',
    author: '',
    category: 'general',
    cropScope: '',
    contentText: ''
  });
  const [selectedUpdateFile, setSelectedUpdateFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Quản lý Soạn Thảo Tài Liệu Bằng AI (AI Document Drafting & Review)
  const [isAiDraftModalOpen, setIsAiDraftModalOpen] = useState(false);
  const [aiDraftStep, setAiDraftStep] = useState<'PROMPT' | 'REVIEW'>('PROMPT');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState({
    cropName: '',
    standardCode: '',
    category: 'general',
    cultivationModel: 'Nhà màng công nghệ cao',
    additionalRequirements: ''
  });
  const [draftResult, setDraftResult] = useState({
    title: '',
    standardCode: '',
    authorOrganization: 'Hệ thống SmartFarm (bản nháp, chưa thẩm định)',
    category: 'general',
    cropScope: '',
    version: '',
    content: ''
  });
  const [draftEditorTab, setDraftEditorTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');

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

  
  const initialUploadFormData = {
    title: '',
    cropName: '',
    cropGroup: 'Rau ăn quả',
    category: 'general',
    documentType: 'OfficialStandard' as AgricultureDocumentType,
    topics: [] as string[],
    code: '',
    version: 'V1.0',
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
    growthDays: null
  };

  // Form nạp tài liệu mới với trường nhập liệu xác thực từ người dùng / tệp tải lên
  const [uploadFormData, setUploadFormData] = useState(initialUploadFormData);

  useEffect(() => {
    loadBackendDocuments();
  }, []);

  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isFullTextModalOpen, setIsFullTextModalOpen] = useState(false);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const reviewChecks = useMemo(
    () => checkVietGapCompleteness(reviewText, selectedDoc?.documentType, selectedDoc?.topics,
      Boolean(selectedDoc?.author && !selectedDoc.author.includes('Chưa xác định'))),
    [reviewText, selectedDoc?.documentType, selectedDoc?.topics, selectedDoc?.author]);
  const missingCriticalChecks = reviewChecks.filter(c => c.isCritical && !c.found);
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false);
  const [isReextracting, setIsReextracting] = useState(false);
  // Growth Profile mặc định gom mọi tài liệu đã duyệt của cây; mỗi tài liệu chỉ cần bổ sung một mảng (thu hoạch, sâu bệnh...).
  const [profileSourceScope, setProfileSourceScope] = useState<'crop' | 'document'>('crop');

  // Trích xuất động thông số VietGAP từ nội dung PDF và cơ sở dữ liệu
  const deriveVietGapDetails = (d: any, detail?: any, currentCrops?: any[], currentProfiles?: any[]): VietGapRegulationDetail => {
    // Toàn bộ văn bản từ tệp PDF/DB (ưu tiên contentText nếu có để tránh lặp trùng nội dung với chunks)
    const chunks = detail?.chunks || d.chunks || [];
    const contentText = detail?.contentText || d.contentText || '';
    const fullText = (contentText && contentText.trim().length > 50)
      ? contentText
      : chunks.map((c: any) => c.content || '').filter(Boolean).join('\n');

    // Các trường VietGAP do backend trích bằng AI. Backend chỉ giữ giá trị có câu trích nguyên văn khớp toàn văn,
    // nên ở đây không tự đoán thêm: trường không có giá trị nghĩa là tài liệu không nêu.
    const extraction: VietGapStructuredExtraction | null = detail?.extraction ?? d.extraction ?? null;
    const fieldOf = (key: string) => extraction?.fields.find(f => f.key === key);
    const textField = (key: string): string =>
      !extraction ? NOT_EXTRACTED_TEXT : (fieldOf(key)?.value ?? MISSING_IN_SOURCE_TEXT);
    const daysField = (key: string): number | null => {
      const n = parseInt(fieldOf(key)?.value ?? '', 10);
      return Number.isFinite(n) ? n : null;
    };
    const evidence: Record<string, { quote: string; page?: number }> = {};
    extraction?.fields.forEach(f => {
      if (f.value && f.evidence) evidence[f.key] = { quote: f.evidence, page: f.page ?? undefined };
    });

    // Khớp loài cây trực tiếp từ danh mục CSDL thực tế
    const cropsToUse = currentCrops || crops;
    const profilesToUse = currentProfiles || growthProfiles;
    const titleLower = (d.title || '').toLowerCase();
    const scopeLower = (d.cropScope || '').toLowerCase();

    let matchedCrop: any = null;
    if (titleLower.includes('dưa lưới') || scopeLower.includes('dưa lưới') || scopeLower.includes('cantaloupe')) {
      matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('dưa lưới'));
    } else if (titleLower.includes('dưa leo') || scopeLower.includes('dưa leo') || scopeLower.includes('cucumber')) {
      if (titleLower.includes('màu') || scopeLower.includes('màu')) {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('màu')) || cropsToUse.find(c => c.name.toLowerCase().includes('dưa leo'));
      } else {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('baby')) || cropsToUse.find(c => c.name.toLowerCase().includes('dưa leo'));
      }
    } else if (titleLower.includes('cà chua') || scopeLower.includes('cà chua') || scopeLower.includes('tomato')) {
      if (titleLower.includes('chuông') || scopeLower.includes('chuông') || titleLower.includes('ớt')) {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('chuong') || c.name.toLowerCase().includes('ớt'));
      } else {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('beefsteak')) || cropsToUse.find(c => c.name.toLowerCase().includes('cà chua'));
      }
    } else if (titleLower.includes('ớt') || scopeLower.includes('ớt') || scopeLower.includes('capsicum')) {
      matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('chuong') || c.name.toLowerCase().includes('ớt'));
    } else if (titleLower.includes('dâu tây') || scopeLower.includes('dâu tây') || scopeLower.includes('strawberry')) {
      matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('dau tay') || c.name.toLowerCase().includes('dâu tây'));
    } else if (titleLower.includes('xà lách') || scopeLower.includes('xà lách') || scopeLower.includes('lettuce')) {
      if (titleLower.includes('thủy canh') || scopeLower.includes('thủy canh')) {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('thủy canh')) || cropsToUse.find(c => c.name.toLowerCase().includes('xà lách'));
      } else {
        matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('cuộn')) || cropsToUse.find(c => c.name.toLowerCase().includes('xà lách'));
      }
    } else if (titleLower.includes('cải') || scopeLower.includes('cải') || scopeLower.includes('mustard')) {
      matchedCrop = cropsToUse.find(c => c.name.toLowerCase().includes('cải'));
    }

    if (!matchedCrop) {
      matchedCrop = cropsToUse.find(c => {
        const cNameClean = c.name.toLowerCase().split('(')[0].trim();
        return (cNameClean.length > 2 && (titleLower.includes(cNameClean) || scopeLower.includes(cNameClean)));
      });
    }

    const isThematic = ['irrigation', 'nutrition', 'record', 'harvest', 'climate'].includes(d.category) ||
                       (d.category === 'pest' && (d.cropScope || '').includes(','));
    const isCropStandard = !isThematic && (Boolean(d.cropScope && !d.cropScope.includes(',')) || titleLower.includes('canh tác') || Boolean(matchedCrop));
    const cropName = matchedCrop ? matchedCrop.name : (d.cropScope ? d.cropScope.split(',')[0].trim() : d.title);
    const categoryDisplay = matchedCrop?.category || d.category || 'Quy chuẩn nông nghiệp';

    // Tài liệu nguồn mới là khóa liên kết; không phụ thuộc crop mapping vì profile có thể gắn với cây được chọn thủ công.
    const sourceMarker = `[sourceDocument:${d.id}]`;
    const matchedProfile = profilesToUse.find((p: any) =>
      typeof p.description === 'string' && p.description.includes(sourceMarker)
    );

    // 1. Quản lý Đất & Giá thể
    const soilType = textField('soilType');
    const heavyMetalLimits = textField('heavyMetalLimits');
    const isolationDistance = textField('isolationDistance');
    const soilPreparation = textField('soilPreparation');

    // 2. Quản lý Nước tưới
    const waterSourceStandard = textField('waterSourceStandard');
    const eColiLimit = textField('eColiLimit');
    const phWaterRange = textField('phWaterRange');
    const irrigationMethod = textField('irrigationMethod');

    // 3. Phân bón
    const organicRequirements = textField('organicRequirements');
    const chemicalFertilizerCeiling = textField('chemicalFertilizerCeiling');
    const preHarvestIntervalDays = daysField('fertilizerPreHarvestDays');
    const forbiddenFertilizers = textField('forbiddenFertilizers');

    // 4. Bảo vệ thực vật & IPM
    const ipmPrinciples = textField('ipmPrinciples');
    const permittedBioPesticides = textField('permittedBioPesticides');
    const isolationQuarantineDays = daysField('pesticidePreHarvestDays');
    const prohibitedChemicals = textField('prohibitedChemicals');

    // 5. Vi khí hậu & chu kỳ (chu kỳ ưu tiên theo tài liệu, sau đó mới tới bản ghi Crop trong CSDL)
    const tempOptimal = textField('tempOptimal');
    const moistureOptimal = textField('moistureOptimal');
    const pHOptimal = textField('phOptimal');
    const ecOptimal = textField('ecOptimal');
    const luxOptimal = textField('luxOptimal');
    const growthDays: number | null = daysField('growthCycleDays') ?? (matchedCrop?.growthCycleDays || null);

    // 6. Thu hoạch, sơ chế & truy xuất
    const harvestToolsStandard = textField('harvestToolsStandard');
    const waterWashingStandard = textField('waterWashingStandard');
    const packagingMaterial = textField('packagingMaterial');
    const traceabilityQr = textField('traceabilityQr');

    // 7. Giai đoạn sinh trưởng: chỉ những giai đoạn tài liệu nêu tên trong câu trích
    const stagesOverview = (extraction?.stages ?? []).map(s => ({
      name: s.name,
      days: s.durationDays ?? 0,
      temp: s.temperatureRange ?? tempOptimal,
      moisture: s.moistureRange ?? moistureOptimal,
      ph: s.ph ?? pHOptimal,
      ec: s.ec ?? ecOptimal,
      fertilizerAction: s.fertilizerAction ?? MISSING_IN_SOURCE_TEXT,
      ipmAction: s.ipmAction ?? MISSING_IN_SOURCE_TEXT,
      evidence: s.evidence,
      page: s.page ?? undefined
    }));

    return {
      id: d.id,
      code: d.standardCode || fullText.match(/TCVN\s*\d+[-–]\d+:\d{4}/i)?.[0] || 'Chưa xác định',
      version: d.version || 'V2.0',
      title: d.title,
      fileName: d.fileName || undefined,
      cropName,
      category: categoryDisplay,
      isCropStandard,
      fileType: (d.fileType?.toUpperCase() === 'DOCX' ? 'DOCX' : d.fileType?.toUpperCase() === 'TXT' ? 'TXT' : 'PDF') as 'PDF' | 'DOCX' | 'TXT',
      fileSize: `${chunks.length || d.chunkCount || 1} đoạn RAG`,
      uploadDate: d.createdAtUtc ? new Date(d.createdAtUtc).toLocaleDateString('vi-VN') : 'Mặc định',
      author: d.authorOrganization || 'Chưa xác định nguồn ban hành',
      issuingAuthority: d.authorOrganization || 'Chưa xác định nguồn ban hành',
      validityPeriod: d.validityPeriod || 'Theo niên vụ canh tác',
      status: (d.status === 'VALIDATED' ? 'VALIDATED' : 'DRAFT') as 'VALIDATED' | 'DRAFT',
      reviewStatus: d.reviewStatus || 'PendingReview',
      documentType: (d.documentType || 'OfficialStandard') as AgricultureDocumentType,
      rawCategory: d.category || 'general',
      topics: d.topics || '',
      detectedTopics: d.detectedTopics || '',
      cropScope: d.cropScope || '',
      reviewNotes: d.reviewNotes || undefined,
      hasOriginalFile: Boolean(d.hasOriginalFile),
      profileGenerated: Boolean(matchedProfile),
      profileId: matchedProfile ? ((matchedProfile as any).profileId || (matchedProfile as any).id) : (d.profileId || undefined),
      profileName: matchedProfile ? (matchedProfile as any).name : undefined,
      isThematicStandard: isThematic,
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
        luxOptimal,
        growthDays,
        harvestNoticeDays: preHarvestIntervalDays
      },
      harvestSafety: {
        harvestToolsStandard,
        waterWashingStandard,
        packagingMaterial,
        traceabilityQr
      },
      stagesOverview,
      evidence,
      extractionStatus: extraction ? 'extracted' : 'not_extracted',
      extractedBy: extraction?.extractedBy,
      extraction
    };
  };

  const handleSelectDocument = async (doc: VietGapRegulationDetail) => {
    setIsReviewPanelOpen(false);
    setReviewConfirmed(false);
    setSelectedDoc(doc);
    try {
      setIsLoadingDetail(true);
      const detail = await knowledgeService.getDocument(doc.id);
      if (detail) {
        const enriched = deriveVietGapDetails(detail, detail, crops, growthProfiles);
        setSelectedDoc(enriched);
        setDocuments(prev => prev.map(d => d.id === doc.id ? enriched : d));
      }
    } catch (err) {
      console.warn('Lỗi tải chi tiết tài liệu từ DB:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadCrops = async () => {
    try {
      const res = await cropService.getCrops();
      setCrops(res || []);
      return res || [];
    } catch {
      return [];
    }
  };

  const loadBackendDocuments = async () => {
    try {
      const [cropsRes, profilesRes, backendDocs] = await Promise.allSettled([
        cropService.getCrops(),
        cropService.getAllGrowthProfiles(),
        knowledgeService.getDocuments()
      ]);

      const loadedCrops = cropsRes.status === 'fulfilled' ? (cropsRes.value || []) : [];
      const loadedProfiles = profilesRes.status === 'fulfilled' ? (profilesRes.value || []) : [];
      const loadedDocs = backendDocs.status === 'fulfilled' ? (backendDocs.value || []) : [];

      setCrops(loadedCrops);
      setGrowthProfiles(loadedProfiles);

      if (loadedDocs && loadedDocs.length > 0) {
        const mapped = loadedDocs.map((d: any) => deriveVietGapDetails(d, undefined, loadedCrops, loadedProfiles));
        setDocuments(mapped);

        // Nạp chi tiết và các đoạn chunks thực tế từ DB cho tài liệu đầu tiên
        const first = mapped[0];
        setSelectedDoc(first);
        try {
          setIsLoadingDetail(true);
          const detail = await knowledgeService.getDocument(first.id);
          if (detail) {
            const enrichedFirst = deriveVietGapDetails(detail, detail, loadedCrops, loadedProfiles);
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

  const cropDocsCount = documents.filter(d => !d.isThematicStandard).length;
  const generatedProfileCount = documents.filter(d => !d.isThematicStandard && d.profileGenerated).length;

  // Một cây trồng có thể có nhiều tài liệu VietGAP, mỗi tài liệu bổ sung một mảng (đất, sâu bệnh, thu hoạch...).
  // Số tài liệu phải là số thật: tên cây được chuẩn hóa (Lettuce/Batavia/Xa lach → Xà lách), tài liệu dùng chung cho
  // nhiều cây được đếm riêng, và tài liệu chưa ghi cây trồng không bị lấy tiêu đề làm tên cây.
  const SHARED_DOC_MIN_CROPS = 3;
  const cropGroups = useMemo(() => {
    const catalog = crops.map(c => c.name);
    const cropsOf = (doc: VietGapRegulationDetail) =>
      [...new Set((doc.cropScope || '').split(',').map(c => canonicalCrop(c, catalog)).filter((c): c is string => Boolean(c)))];

    const own = new Map<string, VietGapRegulationDetail[]>();
    const shared = new Map<string, VietGapRegulationDetail[]>();
    const sharedDocs: VietGapRegulationDetail[] = [];
    const untagged: VietGapRegulationDetail[] = [];
    documents.forEach(doc => {
      const docCrops = cropsOf(doc);
      if (docCrops.length === 0) { untagged.push(doc); return; }
      const target = docCrops.length >= SHARED_DOC_MIN_CROPS ? shared : own;
      if (target === shared) sharedDocs.push(doc);
      docCrops.forEach(crop => target.set(crop, [...(target.get(crop) ?? []), doc]));
    });

    const topicsOf = (d: VietGapRegulationDetail) =>
      new Set([...(d.topics || '').split(','), ...(d.detectedTopics || '').split(','), d.rawCategory].map(t => t.trim()).filter(t => t && t !== 'general'));
    const coverageStatus = (docs: VietGapRegulationDetail[], topic: string) => {
      const withTopic = docs.filter(d => topicsOf(d).has(topic));
      return withTopic.some(d => d.reviewStatus === 'Approved') ? 'approved'
        : withTopic.some(d => d.reviewStatus === 'PendingReview' || d.reviewStatus === 'NeedsCorrection') ? 'pending'
        : 'missing';
    };

    const names = new Set([...own.keys(), ...shared.keys()]);
    const groups = [...names].map(name => {
      const docs = own.get(name) ?? [];
      const sharedForCrop = shared.get(name) ?? [];
      // Mảng có tài liệu riêng đã duyệt / chỉ có tài liệu dùng chung / chỉ có tài liệu chờ duyệt / chưa có.
      const coverage = TOPIC_OPTIONS.map(t => {
        const ownStatus = coverageStatus(docs, t.value);
        const status = ownStatus === 'approved' ? 'approved'
          : coverageStatus(sharedForCrop, t.value) === 'approved' ? 'shared'
          : ownStatus;
        return { ...t, status };
      });
      return {
        name, docs, sharedDocs: sharedForCrop, coverage,
        approvedCount: docs.filter(d => d.reviewStatus === 'Approved').length,
        sharedApprovedCount: sharedForCrop.filter(d => d.reviewStatus === 'Approved').length,
      };
    }).sort((a, b) => b.docs.length - a.docs.length || a.name.localeCompare(b.name, 'vi'));

    return { groups, sharedDocs, untagged };
  }, [documents, crops]);

  const openCropProfile = (group: { name: string; docs: VietGapRegulationDetail[]; sharedDocs: VietGapRegulationDetail[] }) => {
    const representative = [...group.docs, ...group.sharedDocs].find(d => d.reviewStatus === 'Approved');
    if (!representative) {
      setNotification({ type: 'error', message: `Cây "${group.name}" chưa có tài liệu nào được duyệt. Hãy duyệt tài liệu trước khi tạo Growth Profile.` });
      return;
    }
    // Gom mọi tài liệu đã duyệt của cây làm nguồn (server lọc theo tên cây và các tên gọi khác), không chỉ tài liệu đại diện.
    setProfileSourceScope('crop');
    void triggerConvertModal({ ...representative, cropName: group.name });
  };

  // Kiểm soát tài liệu: thông tin quản lý còn thiếu khiến tài liệu không được đếm/khớp đúng (độ phủ, cây trồng, nguồn).
  const controlIssues = (doc: VietGapRegulationDetail): string[] => {
    const issues: string[] = [];
    if (!(doc.cropScope || '').split(',').some(c => canonicalCrop(c, crops.map(x => x.name))))
      issues.push('Chưa ghi cây trồng nhận diện được');
    if (!doc.topics) issues.push(doc.detectedTopics ? 'Chưa khai báo mảng (đang dùng mảng hệ thống nhận diện)' : 'Chưa khai báo mảng');
    if (!doc.author || doc.author.includes('Chưa xác định')) issues.push('Chưa có đơn vị ban hành');
    return issues;
  };

  const renderDocRow = (doc: VietGapRegulationDetail) => (
    <div key={doc.id} onClick={() => handleSelectDocument(doc)}
      className={`p-2.5 rounded-xl border text-xs cursor-pointer ${selectedDoc?.id === doc.id ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
      <div className="font-bold text-slate-900">{doc.title}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
        <span>{DOCUMENT_TYPE_INFO[doc.documentType]?.label ?? doc.documentType}</span>
        <span>{doc.author}</span>
        {doc.version && <span>Phiên bản {doc.version}</span>}
        <span className={doc.reviewStatus === 'Approved' ? 'text-emerald-700 font-semibold' : doc.reviewStatus === 'Superseded' ? 'text-slate-400' : 'text-amber-700 font-semibold'}>
          {doc.reviewStatus === 'Approved' ? 'Đã duyệt' : doc.reviewStatus === 'Superseded' ? 'Đã bị thay thế' : doc.reviewStatus === 'NeedsCorrection' ? 'Cần chỉnh sửa' : 'Chờ duyệt'}
        </span>
      </div>
      {doc.topics && (
        <div className="mt-1 text-[10px] text-slate-500">
          Mảng: {doc.topics.split(',').map(t => TOPIC_OPTIONS.find(o => o.value === t)?.label ?? t).join(', ')}
        </div>
      )}
      {!doc.topics && doc.detectedTopics && (
        <div className="mt-0.5 text-[10px] text-slate-500">
          Mảng nhận diện từ nội dung: {doc.detectedTopics.split(',').map(t => TOPIC_OPTIONS.find(o => o.value === t)?.label ?? t).join(', ')}
        </div>
      )}
      {doc.cropScope && <div className="mt-0.5 text-[10px] text-slate-400">Phạm vi ghi trong tài liệu: {doc.cropScope}</div>}
      {controlIssues(doc).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {controlIssues(doc).map(issue => (
            <span key={issue} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold">⚠ {issue}</span>
          ))}
        </div>
      )}
    </div>
  );

  const renderCropGroups = () => {
    const { groups, sharedDocs, untagged } = cropGroups;
    const toggle = (key: string) => setExpandedCrop(expandedCrop === key ? null : key);
    return (
      <div className="space-y-3">
        {groups.length === 0 && <p className="text-xs text-slate-500 italic">Chưa có tài liệu nào gắn cây trồng.</p>}
        {groups.map(group => {
          const key = group.name.toLowerCase();
          const isOpen = expandedCrop === key;
          return (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white shadow-xs">
              <button type="button" onClick={() => toggle(key)} className="w-full p-4 flex items-center justify-between gap-2 text-left cursor-pointer">
                <div>
                  <div className="font-extrabold text-slate-900 flex items-center gap-2"><Sprout className="w-4 h-4 text-emerald-600" />{group.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {group.docs.length} tài liệu riêng · {group.approvedCount} đã duyệt
                    {group.sharedDocs.length > 0 && <> · dùng chung {group.sharedDocs.length} tài liệu ({group.sharedApprovedCount} đã duyệt)</>}
                  </div>
                  {group.docs.filter(d => controlIssues(d).length > 0).length > 0 && (
                    <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      ⚠ {group.docs.filter(d => controlIssues(d).length > 0).length} tài liệu riêng cần bổ sung thông tin quản lý
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {group.coverage.map(c => (
                  <span key={c.value}
                    title={c.status === 'approved' ? 'Có tài liệu riêng đã duyệt' : c.status === 'shared' ? 'Chỉ có tài liệu dùng chung đã duyệt' : c.status === 'pending' ? 'Chỉ có tài liệu đang chờ duyệt' : 'Chưa có tài liệu'}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                      c.status === 'approved' ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : c.status === 'shared' ? 'bg-sky-50 border-sky-300 text-sky-800'
                      : c.status === 'pending' ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    {c.status === 'approved' ? '✓' : c.status === 'shared' ? '◇' : c.status === 'pending' ? '…' : '–'} {c.label}
                  </span>
                ))}
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 p-3 space-y-2">
                  {group.docs.length === 0 && <p className="text-[11px] text-slate-500 italic">Chưa có tài liệu riêng cho cây này.</p>}
                  {group.docs.map(renderDocRow)}
                  {group.sharedDocs.length > 0 && (
                    <p className="text-[11px] text-slate-500">+ {group.sharedDocs.length} tài liệu dùng chung (xem mục "Tài liệu dùng chung" bên dưới).</p>
                  )}
                  <button type="button" onClick={() => openCropProfile(group)} disabled={group.approvedCount + group.sharedApprovedCount === 0}
                    className="w-full mt-1 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
                    Tạo Growth Profile cho {group.name} ({group.approvedCount} riêng + {group.sharedApprovedCount} dùng chung đã duyệt)
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Profile chỉ được tạo khi các tài liệu đã duyệt cùng cung cấp đủ giai đoạn và ngưỡng có trích dẫn; thiếu thì hệ thống báo, không điền số mẫu.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {sharedDocs.length > 0 && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/40">
            <button type="button" onClick={() => toggle('__shared')} className="w-full p-4 flex items-center justify-between text-left cursor-pointer">
              <div>
                <div className="font-extrabold text-slate-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-sky-600" />Tài liệu dùng chung</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{sharedDocs.length} tài liệu áp dụng cho từ {SHARED_DOC_MIN_CROPS} cây trở lên · đếm một lần</div>
              </div>
              {expandedCrop === '__shared' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {expandedCrop === '__shared' && <div className="border-t border-sky-100 p-3 space-y-2">{sharedDocs.map(renderDocRow)}</div>}
          </div>
        )}

        {untagged.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40">
            <button type="button" onClick={() => toggle('__untagged')} className="w-full p-4 flex items-center justify-between text-left cursor-pointer">
              <div>
                <div className="font-extrabold text-slate-900 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-600" />Chưa gắn cây trồng</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{untagged.length} tài liệu không ghi cây trồng nhận diện được · cần bổ sung phạm vi áp dụng</div>
              </div>
              {expandedCrop === '__untagged' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {expandedCrop === '__untagged' && <div className="border-t border-amber-100 p-3 space-y-2">{untagged.map(renderDocRow)}</div>}
          </div>
        )}
      </div>
    );
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.cropName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (docFilter === 'CROPS_ONLY') {
      return !doc.isThematicStandard;
    }
    return true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toUpperCase();
    const isPDF = ext === 'PDF';
    const isDOCX = ext === 'DOCX';
    const isTXT = ext === 'TXT';

    if (!isPDF && !isDOCX && !isTXT) {
      setSelectedUploadFile(null);
      e.target.value = '';
      setNotification({ type: 'error', message: 'Vui lòng chỉ tải lên tệp định dạng .PDF, .DOCX hoặc .TXT (.DOC cũ không được hỗ trợ)' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setSelectedUploadFile(null);
      e.target.value = '';
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
      title: prev.title || cleanName,
      cropName: prev.cropName || (/cà\s*chua/i.test(cleanName) ? 'cà chua' : '')
    }));
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUploading(true);
    let backendDocId: string | null = null;
    let savedTitle = '';
    let requiresManualReview = true;
    let nearDuplicateNote = '';
    try {
      const fileToSend = selectedUploadFile;
      if (!fileToSend) {
        setNotification({
          type: 'error',
          message: 'Vui lòng đính kèm tệp văn bản quy chuẩn thực tế (PDF, DOCX hoặc TXT) để tải lên kho tri thức VietGAP!'
        });
        setIsUploading(false);
        return;
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      // Cho phép admin sửa metadata khi OCR/nhận diện từ tài liệu không chính xác.
      if (uploadFormData.title.trim()) fd.append('title', uploadFormData.title.trim());
      if (uploadFormData.cropName.trim()) fd.append('cropScope', uploadFormData.cropName.trim());
      if (uploadFormData.author.trim()) fd.append('authorOrganization', uploadFormData.author.trim());
      if (uploadFormData.version.trim()) fd.append('version', uploadFormData.version.trim());
      fd.append('category', uploadFormData.category || 'general');
      fd.append('documentType', uploadFormData.documentType);
      uploadFormData.topics.forEach(t => fd.append('topics', t));
      fd.append('isPublic', 'true');

      const uploadRes = await knowledgeService.uploadDocument(fd);
      if (uploadRes?.id || uploadRes?.documentId) {
        backendDocId = uploadRes.id || uploadRes.documentId;
        savedTitle = uploadRes.title || selectedUploadFile?.name || '';
        requiresManualReview = String(uploadRes.reviewNotes || '').includes('[Chờ người duyệt]');
        nearDuplicateNote = String(uploadRes.reviewNotes || '').match(/\[Có thể trùng với tài liệu đã có\][^.]*\./)?.[0] || '';
      }
    } catch (err: any) {
      // 422 là kết quả kiểm tra "chưa đủ thông tin" (nghiệp vụ), không phải sự cố hệ thống.
      // 409 trùng nội dung: mở tài liệu đã có để sửa/duyệt tiếp thay vì tải lại.
      const existingId = err?.response?.status === 409 ? err.response.data?.existingDocumentId : undefined;
      if (existingId) {
        const existing = documents.find(d => d.id === existingId);
        setIsUploadModalOpen(false);
        setSelectedUploadFile(null);
        if (existing) void handleSelectDocument(existing);
        setNotification({ type: 'error', message: `${err.response.data?.detail || 'Tài liệu đã có trong kho.'} Đã mở tài liệu đó.` });
        setIsUploading(false);
        return;
      }
      if (err?.response?.status === 422) {
        console.info('Tài liệu bị từ chối vì chưa đủ thông tin:', err.response.data?.missingRequirements);
      } else {
        console.error('Backend RAG upload error:', err);
      }
      setNotification({ type: 'error', message: describeIngestError(err, 'Tải lên tài liệu lên kho tri thức VietGAP thất bại.') });
      setIsUploading(false);
      return;
    } finally {
      setIsUploading(false);
    }

    if (!backendDocId) {
      setNotification({ type: 'error', message: 'Máy chủ không phản hồi mã tài liệu sau khi tải lên. Vui lòng thử lại.' });
      return;
    }

    let wasOcrProcessed = false;
    try {
      const detail = await knowledgeService.getDocument(backendDocId);
      const newDoc = deriveVietGapDetails(detail, detail);
      requiresManualReview = String(detail.reviewNotes || '').startsWith('[Chờ người duyệt]');
      wasOcrProcessed = newDoc.contentText?.startsWith('[OCR bằng AI từ PDF scan') === true;
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setIsReviewPanelOpen(false);
      setReviewText(newDoc.contentText || '');
      setReviewConfirmed(false);
    } catch {
      await loadBackendDocuments();
    }
    setIsUploadModalOpen(false);
    setSelectedUploadFile(null);
    setUploadFormData(initialUploadFormData);
    setNotification({
      type: requiresManualReview ? 'warning' : 'success',
      message: requiresManualReview
        ? `Đã lưu "${savedTitle}" độc lập với Growth Profile ở trạng thái chờ người duyệt. Kiểm tra nguồn và gắn đúng cây trồng; tài liệu chưa được dùng trong RAG cho đến khi duyệt.`
        : wasOcrProcessed
          ? `AI đã xác nhận "${savedTitle}" đủ thông tin; đã OCR và lưu ở trạng thái chờ đối chiếu. Hãy so từng trang với PDF gốc rồi duyệt — tài liệu chỉ vào RAG sau khi được duyệt.`
          : `AI đã xác nhận "${savedTitle}" đủ thông tin; đã lưu ở trạng thái chờ đối chiếu. Hãy rà soát và duyệt — tài liệu chỉ vào RAG sau khi được duyệt.`
    });
    // Bản gần giống không bị chặn: nhắc người duyệt so với tài liệu đã có (bản mới duyệt sẽ thay bản cũ cùng tên).
    if (nearDuplicateNote) {
      setNotification({ type: 'warning', message: `Đã lưu "${savedTitle}". ${nearDuplicateNote} Khi duyệt, hãy chọn giữ bản nào.` });
    }
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

  const triggerUpdateModal = (doc: VietGapRegulationDetail) => {
    setUpdatingDoc(doc);
    // Tự động gợi ý version kế tiếp: vd V1.0 -> V2.0
    const rawVer = doc.version || '1.0';
    const match = rawVer.match(/(\d+(?:\.\d+)?)/);
    const nextVerNum = match ? (parseFloat(match[1]) + 1.0).toFixed(1) : '2.0';
    const suggestedVersion = rawVer.toLowerCase().startsWith('v') ? `V${nextVerNum}` : `V${nextVerNum}`;

    setUpdateFormData({
      title: doc.title,
      version: suggestedVersion,
      author: doc.author || doc.issuingAuthority || '',
      category: doc.category === 'Tưới tiêu' ? 'irrigation' : doc.category === 'Sâu bệnh (IPM)' ? 'pest' : doc.category === 'Dinh dưỡng' ? 'nutrition' : doc.category === 'Vi khí hậu' ? 'climate' : doc.category === 'Thu hoạch' ? 'harvest' : 'general',
      cropScope: doc.cropName === 'Áp dụng chung' ? '' : (doc.cropName || ''),
      contentText: doc.contentText || ''
    });
    setSelectedUpdateFile(null);
    setIsUpdateModalOpen(true);
  };

  const handleUpdateDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingDoc) return;
    setIsUpdating(true);
    try {
      const fd = new FormData();
      fd.append('Title', updateFormData.title.trim());
      fd.append('Version', updateFormData.version.trim());
      if (updateFormData.author.trim()) fd.append('AuthorOrganization', updateFormData.author.trim());
      if (updateFormData.category) fd.append('Category', updateFormData.category);
      if (updateFormData.cropScope.trim()) fd.append('CropScope', updateFormData.cropScope.trim());

      if (selectedUpdateFile) {
        fd.append('File', selectedUpdateFile);
      } else if (updateFormData.contentText.trim().length >= 50) {
        fd.append('ContentText', updateFormData.contentText.trim());
      }

      await knowledgeService.updateDocument(updatingDoc.id, fd);

      setNotification({
        type: 'success',
        message: `Đã cập nhật tài liệu lên phiên bản ${updateFormData.version}. Tài liệu trở về trạng thái chờ đối chiếu; sẽ chỉ vào RAG và sinh profile sau khi được duyệt.`
      });
      setIsReviewPanelOpen(false);
      setIsUpdateModalOpen(false);
      await loadBackendDocuments();
    } catch (err: any) {
      console.error('Update doc error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Lỗi cập nhật tài liệu';
      setNotification({ type: 'error', message: `Cập nhật tài liệu thất bại: ${msg}` });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadDocument = (doc: VietGapRegulationDetail) => {
    const textContent = [
      `================================================================================`,
      `TÀI LIỆU VIETGAP - ${doc.code || 'Mã tiêu chuẩn chưa xác định'}`,
      `================================================================================`,
      `Tên quy chuẩn  : ${doc.title}`,
      `Mã tài liệu    : ${doc.code}`,
      `Phiên bản      : ${doc.version || 'V1.0'}`,
      `Cây trồng      : ${doc.cropName}`,
      `Danh mục       : ${doc.category}`,
      `Đơn vị ban hành: ${doc.issuingAuthority}`,
      `Tác giả        : ${doc.author}`,
      `Ngày cập nhật  : ${doc.uploadDate}`,
      `Hiệu lực       : ${doc.validityPeriod}`,
      `--------------------------------------------------------------------------------`,
      `1. QUẢN LÝ ĐẤT & GIÁ THỂ:`,
      `- Loại đất / Giá thể: ${doc.soilManagement.soilType}`,
      `- Giới hạn kim loại nặng: ${doc.soilManagement.heavyMetalLimits}`,
      `- Khoảng cách ly ô nhiễm: ${doc.soilManagement.isolationDistance}`,
      `- Kỹ thuật xử lý đất/giá thể: ${doc.soilManagement.soilPreparation}`,
      ``,
      `2. QUẢN LÝ NGUỒN NƯỚC TƯỚI:`,
      `- Tiêu chuẩn nước: ${doc.waterManagement.waterSourceStandard}`,
      `- Giới hạn vi sinh (E.Coli/Salmonella): ${doc.waterManagement.eColiLimit}`,
      `- Dải pH nước tưới: ${doc.waterManagement.phWaterRange}`,
      `- Phương pháp tưới: ${doc.waterManagement.irrigationMethod}`,
      ``,
      `3. QUY TRÌNH PHÂN BÓN:`,
      `- Phân bón hữu cơ: ${doc.fertilizerRules.organicRequirements}`,
      `- Ngưỡng trần phân hóa học: ${doc.fertilizerRules.chemicalFertilizerCeiling}`,
      `- Thời gian cách ly phân bón: ${formatDays(doc.fertilizerRules.preHarvestIntervalDays)}`,
      `- Phân bón cấm sử dụng: ${doc.fertilizerRules.forbiddenFertilizers}`,
      ``,
      `4. BẢO VỆ THỰC VẬT & QUẢN LÝ DỊCH HẠI IPM:`,
      `- Nguyên tắc phòng trừ IPM: ${doc.pestManagementIPM.ipmPrinciples}`,
      `- Thuốc BVTV sinh học được phép: ${doc.pestManagementIPM.permittedBioPesticides}`,
      `- Thời gian cách ly PHI: ${formatDays(doc.pestManagementIPM.isolationQuarantineDays)}`,
      `- Hoạt chất BVTV cấm tuyệt đối: ${doc.pestManagementIPM.prohibitedChemicals}`,
      ``,
      `5. ĐIỀU KIỆN VI KHÍ HẬU & KỸ THUẬT CANH TÁC:`,
      `- Nhiệt độ tối ưu: ${doc.climateRequirements.tempOptimal}`,
      `- Độ ẩm đất tối ưu: ${doc.climateRequirements.moistureOptimal}`,
      `- pH tối ưu: ${doc.climateRequirements.pHOptimal}`,
      `- EC tối ưu: ${doc.climateRequirements.ecOptimal}`,
      `- Chu kỳ sinh trưởng: ${formatDays(doc.climateRequirements.growthDays)}`,
      ``,
      `6. THU HOẠCH, VỆ SINH & TRUY XUẤT NGUỒN GỐC:`,
      `- Dụng cụ thu hái: ${doc.harvestSafety.harvestToolsStandard}`,
      `- Nước rửa sơ chế: ${doc.harvestSafety.waterWashingStandard}`,
      `- Bao bì đóng gói: ${doc.harvestSafety.packagingMaterial}`,
      `- Truy xuất nguồn gốc: ${doc.harvestSafety.traceabilityQr}`,
      `--------------------------------------------------------------------------------`,
      `7. TOÀN BỘ VĂN BẢN TRÍCH XUẤT TỪ HỒ SƠ GỐC:`,
      doc.contentText || doc.chunks?.map(c => `[Đoạn #${c.chunkIndex + 1}]\n${c.content}`).join('\n\n') || 'Không có văn bản trích xuất chi tiết.',
      `================================================================================`,
      `Hệ thống Quản lý Nông nghiệp Thông minh SmartFarm - Xuất ngày ${new Date().toLocaleString('vi-VN')}`
    ].join('\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_');
    a.download = `VietGAP_${sanitizedTitle}_${doc.version || 'V1'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ type: 'success', message: `Đã xuất và tải về thành công hồ sơ quy chuẩn: ${a.download}` });
  };

  // Helper chuẩn hóa số và lọc lỗi dấu phẩy thập phân tiếng Việt (vd: 6,0 -> 6.0)
  const parseCleanNumber = (val: any, fallback: number): number => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleaned = String(val).trim().replace(',', '.').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
  };

  // Helper bảo đảm giá trị pH luôn nằm trong thang chuẩn 0 - 14 (khắc phục lỗi 60 -> 6.0)
  const sanitizePh = (v: any, fallback = 6.0): number => {
    const num = parseCleanNumber(v, fallback);
    if (num > 14) {
      const fixed = Math.round((num / 10) * 10) / 10;
      return fixed > 14 ? fallback : fixed;
    }
    return Math.round(num * 10) / 10;
  };

  // Helper sinh các giai đoạn chuẩn hóa theo bộ mẫu (Presets)
  // Helper sinh các giai đoạn chuẩn hóa thích ứng động từ CSDL (không dùng mock data)
  const buildDefaultStages = (targetDoc: any, count: number, th: any): EditableGrowthStage[] => {
    const cropName = targetDoc?.cropName || targetDoc?.title || 'Cây trồng';
    const tMin = th.tempMin || 20;
    const tMax = th.tempMax || 28;
    const mMin = th.moistMin || 65;
    const mMax = th.moistMax || 75;
    const pMin = sanitizePh(th.phMin, 6.0);
    const pMax = sanitizePh(th.phMax, 6.8);
    const eMin = th.ecMin || 1.8;
    const eMax = th.ecMax || 2.5;

    // Nếu tài liệu hiện tại có stagesOverview từ CSDL và trùng số lượng giai đoạn yêu cầu
    if (targetDoc?.stagesOverview && targetDoc.stagesOverview.length === count) {
      return targetDoc.stagesOverview.map((st: any, idx: number) => ({
        stageOrder: idx + 1,
        name: st.name,
        durationDays: Math.max(1, Number(st.days) || 15),
        tempMin: parseCleanNumber(st.temp?.replace('°C', '').split(/[-–]/)[0], tMin),
        tempMax: parseCleanNumber(st.temp?.replace('°C', '').split(/[-–]/)[1], tMax),
        tempOptimal: Math.round(((tMin + tMax) / 2) * 10) / 10,
        airHumidityMin: 65,
        airHumidityMax: 85,
        airHumidityOptimal: 75,
        moistMin: parseCleanNumber(st.moisture?.replace('%', '').split(/[-–]/)[0], mMin),
        moistMax: parseCleanNumber(st.moisture?.replace('%', '').split(/[-–]/)[1], mMax),
        moistOptimal: Math.round(((mMin + mMax) / 2) * 10) / 10,
        phMin: pMin,
        phMax: pMax,
        phOptimal: Math.round(((pMin + pMax) / 2) * 10) / 10,
        ecMin: eMin,
        ecMax: eMax,
        ecOptimal: Math.round(((eMin + eMax) / 2) * 10) / 10,
        description: `Giai đoạn ${st.name} theo Quy chuẩn VietGAP ${targetDoc.code}`,
        fertilizerAction: st.fertilizerAction || targetDoc.fertilizerRules?.organicRequirements || 'Châm phân theo quy chuẩn VietGAP',
        ipmAction: st.ipmAction || targetDoc.pestManagementIPM?.ipmPrinciples || 'Áp dụng biện pháp sinh học IPM'
      }));
    }

    // Phân kỳ động theo chu kỳ sinh trưởng thực tế trong CSDL
    const totalDays = targetDoc?.climateRequirements?.growthDays || 90;
    const baseDays = Math.floor(totalDays / count);
    const stageLabels = count === 3 
      ? ['Cây con & Bén rễ', 'Sinh trưởng sinh dưỡng', 'Ra hoa & Thu hoạch']
      : count === 5
      ? ['Cây con bén rễ', 'Phát triển thân cành lá', 'Phân hóa mầm hoa', 'Đậu trái & Nuôi quả', 'Chín & Thu hoạch']
      : ['Cây con & Bén rễ', 'Phát triển thân lá', 'Ra hoa & Đậu quả', 'Nuôi quả & Thu hoạch'];

    return stageLabels.slice(0, count).map((label, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === count - 1;
      const stageDays = isLast ? (totalDays - baseDays * (count - 1)) : baseDays;
      return {
        stageOrder: idx + 1,
        name: `${label} (${cropName})`,
        durationDays: Math.max(1, stageDays),
        tempMin: tMin,
        tempMax: tMax,
        tempOptimal: Math.round(((tMin + tMax) / 2) * 10) / 10,
        airHumidityMin: 65,
        airHumidityMax: 85,
        airHumidityOptimal: 75,
        moistMin: isFirst ? mMin + 5 : mMin,
        moistMax: isFirst ? mMax + 5 : mMax,
        moistOptimal: Math.round(((mMin + mMax) / 2) * 10) / 10,
        phMin: pMin,
        phMax: pMax,
        phOptimal: Math.round(((pMin + pMax) / 2) * 10) / 10,
        ecMin: isFirst ? Math.max(1.0, eMin - 0.4) : eMin,
        ecMax: isFirst ? Math.max(1.4, eMax - 0.4) : eMax,
        ecOptimal: Math.round((((isFirst ? Math.max(1.0, eMin - 0.4) : eMin) + (isFirst ? Math.max(1.4, eMax - 0.4) : eMax)) / 2) * 10) / 10,
        description: `Giai đoạn ${label} canh tác ${cropName} theo quy chuẩn VietGAP`,
        fertilizerAction: targetDoc?.fertilizerRules?.organicRequirements || 'Tưới dinh dưỡng NPK cân đối theo quy chuẩn VietGAP',
        ipmAction: targetDoc?.pestManagementIPM?.ipmPrinciples || 'Kiểm soát sinh học và bẫy dính IPM'
      };
    });
  };

  // Tính toán chuỗi thời gian liên tục 100% không chồng chéo (Zero-Overlap Timeline)
  const calculateTimeline = (stages: EditableGrowthStage[]) => {
    let currentStart = 1;
    return stages.map((st) => {
      const duration = Math.max(1, Number(st.durationDays) || 1);
      const start = currentStart;
      const end = currentStart + duration - 1;
      currentStart = end + 1;
      return {
        ...st,
        startDay: start,
        endDay: end,
        durationDays: duration
      };
    });
  };

  const handleApplyPreset = (count: number) => {
    setActiveStagePreset(count);
    const generated = buildDefaultStages(convertingDoc, count, profileThresholds);
    setEditableStages(generated);
  };

  const handleAddStage = () => {
    setEditableStages(prev => {
      const nextOrder = prev.length + 1;
      const newStage: EditableGrowthStage = {
        stageOrder: nextOrder,
        name: `Giai đoạn ${nextOrder}: Tăng trưởng bổ sung`,
        durationDays: 15,
        tempMin: profileThresholds.tempMin,
        tempMax: profileThresholds.tempMax,
        tempOptimal: Math.round(((profileThresholds.tempMin + profileThresholds.tempMax) / 2) * 10) / 10,
        airHumidityMin: 65,
        airHumidityMax: 85,
        airHumidityOptimal: 75,
        moistMin: profileThresholds.moistMin,
        moistMax: profileThresholds.moistMax,
        moistOptimal: Math.round(((profileThresholds.moistMin + profileThresholds.moistMax) / 2) * 10) / 10,
        phMin: profileThresholds.phMin,
        phMax: profileThresholds.phMax,
        phOptimal: Math.round(((profileThresholds.phMin + profileThresholds.phMax) / 2) * 10) / 10,
        ecMin: profileThresholds.ecMin,
        ecMax: profileThresholds.ecMax,
        ecOptimal: Math.round(((profileThresholds.ecMin + profileThresholds.ecMax) / 2) * 10) / 10,
        description: `Giai đoạn sinh trưởng bổ sung cho cây ${convertingDoc?.cropName || ''}`,
        fertilizerAction: convertingDoc?.fertilizerRules?.organicRequirements || 'Bổ sung dinh dưỡng NPK định kỳ.',
        ipmAction: convertingDoc?.pestManagementIPM?.ipmPrinciples || 'Kiểm tra sâu hại và mật độ dịch hại.'
      };
      return [...prev, newStage];
    });
  };

  const handleRemoveStage = (index: number) => {
    if (editableStages.length <= 1) {
      setNotification({ type: 'error', message: 'Hồ sơ sinh trưởng phải có ít nhất 1 giai đoạn!' });
      return;
    }
    setEditableStages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((st, i) => ({ ...st, stageOrder: i + 1 }));
    });
  };

  const handleUpdateStage = (index: number, field: keyof EditableGrowthStage, value: any) => {
    setEditableStages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateStagesBeforeReview = (): boolean => {
    if (editableStages.length === 0) {
      setNotification({ type: 'error', message: 'Hồ sơ sinh trưởng phải có ít nhất 1 giai đoạn!' });
      return false;
    }
    for (let i = 0; i < editableStages.length; i++) {
      const s = editableStages[i];
      if (!s.name || !s.name.trim()) {
        setNotification({ type: 'error', message: `Giai đoạn thứ ${i + 1} chưa có tên. Vui lòng nhập tên giai đoạn!` });
        return false;
      }
      if (!s.durationDays || Number(s.durationDays) <= 0) {
        setNotification({ type: 'error', message: `Giai đoạn "${s.name}" phải có số ngày kéo dài hợp lệ (>= 1 ngày)!` });
        return false;
      }
    }
    const names = editableStages.map(s => s.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      setNotification({ type: 'error', message: 'Tên các giai đoạn không được trùng lặp nhau. Vui lòng đặt tên phân biệt!' });
      return false;
    }
    return true;
  };

  // Kích hoạt Modal chuyển đổi từ VietGAP sang Crop Growth Profile
  const triggerConvertModal = async (doc: VietGapRegulationDetail) => {
    let activeDoc = { ...doc };
    setAiSourceEvidence([]);

    // Tự động tải nạp toàn văn 100% nội dung tệp văn bản từ CSDL nếu chưa có
    if (doc.id && doc.id.includes('-') && (!doc.contentText || doc.contentText.length < 50)) {
      try {
        const detail = await knowledgeService.getDocument(doc.id);
        if (detail && (detail.contentText || detail.chunks)) {
          activeDoc = deriveVietGapDetails(doc, detail);
        }
      } catch (err) {
        console.warn('Could not fetch full document text for modal:', err);
      }
    }

    setConvertingDoc(activeDoc);
    setCustomProfileName(`Hồ sơ Sinh trưởng VietGAP - ${activeDoc.cropName}`);
    const matched = crops.find(c => 
      c.name.trim().toLowerCase() === activeDoc.cropName.trim().toLowerCase() ||
      c.name.toLowerCase().includes(activeDoc.cropName.toLowerCase()) ||
      activeDoc.cropName.toLowerCase().includes(c.name.toLowerCase())
    );
    // Nếu chưa có cây trồng này trong thư viện, mặc định chọn rỗng để kích hoạt tạo Cây trồng mới
    setSelectedCropForConvert(matched ? matched.cropId : '');

    const rawTMin = activeDoc.climateRequirements?.tempOptimal?.split(/[-–—]/)[0];
    const rawTMax = activeDoc.climateRequirements?.tempOptimal?.split(/[-–—]/)[1];
    const tMin = matched?.optimalTemperatureMin ?? parseCleanNumber(rawTMin, 20);
    const tMax = matched?.optimalTemperatureMax ?? parseCleanNumber(rawTMax, 28);

    const rawMMin = activeDoc.climateRequirements?.moistureOptimal?.split(/[-–—]/)[0];
    const rawMMax = activeDoc.climateRequirements?.moistureOptimal?.split(/[-–—]/)[1];
    const mMin = matched?.optimalSoilMoistureMin ?? parseCleanNumber(rawMMin, 65);
    const mMax = matched?.optimalSoilMoistureMax ?? parseCleanNumber(rawMMax, 75);

    const rawPMin = activeDoc.climateRequirements?.pHOptimal?.split(/[-–—]/)[0];
    const rawPMax = activeDoc.climateRequirements?.pHOptimal?.split(/[-–—]/)[1];
    const pMin = matched?.optimalpHMin ? sanitizePh(matched.optimalpHMin, 6.0) : sanitizePh(rawPMin, 6.0);
    const pMax = matched?.optimalpHMax ? sanitizePh(matched.optimalpHMax, 6.8) : sanitizePh(rawPMax, 6.8);

    const rawEMin = activeDoc.climateRequirements?.ecOptimal?.split(/[-–—]/)[0];
    const rawEMax = activeDoc.climateRequirements?.ecOptimal?.split(/[-–—]/)[1];
    const eMin = matched?.optimalECMin ?? parseCleanNumber(rawEMin, 1.8);
    const eMax = matched?.optimalECMax ?? parseCleanNumber(rawEMax, 2.5);

    const baseTh = {
      tempMin: tMin,
      tempMax: tMax,
      moistMin: mMin,
      moistMax: mMax,
      phMin: pMin,
      phMax: pMax,
      ecMin: eMin,
      ecMax: eMax
    };

    setProfileThresholds(baseTh);

    if (activeDoc.stagesOverview && activeDoc.stagesOverview.length >= 2) {
      const parsedStages: EditableGrowthStage[] = activeDoc.stagesOverview.map((st, idx) => {
        let cleanName = (st.name || `Giai đoạn ${idx + 1}`).trim();
        cleanName = cleanName.replace(/^(?:Giai đoạn|Thời kỳ|Bước)\s*[0-9IVX]*\s*[:\.\-–]\s*/i, '').trim();
        if (!cleanName) cleanName = `Giai đoạn ${idx + 1}`;
        
        // Trích xuất khoảng nhiệt độ riêng của từng giai đoạn (vd "20-25°C" -> 20, 25)
        const stTempParts = st.temp ? st.temp.replace('°C', '').split(/[-–]/) : [];
        const sTMin = stTempParts.length >= 2 ? parseCleanNumber(stTempParts[0], tMin) : tMin;
        const sTMax = stTempParts.length >= 2 ? parseCleanNumber(stTempParts[1], tMax) : tMax;

        // Trích xuất khoảng độ ẩm riêng (vd "60-70%" -> 60, 70)
        const stMoistParts = st.moisture ? st.moisture.replace('%', '').split(/[-–]/) : [];
        const sMMin = stMoistParts.length >= 2 ? parseCleanNumber(stMoistParts[0], mMin) : mMin;
        const sMMax = stMoistParts.length >= 2 ? parseCleanNumber(stMoistParts[1], mMax) : mMax;

        // Trích xuất pH riêng
        const stPhParts = st.ph ? st.ph.split(/[-–]/) : [];
        const sPMin = stPhParts.length >= 2 ? sanitizePh(stPhParts[0], pMin) : pMin;
        const sPMax = stPhParts.length >= 2 ? sanitizePh(stPhParts[1], pMax) : pMax;

        // Trích xuất EC riêng
        const stEcParts = st.ec ? st.ec.replace('dS/m', '').split(/[-–]/) : [];
        const sEMin = stEcParts.length >= 2 ? parseCleanNumber(stEcParts[0], eMin) : eMin;
        const sEMax = stEcParts.length >= 2 ? parseCleanNumber(stEcParts[1], eMax) : eMax;

        return {
          stageOrder: idx + 1,
          name: cleanName,
          durationDays: Math.max(1, Number(st.days) || 10),
          tempMin: sTMin,
          tempMax: sTMax,
          tempOptimal: Math.round(((sTMin + sTMax) / 2) * 10) / 10,
          moistMin: sMMin,
          moistMax: sMMax,
          moistOptimal: Math.round(((sMMin + sMMax) / 2) * 10) / 10,
          phMin: sPMin,
          phMax: sPMax,
          phOptimal: Math.round(((sPMin + sPMax) / 2) * 10) / 10,
          ecMin: sEMin,
          ecMax: sEMax,
          ecOptimal: Math.round(((sEMin + sEMax) / 2) * 10) / 10,
          airHumidityMin: 65,
          airHumidityMax: 85,
          airHumidityOptimal: 75,
          description: `Giai đoạn sinh trưởng chuẩn hóa theo Quy chuẩn VietGAP ${activeDoc.code}`,
          fertilizerAction: st.fertilizerAction || 'Bón phân theo quy trình kỹ thuật VietGAP',
          ipmAction: st.ipmAction || 'Phòng trừ dịch hại IPM an toàn'
        };
      });
      setEditableStages(parsedStages);
      setActiveStagePreset(parsedStages.length);
    } else {
      const default4 = buildDefaultStages(activeDoc, 4, baseTh);
      setEditableStages(default4);
      setActiveStagePreset(4);
    }

    setConvertStep('BUILDER');
    setReviewerConfirmed(false);
    setIsGenerateModalOpen(true);
    return activeDoc;
  };

  // Chuyển đổi và tạo GrowthProfile (Sau khi người kiểm duyệt cuối phê duyệt)
  const handleExecuteConvertToProfile = async () => {
    if (!convertingDoc) return;
    if (!reviewerConfirmed) {
      setNotification({ type: 'error', message: 'Vui lòng xác nhận đánh dấu kiểm duyệt trước khi ban hành hồ sơ sinh trưởng!' });
      return;
    }

    const invalidStage = editableStages.find(s =>
      !Number.isFinite(Number(s.tempMin)) || !Number.isFinite(Number(s.tempMax)) || Number(s.tempMin) > Number(s.tempMax) ||
      !Number.isFinite(Number(s.tempOptimal)) || Number(s.tempOptimal) < Number(s.tempMin) || Number(s.tempOptimal) > Number(s.tempMax) ||
      !Number.isFinite(Number(s.moistMin)) || !Number.isFinite(Number(s.moistMax)) || Number(s.moistMin) > Number(s.moistMax) ||
      !Number.isFinite(Number(s.moistOptimal)) || Number(s.moistOptimal) < Number(s.moistMin) || Number(s.moistOptimal) > Number(s.moistMax) ||
      !Number.isFinite(Number(s.phMin)) || !Number.isFinite(Number(s.phMax)) || Number(s.phMin) > Number(s.phMax) ||
      !Number.isFinite(Number(s.phOptimal)) || Number(s.phOptimal) < Number(s.phMin) || Number(s.phOptimal) > Number(s.phMax) ||
      !Number.isFinite(Number(s.ecMin)) || !Number.isFinite(Number(s.ecMax)) || Number(s.ecMin) > Number(s.ecMax) ||
      !Number.isFinite(Number(s.ecOptimal)) || Number(s.ecOptimal) < Number(s.ecMin) || Number(s.ecOptimal) > Number(s.ecMax) ||
      !Number.isInteger(Number(s.durationDays)) || Number(s.durationDays) <= 0 ||
      (s.airHumidityMin != null || s.airHumidityMax != null || s.airHumidityOptimal != null) &&
        (s.airHumidityMin == null || s.airHumidityMax == null || s.airHumidityOptimal == null || !Number.isFinite(Number(s.airHumidityMin)) || !Number.isFinite(Number(s.airHumidityMax)) ||
          !Number.isFinite(Number(s.airHumidityOptimal)) || Number(s.airHumidityMin) > Number(s.airHumidityMax) || Number(s.airHumidityOptimal) < Number(s.airHumidityMin) || Number(s.airHumidityOptimal) > Number(s.airHumidityMax)) ||
      (s.lightMin != null || s.lightMax != null || s.lightOptimal != null) &&
        (s.lightMin == null || s.lightMax == null || s.lightOptimal == null || !Number.isFinite(Number(s.lightMin)) || !Number.isFinite(Number(s.lightMax)) ||
          !Number.isFinite(Number(s.lightOptimal)) || Number(s.lightMin) > Number(s.lightMax) || Number(s.lightOptimal) < Number(s.lightMin) || Number(s.lightOptimal) > Number(s.lightMax))
    );
    if (invalidStage) {
      setNotification({ type: 'error', message: `Giai đoạn "${invalidStage.name}" có chỉ tiêu thiếu hoặc sai khoảng Min/Max. Hãy kiểm tra các thông số trước khi lưu.` });
      return;
    }

    setIsProcessing(true);

    try {
      let targetCropId = selectedCropForConvert;

      if (!targetCropId) {
        // Kiểm tra xem cây trồng đã tồn tại trong thư viện chưa để tránh xung đột 409
        const existingCrop = crops.find(c => c.name.trim().toLowerCase() === convertingDoc.cropName.trim().toLowerCase());
        if (existingCrop) {
          targetCropId = existingCrop.cropId;
        } else {
          try {
            const totalDays = editableStages.reduce((sum, s) => sum + (Math.max(1, Number(s.durationDays) || 1)), 0);
            const newCrop = await cropService.createCrop({
              name: convertingDoc.cropName,
              scientificName: `${convertingDoc.cropName} L.`,
              category: convertingDoc.category,
              growthCycleDays: totalDays,
              description: `Giống cây chuẩn hóa từ Quy chuẩn VietGAP ${convertingDoc.code} (${convertingDoc.title})`,
              optimalTemperatureMin: Math.min(...editableStages.map(s => s.tempMin)),
              optimalTemperatureMax: Math.max(...editableStages.map(s => s.tempMax)),
              optimalSoilMoistureMin: Math.min(...editableStages.map(s => s.moistMin)),
              optimalSoilMoistureMax: Math.max(...editableStages.map(s => s.moistMax)),
              optimalpHMin: Math.min(...editableStages.map(s => s.phMin)),
              optimalpHMax: Math.max(...editableStages.map(s => s.phMax)),
              optimalECMin: Math.min(...editableStages.map(s => s.ecMin)),
              optimalECMax: Math.max(...editableStages.map(s => s.ecMax)),
              optimalLux: editableStages.find(s => s.lightOptimal != null)?.lightOptimal,
              isSystemDefined: true
            });
            targetCropId = newCrop.cropId;
            await loadCrops();
          } catch (cropErr: any) {
            // Nếu cây trồng đã được tạo ở tiến trình khác, tải lại và liên kết
            const freshCrops = await cropService.getCrops();
            const matchedFresh = (freshCrops as any[]).find((c: any) => c.name?.trim().toLowerCase() === convertingDoc.cropName.trim().toLowerCase());
            if (matchedFresh) {
              targetCropId = matchedFresh.cropId;
              setCrops(freshCrops);
            } else {
              throw cropErr;
            }
          }
        }
      }

      const timelineStages = calculateTimeline(editableStages);
      const totalCycleDays = timelineStages.reduce((sum, s) => sum + s.durationDays, 0);

      // Kiểm tra tên các giai đoạn không được để trống và không được trùng lặp
      const stageNames = timelineStages.map(s => (s.name || '').trim());
      for (let i = 0; i < stageNames.length; i++) {
        if (!stageNames[i]) {
          setNotification({ type: 'error', message: `Giai đoạn thứ ${i + 1} chưa có tên. Vui lòng nhập tên giai đoạn!` });
          setIsProcessing(false);
          return;
        }
      }
      const uniqueNames = new Set(stageNames.map(n => n.toLowerCase()));
      if (uniqueNames.size !== stageNames.length) {
        setNotification({
          type: 'error',
          message: 'Tên các giai đoạn sinh trưởng không được trùng lặp nhau. Vui lòng đặt tên phân biệt cho từng giai đoạn!'
        });
        setIsProcessing(false);
        return;
      }

      const profilePayload = {
        cropId: targetCropId,
        name: customProfileName.trim() || `Hồ sơ Sinh trưởng VietGAP - ${convertingDoc.cropName}`,
        description: `[sourceDocument:${convertingDoc.id}] Kịch bản sinh trưởng tham chiếu tài liệu ${convertingDoc.code || 'VietGAP'}; người rà soát: ${reviewerName}; ghi chú: ${reviewerNotes || 'Chưa có ghi chú'}.`,
        isDefault: true,
        stages: timelineStages.map((stg) => {
          // Phòng thủ chặt chẽ: Đảo ngược nếu min > max và kẹp chặt target trong khoảng [min, max]
          const rawTMin = Number(stg.tempMin);
          const rawTMax = Number(stg.tempMax);
          const tMin = Math.min(rawTMin, rawTMax);
          const tMax = Math.max(rawTMin, rawTMax);
          const tOpt = Number(stg.tempOptimal);

          const rawMMin = Number(stg.moistMin);
          const rawMMax = Number(stg.moistMax);
          const mMin = Math.min(rawMMin, rawMMax);
          const mMax = Math.max(rawMMin, rawMMax);
          const mOpt = Number(stg.moistOptimal);

          const rawPMin = Number(stg.phMin);
          const rawPMax = Number(stg.phMax);
          const pMin = Math.min(rawPMin, rawPMax);
          const pMax = Math.max(rawPMin, rawPMax);
          const pOpt = Number(stg.phOptimal);

          const rawEMin = Number(stg.ecMin);
          const rawEMax = Number(stg.ecMax);
          const eMin = Math.min(rawEMin, rawEMax);
          const eMax = Math.max(rawEMin, rawEMax);
          const eOpt = Number(stg.ecOptimal);

          return {
            stageName: stg.name.trim(),
            stageOrder: stg.stageOrder,
            durationDays: Number(stg.durationDays),
            description: `Giai đoạn ${stg.name} (Ngày ${stg.startDay} - ${stg.endDay}) - VietGAP: Nhiệt độ ${tMin}-${tMax}°C, Ẩm đất ${mMin}-${mMax}%, pH ${pMin}-${pMax}, EC ${eMin}-${eMax}. Phân bón: ${stg.fertilizerAction}. IPM: ${stg.ipmAction}`,
            requirements: [
              { parameterName: 'Temperature', minValue: tMin, maxValue: tMax, optimalValue: tOpt, unit: '°C' },
              { parameterName: 'SoilMoisture', minValue: mMin, maxValue: mMax, optimalValue: mOpt, unit: '%' },
              ...(stg.airHumidityMin != null && stg.airHumidityMax != null
                ? [{ parameterName: 'AirHumidity', minValue: stg.airHumidityMin, maxValue: stg.airHumidityMax, optimalValue: Number(stg.airHumidityOptimal), unit: '%' }]
                : []),
              { parameterName: 'Ph', minValue: pMin, maxValue: pMax, optimalValue: pOpt, unit: 'pH' },
              { parameterName: 'Ec', minValue: eMin, maxValue: eMax, optimalValue: eOpt, unit: 'mS/cm' },
              ...(stg.lightMin != null && stg.lightMax != null
                ? [{ parameterName: 'LightIntensity', minValue: stg.lightMin, maxValue: stg.lightMax, optimalValue: Number(stg.lightOptimal), unit: 'lux' }]
                : [])
            ]
          };
        })
      };

      const createdProfile = await cropService.createGrowthProfile(profilePayload);
      const savedProfileId = createdProfile?.profileId || createdProfile?.id;
      if (!savedProfileId) throw new Error('API đã nhận yêu cầu nhưng không trả về ID profile đã lưu.');
      try {
        const refreshedProfiles = await cropService.getAllGrowthProfiles();
        setGrowthProfiles(refreshedProfiles || []);
      } catch (refreshError) {
        console.warn('Growth Profile đã lưu nhưng không thể làm mới danh sách profile:', refreshError);
        setGrowthProfiles(prev => [...prev.filter((p: any) => (p.profileId || p.id) !== savedProfileId), createdProfile]);
      }

      setDocuments(prev => prev.map(d => d.id === convertingDoc.id ? { 
        ...d, 
        profileGenerated: true, 
        profileId: savedProfileId,
        profileName: profilePayload.name
      } : d));

      setNotification({
        type: 'success',
        message: `Đã tạo Growth Profile gồm ${timelineStages.length} giai đoạn (${totalCycleDays} ngày) cho cây ${convertingDoc.cropName}. Trạng thái VietGAP cần được xác minh riêng.`
      });
      setIsGenerateModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create growth profile:', err);
      let msg = err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Lỗi khi tạo hồ sơ sinh trưởng';
      if (err?.response?.status === 409 || msg.toLowerCase().includes('already exists')) {
        msg = `Tên hồ sơ "${customProfileName.trim() || convertingDoc.cropName}" đã tồn tại trong CSDL. Vui lòng đổi tên hồ sơ ở Bước 2 để tránh xung đột!`;
      }
      setNotification({
        type: 'error',
        message: `Tạo Hồ sơ Sinh trưởng thất bại: ${msg}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // AI Soạn Thảo Hồ Sơ Sinh Trưởng theo Template Chuẩn SmartFarm
  const handleAiDraftGrowthProfile = async (
    sourceDocument: VietGapRegulationDetail | null = convertingDoc,
    requestedStageCount = activeStagePreset || 4
  ) => {
    if (!sourceDocument) return;
    // Chỉ dùng một tài liệu thì tài liệu đó phải được duyệt; gom theo cây trồng thì server tự chỉ lấy tài liệu đã duyệt.
    if (profileSourceScope === 'document' && sourceDocument.reviewStatus !== 'Approved') {
      setNotification({ type: 'error', message: 'Tài liệu chưa được đối chiếu và duyệt. Hãy rà soát toàn văn với file gốc trước khi sinh profile.' });
      return;
    }
    setIsAiDraftingProfile(true);
    setAiSourceEvidence([]);
    try {
      setNotification({
        type: 'success',
        message: `Đang gửi toàn văn tài liệu VietGAP (${sourceDocument.code}) cho AI tạo bản nháp theo template Crop Profile...`
      });

      let currentDoc = sourceDocument;
      if (sourceDocument.id && (!sourceDocument.contentText || sourceDocument.contentText.length < 50)) {
        try {
          const detail = await knowledgeService.getDocument(sourceDocument.id);
          if (detail && detail.contentText) {
            currentDoc = { ...sourceDocument, contentText: detail.contentText };
            setConvertingDoc(currentDoc);
          }
        } catch (e) {
          console.warn('Could not fetch full document text:', e);
        }
      }

      const res = await knowledgeService.generateGrowthProfileDraft({
        cropName: currentDoc.cropName,
        // Bỏ documentId: server gom mọi tài liệu đã duyệt của cây (thu hoạch, sâu bệnh, tưới... từ nhiều file).
        documentId: profileSourceScope === 'document' ? currentDoc.id : undefined,
        cultivationModel: 'Chưa xác định',
        stageCount: requestedStageCount
      });

      if (res.isFallback || res.source === 'fallback' || !Array.isArray(res.stages) || res.stages.length < 2) {
        setIsFallbackProfile(true);
        setEditableStages([]);
        setActiveStagePreset(0);
        setAiSourceEvidence([]);
        setNotification({
          type: 'error',
          message: res.description || 'Tài liệu chưa có đủ số liệu được trích dẫn để tạo profile. Không nạp ngưỡng mẫu; hãy bổ sung nguồn hoặc nhập số liệu đã xác minh.'
        });
        return;
      }

      const mappedStages: EditableGrowthStage[] = res.stages.map((stg, idx) => {
        const getReq = (code: string) => stg.requirements.find(r => r.parameterCode.toLowerCase() === code.toLowerCase());
        const tReq = getReq('Temperature');
        const mReq = getReq('SoilMoisture');
        const pReq = getReq('Ph');
        const eReq = getReq('Ec');
        if (!tReq || !mReq || !pReq || !eReq) {
          throw new Error(`AI trả thiếu chỉ tiêu bắt buộc ở giai đoạn ${idx + 1}. Hãy thử lại hoặc đối chiếu thủ công.`);
        }
        const values = [tReq.minValue, tReq.maxValue, tReq.targetValue, mReq.minValue, mReq.maxValue, mReq.targetValue,
          pReq.minValue, pReq.maxValue, pReq.targetValue, eReq.minValue, eReq.maxValue, eReq.targetValue];
        if (values.some(v => !Number.isFinite(v)) || tReq.minValue > tReq.maxValue || tReq.targetValue < tReq.minValue || tReq.targetValue > tReq.maxValue ||
          mReq.minValue > mReq.maxValue || mReq.targetValue < mReq.minValue || mReq.targetValue > mReq.maxValue ||
          pReq.minValue > pReq.maxValue || pReq.targetValue < pReq.minValue || pReq.targetValue > pReq.maxValue ||
          eReq.minValue > eReq.maxValue || eReq.targetValue < eReq.minValue || eReq.targetValue > eReq.maxValue ||
          !Number.isInteger(stg.durationDays) || stg.durationDays < 1) {
          throw new Error(`AI trả số liệu không hợp lệ ở giai đoạn ${idx + 1}. Profile chưa được nạp.`);
        }
        const hReq = getReq('AirHumidity');
        const lReq = getReq('LightIntensity');
        return {
          stageOrder: stg.stageOrder,
          name: stg.name,
          durationDays: stg.durationDays,
          tempMin: tReq.minValue,
          tempMax: tReq.maxValue,
          tempOptimal: tReq.targetValue,
          moistMin: mReq.minValue,
          moistMax: mReq.maxValue,
          moistOptimal: mReq.targetValue,
          phMin: pReq.minValue,
          phMax: pReq.maxValue,
          phOptimal: pReq.targetValue,
          ecMin: eReq.minValue,
          ecMax: eReq.maxValue,
          ecOptimal: eReq.targetValue,
          airHumidityMin: hReq?.minValue,
          airHumidityMax: hReq?.maxValue,
          airHumidityOptimal: hReq?.targetValue,
          lightMin: lReq?.minValue,
          lightMax: lReq?.maxValue,
          lightOptimal: lReq?.targetValue,
          description: stg.description,
          fertilizerAction: stg.fertilizerAction,
          ipmAction: stg.ipmAction
        };
      });

      setEditableStages(mappedStages);
      setActiveStagePreset(mappedStages.length);
      setAiSourceEvidence(res.stages.flatMap((stage, stageIndex) => [
        'Giai đoạn ' + (stageIndex + 1) + ' · thời lượng ' + stage.durationDays + ' ngày: ' + stage.durationEvidence,
        ...(stage.descriptionEvidence ? ['Giai đoạn ' + (stageIndex + 1) + ' · mô tả: ' + stage.descriptionEvidence] : []),
        ...(stage.fertilizerEvidence ? ['Giai đoạn ' + (stageIndex + 1) + ' · phân bón: ' + stage.fertilizerEvidence] : []),
        ...(stage.ipmEvidence ? ['Giai đoạn ' + (stageIndex + 1) + ' · IPM: ' + stage.ipmEvidence] : []),
        ...stage.requirements.map(req => 'Giai đoạn ' + (stageIndex + 1) + ' · ' + req.parameterCode + ': ' + req.sourceEvidence)
      ]));
      if (res.profileName) setCustomProfileName(res.profileName);
      setReviewerNotes(`[AI trích xuất]: ${res.description}`);
      setIsFallbackProfile(false);
      setNotification({
        type: 'success',
        message: `AI đã tách ${mappedStages.length} giai đoạn. Mỗi ngưỡng có trích dẫn nguồn để đối chiếu trước khi lưu.`
          + (res.sourceDocuments?.length ? ` Nguồn: ${res.sourceDocuments.join('; ')}.` : '')
      });
    } catch (err: any) {
      console.error('Error generating AI profile draft:', err);
      const msg = err?.response?.data?.message || err?.message || 'Không thể soạn thảo bằng AI';
      setNotification({
        type: 'error',
        message: `Lỗi soạn thảo bằng AI: ${msg}`
      });
    } finally {
      setIsAiDraftingProfile(false);
    }
  };

  const handleReviewDocument = async (approve: boolean) => {
    if (!selectedDoc) return;
    if (reviewText.trim().length < 50) {
      setNotification({ type: 'error', message: 'Nội dung rà soát cần có ít nhất 50 ký tự.' });
      return;
    }
    if (approve && !reviewConfirmed) {
      setNotification({ type: 'error', message: 'Vui lòng xác nhận đã đối chiếu nội dung với tài liệu gốc.' });
      return;
    }
    if (approve && missingCriticalChecks.length > 0 && reviewNotes.trim().length < MIN_NOTES_FOR_INCOMPLETE_APPROVAL) {
      setNotification({ type: 'error', message: `Tài liệu chưa thấy: ${missingCriticalChecks.map(c => c.label).join(', ')}. Bổ sung nội dung hoặc ghi chú lý do duyệt (tối thiểu ${MIN_NOTES_FOR_INCOMPLETE_APPROVAL} ký tự).` });
      return;
    }
    setIsSavingReview(true);
    try {
      await knowledgeService.reviewDocument(selectedDoc.id, {
        contentText: reviewText,
        approve,
        reviewNotes: reviewNotes.trim() || undefined
      });
      const detail = await knowledgeService.getDocument(selectedDoc.id);
      const refreshed = deriveVietGapDetails(detail, detail, crops, growthProfiles);
      setDocuments(prev => prev.map(doc => doc.id === refreshed.id ? refreshed : doc));
      setSelectedDoc(refreshed);
      setIsReviewPanelOpen(false);
      setReviewConfirmed(false);
      setNotification({
        type: 'success',
        message: approve
          ? 'Đã duyệt tài liệu. Nội dung đã đối chiếu được lưu; có thể dùng tạo profile và RAG.'
          : 'Đã lưu kết quả rà soát. Tài liệu được đánh dấu cần chỉnh sửa và chưa thể dùng tạo profile.'
      });
    } catch (err: any) {
      const validationErrors = err?.response?.data?.errors
        ? Object.values(err.response.data.errors as Record<string, string[]>).flat().join(' ')
        : '';
      setNotification({ type: 'error', message: `Không lưu được rà soát: ${validationErrors || err?.response?.data?.message || err?.message || 'Lỗi máy chủ'}` });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleReextractDocument = async () => {
    if (!selectedDoc) return;
    setIsReextracting(true);
    try {
      await knowledgeService.reextractDocument(selectedDoc.id);
      const detail = await knowledgeService.getDocument(selectedDoc.id);
      const refreshed = deriveVietGapDetails(detail, detail, crops, growthProfiles);
      setDocuments(prev => prev.map(doc => doc.id === refreshed.id ? refreshed : doc));
      setSelectedDoc(refreshed);
      setNotification({ type: 'success', message: 'Đã trích xuất lại. Chỉ những giá trị có câu trích nguyên văn trong tài liệu được giữ lại.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: describeIngestError(err, 'Trích xuất thất bại.') });
    } finally {
      setIsReextracting(false);
    }
  };

  const handleDownloadOriginalFile = async () => {
    if (!selectedDoc) return;
    setIsDownloadingOriginal(true);
    try {
      const fileBlob = await knowledgeService.downloadOriginalFile(selectedDoc.id);
      const objectUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = selectedDoc.fileName || (selectedDoc.title + (selectedDoc.fileType === 'PDF' ? '.pdf' : selectedDoc.fileType === 'DOCX' ? '.docx' : '.txt'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.response?.status === 404
        ? 'Tài liệu cũ chưa lưu file gốc trong DB. Hãy tải lại bản gốc để đối chiếu OCR.'
        : `Không tải được file gốc: ${err?.message || 'Lỗi máy chủ'}` });
    } finally {
      setIsDownloadingOriginal(false);
    }
  };

  // Khởi động AI Soạn Thảo Quy Chuẩn VietGAP
  const handleStartAiDraft = async () => {
    if (!draftPrompt.cropName.trim()) {
      setNotification({ type: 'error', message: 'Vui lòng nhập hoặc chọn Tên Cây Trồng để AI bắt đầu soạn thảo!' });
      return;
    }

    try {
      setIsGeneratingDraft(true);
      const res = await knowledgeService.generateDraft({
        cropName: draftPrompt.cropName.trim(),
        standardCode: draftPrompt.standardCode.trim(),
        category: draftPrompt.category,
        cultivationModel: draftPrompt.cultivationModel,
        additionalRequirements: draftPrompt.additionalRequirements
      });

      setDraftResult({
        title: res.title || `Quy Chuẩn Kỹ Thuật Canh Tác ${draftPrompt.cropName} VietGAP`,
        standardCode: res.standardCode || draftPrompt.standardCode,
        authorOrganization: res.authorOrganization || 'Hệ thống SmartFarm (AI Soạn thảo - Chưa kiểm định)',
        category: res.category || draftPrompt.category,
        cropScope: res.cropScope || draftPrompt.cropName,
        version: res.version || 'V1.0',
        content: res.content || ''
      });

      setAiDraftStep('REVIEW');
      setDraftEditorTab('EDIT');
    } catch (err: any) {
      console.error('Lỗi khi AI soạn thảo quy chuẩn:', err);
      setNotification({
        type: 'error',
        message: 'Lỗi khi yêu cầu AI soạn thảo quy chuẩn: ' + (err?.response?.data?.message || err?.message || 'Không thể kết nối đến máy chủ AI.')
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Lưu văn bản quy chuẩn đã kiểm tra vào CSDL
  const handleSaveDraftToDb = async () => {
    if (!draftResult.title.trim() || draftResult.title.trim().length < 3) {
      setNotification({ type: 'error', message: 'Tiêu đề quy chuẩn phải từ 3 đến 300 ký tự!' });
      return;
    }
    if (!draftResult.content.trim() || draftResult.content.trim().length < 50) {
      setNotification({ type: 'error', message: 'Nội dung quy chuẩn phải có ít nhất 50 ký tự!' });
      return;
    }

    try {
      setIsSavingDraft(true);
      await knowledgeService.saveTextDocument({
        title: draftResult.title.trim(),
        content: draftResult.content.trim(),
        authorOrganization: draftResult.authorOrganization,
        category: draftResult.category,
        cropScope: draftResult.cropScope || draftPrompt.cropName,
        version: draftResult.version || 'V1.0',
        isPublic: true
      });

      setNotification({
        type: 'success',
        message: `AI đã xác nhận "${draftResult.title}" đủ thông tin; đã lưu ở trạng thái chờ đối chiếu. Bản nháp chỉ vào RAG sau khi được duyệt.`
      });

      setIsAiDraftModalOpen(false);
      await loadBackendDocuments();
    } catch (err: any) {
      console.error('Lỗi lưu tài liệu quy chuẩn vào DB:', err);
      setNotification({
        type: 'error',
        message: describeIngestError(err, 'Lưu tài liệu vào DB thất bại.')
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Thông báo Alert */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between border shadow-sm ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : notification.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : notification.type === 'warning'
                ? <ShieldAlert className="w-5 h-5 text-amber-600" />
                : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-sm font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Banner Tiêu Chuẩn VietGAP Header */}
      <div className="bg-white rounded-2xl p-7 text-slate-800 shadow-sm relative overflow-hidden border border-slate-200">
        <div className="absolute right-0 top-0 bottom-0 opacity-5 pointer-events-none flex items-center pr-10 text-emerald-700">
          <Award size={340} />
        </div>
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Hệ Thống Tiêu Chuẩn Nông Nghiệp Tốt Quốc Gia
            </span>
            <span className="text-xs bg-slate-100 text-emerald-800 font-mono font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
              Mã tiêu chuẩn theo tài liệu nguồn
            </span>
            <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
              ISO/IEC 17065
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-slate-900 flex items-center gap-3">
            Trung Tâm Quản Lý Dữ Liệu Quy Chuẩn VietGAP
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
            Lưu trữ và kiểm soát toàn diện các quy chuẩn VietGAP bắt buộc: 
            <strong className="text-slate-900"> Đất & Giá thể</strong>, 
            <strong className="text-slate-900"> Nguồn nước tưới & Vi sinh E.Coli/Salmonella</strong>, 
            <strong className="text-slate-900"> Quản lý dịch hại tổng hợp (IPM) & Thời gian cách ly PHI</strong>, 
            <strong className="text-slate-900"> Phân bón an toàn</strong> và 
            <strong className="text-slate-900"> Thu hoạch truy xuất nguồn gốc</strong>. 
            Đồng thời chuyển đổi chính xác thành <strong className="text-emerald-700">Hồ Sơ Sinh Trưởng (Growth Profile)</strong> tự động vận hành trong hệ thống SmartFarm.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" /> Nạp File Quy Chuẩn (PDF/DOCX)
            </button>
            <button
              onClick={() => {
                setAiDraftStep('PROMPT');
                setIsAiDraftModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Soạn Thảo Quy Chuẩn Bằng AI
            </button>
            <Link
              to="/admin/growth-profiles"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-300 shadow-xs transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-emerald-600" /> Danh Sách Hồ Sơ Sinh Trưởng (Growth Profiles)
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-2xl overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'DOCUMENTS' 
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" /> Hồ Sơ Tài Liệu ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('CRITERIA_MATRIX')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'CRITERIA_MATRIX' 
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Layers className="w-4 h-4 text-teal-600" /> Ma Trận Đối Chiếu
          </button>
          <button
            onClick={() => setActiveTab('IPM_PEST')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'IPM_PEST' 
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" /> IPM & Cách Ly (PHI)
          </button>
          <button
            onClick={() => setActiveTab('SOIL_WATER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'SOIL_WATER' 
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Droplets className="w-4 h-4 text-cyan-600" /> Đất & Nguồn Nước Tưới
          </button>
          <button
            onClick={() => setActiveTab('HARVEST_TRACE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'HARVEST_TRACE' 
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-purple-600" /> Thu Hoạch & Mã QR
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên cây, mã TCVN, chỉ tiêu..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
          />
        </div>
      </div>

      {/* VIEW 1: Danh sách tài liệu + Panel Chi tiết đầy đủ thông tin VietGAP */}
      {activeTab === 'DOCUMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột Trái: Danh Sách Tài Liệu (5 phần) */}
          <div className="lg:col-span-5 space-y-3.5">
            {/* Bộ lọc đồng bộ với Hồ sơ sinh trưởng (Growth Profiles) */}
            <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Tổng hợp trạng thái profile theo tài liệu">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã sinh profile: {generatedProfileCount}
              </span>
              <span className="text-[11px] text-slate-500">Không tính tài liệu chuyên đề</span>
            </div>
            <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shadow-xs mb-3">
              <button
                type="button"
                onClick={() => setDocFilter('CROPS_ONLY')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  docFilter === 'CROPS_ONLY'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị chính xác các quy chuẩn theo từng giống cây đồng bộ với Hồ sơ sinh trưởng"
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quy chuẩn Cây trồng ({cropDocsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setDocFilter('ALL')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  docFilter === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Bao gồm các tài liệu quy chuẩn kỹ thuật chuyên đề dùng chung"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Tất cả gồm chuyên đề ({documents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDocFilter('BY_CROP')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  docFilter === 'BY_CROP'
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Nhóm tài liệu theo cây trồng: mỗi cây có thể có nhiều tài liệu VietGAP bổ sung từng mảng"
              >
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Theo cây trồng ({cropGroups.groups.length})</span>
              </button>
            </div>

            {docFilter === 'BY_CROP' && renderCropGroups()}

            {docFilter !== 'BY_CROP' && filteredDocs.map((doc) => (
              <div 
                key={doc.id}
                onClick={() => handleSelectDocument(doc)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedDoc?.id === doc.id 
                    ? 'bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl font-bold text-xs uppercase flex flex-col items-center justify-center w-11 h-12 flex-shrink-0 ${
                    doc.fileType === 'PDF' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <FileText className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px]">{doc.fileType}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {doc.code}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">• {doc.cropName}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 truncate mb-1">
                      {doc.title}
                    </h4>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>Cơ quan: {doc.issuingAuthority}</span>
                      <span>•</span>
                      <span>{doc.fileSize}</span>
                    </div>

                    <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${doc.reviewStatus === 'Approved' ? 'text-emerald-700' : doc.reviewStatus === 'NeedsCorrection' ? 'text-rose-700' : 'text-amber-700'}`}>
                      {doc.reviewStatus === 'Approved' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {doc.reviewStatus === 'Approved' ? 'Đã đối chiếu & duyệt' : doc.reviewStatus === 'Superseded' ? 'Đã có bản mới thay thế · không dùng cho RAG' : doc.reviewStatus === 'NeedsCorrection' ? 'Cần chỉnh sửa · chưa dùng tạo profile' : 'Chờ đối chiếu · chưa dùng tạo profile'}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      {doc.profileGenerated ? (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold"
                          title={doc.profileName ? `Đã liên kết hồ sơ: ${doc.profileName}` : 'Đã có Hồ sơ Sinh trưởng'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate max-w-[190px]">Đã sinh: {doc.profileName || 'Profile'}</span>
                        </span>
                      ) : doc.isThematicStandard ? (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-semibold"
                          title="Tài liệu quy chuẩn chuyên đề dùng chung cho toàn bộ nông trại"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="truncate max-w-[130px]">Tài liệu chuyên đề</span>
                        </span>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerUpdateModal(doc);
                          }}
                          className="px-2 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center gap-1 transition-colors border border-slate-300 shadow-xs cursor-pointer"
                          title="Cập nhật tài liệu / Tải lên bản mới (V2)"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-600" /> Sửa / V2
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa tài liệu"
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
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 sticky top-6 shadow-sm text-slate-800">
                {/* Header chi tiết */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {selectedDoc.code}
                      </span>
                      {selectedDoc.version && (
                        <span className="text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-mono">
                          {selectedDoc.version}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerUpdateModal(selectedDoc)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        title="Cập nhật nội dung hoặc tải file V2 đè lên"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-600" /> Cập Nhật / Đổi File V2
                      </button>
                      <span className="text-xs text-slate-500">Hiệu lực: {selectedDoc.validityPeriod}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{selectedDoc.title}</h3>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                    <span>Đơn vị ban hành: <strong className="text-slate-800">{selectedDoc.issuingAuthority}</strong></span>
                    <span>•</span>
                    <span>Tác giả: <strong className="text-slate-800">{selectedDoc.author}</strong></span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold" title={DOCUMENT_TYPE_INFO[selectedDoc.documentType]?.requirement}>
                      {DOCUMENT_TYPE_INFO[selectedDoc.documentType]?.label ?? selectedDoc.documentType}
                    </span>
                  </div>
                  <div className={`mt-3 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${selectedDoc.reviewStatus === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : selectedDoc.reviewStatus === 'NeedsCorrection' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <div className="flex items-center gap-2 font-semibold">
                      {selectedDoc.reviewStatus === 'Approved' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {selectedDoc.reviewStatus === 'Approved' ? 'Đã đối chiếu với tài liệu gốc' : selectedDoc.reviewStatus === 'Superseded' ? 'Đã có phiên bản mới được duyệt thay thế · không còn dùng cho RAG' : selectedDoc.reviewStatus === 'NeedsCorrection' ? 'Cần chỉnh sửa · bị loại khỏi RAG và sinh profile' : 'Chờ đối chiếu · chưa được dùng cho RAG/profile'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewText(selectedDoc.contentText || '');
                        setReviewNotes(selectedDoc.reviewNotes || '');
                        setReviewConfirmed(false);
                        setIsReviewPanelOpen(v => !v);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-current/20 font-bold hover:bg-white/80"
                    >
                      {isReviewPanelOpen ? 'Đóng rà soát' : selectedDoc.reviewStatus === 'Approved' ? 'Rà soát lại' : 'Rà soát / duyệt tài liệu'}
                    </button>
                  </div>
                  {selectedDoc.reviewNotes && selectedDoc.reviewStatus !== 'Approved' && (
                    <div className="mt-2 text-xs text-rose-700">Ghi chú rà soát: {selectedDoc.reviewNotes}</div>
                  )}
                  {selectedDoc.profileGenerated && selectedDoc.profileName && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">Hồ sơ sinh trưởng đã liên kết: <strong className="font-semibold text-emerald-950">{selectedDoc.profileName}</strong></span>
                      </div>
                      <Link 
                        to="/admin/growth-profiles" 
                        className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 hover:underline ml-2 flex-shrink-0"
                      >
                        Xem hồ sơ <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                  {selectedDoc.isThematicStandard && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 text-xs text-blue-800">
                      <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span>Đây là <strong>Quy chuẩn kỹ thuật chuyên đề nông học chung</strong> áp dụng tự động cho toàn bộ nông trại và phân hệ IoT.</span>
                    </div>
                  )}
                </div>

                {isReviewPanelOpen && (
                  <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 space-y-3" aria-label="Đối chiếu tài liệu đã trích xuất">
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-sm">Rà soát độ đầy đủ và đối chiếu nguồn</h4>
                      <p className="text-xs text-amber-900 mt-1">Các kiểm tra dưới đây chỉ giúp phát hiện phần cần xem lại; không chứng minh nội dung đúng. {selectedDoc.hasOriginalFile ? 'Tải file gốc đã lưu, đối chiếu và sửa nội dung trích xuất trước khi duyệt.' : 'Bản ghi này không có file gốc lưu trong DB; hãy đối chiếu với nguồn đáng tin cậy bên ngoài hoặc tải lại file gốc trước khi duyệt.'}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {[
                        ...reviewChecks.map(c => ({ label: c.label, ok: c.found, critical: c.isCritical })),
                        { label: 'Đơn vị/tổ chức ban hành', ok: Boolean(selectedDoc.author && !selectedDoc.author.includes('Chưa xác định')), critical: false }
                      ].map(check => (
                        <div key={check.label} className={`flex items-start gap-2 rounded-lg bg-white/80 border p-2 ${check.ok ? 'border-emerald-200 text-emerald-800' : check.critical ? 'border-rose-300 text-rose-900' : 'border-amber-200 text-amber-900'}`}>
                          {check.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                          <span>
                            {check.label}{check.critical && <span className="ml-1 text-[10px] font-bold uppercase">(cốt lõi)</span>}: <strong>{check.ok ? 'đã thấy' : 'chưa thấy · cần đối chiếu/bổ sung'}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                    {missingCriticalChecks.length > 0 && (
                      <p className="text-xs font-semibold text-rose-800">
                        Thiếu {missingCriticalChecks.length} mục cốt lõi. Hãy bổ sung nội dung, hoặc ghi chú lý do vẫn duyệt (ví dụ: tài liệu chuyên đề chỉ nói về IPM) — tối thiểu {MIN_NOTES_FOR_INCOMPLETE_APPROVAL} ký tự.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                      <span>Độ dài: {reviewText.length.toLocaleString('vi-VN')} ký tự</span>
                      <span>Chunks hiện tại: {selectedDoc.chunks?.length || 0}</span>
                      {selectedDoc.contentText?.startsWith('[OCR bằng AI từ PDF scan') && <span className="font-bold text-amber-800">Đã OCR bằng AI · cần so từng trang với PDF gốc</span>}
                    </div>
                    <button type="button" onClick={handleDownloadOriginalFile} disabled={isDownloadingOriginal || !selectedDoc.hasOriginalFile} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 disabled:opacity-50">
                      <Download className="w-3.5 h-3.5" /> {isDownloadingOriginal ? 'Đang tải file gốc…' : selectedDoc.hasOriginalFile ? `Tải file gốc ${selectedDoc.fileType} để đối chiếu` : 'Không có file gốc lưu cùng tài liệu'}
                    </button>
                    <textarea
                      value={reviewText}
                      onChange={e => { setReviewText(e.target.value); setReviewConfirmed(false); }}
                      maxLength={200000}
                      rows={14}
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label="Toàn văn đã trích xuất, có thể chỉnh sửa"
                    />
                    <label className="block text-xs font-semibold text-slate-700">Ghi chú rà soát (nếu cần)
                      <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal" placeholder="Trang/đoạn cần xem lại, thông tin còn thiếu..." />
                    </label>
                    <label className="flex items-start gap-2 text-xs text-slate-800">
                      <input type="checkbox" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} className="mt-0.5" />
                      {selectedDoc.hasOriginalFile ? 'Tôi đã đối chiếu nội dung ở trên với file gốc đã tải xuống' : 'Tôi đã đối chiếu nội dung với nguồn đáng tin cậy bên ngoài hoặc xác minh đây là nội dung nhập chủ động'}; việc duyệt không đồng nghĩa chứng nhận tuân thủ VietGAP.
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={isSavingReview} onClick={() => handleReviewDocument(false)} className="px-3 py-2 rounded-lg border border-rose-300 bg-white text-rose-800 text-xs font-bold disabled:opacity-50">Lưu · cần chỉnh sửa</button>
                      <button type="button" disabled={isSavingReview || !reviewConfirmed} onClick={() => handleReviewDocument(true)} className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">{isSavingReview ? 'Đang lưu…' : 'Xác nhận & duyệt'}</button>
                    </div>
                  </section>
                )}

                {/* Trạng thái trích xuất có trích dẫn: mọi trường bên dưới đến từ đây */}
                {(() => {
                  const ex = selectedDoc.extraction;
                  // Kết quả tạo theo quy tắc kiểm chứng cũ: worker nền đang/ sẽ trích xuất lại, không coi là dữ liệu đúng hiện hành.
                  const isStale = Boolean(ex) && (ex!.rulesVersion ?? 0) < EXTRACTION_RULES_VERSION;
                  const kept = ex ? ex.fields.filter(f => f.value).length : 0;
                  const tone = !ex || isStale ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-sky-50 border-sky-200 text-sky-900';
                  return (
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${tone}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {!ex
                      ? <>Tài liệu chưa được trích xuất (vừa tải lên, toàn văn vừa sửa, hoặc lần trước AI không phản hồi). Hệ thống tự trích xuất nền; có thể bấm để chạy ngay.</>
                      : isStale
                        ? <><strong>Kết quả cũ</strong> theo quy tắc kiểm chứng trước đây — có thể thiếu hoặc sai số ngày. Hệ thống đang tự trích xuất lại; bấm "Trích xuất lại" để chạy ngay.</>
                        : <>Các trường dưới đây do {ex.extractedBy || 'AI'} trích, <strong>mỗi giá trị đều có câu trích nguyên văn trong tài liệu</strong>; trường không có trích dẫn được ghi là "Không có trong tài liệu".</>}
                  </span>
                  <button type="button" onClick={handleReextractDocument} disabled={isReextracting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 disabled:opacity-50">
                    {isReextracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isReextracting ? 'Đang trích xuất… (có thể mất 1–2 phút)' : selectedDoc.extractionStatus === 'extracted' ? 'Trích xuất lại' : 'Trích xuất bằng AI'}
                  </button>
                  </div>
                  {ex && (
                    <div className="text-[11px] opacity-90 flex flex-wrap gap-x-3">
                      <span>Lúc: {new Date(ex.extractedAtUtc).toLocaleString('vi-VN')}</span>
                      <span>Quy tắc kiểm chứng: v{ex.rulesVersion ?? 0}{isStale ? ` (hiện hành v${EXTRACTION_RULES_VERSION})` : ''}</span>
                      <span>Giữ lại {kept}/{ex.fields.length} trường · {ex.stages.length} giai đoạn</span>
                      {(ex.proposedCount ?? 0) > 0 && <span>AI đề xuất {ex.proposedCount} trường</span>}
                    </div>
                  )}
                  {ex && (ex.rejectedFields?.length ?? 0) > 0 && (
                    <div className="text-[11px] text-rose-800">
                      Bị loại vì câu trích không có trong tài liệu hoặc số liệu không khớp: {ex.rejectedFields!.join(', ')}.
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* 1. Đất, Giá thể & Nguồn nước */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-800 flex items-center gap-2">
                    <Microscope className="w-4 h-4 text-emerald-600" /> 1. Kiểm Soát Đất, Giá Thể & Nguồn Nước
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Loại đất & Giá thể:</div>
                      <div className="text-slate-800 leading-relaxed font-medium">{selectedDoc.soilManagement.soilType}</div>
                      <SourceTag doc={selectedDoc} field="soilType" />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Giới hạn Kim loại nặng:</div>
                      <div className="text-amber-800 font-mono font-medium leading-relaxed">{selectedDoc.soilManagement.heavyMetalLimits}</div>
                      <SourceTag doc={selectedDoc} field="heavyMetalLimits" />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Tiêu chuẩn Nước & Vi sinh:</div>
                      <div className="text-cyan-800 font-medium leading-relaxed">{selectedDoc.waterManagement.waterSourceStandard} • {selectedDoc.waterManagement.eColiLimit}</div>
                      <SourceTag doc={selectedDoc} field="waterSourceStandard" />
                      <SourceTag doc={selectedDoc} field="eColiLimit" />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Khoảng cách cách ly ô nhiễm:</div>
                      <div className="text-slate-800 leading-relaxed font-medium">{selectedDoc.soilManagement.isolationDistance}</div>
                      <SourceTag doc={selectedDoc} field="isolationDistance" />
                    </div>
                  </div>
                </div>

                {/* 2. Quy định Phân bón & Phòng trừ dịch hại IPM */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> 2. Phân Bón, Thuốc BVTV (IPM) & Thời Gian Cách Ly (PHI)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Quy định Phân bón hữu cơ:</div>
                      <div className="text-slate-800 leading-relaxed font-medium">{selectedDoc.fertilizerRules.organicRequirements}</div>
                      <SourceTag doc={selectedDoc} field="organicRequirements" />
                      <div className="mt-1 text-[11px] text-amber-700 font-bold">Cách ly trước thu hoạch: {formatDays(selectedDoc.fertilizerRules.preHarvestIntervalDays)}</div>
                      <SourceTag doc={selectedDoc} field="fertilizerPreHarvestDays" />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-semibold mb-1">Kiểm soát sâu bệnh IPM:</div>
                      <div className="text-slate-800 leading-relaxed font-medium">{selectedDoc.pestManagementIPM.ipmPrinciples}</div>
                      <SourceTag doc={selectedDoc} field="ipmPrinciples" />
                      <div className="mt-1 text-[11px] text-emerald-700 font-bold">Thuốc sinh học: {selectedDoc.pestManagementIPM.permittedBioPesticides}</div>
                      <SourceTag doc={selectedDoc} field="permittedBioPesticides" />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                    <strong>Hóa chất cấm tuyệt đối:</strong> {selectedDoc.pestManagementIPM.prohibitedChemicals}
                    <SourceTag doc={selectedDoc} field="prohibitedChemicals" />
                  </div>
                </div>

                {/* 3. Vi khí hậu & Các giai đoạn sinh trưởng */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-sky-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-600" /> 3. Các Giai Đoạn Vận Hành Vi Khí Hậu ({selectedDoc.stagesOverview.length} Giai đoạn)
                    </h4>
                    <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-bold">
                      Chu kỳ: {formatDays(selectedDoc.climateRequirements.growthDays)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedDoc.stagesOverview.length === 0 && (
                      <p className="text-xs text-slate-500 italic">Tài liệu không mô tả rõ các giai đoạn sinh trưởng (hoặc chưa trích xuất); hệ thống không tự suy ra giai đoạn.</p>
                    )}
                    {selectedDoc.stagesOverview.map((stg, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-900">{i + 1}. {stg.name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-[11px] border border-emerald-200 font-bold">
                            {stg.days ? `${stg.days} ngày` : '[không nêu số ngày]'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-1.5">
                          <div>Nhiệt độ: <strong className="text-emerald-700">{stg.temp}</strong></div>
                          <div>Độ ẩm: <strong className="text-cyan-700">{stg.moisture}</strong></div>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          <span className="text-slate-500 font-medium">Tưới & Bón:</span> {stg.fertilizerAction}
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5">
                          <span className="text-slate-500 font-medium">IPM / Bảo vệ:</span> {stg.ipmAction}
                        </div>
                        {stg.evidence && (
                          <div className="mt-1 text-[10px] text-slate-500 italic">
                            Nguồn{stg.page ? `: trang ${stg.page}` : ''} · “{stg.evidence.length > 160 ? stg.evidence.slice(0, 160) + '…' : stg.evidence}”
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Thu hoạch & Bao gói an toàn */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" /> Vệ Sinh Thu Hoạch & Truy Xuất Nguồn Gốc (QR Code):
                  </div>
                  {([
                    ['harvestToolsStandard', 'Thu hoạch', selectedDoc.harvestSafety.harvestToolsStandard],
                    ['waterWashingStandard', 'Sơ chế', selectedDoc.harvestSafety.waterWashingStandard],
                    ['packagingMaterial', 'Bao bì', selectedDoc.harvestSafety.packagingMaterial],
                    ['traceabilityQr', 'Truy xuất', selectedDoc.harvestSafety.traceabilityQr]
                  ] as const).map(([field, label, value]) => (
                    <div key={field} className="text-slate-600 leading-relaxed text-[11px]">
                      <span className="text-slate-500 font-medium">{label}:</span> {value}
                      <SourceTag doc={selectedDoc} field={field} />
                    </div>
                  ))}
                </div>

                {/* 5. Nội dung & Đoạn Trích Xuất RAG Thực Tế Từ Tệp Gốc (PDF / DB Chunks) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600" /> 5. Đoạn Trích Xuất RAG Từ Tệp Gốc & DB ({selectedDoc.chunks?.length || 0} Đoạn)
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedDoc.fileType} • Nguồn: PostgreSQL
                    </span>
                  </div>

                  {isLoadingDetail ? (
                    <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-slate-500 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      Đang tải trích xuất từ cơ sở dữ liệu...
                    </div>
                  ) : selectedDoc.chunks && selectedDoc.chunks.length > 0 ? (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {selectedDoc.chunks.map((chk) => (
                        <div key={chk.id || chk.chunkIndex} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:border-emerald-400 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-emerald-800 flex items-center gap-1.5 text-[11px]">
                              <Layers className="w-3.5 h-3.5 text-emerald-600" /> Đoạn Trích #{chk.chunkIndex + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {chk.hasEmbedding && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-800 border border-purple-200">
                                  Vector Embedding (768d)
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-700 text-xs leading-relaxed font-sans whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 mb-2">
                            {chk.content}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {chk.cropTags && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Cây: {chk.cropTags}
                              </span>
                            )}
                            {chk.keywords && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Từ khóa: {chk.keywords}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      {selectedDoc.contentText ? (
                        <p className="leading-relaxed whitespace-pre-line text-xs text-slate-700">{selectedDoc.contentText}</p>
                      ) : (
                        <p className="italic">Chưa có đoạn băm nhỏ văn bản cho tài liệu này.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Hành động */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setIsFullTextModalOpen(true)}
                    className="py-3 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" /> Xem Văn Bản Gốc PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
                <p>Chọn một hồ sơ VietGAP bên trái để xem đầy đủ thông tin kỹ thuật</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: Ma Trận Đầy Đủ Tất Cả Tiêu Chuẩn VietGAP */}
      {activeTab === 'CRITERIA_MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Ma Trận Đối Chiếu Tiêu Chuẩn VietGAP Toàn Diện (TCVN 11892-1:2026)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Tổng hợp toàn bộ chỉ tiêu Đất, Nước, Phân bón, IPM và Ngưỡng thu hoạch cho từng giống cây</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center text-xs">
                <button
                  onClick={() => setMatrixFilter('CROPS_ONLY')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    matrixFilter === 'CROPS_ONLY' 
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60 font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {documents.filter(doc => doc.isCropStandard).length} Giống Cây Trồng
                </button>
                <button
                  onClick={() => setMatrixFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    matrixFilter === 'ALL' 
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60 font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất Cả Hồ Sơ ({documents.length})
                </button>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm Quy Chuẩn Cây Mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {documents
                  .filter(doc => matrixFilter === 'ALL' ? true : doc.isCropStandard)
                  .map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{doc.cropName}</div>
                      <div className="text-[11px] font-mono text-emerald-700 font-semibold">{doc.code}</div>
                      <div className="text-[10px] text-slate-500">{doc.category}</div>
                      {(doc.isThematicStandard || doc.profileGenerated) && (
                        <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${doc.isThematicStandard ? 'text-blue-700' : 'text-emerald-700'}`}>
                          {doc.isThematicStandard ? <BookOpen className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {doc.isThematicStandard
                            ? 'Không áp dụng profile (chuyên đề)'
                            : `Đã sinh profile: ${doc.profileName || 'Đã liên kết'}`}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-800 font-medium">{doc.soilManagement.soilType}</div>
                      <div className="text-amber-800 font-mono text-[11px] mt-0.5 font-semibold">{doc.soilManagement.heavyMetalLimits}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-cyan-800 font-medium">{doc.waterManagement.waterSourceStandard}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{doc.waterManagement.eColiLimit}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-800">{doc.fertilizerRules.organicRequirements}</div>
                      <div className="text-emerald-700 font-bold text-[11px] mt-0.5">Cách ly PHI: {formatDays(doc.fertilizerRules.preHarvestIntervalDays)}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-800">{doc.pestManagementIPM.ipmPrinciples}</div>
                      <div className="text-rose-700 font-semibold text-[11px] mt-0.5">Cấm: {doc.pestManagementIPM.prohibitedChemicals}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>T: <span className="text-emerald-700 font-bold">{doc.climateRequirements.tempOptimal}</span></div>
                      <div>Ẩm: <span className="text-cyan-700 font-bold">{doc.climateRequirements.moistureOptimal}</span></div>
                      <div>pH/EC: <span className="text-amber-800 font-bold">{doc.climateRequirements.pHOptimal} | {doc.climateRequirements.ecOptimal}</span></div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {doc.isThematicStandard ? (
                        <span className="text-[11px] text-blue-700 font-semibold px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 inline-block">
                          Chuyên đề chung
                        </span>
                      ) : (
                        <span />
                      )}
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
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-xs">
            <h3 className="font-bold text-amber-900 text-lg flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" /> Quản Lý Dịch Hại Tổng Hợp (IPM) & Thời Gian Cách Ly (PHI) Theo VietGAP
            </h3>
            <p className="text-slate-700 text-xs leading-relaxed max-w-3xl">
              VietGAP yêu cầu kiểm soát dịch hại ưu tiên bằng biện pháp sinh học, cơ học và thiên địch. 
              Mọi loại thuốc BVTV được phép sử dụng phải tuân thủ nghiêm ngặt <strong>Thời gian cách ly (Pre-Harvest Interval - PHI)</strong> 
              để đảm bảo không còn dư lượng thuốc BVTV vượt ngưỡng an toàn thực phẩm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {documents.filter(doc => doc.isCropStandard).map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{doc.cropName}</h4>
                    <span className="text-xs text-emerald-700 font-mono font-semibold">{doc.code}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    PHI: {formatDays(doc.pestManagementIPM.isolationQuarantineDays)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block">Biện pháp IPM:</span>
                    <span className="text-slate-800 font-medium">{doc.pestManagementIPM.ipmPrinciples}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Chế phẩm sinh học cho phép:</span>
                    <span className="text-emerald-700 font-medium">{doc.pestManagementIPM.permittedBioPesticides}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Hoạt chất cấm tuyệt đối:</span>
                    <span className="text-rose-700 font-medium">{doc.pestManagementIPM.prohibitedChemicals}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: Quản Lý Đất, Giá Thể & Nguồn Nước Tưới (QCVN 03-MT & QCVN 08-MT) */}
      {activeTab === 'SOIL_WATER' && (
        <div className="space-y-6">
          <div className="bg-cyan-50/70 border border-cyan-200 rounded-2xl p-6 shadow-xs">
            <h3 className="font-bold text-cyan-900 text-lg flex items-center gap-2 mb-2">
              <Droplets className="w-5 h-5 text-cyan-600" /> Quản Lý Đất, Giá Thể & Nguồn Nước Tưới (QCVN 03-MT & QCVN 08-MT)
            </h3>
            <p className="text-slate-700 text-xs leading-relaxed max-w-3xl">
              Các chỉ tiêu đất, nước và tần suất kiểm nghiệm phải được xác định từ tiêu chuẩn hiện hành, quy chuẩn môi trường áp dụng và hồ sơ đánh giá nguy cơ của cơ sở. Bảng dưới đây không tự đặt ngưỡng thay thế cho nguồn chính thức.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                  <Microscope className="w-3.5 h-3.5 text-amber-600" /> Đất và giá thể
                </span>
                <p className="text-[11px] text-slate-600">Đối chiếu quy chuẩn hiện hành, loại đất/giá thể, phương pháp thử và kết quả phân tích tại cơ sở.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-cyan-800 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600" /> Nguồn nước tưới
                </span>
                <p className="text-[11px] text-slate-600">Xác định chỉ tiêu, giới hạn và phương pháp thử theo nguồn nước cùng quy định áp dụng.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Vành Đai Cách Ly Nguồn Ô Nhiễm
                </span>
                <p className="text-[11px] text-slate-600">Khoảng cách và biện pháp cách ly xác định theo đánh giá nguy cơ tại địa điểm sản xuất và yêu cầu áp dụng.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documents.filter(doc => doc.isCropStandard).map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      {doc.cropName}
                      <span className="text-xs text-emerald-700 font-mono font-normal">({doc.code})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">{doc.category} • {doc.issuingAuthority}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                    pH Nước: {doc.waterManagement.phWaterRange}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Cột Đất & Giá Thể */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-amber-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                      <Sprout className="w-3.5 h-3.5 text-amber-600" /> Đất & Giá Thể Trồng
                    </span>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Loại đất phù hợp:</span>
                      <span className="text-slate-800 font-medium">{doc.soilManagement.soilType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Giới hạn kim loại nặng:</span>
                      <span className="text-amber-800 font-mono text-[11px] font-semibold">{doc.soilManagement.heavyMetalLimits}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Khoảng cách cách ly ô nhiễm:</span>
                      <span className="text-slate-700">{doc.soilManagement.isolationDistance}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Kỹ thuật xử lý đất/giá thể:</span>
                      <span className="text-slate-700 italic">{doc.soilManagement.soilPreparation}</span>
                    </div>
                  </div>

                  {/* Cột Nước Tưới & Dinh Dưỡng */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-cyan-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                      <Droplets className="w-3.5 h-3.5 text-cyan-600" /> Nước Tưới & Dinh Dưỡng
                    </span>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Quy chuẩn nguồn nước:</span>
                      <span className="text-cyan-900 font-medium">{doc.waterManagement.waterSourceStandard}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Giới hạn vi sinh vật:</span>
                      <span className="text-slate-700">{doc.waterManagement.eColiLimit}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Dải pH nước khuyến nghị:</span>
                      <span className="text-emerald-700 font-mono font-bold">{doc.waterManagement.phWaterRange}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Phương pháp tưới tiêu:</span>
                      <span className="text-slate-700">{doc.waterManagement.irrigationMethod}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsFullTextModalOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-600" /> Xem Văn Bản Gốc
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: Vệ Sinh Thu Hoạch, Đóng Gói An Toàn & Tem Truy Xuất Nguồn Gốc (GS1 / QR Code) */}
      {activeTab === 'HARVEST_TRACE' && (
        <div className="space-y-6">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 shadow-xs">
            <h3 className="font-bold text-emerald-900 text-lg flex items-center gap-2 mb-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" /> Vệ Sinh Thu Hoạch, Đóng Gói An Toàn & Tem Truy Xuất Nguồn Gốc (GS1 / QR Code)
            </h3>
            <p className="text-slate-700 text-xs leading-relaxed max-w-3xl">
              VietGAP bắt buộc kiểm soát chặt chẽ vệ sinh dụng cụ thu hái, nguồn nước rửa sơ chế và vật liệu đóng gói an toàn thực phẩm.
              Toàn bộ sản phẩm trước khi xuất bán phải được dán tem định danh QR Code chuẩn GS1, kết nối trực tiếp với 
              <strong> Nhật Ký Canh Tác Điện Tử SmartFarm</strong> để người tiêu dùng tra cứu nguồn gốc, ngày thu hái và xác nhận thời gian cách ly PHI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Dụng Cụ Khử Trùng & Nước Rửa Đạt Chuẩn
                </span>
                <p className="text-[11px] text-slate-600">Dụng cụ chứa đựng khử trùng bằng cồn 70° hoặc Cloramin B; nước rửa sơ chế đạt chuẩn nước ăn uống QCVN 01-1:2018/BYT.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-teal-800 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-teal-600" /> Bao Bì & Bảo Quản Sau Thu Hoạch
                </span>
                <p className="text-[11px] text-slate-600">Bao bì nhựa PE nguyên sinh đạt chuẩn ATTP, dán tem nhãn thành phẩm, bảo quản kho mát kiểm soát nhiệt độ.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1 shadow-xs">
                <span className="text-[11px] font-bold text-cyan-800 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-cyan-600" /> Tem Điện Tử QR Code Chuẩn GS1
                </span>
                <p className="text-[11px] text-slate-600">Định danh mã lô điện tử kết nối IoT cảm biến, chứng thực 100% hoàn thành thời gian cách ly PHI trước khi tiêu thụ.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documents.filter(doc => doc.isCropStandard).map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      {doc.cropName}
                      <span className="text-xs text-emerald-700 font-mono font-normal">({doc.code})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">{doc.category} • Thời gian sinh trưởng: {formatDays(doc.climateRequirements.growthDays)}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Đạt Chuẩn VietGAP
                  </span>
                </div>

                {/* Khối Mô Phỏng Nhãn Tem Truy Xuất Nguồn Gốc QR GS1 */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-dashed border-emerald-300 flex items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <span className="text-[10px] font-mono text-emerald-800 uppercase tracking-wider block font-bold">
                      MÃ LÔ VIETGAP GS1 ĐIỆN TỬ:
                    </span>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      LOT-2026-{doc.code.replace(/\s+/g, '')}-{(doc.id.replace(/\D/g, '') || '01').slice(0, 4)}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Chứng chỉ: <strong className="text-slate-800">{doc.code}</strong> • Cách ly PHI: <strong className="text-emerald-700 font-bold">{formatDays(doc.pestManagementIPM.isolationQuarantineDays)} (Đã Hoàn Thành)</strong>
                    </p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg flex flex-col items-center justify-center shrink-0 shadow-xs border border-slate-200">
                    <QrCode className="w-10 h-10 text-slate-900" />
                    <span className="text-[8px] font-mono font-bold text-slate-800 mt-0.5">SMARTFARM</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Khâu Vệ Sinh Thu Hoạch */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-teal-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Vệ Sinh Dụng Cụ & Nước Sơ Chế
                    </span>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Dụng cụ chứa đựng:</span>
                      <span className="text-slate-800 font-medium">{doc.harvestSafety.harvestToolsStandard}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Nước rửa sơ chế:</span>
                      <span className="text-cyan-800 font-medium">{doc.harvestSafety.waterWashingStandard}</span>
                    </div>
                  </div>

                  {/* Khâu Đóng Gói & Tem QR */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" /> Bao Bì & Mã QR Truy Xuất
                    </span>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Bao bì đóng gói:</span>
                      <span className="text-slate-800 font-medium">{doc.harvestSafety.packagingMaterial}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Cơ chế nhật ký & mã QR:</span>
                      <span className="text-emerald-700 font-medium">{doc.harvestSafety.traceabilityQr}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Upload Tệp VietGAP */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Thêm Dữ Liệu Quy Chuẩn VietGAP Toàn Diện (PDF / DOCX / TXT)</h3>
                  <p className="text-xs text-slate-500">Chọn tệp, kiểm tra thông tin nhận diện và sửa lại trước khi lưu nếu cần</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedUploadFile(null);
                  setUploadFormData(initialUploadFormData);
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
              {/* Chọn File */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-5 text-center transition-colors bg-slate-50/70">
                <input
                  type="file"
                  id="vietgap-file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="vietgap-file-input" className="cursor-pointer flex flex-col items-center">
                  <UploadCloud className="w-9 h-9 text-emerald-600 mb-2 animate-bounce" />
                  <span className="text-sm font-semibold text-slate-800">
                    {uploadFormData.fileName ? uploadFormData.fileName : 'Nhấn để chọn tệp tài liệu (.PDF, .DOCX, .TXT)'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    {uploadFormData.fileSize !== '0 MB' ? `Dung lượng: ${uploadFormData.fileSize}` : 'Tải file để lưu thành nguồn tri thức độc lập và chờ người duyệt (tối đa 15MB)'}
                  </span>
                </label>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs leading-relaxed">
                Tài liệu được lưu như một nguồn tri thức độc lập, không cần điền đủ trường Growth Profile. Kiểm tra <b>tên tài liệu, cây trồng, nguồn ban hành và phiên bản</b>; tài liệu chỉ được truy xuất trong RAG sau khi người duyệt xác nhận.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên tài liệu</label>
                  <input
                    type="text"
                    value={uploadFormData.title}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                    placeholder="Quy trình kỹ thuật sản xuất cà chua an toàn"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cây trồng áp dụng</label>
                  <input
                    type="text"
                    value={uploadFormData.cropName}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, cropName: e.target.value })}
                    placeholder="cà chua"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cơ quan / đơn vị ban hành</label>
                  <input
                    type="text"
                    value={uploadFormData.author}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, author: e.target.value })}
                    placeholder="Để trống nếu tài liệu không ghi rõ"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm / phiên bản</label>
                  <input
                    type="text"
                    value={uploadFormData.version}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, version: e.target.value })}
                    placeholder="Ví dụ: 2024 hoặc V1.0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại tài liệu</label>
                  <select
                    value={uploadFormData.documentType}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, documentType: e.target.value as AgricultureDocumentType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 text-xs font-medium"
                  >
                    {(Object.keys(DOCUMENT_TYPE_INFO) as AgricultureDocumentType[]).map(t => (
                      <option key={t} value={t}>{DOCUMENT_TYPE_INFO[t].label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">{DOCUMENT_TYPE_INFO[uploadFormData.documentType].requirement}</p>
                </div>
              <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {uploadFormData.documentType === 'Thematic' ? 'Chuyên đề (bắt buộc)' : 'Danh mục kỹ thuật (RAG)'}
                  </label>
                  <select
                    value={uploadFormData.category}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 text-xs font-medium"
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

              <fieldset className="text-xs">
                <legend className="font-semibold text-slate-700 mb-1">Tài liệu bao quát những mảng nào? (chọn nhiều)</legend>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map(t => (
                    <label key={t.value} className={`px-2.5 py-1 rounded-full border cursor-pointer ${uploadFormData.topics.includes(t.value) ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold' : 'bg-white border-slate-300 text-slate-700'}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={uploadFormData.topics.includes(t.value)}
                        onChange={e => setUploadFormData({
                          ...uploadFormData,
                          topics: e.target.checked ? [...uploadFormData.topics, t.value] : uploadFormData.topics.filter(x => x !== t.value)
                        })}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Mỗi tài liệu là một nguồn RAG riêng, không cần đủ mọi mục. Khi duyệt, hệ thống chỉ kiểm tra nguồn ban hành và nội dung của các mảng đã chọn.
                </p>
              </fieldset>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedUploadFile(null);
                    setUploadFormData(initialUploadFormData);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedUploadFile}
                  className="px-5 py-2 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải file, trích xuất và lưu tài liệu...
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

      {/* Modal Chuyển Đổi Sang Growth Profile với Tùy Biến Giai Đoạn & Người Kiểm Duyệt Cuối */}
      {isGenerateModalOpen && convertingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-6xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] flex flex-col text-slate-800">
            
            {/* Modal Header & Navigation Stepper */}
            <div className="border-b border-slate-200 pb-4 mb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg sm:text-xl">Thiết Lập & Kiểm Duyệt Hồ Sơ Sinh Trưởng (Growth Profile)</h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Chuẩn hóa phân kỳ sinh trưởng từ Quy chuẩn VietGAP: <span className="text-emerald-700 font-bold">{convertingDoc.code}</span> ({convertingDoc.cropName})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors text-base"
                  title="Đóng cửa sổ"
                >
                  ✕
                </button>
              </div>

              {/* 2-Step Progress Indicator */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConvertStep('BUILDER')}
                  className={`py-2.5 px-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                    convertStep === 'BUILDER'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs ring-1 ring-emerald-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      convertStep === 'BUILDER' ? 'bg-[#119653] text-white font-extrabold shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}>
                      1
                    </span>
                    <span className="text-xs sm:text-sm font-semibold">Cấu Trúc & Tinh Chỉnh Giai Đoạn</span>
                  </div>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    {editableStages.length} giai đoạn
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (validateStagesBeforeReview()) {
                      setConvertStep('REVIEW');
                    }
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                    convertStep === 'REVIEW'
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-xs ring-1 ring-cyan-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      convertStep === 'REVIEW' ? 'bg-cyan-600 text-white font-extrabold shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}>
                      2
                    </span>
                    <span className="text-xs sm:text-sm font-semibold">Thẩm Định & Người Kiểm Duyệt Cuối</span>
                  </div>
                  <ShieldCheck className="w-4 h-4 opacity-75" />
                </button>
              </div>
            </div>

            {/* Modal Body with Scrolling */}
            <div className="overflow-y-auto flex-1 pr-1.5 space-y-4 text-xs sm:text-sm">
              
              {/* STEP 1: CẤU TRÚC VÀ TINH CHỈNH GIAI ĐOẠN */}
              {convertStep === 'BUILDER' && (
                <div className="space-y-4">
                  {/* Cây trồng và thông tin nguồn */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Tài liệu tham chiếu VietGAP:</div>
                      <div className="font-bold text-slate-900 text-sm line-clamp-1">{convertingDoc.title}</div>
                      <div className="text-emerald-700 font-mono text-xs mt-1">
                        Mã: {convertingDoc.code} • Cây trồng: <strong className="text-slate-900">{convertingDoc.cropName}</strong>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                      <label className="block font-semibold text-slate-700 mb-1 text-xs">
                        Liên kết Thư viện Cây trồng trong hệ thống:
                      </label>
                      <select
                        value={selectedCropForConvert}
                        onChange={(e) => setSelectedCropForConvert(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-xs font-medium cursor-pointer"
                      >
                        <option value="">-- Tự động tạo Cây Trồng Mới: "{convertingDoc.cropName}" --</option>
                        {crops.map((c) => (
                          <option key={c.cropId} value={c.cropId}>
                            {c.name} ({c.category || 'Mặc định'}) - Chu kỳ {c.growthCycleDays || 90} ngày
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Thanh Tiến Trình Chu Kỳ Sinh Trưởng (Visual Zero-Overlap Timeline Bar) */}
                  {(() => {
                    const timeline = calculateTimeline(editableStages);
                    const totalDays = timeline.reduce((acc, s) => acc + s.durationDays, 0);
                    const colors = [
                      'from-emerald-600 to-teal-600',
                      'from-teal-600 to-cyan-600',
                      'from-cyan-600 to-blue-600',
                      'from-indigo-600 to-purple-600',
                      'from-amber-600 to-orange-600'
                    ];

                    return (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">Tiến Trình Chu Kỳ Sinh Trưởng (Timeline Phân Kỳ):</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono border border-emerald-300">
                              ✓ 100% Không chồng chéo ngày
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 text-xs">Tổng chu kỳ: </span>
                            <span className="font-bold text-emerald-700 text-base font-mono">{totalDays} Ngày</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full h-8 bg-slate-200 rounded-xl p-1 flex gap-1 border border-slate-300 overflow-hidden">
                          {timeline.map((st, i) => {
                            const pct = Math.max(8, (st.durationDays / totalDays) * 100);
                            return (
                              <div
                                key={i}
                                style={{ width: `${pct}%` }}
                                className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-xs px-1 truncate transition-all`}
                                title={`Giai đoạn ${st.stageOrder}: ${st.name} (Ngày ${st.startDay} - ${st.endDay}: ${st.durationDays} ngày)`}
                              >
                                GĐ {st.stageOrder}: {st.durationDays}d
                              </div>
                            );
                          })}
                        </div>

                        {/* Compact Stage Timeline Ribbon */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {timeline.map((st, i) => (
                            <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="font-semibold text-slate-800">GĐ {st.stageOrder}: {st.name}</span>
                              <span className="text-emerald-800 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                                Ngày {st.startDay} - {st.endDay} ({st.durationDays}d)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* AI Profile Drafting Banner & Trigger */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold text-xs sm:text-sm flex items-center gap-2">
                          <span>AI hỗ trợ trích xuất dữ liệu từ tài liệu</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-mono border border-emerald-300">
                            Không Cần Nhập Thêm Câu Hỏi
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          AI chỉ dùng thông tin tìm thấy trong tài liệu. Chỉ tiêu không có nguồn sẽ không được xem là đã xác minh (<strong className="text-emerald-700">{convertingDoc.code}</strong>).
                        </div>
                      </div>
                    </div>
                    <label className="flex flex-col text-[11px] text-slate-600 shrink-0">
                      Nguồn dữ liệu
                      <select
                        value={profileSourceScope}
                        onChange={e => setProfileSourceScope(e.target.value as 'crop' | 'document')}
                        className="mt-0.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="crop">Mọi tài liệu đã duyệt của cây {convertingDoc.cropName}</option>
                        <option value="document">Chỉ tài liệu này</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAiDraftGrowthProfile()}
                      disabled={isAiDraftingProfile}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {isAiDraftingProfile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Đang Đọc File & Trích Xuất...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white" />
                          <span>✨ Trích xuất từ tài liệu</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Bộ Chọn Số Lượng Giai Đoạn & Thêm Mới */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 font-semibold text-xs sm:text-sm">Mẫu cấu trúc số giai đoạn:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(3)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            activeStagePreset === 3
                              ? 'bg-[#119653] text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                          }`}
                        >
                          3 Giai đoạn (Cơ bản)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(4)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            activeStagePreset === 4
                              ? 'bg-[#119653] text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                          }`}
                        >
                          4 Giai đoạn (Chuẩn VietGAP)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(5)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            activeStagePreset === 5
                              ? 'bg-[#119653] text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                          }`}
                        >
                          5 Giai đoạn (Chuyên sâu)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddStage}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 font-semibold transition-all flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm Giai Đoạn Mới
                    </button>
                  </div>

                  {/* Danh sách các thẻ Giai Đoạn có thể chỉnh sửa chi tiết */}
                  <div className="space-y-4">
                    {calculateTimeline(editableStages).map((stg, index) => (
                      <div 
                        key={index} 
                        className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-sm"
                      >
                        {/* Header của thẻ giai đoạn */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold font-mono text-xs border border-emerald-300 flex items-center justify-center shrink-0">
                              GĐ {stg.stageOrder}
                            </span>
                            <input
                              type="text"
                              value={stg.name}
                              onChange={(e) => handleUpdateStage(index, 'name', e.target.value)}
                              placeholder={`Tên giai đoạn ${stg.stageOrder}`}
                              className="font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm flex-1 focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-emerald-800 font-mono text-xs border border-slate-200 font-semibold shrink-0">
                              Ngày {stg.startDay} ➔ {stg.endDay}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                              <span className="text-slate-500 text-xs font-medium">Thời lượng:</span>
                              <input
                                type="number"
                                min="1"
                                max="180"
                                value={stg.durationDays}
                                onChange={(e) => handleUpdateStage(index, 'durationDays', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-14 bg-white border border-slate-300 rounded-lg text-emerald-700 font-bold font-mono text-center text-xs py-1 focus:outline-none focus:border-emerald-500"
                              />
                              <span className="text-slate-600 text-xs font-medium">ngày</span>
                            </div>

                            {editableStages.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStage(index)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa giai đoạn này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4 Khối thông số vi khí hậu được phối màu trực quan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {/* Nhiệt độ */}
                          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                            <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs mb-2">
                              <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                              <span>Nhiệt độ (°C)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-amber-800 block mb-0.5 font-medium">Min</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={stg.tempMin}
                                  onChange={(e) => handleUpdateStage(index, 'tempMin', Number(e.target.value))}
                                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-amber-500 focus:outline-none"
                                />
                              </div>
                              <span className="text-amber-500 font-bold text-sm mt-3">-</span>
                              <div className="flex-1">
                                <span className="text-[10px] text-amber-800 block mb-0.5 font-medium">Max</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={stg.tempMax}
                                  onChange={(e) => handleUpdateStage(index, 'tempMax', Number(e.target.value))}
                                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-amber-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Độ ẩm đất */}
                          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200">
                            <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-xs mb-2">
                              <Droplets className="w-3.5 h-3.5 text-sky-600" />
                              <span>Độ ẩm đất (%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-sky-800 block mb-0.5 font-medium">Min</span>
                                <input
                                  type="number"
                                  step="1"
                                  value={stg.moistMin}
                                  onChange={(e) => handleUpdateStage(index, 'moistMin', Number(e.target.value))}
                                  className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-sky-500 focus:outline-none"
                                />
                              </div>
                              <span className="text-sky-500 font-bold text-sm mt-3">-</span>
                              <div className="flex-1">
                                <span className="text-[10px] text-sky-800 block mb-0.5 font-medium">Max</span>
                                <input
                                  type="number"
                                  step="1"
                                  value={stg.moistMax}
                                  onChange={(e) => handleUpdateStage(index, 'moistMax', Number(e.target.value))}
                                  className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-sky-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Độ ẩm không khí */}
                          <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200">
                            <div className="flex items-center gap-1.5 text-cyan-900 font-semibold text-xs mb-2">
                              <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                              <span>Độ ẩm không khí (%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-cyan-800 block mb-0.5 font-medium">Min</span>
                                <input type="number" min="0" max="100" value={stg.airHumidityMin ?? ''} onChange={(e) => handleUpdateStage(index, 'airHumidityMin', e.target.value === '' ? undefined : Number(e.target.value))} className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-cyan-500 focus:outline-none" />
                              </div>
                              <span className="text-cyan-500 font-bold text-sm mt-3">-</span>
                              <div className="flex-1">
                                <span className="text-[10px] text-cyan-800 block mb-0.5 font-medium">Max</span>
                                <input type="number" min="0" max="100" value={stg.airHumidityMax ?? ''} onChange={(e) => handleUpdateStage(index, 'airHumidityMax', e.target.value === '' ? undefined : Number(e.target.value))} className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-cyan-500 focus:outline-none" />
                              </div>
                            </div>
                          </div>

                          {/* Độ pH */}
                          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200">
                            <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-xs mb-2">
                              <Beaker className="w-3.5 h-3.5 text-purple-600" />
                              <span>Độ pH đất / giá thể</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-purple-800 block mb-0.5 font-medium">Min</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={sanitizePh(stg.phMin, 6.0)}
                                  onChange={(e) => handleUpdateStage(index, 'phMin', sanitizePh(e.target.value, 6.0))}
                                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-purple-500 focus:outline-none"
                                />
                              </div>
                              <span className="text-purple-500 font-bold text-sm mt-3">-</span>
                              <div className="flex-1">
                                <span className="text-[10px] text-purple-800 block mb-0.5 font-medium">Max</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={sanitizePh(stg.phMax, 6.8)}
                                  onChange={(e) => handleUpdateStage(index, 'phMax', sanitizePh(e.target.value, 6.8))}
                                  className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-purple-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* EC Dinh dưỡng */}
                          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                            <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-xs mb-2">
                              <Zap className="w-3.5 h-3.5 text-emerald-600" />
                              <span>EC Dinh dưỡng (mS/cm)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-emerald-800 block mb-0.5 font-medium">Min</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={stg.ecMin}
                                  onChange={(e) => handleUpdateStage(index, 'ecMin', Number(e.target.value))}
                                  className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                              <span className="text-emerald-500 font-bold text-sm mt-3">-</span>
                              <div className="flex-1">
                                <span className="text-[10px] text-emerald-800 block mb-0.5 font-medium">Max</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={stg.ecMax}
                                  onChange={(e) => handleUpdateStage(index, 'ecMax', Number(e.target.value))}
                                  className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs text-center focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chỉ dẫn kỹ thuật Bón phân và IPM */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                            <label className="flex items-center gap-1.5 font-semibold text-emerald-800 text-xs mb-1.5">
                              <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Quy trình Tưới tiêu & Bón phân VietGAP:</span>
                            </label>
                            <input
                              type="text"
                              value={stg.fertilizerAction}
                              onChange={(e) => handleUpdateStage(index, 'fertilizerAction', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                              placeholder="Nhập hướng dẫn phân bón..."
                            />
                          </div>
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                            <label className="flex items-center gap-1.5 font-semibold text-teal-800 text-xs mb-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />
                              <span>Biện pháp Kiểm soát Dịch hại IPM & PHI:</span>
                            </label>
                            <input
                              type="text"
                              value={stg.ipmAction}
                              onChange={(e) => handleUpdateStage(index, 'ipmAction', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-teal-500"
                              placeholder="Nhập hướng dẫn IPM & cách ly..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: THẨM ĐỊNH & NGƯỜI KIỂM DUYỆT CUỐI */}
              {convertStep === 'REVIEW' && (
                <div className="space-y-4">
                  {isFallbackProfile && (
                    <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 text-sm">
                      <strong>Chưa có profile trích xuất:</strong> AI không tìm thấy đủ số liệu có căn cứ. Không tạo ngưỡng mẫu; hãy bổ sung số liệu đã xác minh trước khi lưu.
                    </div>
                  )}
                  {/* Thẻ Tổng Hợp Thẩm Định */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        RÀ SOÁT GROWTH PROFILE TRƯỚC KHI LƯU
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                        Hồ sơ Sinh trưởng: {convertingDoc.cropName} (Theo quy chuẩn {convertingDoc.code})
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tài liệu nguồn: {convertingDoc.title}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Tổng số ngày chu kỳ</span>
                      <span className="text-2xl font-bold text-emerald-700 font-mono">
                        {editableStages.reduce((sum, s) => sum + (Math.max(1, Number(s.durationDays) || 1)), 0)} Ngày
                      </span>
                      <span className="text-xs text-slate-500 block">({editableStages.length} giai đoạn liên tục)</span>
                    </div>
                  </div>

                  {aiSourceEvidence.length > 0 && (
                    <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50 text-slate-800">
                      <strong className="text-sm text-sky-950">Trích dẫn nguyên văn dùng để đối chiếu:</strong>
                      <ul className="mt-2 space-y-1 text-xs">
                        {aiSourceEvidence.map((evidence, index) => <li key={index}>• {evidence}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Bảng Đối Soát Chi Tiết Các Giai Đoạn (Audit Table) */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-900 text-xs sm:text-sm flex items-center justify-between">
                      <span>Bảng Đối Soát Chuỗi Thời Gian & Ngưỡng Vi Khí Hậu</span>
                      <span className="text-emerald-700 font-mono text-xs font-bold">✓ Đã chuẩn hóa không chồng chéo</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Giai đoạn</th>
                            <th className="py-2.5 px-3">Khung thời gian</th>
                            <th className="py-2.5 px-3">Thời lượng</th>
                            <th className="py-2.5 px-3">Nhiệt độ</th>
                            <th className="py-2.5 px-3">Ẩm đất</th>
                            <th className="py-2.5 px-3">pH / EC</th>
                            <th className="py-2.5 px-3">Hành động trọng tâm</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800">
                          {calculateTimeline(editableStages).map((stg, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3 font-semibold text-slate-900">
                                {stg.stageOrder}. {stg.name}
                              </td>
                              <td className="py-3 px-3 text-emerald-700 font-mono font-bold">
                                Ngày {stg.startDay} - {stg.endDay}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-700">{stg.durationDays} ngày</td>
                              <td className="py-3 px-3 font-mono text-amber-700 font-semibold">{stg.tempMin} - {stg.tempMax}°C</td>
                              <td className="py-3 px-3 font-mono text-sky-700 font-semibold">{stg.moistMin} - {stg.moistMax}%</td>
                              <td className="py-3 px-3 font-mono text-purple-700 font-semibold whitespace-nowrap">
                                pH {sanitizePh(stg.phMin, 6.0)} - {sanitizePh(stg.phMax, 6.8)}
                                <span className="text-slate-400 mx-1.5">|</span>
                                <span className="text-emerald-700 font-bold">EC {stg.ecMin} - {stg.ecMax}</span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 max-w-sm truncate" title={stg.fertilizerAction}>
                                {stg.fertilizerAction}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Hộp Kiểm Soát Toàn Vẹn Tự Động (Automated Integrity Checks) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm block">Kết quả Kiểm Soát Tính Toàn Vẹn Hệ Thống (Automated Audit):</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>Không chồng chéo:</strong> Chuỗi timeline liên tục, 0 ngày giao thoa hay đứt gãy.</span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>Ngưỡng vi khí hậu:</strong> Min &lt; Max đạt chuẩn an toàn VietGAP.</span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>Cây trồng mục tiêu:</strong> Đã định danh và chuẩn bị liên kết IoT Zone.</span>
                      </div>
                    </div>
                  </div>

                  {/* Tùy Biến Tên Hồ Sơ Trước Khi Ban Hành */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="block text-slate-800 font-bold text-xs sm:text-sm">
                      Tên Hồ Sơ Sinh Trưởng Ban Hành Vào CSDL:
                    </label>
                    <input
                      type="text"
                      value={customProfileName}
                      onChange={(e) => setCustomProfileName(e.target.value)}
                      placeholder={`VD: Hồ sơ Sinh trưởng VietGAP - ${convertingDoc.cropName}`}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-emerald-700 text-xs sm:text-sm font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-500 block">
                      Bạn có thể chỉnh sửa tên hồ sơ để phân biệt theo mùa vụ, năm hoặc biến thể canh tác cụ thể.
                    </span>
                  </div>

                  {/* Khu Vực Ký Duyệt Của Người Kiểm Duyệt Cuối (Sign-Off & Approval) */}
                  <div className="p-4 sm:p-5 bg-cyan-50/50 border border-cyan-200 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-cyan-600" />
                        <span className="font-bold text-cyan-950 text-xs sm:text-sm">Xác Thực Của Người Kiểm Duyệt Cuối (Human Sign-Off):</span>
                      </div>
                      <span className="text-xs text-cyan-800 font-mono bg-cyan-100 px-2.5 py-1 rounded border border-cyan-300 font-semibold">
                        BƯỚC PHÊ DUYỆT BẮT BUỘC
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-slate-700 text-xs mb-1 font-semibold">Cán bộ / Người kiểm duyệt chịu trách nhiệm:</label>
                        <input
                          type="text"
                          value={reviewerName}
                          onChange={(e) => setReviewerName(e.target.value)}
                          className="w-full bg-white border border-cyan-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs mb-1 font-semibold">Ghi chú thẩm định & Căn cứ kỹ thuật:</label>
                        <input
                          type="text"
                          value={reviewerNotes}
                          onChange={(e) => setReviewerNotes(e.target.value)}
                          className="w-full bg-white border border-cyan-300 rounded-xl px-3.5 py-2 text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Checkbox Cam Kết */}
                    <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-cyan-200 cursor-pointer hover:bg-cyan-50/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={reviewerConfirmed}
                        onChange={(e) => setReviewerConfirmed(e.target.checked)}
                        className="mt-1 rounded border-cyan-500 text-cyan-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs text-slate-700 leading-relaxed font-medium">
                        Tôi xác nhận đã rà soát các giá trị và căn cứ nguồn của Growth Profile này. Việc lưu profile không phải chứng nhận hoặc xác nhận tuân thủ VietGAP; các giá trị chưa có nguồn xác minh sẽ không được xem là yêu cầu tiêu chuẩn.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-4 mt-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              {convertStep === 'BUILDER' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsGenerateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStagesBeforeReview()) {
                        setConvertStep('REVIEW');
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    Tiếp Tục: Thẩm Định & Kiểm Duyệt Cuối <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConvertStep('BUILDER')}
                    className="px-4 py-2.5 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 border border-slate-300 cursor-pointer"
                  >
                    ⬅ Quay Lại Tinh Chỉnh Giai Đoạn
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || !reviewerConfirmed}
                    onClick={handleExecuteConvertToProfile}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-800/30 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" /> Đang Ban Hành Hồ Sơ...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-white" /> Phê Duyệt & Ban Hành Hồ Sơ Sinh Trưởng
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT TÀI LIỆU / NÂNG CẤP PHIÊN BẢN (V1 -> V2) */}
      {isUpdateModalOpen && updatingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Cập Nhật & Nâng Cấp Phiên Bản Tài Liệu</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đang cập nhật tài liệu: <strong className="text-slate-800">{updatingDoc.title}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDocumentSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Alert giải thích cơ chế giải quyết xung đột RAG */}
              <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 space-y-1">
                <div className="font-bold flex items-center gap-2 text-xs text-cyan-800">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" /> Cơ chế làm sạch Vector & Giải quyết xung đột số liệu:
                </div>
                <p className="text-[11px] leading-relaxed opacity-90 text-slate-700">
                  Khi bạn tải lên file mới hoặc sửa nội dung, phiên bản này trở về trạng thái <strong>chờ đối chiếu</strong>. Các chunks/vector cũ bị thay thế; chỉ sau khi duyệt, hệ thống mới tạo embeddings để RAG và sinh profile sử dụng.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Tiêu đề tài liệu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={updateFormData.title}
                    onChange={e => setUpdateFormData(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-cyan-500 focus:outline-none font-medium"
                    placeholder="VD: Quy trình kỹ thuật VietGAP dâu tây nhà màng"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Số hiệu phiên bản mới <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={updateFormData.version}
                    onChange={e => setUpdateFormData(p => ({ ...p, version: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-cyan-500 text-cyan-800 font-bold font-mono text-xs focus:bg-white focus:border-cyan-600 focus:outline-none"
                    placeholder="VD: V2.0, 2024, Ban hành lần 2"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cơ quan / Tác giả ban hành</label>
                  <input
                    type="text"
                    value={updateFormData.author}
                    onChange={e => setUpdateFormData(p => ({ ...p, author: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-cyan-500 focus:outline-none font-medium"
                    placeholder="VD: Chi cục Trồng trọt & BVTV Lâm Đồng"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cây trồng áp dụng</label>
                  <input
                    type="text"
                    value={updateFormData.cropScope}
                    onChange={e => setUpdateFormData(p => ({ ...p, cropScope: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-cyan-500 focus:outline-none font-medium"
                    placeholder="VD: Dâu tây, Cà chua (để trống nếu áp dụng chung)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Danh mục kỹ thuật</label>
                <select
                  value={updateFormData.category}
                  onChange={e => setUpdateFormData(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-cyan-500 focus:outline-none font-medium"
                >
                  <option value="general">Quy chuẩn chung (Toàn diện)</option>
                  <option value="irrigation">Quản lý nước tưới & Dinh dưỡng</option>
                  <option value="pest">Quản lý dịch hại (IPM & Thuốc BVTV)</option>
                  <option value="nutrition">Quy trình Phân bón</option>
                  <option value="climate">Vi khí hậu & Kỹ thuật canh tác</option>
                  <option value="harvest">Thu hoạch & Truy xuất nguồn gốc</option>
                  <option value="record">Hồ sơ nhật ký canh tác</option>
                </select>
              </div>

              {/* Tùy chọn 1: Tải tệp mới thay thế (PDF/DOCX/TXT) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-cyan-600" /> Tải lên tệp tài liệu mới (V2) thay thế:
                  </span>
                  {selectedUpdateFile && (
                    <span className="text-[11px] text-emerald-700 font-bold">
                      Đã chọn: {selectedUpdateFile.name} ({(selectedUpdateFile.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Chọn tệp PDF, Word (.docx) hoặc Text (.txt) phiên bản V2 mới để trích xuất nội dung tự động.
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedUpdateFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                />
              </div>

              {/* Tùy chọn 2: Hoặc chỉnh sửa trực tiếp nội dung văn bản */}
              <div className="space-y-1">
                <label className="block text-slate-700 font-semibold">
                  Hoặc chỉnh sửa trực tiếp nội dung văn bản quy chuẩn (để trống nếu đã chọn file ở trên):
                </label>
                <textarea
                  rows={6}
                  value={updateFormData.contentText}
                  onChange={e => setUpdateFormData(p => ({ ...p, contentText: e.target.value }))}
                  placeholder="Dán hoặc chỉnh sửa các điều khoản số liệu kỹ thuật mới (Độ ẩm, nhiệt độ, pH, EC, quy trình tưới, IPM...)..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-mono text-[11px] leading-relaxed focus:bg-white focus:border-cyan-500 focus:outline-none font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2.5 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang cập nhật & Sinh lại Vector...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Xác Nhận Lưu & Nâng Cấp Phiên Bản
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM TOÀN BỘ VĂN BẢN TRÍCH XUẤT TỪ PDF / DB */}
      {isFullTextModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mr-2">
                  {selectedDoc.code}
                </span>
                <h3 className="font-bold text-slate-900 text-base inline">{selectedDoc.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Định dạng: <strong className="text-slate-800">{selectedDoc.fileType}</strong> • 
                  Cơ quan: <strong className="text-slate-800">{selectedDoc.issuingAuthority}</strong> • 
                  Số đoạn RAG: <strong className="text-emerald-700">{selectedDoc.chunks?.length || 0} đoạn</strong>
                </p>
              </div>
              <button
                onClick={() => setIsFullTextModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line bg-slate-50/50">
              {selectedDoc.contentText || selectedDoc.chunks?.map(c => c.content).join('\n\n---\n\n') || (
                <div className="text-center text-slate-400 py-10">Không có văn bản trích xuất trực tiếp.</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white">
              <span className="text-xs text-slate-500">
                Độ dài văn bản: {selectedDoc.contentText?.length || 0} ký tự
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullTextModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SOẠN THẢO QUY CHUẨN VIETGAP BẰNG AI & KIỂM TRA PHÊ DUYỆT */}
      {isAiDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full my-auto flex flex-col shadow-2xl max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/70 via-purple-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">Soạn Thảo Quy Chuẩn VietGAP Bằng AI</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-semibold">
                      {draftResult.standardCode || 'Chưa cung cấp mã tiêu chuẩn'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gửi yêu cầu để AI tạo toàn văn tài liệu kỹ thuật $\rightarrow$ Bạn kiểm tra, hiệu đính số liệu $\rightarrow$ Đồng ý thì lưu vào CSDL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiDraftModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 text-sm font-bold rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Stepper Header */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  aiDraftStep === 'PROMPT'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {aiDraftStep === 'REVIEW' && <CheckCircle2 className="w-3.5 h-3.5" />} 1. Thiết Lập Yêu Cầu
                </span>
                <span className="text-slate-400">→</span>
                <span className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  aiDraftStep === 'REVIEW'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  2. Kiểm Tra & Chỉnh Sửa Bản Thảo
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-slate-200 text-slate-600">
                  3. Đồng Ý & Lưu Vào CSDL
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white">
              {aiDraftStep === 'PROMPT' ? (
                <div className="space-y-5 max-w-2xl mx-auto py-2">
                  <div className="p-4 rounded-xl bg-violet-50/80 border border-violet-200 text-violet-900 text-xs leading-relaxed flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-violet-950 block mb-0.5">Trợ lý Nông nghiệp Thông minh AI VietGAP:</strong>
                      AI sẽ tự động tổng hợp toàn văn quy chuẩn canh tác bao gồm: Căn cứ pháp lý, Giới hạn kim loại nặng QCVN 03, Nước tưới & vi sinh QCVN 08, Dinh dưỡng fertigation, Biện pháp IPM & Thời gian cách ly PHI, Vi khí hậu theo 4 giai đoạn, và Quy chuẩn thu hoạch QR GS1.
                    </div>
                  </div>

                  {/* Tên Cây Trồng & Quick Pills */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      Tên Giống Cây Trồng Canh Tác <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={draftPrompt.cropName}
                      onChange={(e) => setDraftPrompt(prev => ({ ...prev, cropName: e.target.value }))}
                      placeholder="Nhập tên cây trồng, ví dụ: Cải Bẹ Xanh, Dưa Lưới, Bông Cải Trắng..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500">Gợi ý từ CSDL:</span>
                      {(crops.length > 0 ? crops.map(c => c.name) : documents.map(d => d.cropName)).map((cp) => (
                        <button
                          key={cp}
                          type="button"
                          onClick={() => setDraftPrompt(prev => ({ ...prev, cropName: cp }))}
                          className={`px-2.5 py-1 rounded-md text-[11px] transition-colors border ${
                            draftPrompt.cropName === cp
                              ? 'bg-violet-600 text-white border-violet-600 font-semibold shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {cp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tiêu chuẩn & Mô hình canh tác */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Tiêu Chuẩn Quy Phạm</label>
                      <input
                        type="text"
                        value={draftPrompt.standardCode}
                        onChange={(e) => setDraftPrompt(prev => ({ ...prev, standardCode: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Mô Hình Canh Tác</label>
                      <select
                        value={draftPrompt.cultivationModel}
                        onChange={(e) => setDraftPrompt(prev => ({ ...prev, cultivationModel: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
                      >
                        <option value="Nhà màng công nghệ cao">Nhà màng công nghệ cao (Greenhouse)</option>
                        <option value="Thủy canh tuần hoàn màng mỏng (NFT/DFT)">Thủy canh tuần hoàn hồi lưu (NFT/DFT)</option>
                        <option value="Giá thể xơ dừa tưới nhỏ giọt bù áp">Giá thể xơ dừa tưới nhỏ giọt bù áp</option>
                        <option value="Đất hữu cơ VietGAP luân canh">Đất hữu cơ VietGAP luân canh ngoài trời</option>
                      </select>
                    </div>
                  </div>

                  {/* Chuyên mục */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Nhóm Chuyên Mục Tài Liệu</label>
                    <select
                      value={draftPrompt.category}
                      onChange={(e) => setDraftPrompt(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
                    >
                      <option value="general">Quy chuẩn canh tác tổng hợp toàn diện (7 phần)</option>
                      <option value="irrigation">Chuyên sâu: Nguồn nước & Hệ thống tưới nhỏ giọt</option>
                      <option value="pest">Chuyên sâu: Quản lý dịch hại IPM & Thời gian cách ly PHI</option>
                      <option value="nutrition">Chuyên sâu: Dinh dưỡng cây trồng & Fertigation</option>
                      <option value="climate">Chuyên sâu: Vi khí hậu nhà màng & Điều khiển IoT</option>
                      <option value="harvest">Chuyên sâu: Quy trình thu hoạch & Mã QR truy xuất GTIN</option>
                    </select>
                  </div>

                  {/* Yêu cầu bổ sung */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Yêu Cầu / Lưu Ý Kỹ Thuật Bổ Sung (Tùy chọn)
                    </label>
                    <textarea
                      rows={3}
                      value={draftPrompt.additionalRequirements}
                      onChange={(e) => setDraftPrompt(prev => ({ ...prev, additionalRequirements: e.target.value }))}
                      placeholder="Nhập các yêu cầu cụ thể (vd: kiểm soát bọ trĩ sinh học, thời gian cách ly PHI 5 ngày, kiểm soát độ ngọt Brix, khống chế Nitrat...)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Thêm nhanh:</span>
                      {[
                        'Tưới nhỏ giọt bù áp fertigation',
                        'Thời gian cách ly PHI 7 ngày',
                        'Bẫy dính vàng & lưới 60 mesh',
                        'Kiểm soát nitrat < 200mg/kg',
                        'Kiểm soát bọ trĩ & phấn trắng sinh học',
                        'Độ ngọt Brix >= 12%',
                        'Dán tem QR GS1 GTIN-13'
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setDraftPrompt(prev => ({
                            ...prev,
                            additionalRequirements: prev.additionalRequirements 
                              ? `${prev.additionalRequirements}, ${tag}` 
                              : tag
                          }))}
                          className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* GIAI ĐOẠN 2: NGƯỜI DÙNG KIỂM TRA & HIỆU ĐÍNH BẢN THẢO */
                <div className="space-y-4">
                  {/* Banner hướng dẫn kiểm tra */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-900">
                          AI đã soạn thảo xong bản thảo quy chuẩn kỹ thuật ({draftResult.content.length} ký tự)
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Hãy đọc kiểm tra từng chỉ tiêu, số liệu nông học hoặc chỉnh sửa trực tiếp. Khi đã hài lòng, nhấn <strong>"Đồng Ý & Lưu Vào CSDL"</strong> bên dưới.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setDraftEditorTab('EDIT')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                          draftEditorTab === 'EDIT'
                            ? 'bg-white text-violet-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Chỉnh Sửa Trực Tiếp
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftEditorTab('PREVIEW')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                          draftEditorTab === 'PREVIEW'
                            ? 'bg-white text-violet-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Xem Trước Định Dạng
                      </button>
                    </div>
                  </div>

                  {/* Metadata fields có thể sửa */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Tiêu Đề Quy Chuẩn</label>
                      <input
                        type="text"
                        value={draftResult.title}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Mã Quy Chuẩn / Tiêu Chuẩn</label>
                      <input
                        type="text"
                        value={draftResult.standardCode}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, standardCode: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-emerald-700 font-mono font-semibold focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Cơ Quan Ban Hành</label>
                      <input
                        type="text"
                        value={draftResult.authorOrganization}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, authorOrganization: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Cây Trồng Áp Dụng</label>
                      <input
                        type="text"
                        value={draftResult.cropScope}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, cropScope: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Phiên Bản Ban Hành</label>
                      <input
                        type="text"
                        value={draftResult.version}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, version: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-violet-700 font-mono font-bold focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Vùng Biên Tập Văn Bản Hoặc Xem Trước */}
                  {draftEditorTab === 'EDIT' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Nội dung văn bản quy chuẩn (Cho phép chỉnh sửa tự do):</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {draftResult.content.split('\n').length} dòng • {draftResult.content.length} ký tự
                        </span>
                      </div>
                      <textarea
                        rows={16}
                        value={draftResult.content}
                        onChange={(e) => setDraftResult(prev => ({ ...prev, content: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-xs text-slate-900 leading-relaxed font-mono focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-h-[420px] overflow-y-auto space-y-4 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                      <div className="text-center pb-3 border-b border-slate-200">
                        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="text-[11px] text-slate-500">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="mt-2 text-sm font-bold text-slate-900">{draftResult.title}</div>
                        <div className="text-[11px] text-emerald-700 font-mono font-semibold">{draftResult.standardCode} • Phiên bản {draftResult.version}</div>
                      </div>
                      <div>{draftResult.content}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              {aiDraftStep === 'PROMPT' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAiDraftModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingDraft || !draftPrompt.cropName.trim()}
                    onClick={handleStartAiDraft}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-violet-200 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingDraft ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Đang soạn thảo quy chuẩn bằng AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Bắt Đầu Soạn Thảo Bằng AI
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAiDraftStep('PROMPT')}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    ← Soạn Thảo Lại
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAiDraftModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isSavingDraft || !draftResult.title.trim() || draftResult.content.length < 50}
                      onClick={handleSaveDraftToDb}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-200 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingDraft ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu & Tạo vector chunks...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Đồng Ý & Lưu Vào CSDL
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
