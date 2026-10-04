import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mockAlerts } from '../../mocks/mockData';
import { StatusBadge, Button, Modal } from '../../components/ui/BaseUI';
import {
  ShieldAlert, CheckCircle2, Bot, Plus, Settings, Trash2, Edit3,
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
  { key: 'soil_moisture', label: 'Độ ẩm đất',   unit: '%',   icon: Droplets,      color: 'sky',     baseVal: 65,    min: 0,   max: 100   },
  { key: 'temperature',   label: 'Nhiệt độ',     unit: '°C',  icon: Thermometer,   color: 'orange',  baseVal: 27,    min: -10, max: 60    },
  { key: 'humidity',      label: 'Độ ẩm KK',     unit: '%',   icon: Wind,          color: 'teal',    baseVal: 72,    min: 0,   max: 100   },
  { key: 'light',         label: 'Ánh sáng',     unit: 'lux', icon: Sun,           color: 'yellow',  baseVal: 18000, min: 0,   max: 100000},
  { key: 'battery',       label: 'Pin Node',     unit: '%',   icon: Zap,           color: 'emerald', baseVal: 78,    min: 0,   max: 100   },
  { key: 'co2',           label: 'CO₂',          unit: 'ppm', icon: FlameKindling, color: 'violet',  baseVal: 420,   min: 300, max: 5000  },
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

const DEFAULT_RULES: AlertRule[] = [
  { id: 'r1', name: 'Đất khô – Tưới nước', metric: 'soil_moisture', unit: '%', minThreshold: 40, maxThreshold: 90, zone: 'Nhà màng Z01 - Cà chua', severity: 'WARNING',  action: 'Bật máy bơm tưới',      enabled: true },
  { id: 'r2', name: 'Nhiệt độ quá cao',    metric: 'temperature',   unit: '°C', minThreshold: 10, maxThreshold: 35, zone: 'Nhà màng Z01 - Cà chua', severity: 'CRITICAL', action: 'Bật quạt thông gió',    enabled: true },
  { id: 'r3', name: 'Độ ẩm KK thấp',      metric: 'humidity',      unit: '%', minThreshold: 55, maxThreshold: 95, zone: 'Nhà màng Z02 - Ớt',      severity: 'WARNING',  action: 'Bật phun sương',         enabled: true },
  { id: 'r4', name: 'Pin Node yếu',        metric: 'battery',       unit: '%', minThreshold: 20, maxThreshold: 100, zone: 'Tất cả',                 severity: 'CRITICAL', action: 'Thay pin / sạc thiết bị', enabled: true },
];

function fmtVal(val: number, key: string) {
  if (key === 'light') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
  return key === 'co2' ? val.toFixed(0) : val.toFixed(1);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AlertsPage: React.FC = () => {
  const [historicAlerts, setHistoricAlerts] = useState(mockAlerts);
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<AlertRule>>({});
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, { action: string; since: string }>>({});
  const [sensorValues, setSensorValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(METRICS.map(m => [m.key, m.baseVal]))
  );
  const [simRunning, setSimRunning] = useState(true);
  const [simExpanded, setSimExpanded] = useState(true);
  const [autoLog, setAutoLog] = useState<{msg:string;time:string}[]>([]);
  const [showLog, setShowLog] = useState(false);
  const tickRef = useRef(0);
  const sensorRef = useRef(sensorValues);
  sensorRef.current = sensorValues;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const checkRules = useCallback((vals: Record<string, number>) => {
    const newAlerts: LiveAlert[] = [];
    const newActions: Record<string, { action: string; since: string; severity: 'WARNING' | 'CRITICAL' }> = {};
    rulesRef.current.filter(r => r.enabled).forEach(rule => {
      const val = vals[rule.metric];
      if (val === undefined) return;
      if (val < rule.minThreshold || val > rule.maxThreshold) {
        const threshold = val < rule.minThreshold
          ? `Thấp hơn ngưỡng MIN ${rule.minThreshold}${rule.unit}`
          : `Cao hơn ngưỡng MAX ${rule.maxThreshold}${rule.unit}`;
        newAlerts.push({ id: `live-${rule.id}-${tickRef.current}`, ruleId: rule.id, metric: rule.metric, value: val, threshold, zone: rule.zone, severity: rule.severity, action: rule.action, time: new Date().toLocaleTimeString('vi-VN'), acked: false });
        newActions[rule.id] = { action: rule.action, since: new Date().toLocaleTimeString('vi-VN'), severity: rule.severity };
      }
    });
    setLiveAlerts(newAlerts);
    // Log state changes
    setActiveActions(prev => {
      const prevIds = new Set(Object.keys(prev));
      const newIds = new Set(Object.keys(newActions));
      const changes: string[] = [];
      newIds.forEach(id => { if (!prevIds.has(id)) changes.push(`🟢 TỰ ĐỘNG BẬT: ${newActions[id].action}`); });
      prevIds.forEach(id => { if (!newIds.has(id)) changes.push(`🔴 TỰ ĐỘNG TẮT: ${prev[id].action}`); });
      if (changes.length > 0) {
        setAutoLog(l => [...changes.map(c => ({ msg: c, time: new Date().toLocaleTimeString('vi-VN') })), ...l].slice(0, 20));
      }
      return newActions;
    });
  }, []);

  useEffect(() => { checkRules(sensorValues); }, []);

  useEffect(() => {
    if (!simRunning) return;
    const t = setInterval(() => {
      tickRef.current += 1;
      setSensorValues(prev => {
        const next: Record<string, number> = {};
        METRICS.forEach(m => {
          const drift = prev[m.key] * (1 + (Math.random() * 0.001 - 0.0005));
          next[m.key] = parseFloat(Math.min(m.max, Math.max(m.min, drift)).toFixed(2));
        });
        checkRules(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [simRunning, checkRules]);

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
        <Button onClick={openNew} className="bg-[#062326] hover:bg-[#062326]/90 text-white">
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
        <div className="flex items-center justify-between px-5 py-3 bg-[#062326] text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Settings size={15} className="text-emerald-400" /> Cấu hình Luật Cảnh báo ({rules.length} luật)
          </div>
          <button onClick={openNew} className="text-[11px] flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg transition-colors">
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
                <Button size="sm" variant="outline"><Bot size={14} className="mr-1" /> Hỏi AI</Button>
                {a.status === 'OPEN' && <Button size="sm" onClick={() => setHistoricAlerts(p => p.map((x: any) => x.alertId === a.alertId ? { ...x, status: 'ACKNOWLEDGED' } : x))}><CheckCircle2 size={14} className="mr-1" /> Xác nhận</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FLOATING SENSOR WIDGET ═══ */}
      <div className="fixed bottom-6 right-6 z-[9999] w-80 shadow-2xl rounded-2xl overflow-hidden border border-slate-700">
        {/* Widget header */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#062326] text-white cursor-pointer select-none" onClick={() => setSimExpanded(p => !p)}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${simRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <Cpu size={13} className="text-emerald-400" />
            <span className="text-xs font-bold">IoT Sensor Live Feed</span>
            <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-mono">5s/tick</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={e => { e.stopPropagation(); setSimRunning(p => !p); }} className="p-1 rounded hover:bg-white/10" title={simRunning ? 'Tạm dừng' : 'Chạy'}>
              {simRunning ? <Pause size={12} className="text-amber-400" /> : <Play size={12} className="text-emerald-400" />}
            </button>
            <button onClick={e => { e.stopPropagation(); const v = Object.fromEntries(METRICS.map(m => [m.key, m.baseVal])); setSensorValues(v); checkRules(v); }} className="p-1 rounded hover:bg-white/10" title="Reset">
              <RefreshCw size={12} className="text-slate-400" />
            </button>
            {simExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
          </div>
        </div>

        {simExpanded && (
          <div className="bg-slate-900 p-3 space-y-1.5 max-h-96 overflow-y-auto">
            <div className="text-[10px] text-slate-400 pb-1.5 border-b border-slate-800 flex items-center gap-1">
              <Info size={10} /> Mô phỏng IoT: mỗi 5s biến động ±0.05% so với giá trị trước. Nhập thủ công để test luật.
            </div>
            {METRICS.map(m => {
              const val = sensorValues[m.key];
              const Icon = m.icon;
              const badRule = rules.find(r => r.enabled && r.metric === m.key && (val < r.minThreshold || val > r.maxThreshold));
              const pct = ((val - m.min) / (m.max - m.min)) * 100;
              return (
                <div key={m.key} className={`rounded-lg p-2 ${badRule ? 'bg-slate-800 ring-1 ring-rose-500/50' : 'bg-slate-800/60'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon size={12} className={badRule ? 'text-rose-400' : 'text-slate-400'} />
                      <span className="text-[11px] text-slate-300">{m.label}</span>
                      {badRule && <span className="text-[9px] font-bold text-rose-400 animate-pulse">⚠️</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" step={m.key === 'light' ? 100 : 0.1} min={m.min} max={m.max} value={val}
                        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { const next = { ...sensorRef.current, [m.key]: parseFloat(Math.min(m.max, Math.max(m.min, v)).toFixed(2)) }; setSensorValues(next); checkRules(next); } }}
                        className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-[11px] font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 text-right"
                      />
                      <span className="text-[10px] text-slate-500 w-8 shrink-0">{m.unit}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${badRule ? (badRule.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-400') : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  {badRule && <div className="mt-1 text-[9px] text-amber-300 flex items-center gap-1"><Power size={8} /> {badRule.action}</div>}
                </div>
              );
            })}
            {/* ── Actuator auto ON/OFF panel ── */}
            <div className="pt-2 border-t border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                  <Power size={10} className="text-emerald-400" /> Trạng thái thiết bị (Mặc định OFF ➔ Tự động BẬT khi có sự cố)
                </div>
                <button onClick={() => setShowLog(p => !p)} className="text-[9px] text-slate-400 hover:text-slate-200 underline">
                  {showLog ? 'Ẩn nhật ký' : 'Xem nhật ký'}
                </button>
              </div>
              {/* Derive unique actuators from all enabled rules */}
              {rules.filter(r => r.enabled).map(rule => {
                const isOn = !!activeActions[rule.id];
                const md = METRICS.find(m => m.key === rule.metric);
                return (
                  <div key={rule.id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-500 ${isOn ? 'bg-emerald-900/60 ring-1 ring-emerald-500/60' : 'bg-slate-800/60'}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 transition-all duration-500 ${isOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className={`text-[10px] truncate ${isOn ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                        {rule.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {md && <span className="text-[9px] text-slate-500">{md.label}</span>}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all duration-500 ${isOn ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                        {isOn ? '🟢 ON (TỰ BẬT)' : 'OFF (MẶC ĐỊNH)'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* Auto-action log */}
              {showLog && autoLog.length > 0 && (
                <div className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
                  <div className="text-[9px] text-slate-400 font-bold mb-1">Nhật ký kích hoạt khi có sự cố:</div>
                  {autoLog.map((entry, i) => (
                    <div key={i} className="text-[9px] text-slate-300 flex items-start gap-1.5">
                      <span className="text-slate-500 font-mono shrink-0">{entry.time}</span>
                      <span>{entry.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ RULE MODAL ═══ */}
      <Modal isOpen={showRuleModal} title={editingRule ? '✏️ Chỉnh sửa Luật Cảnh báo' : '➕ Thêm Luật Cảnh báo mới'} onClose={() => setShowRuleModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên luật *</label>
            <input type="text" value={ruleForm.name || ''} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="Ví dụ: Đất khô - Tưới nước" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Thông số giám sát *</label>
            <select value={ruleForm.metric || 'soil_moisture'} onChange={e => { const m = METRICS.find(x => x.key === e.target.value); setRuleForm(p => ({ ...p, metric: e.target.value, unit: m?.unit || '' })); }} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]">
              {METRICS.map(m => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngưỡng MIN *</label>
              <input type="number" value={ruleForm.minThreshold ?? ''} onChange={e => setRuleForm(p => ({ ...p, minThreshold: parseFloat(e.target.value) }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngưỡng MAX *</label>
              <input type="number" value={ruleForm.maxThreshold ?? ''} onChange={e => setRuleForm(p => ({ ...p, maxThreshold: parseFloat(e.target.value) }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]" />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Khu vực áp dụng</label>
            <select value={ruleForm.zone || ZONES[0]} onChange={e => setRuleForm(p => ({ ...p, zone: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]">
              <option value="Tất cả">Tất cả khu vực</option>
              {ZONES.map(z => <option key={z}>{z}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mức độ nghiêm trọng</label>
              <select value={ruleForm.severity || 'WARNING'} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value as any }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]">
                <option value="WARNING">⚠️ WARNING</option>
                <option value="CRITICAL">🔴 CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trạng thái</label>
              <select value={ruleForm.enabled ? 'true' : 'false'} onChange={e => setRuleForm(p => ({ ...p, enabled: e.target.value === 'true' }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]">
                <option value="true">✅ Bật ngay</option>
                <option value="false">⏸ Tắt</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hành động tự động khi vi phạm</label>
            <select value={ruleForm.action || 'Bật máy bơm tưới'} onChange={e => setRuleForm(p => ({ ...p, action: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#062326]">
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
            <Button disabled={!ruleForm.name} onClick={saveRule} className="bg-[#062326] hover:bg-[#062326]/90 text-white">
              <Check size={14} className="mr-1" /> {editingRule ? 'Cập nhật' : 'Tạo Luật mới'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
