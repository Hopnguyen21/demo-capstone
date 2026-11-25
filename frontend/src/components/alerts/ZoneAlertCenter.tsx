import { NO_CROP_LABEL, zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert, CheckCircle2, Bot, Plus, Settings, Trash2, Edit3,
  Droplets, Thermometer, Wind, Sun, Zap, Activity, Cpu,
  X, ChevronDown, ChevronUp, Play, Pause, RefreshCw, Power, Info, Sparkles, AlertOctagon, HelpCircle
} from 'lucide-react';
import { Button, StatusBadge, Modal } from '../ui/BaseUI';
import { alertService, controlService, deviceService, telemetryService, seasonService } from '../../services';
import { useAuth } from '@/app/providers/AuthContext';
import { Alert, AlertRule as DomainAlertRule } from '../../types';

export interface ZoneAlertCenterProps {
  zoneId?: string;
  farmId?: string;
  fieldId?: string;
  scopeLevel?: 'ZONE' | 'FIELD' | 'FARM' | 'GLOBAL' | 'FARMER';
  nodes?: any[];
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
  actuatorId?: string;
  actionMode?: 'TurnOn' | 'TurnOff';
  durationSeconds?: number;
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

export const METRICS = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', icon: Thermometer, color: 'orange', baseVal: 27, min: -10, max: 60 },
  { key: 'humidity', label: 'Độ ẩm KK', unit: '%', icon: Wind, color: 'teal', baseVal: 72, min: 0, max: 100 },
  { key: 'soil_moisture', label: 'Độ ẩm đất', unit: '%', icon: Droplets, color: 'sky', baseVal: 65, min: 0, max: 100 },
  { key: 'light', label: 'Ánh sáng', unit: 'lux', icon: Sun, color: 'yellow', baseVal: 18000, min: 0, max: 100000 },
  { key: 'co2', label: 'CO₂', unit: 'ppm', icon: Cpu, color: 'violet', baseVal: 420, min: 300, max: 5000 },
  { key: 'battery', label: 'Pin Node', unit: '%', icon: Zap, color: 'emerald', baseVal: 78, min: 0, max: 100 },
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
  nodes: passedNodes,
  onNavigateToControl
}) => {
  const { zones: authZones } = useAuth();
  const targetZone = authZones.find(z => z.zoneId === zoneId) || (zoneId ? { zoneId, name: `Zone ${zoneId}`, currentCrop: undefined } : null);

  // Hardware-adaptive node tracking:
  const [internalNodes, setInternalNodes] = useState<any[]>(passedNodes || []);

  useEffect(() => {
    if (passedNodes && passedNodes.length > 0) {
      const scoped = zoneId
        ? passedNodes.filter((node: any) => node.zoneId === zoneId || node.ZoneId === zoneId)
        : passedNodes;
      setInternalNodes(scoped);
      return;
    }
    deviceService.getNodes(zoneId).then(data => {
      if (Array.isArray(data)) {
        if (zoneId) {
          const matched = data.filter((d: any) => d.zoneId === zoneId || (d as any).id === zoneId);
          // Never fall back to nodes from another Zone. An empty match means
          // this Zone has no identifiable node configuration yet.
          setInternalNodes(matched);
        } else {
          setInternalNodes(data);
        }
      }
    }).catch(() => { });
  }, [zoneId, passedNodes]);

  // Cards are driven only by measurements actually returned by telemetry.
  const [telemetryMetricKeys, setTelemetryMetricKeys] = useState<Set<string>>(new Set());
  const activeMetrics = React.useMemo(
    () => METRICS.filter(metric => telemetryMetricKeys.has(metric.key)),
    [telemetryMetricKeys]
  );

  const activeMetricKeys = React.useMemo(() => new Set(activeMetrics.map(m => m.key)), [activeMetrics]);

  const [rules, setRules] = useState<AlertRule[]>([]);

  const metricToParameter: Record<string, string> = {
    temperature: 'Temperature',
    soil_moisture: 'SoilMoisture',
    humidity: 'AirHumidity',
    light: 'LightIntensity',
  };

  const parameterToMetric: Record<string, string> = {
    Temperature: 'temperature',
    SoilMoisture: 'soil_moisture',
    AirHumidity: 'humidity',
    LightIntensity: 'light',
  };

  // Rules in this panel must come from the backend; the old implementation
  // only changed React state, so nothing was persisted or evaluated by IoT.
  useEffect(() => {
    if (!zoneId) return;
    alertService.getAlertRules(zoneId).then((items: any[]) => {
      if (!Array.isArray(items)) return;
      setRules(items.map(item => {
        const metric = parameterToMetric[item.parameterCode] || item.parameterCode;
        const md = METRICS.find(x => x.key === metric);
        return {
          id: item.ruleId,
          name: `${md?.label || metric} - Cảnh báo ngưỡng`,
          metric,
          unit: md?.unit || '',
          minThreshold: Number(item.minThreshold),
          maxThreshold: Number(item.maxThreshold),
          zone: targetZone?.name || 'Zone hiện tại',
          zoneId,
          severity: item.severity === 'Critical' ? 'CRITICAL' : 'WARNING',
          action: 'Gửi cảnh báo an toàn Zone',
          enabled: item.isActive !== false,
        };
      }));
    }).catch(err => {
      console.error('Không tải được luật cảnh báo Zone:', err);
      setRules([]);
    });
  }, [zoneId, targetZone?.name]);

  const displayRules = React.useMemo(() => {
    return rules.filter(r => activeMetricKeys.has(r.metric));
  }, [rules, activeMetricKeys]);

  const [historicAlerts, setHistoricAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!zoneId) { setHistoricAlerts([]); return; }
    alertService.getZoneAlerts(zoneId)
      .then(data => setHistoricAlerts(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Không tải được cảnh báo của Zone:', err); setHistoricAlerts([]); });
  }, [zoneId]);

  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, { action: string; since: string }>>({});
  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});

  const [simRunning, setSimRunning] = useState(true);
  const [simExpanded, setSimExpanded] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [liveExpanded, setLiveExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const previousLiveCountRef = useRef(0);
  const previousHistoryCountRef = useRef(0);

  useEffect(() => {
    const count = liveAlerts.filter(a => !a.acked).length;
    if (count > previousLiveCountRef.current) setLiveExpanded(true);
    previousLiveCountRef.current = count;
  }, [liveAlerts]);

  useEffect(() => {
    if (historicAlerts.length > previousHistoryCountRef.current) setHistoryExpanded(true);
    previousHistoryCountRef.current = historicAlerts.length;
  }, [historicAlerts]);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<AlertRule>>({});
  const [ruleSaveError, setRuleSaveError] = useState<string | null>(null);
  const [zoneActuators, setZoneActuators] = useState<any[]>([]);

  useEffect(() => {
    if (!zoneId) return;
    controlService.getActuators(zoneId).then(setZoneActuators).catch(() => setZoneActuators([]));
  }, [zoneId]);

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

    rulesRef.current.filter(r => r.enabled && activeMetricKeys.has(r.metric)).forEach(rule => {
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
  }, [activeMetricKeys]);

  // Read the same latest telemetry used by the rest of the farm UI. Never
  // synthesize values here: missing/stale telemetry must remain missing/stale.
  useEffect(() => {
    if (!zoneId || !simRunning) return;
    let cancelled = false;
    const loadTelemetry = async () => {
      try {
        const latest = await telemetryService.getRealtime(zoneId);
        if (cancelled) return;
        const next: Record<string, number> = {};
        (latest.metrics || []).forEach((metric: any) => {
          const code = String(metric.parameterCode || '').toLowerCase();
          const key = code === 'temperature' ? 'temperature' : code === 'airhumidity' ? 'humidity' : code === 'soilmoisture' ? 'soil_moisture' : code === 'lightintensity' ? 'light' : null;
          if (key && Number.isFinite(Number(metric.value)) && metric.isFresh !== false) next[key] = Number(metric.value);
        });
        setTelemetryMetricKeys(new Set(Object.keys(next)));
        setSensorValues(next);
        const alerts = await alertService.getZoneAlerts(zoneId);
        // Đồng bộ cả nhật ký lịch sử với cùng nguồn dữ liệu thật; trước đây
        // lịch sử chỉ tải một lần khi mở popup nên cảnh báo mới không xuất hiện.
        setHistoricAlerts(Array.isArray(alerts) ? alerts : []);
        const openAlerts = (Array.isArray(alerts) ? alerts : []).filter((a: any) => String(a.status).toUpperCase() === 'OPEN');
        setLiveAlerts(openAlerts.map((a: any) => ({
          id: String(a.alertId),
          ruleId: String(a.alertId),
          metric: metricToParameter[a.parameterCode] ? a.parameterCode : (parameterToMetric[a.parameterCode] || String(a.parameterCode).toLowerCase()),
          value: Number(a.triggeredValue),
          threshold: `Ngoài ngưỡng an toàn [${a.minThreshold} - ${a.maxThreshold}${a.unit || ''}]`,
          zone: a.zoneName || targetZone?.name || 'Zone hiện tại',
          zoneId,
          severity: a.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          action: 'Đã ghi nhận trong hệ thống cảnh báo',
          time: new Date(a.triggeredAt).toLocaleTimeString('vi-VN'),
          acked: false,
        })));
      } catch (err) {
        if (!cancelled) console.error('Không tải được telemetry thật cho cảnh báo:', err);
      }
    };
    void loadTelemetry();
    const timer = window.setInterval(loadTelemetry, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [zoneId, simRunning]);

  const openNewRule = () => {
    const firstMetric = activeMetrics[0] || METRICS[0];
    setEditingRule(null);
    setRuleSaveError(null);
    setRuleForm({
      name: '',
      metric: firstMetric.key,
      unit: firstMetric.unit,
      minThreshold: firstMetric.min || 20,
      maxThreshold: firstMetric.max || 80,
      zone: targetZone?.name || 'Zone Hiện tại',
      zoneId: zoneId || 'zone-01',
      severity: 'WARNING',
      action: firstMetric.key === 'temperature' ? 'Bật quạt đối lưu & Phun sương' : firstMetric.key === 'humidity' ? 'Bật phun sương vi khí hậu' : 'Bật máy bơm tưới',
      actuatorId: zoneActuators[0]?.actuatorId,
      actionMode: 'TurnOn',
      durationSeconds: 60,
      enabled: true,
    });
    setShowRuleModal(true);
  };

  const openEditRule = (r: AlertRule) => {
    setEditingRule(r);
    setRuleSaveError(null);
    setRuleForm({ ...r });
    setShowRuleModal(true);
  };

  const saveRule = async () => {
    if (!ruleForm.name?.trim()) {
      setRuleSaveError('Vui lòng nhập Tên Quy tắc Cảnh báo.');
      return;
    }
    const m = activeMetrics.find(x => x.key === ruleForm.metric) || METRICS.find(x => x.key === ruleForm.metric);
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
      actuatorId: ruleForm.actuatorId,
      actionMode: ruleForm.actionMode || 'TurnOn',
      durationSeconds: Number(ruleForm.durationSeconds || 60),
    };

    try {
      if (!zoneId) throw new Error('Zone chưa được xác định.');
      // The alert-rule API is intentionally tied to the active Growth Stage.
      // Check it here so the modal reports the real prerequisite instead of
      // showing ASP.NET's generic validation title.
      const seasons = await seasonService.getSeasons(zoneId);
      const activeSeason = (seasons || []).find((s: any) => s.status === 'ACTIVE' || s.status === 'InProgress');
      if (!activeSeason) throw new Error('Zone chưa có vụ mùa đang canh tác. Hãy bắt đầu vụ mùa trước khi tạo quy tắc.');
      const payload = {
        parameterCode: metricToParameter[rule.metric] || 'Temperature',
        minThreshold: rule.minThreshold,
        maxThreshold: rule.maxThreshold,
        severity: rule.severity === 'CRITICAL' ? 'Critical' : 'Warning',
        cooldownMinutes: 30,
        isActive: rule.enabled,
      };
      if (editingRule && /^[0-9a-f-]{36}$/i.test(editingRule.id)) {
        await alertService.updateAlertRule(zoneId, editingRule.id, payload);
      } else {
        await alertService.createAlertRule(zoneId, payload);
      }
      // The alert rule stores the threshold; the existing control-rule engine
      // performs the real relay/LoRa action. Link both threshold directions to
      // the first actuator in this Zone so the action field is operational.
      // An alert threshold is valid even when the Zone has no relay. If a
      // relay exists, additionally create the optional automation rule; a
      // failure here must not roll back the persisted alert rule.
      try {
        const actuators = await controlService.getActuators(zoneId);
        const actuator = (actuators || []).find((item: any) => item.actuatorId === rule.actuatorId) || (actuators || []).find((item: any) => Number(item.relayChannel ?? 1) === 1) || actuators?.[0];
        if (actuator && !editingRule) {
        const parameterCode = metricToParameter[rule.metric] || 'Temperature';
        const base = {
          parameterCode,
          conditionDurationMinutes: 1,
          actuatorId: actuator.actuatorId,
          action: rule.actionMode || 'TurnOn',
          durationSeconds: Math.max(1, Math.min(1800, Number(rule.durationSeconds || 60))),
          priority: rule.severity === 'CRITICAL' ? 1 : 2,
          cooldownMinutes: 30,
          enableRainDelay: true,
          rainThresholdPercent: 70,
          isActive: rule.enabled,
        };
          await controlService.createAutoRule(zoneId, {
          ...base,
          name: `${rule.name} (vượt MAX)`,
          operator: 'GreaterThan',
          threshold: rule.maxThreshold,
        });
          await controlService.createAutoRule(zoneId, {
          ...base,
          name: `${rule.name} (dưới MIN)`,
          operator: 'LessThan',
          threshold: rule.minThreshold,
          });
        }
      } catch (automationError) {
        console.warn('Không tạo được tự động hóa relay; vẫn giữ quy tắc cảnh báo:', automationError);
      }
      const refreshed = await alertService.getAlertRules(zoneId);
      setRules((refreshed || []).map((item: any) => {
        const metric = parameterToMetric[item.parameterCode] || item.parameterCode;
        const md = METRICS.find(x => x.key === metric);
        return { id: item.ruleId, name: `${md?.label || metric} - Cảnh báo ngưỡng`, metric, unit: md?.unit || '', minThreshold: Number(item.minThreshold), maxThreshold: Number(item.maxThreshold), zone: targetZone?.name || 'Zone hiện tại', zoneId, severity: item.severity === 'Critical' ? 'CRITICAL' : 'WARNING', action: 'Gửi cảnh báo an toàn Zone', enabled: item.isActive !== false };
      }));
      setShowRuleModal(false);
    } catch (err: any) {
      console.error('Không lưu được luật cảnh báo Zone:', err);
      const data = err?.response?.data;
      const validation = data?.errors
        ? Object.entries(data.errors)
            .flatMap(([field, messages]: [string, any]) => (Array.isArray(messages) ? messages : [messages]).map(message => `${field}: ${message}`))
            .join(' ')
        : '';
      const detail = validation || data?.detail || data?.title || data?.message || err?.message || 'Không thể lưu luật cảnh báo.';
      setRuleSaveError(String(detail));
    }
  };

  const activeLiveCount = liveAlerts.filter(a => !a.acked).length;
  const activeHistoricCount = historicAlerts.filter(a => a.status === 'OPEN').length;
  const totalOpenAlerts = activeLiveCount + activeHistoricCount;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Alert Center Summary */}
      <div className="p-5 bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] rounded-2xl text-white shadow-lg border border-emerald-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/20 text-white border border-white/30 font-mono tracking-wide flex items-center gap-1">
              <ShieldAlert size={12} /> TRUNG TÂM CẢNH BÁO NÔNG NGHIỆP
            </span>
            {targetZone && (
              <span className="text-xs text-white font-semibold font-mono bg-black/20 px-2 py-0.5 rounded border border-white/25">
                {targetZone.name} {targetZone.currentCrop ? `(${targetZone.currentCrop})` : ''}
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Hệ thống Cảnh báo & Quy tắc Tự động Vi khí hậu
          </h2>
          <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
            Giám sát thời gian thực các vi phạm ngưỡng vi khí hậu phù hợp với mô-đun phần cứng ({activeMetrics.map(m => m.label).join(', ')}) và kích hoạt rơ-le tự động bảo vệ cây trồng.
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

      {/* Sensor Live Gauge Chips matching active node sensors */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(6, Math.max(2, activeMetrics.length))} gap-3`}>
        {activeMetrics.map(m => {
          const val = sensorValues[m.key];
          const Icon = m.icon;
          const violatingRule = rules.find(r => r.enabled && r.metric === m.key && (val < r.minThreshold || val > r.maxThreshold));

          return (
                  <div
              key={m.key}
              className={`p-3 rounded-xl border transition-all ${violatingRule
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
                  {val === undefined ? '—' : fmtVal(val, m.key)}
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
        <div className="space-y-3 order-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <Activity size={16} className="animate-pulse" /> Cảnh báo Vi phạm Real-time ({liveAlerts.filter(a => !a.acked).length})
            </h3>
            <button type="button" onClick={() => setLiveExpanded(v => !v)} className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1">
              {liveExpanded ? 'Thu gọn' : 'Mở rộng'} {liveExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {liveExpanded && <div className="grid grid-cols-1 gap-3">
            {liveAlerts.filter(a => !a.acked).map(a => {
              const md = METRICS.find(m => m.key === a.metric);
              const Icon = md?.icon || Activity;

              return (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all ${a.severity === 'CRITICAL'
                    ? 'bg-rose-50/80 border-l-rose-600 border-rose-200'
                    : 'bg-amber-50/80 border-l-amber-500 border-amber-200'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${a.severity === 'CRITICAL' ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-amber-100 border-amber-200 text-amber-600'}`}>
                      <Icon size={16} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                      onClick={async () => {
                        try {
                          if (/^[0-9a-f-]{36}$/i.test(a.id)) {
                            await alertService.acknowledgeAlert(a.id, 'Đã xác nhận từ Trung tâm Cảnh báo Zone');
                          }
                          setLiveAlerts(prev => prev.map(x => x.id === a.id ? { ...x, acked: true } : x));
                          const refreshed = await alertService.getZoneAlerts(zoneId || '');
                          setHistoricAlerts(Array.isArray(refreshed) ? refreshed : []);
                        } catch (err) {
                          console.error('Không thể xác nhận cảnh báo:', err);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-900 text-white text-xs"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {/* Rules Management Engine */}
      <div className="order-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Settings size={16} className="text-white" /> Cấu hình Quy tắc Cảnh báo An toàn Zone ({displayRules.length} luật phù hợp)
          </div>
          <Button onClick={openNewRule} size="sm" className="bg-white/20 hover:bg-white/30 border border-white/30 text-white text-xs font-semibold">
            <Plus size={13} className="mr-1" /> Thêm quy tắc mới
          </Button>
        </div>

        <div className="divide-y divide-slate-100">
          {displayRules.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs italic">
              Chưa có luật cảnh báo nào được cấu hình cho các cảm biến đang hoạt động ({activeMetrics.map(m => m.label).join(', ')}). Bấm "Thêm quy tắc mới" để thiết lập ngưỡng an toàn!
            </div>
          ) : (
            displayRules.map(rule => {
              const md = METRICS.find(m => m.key === rule.metric);
              const Icon = md?.icon || Activity;
              const isViolating = !!activeActions[rule.id];
              const currentVal = sensorValues[rule.metric];

              return (
                <div
                  key={rule.id}
                  className={`px-5 py-3.5 flex items-center gap-4 text-xs transition-all ${!rule.enabled ? 'opacity-50 bg-slate-50/50' : isViolating ? 'bg-rose-50/60' : 'hover:bg-slate-50'
                    }`}
                >
                  {/* Toggle Switch */}
                  <button
                    onClick={async () => {
                      const enabled = !rule.enabled;
                      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled } : r));
                      if (zoneId && /^[0-9a-f-]{36}$/i.test(rule.id)) {
                        try {
                          await alertService.updateAlertRule(zoneId, rule.id, {
                            minThreshold: rule.minThreshold,
                            maxThreshold: rule.maxThreshold,
                            severity: rule.severity === 'CRITICAL' ? 'Critical' : 'Warning',
                            cooldownMinutes: 30,
                            isActive: enabled,
                          });
                        } catch (err) {
                          console.error('Không cập nhật được trạng thái luật cảnh báo:', err);
                        }
                      }
                    }}
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
                      onClick={async () => {
                        if (zoneId && /^[0-9a-f-]{36}$/i.test(rule.id)) {
                          try { await alertService.deleteAlertRule(zoneId, rule.id); } catch (err) { console.error('Không xóa được luật cảnh báo:', err); return; }
                        }
                        const refreshed = await alertService.getAlertRules(zoneId || '');
                        setRules((refreshed || []).map((item: any) => {
                          const metric = parameterToMetric[item.parameterCode] || item.parameterCode;
                          const md = METRICS.find(x => x.key === metric);
                          return { id: item.ruleId, name: `${md?.label || metric} - Cảnh báo ngưỡng`, metric, unit: md?.unit || '', minThreshold: Number(item.minThreshold), maxThreshold: Number(item.maxThreshold), zone: targetZone?.name || 'Zone hiện tại', zoneId: zoneId || '', severity: item.severity === 'Critical' ? 'CRITICAL' : 'WARNING', action: 'Gửi cảnh báo an toàn Zone', enabled: item.isActive !== false };
                        }));
                      }}
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
      <div className="order-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-slate-600" /> Nhật ký Lịch sử Sự cố & Cảnh báo ({historicAlerts.length})
          </h3>
          <button type="button" onClick={() => setHistoryExpanded(v => !v)} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
            {historyExpanded ? 'Thu gọn' : 'Xem nhật ký'} {historyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {historyExpanded && <div className="space-y-1.5">
          {historicAlerts.map(a => (
            <div key={a.alertId} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 font-mono">#{a.alertId}</span>
                  <StatusBadge status={a.status} />
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(a.triggeredAt).toLocaleString('vi-VN')}</span>
                </div>

                <h4 className="text-xs font-bold text-slate-900">{a.title}</h4>
                <p className="text-[11px] text-slate-600">{a.message}</p>

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
                    onClick={async () => {
                      try {
                        await alertService.acknowledgeAlert(a.alertId, 'Đã xác nhận từ Nhật ký Cảnh báo Zone');
                        setHistoricAlerts(prev => prev.map(x => x.alertId === a.alertId ? { ...x, status: 'ACKNOWLEDGED' } : x));
                        setLiveAlerts(prev => prev.filter(x => x.id !== a.alertId));
                      } catch (err) {
                        console.error('Không thể xác nhận cảnh báo:', err);
                      }
                    }}
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>}
      </div>

      {/* Floating Sensor Simulator Switch */}
      <div className="order-5 p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className={`w-2 h-2 rounded-full ${simRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <Cpu size={14} className="text-emerald-400" />
          <span>Telemetry Node thực: {simRunning ? 'ĐANG CẬP NHẬT (5s)' : 'TẠM DỪNG'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={() => setSimRunning(!simRunning)}>
            {simRunning ? <Pause size={13} className="mr-1 text-amber-400" /> : <Play size={13} className="mr-1 text-emerald-400" />}
            {simRunning ? 'Tạm dừng đọc' : 'Đọc telemetry'}
          </Button>

          <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700" onClick={() => {
            setSensorValues({});
            setLiveAlerts([]);
            setActiveActions({});
          }}>
            <RefreshCw size={13} className="mr-1 text-slate-300" /> Xóa số đo hiển thị
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
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#119653] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Tham số Cảm biến *</label>
              <select
                value={ruleForm.metric || activeMetrics[0]?.key || 'temperature'}
                onChange={e => {
                  const m = activeMetrics.find(x => x.key === e.target.value) || METRICS.find(x => x.key === e.target.value);
                  setRuleForm({ ...ruleForm, metric: e.target.value, unit: m?.unit || '%' });
                }}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#119653] focus:outline-none"
              >
                {activeMetrics.map(m => (
                  <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Mức độ Nghiêm trọng *</label>
              <select
                value={ruleForm.severity || 'WARNING'}
                onChange={e => setRuleForm({ ...ruleForm, severity: e.target.value as any })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900 focus:border-[#119653] focus:outline-none"
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
            <label className="block font-bold text-slate-800 mb-1">Thiết bị chấp hành khi vi phạm *</label>
            <select
              value={ruleForm.actuatorId || ''}
              onChange={e => setRuleForm({ ...ruleForm, actuatorId: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
            >
              <option value="">-- Chọn relay/actuator của Zone --</option>
              {zoneActuators.map((a: any) => <option key={a.actuatorId} value={a.actuatorId}>{a.name || a.actuatorCode || 'Actuator'} - Kênh {a.relayChannel ?? 1}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Lệnh</label>
              <select
                value={ruleForm.actionMode || 'TurnOn'}
                onChange={e => setRuleForm({ ...ruleForm, actionMode: e.target.value as 'TurnOn' | 'TurnOff' })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
              >
                <option value="TurnOn">Bật relay</option>
                <option value="TurnOff">Tắt relay</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Thời gian chạy (giây)</label>
              <input type="number" min={1} max={1800} value={ruleForm.durationSeconds ?? 60} onChange={e => setRuleForm({ ...ruleForm, durationSeconds: Number(e.target.value) })} className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Mô tả hành động</label>
            <input
              type="text"
              value={ruleForm.action || ''}
              onChange={e => setRuleForm({ ...ruleForm, action: e.target.value })}
              placeholder="Ví dụ: Bơm tưới luống phía Tây"
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            {ruleSaveError && <div className="mr-auto max-w-[55%] text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2">{ruleSaveError}</div>}
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
                Dựa trên loại cây trồng <strong>{targetZone?.currentCrop || NO_CROP_LABEL}</strong> tại Zone <strong>{aiAdviceModalAlert.zoneId || targetZone?.name}</strong>:
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
                <li>Kiểm tra đường ống cấp nước và điện áp nguồn LoRa Gateway khu vực đất trồng.</li>
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
