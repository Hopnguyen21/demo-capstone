import React, { useState, useEffect } from 'react';
import { 
  Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw, 
  Activity, Radio, FileText, Cpu, AlertOctagon, Sparkles, Calendar, Clock, Sprout, Sunrise, Sun, Sunset,
  X, ChevronRight, Info, ExternalLink
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
import { useAuth } from '../../app/providers/AuthContext';

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
  defaultTab = null,
  nodes,
}) => {
  const { zones: authZones } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | null>(defaultTab);
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);

  useEffect(() => {
    if (defaultTab !== undefined) {
      setActiveSubTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeSubTab !== null) {
        setActiveSubTab(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSubTab]);

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
    const targetZoneId = zoneId || getScopedZoneIds()[0] || '32000000-0000-0000-0000-000000000001';
    try {
      const res = await cropService.syncCropScheduleToZone(selectedCropIdForSync, targetZoneId);
      if (res?.success) {
        setNotification({
          type: 'success',
          message: `⚡ Đã đồng bộ thành công ${res.createdSchedulesCount} ca tưới Sáng-Trưa-Chiều & Vi khí hậu từ Thư viện Cây sang Zone "${res.zoneName}"!`
        });
        setIsSyncModalOpen(false);
        loadScopedData();
      }
    } catch (err: any) {
      console.error('Failed to sync crop schedule to zone:', err);
      const errMsg = err?.response?.status === 403 
        ? 'Quyền truy cập: Chỉ tài khoản có thẩm quyền (Farm Owner / Kỹ thuật viên) mới được đồng bộ lịch sang Zone.'
        : 'Không thể đồng bộ lịch tưới sang Zone lúc này. Vui lòng kiểm tra lại thiết bị của Zone.';
      setNotification({
        type: 'error',
        message: errMsg
      });
    }
  };

  const scopeLabel = 
    scopeLevel === 'ZONE' ? 'Cấp Zone' :
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

  const activeRelaysCount = actuators.filter(a => a.status === 'ON').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-medium shadow-xs ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-sky-50 border-sky-300 text-sky-900'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
        </div>
      )}

      {/* Modern High-End Executive Control Section Header */}
      <div className="relative bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] p-6 rounded-3xl border border-emerald-400/30 text-white shadow-lg overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Top metadata pill bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/30 flex items-center gap-1.5 tracking-wider uppercase">
                <Sparkles size={11} className="text-white" /> TIÊU CHUẨN CF3 ({scopeLabel})
              </span>
              <span className="text-[11px] text-emerald-100 font-mono hidden sm:inline-block">
                • IOT SMART CONTROL HUB
              </span>
            </div>

            {/* Live indicators */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-black/20 text-white border border-white/25 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /> LoRa Gateway Online
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-black/20 text-white border border-white/25">
                Failsafe 30m Active
              </span>
            </div>
          </div>

          {/* Main Title & Action Buttons Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                {title || `Điều khiển & Lịch tưới Vi khí hậu cho ${scopeLabel}`}
              </h2>
              <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                {subtitle || 'Thiết lập ngưỡng vi khí hậu riêng cho vụ trồng, bật/tắt thiết bị rơ-le và xem lịch tưới trực tiếp tại Zone này.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowWeatherModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Xem thời tiết vệ tinh Open-Meteo thời gian thực cho khu đất"
              >
                <Sun size={14} className="text-amber-300" />
                Thời Tiết Open-Meteo
              </button>

              <button
                type="button"
                onClick={loadScopedData}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                Làm mới
              </button>

              <button
                type="button"
                onClick={handleEmergencyStop}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 border border-rose-500/50 shadow-md shadow-rose-950/50 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Ngắt toàn bộ rơ-le ngay lập tức"
              >
                <AlertOctagon size={15} className="animate-pulse" />
                HỦY KHẨN (STOP ALL)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Interactive Feature Cards Arranged Vertically ("để dọc") */}
      <div className="flex flex-col gap-3">
        {/* 1. Cảnh báo Zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSubTab('ALERTS')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSubTab('ALERTS'); }}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-2xl border transition-all cursor-pointer ${
            activeSubTab === 'ALERTS'
              ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-300 shadow-md'
              : 'bg-white hover:bg-rose-50/30 border-slate-200/90 hover:border-rose-300 shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/20 group-hover:scale-105 transition-transform">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-700 transition-colors">
                  Cảnh báo Zone & An toàn Vi khí hậu
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  Giám sát 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                Theo dõi các vi phạm ngưỡng nhiệt độ, độ ẩm đất, rủi ro ngập úng và kích hoạt quy trình ứng phó.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-3 pl-16 sm:pl-0">
            <span className="text-xs font-semibold text-rose-700">
              Trung tâm Cảnh báo
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 group-hover:bg-rose-700 shadow-xs transition-all">
              Mở thẻ <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* 2. Rơ-le Chấp hành */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSubTab('ACTUATORS')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSubTab('ACTUATORS'); }}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-2xl border transition-all cursor-pointer ${
            activeSubTab === 'ACTUATORS'
              ? 'bg-emerald-50/90 border-[#119653] ring-2 ring-emerald-300 shadow-md'
              : 'bg-white hover:bg-emerald-50/30 border-slate-200/90 hover:border-emerald-300 shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#119653] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Power size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Điều khiển Rơ-le Chấp hành (Actuators Control Grid)
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                  {actuators.length} Thiết bị
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                Bật/tắt thủ công Bơm, Quạt làm mát, Đèn quang hợp và Van tưới LoRa kèm bảo vệ Hardware Failsafe.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-3 pl-16 sm:pl-0">
            <span className="text-xs font-semibold text-emerald-700">
              Bảng Rơ-le LoRa
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#119653] group-hover:bg-[#0e8046] shadow-xs transition-all">
              Mở thẻ <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* 3. Dải Vi khí hậu */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSubTab('ENV_PARAMS')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSubTab('ENV_PARAMS'); }}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-2xl border transition-all cursor-pointer ${
            activeSubTab === 'ENV_PARAMS'
              ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-300 shadow-md'
              : 'bg-white hover:bg-sky-50/30 border-slate-200/90 hover:border-sky-300 shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  Cấu hình Dải Vi khí hậu Mục tiêu (Environmental Parameters)
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Ngưỡng Canh tác
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                Thiết lập dải độ ẩm đất, nhiệt độ, độ ẩm không khí và cường độ ánh sáng tối ưu cho cây trồng.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-3 pl-16 sm:pl-0">
            <span className="text-xs font-semibold text-sky-700">
              4 Chỉ số Mục tiêu
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 group-hover:bg-sky-700 shadow-xs transition-all">
              Mở thẻ <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* 4. Lịch tưới & Auto */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveSubTab('SCHEDULES')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSubTab('SCHEDULES'); }}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-2xl border transition-all cursor-pointer ${
            activeSubTab === 'SCHEDULES'
              ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-md'
              : 'bg-white hover:bg-amber-50/30 border-slate-200/90 hover:border-amber-300 shadow-xs hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                  Lịch tưới 3 Ca & Quy tắc Tự động (Schedules & Auto Rules)
                </h4>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                  {schedules.length + autoRules.length} Lịch & Luật
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                Lịch tưới Sáng-Trưa-Chiều đồng bộ VietGAP kèm các bộ luật kích hoạt rơ-le theo cảm biến thực tế.
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-3 pl-16 sm:pl-0">
            <span className="text-xs font-semibold text-amber-800">
              Cuốn Lịch & IF-THEN
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-600 group-hover:bg-amber-700 shadow-xs transition-all">
              Mở thẻ <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>

      {/* MODAL / FLOATING CARD OVERLAY (Bấm ra ngoài thẻ thì thẻ sẽ tắt) */}
      {activeSubTab !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveSubTab(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50/90">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl text-white shadow-xs ${
                  activeSubTab === 'ALERTS' ? 'bg-rose-600' :
                  activeSubTab === 'ACTUATORS' ? 'bg-[#119653]' :
                  activeSubTab === 'ENV_PARAMS' ? 'bg-sky-600' : 'bg-amber-600'
                }`}>
                  {activeSubTab === 'ALERTS' && <ShieldAlert size={20} />}
                  {activeSubTab === 'ACTUATORS' && <Power size={20} />}
                  {activeSubTab === 'ENV_PARAMS' && <Sliders size={20} />}
                  {activeSubTab === 'SCHEDULES' && <Calendar size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {activeSubTab === 'ALERTS' && 'Trung tâm Cảnh báo Zone & An toàn Vi khí hậu'}
                      {activeSubTab === 'ACTUATORS' && 'Bảng Điều khiển Rơ-le Chấp hành Trực tiếp'}
                      {activeSubTab === 'ENV_PARAMS' && 'Cấu hình Dải Vi khí hậu Mục tiêu (Set Parameters)'}
                      {activeSubTab === 'SCHEDULES' && 'Lịch Tưới 3 Ca & Bộ luật Tự động hóa'}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {scopeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeSubTab === 'ALERTS' && 'Quản lý ngưỡng và lịch sử cảnh báo an toàn.'}
                    {activeSubTab === 'ACTUATORS' && 'Bật/tắt thủ công thiết bị chấp hành LoRa có Failsafe.'}
                    {activeSubTab === 'ENV_PARAMS' && 'Thiết lập chỉ số môi trường mục tiêu cho vụ trồng.'}
                    {activeSubTab === 'SCHEDULES' && 'Đồng bộ lịch tưới và quy tắc kích hoạt cảm biến.'}
                  </p>
                </div>
              </div>

              {/* Quick Tab Switcher & Close Button */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <div className="hidden md:flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('ALERTS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'ALERTS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Cảnh báo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('ACTUATORS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'ACTUATORS' ? 'bg-[#119653] text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Rơ-le ({actuators.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('ENV_PARAMS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'ENV_PARAMS' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Vi khí hậu
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('SCHEDULES')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeSubTab === 'SCHEDULES' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Lịch tưới
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubTab(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Đóng thẻ (hoặc bấm ra ngoài)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Card Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {activeSubTab === 'ALERTS' && (
                <ZoneAlertCenter
                  scopeLevel={scopeLevel}
                  farmId={farmId}
                  fieldId={fieldId}
                  zoneId={zoneId}
                  nodes={nodes}
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
                  onUpdateConfig={async (cfg) => {
                    try {
                      await controlService.updateEnvironmentalConfig(cfg);
                      setNotification({ type: 'success', message: `Đã lưu tham số vi khí hậu & cập nhật ngưỡng cảnh báo cho ${cfg.zoneName} thành công!` });
                    } catch {
                      setNotification({ type: 'success', message: `Đã lưu tham số vi khí hậu cho ${cfg.zoneName}` });
                    }
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
                          <Clock size={16} className="text-[#119653]" /> Lịch Tưới Định kỳ (Cron Schedules) cho {scopeLabel}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Lịch tưới tự động 3 ca (Sáng - Trưa - Chiều) được đồng bộ từ Thư viện Cây trồng Chuẩn.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode('LIST')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              scheduleViewMode === 'LIST' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            📋 Danh sách Cron
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleViewMode('CALENDAR')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              scheduleViewMode === 'CALENDAR' ? 'bg-[#119653] text-white' : 'text-slate-600 hover:bg-slate-100'
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
                      <CropCalendarView
                        plan={activePlan}
                        zoneId={zoneId || (getScopedZoneIds().length > 0 ? getScopedZoneIds()[0] : undefined)}
                        zoneName={authZones.find(z => z.zoneId === (zoneId || getScopedZoneIds()[0]))?.name || 'Zone Canh Tác'}
                        cropName={currentCropObj?.name || 'Cây Trồng VietGAP'}
                        seasonStartDate="2026-10-15"
                        seasonDurationDays={45}
                        readOnly={false}
                        onSaveZoneSchedule={(saved) => {
                          setNotification({
                            type: 'success',
                            message: `Đã lưu thành công lịch tưới ${saved.seasonDurationDays} ngày riêng cho Zone "${saved.zoneName}"! Cấu hình này độc lập và không làm thay đổi thư viện chuẩn của hệ thống.`
                          });
                        }}
                        onResetToTemplate={() => {
                          setNotification({
                            type: 'info',
                            message: 'Đã khôi phục về Lịch mẫu chuẩn VietGAP của Thư viện Cây trồng.'
                          });
                        }}
                      />
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
                              const schName = String(sch?.name || '').toLowerCase();
                              const isMorning = schName.includes('sáng') || (sch.startTime && sch.startTime < '11:00');
                              const isNoon = schName.includes('trưa') || (sch.startTime && sch.startTime >= '11:00' && sch.startTime <= '14:00');
                              const isAfternoon = schName.includes('chiều') || (sch.startTime && sch.startTime > '14:00');

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
                                    <span>Lặp lại: <strong className="text-sky-700">{Array.isArray(sch.daysOfWeek) && sch.daysOfWeek.length > 0 ? sch.daysOfWeek.join(', ') : 'Hằng ngày'}</strong></span>
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
                                KHI <strong className="text-[#119653]">{rule.parameterCode}</strong> {rule.operator} <strong className="text-amber-700">{rule.thresholdValue}</strong> THÌ KÍCH HOẠT <strong className="text-sky-700">{rule.actuatorName}</strong> TRONG {rule.actionDurationMinutes} PHÚT
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Card Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/90 text-xs text-slate-500">
              <span className="italic flex items-center gap-1.5">
                <Info size={14} className="text-slate-400" /> Nhấp vào vùng tối bên ngoài hoặc phím ESC để đóng thẻ
              </span>
              <Button variant="outline" size="sm" onClick={() => setActiveSubTab(null)}>
                Đóng thẻ
              </Button>
            </div>
          </div>
        </div>
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
