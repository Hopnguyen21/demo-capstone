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
import { foldVietnamese } from './vietGapCompleteness';

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
  metadataDetection?: any; // Kết quả hệ thống nhận diện từ nội dung: giá trị, trạng thái, bằng chứng
  verification?: any; // Kết quả AI rà soát đối chiếu nguồn quy chuẩn đã xác minh
  verificationStatus?: string;
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

const VERIFICATION_STATUS: Record<string, { label: string; cls: string }> = {
  Pending: { label: 'AI đang kiểm tra', cls: 'bg-sky-50 border-sky-300 text-sky-800' },
  Agricultural: { label: 'AI: thuộc lĩnh vực nông nghiệp', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  NotAgricultural: { label: 'AI: có thể KHÔNG phải tài liệu nông nghiệp', cls: 'bg-rose-50 border-rose-300 text-rose-800' },
  Uncertain: { label: 'AI chưa đủ căn cứ để kết luận', cls: 'bg-amber-50 border-amber-300 text-amber-800' },
  VerificationError: { label: 'AI gặp lỗi — chưa kiểm tra được', cls: 'bg-slate-100 border-slate-300 text-slate-700' },
};

// Kết quả AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp. Chỉ xác nhận chủ đề, không đánh giá đúng/sai kỹ thuật,
// không chứng nhận VietGAP và không quyết định việc duyệt.
const VerificationCard: React.FC<{ verification: any; status?: string; busy: boolean; onRerun: () => void }> = ({ verification, status, busy, onRerun }) => {
  const effective = verification?.status ?? status;
  const st = effective ? (VERIFICATION_STATUS[effective] ?? VERIFICATION_STATUS.Uncertain) : null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-label="AI kiểm tra chủ đề nông nghiệp">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-extrabold text-slate-900 text-sm">AI kiểm tra tài liệu có thuộc lĩnh vực nông nghiệp</h4>
        {st && <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${st.cls}`}>{st.label}</span>}
        <button type="button" onClick={onRerun} disabled={busy} className="ml-auto px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-50">
          {busy ? 'Đang yêu cầu…' : 'Kiểm tra lại'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Chỉ xác nhận tài liệu nói về nông nghiệp; không đánh giá kỹ thuật đúng hay sai và không phải chứng nhận VietGAP. Tài liệu chỉ vào RAG sau khi quản trị viên duyệt.
      </p>
      {!effective && <p className="text-xs text-slate-600">Tài liệu này chưa có kết quả kiểm tra (nạp trước khi có tính năng).</p>}
      {effective === 'Pending' && <p className="text-xs text-sky-800">AI đang kiểm tra. Kết quả sẽ hiện sau ít phút.</p>}
      {verification?.message && <p className="text-xs text-slate-800">{verification.message}</p>}
      {verification?.documentKind && <p className="text-xs text-slate-700"><b>AI nhận định đây là:</b> {verification.documentKind}</p>}
      {verification?.reason && <p className="text-xs text-slate-600">Lý do: {verification.reason}</p>}
      {Array.isArray(verification?.evidence) && verification.evidence.map((q: any, i: number) => (
        <p key={i} className="text-xs italic text-slate-700">“{q.quote}”{q.page ? ` · trang ${q.page}` : ''}</p>
      ))}
      {verification?.checkedAtUtc && (
        <p className="text-[10px] text-slate-400">
          Kiểm tra lúc {new Date(verification.checkedAtUtc).toLocaleString('vi-VN')}{verification.model ? ` · ${verification.model}` : ''} · prompt {verification.promptVersion}
          {typeof verification.confidence === 'number' ? ` · tin cậy ${Math.round(verification.confidence * 100)}%` : ''}
        </p>
      )}
    </section>
  );
};

const DETECTION_STATUS: Record<string, { label: string; cls: string }> = {
  detected: { label: 'Đã nhận diện', cls: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  uncertain: { label: 'Chưa chắc chắn', cls: 'bg-amber-50 border-amber-300 text-amber-800' },
  not_found: { label: 'Không thấy trong file', cls: 'bg-slate-50 border-slate-300 text-slate-600' },
};

// Kết quả hệ thống tự nhận diện từ nội dung file, kèm câu trích để đối chiếu với file gốc.
const DetectionCard: React.FC<{ detection: any }> = ({ detection }) => {
  const rows: { key: string; label: string; field: any }[] = [
    { key: 'title', label: 'Tiêu đề', field: detection.title },
    { key: 'crops', label: 'Cây áp dụng', field: detection.crops },
    { key: 'generalScope', label: 'Áp dụng chung', field: detection.generalScope },
    { key: 'publisher', label: 'Đơn vị ban hành', field: detection.publisher },
    { key: 'standardCode', label: 'Mã tiêu chuẩn', field: detection.standardCode },
    { key: 'version', label: 'Phiên bản', field: detection.version },
    { key: 'effectiveDate', label: 'Hiệu lực / năm', field: detection.effectiveDate },
    { key: 'documentType', label: 'Loại tài liệu', field: detection.documentType },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2" aria-label="Thông tin hệ thống tự nhận diện">
      <h4 className="font-extrabold text-slate-900 text-sm">Thông tin hệ thống tự nhận diện từ file</h4>
      <p className="text-[11px] text-slate-500">Chỉ ghi giá trị khi file có bằng chứng; chưa thấy thì để trống, không đoán. Hãy đối chiếu với file gốc khi duyệt.</p>
      <div className="grid gap-2">
        {rows.map(({ key, label, field }) => {
          if (!field) return null;
          const st = DETECTION_STATUS[field.status] ?? DETECTION_STATUS.not_found;
          return (
            <div key={key} className="text-xs border border-slate-100 rounded-lg p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{label}:</span>
                <span className="text-slate-900">{field.value ?? '—'}</span>
                <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${st.cls}`}>{st.label}</span>
              </div>
              {field.evidence && (
                <p className="mt-1 text-[11px] text-slate-500 italic">“{field.evidence.quote}”{field.evidence.page ? ` · trang ${field.evidence.page}` : ''}</p>
              )}
              {Array.isArray(field.candidates) && field.candidates.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">Được nhắc trong file: {field.candidates.join(', ')} (chưa đủ để kết luận phạm vi áp dụng)</p>
              )}
            </div>
          );
        })}
      </div>
      {Array.isArray(detection.topics) && detection.topics.length > 0 && (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">Chủ đề nhận diện từ nội dung (gợi ý):</span>{' '}
          {detection.topics.map((t: any) => `${t.topic} (${t.chunkCount} đoạn)`).join(', ')}
        </div>
      )}
    </section>
  );
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

const NOT_EXTRACTED_TEXT = '[Không có dữ liệu]';
const MISSING_IN_SOURCE_TEXT = '[Không có trong tài liệu]';

// Số ngày không có trong tài liệu nguồn phải hiển thị là thiếu, không phải "0 ngày".
const formatDays = (days: number | null | undefined): string =>
  days == null ? '[chưa có trong tài liệu]' : `${days} ngày`;

// Nhận diện tên cây trồng từ tên file hoặc văn bản gợi ý
const detectCropFromFileName = (fileName: string, catalogCrops: string[]): string => {
  if (!fileName) return '';
  const normalizedFileName = foldVietnamese(fileName.replace(/[_\-.]/g, ' '));

  // 1. So khớp với danh mục cây trồng hiện có trong CSDL (ưu tiên tên dài trước)
  const sortedCatalog = [...catalogCrops].sort((a, b) => b.length - a.length);
  for (const crop of sortedCatalog) {
    if (crop && normalizedFileName.includes(foldVietnamese(crop))) {
      return crop;
    }
  }

  // 2. Mẫu nhận diện các cây trồng nông nghiệp thông dụng
  const commonPatterns: { regex: RegExp; name: string }[] = [
    { regex: /dua\s*leo\s*mau/i, name: 'Dưa leo màu' },
    { regex: /dua\s*leo\s*baby/i, name: 'Dưa leo baby' },
    { regex: /dua\s*leo|cucumber/i, name: 'Dưa leo' },
    { regex: /dua\s*luoi|cantaloupe|melon/i, name: 'Dưa lưới' },
    { regex: /dau\s*tay|strawberry/i, name: 'Dâu tây' },
    { regex: /ca\s*chua\s*beefsteak/i, name: 'Cà chua beefsteak' },
    { regex: /ca\s*chua\s*bi/i, name: 'Cà chua bi' },
    { regex: /ca\s*chua|tomato/i, name: 'Cà chua' },
    { regex: /ot\s*chuong|bell\s*pepper|capsicum/i, name: 'Ớt chuông' },
    { regex: /xa\s*lach|lettuce/i, name: 'Xà lách' },
    { regex: /cai\s*be\s*xanh/i, name: 'Cải bẹ xanh' },
    { regex: /cai\s*ngot/i, name: 'Cải ngọt' },
    { regex: /cai\s*thao/i, name: 'Cải thảo' },
    { regex: /rau\s*muong/i, name: 'Rau muống' },
    { regex: /nam\s*rom/i, name: 'Nấm rơm' },
    { regex: /thanh\s*long/i, name: 'Thanh long' },
    { regex: /xoai/i, name: 'Xoài' },
    { regex: /buoi/i, name: 'Bưởi' },
    { regex: /cam/i, name: 'Cam' },
    { regex: /sau\s*rieng/i, name: 'Sầu riêng' },
  ];

  for (const item of commonPatterns) {
    if (item.regex.test(normalizedFileName)) {
      const foundInCat = catalogCrops.find(c => foldVietnamese(c) === foldVietnamese(item.name));
      return foundInCat || item.name;
    }
  }

  return '';
};

export const VietGapStandardsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DOCUMENTS'>('DOCUMENTS');
  const [isVerifyingDoc, setIsVerifyingDoc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<VietGapRegulationDetail | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [growthProfiles, setGrowthProfiles] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<'ALL' | 'IPM' | 'SOIL' | 'HARVEST'>('ALL');
  const [matrixFilter, setMatrixFilter] = useState<'CROPS_ONLY' | 'ALL'>('CROPS_ONLY');
  const [docFilter, setDocFilter] = useState<'CROPS_ONLY' | 'ALL' | 'BY_CROP'>('CROPS_ONLY');
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);

  // Quản lý giai đoạn sinh trưởng tùy biến & Kiểm duyệt cuối
  const [reviewerName, setReviewerName] = useState('Quản trị viên Kỹ thuật Nông nghiệp (Platform Admin)');
  const [isDetectingFile, setIsDetectingFile] = useState(false);
  const [fileTextUnavailable, setFileTextUnavailable] = useState(false);
  const [fileDetectionResult, setFileDetectionResult] = useState<{
    cropScope: string;
    cropsStatus?: string;
    cropsEvidence?: string;
    cropsPage?: number;
    title?: string;
  } | null>(null);

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
  const initialUploadFormData = {
    title: '',
    cropName: '',
    // Cây chọn từ danh mục (GET /api/v1/crops) + cây nhập tay qua "Khác"; để trống = tài liệu áp dụng chung.
    selectedCrops: [] as string[],
    otherCrops: '',
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
  // Metadata người duyệt có thể chỉnh sau khi đối chiếu file gốc (khởi tạo từ giá trị hệ thống đã nhận diện).
  const [reviewMeta, setReviewMeta] = useState({
    title: '', cropScope: '', author: '', version: '', documentType: 'Unspecified' as AgricultureDocumentType, confirmGeneral: false,
  });
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const reviewChecks = useMemo(
    () => checkVietGapCompleteness(reviewText, selectedDoc?.documentType, selectedDoc?.topics,
      Boolean(selectedDoc?.author && !selectedDoc.author.includes('Chưa xác định'))),
    [reviewText, selectedDoc?.documentType, selectedDoc?.topics, selectedDoc?.author]);
  const missingCriticalChecks = reviewChecks.filter(c => c.isCritical && !c.found);
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false);
  const [isReextracting, setIsReextracting] = useState(false);

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
    // Chu kỳ chỉ lấy từ tài liệu: giá trị của bản ghi Crop trong CSDL không phải thông tin tài liệu nêu, nên không hiển thị ở đây.
    const growthDays: number | null = daysField('growthCycleDays');

    // 6. Thu hoạch, sơ chế & truy xuất
    const harvestToolsStandard = textField('harvestToolsStandard');
    const waterWashingStandard = textField('waterWashingStandard');
    const packagingMaterial = textField('packagingMaterial');
    const traceabilityQr = textField('traceabilityQr');

    // 7. Giai đoạn sinh trưởng: chỉ những giai đoạn tài liệu nêu tên trong câu trích
    const stagesOverview = (extraction?.stages ?? []).map(s => ({
      name: s.name,
      days: s.durationDays ?? 0,
      // Chỉ hiển thị số liệu mà chính câu trích của giai đoạn nêu; không lấy giá trị chung của tài liệu gán cho giai đoạn.
      temp: s.temperatureRange ?? MISSING_IN_SOURCE_TEXT,
      moisture: s.moistureRange ?? MISSING_IN_SOURCE_TEXT,
      ph: s.ph ?? MISSING_IN_SOURCE_TEXT,
      ec: s.ec ?? MISSING_IN_SOURCE_TEXT,
      fertilizerAction: s.fertilizerAction ?? MISSING_IN_SOURCE_TEXT,
      ipmAction: s.ipmAction ?? MISSING_IN_SOURCE_TEXT,
      evidence: s.evidence,
      page: s.page ?? undefined
    }));

    return {
      id: d.id,
      code: d.standardCode || fullText.match(/TCVN\s*\d+[-–]\d+:\d{4}/i)?.[0] || 'Chưa xác định',
      version: d.version || undefined, // không điền phiên bản mặc định khi file không ghi
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
      validityPeriod: d.validityPeriod || 'Chưa xác định',
      status: (d.status === 'VALIDATED' ? 'VALIDATED' : 'DRAFT') as 'VALIDATED' | 'DRAFT',
      reviewStatus: d.reviewStatus || 'PendingReview',
      documentType: (d.documentType || 'Unspecified') as AgricultureDocumentType,
      metadataDetection: detail?.metadataDetection || d.metadataDetection || undefined,
      verification: detail?.verification || d.verification || undefined,
      verificationStatus: detail?.verificationStatus || d.verificationStatus || undefined,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setFileTextUnavailable(false);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setUploadFormData(prev => ({
      ...prev,
      fileName: file.name,
      fileType: isPDF ? 'PDF' : isDOCX ? 'DOCX' : 'TXT',
      fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      title: prev.title || cleanName
    }));

    // Tự động đọc và trích xuất loại cây trồng trực tiếp từ nội dung tệp
    setIsDetectingFile(true);
    setFileDetectionResult(null);

    try {
      const detected = await knowledgeService.detectMetadata(file);
      const cropFound = detected.cropScope || '';
      const titleFound = detected.title || cleanName;

      setFileDetectionResult({
        cropScope: cropFound,
        cropsStatus: detected.cropsStatus,
        cropsEvidence: detected.cropsEvidence,
        cropsPage: detected.cropsPage,
        title: titleFound
      });

      setUploadFormData(prev => ({
        ...prev,
        cropName: cropFound,
        title: titleFound
      }));
    } catch (err) {
      if (isPDF && (err as any)?.response?.status === 400) {
        setFileTextUnavailable(true);
        setFileDetectionResult(null);
        setNotification({
          type: 'error',
          message: 'Không đọc được lớp văn bản trong PDF. Nếu đây là PDF scan, hãy OCR bên ngoài SmartFarm rồi lưu thành PDF có thể tìm kiếm hoặc DOCX/TXT trước khi tải lên.'
        });
        return;
      }
      console.warn('Không nhận diện được metadata từ nội dung, sẽ dùng thông tin nhập tay hoặc tên file:', err);
      if (isTXT) {
        try {
          const txt = await file.text();
          const match = txt.match(/^\s*[-•*]?\s*(?:cây trồng áp dụng|cây trồng|đối tượng cây trồng|đối tượng áp dụng|áp dụng cho cây|áp dụng cho)\s*[:：]\s*(.+)$/im);
          const cropFromTxt = match ? match[1].trim() : detectCropFromFileName(file.name, crops.map(c => c.name));
          setFileDetectionResult({
            cropScope: cropFromTxt,
            cropsStatus: cropFromTxt ? 'detected' : 'not_found',
            cropsEvidence: match ? match[0] : undefined
          });
          setUploadFormData(prev => ({ ...prev, cropName: cropFromTxt }));
        } catch {
          // ignore
        }
      } else {
        const fallbackCrop = detectCropFromFileName(file.name, crops.map(c => c.name));
        if (fallbackCrop) {
          setFileDetectionResult({
            cropScope: fallbackCrop,
            cropsStatus: 'uncertain',
            cropsEvidence: `Nhận diện từ tên file: ${file.name}`
          });
          setUploadFormData(prev => ({ ...prev, cropName: fallbackCrop }));
        }
      }
    } finally {
      setIsDetectingFile(false);
    }
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUploading(true);
    let backendDocId: string | null = null;
    let savedTitle = '';
    let requiresManualReview = true;
    let nearDuplicateNote = '';
    let needsDecision: string[] = [];
    let uploadMessage = '';
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
      if (fileTextUnavailable) {
        setNotification({
          type: 'error',
          message: 'PDF chưa có lớp văn bản để hệ thống đọc. Hãy OCR bên ngoài SmartFarm và chọn lại PDF có thể tìm kiếm hoặc DOCX/TXT.'
        });
        setIsUploading(false);
        return;
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      if (uploadFormData.title?.trim()) {
        fd.append('title', uploadFormData.title.trim());
      }
      if (uploadFormData.cropName?.trim()) {
        fd.append('cropScope', uploadFormData.cropName.trim());
      }
      fd.append('isPublic', 'true');

      const uploadRes = await knowledgeService.uploadDocument(fd);
      if (uploadRes?.id || uploadRes?.documentId) {
        backendDocId = uploadRes.id || uploadRes.documentId;
        savedTitle = uploadRes.title || selectedUploadFile?.name || '';
        needsDecision = Array.isArray(uploadRes.needsDecision) ? uploadRes.needsDecision : [];
        uploadMessage = String(uploadRes.message || '');
        requiresManualReview = true;
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
      requiresManualReview = detail.reviewStatus !== 'Approved';
      wasOcrProcessed = newDoc.contentText?.startsWith('[OCR bằng AI từ PDF scan') === true;
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setIsReviewPanelOpen(false);
      setReviewText(newDoc.contentText || '');
      setReviewConfirmed(false);
    } catch {
      await loadBackendDocuments();
    }
    const decisionNote = needsDecision.length > 0 ? ` Chưa xác định được: ${needsDecision.join(', ')} — hãy chọn khi duyệt.` : '';
    setIsUploadModalOpen(false);
    setSelectedUploadFile(null);
    setUploadFormData(initialUploadFormData);
    setNotification({
      type: requiresManualReview ? 'warning' : 'success',
      message: requiresManualReview
        ? `Đã lưu "${savedTitle}". ${uploadMessage || 'Tài liệu chờ duyệt, chưa dùng trong RAG.'}${decisionNote}`
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
        message: `Đã cập nhật tài liệu lên phiên bản ${updateFormData.version}. Tài liệu trở về trạng thái chờ đối chiếu; chỉ được đưa vào RAG sau khi được duyệt.`
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

  useEffect(() => {
    if (!selectedDoc) return;
    setReviewMeta({
      title: selectedDoc.title || '',
      cropScope: selectedDoc.cropScope || '',
      author: selectedDoc.author && !selectedDoc.author.includes('Chưa xác định') ? selectedDoc.author : '',
      version: selectedDoc.version || '',
      documentType: selectedDoc.documentType,
      confirmGeneral: Boolean(selectedDoc.metadataDetection?.generalScopeConfirmed),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id]);

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
    if (approve && reviewMeta.documentType === 'Unspecified') {
      setNotification({ type: 'error', message: 'Chưa xác định loại tài liệu: hãy chọn loại (tiêu chuẩn, hướng dẫn kỹ thuật hoặc chuyên đề) trước khi duyệt.' });
      return;
    }
    const det = selectedDoc.metadataDetection;
    if (approve && det && !reviewMeta.cropScope.trim() && !reviewMeta.confirmGeneral && det.generalScope?.status !== 'detected') {
      setNotification({ type: 'error', message: 'Chưa xác định cây áp dụng: hãy nhập cây, hoặc xác nhận tài liệu áp dụng chung sau khi đối chiếu file gốc.' });
      return;
    }
    setIsSavingReview(true);
    try {
      const authorBefore = selectedDoc.author && !selectedDoc.author.includes('Chưa xác định') ? selectedDoc.author : '';
      await knowledgeService.reviewDocument(selectedDoc.id, {
        contentText: reviewText,
        approve,
        reviewNotes: reviewNotes.trim() || undefined,
        // Chỉ gửi trường người duyệt đã sửa; trường không đổi giữ giá trị hệ thống nhận diện.
        title: reviewMeta.title.trim() !== selectedDoc.title ? reviewMeta.title.trim() : undefined,
        cropScope: reviewMeta.cropScope.trim() !== (selectedDoc.cropScope || '') ? reviewMeta.cropScope.trim() : undefined,
        authorOrganization: reviewMeta.author.trim() !== authorBefore ? reviewMeta.author.trim() : undefined,
        version: reviewMeta.version.trim() !== (selectedDoc.version || '') ? reviewMeta.version.trim() : undefined,
        documentType: reviewMeta.documentType !== selectedDoc.documentType ? reviewMeta.documentType : undefined,
        confirmGeneralScope: reviewMeta.confirmGeneral || undefined,
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
          ? 'Đã duyệt tài liệu. Nội dung đã đối chiếu được dùng làm nguồn tri thức cho AI (RAG).'
          : 'Đã lưu kết quả rà soát. Tài liệu được đánh dấu cần chỉnh sửa và chưa dùng cho AI.'
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

  const refreshSelectedDocument = async (id: string) => {
    const detail = await knowledgeService.getDocument(id);
    const refreshed = deriveVietGapDetails(detail, detail, crops, growthProfiles);
    setDocuments(prev => prev.map(doc => doc.id === refreshed.id ? refreshed : doc));
    setSelectedDoc(refreshed);
  };

  // Yêu cầu AI kiểm tra lại chủ đề nông nghiệp. Không đổi trạng thái duyệt.
  const handleVerifyDocument = async () => {
    if (!selectedDoc) return;
    setIsVerifyingDoc(true);
    try {
      await knowledgeService.verifyDocument(selectedDoc.id);
      await refreshSelectedDocument(selectedDoc.id);
      setNotification({ type: 'success', message: 'Đã yêu cầu AI kiểm tra lại. Kết quả sẽ hiện sau ít phút; tài liệu vẫn chờ người duyệt.' });
    } catch (err: any) {
      setNotification({ type: 'error', message: describeIngestError(err, 'Không yêu cầu được rà soát.') });
    } finally {
      setIsVerifyingDoc(false);
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
                          <span className="truncate max-w-[190px]">Growth Profile liên kết: {doc.profileName || 'Profile'}</span>
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
                      {selectedDoc.reviewStatus === 'Approved' ? 'Đã đối chiếu với tài liệu gốc' : selectedDoc.reviewStatus === 'Superseded' ? 'Đã có phiên bản mới được duyệt thay thế · không còn dùng cho RAG' : selectedDoc.reviewStatus === 'NeedsCorrection' ? 'Cần chỉnh sửa · bị loại khỏi RAG' : 'Chờ đối chiếu · chưa được dùng cho RAG'}
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
                        <span className="truncate">Growth Profile đã liên kết: <strong className="font-semibold text-emerald-950">{selectedDoc.profileName}</strong></span>
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

                {selectedDoc.metadataDetection && <DetectionCard detection={selectedDoc.metadataDetection} />}

                {isReviewPanelOpen && (
                  <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-4 space-y-3" aria-label="Đối chiếu tài liệu đã trích xuất">
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-sm">Rà soát độ đầy đủ và đối chiếu nguồn</h4>
                      <p className="text-xs text-amber-900 mt-1">Các kiểm tra dưới đây chỉ giúp phát hiện phần cần xem lại; không chứng minh nội dung đúng. {selectedDoc.hasOriginalFile ? 'Tải file gốc đã lưu, đối chiếu và sửa nội dung trích xuất trước khi duyệt.' : 'Bản ghi này không có file gốc lưu trong DB; hãy đối chiếu với nguồn đáng tin cậy bên ngoài hoặc tải lại file gốc trước khi duyệt.'}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs bg-white/70 border border-amber-200 rounded-xl p-3" aria-label="Chỉnh thông tin tài liệu">
                      <label className="font-semibold text-slate-700 sm:col-span-2">Tiêu đề
                        <input value={reviewMeta.title} onChange={e => setReviewMeta(m => ({ ...m, title: e.target.value }))} maxLength={300} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal" />
                      </label>
                      <label className="font-semibold text-slate-700">Cây áp dụng (phân tách bằng dấu phẩy)
                        <input value={reviewMeta.cropScope} onChange={e => setReviewMeta(m => ({ ...m, cropScope: e.target.value, confirmGeneral: e.target.value.trim() ? false : m.confirmGeneral }))} list="review-crop-options" maxLength={500} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal" placeholder="Để trống nếu tài liệu áp dụng chung" />
                        <datalist id="review-crop-options">{crops.map((c: any) => <option key={c.cropId || c.id || c.name} value={c.name} />)}</datalist>
                      </label>
                      <label className="font-semibold text-slate-700">Loại tài liệu
                        <select value={reviewMeta.documentType} onChange={e => setReviewMeta(m => ({ ...m, documentType: e.target.value as AgricultureDocumentType }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal">
                          {(Object.keys(DOCUMENT_TYPE_INFO) as AgricultureDocumentType[]).map(t => <option key={t} value={t}>{DOCUMENT_TYPE_INFO[t].label}</option>)}
                        </select>
                      </label>
                      <label className="font-semibold text-slate-700">Đơn vị ban hành
                        <input value={reviewMeta.author} onChange={e => setReviewMeta(m => ({ ...m, author: e.target.value }))} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal" />
                      </label>
                      <label className="font-semibold text-slate-700">Phiên bản / hiệu lực
                        <input value={reviewMeta.version} onChange={e => setReviewMeta(m => ({ ...m, version: e.target.value }))} maxLength={50} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-normal" />
                      </label>
                      {!reviewMeta.cropScope.trim() && (
                        <label className="flex items-start gap-2 sm:col-span-2 text-slate-800">
                          <input type="checkbox" checked={reviewMeta.confirmGeneral} onChange={e => setReviewMeta(m => ({ ...m, confirmGeneral: e.target.checked }))} className="mt-0.5" />
                          Xác nhận tài liệu áp dụng chung cho mọi cây (sau khi đối chiếu file gốc)
                        </label>
                      )}
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

                <VerificationCard
                  verification={selectedDoc.verification}
                  status={selectedDoc.verificationStatus}
                  busy={isVerifyingDoc}
                  onRerun={handleVerifyDocument}
                />

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
                    {uploadFormData.fileSize !== '0 MB' ? `Dung lượng: ${uploadFormData.fileSize}` : 'Hệ thống tự đọc nội dung và nhận diện thông tin, tài liệu chờ người duyệt (tối đa 15MB)'}
                  </span>
                </label>
              </div>

              {/* Tự động lấy tên loại cây trồng từ file */}
              {isDetectingFile ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center gap-2.5 text-emerald-800 text-xs font-semibold py-6">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span>Đang tự động đọc nội dung file để trích xuất loại cây trồng và bằng chứng...</span>
                </div>
              ) : fileTextUnavailable ? (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 text-xs leading-relaxed">
                  PDF này chưa có lớp văn bản mà SmartFarm đọc được. OCR file bên ngoài hệ thống rồi chọn lại bản PDF có thể tìm kiếm, hoặc tải DOCX/TXT.
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sprout className="w-4 h-4 text-emerald-600" />
                      <span>Tên loại cây tự động lấy từ file (Cây áp dụng):</span>
                    </label>
                    {uploadFormData.cropName ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        {uploadFormData.cropName}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Chưa tìm thấy trong file (Áp dụng chung)
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={uploadFormData.cropName}
                      onChange={(e) => setUploadFormData(prev => ({ ...prev, cropName: e.target.value }))}
                      placeholder="Hệ thống tự động trích xuất trực tiếp từ nội dung file..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold text-xs shadow-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Tên loại cây được trích xuất tự động từ văn bản trong file. Bạn có thể chỉnh sửa lại nếu cần.
                    </p>
                  </div>

                  {fileDetectionResult?.cropsEvidence && (
                    <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                      <span className="font-bold">Trích đoạn làm bằng chứng từ file:</span> “{fileDetectionResult.cropsEvidence}”
                      {fileDetectionResult.cropsPage ? <span className="text-emerald-700 font-semibold"> (Trang {fileDetectionResult.cropsPage})</span> : null}
                    </div>
                  )}
                </div>
              )}

              {/* Tiêu đề quy chuẩn */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 text-xs">
                  Tiêu đề tài liệu quy chuẩn:
                </label>
                <input
                  type="text"
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ví dụ: Quy trình kỹ thuật VietGAP canh tác..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-xs font-medium shadow-xs"
                />
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs leading-relaxed">
                Chỉ cần chọn file. Hệ thống đọc văn bản có sẵn và nhận diện theo quy tắc <b>tiêu đề, cây áp dụng, đơn vị ban hành, mã tiêu chuẩn, phiên bản, loại tài liệu và chủ đề</b>, kèm câu trích làm bằng chứng; không dùng AI để trích xuất các trường này. Thông tin nào file không ghi sẽ hiện là <b>chưa xác định</b> (không đoán). PDF scan không có lớp chữ cần được OCR bên ngoài SmartFarm trước khi tải lên. Tài liệu ở trạng thái chờ duyệt và chỉ vào RAG sau khi bạn đối chiếu file gốc và duyệt.
              </div>

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
                  disabled={isUploading || !selectedUploadFile || fileTextUnavailable}
                  className="px-5 py-2 rounded-xl bg-[#119653] hover:bg-emerald-600 text-white font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải file, trích xuất và lưu tài liệu...
                    </>
                  ) : (
                    'Tải lên & tự nhận diện thông tin'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
