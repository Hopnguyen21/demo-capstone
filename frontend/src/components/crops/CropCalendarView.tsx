import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Sun, Sunrise, Sunset, Clock, Droplets, 
  Sparkles, Check, Info, ShieldCheck, RefreshCw, Save, RotateCcw,
  Sliders, ChevronRight, Layers, ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { CalendarIrrigationPlan, IrrigationSession } from '../../types';

export interface ZoneCustomDayOverride {
  dayNumber: number;
  date: string;
  stageName: string;
  sessions: IrrigationSession[];
  isCustomized: boolean;
}

export interface ZoneCustomScheduleData {
  zoneId: string;
  zoneName: string;
  cropName: string;
  seasonStartDate: string;
  seasonDurationDays: number;
  dayOverrides: Record<number, IrrigationSession[]>;
  lastSavedAt: string;
}

interface CropCalendarViewProps {
  plan: CalendarIrrigationPlan;
  onChangePlan?: (updated: CalendarIrrigationPlan) => void;
  readOnly?: boolean;

  // New Zone Season Properties
  zoneId?: string;
  zoneName?: string;
  cropName?: string;
  seasonStartDate?: string;    // e.g. '2026-10-15'
  seasonDurationDays?: number; // e.g. 45
  onSaveZoneSchedule?: (savedData: ZoneCustomScheduleData) => void;
  onResetToTemplate?: () => void;
}

export const CropCalendarView: React.FC<CropCalendarViewProps> = ({
  plan,
  onChangePlan,
  readOnly = false,
  zoneId,
  zoneName = 'Zone 1',
  cropName = 'Dưa leo Baby VietGAP',
  seasonStartDate = '2026-10-15',
  seasonDurationDays = 45,
  onSaveZoneSchedule,
  onResetToTemplate,
}) => {
  // Season configuration state
  const [startDateStr, setStartDateStr] = useState<string>(seasonStartDate);
  const [totalDays, setTotalDays] = useState<number>(seasonDurationDays);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'SETTINGS'>('CALENDAR');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [dayOverrides, setDayOverrides] = useState<Record<number, IrrigationSession[]>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load any previously saved custom schedule for this Zone from localStorage
  useEffect(() => {
    if (zoneId) {
      try {
        const stored = localStorage.getItem(`smartfarm_zone_custom_schedule_${zoneId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ZoneCustomScheduleData;
          if (parsed.dayOverrides) setDayOverrides(parsed.dayOverrides);
          if (parsed.seasonDurationDays) setTotalDays(parsed.seasonDurationDays);
          if (parsed.seasonStartDate) setStartDateStr(parsed.seasonStartDate);
        }
      } catch (err) {
        console.warn('Error reading zone custom schedule from localStorage:', err);
      }
    }
  }, [zoneId]);

  // Determine stage name & progress for any day number (1 to totalDays)
  const getStageInfo = (dayNum: number, maxDays: number) => {
    const p = dayNum / maxDays;
    if (p <= 0.22) {
      return {
        id: 'STAGE_1',
        name: 'Giai đoạn 1: Cây con & Hồi xanh',
        shortName: 'Cây con',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotColor: 'bg-emerald-500',
        rangeText: `Ngày 1 - Ngày ${Math.max(1, Math.round(maxDays * 0.22))}`,
      };
    }
    if (p <= 0.50) {
      return {
        id: 'STAGE_2',
        name: 'Giai đoạn 2: Phát triển thân lá',
        shortName: 'Thân lá',
        color: 'bg-sky-100 text-sky-800 border-sky-300',
        dotColor: 'bg-sky-500',
        rangeText: `Ngày ${Math.round(maxDays * 0.22) + 1} - Ngày ${Math.round(maxDays * 0.50)}`,
      };
    }
    if (p <= 0.78) {
      return {
        id: 'STAGE_3',
        name: 'Giai đoạn 3: Ra hoa & Đậu trái',
        shortName: 'Ra hoa',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
        dotColor: 'bg-amber-500',
        rangeText: `Ngày ${Math.round(maxDays * 0.50) + 1} - Ngày ${Math.round(maxDays * 0.78)}`,
      };
    }
    return {
      id: 'STAGE_4',
      name: 'Giai đoạn 4: Nuôi trái & Thu hoạch',
      shortName: 'Thu hoạch',
      color: 'bg-rose-100 text-rose-800 border-rose-300',
      dotColor: 'bg-rose-500',
      rangeText: `Ngày ${Math.round(maxDays * 0.78) + 1} - Ngày ${maxDays}`,
    };
  };

  // Generate list of days from Day 1 to Day totalDays
  const seasonDays = useMemo(() => {
    const list = [];
    const baseDate = new Date(startDateStr);
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(validBase.getTime() + (i - 1) * 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayOfWeek = dayNames[d.getDay()];

      const stage = getStageInfo(i, totalDays);

      list.push({
        dayNumber: i,
        date: isoDate,
        displayDate: `${dd}/${mm}`,
        fullDateText: `${dd}/${mm}/${yyyy}`,
        dayOfWeek,
        isToday: isoDate === todayStr,
        isPast: isoDate < todayStr,
        stage,
        isCustomized: Boolean(dayOverrides[i]),
      });
    }
    return list;
  }, [startDateStr, totalDays, dayOverrides]);

  // Calculate today's day number in season if within range
  const todayDayItem = seasonDays.find(d => d.isToday);

  // Helper to fetch sessions for a given day (with fallback to plan defaults)
  const getSessionForDay = (day: number, type: 'MORNING' | 'NOON' | 'AFTERNOON'): IrrigationSession => {
    if (dayOverrides[day]) {
      const override = dayOverrides[day].find(s => s.session === type);
      if (override) return override;
    }
    const found = plan.sessions.find(s => s.session === type);
    if (found) return found;
    
    const defaults: Record<string, { title: string; startTime: string; durationMinutes: number; volumeMl: number }> = {
      MORNING: { title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500 },
      NOON: { title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300 },
      AFTERNOON: { title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400 },
    };
    return {
      session: type,
      title: defaults[type].title,
      startTime: defaults[type].startTime,
      durationMinutes: defaults[type].durationMinutes,
      volumeMl: defaults[type].volumeMl,
      enabled: type !== 'NOON',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
  };

  // Update session for a single day
  const handleUpdateDaySession = (day: number, sessionType: 'MORNING' | 'NOON' | 'AFTERNOON', updates: Partial<IrrigationSession>) => {
    if (readOnly) return;
    
    setDayOverrides(prev => {
      const currentDaySessions = prev[day] || [
        getSessionForDay(day, 'MORNING'),
        getSessionForDay(day, 'NOON'),
        getSessionForDay(day, 'AFTERNOON')
      ];
      
      const newSessions = currentDaySessions.map(s => 
        s.session === sessionType ? { ...s, ...updates } : s
      );

      return { ...prev, [day]: newSessions };
    });
  };

  // Batch action: Apply current selected day's settings to all days in its current growth stage
  const handleApplyToStage = () => {
    if (readOnly) return;
    const stage = getStageInfo(selectedDay, totalDays);
    const daySessions = [
      getSessionForDay(selectedDay, 'MORNING'),
      getSessionForDay(selectedDay, 'NOON'),
      getSessionForDay(selectedDay, 'AFTERNOON'),
    ];

    setDayOverrides(prev => {
      const next = { ...prev };
      seasonDays.forEach(d => {
        if (d.stage.id === stage.id) {
          next[d.dayNumber] = JSON.parse(JSON.stringify(daySessions));
        }
      });
      return next;
    });

    setSaveSuccessMsg(`Đã sao chép cấu hình Ngày ${selectedDay} cho toàn bộ ${stage.name}!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Batch action: Apply to all days of the entire season (e.g. all 45 days)
  const handleApplyToAllDays = () => {
    if (readOnly) return;
    const daySessions = [
      getSessionForDay(selectedDay, 'MORNING'),
      getSessionForDay(selectedDay, 'NOON'),
      getSessionForDay(selectedDay, 'AFTERNOON'),
    ];

    setDayOverrides(prev => {
      const next = { ...prev };
      for (let i = 1; i <= totalDays; i++) {
        next[i] = JSON.parse(JSON.stringify(daySessions));
      }
      return next;
    });

    setSaveSuccessMsg(`Đã áp dụng lịch tưới Ngày ${selectedDay} cho tất cả ${totalDays} ngày của mùa vụ!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Reset a specific day back to master template
  const handleResetDay = (day: number) => {
    if (readOnly) return;
    setDayOverrides(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  // Save the entire customized schedule for this Zone
  const handleSaveZoneCustomSchedule = () => {
    const scheduleData: ZoneCustomScheduleData = {
      zoneId: zoneId || 'default-zone',
      zoneName,
      cropName,
      seasonStartDate: startDateStr,
      seasonDurationDays: totalDays,
      dayOverrides,
      lastSavedAt: new Date().toISOString(),
    };

    if (zoneId) {
      try {
        localStorage.setItem(`smartfarm_zone_custom_schedule_${zoneId}`, JSON.stringify(scheduleData));
      } catch (err) {
        console.warn('Could not persist to localStorage:', err);
      }
    }

    if (onSaveZoneSchedule) {
      onSaveZoneSchedule(scheduleData);
    }

    setSaveSuccessMsg(`Đã lưu thành công lịch tưới ${totalDays} ngày riêng cho Zone "${zoneName}"! Hệ thống mẫu gốc hoàn toàn được bảo toàn.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Reset all zone overrides back to system standard template
  const handleResetToSystemTemplate = () => {
    if (!confirm(`Bạn có chắc chắn muốn khôi phục Lịch tưới của Zone "${zoneName}" về chuẩn mặc định của Thư viện Cây trồng? Tất cả tùy chỉnh riêng của bạn sẽ được đặt lại.`)) {
      return;
    }

    setDayOverrides({});
    if (zoneId) {
      localStorage.removeItem(`smartfarm_zone_custom_schedule_${zoneId}`);
    }
    if (onResetToTemplate) {
      onResetToTemplate();
    }
    setSaveSuccessMsg(`Đã khôi phục về Lịch mẫu chuẩn VietGAP của hệ thống!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Filtered days based on stage filter
  const visibleDays = useMemo(() => {
    if (selectedStageFilter === 'ALL') return seasonDays;
    return seasonDays.filter(d => d.stage.id === selectedStageFilter);
  }, [seasonDays, selectedStageFilter]);

  const selectedDayInfo = seasonDays.find(d => d.dayNumber === selectedDay) || seasonDays[0];
  const morning = getSessionForDay(selectedDay, 'MORNING');
  const noon = getSessionForDay(selectedDay, 'NOON');
  const afternoon = getSessionForDay(selectedDay, 'AFTERNOON');

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-semibold text-emerald-950 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#119653]" />
            {saveSuccessMsg}
          </span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-4.5 rounded-3xl border border-emerald-200/90 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#119653] to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
              <CalendarIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm md:text-base font-bold text-slate-900">
                  Cuốn Lịch Tưới 3 Ca Vụ Mùa ({totalDays} Ngày Canh Tác)
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                  {cropName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hiển thị tiến trình <strong>Ngày 1 đến Ngày {totalDays}</strong> kể từ ngày bắt đầu vụ ({seasonDays[0]?.displayDate} ➔ {seasonDays[seasonDays.length - 1]?.displayDate}).
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={handleResetToSystemTemplate}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Đặt lại về mẫu chuẩn ban đầu của hệ thống"
                >
                  <RotateCcw size={13} /> Khôi phục Chuẩn Gốc
                </button>
                <button
                  type="button"
                  onClick={handleSaveZoneCustomSchedule}
                  className="px-3.5 py-1.5 rounded-xl bg-[#119653] hover:bg-[#0e8046] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Save size={14} /> Lưu Lịch Riêng Cho Zone
                </button>
              </>
            )}
          </div>
        </div>

        {/* Season Parameters & Zone Isolation Guarantee Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-emerald-100 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Bắt đầu vụ:</span>
              <input
                type="date"
                value={startDateStr}
                disabled={readOnly}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Thời gian vụ:</span>
              <input
                type="number"
                min={15}
                max={180}
                value={totalDays}
                disabled={readOnly}
                onChange={(e) => setTotalDays(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white text-center text-slate-800 font-bold"
              />
              <span className="font-semibold text-slate-600">ngày</span>
            </div>
            {todayDayItem && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-[#119653] font-bold border border-emerald-200 flex items-center gap-1">
                <Sparkles size={12} /> Hôm nay: Ngày {todayDayItem.dayNumber}/{totalDays} ({todayDayItem.stage.shortName})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
            <ShieldCheck size={13} className="text-[#119653]" />
            <span>Tùy chỉnh riêng cho <strong>{zoneName}</strong> • Không thay đổi thư viện gốc</span>
          </div>
        </div>
      </div>

      {/* 4 Growth Stages Timeline Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {[
          { id: 'STAGE_1', name: 'Giai đoạn 1', title: 'Cây con & Hồi xanh', days: `Ngày 1 - Ngày ${Math.max(1, Math.round(totalDays * 0.22))}`, color: 'border-emerald-300 bg-emerald-50/60 text-emerald-900' },
          { id: 'STAGE_2', name: 'Giai đoạn 2', title: 'Phát triển thân lá', days: `Ngày ${Math.round(totalDays * 0.22) + 1} - Ngày ${Math.round(totalDays * 0.50)}`, color: 'border-sky-300 bg-sky-50/60 text-sky-900' },
          { id: 'STAGE_3', name: 'Giai đoạn 3', title: 'Ra hoa & Đậu quả', days: `Ngày ${Math.round(totalDays * 0.50) + 1} - Ngày ${Math.round(totalDays * 0.78)}`, color: 'border-amber-300 bg-amber-50/60 text-amber-900' },
          { id: 'STAGE_4', name: 'Giai đoạn 4', title: 'Nuôi trái & Thu hoạch', days: `Ngày ${Math.round(totalDays * 0.78) + 1} - Ngày ${totalDays}`, color: 'border-rose-300 bg-rose-50/60 text-rose-900' },
        ].map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setSelectedStageFilter(selectedStageFilter === st.id ? 'ALL' : st.id)}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedStageFilter === st.id ? 'ring-2 ring-emerald-500 shadow-xs' : 'opacity-90 hover:opacity-100'
            } ${st.color}`}
          >
            <div className="flex items-center justify-between font-bold text-[11px]">
              <span>{st.name}</span>
              <span className="font-mono text-[10px] opacity-80">{st.days}</span>
            </div>
            <div className="font-bold text-xs mt-0.5 truncate">{st.title}</div>
          </button>
        ))}
      </div>

      {/* Filter and View mode bar */}
      <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-semibold">Lọc xem:</span>
          <button
            type="button"
            onClick={() => setSelectedStageFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              selectedStageFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalDays} ngày)
          </button>
          {todayDayItem && (
            <button
              type="button"
              onClick={() => {
                setSelectedDay(todayDayItem.dayNumber);
                setSelectedStageFilter('ALL');
              }}
              className="px-2.5 py-1 rounded-lg font-bold bg-emerald-100 text-[#119653] hover:bg-emerald-200 border border-emerald-300 transition-all flex items-center gap-1"
            >
              📍 Nhảy đến Hôm nay (Ngày {todayDayItem.dayNumber})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Sáng</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Trưa</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Chiều</span>
          <span className="flex items-center gap-1 ml-1"><span className="w-2 h-2 rounded-full bg-[#119653]"></span> Tùy biến</span>
        </div>
      </div>

      {/* The 45 Days Grid (Hiển thị Ngày 1 đến Ngày 45 kể từ ngày bắt đầu) */}
      <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
        <div className="bg-gradient-to-r from-emerald-700 via-[#119653] to-teal-700 px-4 py-2.5 text-white flex items-center justify-between text-xs">
          <span className="font-bold flex items-center gap-2">
            <Sparkles size={14} className="text-amber-200" />
            LƯỚI LỊCH TƯỚI {totalDays} NGÀY VỤ MÙA — {cropName.toUpperCase()}
          </span>
          <span className="text-[11px] opacity-90 font-mono font-medium">
            Đang hiển thị {visibleDays.length} / {totalDays} ngày
          </span>
        </div>

        {/* Dynamic Days Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1.5 p-3 bg-slate-50/50 max-h-[380px] overflow-y-auto">
          {visibleDays.map((d) => {
            const isSelected = selectedDay === d.dayNumber;
            const morningS = getSessionForDay(d.dayNumber, 'MORNING');
            const noonS = getSessionForDay(d.dayNumber, 'NOON');
            const afternoonS = getSessionForDay(d.dayNumber, 'AFTERNOON');

            return (
              <div
                key={d.dayNumber}
                onClick={() => setSelectedDay(d.dayNumber)}
                className={`min-h-[72px] p-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between relative border ${
                  isSelected
                    ? 'bg-emerald-100/80 border-[#119653] ring-2 ring-emerald-400 z-10 shadow-sm'
                    : d.isToday
                    ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-white hover:bg-slate-100/80 border-slate-200/80'
                }`}
              >
                {/* Top indicator: Customized star or Today badge */}
                {d.isCustomized && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#119653] ring-1 ring-white" title="Ngày đã tùy biến riêng"></span>
                )}
                {d.isToday && !d.isCustomized && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Hôm nay"></span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black block ${d.isToday ? 'text-amber-800' : 'text-slate-900'}`}>
                      Ngày {d.dayNumber}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {d.displayDate} ({d.dayOfWeek})
                  </span>
                </div>

                {/* Session indicators (Sáng - Trưa - Chiều) */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-1">
                    {morningS.enabled && (
                      <span title={`Sáng: ${morningS.startTime} (${morningS.durationMinutes}p)`} className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    )}
                    {noonS.enabled && (
                      <span title={`Trưa: ${noonS.startTime} (${noonS.durationMinutes}p)`} className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    )}
                    {afternoonS.enabled && (
                      <span title={`Chiều: ${afternoonS.startTime} (${afternoonS.durationMinutes}p)`} className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    )}
                  </div>
                  <span className={`text-[9px] font-semibold px-1 rounded ${d.stage.color.split(' ')[0]}`}>
                    {d.stage.shortName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail & Editing Control Panel */}
      {selectedDayInfo && (
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-[#119653]">
                <Clock size={16} />
              </span>
              <div>
                <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  Chi tiết Lịch Tưới Ngày {selectedDayInfo.dayNumber} ({selectedDayInfo.fullDateText} - {selectedDayInfo.dayOfWeek})
                  {selectedDayInfo.isToday && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                      HÔM NAY
                    </span>
                  )}
                  {selectedDayInfo.isCustomized && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                      ĐÃ TÙY BIẾN
                    </span>
                  )}
                </h5>
                <p className="text-[11px] text-slate-500">
                  {selectedDayInfo.stage.name} ({selectedDayInfo.stage.rangeText})
                </p>
              </div>
            </div>

            {/* Quick Batch Actions for this Day */}
            {!readOnly && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleApplyToStage}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer"
                  title="Sao chép cấu hình ngày này cho toàn bộ giai đoạn hiện tại"
                >
                  ⚡ Áp dụng cho cả Giai đoạn này
                </button>
                <button
                  type="button"
                  onClick={handleApplyToAllDays}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
                  title="Sao chép cấu hình ngày này cho tất cả các ngày của mùa vụ"
                >
                  Áp dụng cả Vụ ({totalDays} ngày)
                </button>
                {selectedDayInfo.isCustomized && (
                  <button
                    type="button"
                    onClick={() => handleResetDay(selectedDayInfo.dayNumber)}
                    className="px-2 py-1 text-[11px] font-medium rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  >
                    Bỏ tùy biến
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3 Sessions Cards for the Selected Day */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            {/* Morning Session */}
            <div className={`p-3 rounded-xl border transition-all ${morning.enabled ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between font-bold text-amber-900 mb-2.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={morning.enabled} 
                    disabled={readOnly}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { enabled: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <Sunrise size={15} className="text-amber-600" /> Ca Sáng (Khởi động)
                </label>
                <input
                  type="time"
                  value={morning.startTime}
                  disabled={readOnly || !morning.enabled}
                  onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { startTime: e.target.value })}
                  className="text-[11px] bg-white border border-amber-300 text-amber-950 font-bold px-1.5 py-0.5 rounded outline-none font-mono"
                />
              </div>
              <div className="text-[11px] text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Thời lượng tưới:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1} max={180}
                      value={morning.durationMinutes}
                      disabled={readOnly || !morning.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { durationMinutes: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>phút</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Liều lượng nước:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={50}
                      value={morning.volumeMl || 500}
                      disabled={readOnly || !morning.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { volumeMl: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>ml/gốc</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Noon Session */}
            <div className={`p-3 rounded-xl border transition-all ${noon.enabled ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between font-bold text-rose-900 mb-2.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={noon.enabled} 
                    disabled={readOnly}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { enabled: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                  />
                  <Sun size={15} className="text-rose-600" /> Ca Trưa (Hạ nhiệt)
                </label>
                <input
                  type="time"
                  value={noon.startTime}
                  disabled={readOnly || !noon.enabled}
                  onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { startTime: e.target.value })}
                  className="text-[11px] bg-white border border-rose-300 text-rose-950 font-bold px-1.5 py-0.5 rounded outline-none font-mono"
                />
              </div>
              <div className="text-[11px] text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Thời lượng tưới:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1} max={180}
                      value={noon.durationMinutes}
                      disabled={readOnly || !noon.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { durationMinutes: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>phút</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Liều lượng nước:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={50}
                      value={noon.volumeMl || 300}
                      disabled={readOnly || !noon.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { volumeMl: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>ml/gốc</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Afternoon Session */}
            <div className={`p-3 rounded-xl border transition-all ${afternoon.enabled ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
              <div className="flex items-center justify-between font-bold text-indigo-900 mb-2.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={afternoon.enabled} 
                    disabled={readOnly}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { enabled: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <Sunset size={15} className="text-indigo-600" /> Ca Chiều (Bổ sung)
                </label>
                <input
                  type="time"
                  value={afternoon.startTime}
                  disabled={readOnly || !afternoon.enabled}
                  onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { startTime: e.target.value })}
                  className="text-[11px] bg-white border border-indigo-300 text-indigo-950 font-bold px-1.5 py-0.5 rounded outline-none font-mono"
                />
              </div>
              <div className="text-[11px] text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Thời lượng tưới:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1} max={180}
                      value={afternoon.durationMinutes}
                      disabled={readOnly || !afternoon.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { durationMinutes: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>phút</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Liều lượng nước:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={50}
                      value={afternoon.volumeMl || 400}
                      disabled={readOnly || !afternoon.enabled}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { volumeMl: Number(e.target.value) })}
                      className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs bg-white font-bold text-slate-800"
                    />
                    <span>ml/gốc</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
