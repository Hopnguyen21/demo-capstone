import React, { useState, useEffect } from 'react';
import { 
  Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw, 
  Activity, Radio, FileText, Cpu, AlertOctagon, Sparkles, Calendar, Clock, Sprout, Sunrise, Sun, Sunset
} from 'lucide-react';
import { Button, Modal, StatusBadge } from '../ui/BaseUI';
import { controlService, cropService } from '../../services';
import { EnvironmentalParametersPanel } from './EnvironmentalParametersPanel';
import { ActuatorControlGrid } from './ActuatorControlGrid';
import { SafetyInterlockRulesCard } from './SafetyInterlockRulesCard';
import { ControlHistoryLogsTable } from './ControlHistoryLogsTable';
import { CropCalendarView } from '../crops/CropCalendarView';
import { ZoneAlertCenter } from '../alerts/ZoneAlertCenter';
import { 
  Actuator, ControlExecutionLog, EnvironmentalTargetConfig, 
  ControlSchedule, AutomationRule, Zone, Field, Farm, Crop 
} from '../../types';
import { mockZones, mockFields, mockSchedules, mockAutomationRules, mockEmployees } from '../../mocks/mockData';

export interface CF3ControlSectionProps {
  scopeLevel: 'FARM' | 'FIELD' | 'ZONE' | 'GLOBAL' | 'FARMER';
  farmId?: string;
  fieldId?: string;
  zoneId?: string;
  title?: string;
  subtitle?: string;
  defaultTab?: 'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | 'SAFETY' | 'LOGS';
}

export const CF3ControlSection: React.FC<CF3ControlSectionProps> = ({
  scopeLevel,
  farmId,
  fieldId,
  zoneId,
  title,
  subtitle,
  defaultTab = 'ACTUATORS',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | 'SAFETY' | 'LOGS'>(defaultTab);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [configs, setConfigs] = useState<EnvironmentalTargetConfig[]>([]);
  const [logs, setLogs] = useState<ControlExecutionLog[]>([]);
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [autoRules, setAutoRules] = useState<AutomationRule[]>([]);
  const [cropsList, setCropsList] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Crop schedule sync modal state & calendar view toggle
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [selectedCropIdForSync, setSelectedCropIdForSync] = useState<string>('crop-tomato');
  const [scheduleViewMode, setScheduleViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  // Helper to determine allowed zoneIds for the given scope
  const getScopedZoneIds = (): string[] => {
    if (scopeLevel === 'FARMER') {
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
      
      const [allAct, allCfg, allLogs, allSch, allRules, allCrops] = await Promise.all([
        controlService.getActuators(),
        controlService.getEnvironmentalConfigs(),
        controlService.getControlLogs(),
        controlService.getSchedules(),
        controlService.getAutoRules(),
        cropService.getCrops(),
      ]);

      // Filter actuators by scope
      const filteredActuators = (allAct || []).filter((a: any) => {
        if (zoneId) return a.zoneId === zoneId;
        if (fieldId) return scopedZoneIds.includes(a.zoneId || '');
        if (farmId) return a.farmId === farmId;
        return true;
      });

      // Filter configs by scope
      const filteredConfigs = (allCfg || []).filter((c: any) => scopedZoneIds.includes(c.zoneId));

      // Filter logs by scope
      const filteredLogs = (allLogs || []).filter((l: any) => {
        if (zoneId) return l.zoneId === zoneId;
        if (fieldId) return scopedZoneIds.includes(l.zoneId);
        if (farmId) return l.zoneId === farmId || scopedZoneIds.includes(l.zoneId);
        return true;
      });

      // Filter schedules by scope
      const filteredSchedules = (allSch || []).filter((s: any) => scopedZoneIds.includes(s.zoneId));
      
      // Filter auto rules by scope
      const filteredRules = (allRules || []).filter((r: any) => scopedZoneIds.includes(r.zoneId));

      setActuators(filteredActuators);
      setConfigs(filteredConfigs.length > 0 ? filteredConfigs : allCfg);
      setLogs(filteredLogs);
      setSchedules(filteredSchedules);
      setAutoRules(filteredRules);
      setCropsList(allCrops);
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

  const handleSyncCropToZone = async () => {
    const targetZoneId = zoneId || getScopedZoneIds()[0] || 'zone-01';
    const res = await cropService.syncCropScheduleToZone(selectedCropIdForSync, targetZoneId);
    if (res.success) {
      setNotification({
        type: 'success',
        message: `⚡ Đã đồng bộ thành công ${res.createdSchedulesCount} ca tưới Sáng-Trưa-Chiều & Vi khí hậu từ Thư viện Cây sang Zone "${res.zoneName}"!`
      });
      setIsSyncModalOpen(false);
      loadScopedData();
    }
  };

  const scopeLabel = 
    scopeLevel === 'ZONE' ? 'Cấp Zone / Nhà màng' :
    scopeLevel === 'FIELD' ? 'Cấp Phân khu Lô đất (Field)' :
    scopeLevel === 'FARM' ? 'Cấp Trang trại (Farm)' :
    scopeLevel === 'FARMER' ? 'Quyền Nông dân Thực địa' : 'Toàn Hệ thống';

  // Construct active calendar plan for display
  const currentCropObj = cropsList.find(c => c.cropId === selectedCropIdForSync) || cropsList[0];
  const activePlan = currentCropObj?.calendarIrrigationPlan || {
    repeatType: 'DAILY',
    lunarSyncEnabled: true,
    sessions: [
      { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-sky-50 border-sky-200 text-sky-900'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Control Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#062326] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
              TIÊU CHUẨN CF3 ({scopeLabel})
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {title || `Điều khiển & Lịch tưới Vi khí hậu cho ${scopeLabel}`}
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {subtitle || 'Thiết lập ngưỡng vi khí hậu riêng cho vụ trồng, bật/tắt thiết bị rơ-le và xem lịch tưới trực tiếp tại Zone này.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadScopedData} disabled={isLoading}>
            <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới
          </Button>
          <Button variant="danger" size="sm" onClick={handleEmergencyStop}>
            <AlertOctagon size={14} className="mr-1.5" /> HỦY KHẨN (STOP ALL)
          </Button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('ALERTS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'ALERTS' ? 'bg-rose-700 text-white shadow-xs font-bold' : 'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          <ShieldAlert size={14} className={activeSubTab === 'ALERTS' ? 'text-white' : 'text-rose-600'} /> Trung tâm Cảnh báo Zone
        </button>

        <button
          onClick={() => setActiveSubTab('ACTUATORS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'ACTUATORS' ? 'bg-white text-[#062326] shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Power size={14} /> Kích hoạt Rơ-le ({actuators.length})
        </button>

        <button
          onClick={() => setActiveSubTab('ENV_PARAMS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'ENV_PARAMS' ? 'bg-white text-[#062326] shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders size={14} /> Dải Tham số Vi khí hậu
        </button>

        <button
          onClick={() => setActiveSubTab('SCHEDULES')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'SCHEDULES' ? 'bg-white text-[#062326] shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar size={14} /> Lịch tưới & Auto Rules ({schedules.length + autoRules.length})
        </button>

        <button
          onClick={() => setActiveSubTab('SAFETY')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'SAFETY' ? 'bg-white text-[#062326] shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert size={14} /> An toàn Interlock
        </button>

        <button
          onClick={() => setActiveSubTab('LOGS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'LOGS' ? 'bg-white text-[#062326] shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={14} /> Nhật ký Log ({logs.length})
        </button>
      </div>

      {/* SUBTAB CONTENT */}
      {activeSubTab === 'ALERTS' && (
        <ZoneAlertCenter
          scopeLevel={scopeLevel}
          farmId={farmId}
          fieldId={fieldId}
          zoneId={zoneId}
          onNavigateToControl={() => setActiveSubTab('ACTUATORS')}
        />
      )}

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
          {/* Cron Schedules & Sync Banner Header */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-[#062326]" /> Lịch Tưới Định kỳ (Cron Schedules) cho {scopeLabel}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lịch tưới tự động 3 ca (Sáng - Trưa - Chiều) được đồng bộ từ Thư viện Cây trồng Chuẩn.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                  <button
                    onClick={() => setScheduleViewMode('LIST')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      scheduleViewMode === 'LIST' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📋 Danh sách Cron
                  </button>
                  <button
                    onClick={() => setScheduleViewMode('CALENDAR')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      scheduleViewMode === 'CALENDAR' ? 'bg-[#062326] text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🗓️ Cuốn Lịch Tưới Zone
                  </button>
                </div>

                <Button size="sm" onClick={() => setIsSyncModalOpen(true)}>
                  <RefreshCw size={13} className="mr-1" /> Đồng bộ từ Thư viện Cây
                </Button>
              </div>
            </div>

            {/* View Mode: List vs Calendar */}
            {scheduleViewMode === 'CALENDAR' ? (
              <CropCalendarView plan={activePlan} readOnly={true} />
            ) : (
              <div>
                {schedules.length === 0 ? (
                  <div className="p-6 text-center space-y-3 bg-white rounded-xl border border-dashed border-slate-300">
                    <Sprout size={32} className="mx-auto text-emerald-600/50" />
                    <p className="text-slate-500 italic">Chưa có lịch tưới định kỳ nào được thiết lập cho phạm vi này.</p>
                    <Button size="sm" onClick={() => setIsSyncModalOpen(true)}>
                      <RefreshCw size={13} className="mr-1.5" /> Đồng bộ Lịch Sáng-Trưa-Chiều từ Thư viện Cây
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {schedules.map(sch => {
                      const isMorning = sch.name.toLowerCase().includes('sáng') || sch.startTime < '11:00';
                      const isNoon = sch.name.toLowerCase().includes('trưa') || (sch.startTime >= '11:00' && sch.startTime <= '14:00');
                      const isAfternoon = sch.name.toLowerCase().includes('chiều') || sch.startTime > '14:00';

                      return (
                        <div key={sch.scheduleId} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span className="flex items-center gap-1.5">
                              {isMorning && <Sunrise size={15} className="text-amber-600" />}
                              {isNoon && <Sun size={15} className="text-rose-600" />}
                              {isAfternoon && <Sunset size={15} className="text-indigo-600" />}
                              {sch.name}
                            </span>
                            <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                          </div>
                          <div className="text-slate-600 flex items-center justify-between text-[11px]">
                            <span>{sch.zoneName} • {sch.actuatorName}</span>
                            <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 font-mono text-[10px]">
                              {sch.growthStageName || 'Đồng bộ VietGAP'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-500">
                            <span>Bắt đầu: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                            <span>Lặp lại: <strong className="text-sky-700">{sch.daysOfWeek.join(', ')}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* MODAL: Sync Schedule from Crop Library */}
      <Modal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="Đồng bộ Lịch tưới Sáng-Trưa-Chiều từ Thư viện Cây trồng"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
            <p className="font-bold flex items-center gap-1.5">
              <Sprout size={15} /> Thư viện Cây trồng VietGAP Chuẩn
            </p>
            <p className="text-[11px] text-emerald-800">
              Chọn loài cây nông nghiệp mẫu từ thư viện để tải Lịch tưới 3 Ca (Sáng, Trưa, Chiều) và Dải vi khí hậu tối ưu vào Zone hiện tại.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Chọn loại cây trồng:</label>
            <select
              value={selectedCropIdForSync}
              onChange={(e) => setSelectedCropIdForSync(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold text-xs text-slate-900"
            >
              {cropsList.map(c => (
                <option key={c.cropId} value={c.cropId}>
                  {c.name} ({c.scientificName}) - {c.category || 'VietGAP'}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Crop Preview */}
          {currentCropObj && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{currentCropObj.name}</span>
                <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                  {currentCropObj.growthCycleDays || 90} ngày vụ
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] text-slate-600">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="block text-amber-700 font-bold">🌅 Ca Sáng</span>
                  <span>{currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.startTime || '07:30'} ({currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.durationMinutes || 20}m)</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="block text-rose-700 font-bold">☀️ Ca Trưa</span>
                  <span>{currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.startTime || '12:00'} ({currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.durationMinutes || 10}m)</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="block text-indigo-700 font-bold">🌇 Ca Chiều</span>
                  <span>{currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.startTime || '16:30'} ({currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.durationMinutes || 15}m)</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsSyncModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSyncCropToZone}>
              <RefreshCw size={14} className="mr-1.5" /> Áp dụng & Đồng bộ sang Zone
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
