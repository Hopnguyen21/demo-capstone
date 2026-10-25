import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Sprout, 
  ShieldAlert, 
  Cpu, 
  Clock, 
  RefreshCw, 
  Trash2, 
  BookOpen,
  Droplets,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  Gauge,
  ClipboardList,
  Database,
  ExternalLink,
  FileText,
  Layers
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { aiService, controlService, knowledgeService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

const COMMAND_LABEL: Record<string, string> = {
  Pending: 'Lệnh đang chờ gửi',
  Sent: 'Đã gửi lệnh, chờ thiết bị xác nhận',
  Acknowledged: 'Thiết bị đã xác nhận lệnh',
  Failed: 'Gửi lệnh thất bại',
  TimedOut: 'Thiết bị không xác nhận trước thời hạn',
  Cancelled: 'Lệnh đã bị hủy',
};

/** Helper loại bỏ mã ID kỹ thuật (GUID / UUID / ID thiết bị) và các số 0 thừa phần thập phân khỏi câu trả lời của AI */
const cleanTechnicalIds = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\s*\((?:Mã\s*(?:ID|thiết bị)?|ID|ActuatorId)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\)/gi, '')
    .replace(/(?:mã\s*(?:ID|thiết bị)?|ID\s*thiết\s*bị|thiết\s*bị\s*mã)?:?\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/gi, '')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/** Helper gom mapping các cấu trúc recommendation từ API / History / Ask về một card chuẩn */
const toRecommendationCard = (raw: any): any => {
  if (!raw) return undefined;
  const conf = typeof raw.confidence === 'number' 
    ? raw.confidence * 100 
    : (typeof raw.confidenceScore === 'number' 
        ? (raw.confidenceScore > 1 ? raw.confidenceScore : raw.confidenceScore * 100) 
        : 85);

  return {
    recommendationId: raw.recommendationId || raw.id,
    title: cleanTechnicalIds(raw.summary || raw.title || 'Khuyến nghị Vi khí hậu'),
    recommendationText: cleanTechnicalIds(raw.details || raw.summary || raw.recommendationText || ''),
    reasoning: cleanTechnicalIds(Array.isArray(raw.limitations)
      ? raw.limitations.join('; ')
      : (raw.reasoning || 'Dựa trên bối cảnh cảm biến và quy chuẩn VietGAP')),
    confidenceScore: Math.round(conf),
    status: (raw.status || 'READY').toUpperCase(),
    proposedAction: raw.proposedAction,
    proposedDurationSeconds: raw.proposedDurationSeconds,
    validUntilUtc: raw.validUntilUtc,
    sources: Array.isArray(raw.sources) && raw.sources.length > 0 ? raw.sources : undefined,
    commandStatus: raw.commandStatus,
    recommendationType: raw.recommendationType || 'NÔNG HỌC VIETGAP',
    contextSnapshotJson: raw.contextSnapshotJson
  };
};

const actionLabel = (action?: string) => {
  if (action === 'TurnOn') return 'Bật máy bơm tưới nước';
  if (action === 'TurnOff') return 'Tắt máy bơm tưới';
  return action || 'Điều khiển thiết bị';
};

/** Component hiển thị toàn bộ Log dữ liệu Backend gửi cho AI (Prompt XML, Cảm biến, Ngưỡng VietGAP, RAG passages) */
const AiPayloadLogViewer: React.FC<{ snapshotJson?: string }> = ({ snapshotJson }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'telemetry' | 'requirements' | 'passages' | 'raw'>('prompt');
  const [copied, setCopied] = useState(false);

  if (!snapshotJson) return null;

  let data: any = null;
  try {
    data = typeof snapshotJson === 'string' ? JSON.parse(snapshotJson) : snapshotJson;
  } catch {
    return null;
  }

  const promptText = data?.Prompt || data?.prompt || '';
  const systemPrompt = data?.SystemPrompt || data?.systemPrompt || '';
  const context = data?.Context || data?.context || {};
  const passages = data?.Passages || data?.passages || [];
  const telemetry = context?.Telemetry || context?.telemetry || [];
  const requirements = context?.Requirements || context?.requirements || [];
  const actuators = context?.Actuators || context?.actuators || [];
  const weather = context?.Weather || context?.weather || {};

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 rounded-md border border-emerald-200 transition-colors shadow-2xs"
        >
          <Terminal size={12} className="text-emerald-600" />
          <span>Log dữ liệu BE gửi cho AI</span>
          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {isOpen && (
          <span className="text-[10px] text-slate-400 font-mono">
            {telemetry.length} cảm biến • {requirements.length} ngưỡng VietGAP • {passages.length} tài liệu RAG
          </span>
        )}
      </div>

      {isOpen && (
        <div className="mt-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden shadow-md text-[11px]">
          {/* Header tabs */}
          <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('prompt')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  activeTab === 'prompt' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FileCode size={12} /> XML Prompt
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('telemetry')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  activeTab === 'telemetry' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Gauge size={12} /> Cảm biến ({telemetry.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('requirements')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  activeTab === 'requirements' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ClipboardList size={12} /> Ngưỡng VietGAP ({requirements.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('passages')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  activeTab === 'passages' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <BookOpen size={12} /> RAG VietGAP ({passages.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  activeTab === 'raw' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(activeTab === 'prompt' ? (promptText || JSON.stringify(data, null, 2)) : JSON.stringify(data, null, 2))}
              className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded flex items-center gap-1 shrink-0 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>

          {/* Tab content */}
          <div className="p-3 max-h-72 overflow-y-auto font-mono text-[11px] leading-relaxed">
            {activeTab === 'prompt' && (
              <div className="space-y-3">
                {systemPrompt && (
                  <div>
                    <div className="text-[10px] text-emerald-400 font-sans font-bold uppercase tracking-wider mb-1">
                      System Instructions & Safety Rules:
                    </div>
                    <pre className="text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                      {systemPrompt}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-sky-400 font-sans font-bold uppercase tracking-wider mb-1">
                    Structured Prompt (XML Data Payload gửi AI):
                  </div>
                  <pre className="text-emerald-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                    {promptText || 'Không có raw prompt string, xem tab Raw JSON.'}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'telemetry' && (
              <div className="space-y-2">
                <div className="text-slate-400 font-sans text-[10px]">Dữ liệu đo đạc cảm biến thời gian thực tại Zone được đính kèm vào prompt:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {telemetry.map((t: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-emerald-400 font-bold">{t.ParameterCode || t.parameterCode}</div>
                        <div className="text-[10px] text-slate-400">
                          {t.CapturedAtUtc || t.capturedAtUtc ? new Date(t.CapturedAtUtc || t.capturedAtUtc).toLocaleTimeString() : 'Vừa xong'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{t.Value ?? t.value} {t.Unit || t.unit}</div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          (t.IsFresh ?? t.isFresh) ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {(t.IsFresh ?? t.isFresh) ? 'Tươi mới (Fresh)' : 'Cũ (Stale)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'requirements' && (
              <div className="space-y-2">
                <div className="text-slate-400 font-sans text-[10px]">Ngưỡng quy chuẩn VietGAP (TCVN 11892-1:2017) cho giai đoạn sinh trưởng hiện tại:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {requirements.map((r: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <div className="text-amber-400 font-bold">{r.ParameterCode || r.parameterCode}</div>
                      <div className="text-slate-300 text-[10px] flex justify-between mt-1">
                        <span>Min: <strong>{r.MinValue ?? r.minValue}</strong></span>
                        <span>Mục tiêu: <strong className="text-emerald-400">{r.TargetValue ?? r.targetValue}</strong></span>
                        <span>Max: <strong>{r.MaxValue ?? r.maxValue}</strong> ({r.Unit || r.unit})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'passages' && (
              <div className="space-y-2 font-sans">
                <div className="text-slate-400 text-[10px]">Các đoạn trích tài liệu VietGAP được RAG truy vấn tự động và nạp vào prompt cho AI:</div>
                {passages.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 text-xs italic">
                    Không có trích đoạn nào từ kho tri thức RAG khớp với ngưỡng tương đồng cho câu hỏi này. AI sử dụng dữ liệu cảm biến thời gian thực và tiêu chuẩn vi khí hậu đã cấu hình trong hồ sơ mùa vụ.
                  </div>
                ) : (
                  passages.map((p: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <BookOpen size={11} /> #{idx + 1} {p.DocumentTitle || p.documentTitle || p.Category || p.category}
                        </span>
                        <span className="text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          Độ tương đồng: {Math.round((p.SimilarityScore ?? p.similarityScore ?? 0.8) * 100)}%
                        </span>
                      </div>
                      {(p.AuthorOrganization || p.authorOrganization) && (
                        <div className="text-[10px] text-slate-400">
                          Đơn vị ban hành: <span className="text-slate-300 font-medium">{p.AuthorOrganization || p.authorOrganization}</span>
                        </div>
                      )}
                      <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/80 p-2 rounded border border-slate-800/80 whitespace-pre-wrap">
                        {p.Content || p.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'raw' && (
              <pre className="text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap overflow-x-auto text-[10px]">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface RagSourceCardProps {
  source: any;
  index: number;
}

const RagSourceCard: React.FC<RagSourceCardProps> = ({ source, index }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [detailContent, setDetailContent] = useState<string | null>(null);
  const [chunks, setChunks] = useState<any[]>([]);

  const title = typeof source === 'string' ? source : (source.title || source.name || 'Tài liệu VietGAP');
  const org = typeof source === 'object' ? (source.organization || source.authorOrganization) : undefined;
  const category = typeof source === 'object' ? source.category : undefined;
  const similarity = typeof source === 'object' && source.similarity != null ? Math.round(source.similarity * 100) : undefined;
  const docId = typeof source === 'object' ? (source.documentId || source.DocumentId) : undefined;
  const snippet = typeof source === 'object' ? (source.contentSnippet || source.content) : undefined;

  const handleToggle = async () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);

    if (nextState && !detailContent && !snippet && docId) {
      try {
        setIsLoadingContent(true);
        const doc = await knowledgeService.getDocument(docId);
        if (doc) {
          setDetailContent(doc.contentText || null);
          setChunks(doc.chunks || []);
        }
      } catch (err) {
        console.warn('Lỗi tải chi tiết nguồn RAG:', err);
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  return (
    <div className="bg-white/95 rounded-lg border border-emerald-200/90 shadow-2xs overflow-hidden transition-all">
      <div 
        onClick={handleToggle}
        className="p-2.5 cursor-pointer hover:bg-emerald-50/50 flex flex-col gap-1.5"
      >
        <div className="flex items-start justify-between gap-2 text-[11px]">
          <span className="font-bold text-slate-800 flex items-center gap-1.5 leading-snug">
            <span className="text-emerald-700 font-mono">#{index + 1}</span>
            <span>{title}</span>
          </span>
          {similarity != null && (
            <span className="text-emerald-700 font-mono font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 text-[10px]">
              {similarity}% khớp
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {org ? (
              <span className="font-medium text-slate-700">
                Tác giả / Nguồn: <strong className="text-slate-800">{org}</strong>
              </span>
            ) : (
              <span className="font-medium text-slate-500 italic">
                Nguồn: Cơ sở tri thức nội bộ SmartFarm
              </span>
            )}
            {category && (
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                DM: {category}
              </span>
            )}
          </div>
          <button 
            type="button" 
            className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 text-[10px]"
          >
            {isExpanded ? (
              <>Thu gọn <ChevronUp size={12} /></>
            ) : (
              <>Xem nội dung & vị trí lưu trữ <ChevronDown size={12} /></>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 bg-slate-900 text-slate-200 border-t border-emerald-200/60 text-xs space-y-2.5">
          {/* Vị trí lưu trữ thực tế trong hệ thống */}
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1.5 text-[11px]">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Database size={13} className="text-cyan-400" />
              <span>Vị Trí Lưu Trữ Dữ Liệu Trong Hệ Thống:</span>
            </div>
            <div className="text-slate-300 font-mono text-[10px] space-y-1 pl-1">
              <div>• Hệ quản trị CSDL: <strong className="text-white">PostgreSQL</strong> (Database: <span className="text-amber-300">SmartFarmDB01</span>)</div>
              <div>• Bảng tài liệu quy chuẩn: <code className="text-emerald-300">agriculture_documents</code> {docId ? `(ID: ${docId})` : ''}</div>
              <div>• Bảng vector chunks RAG: <code className="text-purple-300">agriculture_knowledge_chunks</code> (Đã nhúng 768 chiều pgvector)</div>
              <div>• Nguồn gốc tài liệu: <span className="text-slate-300">Cơ sở dữ liệu tri thức canh tác SmartFarm</span></div>
            </div>
          </div>

          {/* Nội dung trích xuất từ tài liệu */}
          <div className="space-y-1.5">
            <div className="text-emerald-400 font-bold text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen size={13} className="text-emerald-400" />
                <span>Nội Dung Tri Thức RAG Được Cung Cấp Cho AI:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Trích đoạn thực tế</span>
            </div>

            {isLoadingContent ? (
              <div className="p-3 rounded-lg bg-slate-950/60 flex items-center gap-2 text-slate-400 text-[11px]">
                <RefreshCw size={12} className="animate-spin text-emerald-400" />
                Đang truy vấn nội dung từ PostgreSQL...
              </div>
            ) : (snippet || detailContent || chunks.length > 0) ? (
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-slate-200 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-line font-sans">
                {snippet ? (
                  snippet
                ) : chunks.length > 0 ? (
                  chunks.map((chk, ci) => (
                    <div key={ci} className="mb-2.5 pb-2.5 border-b border-slate-800 last:border-b-0 last:mb-0">
                      <div className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center justify-between">
                        <span>Đoạn #{chk.chunkIndex != null ? chk.chunkIndex + 1 : ci + 1}</span>
                        {chk.cropTags && <span className="text-slate-400 font-mono">Cây: {chk.cropTags}</span>}
                      </div>
                      <div className="text-slate-300">{chk.content}</div>
                    </div>
                  ))
                ) : (
                  detailContent
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-950/60 text-[11px] text-slate-400 italic">
                Quy trình tưới nhỏ giọt và dinh dưỡng VietGAP được quản trị viên đồng bộ trong kho tri thức hệ thống.
              </div>
            )}
          </div>

          <div className="pt-1.5 flex items-center justify-between border-t border-slate-800">
            <span className="text-[10px] text-slate-400">
              Trạng thái: <strong className="text-emerald-400">Đã kiểm định & Nhúng RAG</strong>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/admin/vietgap-standards');
              }}
              className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-800 text-emerald-300 font-semibold text-[10px] inline-flex items-center gap-1 border border-emerald-800 transition-colors"
            >
              Mở Thư viện Quy chuẩn VietGAP <ExternalLink size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AIAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, zones, selectedZoneId, setSelectedZoneId, refreshFarmsAndZones } = useAuth();
  const isPrivileged = user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_TECHNICIAN';
  const [isRefreshingZones, setIsRefreshingZones] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const pollTimersRef = useRef<NodeJS.Timeout[]>([]);

  const handleRefreshZones = async () => {
    setIsRefreshingZones(true);
    try {
      await refreshFarmsAndZones();
    } finally {
      setIsRefreshingZones(false);
    }
  };

  useEffect(() => {
    if (zones.length === 0) {
      void handleRefreshZones();
    }
  }, []);

  const zoneIdList = zones.map(z => z.zoneId || (z as any).id).filter(Boolean);
  const currentZoneId = (selectedZoneId && zoneIdList.includes(selectedZoneId))
    ? selectedZoneId
    : (zoneIdList[0] || '');
  
  const [aiContext, setAiContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' }
  ]);
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  useEffect(() => {
    let active = true;
    let contextTimer: any = null;
    if (currentZoneId) {
      setLoadingContext(true);
      setAiContext(null);
      // Immediately reset chat and recommendations to prevent showing old zone data
      setMessages([
        { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' }
      ]);
      setRecommendations([]);

      const loadContext = (isInitial = false) => {
        aiService.getContext(currentZoneId)
          .then(ctx => { if (active) setAiContext(ctx); })
          .catch(err => {
            console.error('Failed to load AI context:', err);
            if (active && isInitial) setAiContext(null);
          })
          .finally(() => { if (active && isInitial) setLoadingContext(false); });
      };

      loadContext(true);
      // Polling bối cảnh cảm biến mỗi 10 giây để đồng bộ với Bảng Điều khiển
      contextTimer = setInterval(() => loadContext(false), 10000);

      aiService.getMessages(currentZoneId)
        .then(hist => {
          if (!active) return;
          if (Array.isArray(hist) && hist.length > 0) {
            // Restore chat messages from history (oldest first)
            const sortedHist = [...hist].sort((a: any, b: any) => 
              new Date(a.createdAtUtc || 0).getTime() - new Date(b.createdAtUtc || 0).getTime()
            );

            const restoredChat: any[] = [];
            sortedHist.forEach((h: any, idx: number) => {
              const timeStr = h.createdAtUtc ? new Date(h.createdAtUtc).toLocaleTimeString() : 'Trước';
              if (h.question) {
                restoredChat.push({
                  messageId: `hist-q-${h.recommendationId || idx}`,
                  sender: 'USER',
                  text: h.question,
                  timestamp: timeStr
                });
              }
              const hasAction = h.isActionable && h.proposedAction;
              restoredChat.push({
                messageId: `hist-a-${h.recommendationId || idx}`,
                sender: 'AI',
                text: h.details || h.summary || 'Khuyến nghị đã được ghi nhận.',
                recommendation: hasAction ? toRecommendationCard(h) : undefined,
                sources: Array.isArray(h.sources) && h.sources.length > 0 ? h.sources : undefined,
                contextSnapshotJson: h.contextSnapshotJson,
                timestamp: timeStr
              });
            });

            if (restoredChat.length > 0) {
              setMessages([
                { messageId: 'm1', sender: 'AI', text: 'Xin chào! Tôi là Trợ lý AI Nông học VietGAP. Tôi có thể hỗ trợ bạn theo dõi vi khí hậu, tưới tiêu và phát hiện sâu bệnh.', timestamp: 'Hôm nay' },
                ...restoredChat
              ]);
            }

            // Restore actionable queue for right column: ONLY pending/ready items & not expired
            const mapped = hist
              .filter((h: any) => 
                h.isActionable && 
                h.proposedAction && 
                (h.status === 'Ready' || h.status === 'READY') &&
                (!h.validUntilUtc || new Date(h.validUntilUtc).getTime() > Date.now())
              )
              .map(toRecommendationCard);
            setRecommendations(mapped);
          } else {
            setRecommendations([]);
          }
        })
        .catch(() => {
          if (active) setRecommendations([]);
        });
    } else {
      setAiContext(null);
      setLoadingContext(false);
      setRecommendations([]);
    }
    return () => { 
      active = false; 
      if (contextTimer) clearInterval(contextTimer);
      pollTimersRef.current.forEach(clearTimeout);
      pollTimersRef.current = [];
    };
  }, [currentZoneId]);

  const handleClearHistory = async () => {
    if (!currentZoneId || isClearingHistory) return;
    const ok = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện và khuyến nghị AI của khu vực này?');
    if (!ok) return;

    setIsClearingHistory(true);
    try {
      await aiService.hideHistory(currentZoneId);
      setMessages([
        { 
          messageId: `m-reset-${Date.now()}`, 
          sender: 'AI', 
          text: 'Lịch sử tư vấn đã được làm mới. Tôi sẵn sàng phân tích vi khí hậu và trả lời các câu hỏi mới của bạn!', 
          timestamp: new Date().toLocaleTimeString() 
        }
      ]);
      setRecommendations([]);
    } catch (err: any) {
      console.error('Failed to clear AI history:', err);
      alert('Không thể xóa lịch sử tư vấn AI lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleSend = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const userText = (customQuestion || inputText).trim();
    if (!userText || isSending) return;
    if (!currentZoneId) {
      setMessages(prev => [...prev, { messageId: `msg-${Date.now()}`, sender: 'AI', text: 'Tài khoản chưa có Zone được phân quyền để tư vấn AI.', timestamp: new Date().toLocaleTimeString() }]);
      return;
    }
    setInputText('');
    setIsSending(true);
    setMessages(prev => [...prev, { messageId: `msg-${Date.now()}`, sender: 'USER', text: userText, timestamp: new Date().toLocaleTimeString() }]);
    try {
      const reply = await aiService.sendMessage(currentZoneId, userText);
      const textToDisplay = reply?.details || reply?.summary || reply?.text || reply?.answer || 'Mô hình AI Nông học đã ghi nhận yêu cầu.';
      const hasActionableRec = reply?.recommendationId && reply?.isActionable && reply?.proposedAction;
      const recCard = hasActionableRec ? toRecommendationCard(reply) : undefined;
      const rawSources = reply?.sources && Array.isArray(reply.sources) && reply.sources.length > 0 ? reply.sources : undefined;

      setMessages(prev => [...prev, { 
        messageId: `msg-${Date.now() + 1}`, 
        sender: 'AI', 
        text: textToDisplay,
        recommendation: recCard,
        sources: rawSources,
        contextSnapshotJson: reply?.contextSnapshotJson,
        timestamp: new Date().toLocaleTimeString() 
      }]);

      if (recCard) {
        setRecommendations(prev => [recCard, ...prev]);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.title || 'Không thể lấy tư vấn AI từ dữ liệu hiện tại. Vui lòng kiểm tra kết nối và thử lại.';
      setMessages(prev => [...prev, { messageId: `msg-${Date.now() + 1}`, sender: 'AI', text: detail, timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApply = async (id: string) => {
    try {
      const result = await aiService.applyRecommendation(currentZoneId, id, 'Accepted');
      const cmd = result?.command;
      const initialStatus = cmd?.status ?? 'Pending';

      // Cập nhật trạng thái thực tế trả về từ backend API
      setMessages(prev => prev.map(m => {
        if (m.recommendation && m.recommendation.recommendationId === id) {
          return {
            ...m,
            recommendation: {
              ...m.recommendation,
              status: 'ACCEPTED',
              commandStatus: initialStatus,
              commandId: cmd?.commandId
            }
          };
        }
        return m;
      }));

      // Xóa khỏi danh sách chờ xử lý ở cột bên phải
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));

      // Poll command status từ control logs để cập nhật nhãn chính xác từ thiết bị
      if (cmd?.commandId) {
        const pollCmdStatus = async () => {
          try {
            const logs = await controlService.getControlLogs(currentZoneId);
            const matchingCmd = Array.isArray(logs) ? logs.find((c: any) => c.commandId === cmd.commandId || c.id === cmd.commandId) : null;
            const realStatus = matchingCmd?.status;
            if (realStatus && realStatus in COMMAND_LABEL) {
              setMessages(prev => prev.map(m => {
                if (m.recommendation && m.recommendation.recommendationId === id) {
                  return {
                    ...m,
                    recommendation: {
                      ...m.recommendation,
                      commandStatus: realStatus
                    }
                  };
                }
                return m;
              }));
            }
          } catch { }
        };
        const t1 = setTimeout(pollCmdStatus, 2500);
        const t2 = setTimeout(pollCmdStatus, 5500);
        pollTimersRef.current.push(t1, t2);
      }
    } catch (err: any) {
      console.error('Failed to apply recommendation:', err);
      const detailMsg = err?.response?.data?.detail || err?.response?.data?.title || 'Điều kiện vi khí hậu không cho phép thực hiện lúc này.';
      
      setMessages(prev => [...prev,
        {
          messageId: `msg-alert-${Date.now()}`,
          sender: 'AI',
          text: `⚠️ Chưa thể duyệt khuyến nghị: ${detailMsg}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await aiService.applyRecommendation(currentZoneId, id, 'Rejected', 'Từ chối bởi chủ trang trại');
      setMessages(prev => prev.map(m => {
        if (m.recommendation && m.recommendation.recommendationId === id) {
          return { ...m, recommendation: { ...m.recommendation, status: 'REJECTED' } };
        }
        return m;
      }));
      setRecommendations(prev => prev.filter(r => (r.recommendationId || r.id) !== id));
    } catch (err) {
      console.error('Failed to reject recommendation:', err);
      const detail = (err as any)?.response?.data?.detail || (err as any)?.response?.data?.title || 'Không thể lưu quyết định từ chối.';
      setMessages(prev => [...prev, { messageId: `msg-alert-${Date.now()}`, sender: 'AI', text: detail, timestamp: new Date().toLocaleTimeString() }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="text-[#119653]" size={24} /> Trợ lý AI Nông học VietGAP
          </h1>
          <p className="text-xs text-slate-600 mt-1">Phân tích vi khí hậu thời gian thực, chẩn đoán sâu bệnh và đề xuất tưới thông minh theo từng Khu vực trồng (Zone).</p>
        </div>

        {/* Top Controls: Zone Selector, Refresh & Clear History */}
        <div className="flex items-center gap-2 flex-wrap">
          {zones.length > 0 ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Chọn Khu Vực (Zone):</span>
              <select
                value={currentZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {zones.map((z) => {
                  const zId = z.zoneId || (z as any).id;
                  return (
                    <option key={zId} value={zId}>
                      {z.name || `Zone ${zId?.slice(0, 8)}`}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <button
              onClick={handleRefreshZones}
              disabled={isRefreshingZones}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshingZones ? 'animate-spin' : ''} />
              {isRefreshingZones ? 'Đang tải dữ liệu...' : 'Tải lại danh sách Zone'}
            </button>
          )}

          {currentZoneId && (
            <button
              onClick={handleClearHistory}
              disabled={isClearingHistory}
              title="Xóa lịch sử tư vấn AI của Zone này"
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={13} className={isClearingHistory ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isClearingHistory ? 'Đang xóa...' : 'Xóa lịch sử'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chat Interface */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[600px] overflow-hidden">
          {/* Chat Context Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-slate-700 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${aiContext ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="flex flex-wrap items-center gap-1.5">
                  Bối cảnh AI: <strong className="text-slate-900">
                    {aiContext?.zoneName || (loadingContext ? 'Đang tải bối cảnh Zone...' : (zones.length === 0 ? 'Chưa đồng bộ danh sách Zone' : 'Chưa có dữ liệu Zone'))}
                  </strong>
                  {aiContext?.cropName && (
                    <span className="text-emerald-800 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                      🌿 {aiContext.cropName}{aiContext.growthStageName ? ` • ${aiContext.growthStageName}` : ''}{(aiContext.seasonAgeDays ?? aiContext.daysSinceStart) !== undefined ? ` (Ngày ${aiContext.seasonAgeDays ?? aiContext.daysSinceStart})` : ''}
                      {aiContext.growthProfileName ? ` • 📜 ${aiContext.growthProfileName}` : ''}
                    </span>
                  )}
                </span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold shrink-0 whitespace-nowrap shadow-2xs">
                {loadingContext ? 'Đang cập nhật...' : aiContext ? `${aiContext.telemetry?.filter((x: any) => x.isFresh && !['ph', 'soilph', 'ec', 'soilec'].includes((x.parameterCode || '').toLowerCase())).length ?? 0} cảm biến realtime · ${aiContext.weather?.available ? '🌤️ Thời tiết thực tế' : '⚠️ Thiếu thời tiết'}` : (zones.length === 0 ? 'Vui lòng bấm tải lại Zone' : 'Chưa tải được dữ liệu')}
              </span>
            </div>

            {/* Micro Sensor Bar: 4 Thông số vi khí hậu & thổ nhưỡng cốt lõi (Đồng bộ với Bảng Điều khiển) */}
            {aiContext?.telemetry && aiContext.telemetry.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-0.5 text-[11px]">
                {aiContext.telemetry
                  .filter((t: any) => !['ph', 'soilph', 'ec', 'soilec'].includes((t.parameterCode || '').toLowerCase()))
                  .sort((a: any, b: any) => {
                    const order = ['temperature', 'soilmoisture', 'airhumidity', 'light', 'lightintensity'];
                    const idxA = order.indexOf((a.parameterCode || '').toLowerCase());
                    const idxB = order.indexOf((b.parameterCode || '').toLowerCase());
                    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                  })
                  .map((t: any) => {
                    const req = aiContext.requirements?.find((r: any) => r.parameterCode === t.parameterCode);
                    const formattedValue = !isNaN(Number(t.value)) ? Number(t.value) : t.value;
                    const minVal = req?.minValue !== undefined && !isNaN(Number(req.minValue)) ? Number(req.minValue) : req?.minValue;
                    const maxVal = req?.maxValue !== undefined && !isNaN(Number(req.maxValue)) ? Number(req.maxValue) : req?.maxValue;

                    return (
                      <div key={t.parameterCode} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs whitespace-nowrap">
                        <span className="text-slate-400 font-medium">
                          {t.parameterCode === 'Temperature' ? '🌡️ Nhiệt độ' :
                           t.parameterCode === 'SoilMoisture' ? '🌱 Ẩm đất' :
                           t.parameterCode === 'AirHumidity' ? '💧 Ẩm KK' :
                           (t.parameterCode === 'Light' || t.parameterCode === 'LightIntensity') ? '☀️ Ánh sáng' : t.parameterCode}:
                        </span>
                        <strong className="text-slate-800 font-mono">{formattedValue} {t.unit}</strong>
                        {req && minVal !== undefined && maxVal !== undefined && (
                          <span className="text-[10px] text-emerald-700 font-sans ml-0.5 font-medium">
                            (chuẩn: {minVal}-{maxVal})
                          </span>
                        )}
                      </div>
                    );
                })}
                {aiContext.weather?.temperatureCelsius !== undefined && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 shadow-2xs whitespace-nowrap">
                    <span>Dự báo 6h:</span>
                    <strong>{aiContext.weather.rainProbabilityNext6HoursMaxPercent ?? 0}% mưa</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50/50">
            {messages.map(msg => {
              const isUser = msg.senderType === 'USER' || msg.sender === 'USER';
              const textContent = cleanTechnicalIds(msg.messageText || msg.text || '');
              return (
                <div key={msg.messageId} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-[#119653] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Bot size={18} />
                    </div>
                  )}

                  <div className={`max-w-[85%] p-4 rounded-xl space-y-2 ${isUser ? 'bg-[#119653] text-white rounded-br-none shadow-xs' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{textContent}</p>

                  {/* Embedded Recommendation Card inside AI message */}
                  {msg.recommendation && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 rounded-xl space-y-3 shadow-xs">
                      {/* Header with Title and Badges */}
                      <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Sparkles size={13} />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mb-0.5">
                              Đề xuất giải pháp
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">{msg.recommendation.title}</h4>
                          </div>
                        </div>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono shrink-0">
                          {msg.recommendation.confidenceScore}% Tin cậy
                        </span>
                      </div>

                      {/* Action proposal if available */}
                      {msg.recommendation.proposedAction && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-100/70 border border-emerald-300 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Cpu size={14} />
                            </div>
                            <div>
                              <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Hành động đề xuất</div>
                              <div className="text-slate-900 font-bold text-xs">
                                {msg.recommendation.proposedAction === 'TurnOn' ? 'Bật máy bơm tưới nước' : msg.recommendation.proposedAction === 'TurnOff' ? 'Tắt máy bơm tưới' : msg.recommendation.proposedAction}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-white font-mono font-bold text-emerald-800 border border-emerald-200 text-xs">
                            ⏱️ {msg.recommendation.proposedDurationSeconds ? `${Math.round(msg.recommendation.proposedDurationSeconds / 60)} phút (${msg.recommendation.proposedDurationSeconds}s)` : 'Theo chu kỳ'}
                          </span>
                        </div>
                      )}

                      {/* Details text */}
                      <p className="text-slate-700 text-xs leading-relaxed font-sans bg-white/80 p-2.5 rounded-lg border border-emerald-100/80">
                        {msg.recommendation.recommendationText}
                      </p>

                      {/* Analysis and Notes */}
                      {msg.recommendation.reasoning && (
                        <div className="text-[11px] text-slate-600 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/70 space-y-1">
                          <div className="font-semibold text-slate-700 flex items-center gap-1">
                            <ShieldAlert size={12} className="text-emerald-600" /> Căn cứ kỹ thuật & Lưu ý:
                          </div>
                          <p className="leading-relaxed text-slate-600">{msg.recommendation.reasoning}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 italic">Xác nhận để kích hoạt thiết bị</span>
                        {msg.recommendation.status === 'ACCEPTED' ? (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border transition-all ${
                            msg.recommendation.commandStatus === 'Failed' || msg.recommendation.commandStatus === 'TimedOut' || msg.recommendation.commandStatus === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : msg.recommendation.commandStatus === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : msg.recommendation.commandStatus === 'Sent'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {msg.recommendation.commandStatus === 'Failed' || msg.recommendation.commandStatus === 'Cancelled' ? (
                              <>
                                <XCircle size={14} className="text-rose-600" />
                                <span>{COMMAND_LABEL[msg.recommendation.commandStatus] || 'Lệnh thất bại'}</span>
                              </>
                            ) : msg.recommendation.commandStatus === 'TimedOut' ? (
                              <>
                                <Clock size={14} className="text-rose-500" />
                                <span>{COMMAND_LABEL.TimedOut}</span>
                              </>
                            ) : msg.recommendation.commandStatus === 'Pending' ? (
                              <>
                                <Clock size={14} className="text-amber-600 animate-pulse" />
                                <span>{COMMAND_LABEL.Pending}</span>
                              </>
                            ) : msg.recommendation.commandStatus === 'Sent' ? (
                              <>
                                <RefreshCw size={14} className="text-sky-600 animate-spin" />
                                <span>{COMMAND_LABEL.Sent}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                <span>{COMMAND_LABEL[msg.recommendation.commandStatus] || 'Thiết bị đã xác nhận lệnh'}</span>
                              </>
                            )}
                          </div>
                        ) : msg.recommendation.status === 'REJECTED' ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-semibold text-xs border border-rose-200">
                            <XCircle size={14} className="text-rose-600" /> Đã từ chối khuyến nghị
                          </div>
                        ) : (msg.recommendation.validUntilUtc && new Date(msg.recommendation.validUntilUtc).getTime() <= Date.now()) ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium text-xs border border-slate-200">
                            <Clock size={13} className="text-slate-400" /> Khuyến nghị đã hết hạn (15p)
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs text-slate-600 border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                              onClick={() => handleReject(msg.recommendation!.recommendationId)}
                            >
                              <XCircle size={13} className="mr-1 text-slate-500" /> Bỏ qua
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs px-3.5 py-1.5 rounded-lg transition-all"
                              onClick={() => handleApply(msg.recommendation!.recommendationId)}
                            >
                              <CheckCircle2 size={13} className="mr-1" /> 
                              {msg.recommendation.proposedAction === 'TurnOn' 
                                ? `Duyệt bật bơm (${msg.recommendation.proposedDurationSeconds ? `${Math.round(msg.recommendation.proposedDurationSeconds / 60)}p` : '10p'})` 
                                : msg.recommendation.proposedAction === 'TurnOff'
                                  ? 'Duyệt tắt bơm'
                                  : `Duyệt ${actionLabel(msg.recommendation.proposedAction)}`}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Tài liệu & Quy chuẩn VietGAP trích dẫn từ RAG */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/90 text-[11px] space-y-2">
                      <div className="flex items-center justify-between font-semibold text-emerald-900">
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} className="text-emerald-700" />
                          <span>Tài liệu & Quy chuẩn trích dẫn từ RAG ({msg.sources.length} mục):</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono border border-emerald-300">
                          RAG Match
                        </span>
                      </div>

                      <div className="space-y-2">
                        {msg.sources.map((s: any, idx: number) => (
                          <RagSourceCard key={idx} source={s} index={idx} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Log dữ liệu BE gửi cho AI (chỉ hiện cho Admin hoặc chế độ debug) */}
                  {!isUser && isPrivileged && (msg.contextSnapshotJson || msg.recommendation?.contextSnapshotJson) && (
                    <AiPayloadLogViewer snapshotJson={msg.contextSnapshotJson || msg.recommendation?.contextSnapshotJson} />
                  )}

                  <span className={`text-[9px] block text-right opacity-70 ${isUser ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {msg.createdAt || msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* AI Thinking Indicator */}
          {isSending && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#119653] text-white">
                <Bot size={14} className="animate-pulse" />
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-slate-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-slate-400 font-mono ml-1">AI đang đối chiếu dữ liệu cảm biến & quy chuẩn VietGAP...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-3 py-1.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-medium whitespace-nowrap text-[10px]">Gợi ý nhanh:</span>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Nhiệt độ và độ ẩm đất hiện tại thế nào, có cần kích hoạt tưới nhỏ giọt không?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              💧 Vi khí hậu & nhu cầu tưới
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Cây trồng ở giai đoạn hiện tại có nguy cơ mắc bệnh gì và cách phòng trừ IPM theo VietGAP?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              🐛 Sâu bệnh hại & giải pháp IPM
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Thời tiết dự báo tiếp theo có thích hợp cho sự phát triển của cây không?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              🌤️ Đánh giá thời tiết & cây trồng
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Có lịch tưới tự động nào sắp chạy trong hôm nay không?')}
              disabled={isSending}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 hover:border-emerald-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              ⏰ Lịch tưới sắp tới
            </button>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <Input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Hỏi AI về lượng nước tưới, triệu chứng vi khí hậu, lịch tưới..."
              className="flex-1"
              disabled={isSending}
            />
            <Button type="submit" disabled={isSending || !inputText.trim()}>
              <Send size={15} />
            </Button>
          </form>
        </div>

        {/* Right Col: Active Recommendation Cards Inbox */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" /> Hàng đợi Duyệt Khuyến nghị
            </h3>
            {recommendations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {recommendations.length}
              </span>
            )}
          </div>

          {recommendations.length === 0 ? (
            <div className="p-6 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <Sprout size={28} className="mx-auto text-slate-400" />
              <p className="text-xs text-slate-600 font-medium">Chưa có khuyến nghị mới cần duyệt</p>
              <p className="text-[11px] text-slate-400">Các đề xuất tưới tiêu hoặc vi khí hậu từ AI sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            recommendations.map((rec, idx) => (
              <div key={rec.recommendationId || rec.id || `rec-${idx}`} className="p-4 bg-white border border-emerald-200 hover:border-emerald-300 rounded-xl space-y-3 shadow-xs hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {rec.recommendationType || 'NÔNG HỌC VIETGAP'}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {rec.confidenceScore}% Tin cậy
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.title}</h4>
                <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">{rec.recommendationText}</p>

                {rec.reasoning && (
                  <div className="p-2.5 bg-slate-50/80 rounded-lg text-[10px] text-slate-600 font-mono leading-relaxed border border-slate-200">
                    <strong className="text-slate-700">Căn cứ:</strong> {rec.reasoning}
                  </div>
                )}



                <div className="flex items-center justify-between pt-1">
                  {rec.status === 'ACCEPTED' ? (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Đã phê duyệt</span>
                  ) : (
                    <div className="flex gap-2 w-full">
                      <Button size="sm" variant="outline" className="w-1/2 text-xs" onClick={() => handleReject(rec.recommendationId || rec.id)}>
                        <XCircle size={13} className="mr-1 text-slate-500" /> Bỏ qua
                      </Button>
                      <Button size="sm" className="w-1/2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium" onClick={() => handleApply(rec.recommendationId || rec.id)}>
                        <CheckCircle2 size={13} className="mr-1" /> 
                        {rec.proposedAction === 'TurnOn' 
                          ? 'Duyệt bật bơm' 
                          : rec.proposedAction === 'TurnOff' 
                            ? 'Duyệt tắt bơm' 
                            : 'Duyệt'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
