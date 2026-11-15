import React, { useState, useEffect, useCallback } from 'react';
import { alertService } from '../../services';
import { StatusBadge, Button, Modal } from '../../components/ui/BaseUI';
import {
  ShieldAlert, CheckCircle2, Plus, Settings, Trash2, Edit3,
  Droplets, Thermometer, Wind, Sun, Zap, Activity, Cpu,
  X, ChevronDown, ChevronUp, Play, Pause, RefreshCw, Power, Info, Check,
  FlameKindling, Radio, Wifi
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AlertRule {
  id: string; name: string; metric: string; unit: string;
  minThreshold: number; maxThreshold: number; zone: string;
  severity: 'WARNING' | 'CRITICAL'; action: string; enabled: boolean;
}
interface LiveAlert {
  id: string; ruleId: string; metric: string; value: number;
  threshold: string; zone: string; severity: 'WARNING' | 'CRITICAL';
  action: string; time: string; acked: boolean;
}

// ─── Sensor definitions ───────────────────────────────────────────────────────
const METRICS = [
  { key: 'soil_moisture', label: 'Độ ẩm đất',   unit: '%',   icon: Droplets,      color: 'sky',     min: 0,   max: 100   },
  { key: 'temperature',   label: 'Nhiệt độ',     unit: '°C',  icon: Thermometer,   color: 'orange',  min: -10, max: 60    },
  { key: 'humidity',      label: 'Độ ẩm KK',     unit: '%',   icon: Wind,          color: 'teal',    min: 0,   max: 100   },
  { key: 'light',         label: 'Ánh sáng',     unit: 'lux', icon: Sun,           color: 'yellow',  min: 0,   max: 100000},
  { key: 'battery',       label: 'Pin Node',     unit: '%',   icon: Zap,           color: 'emerald', min: 0,   max: 100   },
  { key: 'co2',           label: 'CO₂',          unit: 'ppm', icon: FlameKindling, color: 'violet', min: 300, max: 5000  },
];

const ZONES = ['Nhà màng Z01 - Cà chua', 'Nhà màng Z02 - Ớt', 'Lô đất A1', 'Lô đất B2'];

const ICON_COLOR: Record<string, string> = {
  sky: 'text-sky-600 bg-sky-100 border-sky-200',
  orange: 'text-orange-600 bg-orange-100 border-orange-200',
  teal: 'text-teal-600 bg-teal-100 border-teal-200',
  yellow: 'text-yellow-600 bg-yellow-100 border-yellow-200',
  emerald: 'text-emerald-600 bg-emerald-100 border-emerald-200',
  violet: 'text-violet-600 bg-violet-100 border-violet-200',
};

const DEFAULT_RULES: AlertRule[] = [];

function fmtVal(val: number, key: string) {
  if (key === 'light') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
  return key === 'co2' ? val.toFixed(0) : val.toFixed(1);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AlertsPage: React.FC = () => {
  const [historicAlerts, setHistoricAlerts] = useState<any[]>([]);

  useEffect(() => {
    alertService.getAlerts().then(data => {
      if (Array.isArray(data)) setHistoricAlerts(data);
    }).catch(err => console.error('Failed to load alerts:', err));
  }, []);

  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<AlertRule>>({});
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, { action: string; since: string }>>({});
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});
  const telemetrySequence = Date.now();
  const checkRules = useCallback((vals: Record<string, number>) => {
    const newAlerts: LiveAlert[] = [];
    const newActions: Record<string, { action: string; since: string; severity: 'WARNING' | 'CRITICAL' }> = {};
    rules.filter(r => r.enabled).forEach(rule => {
      const val = vals[rule.metric];
      if (val === undefined) return;
      if (val < rule.minThreshold || val > rule.maxThreshold) {
        const threshold = val < rule.minThreshold
          ? `Thấp hơn ngưỡng MIN ${rule.minThreshold}${rule.unit}`
          : `Cao hơn ngưỡng MAX ${rule.maxThreshold}${rule.unit}`;
        newAlerts.push({ id: `live-${rule.id}-${telemetrySequence}`, ruleId: rule.id, metric: rule.metric, value: val, threshold, zone: rule.zone, severity: rule.severity, action: rule.action, time: new Date().toLocaleTimeString('vi-VN'), acked: false });
        newActions[rule.id] = { action: rule.action, since: new Date().toLocaleTimeString('vi-VN'), severity: rule.severity };
      }
    });
    setLiveAlerts(newAlerts);
    setActiveActions(newActions);
  }, [rules, telemetrySequence]);

  useEffect(() => { checkRules(sensorValues); }, [checkRules, sensorValues]);

  // Sensor values come only from backend telemetry; no local simulator.

  const openNew = () => {
    setEditingRule(null);
    setRuleForm({ name: '', metric: 'soil_moisture', unit: '%', minThreshold: 40, maxThreshold: 90, zone: ZONES[0], severity: 'WARNING', action: 'Bật máy bơm tưới', enabled: true });
    setShowRuleModal(true);
  };
  const openEdit = (r: AlertRule) => { setEditingRule(r); setRuleForm({ ...r }); setShowRuleModal(true); };
  const saveRule = () => {
    if (!ruleForm.name) return;
    const m = METRICS.find(x => x.key === ruleForm.metric);
    const rule: AlertRule = { id: editingRule?.id || `r${Date.now()}`, name: ruleForm.name!, metric: ruleForm.metric!, unit: m?.unit || ruleForm.unit || '', minThreshold: Number(ruleForm.minThreshold ?? 0), maxThreshold: Number(ruleForm.maxThreshold ?? 100), zone: ruleForm.zone || ZONES[0], severity: (ruleForm.severity as any) || 'WARNING', action: ruleForm.action || '', enabled: ruleForm.enabled ?? true };
    setRules(prev => editingRule ? prev.map(r => r.id === editingRule.id ? rule : r) : [...prev, rule]);
    setShowRuleModal(false);
  };

  return (
    <div className="space-y-6 pb-36">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-rose-600" size={22} /> Trung tâm Cảnh báo Nông nghiệp (Alert Management)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách các vi phạm dải vi khí hậu an toàn và thông báo sự cố phần cứng.</p>
        </div>
        <Button onClick={openNew} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold shadow-xs">
          <Plus size={16} className="mr-1.5" /> Cấu hình Luật Cảnh báo
        </Button>
      </div>

      {/* Live alerts */}
      {liveAlerts.filter(a => !a.acked).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-rose-700 flex items-center gap-2">
            <Activity size={13} className="animate-pulse" /> Cảnh báo REAL-TIME từ Sensor ({liveAlerts.filter(a => !a.acked).length})
          </div>
          {liveAlerts.filter(a => !a.acked).map(a => {
            const md = METRICS.find(m => m.key === a.metric);
            const Icon = md?.icon || Activity;
            return (
              <div key={a.id} className={`p-4 rounded-xl border-l-4 flex items-start justify-between gap-4 animate-in fade-in duration-300 ${a.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-500 border border-rose-200' : 'bg-amber-50 border-amber-400 border border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.severity === 'CRITICAL' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                    <Icon size={15} className={a.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{a.severity}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{a.time}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{md?.label}: <span className={a.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}>{fmtVal(a.value, a.metric)}{md?.unit}</span></div>
                    <div className="text-xs text-slate-600">{a.threshold}</div>
                    <div className="text-xs text-slate-500">Khu vực: <strong>{a.zone}</strong></div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                      <Power size={10} className="text-emerald-600" /> Hành động tự động: {a.action}
                    </div>
                  </div>
                </div>
                <button onClick={() => setLiveAlerts(p => p.map(x => x.id === a.id ? { ...x, acked: true } : x))} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-700">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Rules table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Settings size={15} className="text-white" /> Cấu hình Luật Cảnh báo ({rules.length} luật)
          </div>
          <button onClick={openNew} className="text-[11px] flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white px-2.5 py-1 rounded-lg transition-colors font-semibold">
            <Plus size={12} /> Thêm luật mới
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {rules.map(rule => {
            const md = METRICS.find(m => m.key === rule.metric);
            const Icon = md?.icon || Activity;
            const isViolating = !!activeActions[rule.id];
            const cv = sensorValues[rule.metric];
            return (
              <div key={rule.id} className={`px-5 py-3 flex items-center gap-4 text-xs transition-all ${!rule.enabled ? 'opacity-50' : ''} ${isViolating ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                <button onClick={() => setRules(p => p.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} className={`w-9 h-5 rounded-full transition-all shrink-0 relative ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${ICON_COLOR[md?.color || 'sky']}`}><Icon size={15} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{rule.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${rule.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{rule.severity}</span>
                    {isViolating && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold animate-pulse">⚡ VI PHẠM</span>}
                  </div>
                  <div className="text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>{md?.label}: <strong className="text-slate-700">[{rule.minThreshold}–{rule.maxThreshold}]{rule.unit}</strong></span>
                    <span>Zone: <strong className="text-slate-700">{rule.zone}</strong></span>
                    {cv !== undefined && <span className={`font-mono font-bold ${(cv < rule.minThreshold || cv > rule.maxThreshold) ? 'text-rose-600' : 'text-emerald-600'}`}>Hiện tại: {fmtVal(cv, rule.metric)}{rule.unit}</span>}
                  </div>
                  {isViolating && <div className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1"><Power size={10} /> {activeActions[rule.id]?.action}</div>}
                </div>
                <div className="hidden lg:flex items-center gap-1 text-[10px] bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 shrink-0 max-w-[160px] truncate">
                  <Zap size={10} className="text-amber-600 shrink-0" /> {rule.action}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Edit3 size={14} /></button>
                  <button onClick={() => setRules(p => p.filter(r => r.id !== rule.id))} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historic alerts */}
      <div>
        <div className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-2"><ShieldAlert size={13} /> Lịch sử Cảnh báo hệ thống</div>
        <div className="space-y-3">
          {historicAlerts.map((a: any) => (
            <div key={a.alertId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-600 font-mono">#{a.alertId}</span>
                  <StatusBadge status={a.status} />
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">{a.severity}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                <p className="text-xs text-slate-600">{a.message}</p>
                <div className="text-[11px] text-slate-500 pt-1">Khu vực: <strong className="text-slate-800">{a.zoneName}</strong> | Giá trị vượt ngưỡng: <strong className="text-rose-600">{a.triggeredValue}</strong> (Mục tiêu: {a.targetRange})</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.status === 'OPEN' && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await alertService.acknowledgeAlert(a.alertId, 'Đã tiếp nhận xử lý từ giao diện');
                      } catch (err) {
                        console.error('Failed to acknowledge alert on backend:', err);
                      }
                      setHistoricAlerts(p => p.map((x: any) => x.alertId === a.alertId ? { ...x, status: 'ACKNOWLEDGED' } : x));
                    }}
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live telemetry is rendered only when supplied by the backend. */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-500 flex items-center gap-2">
        <Radio size={14} className="text-emerald-600" />
        Chỉ hiển thị dữ liệu cảm biến thật từ Node/Gateway; chưa có telemetry thì không tạo giá trị mẫu.
      </div>
      {/* ═══ RULE MODAL ═══ */}
      <Modal isOpen={showRuleModal} title={editingRule ? '✏️ Chỉnh sửa Luật Cảnh báo' : '➕ Thêm Luật Cảnh báo mới'} onClose={() => setShowRuleModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên luật *</label>
            <input type="text" value={ruleForm.name || ''} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="Ví dụ: Đất khô - Tưới nước" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Thông số giám sát *</label>
            <select value={ruleForm.metric || 'soil_moisture'} onChange={e => { const m = METRICS.find(x => x.key === e.target.value); setRuleForm(p => ({ ...p, metric: e.target.value, unit: m?.unit || '' })); }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]">
              {METRICS.map(m => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngưỡng MIN *</label>
              <input type="number" value={ruleForm.minThreshold ?? ''} onChange={e => setRuleForm(p => ({ ...p, minThreshold: parseFloat(e.target.value) }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngưỡng MAX *</label>
              <input type="number" value={ruleForm.maxThreshold ?? ''} onChange={e => setRuleForm(p => ({ ...p, maxThreshold: parseFloat(e.target.value) }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]" />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Khu vực áp dụng</label>
            <select value={ruleForm.zone || ZONES[0]} onChange={e => setRuleForm(p => ({ ...p, zone: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]">
              <option value="Tất cả">Tất cả khu vực</option>
              {ZONES.map(z => <option key={z}>{z}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mức độ nghiêm trọng</label>
              <select value={ruleForm.severity || 'WARNING'} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value as any }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]">
                <option value="WARNING">⚠️ WARNING</option>
                <option value="CRITICAL">🔴 CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trạng thái</label>
              <select value={ruleForm.enabled ? 'true' : 'false'} onChange={e => setRuleForm(p => ({ ...p, enabled: e.target.value === 'true' }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]">
                <option value="true">✅ Bật ngay</option>
                <option value="false">⏸ Tắt</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hành động tự động khi vi phạm</label>
            <select value={ruleForm.action || 'Bật máy bơm tưới'} onChange={e => setRuleForm(p => ({ ...p, action: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#119653]">
              {['Bật máy bơm tưới','Tắt máy bơm tưới','Bật quạt thông gió','Tắt quạt thông gió','Bật phun sương','Bật đèn chiếu sáng bổ sung','Tắt đèn UV','Gửi thông báo kỹ thuật viên','Thay pin / sạc thiết bị','Đóng mái che','Mở cửa thông gió'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          {/* Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
            <div className="font-bold text-slate-700 mb-1">Xem trước luật:</div>
            <p>Nếu <strong>{METRICS.find(m => m.key === ruleForm.metric)?.label}</strong> &lt; <strong>{ruleForm.minThreshold}</strong> hoặc &gt; <strong>{ruleForm.maxThreshold}{ruleForm.unit}</strong> tại <strong>{ruleForm.zone}</strong> → cảnh báo <strong className={ruleForm.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}>{ruleForm.severity}</strong> và <strong className="text-emerald-700">{ruleForm.action}</strong></p>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowRuleModal(false)}>Hủy</Button>
            <Button disabled={!ruleForm.name} onClick={saveRule} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold shadow-xs">
              <Check size={14} className="mr-1" /> {editingRule ? 'Cập nhật' : 'Tạo Luật mới'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
