import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldAlert, CheckCircle2, Bot, Plus, Settings, Trash2, Edit3,
  Droplets, Thermometer, Wind, Sun, Zap, Activity, Cpu,
  X, ChevronDown, ChevronUp, Play, Pause, RefreshCw, Power, Info, Sparkles, AlertOctagon, HelpCircle
} from 'lucide-react';
import { Button, StatusBadge, Modal } from '../ui/BaseUI';
import { mockAlerts, mockZones, mockFarms } from '../../mocks/mockData';
import { Alert, AlertRule as DomainAlertRule } from '../../types';

export interface ZoneAlertCenterProps {
  zoneId?: string;
  farmId?: string;
  fieldId?: string;
  scopeLevel?: 'ZONE' | 'FIELD' | 'FARM' | 'GLOBAL' | 'FARMER';
  onNavigateToControl?: () => void;
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  unit: string;
  minThreshold: number;
  maxThreshold: number;
  zone: string;
  zoneId: string;
  severity: 'WARNING' | 'CRITICAL';
  action: string;
  enabled: boolean;
}

interface LiveAlert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: string;
  zone: string;
  zoneId: string;
  severity: 'WARNING' | 'CRITICAL';
  action: string;
  time: string;
  acked: boolean;
}

const METRICS = [
  { key: 'soil_moisture', label: 'Độ ẩm đất', unit: '%', icon: Droplets, color: 'sky', baseVal: 65, min: 0, max: 100 },
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', icon: Thermometer, color: 'orange', baseVal: 27, min: -10, max: 60 },
  { key: 'humidity', label: 'Độ ẩm KK', unit: '%', icon: Wind, color: 'teal', baseVal: 72, min: 0, max: 100 },
  { key: 'light', label: 'Ánh sáng', unit: 'lux', icon: Sun, color: 'yellow', baseVal: 18000, min: 0, max: 100000 },
  { key: 'battery', label: 'Pin Node', unit: '%', icon: Zap, color: 'emerald', baseVal: 78, min: 0, max: 100 },
  { key: 'co2', label: 'CO₂', unit: 'ppm', icon: Cpu, color: 'violet', baseVal: 420, min: 300, max: 5000 },
];

const ICON_COLOR: Record<string, string> = {
  sky: 'text-sky-600 bg-sky-100 border-sky-200',
  orange: 'text-orange-600 bg-orange-100 border-orange-200',
  teal: 'text-teal-600 bg-teal-100 border-teal-200',
  yellow: 'text-yellow-600 bg-yellow-100 border-yellow-200',
  emerald: 'text-emerald-600 bg-emerald-100 border-emerald-200',
  violet: 'text-violet-600 bg-violet-100 border-violet-200',
};

const DEFAULT_ZONE_RULES: AlertRule[] = [
  { id: 'r1', name: 'Đất khô – Tự động bật máy bơm tưới', metric: 'soil_moisture', unit: '%', minThreshold: 45, maxThreshold: 90, zone: 'Nhà màng 01 - Cà chua A', zoneId: 'zone-01', severity: 'WARNING', action: 'Bật máy bơm tưới nhỏ giọt', enabled: true },
  { id: 'r2', name: 'Nhiệt độ quá cao – Bật quạt thông gió', metric: 'temperature', unit: '°C', minThreshold: 15, maxThreshold: 34, zone: 'Nhà màng 01 - Cà chua A', zoneId: 'zone-01', severity: 'CRITICAL', action: 'Bật quạt đối lưu & Phun sương', enabled: true },
  { id: 'r3', name: 'Độ ẩm không khí thấp – Phun sương', metric: 'humidity', unit: '%', minThreshold: 55, maxThreshold: 95, zone: 'Nhà màng 02 - Dưa lưới B', zoneId: 'zone-02', severity: 'WARNING', action: 'Bật phun sương vi khí hậu', enabled: true },
  { id: 'r4', name: 'Nhiệt độ nhà màng Ớt quá cao', metric: 'temperature', unit: '°C', minThreshold: 18, maxThreshold: 33, zone: 'Nhà màng 03 - Ớt C', zoneId: 'zone-03', severity: 'CRITICAL', action: 'Bật quạt thông gió & cắt nắng', enabled: true },
  { id: 'r5', name: 'Pin Node LoRa yếu', metric: 'battery', unit: '%', minThreshold: 20, maxThreshold: 100, zone: 'Tất cả các Zone', zoneId: 'all', severity: 'CRITICAL', action: 'Gửi thông báo Kỹ thuật viên thay Pin', enabled: true },
];

function fmtVal(val: number, key: string) {
  if (key === 'light') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
  return key === 'co2' ? val.toFixed(0) : val.toFixed(1);
}

export const ZoneAlertCenter: React.FC<ZoneAlertCenterProps> = ({
  zoneId,
  farmId,
  fieldId,
  scopeLevel = 'ZONE',
  onNavigateToControl
}) => {
  const targetZone = mockZones.find(z => z.zoneId === zoneId) || (zoneId ? { zoneId, name: `Zone ${zoneId}`, currentCrop: 'Cà chua' } : null);

  const [rules, setRules] = useState<AlertRule[]>(() => {
    if (zoneId) {
      return DEFAULT_ZONE_RULES.filter(r => r.zoneId === zoneId || r.zoneId === 'all');
    }
    return DEFAULT_ZONE_RULES;
  });

  const [historicAlerts, setHistoricAlerts] = useState<Alert[]>(() => {
    if (zoneId) {
      return mockAlerts.filter(a => a.zoneId === zoneId);
    }
    return mockAlerts;
  });

  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, { action: string; since: string }>>({});
  const [sensorValues, setSensorValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(METRICS.map(m => [m.key, m.baseVal]))
  );
  
  const [simRunning, setSimRunning] = useState(true);
  const [simExpanded, setSimExpanded] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<AlertRule>>({});
  
  // AI assistant popup modal state
  const [aiAdviceModalAlert, setAiAdviceModalAlert] = useState<Alert | LiveAlert | null>(null);

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
          ? `Thấp hơn ngưỡng an toàn MIN (${rule.minThreshold}${rule.unit})`
          : `Cao hơn ngưỡng an toàn MAX (${rule.maxThreshold}${rule.unit})`;

        newAlerts.push({
          id: `live-${rule.id}-${tickRef.current}`,
          ruleId: rule.id,
          metric: rule.metric,
          value: val,
          threshold,
          zone: rule.zone,
          zoneId: rule.zoneId,
          severity: rule.severity,
          action: rule.action,
          time: new Date().toLocaleTimeString('vi-VN'),
          acked: false,
        });

        newActions[rule.id] = {
          action: rule.action,
          since: new Date().toLocaleTimeString('vi-VN'),
          severity: rule.severity,
        };
      }
    });

    setLiveAlerts(newAlerts);
    setActiveActions(newActions);
  }, []);

  useEffect(() => {
    checkRules(sensorValues);
  }, []);

  useEffect(() => {
    if (!simRunning) return;
    const t = setInterval(() => {
      tickRef.current += 1;
      setSensorValues(prev => {
        const next: Record<string, number> = {};
        METRICS.forEach(m => {
          // slight drift simulation
          const drift = prev[m.key] * (1 + (Math.random() * 0.002 - 0.001));
          next[m.key] = parseFloat(Math.min(m.max, Math.max(m.min, drift)).toFixed(2));
        });
        checkRules(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [simRunning, checkRules]);

  const openNewRule = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      metric: 'soil_moisture',
      unit: '%',
      minThreshold: 40,
      maxThreshold: 90,
      zone: targetZone?.name || 'Zone Hiện tại',
      zoneId: zoneId || 'zone-01',
      severity: 'WARNING',
      action: 'Bật máy bơm tưới',
      enabled: true,
    });
    setShowRuleModal(true);
  };

  const openEditRule = (r: AlertRule) => {
    setEditingRule(r);
    setRuleForm({ ...r });
    setShowRuleModal(true);
  };

  const saveRule = () => {
    if (!ruleForm.name) return;
    const m = METRICS.find(x => x.key === ruleForm.metric);
    const rule: AlertRule = {
      id: editingRule?.id || `r-${Date.now()}`,
      name: ruleForm.name!,
      metric: ruleForm.metric!,
      unit: m?.unit || ruleForm.unit || '',
      minThreshold: Number(ruleForm.minThreshold ?? 0),
      maxThreshold: Number(ruleForm.maxThreshold ?? 100),
      zone: ruleForm.zone || targetZone?.name || 'Zone Hiện tại',
      zoneId: ruleForm.zoneId || zoneId || 'zone-01',
      severity: (ruleForm.severity as any) || 'WARNING',
      action: ruleForm.action || '',
      enabled: ruleForm.enabled ?? true,
    };

    setRules(prev => editingRule ? prev.map(r => r.id === editingRule.id ? rule : r) : [...prev, rule]);
    setShowRuleModal(false);
  };

  const activeLiveCount = liveAlerts.filter(a => !a.acked).length;
  const activeHistoricCount = historicAlerts.filter(a => a.status === 'OPEN').length;
  const totalOpenAlerts = activeLiveCount + activeHistoricCount;

  return (
    <div className="space-y-6">
      {/* Top Banner Alert Center Summary */}
      <div className="p-5 bg-gradient-to-r from-[#062326] via-slate-900 to-[#0b383d] rounded-2xl text-white shadow-lg border border-emerald-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono tracking-wide flex items-center gap-1">
              <ShieldAlert size={12} /> TRUNG TÂM CẢNH BÁO NÔNG NGHIỆP
            </span>
            {targetZone && (
              <span className="text-xs text-emerald-400 font-semibold font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                {targetZone.name} {targetZone.currentCrop ? `(${targetZone.currentCrop})` : ''}
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Hệ thống Cảnh báo & Quy tắc Tự động Vi khí hậu
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Giám sát thời gian thực các vi phạm ngưỡng vi khí hậu (Độ ẩm đất, Nhiệt độ, Độ ẩm KK, Ánh sáng, CO₂, Pin node) và kích hoạt rơ-le tự động bảo vệ cây trồng.
          </p>
        </div>

        {/* Counter & Action */}
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border text-center font-mono ${totalOpenAlerts > 0 ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'}`}>
            <span className="text-xl font-extrabold block leading-none">{totalOpenAlerts}</span>
            <span className="text-[10px] text-slate-300 font-sans">{totalOpenAlerts > 0 ? 'Cảnh báo Đang mở' : 'An toàn 100%'}</span>
          </div>

          <Button onClick={openNewRule} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
            <Plus size={14} className="mr-1" /> Thêm Luật Cảnh báo Zone
          </Button>
        </div>
      </div>

      {/* Sensor Live Gauge Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {METRICS.map(m => {
          const val = sensorValues[m.key];
          const Icon = m.icon;
          const violatingRule = rules.find(r => r.enabled && r.metric === m.key && (val < r.minThreshold || val > r.maxThreshold));

          return (
            <div
              key={m.key}
              className={`p-3 rounded-xl border transition-all ${
                violatingRule 
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 animate-pulse' 
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">{m.label}</span>
                <Icon size={14} className={violatingRule ? 'text-rose-600' : 'text-slate-600'} />
              </div>

              <div className="flex items-baseline justify-between">
                <span className={`text-base font-extrabold font-mono ${violatingRule ? 'text-rose-700' : 'text-slate-900'}`}>
                  {fmtVal(val, m.key)}
                  <span className="text-xs font-normal text-slate-500 ml-0.5">{m.unit}</span>
                </span>
              </div>

              {violatingRule ? (
                <span className="mt-1 block text-[10px] text-rose-700 font-bold truncate">
                  ⚠️ Vượt ngưỡng {violatingRule.minThreshold}-{violatingRule.maxThreshold}{m.unit}
                </span>
              ) : (
                <span className="mt-1 block text-[10px] text-emerald-600 font-medium">
                  ✓ Chuẩn an toàn
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Real-time Alerts Section */}
      {liveAlerts.filter(a => !a.acked).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <Activity size={16} className="animate-pulse" /> Cảnh báo Vi phạm Real-time ({liveAlerts.filter(a => !a.acked).length})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Tự động quét từ cảm biến LoRa mỗi 5s</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {liveAlerts.filter(a => !a.acked).map(a => {
              const md = METRICS.find(m => m.key === a.metric);
              const Icon = md?.icon || Activity;

              return (
                <div
                  key={a.id}
                  className={`p-4 rounded-2xl border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-all ${
                    a.severity === 'CRITICAL' 
                      ? 'bg-rose-50/80 border-l-rose-600 border-rose-200' 
                      : 'bg-amber-50/80 border-l-amber-500 border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${a.severity === 'CRITICAL' ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-amber-100 border-amber-200 text-amber-600'}`}>
                      <Icon size={20} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${a.severity === 'CRITICAL' ? 'bg-rose-200/80 text-rose-800' : 'bg-amber-200/80 text-amber-900'}`}>
                          {a.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{md?.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({a.time})</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                          {a.zone}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 font-medium">
                        Giá trị thực đo: <strong className={a.severity === 'CRITICAL' ? 'text-rose-700' : 'text-amber-800'}>{fmtVal(a.value, a.metric)} {md?.unit}</strong> — {a.threshold}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg px-2.5 py-1 font-semibold w-fit">
                        <Power size={12} className="text-emerald-700" />
                        Tự động thực thi: {a.action}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAiAdviceModalAlert(a)}
                      className="bg-white hover:bg-slate-100 text-slate-800 text-xs"
                    >
                      <Bot size={14} className="mr-1 text-emerald-600" /> AI Tư vấn
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setLiveAlerts(prev => prev.map(x => x.id === a.id ? { ...x, acked: true } : x))}
                      className="bg-slate-800 hover:bg-slate-900 text-white text-xs"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rules Management Engine */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#062326] text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Settings size={16} className="text-emerald-400" /> Cấu hình Quy tắc Cảnh báo An toàn Zone ({rules.length} luật)
          </div>
          <Button onClick={openNewRule} size="sm" className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs">
            <Plus size={13} className="mr-1" /> Thêm quy tắc mới
          </Button>
        </div>

        <div className="divide-y divide-slate-100">
          {rules.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs italic">
              Chưa có luật cảnh báo nào được cấu hình cho Zone này. Cực kỳ khuyến nghị khởi tạo luật kiểm soát độ ẩm & nhiệt độ!
            </div>
          ) : (
            rules.map(rule => {
              const md = METRICS.find(m => m.key === rule.metric);
              const Icon = md?.icon || Activity;
              const isViolating = !!activeActions[rule.id];
              const currentVal = sensorValues[rule.metric];

              return (
                <div
                  key={rule.id}
                  className={`px-5 py-3.5 flex items-center gap-4 text-xs transition-all ${
                    !rule.enabled ? 'opacity-50 bg-slate-50/50' : isViolating ? 'bg-rose-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Toggle Switch */}
                  <button
                    onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                    className={`w-9 h-5 rounded-full transition-all shrink-0 relative ${rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                    title={rule.enabled ? 'Đang bật' : 'Đang tắt'}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>

                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${ICON_COLOR[md?.color || 'sky']}`}>
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{rule.name}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono ${rule.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                        {rule.severity}
                      </span>
                      {isViolating && (
                        <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded animate-pulse">
                          ⚡ ĐANG VI PHẠM
                        </span>
                      )}
                    </div>

                    <div className="text-slate-600 mt-1 flex items-center gap-3 flex-wrap text-[11px]">
                      <span>Tham số: <strong className="text-slate-800">{md?.label}</strong></span>
                      <span>Dải an toàn: <strong className="text-emerald-800 font-mono">[{rule.minThreshold} – {rule.maxThreshold}] {rule.unit}</strong></span>
                      {currentVal !== undefined && (
                        <span>
                          Thực tế: <strong className={`font-mono ${currentVal < rule.minThreshold || currentVal > rule.maxThreshold ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {fmtVal(currentVal, rule.metric)} {rule.unit}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg px-2.5 py-1 font-medium shrink-0 max-w-[220px] truncate">
                    <Power size={12} className="text-emerald-600 shrink-0" />
                    <span>{rule.action}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditRule(rule)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                      title="Sửa luật"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                      title="Xóa luật"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Historic Zone Alert Logs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-slate-600" /> Nhật ký Lịch sử Sự cố & Cảnh báo ({historicAlerts.length})
          </h3>
          <span className="text-xs text-slate-500">Lưu vết tự động theo thời gian thực</span>
        </div>

        <div className="space-y-2.5">
          {historicAlerts.map(a => (
            <div key={a.alertId} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 font-mono">#{a.alertId}</span>
                  <StatusBadge status={a.status} />
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(a.triggeredAt).toLocaleString('vi-VN')}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                <p className="text-xs text-slate-600">{a.message}</p>

                <div className="text-[11px] text-slate-500 pt-0.5 font-mono">
                  Khu vực: <strong className="text-slate-800">{a.zoneName || targetZone?.name}</strong> | Giá trị vi phạm: <strong className="text-rose-600">{a.triggeredValue}</strong> (Ngưỡng mục tiêu: {a.targetRange})
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setAiAdviceModalAlert(a)}>
                  <Bot size={14} className="mr-1 text-emerald-600" /> Chẩn đoán AI
                </Button>

                {a.status === 'OPEN' && (
                  <Button
                    size="sm"
                    onClick={() => setHistoricAlerts(prev => prev.map(x => x.alertId === a.alertId ? { ...x, status: 'ACKNOWLEDGED' } : x))}
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Sensor Simulator Switch */}
      <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className={`w-2 h-2 rounded-full ${simRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <Cpu size={14} className="text-emerald-400" />
          <span>Mô phỏng IoT Live Feed: {simRunning ? 'ĐANG CHẠY (5s/tick)' : 'TẠM DỪNG'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={() => setSimRunning(!simRunning)}>
            {simRunning ? <Pause size={13} className="mr-1 text-amber-400" /> : <Play size={13} className="mr-1 text-emerald-400" />}
            {simRunning ? 'Tạm dừng' : 'Kích hoạt'}
          </Button>

          <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={() => {
            const resetVals = Object.fromEntries(METRICS.map(m => [m.key, m.baseVal]));
            setSensorValues(resetVals);
            checkRules(resetVals);
          }}>
            <RefreshCw size={13} className="mr-1 text-slate-300" /> Reset Cảm biến
          </Button>
        </div>
      </div>

      {/* MODAL: Rule Config Editor */}
      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? 'Chỉnh sửa Quy tắc Cảnh báo Zone' : 'Thêm Quy tắc Cảnh báo Vi khí hậu Mới'}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1">Tên Quy tắc Cảnh báo *</label>
            <input
              type="text"
              value={ruleForm.name || ''}
              onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
              placeholder="Ví dụ: Đất quá khô – Bật máy bơm nhỏ giọt"
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#062326] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Tham số Cảm biến *</label>
              <select
                value={ruleForm.metric || 'soil_moisture'}
                onChange={e => {
                  const m = METRICS.find(x => x.key === e.target.value);
                  setRuleForm({ ...ruleForm, metric: e.target.value, unit: m?.unit || '%' });
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#062326] focus:outline-none"
              >
                {METRICS.map(m => (
                  <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Mức độ Nghiêm trọng *</label>
              <select
                value={ruleForm.severity || 'WARNING'}
                onChange={e => setRuleForm({ ...ruleForm, severity: e.target.value as any })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#062326] focus:outline-none"
              >
                <option value="WARNING">Cảnh báo (WARNING)</option>
                <option value="CRITICAL">Nguy hiểm khẩn cấp (CRITICAL)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Ngưỡng MIN (Dưới ngưỡng sẽ kích hoạt)</label>
              <input
                type="number"
                value={ruleForm.minThreshold ?? 40}
                onChange={e => setRuleForm({ ...ruleForm, minThreshold: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Ngưỡng MAX (Vượt ngưỡng sẽ kích hoạt)</label>
              <input
                type="number"
                value={ruleForm.maxThreshold ?? 90}
                onChange={e => setRuleForm({ ...ruleForm, maxThreshold: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Hành động Tự động khi Vi phạm *</label>
            <input
              type="text"
              value={ruleForm.action || ''}
              onChange={e => setRuleForm({ ...ruleForm, action: e.target.value })}
              placeholder="Ví dụ: Bật máy bơm tưới / Bật quạt thông gió 15 phút"
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setShowRuleModal(false)}>Hủy</Button>
            <Button onClick={saveRule}>Lưu Quy tắc Cảnh báo</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: AI Agronomist Advisory */}
      <Modal
        isOpen={!!aiAdviceModalAlert}
        onClose={() => setAiAdviceModalAlert(null)}
        title="🤖 AI Expert Advice: Chẩn đoán & Giải pháp Nông nghiệp"
      >
        {aiAdviceModalAlert && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
              <span className="font-bold flex items-center gap-1.5 text-sm">
                <Sparkles size={16} className="text-emerald-600" /> Phân tích Sự cố từ AI Chuyên gia Nông nghiệp
              </span>
              <p className="text-slate-700">
                Dựa trên loại cây trồng <strong>{targetZone?.currentCrop || 'Cà chua'}</strong> tại Zone <strong>{aiAdviceModalAlert.zoneId || targetZone?.name}</strong>:
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="font-bold text-slate-900 text-xs">
                Sự cố ghi nhận: {('title' in aiAdviceModalAlert) ? aiAdviceModalAlert.title : `Vi phạm ${aiAdviceModalAlert.metric}`}
              </div>
              <p className="text-slate-600">
                {('message' in aiAdviceModalAlert) ? aiAdviceModalAlert.message : aiAdviceModalAlert.threshold}
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" /> Khuyến nghị Hành động Khắc phục (Standard Operating Procedure):
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-700 leading-relaxed pl-1">
                <li>Kích hoạt rơ-le <strong>Bật máy bơm tưới nhỏ giọt / Quạt đối lưu</strong> trong thời lượng 10-15 phút.</li>
                <li>Kiểm tra đường ống cấp nước và điện áp nguồn LoRa Gateway khu vực nhà màng.</li>
                <li>Điều chỉnh lại dải ngưỡng an toàn vi khí hậu nếu vụ trồng bước sang giai đoạn thu hoạch.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {onNavigateToControl && (
                <Button variant="outline" onClick={() => { setAiAdviceModalAlert(null); onNavigateToControl(); }}>
                  Chuyển tới Rơ-le Điều khiển
                </Button>
              )}
              <Button onClick={() => setAiAdviceModalAlert(null)}>Đã hiểu & Đóng</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
