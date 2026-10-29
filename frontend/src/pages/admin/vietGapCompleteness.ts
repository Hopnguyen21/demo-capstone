// Mirrors backend VietGapCompletenessChecker (SmartFarm.Infrastructure/Ai/Knowledge). The backend is the
// authority: it rejects approval when a critical section is missing and the review note is too short.

export interface VietGapCompletenessCheck {
  key: string;
  label: string;
  isCritical: boolean;
  found: boolean;
}

export const MIN_NOTES_FOR_INCOMPLETE_APPROVAL = 20;

const RULES: Array<{ key: string; label: string; isCritical: boolean; allOf: RegExp[] }> = [
  { key: 'standard', label: 'Mã tiêu chuẩn (TCVN / QCVN / VietGAP)', isCritical: true, allOf: [/TCVN\s*\d|QCVN\s*\d|Viet\s?GAP/i] },
  { key: 'soil', label: 'Quản lý đất / giá thể', isCritical: true, allOf: [/đất trồng|giá thể|chất lượng đất|kim loại nặng|vùng sản xuất|loại đất|làm đất|đất thịt|đất cát/i] },
  { key: 'water', label: 'Nguồn nước / nước tưới', isCritical: true, allOf: [/nguồn nước|nước tưới|chất lượng nước/i] },
  { key: 'fertilizer', label: 'Phân bón / dinh dưỡng', isCritical: true, allOf: [/phân bón|chất dinh dưỡng|bón phân/i] },
  { key: 'ipm', label: 'IPM / thuốc bảo vệ thực vật', isCritical: true, allOf: [/\bIPM\b|BVTV|thuốc bảo vệ thực vật|dịch hại|sâu bệnh/i] },
  { key: 'harvest', label: 'Thu hoạch / sau thu hoạch', isCritical: true, allOf: [/thu hoạch/i] },
  { key: 'records', label: 'Ghi chép hồ sơ / truy xuất nguồn gốc', isCritical: true, allOf: [/truy xuất|ghi chép|nhật ký|lưu hồ sơ|hồ sơ sản xuất/i] },
  { key: 'version', label: 'Năm, phiên bản hoặc ngày hiệu lực', isCritical: false, allOf: [/\b(19|20)\d{2}\b|phiên bản|ngày ban hành|hiệu lực/i] },
  { key: 'environment', label: 'Số liệu môi trường (nhiệt độ, độ ẩm, pH, EC)', isCritical: false, allOf: [/nhiệt độ/i, /độ ẩm|ẩm đất/i, /\bpH\b/i, /\bEC\b/i] },
  { key: 'stages', label: 'Giai đoạn / thời lượng sinh trưởng', isCritical: false, allOf: [/giai đoạn|thời kỳ/i, /\d+\s*ngày/i] },
];

// So khớp không phụ thuộc dấu (giống VietnameseText.Fold ở backend): tài liệu gõ không dấu ("thu hoach", "ngay") vẫn được nhận.
export const foldVietnamese = (s: string): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const FOLDED_RULES = RULES.map(rule => ({ ...rule, allOf: rule.allOf.map(p => new RegExp(foldVietnamese(p.source), 'i')) }));

export type AgricultureDocumentType = 'OfficialStandard' | 'TechnicalGuide' | 'Thematic';

export const DOCUMENT_TYPE_INFO: Record<AgricultureDocumentType, { label: string; requirement: string }> = {
  OfficialStandard: {
    label: 'Tiêu chuẩn / quy chuẩn chính thức',
    requirement: 'Bắt buộc: mã TCVN/QCVN/VietGAP, đất, nước tưới, phân bón, IPM, thu hoạch, ghi chép & truy xuất.',
  },
  TechnicalGuide: {
    label: 'Hướng dẫn / quy trình kỹ thuật',
    requirement: 'Bắt buộc: nguồn ban hành, đất, phân bón, sâu bệnh, thu hoạch. Không cần mã TCVN.',
  },
  Thematic: {
    label: 'Tài liệu chuyên đề',
    requirement: 'Bắt buộc: nguồn ban hành và nội dung của chuyên đề đã chọn (tưới, IPM, dinh dưỡng...).',
  },
};

// Chủ đề tài liệu → mục cần có nội dung (khớp VietGapCompletenessChecker.SectionByTopic ở backend).
const SECTION_BY_TOPIC: Record<string, string> = {
  irrigation: 'water', pest: 'ipm', nutrition: 'fertilizer', harvest: 'harvest', record: 'records', climate: 'environment', soil: 'soil',
};

/**
 * Mỗi tài liệu là một nguồn RAG riêng: bắt buộc nguồn truy vết được, mã tiêu chuẩn nếu là tiêu chuẩn chính thức,
 * và nội dung của từng chủ đề đã khai báo (topics, phân tách bằng dấu phẩy). Các mục khác chỉ để tham khảo.
 */
export function checkVietGapCompleteness(
  text: string,
  type: AgricultureDocumentType = 'OfficialStandard',
  topics = '',
  hasSource = false,
): VietGapCompletenessCheck[] {
  const normalized = foldVietnamese(text);
  const checks = FOLDED_RULES.map(rule => ({
    key: rule.key,
    label: rule.label,
    isCritical: false,
    found: rule.allOf.every(pattern => pattern.test(normalized)),
  }));

  const standardFound = checks.find(c => c.key === 'standard')?.found ?? false;
  checks.unshift({ key: 'source', label: 'Nguồn: mã tiêu chuẩn hoặc đơn vị ban hành', isCritical: false, found: hasSource || standardFound });

  const required = new Set<string>(['source']);
  if (type === 'OfficialStandard') required.add('standard');
  topics.split(',').map(t => t.trim()).filter(Boolean).forEach(t => { if (SECTION_BY_TOPIC[t]) required.add(SECTION_BY_TOPIC[t]); });
  return checks.map(c => (required.has(c.key) ? { ...c, isCritical: true } : c));
}
