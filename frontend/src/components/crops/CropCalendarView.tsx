import React, { useState } from 'react';
import { Calendar as CalendarIcon, Sun, Sunrise, Sunset, Clock, Droplets, Sparkles, Check, Info } from 'lucide-react';
import { CalendarIrrigationPlan, IrrigationSession } from '../../types';

interface CropCalendarViewProps {
  plan: CalendarIrrigationPlan;
  onChangePlan?: (updated: CalendarIrrigationPlan) => void;
  readOnly?: boolean;
}

export const CropCalendarView: React.FC<CropCalendarViewProps> = ({
  plan,
  onChangePlan,
  readOnly = false,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'SETTINGS'>('CALENDAR');
  const [dayOverrides, setDayOverrides] = useState<Record<number, IrrigationSession[]>>({});

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

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

  const handleUpdateGlobalSession = (sessionType: 'MORNING' | 'NOON' | 'AFTERNOON', updates: Partial<IrrigationSession>) => {
    if (readOnly || !onChangePlan) return;
    const existingSessions = [...plan.sessions];
    const index = existingSessions.findIndex(s => s.session === sessionType);
    
    if (index !== -1) {
      existingSessions[index] = { ...existingSessions[index], ...updates };
    } else {
      const base = getSessionForDay(1, sessionType);
      existingSessions.push({ ...base, ...updates });
    }

    onChangePlan({
      ...plan,
      sessions: existingSessions,
    });
  };

  const morning = getSessionForDay(selectedDay, 'MORNING');
  const noon = getSessionForDay(selectedDay, 'NOON');
  const afternoon = getSessionForDay(selectedDay, 'AFTERNOON');

  const globalMorning = plan.sessions.find(s => s.session === 'MORNING') || getSessionForDay(1, 'MORNING');
  const globalNoon = plan.sessions.find(s => s.session === 'NOON') || getSessionForDay(1, 'NOON');
  const globalAfternoon = plan.sessions.find(s => s.session === 'AFTERNOON') || getSessionForDay(1, 'AFTERNOON');

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between bg-emerald-50/80 p-3 rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-emerald-700" size={18} />
          <div>
            <h4 className="text-xs font-bold text-emerald-950">Lịch Tưới Vi Khí Hậu 3 Ca (Cuốn Lịch Tùy Chỉnh)</h4>
            <p className="text-[11px] text-emerald-700">Tự động đồng bộ Lịch Sáng - Trưa - Chiều vào Rơ-le của Owner</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              activeTab === 'CALENDAR' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🗓️ Cuốn Lịch Chi Tiết
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
              activeTab === 'SETTINGS' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ⚙️ Cấu Hình Khung Giờ
          </button>
        </div>
      </div>

      {activeTab === 'CALENDAR' && (
        <div className="space-y-4">
          {/* Calendar visual grid styled exactly like traditional Vietnamese wall calendar (Screenshot #3) */}
          <div className="border border-rose-200 rounded-xl overflow-hidden shadow-xs bg-rose-50/30">
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 px-4 py-2.5 text-white flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-2">
                <Sparkles size={14} className="text-amber-200" /> THÁNG 10 / 2026 - LỊCH NÔNG NGHIỆP VIỆTGAP
              </span>
              <span className="text-[11px] opacity-90 font-medium">Tưới Sáng - Trưa - Chiều</span>
            </div>

            {/* Days Grid Header */}
            <div className="grid grid-cols-7 text-center font-bold text-[11px] bg-rose-100/80 text-rose-900 border-b border-rose-200 py-1.5">
              <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span className="text-rose-600">CN</span>
            </div>

            {/* Grid Days */}
            <div className="grid grid-cols-7 gap-px bg-rose-200/60 p-px">
              {daysInMonth.map((d) => {
                const isSelected = selectedDay === d;
                const isWeekend = d % 7 === 0 || d % 7 === 6;

                const dayMorning = getSessionForDay(d, 'MORNING');
                const dayNoon = getSessionForDay(d, 'NOON');
                const dayAfternoon = getSessionForDay(d, 'AFTERNOON');

                return (
                  <div
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`min-h-[58px] p-1.5 transition-all cursor-pointer flex flex-col justify-between relative ${
                      isSelected
                        ? 'bg-rose-100 ring-2 ring-rose-500 z-10 font-bold'
                        : 'bg-white hover:bg-rose-50/60'
                    }`}
                  >
                    {/* Top right red indicator star/dot */}
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500"></span>

                    <div>
                      <span className={`text-sm font-bold block ${isWeekend ? 'text-rose-600' : 'text-slate-800'}`}>
                        {d}
                      </span>
                    </div>

                    {/* Session dots */}
                    <div className="flex items-center gap-1 pt-1">
                      {dayMorning.enabled && (
                        <span title={`Sáng: ${dayMorning.startTime} (${dayMorning.durationMinutes} phút)`} className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      )}
                      {dayNoon.enabled && (
                        <span title={`Trưa: ${dayNoon.startTime} (${dayNoon.durationMinutes} phút)`} className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      )}
                      {dayAfternoon.enabled && (
                        <span title={`Chiều: ${dayAfternoon.startTime} (${dayAfternoon.durationMinutes} phút)`} className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day summary card */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                🗓️ Chi tiết Lịch tưới Ngày {selectedDay}/10/2026
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                Đồng bộ tự động với Rơ-le Zone
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              {/* Morning */}
              <div className={`p-2.5 rounded-lg border transition-all ${morning.enabled ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between font-bold text-amber-900 mb-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={morning.enabled} 
                      disabled={readOnly}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { enabled: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3"
                    />
                    <Sunrise size={14} className="text-amber-600" /> Ca Sáng
                  </label>
                  <input
                    type="time"
                    value={morning.startTime}
                    disabled={readOnly || !morning.enabled}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { startTime: e.target.value })}
                    className="text-[10px] bg-white border border-amber-200 text-amber-900 px-1 py-0.5 rounded outline-none"
                  />
                </div>
                <div className="text-[11px] text-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Thời lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1} max={180}
                        value={morning.durationMinutes}
                        disabled={readOnly || !morning.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { durationMinutes: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>phút</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Liều lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={50}
                        value={morning.volumeMl || 500}
                        disabled={readOnly || !morning.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'MORNING', { volumeMl: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>ml</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Noon */}
              <div className={`p-2.5 rounded-lg border transition-all ${noon.enabled ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between font-bold text-rose-900 mb-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={noon.enabled} 
                      disabled={readOnly}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { enabled: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500 w-3 h-3"
                    />
                    <Sun size={14} className="text-rose-600" /> Ca Trưa
                  </label>
                  <input
                    type="time"
                    value={noon.startTime}
                    disabled={readOnly || !noon.enabled}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { startTime: e.target.value })}
                    className="text-[10px] bg-white border border-rose-200 text-rose-900 px-1 py-0.5 rounded outline-none"
                  />
                </div>
                <div className="text-[11px] text-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Thời lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1} max={180}
                        value={noon.durationMinutes}
                        disabled={readOnly || !noon.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { durationMinutes: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>phút</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Liều lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={50}
                        value={noon.volumeMl || 300}
                        disabled={readOnly || !noon.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'NOON', { volumeMl: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>ml</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Afternoon */}
              <div className={`p-2.5 rounded-lg border transition-all ${afternoon.enabled ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between font-bold text-indigo-900 mb-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={afternoon.enabled} 
                      disabled={readOnly}
                      onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { enabled: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                    />
                    <Sunset size={14} className="text-indigo-600" /> Ca Chiều
                  </label>
                  <input
                    type="time"
                    value={afternoon.startTime}
                    disabled={readOnly || !afternoon.enabled}
                    onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { startTime: e.target.value })}
                    className="text-[10px] bg-white border border-indigo-200 text-indigo-900 px-1 py-0.5 rounded outline-none"
                  />
                </div>
                <div className="text-[11px] text-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Thời lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1} max={180}
                        value={afternoon.durationMinutes}
                        disabled={readOnly || !afternoon.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { durationMinutes: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>phút</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Liều lượng:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={50}
                        value={afternoon.volumeMl || 400}
                        disabled={readOnly || !afternoon.enabled}
                        onChange={(e) => handleUpdateDaySession(selectedDay, 'AFTERNOON', { volumeMl: Number(e.target.value) })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-[10px] bg-white"
                      />
                      <span>ml</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div className="space-y-3">
          {/* Session Morning Config */}
          <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <div className="flex items-center gap-2">
                <Sunrise className="text-amber-600" size={18} />
                <div>
                  <h5 className="font-bold text-xs text-slate-900">1. Khung Giờ Tưới Sáng (Morning Session)</h5>
                  <p className="text-[11px] text-slate-500">Cấp ẩm chính ban sáng khởi động chu kỳ quang hợp</p>
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={globalMorning.enabled}
                  disabled={readOnly}
                  onChange={(e) => handleUpdateGlobalSession('MORNING', { enabled: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                Kích hoạt
              </label>
            </div>

            {globalMorning.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={globalMorning.startTime}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('MORNING', { startTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={globalMorning.durationMinutes}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('MORNING', { durationMinutes: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thể tích (ml/gốc)</label>
                  <input
                    type="number"
                    step={50}
                    value={globalMorning.volumeMl || 500}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('MORNING', { volumeMl: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Session Noon Config */}
          <div className="p-3 bg-white border border-rose-200 rounded-xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <div className="flex items-center gap-2">
                <Sun className="text-rose-600" size={18} />
                <div>
                  <h5 className="font-bold text-xs text-slate-900">2. Khung Giờ Tưới Trưa (Noon Session)</h5>
                  <p className="text-[11px] text-slate-500">Tưới dằn nhiệt & làm mát tán cây vào giờ cao điểm nắng nóng</p>
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={globalNoon.enabled}
                  disabled={readOnly}
                  onChange={(e) => handleUpdateGlobalSession('NOON', { enabled: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                Kích hoạt
              </label>
            </div>

            {globalNoon.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={globalNoon.startTime}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('NOON', { startTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={globalNoon.durationMinutes}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('NOON', { durationMinutes: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thể tích (ml/gốc)</label>
                  <input
                    type="number"
                    step={50}
                    value={globalNoon.volumeMl || 300}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('NOON', { volumeMl: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Session Afternoon Config */}
          <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <div className="flex items-center gap-2">
                <Sunset className="text-indigo-600" size={18} />
                <div>
                  <h5 className="font-bold text-xs text-slate-900">3. Khung Giờ Tưới Chiều (Afternoon Session)</h5>
                  <p className="text-[11px] text-slate-500">Bổ sung độ ẩm tích trữ ban đêm trước khi mặt trời lặn</p>
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={globalAfternoon.enabled}
                  disabled={readOnly}
                  onChange={(e) => handleUpdateGlobalSession('AFTERNOON', { enabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Kích hoạt
              </label>
            </div>

            {globalAfternoon.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={globalAfternoon.startTime}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('AFTERNOON', { startTime: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={globalAfternoon.durationMinutes}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('AFTERNOON', { durationMinutes: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Thể tích (ml/gốc)</label>
                  <input
                    type="number"
                    step={50}
                    value={globalAfternoon.volumeMl || 400}
                    disabled={readOnly}
                    onChange={(e) => handleUpdateGlobalSession('AFTERNOON', { volumeMl: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
