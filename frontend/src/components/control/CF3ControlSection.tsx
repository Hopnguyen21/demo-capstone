import React, { useState, useEffect } from 'react';
import { 
  Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw, 
  Activity, Radio, FileText, Cpu, AlertOctagon, Sparkles, Calendar, Clock
} from 'lucide-react';
import { Button, StatusBadge } from '../ui/BaseUI';
import { controlService } from '../../services';
import { CF3FlowVisualizer } from './CF3FlowVisualizer';
import { EnvironmentalParametersPanel } from './EnvironmentalParametersPanel';
import { ActuatorControlGrid } from './ActuatorControlGrid';
import { SafetyInterlockRulesCard } from './SafetyInterlockRulesCard';
import { ControlHistoryLogsTable } from './ControlHistoryLogsTable';
import { 
  Actuator, ControlExecutionLog, EnvironmentalTargetConfig, 
  ControlSchedule, AutomationRule, Zone, Field, Farm 
} from '../../types';
import { mockZones, mockFields, mockSchedules, mockAutomationRules, mockEmployees } from '../../mocks/mockData';

export interface CF3ControlSectionProps {
  scopeLevel: 'FARM' | 'FIELD' | 'ZONE' | 'GLOBAL' | 'FARMER';
  farmId?: string;
  fieldId?: string;
  zoneId?: string;
  title?: string;
  subtitle?: string;
  showVisualizerTab?: boolean;
}

export const CF3ControlSection: React.FC<CF3ControlSectionProps> = ({
  scopeLevel,
  farmId,
  fieldId,
  zoneId,
  title,
  subtitle,
  showVisualizerTab = true,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | 'VISUALIZER' | 'SAFETY' | 'LOGS'>('ACTUATORS');
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [configs, setConfigs] = useState<EnvironmentalTargetConfig[]>([]);
  const [logs, setLogs] = useState<ControlExecutionLog[]>([]);
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [autoRules, setAutoRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Helper to determine allowed zoneIds for the given scope
  const getScopedZoneIds = (): string[] => {
    if (scopeLevel === 'FARMER') {
      // Return assigned zones for the logged-in farmer (e.g. mockEmployees[0])
      const farmerZones = mockEmployees[0]?.assignedZones || ['zone-01', 'zone-02'];
      if (zoneId) return farmerZones.filter(z => z === zoneId);
      return farmerZones;
    }
    if (zoneId) return [zoneId];
    if (fieldId) {
      return mockZones.filter(z => z.fieldId === fieldId).map(z => z.zoneId);
    }
    if (farmId) {
      return mockZones.filter(z => z.farmId === farmId).map(z => z.zoneId);
    }
    return mockZones.map(z => z.zoneId);
  };

  const loadScopedData = async () => {
    setIsLoading(true);
    try {
      const scopedZoneIds = getScopedZoneIds();
      
      const [allAct, allCfg, allLogs, allSch, allRules] = await Promise.all([
        controlService.getActuators(),
        controlService.getEnvironmentalConfigs(),
        controlService.getControlLogs(),
        controlService.getSchedules(),
        controlService.getAutoRules(),
      ]);

      // Filter actuators by scope
      const filteredActuators = allAct.filter(a => {
        if (zoneId) return a.zoneId === zoneId;
        if (fieldId) return scopedZoneIds.includes(a.zoneId || '');
        if (farmId) return a.farmId === farmId;
        return true;
      });

      // Filter configs by scope
      const filteredConfigs = allCfg.filter(c => scopedZoneIds.includes(c.zoneId));

      // Filter logs by scope
      const filteredLogs = allLogs.filter(l => {
        if (zoneId) return l.zoneId === zoneId;
        if (fieldId) return scopedZoneIds.includes(l.zoneId);
        if (farmId) return l.zoneId === farmId || scopedZoneIds.includes(l.zoneId);
        return true;
      });

      // Filter schedules by scope
      const filteredSchedules = allSch.filter(s => scopedZoneIds.includes(s.zoneId));
      
      // Filter auto rules by scope
      const filteredRules = allRules.filter(r => scopedZoneIds.includes(r.zoneId));

      setActuators(filteredActuators);
      setConfigs(filteredConfigs.length > 0 ? filteredConfigs : allCfg);
      setLogs(filteredLogs);
      setSchedules(filteredSchedules);
      setAutoRules(filteredRules);
    } catch (err) {
      console.error('Failed to load CF3 scoped data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScopedData();
  }, [farmId, fieldId, zoneId, scopeLevel]);

  const handleToggleActuator = async (actuatorId: string, targetState: 'ON' | 'OFF', durationMinutes?: number) => {
    try {
      const updated = await controlService.toggleActuator(actuatorId, targetState);
      setNotification({
        type: 'success',
        message: `Đã phát lệnh ${targetState === 'ON' ? 'BẬT' : 'TẮT'} thiết bị [${updated?.name}] qua LoRa Gateway!`
      });
      loadScopedData();
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi phát lệnh điều khiển rơ-le qua LoRa!'
      });
    }
  };

  const handleEmergencyStop = async () => {
    const res = await controlService.emergencyStopAll();
    setNotification({
      type: 'error',
      message: `HỦY LỆNH KHẨN CẤP (BR-CANCEL-01): Tắt toàn bộ ${res.stoppedCount} rơ-le!`
    });
    loadScopedData();
  };

  const scopeLabel = 
    scopeLevel === 'ZONE' ? 'Cấp Zone / Nhà màng' :
    scopeLevel === 'FIELD' ? 'Cấp Phân khu Lô đất (Field)' :
    scopeLevel === 'FARM' ? 'Cấp Trang trại (Farm)' :
    scopeLevel === 'FARMER' ? 'Quyền Nông dân Thực địa' : 'Toàn Hệ thống';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
              TIÊU CHUẨN CF3 ({scopeLabel})
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="text-[#062326]" size={18} />
              {title || `Điều khiển & Lịch tưới Vi khí hậu (${scopeLabel})`}
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {subtitle || `Thiết lập dải tham số, quản lý lịch tưới Cron và điều khiển rơ-le chấp hành khép kín.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadScopedData}
          >
            <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleEmergencyStop}
            className="font-bold shadow-xs"
          >
            <AlertOctagon size={14} className="mr-1" />
            HỦY KHẨN (STOP ALL)
          </Button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-sky-50 border-sky-200 text-sky-900'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <ShieldAlert size={16} className="text-rose-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-1 text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('ACTUATORS')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeSubTab === 'ACTUATORS'
              ? 'bg-[#062326] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Power size={14} /> Kích hoạt Rơ-le ({actuators.length})
        </button>

        <button
          onClick={() => setActiveSubTab('ENV_PARAMS')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeSubTab === 'ENV_PARAMS'
              ? 'bg-[#062326] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders size={14} /> Dải Tham số Vi khí hậu
        </button>

        <button
          onClick={() => setActiveSubTab('SCHEDULES')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeSubTab === 'SCHEDULES'
              ? 'bg-[#062326] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar size={14} /> Lịch tưới & Auto Rules ({schedules.length + autoRules.length})
        </button>

        {showVisualizerTab && (
          <button
            onClick={() => setActiveSubTab('VISUALIZER')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
              activeSubTab === 'VISUALIZER'
                ? 'bg-[#062326] text-white font-bold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} /> Mô phỏng 10 Bước
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('SAFETY')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeSubTab === 'SAFETY'
              ? 'bg-[#062326] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert size={14} /> An toàn Interlock
        </button>

        <button
          onClick={() => setActiveSubTab('LOGS')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeSubTab === 'LOGS'
              ? 'bg-[#062326] text-white font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText size={14} /> Nhật ký Log ({logs.length})
        </button>
      </div>

      {/* Sub-Tab Contents */}
      {activeSubTab === 'ACTUATORS' && (
        <ActuatorControlGrid
          actuators={actuators}
          onToggleActuator={handleToggleActuator}
          isProcessing={isLoading}
        />
      )}

      {activeSubTab === 'ENV_PARAMS' && (
        <EnvironmentalParametersPanel
          configs={configs}
          onUpdateConfig={(cfg) => {
            setNotification({ type: 'success', message: `Đã lưu tham số vi khí hậu cho ${cfg.zoneName}` });
          }}
        />
      )}

      {activeSubTab === 'SCHEDULES' && (
        <div className="space-y-6 text-xs">
          {/* Cron Schedules */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Clock size={16} className="text-[#062326]" /> Lịch Tưới Định kỳ (Cron Schedules) cho {scopeLabel}
            </h4>

            {schedules.length === 0 ? (
              <p className="text-slate-500 italic">Chưa có lịch tưới định kỳ nào được thiết lập cho phạm vi này.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schedules.map(sch => (
                  <div key={sch.scheduleId} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{sch.name}</span>
                      <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </div>
                    <div className="text-slate-600">{sch.zoneName} • {sch.actuatorName}</div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-500">
                      <span>Bắt đầu: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                      <span>Lặp lại: <strong className="text-sky-700">{sch.daysOfWeek.join(', ')}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automation Rules */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Sliders size={16} className="text-sky-700" /> Bộ luật Tự động hóa Vi khí hậu (Rule Engine IF-THEN)
            </h4>

            {autoRules.length === 0 ? (
              <p className="text-slate-500 italic">Chưa có luật tự động hóa vi khí hậu nào.</p>
            ) : (
              <div className="space-y-2">
                {autoRules.map(rule => (
                  <div key={rule.ruleId} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span>{rule.name}</span>
                        <StatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 mt-1">
                        KHI <strong className="text-[#062326]">{rule.parameterCode}</strong> {rule.operator} <strong className="text-amber-700">{rule.thresholdValue}</strong> THÌ KÍCH HOẠT <strong className="text-sky-700">{rule.actuatorName}</strong> TRONG {rule.actionDurationMinutes} PHÚT
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'VISUALIZER' && showVisualizerTab && (
        <CF3FlowVisualizer
          actuators={actuators}
          onActuatorExecuted={handleToggleActuator}
        />
      )}

      {activeSubTab === 'SAFETY' && (
        <SafetyInterlockRulesCard
          onEmergencyStopAll={handleEmergencyStop}
        />
      )}

      {activeSubTab === 'LOGS' && (
        <ControlHistoryLogsTable
          logs={logs}
        />
      )}
    </div>
  );
};
