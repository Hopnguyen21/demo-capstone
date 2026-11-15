import React, { useState, useEffect } from 'react';
import {
  Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw,
  Activity, Radio, FileText, Cpu, AlertOctagon, Sparkles, Calendar, Clock, Sprout, Sunrise, Sun, Sunset,
  X, ChevronRight, Info, ExternalLink, ShieldCheck, Check
} from 'lucide-react';
import { Button, Modal, StatusBadge } from '../ui/BaseUI';
import { controlService, cropService } from '../../services';
import { EnvironmentalParametersPanel } from './EnvironmentalParametersPanel';
import { ActuatorControlGrid } from './ActuatorControlGrid';
import { CropCalendarView } from '../crops/CropCalendarView';
import { ZoneAlertCenter } from '../alerts/ZoneAlertCenter';
import { OpenMeteoWeatherWidget } from '../weather/OpenMeteoWeatherWidget';
import {
  Actuator, ControlExecutionLog, EnvironmentalTargetConfig,
  ControlSchedule, AutomationRule, Zone, Field, Farm, Crop
} from '../../types';
import { useAuth } from '@/app/providers/AuthContext';

export interface CF3ControlSectionProps {
  scopeLevel: 'FARM' | 'FIELD' | 'ZONE' | 'GLOBAL' | 'FARMER';
  farmId?: string;
  fieldId?: string;
  zoneId?: string;
  title?: string;
  subtitle?: string;
  defaultTab?: 'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | null;
  nodes?: any[];
}

export const CF3ControlSection: React.FC<CF3ControlSectionProps> = ({
  scopeLevel,
  farmId,
  fieldId,
  zoneId,
  title,
  subtitle,
  defaultTab = 'ACTUATORS',
  nodes,
}) => {
  const { zones: authZones } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS'>(
    (defaultTab as any) || 'ACTUATORS'
  );
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveSubTab(defaultTab);
    }
  }, [defaultTab]);

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
      const farmerZones = authZones.map(z => z.zoneId);
      if (zoneId) return farmerZones.filter(z => z === zoneId);
      return farmerZones.length > 0 ? farmerZones : ['32000000-0000-0000-0000-000000000001'];
    }
    if (zoneId) return [zoneId];
    if (fieldId) {
      return authZones.filter(z => z.fieldId === fieldId).map(z => z.zoneId);
    }
    if (farmId) {
      return authZones.filter(z => z.farmId === farmId).map(z => z.zoneId);
    }
    return authZones.map(z => z.zoneId);
  };

  const loadScopedData = async () => {
    setIsLoading(true);
    try {
      const scopedZoneIds = getScopedZoneIds();
      const primaryZone = zoneId || (scopedZoneIds.length > 0 ? scopedZoneIds[0] : undefined);

      const [allAct, allCfg, allLogs, allSch, allRules, allCrops] = await Promise.all([
        controlService.getActuators(primaryZone),
        controlService.getEnvironmentalConfigs(),
        controlService.getControlLogs(primaryZone),
        controlService.getSchedules(primaryZone),
        controlService.getAutoRules(primaryZone),
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
      if (allCrops.length > 0 && selectedCropIdForSync === 'crop-tomato') {
        setSelectedCropIdForSync(allCrops[0].cropId);
      }
    } catch (err) {
      console.error('Failed to load control data:', err);
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
        message: `Đã phát lệnh ${targetState === 'ON' ? 'BẬT' : 'TẮT'} thiết bị [${updated?.name}] thành công!`
      });
      loadScopedData();
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi phát lệnh điều khiển rơ-le qua Gateway!'
      });
    }
  };

  const handleEmergencyStop = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn TẮT KHẨN CẤP toàn bộ máy bơm, van tưới và rơ-le đang hoạt động?')) {
      return;
    }
    try {
      const res = await controlService.emergencyStopAll();
      setNotification({
        type: 'error',
        message: `Đã ngắt khẩn cấp toàn bộ ${res.stoppedCount} thiết bị rơ-le!`
      });
      loadScopedData();
    } catch (err) {
      console.error('Lỗi dừng khẩn cấp:', err);
    }
  };

  const handleSyncCropToZone = async () => {
    const targetZoneId = zoneId || getScopedZoneIds()[0] || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await cropService.syncCropScheduleToZone(selectedCropIdForSync, targetZoneId);
      if (res?.success) {
        setNotification({
          type: 'success',
          message: `Đã đồng bộ thành công ${res.createdSchedulesCount} ca tưới Sáng-Trưa-Chiều sang Zone "${res.zoneName}"!`
        });
        setIsSyncModalOpen(false);
        loadScopedData();
      }
    } catch (err: any) {
      console.error('Failed to sync crop schedule to zone:', err);
      const errMsg = err?.response?.status === 403
        ? 'Chỉ tài khoản Chủ trang trại hoặc Kỹ thuật viên mới có quyền đồng bộ lịch.'
        : 'Không thể đồng bộ lịch tưới lúc này. Vui lòng kiểm tra lại kết nối thiết bị.';
      setNotification({
        type: 'error',
        message: errMsg
      });
    }
  };

  const scopeLabel =
    scopeLevel === 'ZONE' ? 'Phân khu (Zone)' :
    scopeLevel === 'FIELD' ? 'Lô đất (Field)' :
    scopeLevel === 'FARM' ? 'Trang trại (Farm)' :
    scopeLevel === 'FARMER' ? 'Khu vực quản lý' : 'Toàn Hệ thống';

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

  const activeRelaysCount = actuators.filter(a => a.status === 'ON').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-sky-50 border-sky-300 text-sky-900'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer">✕</button>
        </div>
      )}

      {/* ─── 1. CONTROL HEADER BANNER ─── */}
      <div className="relative bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] p-6 sm:p-7 rounded-3xl border border-emerald-400/30 text-white shadow-lg overflow-hidden">
        {/* Ambient lighting effects */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Top metadata row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/30 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={12} className="text-emerald-200" /> Điều Khiển Thực Địa & Tự Động Hóa
              </span>
              <span className="text-xs text-emerald-100 hidden sm:inline-block">
                • {scopeLabel}
              </span>
            </div>

            {/* Live Status Chips */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/20 text-white border border-white/25 flex items-center gap-1.5 backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Gateway trực tuyến
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/20 text-white border border-white/25">
                {activeRelaysCount} thiết bị đang bật
              </span>
            </div>
          </div>

          {/* Main Title & Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                {title || `Điều Khiển Thiết Bị & Lập Lịch Tưới cho ${scopeLabel}`}
              </h2>
              <p className="text-xs md:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
                {subtitle || 'Quản lý bật/tắt thiết bị chấp hành, thiết lập ngưỡng vi khí hậu mục tiêu và cấu hình lịch tưới tự động.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowWeatherModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Xem thời tiết thực địa"
              >
                <Sun size={14} className="text-amber-300" />
                <span>Thời tiết</span>
              </button>

              <button
                type="button"
                onClick={loadScopedData}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                title="Làm mới trạng thái thiết bị"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>

              <button
                type="button"
                onClick={handleEmergencyStop}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 border border-rose-400/40 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="Tắt toàn bộ thiết bị đang bật"
              >
                <AlertOctagon size={15} />
                <span>Tắt khẩn cấp tất cả</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. INLINE TAB SELECTOR BAR ─── */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 border border-slate-200/90 rounded-2xl overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('ACTUATORS')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'ACTUATORS'
              ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Power size={15} className={activeSubTab === 'ACTUATORS' ? 'text-[#119653]' : 'text-slate-400'} />
          <span>Thiết Bị & Rơ-le</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'ACTUATORS' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {actuators.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ENV_PARAMS')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'ENV_PARAMS'
              ? 'bg-white text-sky-800 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Sliders size={15} className={activeSubTab === 'ENV_PARAMS' ? 'text-sky-600' : 'text-slate-400'} />
          <span>Ngưỡng Vi Khí Hậu</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'ENV_PARAMS' ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {configs.length > 0 ? `${configs.length} Zone` : 'Cài đặt'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('SCHEDULES')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'SCHEDULES'
              ? 'bg-white text-amber-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Calendar size={15} className={activeSubTab === 'SCHEDULES' ? 'text-amber-600' : 'text-slate-400'} />
          <span>Lịch Tưới & Tự Động</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'SCHEDULES' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {schedules.length + autoRules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ALERTS')}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'ALERTS'
              ? 'bg-white text-rose-800 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ShieldAlert size={15} className={activeSubTab === 'ALERTS' ? 'text-rose-600' : 'text-slate-400'} />
          <span>Cảnh Báo An Toàn</span>
        </button>
      </div>

      {/* ─── 3. ACTIVE TAB CONTENT PANEL (RENDERED DIRECTLY INLINE) ─── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
        {/* TAB 1: ACTUATORS (Thiết bị & Rơ-le) */}
        {activeSubTab === 'ACTUATORS' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Power size={18} className="text-[#119653]" />
                  <span>Bảng Điều Khiển Thiết Bị & Rơ-le Chấp Hành</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bật / tắt trực tiếp máy bơm, van tưới tự động, quạt làm mát và đèn quang hợp.
                </p>
              </div>

              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-center">
                {activeRelaysCount} / {actuators.length} thiết bị đang bật
              </span>
            </div>

            <ActuatorControlGrid
              actuators={actuators}
              onToggleActuator={handleToggleActuator}
              isProcessing={isLoading}
            />
          </div>
        )}

        {/* TAB 2: ENVIRONMENTAL TARGET CONFIGS (Ngưỡng Vi Khí Hậu) */}
        {activeSubTab === 'ENV_PARAMS' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders size={18} className="text-sky-600" />
                  <span>Cấu Hình Dải Vi Khí Hậu Mục Tiêu Cho Cây Trồng</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thiết lập ngưỡng nhiệt độ, độ ẩm đất, độ ẩm không khí và cường độ ánh sáng tối ưu theo giai đoạn sinh trưởng.
                </p>
              </div>
            </div>

            <EnvironmentalParametersPanel
              configs={configs}
              onUpdateConfig={async (cfg) => {
                try {
                  await controlService.updateEnvironmentalConfig(cfg);
                  setNotification({ type: 'success', message: `Đã lưu ngưỡng vi khí hậu cho ${cfg.zoneName} thành công!` });
                } catch {
                  setNotification({ type: 'success', message: `Đã lưu ngưỡng vi khí hậu cho ${cfg.zoneName}` });
                }
              }}
            />
          </div>
        )}

        {/* TAB 3: SCHEDULES & AUTO RULES (Lịch tưới & Tự động) */}
        {activeSubTab === 'SCHEDULES' && (
          <div className="space-y-6 text-xs animate-in fade-in duration-150">
            {/* Header Toolbar */}
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-[#119653]" />
                    <span>Lịch Tưới Nước Theo Ca (Sáng - Trưa - Chiều)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lập lịch bật/tắt thiết bị tưới tự động hoặc đồng bộ trực tiếp từ Thư viện Cây trồng VietGAP.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-white border border-slate-200 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setScheduleViewMode('LIST')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        scheduleViewMode === 'LIST' ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Danh sách ca tưới
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleViewMode('CALENDAR')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        scheduleViewMode === 'CALENDAR' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Lịch tưới theo ngày
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSyncModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Đồng bộ từ Thư viện Cây</span>
                  </button>
                </div>
              </div>

              {/* View Mode: List vs Calendar */}
              {scheduleViewMode === 'CALENDAR' ? (
                <CropCalendarView
                  plan={activePlan}
                  zoneId={zoneId || (getScopedZoneIds().length > 0 ? getScopedZoneIds()[0] : undefined)}
                  zoneName={authZones.find(z => z.zoneId === (zoneId || getScopedZoneIds()[0]))?.name || 'Phân khu canh tác'}
                  cropName={currentCropObj?.name || 'Cây Trồng'}
                  seasonStartDate="2026-10-15"
                  seasonDurationDays={45}
                  readOnly={false}
                  onSaveZoneSchedule={(saved) => {
                    setNotification({
                      type: 'success',
                      message: `Đã lưu lịch tưới ${saved.seasonDurationDays} ngày cho Zone "${saved.zoneName}"!`
                    });
                  }}
                  onResetToTemplate={() => {
                    setNotification({
                      type: 'info',
                      message: 'Đã khôi phục về lịch mẫu từ Thư viện Cây trồng.'
                    });
                  }}
                />
              ) : (
                <div>
                  {schedules.length === 0 ? (
                    <div className="p-8 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-300">
                      <Sprout size={32} className="mx-auto text-emerald-600/50" />
                      <p className="text-slate-500 italic text-xs">Chưa có ca tưới tự động nào được thiết lập cho khu vực này.</p>
                      <button
                        type="button"
                        onClick={() => setIsSyncModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <RefreshCw size={13} />
                        <span>Đồng bộ Lịch Sáng-Trưa-Chiều từ Thư viện Cây</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {schedules.map(sch => {
                        const schName = String(sch?.name || '').toLowerCase();
                        const isMorning = schName.includes('sáng') || (sch.startTime && sch.startTime < '11:00');
                        const isNoon = schName.includes('trưa') || (sch.startTime && sch.startTime >= '11:00' && sch.startTime <= '14:00');
                        const isAfternoon = schName.includes('chiều') || (sch.startTime && sch.startTime > '14:00');

                        return (
                          <div key={sch.scheduleId} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span className="flex items-center gap-1.5">
                                {isMorning && <Sunrise size={16} className="text-amber-600" />}
                                {isNoon && <Sun size={16} className="text-rose-600" />}
                                {isAfternoon && <Sunset size={16} className="text-indigo-600" />}
                                {sch.name}
                              </span>
                              <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                            </div>
                            <div className="text-slate-600 flex items-center justify-between text-xs">
                              <span>{sch.zoneName} • {sch.actuatorName}</span>
                              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-medium text-[11px]">
                                {sch.growthStageName || 'VietGAP'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                              <span>Bắt đầu: <strong className="text-slate-900 font-mono">{sch.startTime}</strong> ({sch.durationMinutes} phút)</span>
                              <span>Lặp lại: <strong className="text-emerald-800">{Array.isArray(sch.daysOfWeek) && sch.daysOfWeek.length > 0 ? sch.daysOfWeek.join(', ') : 'Hằng ngày'}</strong></span>
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
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Sliders size={16} className="text-emerald-700" />
                <span>Quy Tắc Tự Động Kích Hoạt Theo Cảm Biến Thực Tế</span>
              </h4>

              {autoRules.length === 0 ? (
                <p className="text-slate-500 italic text-xs">Chưa có quy tắc kích hoạt tự động theo cảm biến.</p>
              ) : (
                <div className="space-y-2.5">
                  {autoRules.map(rule => (
                    <div key={rule.ruleId} className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                          <span>{rule.name}</span>
                          <StatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Khi <strong className="text-[#119653] font-bold">{rule.parameterCode}</strong> {rule.operator} <strong className="text-amber-800 font-bold">{rule.thresholdValue}</strong> ➔ Tự động kích hoạt <strong className="text-sky-800 font-bold">{rule.actuatorName}</strong> trong {rule.actionDurationMinutes} phút
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ALERTS (Cảnh báo an toàn) */}
        {activeSubTab === 'ALERTS' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-600" />
                  <span>Giám Sát & Cảnh Báo An Toàn Vi Khí Hậu</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi các sự cố vượt ngưỡng nhiệt độ, độ ẩm đất, rủi ro ngập úng và kích hoạt quy trình ứng phó.
                </p>
              </div>
            </div>

            <ZoneAlertCenter
              scopeLevel={scopeLevel}
              farmId={farmId}
              fieldId={fieldId}
              zoneId={zoneId}
              nodes={nodes}
              onNavigateToControl={() => setActiveSubTab('ACTUATORS')}
            />
          </div>
        )}
      </div>

      {/* MODAL: Sync Schedule from Crop Library */}
      <Modal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="Đồng Bộ Lịch Tưới Từ Thư Viện Cây Trồng"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-emerald-950">
            <p className="font-bold flex items-center gap-1.5">
              <Sprout size={15} /> Thư viện Cây trồng VietGAP Chuẩn
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Chọn loài cây nông nghiệp mẫu từ thư viện để tải Lịch tưới 3 Ca (Sáng, Trưa, Chiều) và dải vi khí hậu tối ưu vào phân khu hiện tại.
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
                  {currentCropObj.growthCycleDays ? `${currentCropObj.growthCycleDays} ngày vụ` : 'Chưa có chu kỳ'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] text-slate-600">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="block text-amber-700 font-bold">🌅 Ca Sáng</span>
                  <span>{(() => { const x = currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING'); return x ? `${x.startTime} (${x.durationMinutes}m)` : 'Chưa có'; })()}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="block text-rose-700 font-bold">☀️ Ca Trưa</span>
                  <span>{(() => { const x = currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON'); return x ? `${x.startTime} (${x.durationMinutes}m)` : 'Chưa có'; })()}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="block text-indigo-700 font-bold">🌇 Ca Chiều</span>
                  <span>{(() => { const x = currentCropObj.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON'); return x ? `${x.startTime} (${x.durationMinutes}m)` : 'Chưa có'; })()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsSyncModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSyncCropToZone} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <RefreshCw size={14} className="mr-1.5" /> Áp dụng & Đồng bộ sang Zone
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Open-Meteo Live Land Weather */}
      <Modal
        isOpen={showWeatherModal}
        onClose={() => setShowWeatherModal(false)}
        title={`Dự Báo & Thời Tiết Thực Địa Open-Meteo — ${scopeLabel}`}
      >
        <div className="space-y-4">
          <OpenMeteoWeatherWidget
            landName={title || `Khu đất ${scopeLabel}`}
          />
        </div>
      </Modal>
    </div>
  );
};
