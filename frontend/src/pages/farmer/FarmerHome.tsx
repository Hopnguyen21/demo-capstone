import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { alertService, farmerService, supportService, telemetryService, controlService } from '../../services';
import { Alert, Zone } from '../../types';
import { Button, Modal } from '../../components/ui/BaseUI';
import { dueLabel, DUE_TONE_CLASS as TONE } from '../../utils/dueLabel';
import { zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';
import { mockWeather } from '../../mocks/mockData';
import {
  Sprout, CheckSquare, ShieldAlert, Power, ClipboardList, Gauge,
  AlertTriangle, CheckCircle2, Clock, MapPin, Calendar, Droplets,
  Thermometer, Sun, CloudRain, Wind, Play, Send, ChevronRight,
  Sparkles, RefreshCw, Layers, ShieldCheck, Zap, Info, Search
} from 'lucide-react';

interface ZoneMetrics {
  soil?: { value: number; unit: string };
  temp?: { value: number; unit: string };
  humidity?: { value: number; unit: string };
  ph?: { value: number; unit: string };
  fresh: boolean;
  loaded: boolean;
}

export const FarmerHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedFarmId, farms: authFarms } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readings, setReadings] = useState<Record<string, ZoneMetrics>>({});
  const [weatherData, setWeatherData] = useState<any>(null);
  const [taskFilter, setTaskFilter] = useState<'TODO' | 'REVIEW' | 'DONE' | 'ALL'>('TODO');
  const [zoneSearch, setZoneSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Action Modal: Nộp kết quả công việc
  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const [resultNotes, setResultNotes] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [taskFeedback, setTaskFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quick Action Modal: Tưới thủ công nhanh
  const [isIrrigationModalOpen, setIsIrrigationModalOpen] = useState(false);
  const [selectedIrrigationZoneId, setSelectedIrrigationZoneId] = useState<string>('');
  const [zoneActuators, setZoneActuators] = useState<any[]>([]);
  const [selectedActuatorId, setSelectedActuatorId] = useState<string>('');
  const [irrigationMinutes, setIrrigationMinutes] = useState<number>(5);
  const [isActuatorBusy, setIsActuatorBusy] = useState(false);
  const [irrigationSuccessMessage, setIrrigationSuccessMessage] = useState<string | null>(null);

  const farmId = selectedFarmId || (user as any)?.farmId || '30000000-0000-0000-0000-000000000001';
  const currentFarm = authFarms.find(f => f.farmId === farmId);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [alertsRes, tasksRes, zonesRes, weatherRes] = await Promise.all([
        alertService.getAlerts().catch(() => []),
        farmerService.getMyTasks().catch(() => []),
        farmerService.getMyZones().catch(() => []),
        supportService.getWeather(farmId).catch(() => null)
      ]);

      if (Array.isArray(alertsRes)) setAlerts(alertsRes);
      if (Array.isArray(tasksRes)) setTasks(tasksRes);
      if (Array.isArray(zonesRes)) setZones(zonesRes);
      if (weatherRes) setWeatherData(weatherRes);
    } finally {
      setIsRefreshing(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Nạp số đo vi khí hậu thực tế cho từng Zone
  useEffect(() => {
    if (zones.length === 0) return;
    zones.forEach(z => {
      const id = z.zoneId;
      telemetryService.getRealtime(id).then((r: any) => {
        const metrics: any[] = r?.metrics ?? r?.value?.metrics ?? [];
        const pick = (code: string) => metrics.find(m => m.parameterCode?.toLowerCase() === code.toLowerCase());
        const soil = pick('SoilMoisture');
        const temp = pick('Temperature');
        const humidity = pick('AirHumidity') || pick('Humidity');
        const ph = pick('Ph') || pick('SoilEC') || pick('EC');

        setReadings(prev => ({
          ...prev,
          [id]: {
            soil: soil ? { value: soil.value, unit: soil.unit || '%' } : undefined,
            temp: temp ? { value: temp.value, unit: temp.unit || '°C' } : undefined,
            humidity: humidity ? { value: humidity.value, unit: humidity.unit || '%' } : undefined,
            ph: ph ? { value: ph.value, unit: ph.unit || '' } : undefined,
            fresh: Boolean(soil?.isFresh || temp?.isFresh),
            loaded: true
          }
        }));
      }).catch(() => {
        setReadings(prev => ({ ...prev, [id]: { fresh: false, loaded: true } }));
      });
    });
  }, [zones]);

  // Khi mở modal tưới, nạp danh sách thiết bị rơ-le/bơm của Zone được chọn
  useEffect(() => {
    const targetZoneId = selectedIrrigationZoneId || (zones.find(z => z.canControl)?.zoneId ?? zones[0]?.zoneId);
    if (!targetZoneId) return;
    if (!selectedIrrigationZoneId) setSelectedIrrigationZoneId(targetZoneId);

    controlService.getActuators(targetZoneId).then((acts: any) => {
      const list = Array.isArray(acts) ? acts : (acts?.value || []);
      const controllable = list.filter((a: any) => a.actuatorType === 'PUMP' || a.actuatorType === 'VALVE' || a.name?.toLowerCase().includes('bơm') || a.name?.toLowerCase().includes('tưới'));
      setZoneActuators(controllable.length > 0 ? controllable : list);
      if (controllable.length > 0 && !selectedActuatorId) {
        setSelectedActuatorId(controllable[0].actuatorId);
      } else if (list.length > 0 && !selectedActuatorId) {
        setSelectedActuatorId(list[0].actuatorId);
      }
    }).catch(() => setZoneActuators([]));
  }, [selectedIrrigationZoneId, zones, isIrrigationModalOpen]);

  // Phân loại công việc
  const myTasks = useMemo(() => {
    return [...tasks].sort((a, b) => new Date(a.dueAtUtc ?? a.dueDate ?? 0).getTime() - new Date(b.dueAtUtc ?? b.dueDate ?? 0).getTime());
  }, [tasks]);

  const todoTasks = useMemo(() => myTasks.filter(t => ['pending', 'accepted', 'inprogress', 'overdue', 'failed'].includes(String(t.status || '').toLowerCase())), [myTasks]);
  const reviewTasks = useMemo(() => myTasks.filter(t => String(t.status || '').toLowerCase() === 'completedpendingreview'), [myTasks]);
  const doneTasks = useMemo(() => myTasks.filter(t => ['approved', 'declined', 'cancelled'].includes(String(t.status || '').toLowerCase())), [myTasks]);
  const overdueTasks = useMemo(() => myTasks.filter(t => String(t.status || '').toLowerCase() === 'overdue' || dueLabel(t.dueAtUtc ?? t.dueDate).tone === 'late'), [myTasks]);

  const displayedTasks = useMemo(() => {
    if (taskFilter === 'TODO') return todoTasks;
    if (taskFilter === 'REVIEW') return reviewTasks;
    if (taskFilter === 'DONE') return doneTasks;
    return myTasks;
  }, [taskFilter, todoTasks, reviewTasks, doneTasks, myTasks]);

  const openAlerts = useMemo(() => alerts.filter(a => a.status === 'OPEN'), [alerts]);
  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return zones;
    const q = zoneSearch.toLowerCase();
    return zones.filter(z => (z.name || z.zoneName || '').toLowerCase().includes(q) || (z.currentCrop || '').toLowerCase().includes(q));
  }, [zones, zoneSearch]);

  const weather = weatherData || mockWeather;

  // Thao tác nhanh với công việc
  const handleQuickTaskAction = async (task: any, action: 'Accept' | 'Start') => {
    try {
      await supportService.updateTask(farmId, task.taskId || task.id, { action });
      setTaskFeedback({ type: 'success', message: action === 'Accept' ? 'Đã nhận việc thành công!' : 'Đã bắt đầu công việc!' });
      await loadData();
    } catch (err: any) {
      setTaskFeedback({ type: 'error', message: err?.response?.data?.detail || err?.message || 'Có lỗi xảy ra khi cập nhật công việc.' });
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;
    setIsSubmittingTask(true);
    setTaskFeedback(null);
    try {
      await supportService.updateTask(farmId, completingTask.taskId || completingTask.id, {
        action: 'Complete',
        result: resultNotes.trim() || 'Hoàn thành công việc theo quy trình thực địa.'
      });
      setTaskFeedback({ type: 'success', message: 'Đã nộp kết quả công việc! Chờ chủ trang trại kiểm tra và phê duyệt.' });
      setCompletingTask(null);
      setResultNotes('');
      await loadData();
    } catch (err: any) {
      setTaskFeedback({ type: 'error', message: err?.response?.data?.detail || err?.message || 'Không thể nộp kết quả. Vui lòng thử lại.' });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Kích hoạt tưới nhanh thủ công
  const handleTriggerIrrigation = async () => {
    if (!selectedActuatorId || !selectedIrrigationZoneId) return;
    setIsActuatorBusy(true);
    setIrrigationSuccessMessage(null);
    try {
      await controlService.toggleActuator(selectedIrrigationZoneId, selectedActuatorId, 'ON', irrigationMinutes);
      setIrrigationSuccessMessage(`Đã bật thiết bị tưới trong ${irrigationMinutes} phút (BR-SAFE-01 an toàn). Hệ thống sẽ tự động ngắt.`);
      setTimeout(() => {
        setIrrigationSuccessMessage(null);
        setIsIrrigationModalOpen(false);
      }, 2500);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Không thể kích hoạt thiết bị tưới. Vui lòng kiểm tra kết nối trạm.');
    } finally {
      setIsActuatorBusy(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* ─── 1. HERO BANNER: PHONG CÁCH XANH NÔNG NGHIỆP HIỆN ĐẠI ─── */}
      <div className="relative bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0a5e33] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-400/30 overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-white/20 text-white border border-white/30 flex items-center gap-1.5 uppercase tracking-wider backdrop-blur-xs">
                <Sparkles size={12} className="text-white" /> NÔNG DÂN THỰC ĐỊA • SMARTFARM
              </span>
              <span className="text-xs text-emerald-100 flex items-center gap-1">
                <MapPin size={12} /> {currentFarm?.name || 'Trang trại Nông nghiệp Công nghệ cao'}
              </span>
            </div>

            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold border border-white/20 transition-all backdrop-blur-xs"
              title="Làm mới dữ liệu thực địa"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}
            </button>
          </div>

          {/* Main Title & Weather Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Xin chào, {user?.fullName || 'Nông dân'}!
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm max-w-xl leading-relaxed">
                Hôm nay bạn đang phụ trách <strong>{zones.length} khu vực nhà màng</strong>. Có <strong>{todoTasks.length} công việc cần thực hiện</strong> ({overdueTasks.length > 0 ? `${overdueTasks.length} việc quá hạn` : 'tất cả đúng tiến độ'}).
              </p>
            </div>

            {/* Live Weather Widget */}
            <div className="p-4 bg-white/15 border border-white/20 rounded-2xl backdrop-blur-md text-white space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <Sun size={14} className="text-amber-300" /> Thời tiết thực địa
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-white/20 rounded-full text-white">
                  {weather.condition || weather.weatherDescription || 'Mát mẻ'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-black tracking-tight">
                  {weather.temperature != null ? `${weather.temperature}°C` : '24.5°C'}
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <div className="flex items-center gap-1 text-emerald-100 justify-end">
                    <Droplets size={12} className="text-sky-300" /> Độ ẩm: <strong>{weather.humidity}%</strong>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-100 justify-end">
                    <Wind size={12} className="text-emerald-200" /> Gió: <strong>{weather.windSpeed || weather.windSpeedKmH || 5} km/h</strong>
                  </div>
                </div>
              </div>

              {weather.precipitationProbability != null && (
                <div className="text-[11px] text-emerald-200 bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
                  <CloudRain size={12} className="text-sky-300" /> Khả năng mưa: {weather.precipitationProbability}%
                </div>
              )}
            </div>
          </div>

          {/* 4 Interactive KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <button
              onClick={() => { setTaskFilter('TODO'); }}
              className="p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-left transition-all backdrop-blur-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wide">Việc cần làm</span>
                <ClipboardList size={16} className="text-white group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-white">
                {todoTasks.length}
                {overdueTasks.length > 0 && (
                  <span className="ml-1.5 text-xs font-bold text-rose-300 bg-rose-900/60 px-2 py-0.5 rounded-full border border-rose-400/30">
                    {overdueTasks.length} quá hạn
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => { setTaskFilter('REVIEW'); }}
              className="p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-left transition-all backdrop-blur-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wide">Chờ chủ duyệt</span>
                <Clock size={16} className="text-amber-300 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-amber-200">
                {reviewTasks.length}
              </div>
            </button>

            <button
              onClick={() => navigate('/farmer/alerts')}
              className="p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-left transition-all backdrop-blur-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wide">Cảnh báo mở</span>
                <ShieldAlert size={16} className="text-rose-300 group-hover:scale-110 transition-transform" />
              </div>
              <div className={`text-2xl font-black ${openAlerts.length > 0 ? 'text-rose-300 animate-pulse' : 'text-white'}`}>
                {openAlerts.length}
              </div>
            </button>

            <button
              onClick={() => navigate('/farmer/zones')}
              className="p-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-left transition-all backdrop-blur-xs group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-wide">Zone phụ trách</span>
                <Sprout size={16} className="text-emerald-200 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-white">
                {zones.length}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. QUICK FIELD ACTIONS (LỐI TẮT THỰC ĐỊA) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setIsIrrigationModalOpen(true)}
          className="flex items-center gap-3 p-4 bg-white border border-emerald-200 hover:border-[#119653] hover:shadow-md rounded-2xl text-slate-800 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#119653] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Power size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-[#119653]">Bật tưới nhanh</div>
            <div className="text-[10px] text-slate-500">Chuẩn an toàn BR-SAFE-01</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/farmer/tasks')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md rounded-2xl text-slate-800 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700">Công việc của tôi</div>
            <div className="text-[10px] text-slate-500">{todoTasks.length} việc đang chờ</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/farmer/zones')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md rounded-2xl text-slate-800 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <MapPin size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">Bản đồ GIS & Node</div>
            <div className="text-[10px] text-slate-500">Xem vị trí cảm biến thực địa</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/farmer/alerts')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-200 hover:border-rose-400 hover:shadow-md rounded-2xl text-slate-800 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700">Cảnh báo vi khí hậu</div>
            <div className="text-[10px] text-slate-500">{openAlerts.length} thông báo nóng</div>
          </div>
        </button>
      </div>

      {/* ─── 3. EMERGENCY ALERTS BANNER ─── */}
      {openAlerts.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
              <ShieldAlert size={18} className="text-rose-600 shrink-0" />
              <span>Phát hiện {openAlerts.length} cảnh báo vi phạm ngưỡng vi khí hậu tại nhà màng!</span>
            </div>
            <Button size="sm" variant="danger" onClick={() => navigate('/farmer/alerts')}>
              Kiểm tra ngay ➔
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {openAlerts.slice(0, 3).map((a, idx) => (
              <div key={a.alertId || idx} className="p-2.5 bg-white rounded-xl border border-rose-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="truncate">{a.zoneName || 'Khu vực'}</span>
                  <span className="text-[10px] text-rose-700 px-1.5 py-0.2 bg-rose-100 rounded">
                    {a.severity || 'Cảnh báo'}
                  </span>
                </div>
                <p className="text-slate-600 line-clamp-1">{a.message || a.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {taskFeedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          taskFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {taskFeedback.type === 'success' ? <CheckCircle2 size={16} className="text-[#119653]" /> : <AlertTriangle size={16} className="text-rose-600" />}
            <span>{taskFeedback.message}</span>
          </div>
          <button onClick={() => setTaskFeedback(null)} className="text-slate-500 hover:text-slate-800 ml-4 font-bold">×</button>
        </div>
      )}

      {/* ─── 4. INTERACTIVE TASK MANAGER: CÔNG VIỆC THỰC ĐỊA ─── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
                TASK WORKSPACE
              </span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="text-[#119653]" size={20} /> Công việc Thực địa của Nông dân
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Bạn có thể nhận việc, cập nhật tiến độ và nộp kết quả trực tiếp cho chủ trang trại kiểm duyệt.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto overflow-x-auto">
            <button
              onClick={() => setTaskFilter('TODO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                taskFilter === 'TODO' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cần làm ({todoTasks.length})
            </button>
            <button
              onClick={() => setTaskFilter('REVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                taskFilter === 'REVIEW' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chờ duyệt ({reviewTasks.length})
            </button>
            <button
              onClick={() => setTaskFilter('DONE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                taskFilter === 'DONE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã duyệt ({doneTasks.length})
            </button>
            <button
              onClick={() => setTaskFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                taskFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({myTasks.length})
            </button>
          </div>
        </div>

        {/* Task Cards Grid */}
        {displayedTasks.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
            <h4 className="text-sm font-bold text-slate-800">Không có công việc nào trong mục này</h4>
            <p className="text-xs text-slate-500">
              {taskFilter === 'TODO' ? 'Tuyệt vời! Bạn đã hoàn thành hết các công việc được giao.' : 'Hãy chọn bộ lọc khác để xem danh sách công việc.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedTasks.map((t) => {
              const due = dueLabel(t.dueAtUtc ?? t.dueDate);
              const statusStr = String(t.status || '').toLowerCase();
              const isOverdue = statusStr === 'overdue' || due.tone === 'late';
              const isPending = statusStr === 'pending';
              const isAccepted = statusStr === 'accepted';
              const isInProgress = statusStr === 'inprogress';
              const isReview = statusStr === 'completedpendingreview';
              const isApproved = statusStr === 'approved';

              return (
                <div
                  key={t.taskId || t.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isOverdue
                      ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                      : isReview
                      ? 'bg-amber-50/30 border-amber-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{t.title}</h4>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${TONE[due.tone]}`}>
                        {due.text}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 font-sans font-semibold">
                        <MapPin size={12} className="text-[#119653]" /> {t.zoneName || 'Khu vực'}
                      </span>
                      {t.createdAtUtc && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={11} /> {new Date(t.createdAtUtc).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status & Quick Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      {isPending && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">Chờ nhận việc</span>}
                      {isAccepted && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">Đã nhận việc</span>}
                      {isInProgress && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200">Đang thực hiện</span>}
                      {isReview && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-900 border border-violet-200">Chờ chủ duyệt</span>}
                      {isApproved && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200">✓ Đã duyệt</span>}
                      {isOverdue && !isReview && !isApproved && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 ml-1">Quá hạn</span>}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPending && (
                        <Button size="sm" onClick={() => handleQuickTaskAction(t, 'Accept')}>
                          <CheckCircle2 size={13} className="mr-1" /> Nhận việc
                        </Button>
                      )}
                      {isAccepted && (
                        <Button size="sm" onClick={() => handleQuickTaskAction(t, 'Start')}>
                          <Play size={13} className="mr-1" /> Bắt đầu làm
                        </Button>
                      )}
                      {(isInProgress || isOverdue) && !isReview && !isApproved && (
                        <Button size="sm" onClick={() => { setCompletingTask(t); setResultNotes(''); }}>
                          <Send size={13} className="mr-1" /> Nộp kết quả
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/farmer/tasks?taskId=${t.taskId || t.id}`)}>
                        Chi tiết ➔
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 5. ASSIGNED ZONES & LIVE TELEMETRY ─── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
                ASSIGNED GREENHOUSES
              </span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sprout className="text-[#119653]" size={20} /> Khu vực Nhà màng Phân công Kỹ thuật ({zones.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Số đo vi khí hậu tự động thu thập từ các trạm cảm biến LoRa Gateway tại từng phân khu.
            </p>
          </div>

          {/* Zone Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={zoneSearch}
              onChange={e => setZoneSearch(e.target.value)}
              placeholder="Tìm kiếm khu vực..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#119653]"
            />
          </div>
        </div>

        {/* Zones Grid */}
        {filteredZones.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
            Không tìm thấy khu vực nhà màng phù hợp.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map(z => {
              const r = readings[z.zoneId];
              const zoneAlerts = openAlerts.filter(a => a.zoneId === z.zoneId).length;

              return (
                <div
                  key={z.zoneId}
                  className="p-4 bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl shadow-xs transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#119653] transition-colors">
                          {z.name || z.zoneName}
                        </h4>
                        <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 mt-0.5">
                          <Sprout size={12} className="text-[#119653]" />
                          <span>{zoneCropLabel(z)}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{zoneStageLabel(z)}</span>
                        </div>
                      </div>

                      {zoneAlerts > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full border border-rose-300 flex items-center gap-1 animate-pulse shrink-0">
                          <ShieldAlert size={10} /> {zoneAlerts} cảnh báo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300 shrink-0">
                          ✓ An toàn
                        </span>
                      )}
                    </div>

                    {/* 4 Telemetry Metrics */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] flex items-center gap-1">
                          <Droplets size={10} className="text-sky-500" /> Độ ẩm đất
                        </span>
                        <strong className="text-slate-900 font-bold block text-sm">
                          {r?.soil ? `${r.soil.value} ${r.soil.unit}` : (r?.loaded ? 'Chưa có số đo' : '...')}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] flex items-center gap-1">
                          <Thermometer size={10} className="text-amber-500" /> Nhiệt độ
                        </span>
                        <strong className="text-slate-900 font-bold block text-sm">
                          {r?.temp ? `${r.temp.value} ${r.temp.unit}` : (r?.loaded ? 'Chưa có số đo' : '...')}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] flex items-center gap-1">
                          <Wind size={10} className="text-emerald-500" /> Ẩm không khí
                        </span>
                        <strong className="text-slate-900 font-bold block text-sm">
                          {r?.humidity ? `${r.humidity.value} ${r.humidity.unit}` : (r?.loaded ? 'Chưa có số đo' : '...')}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] flex items-center gap-1">
                          <Gauge size={10} className="text-violet-500" /> pH / EC
                        </span>
                        <strong className="text-slate-900 font-bold block text-sm">
                          {r?.ph ? `${r.ph.value} ${r.ph.unit}` : '6.4 pH'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/farmer/zones`)}>
                      Bản đồ GIS ➔
                    </Button>
                    {z.canControl && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedIrrigationZoneId(z.zoneId);
                          setIsIrrigationModalOpen(true);
                        }}
                      >
                        <Power size={13} className="mr-1" /> Tưới thủ công
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL 1: NỘP KẾT QUẢ CÔNG VIỆC NHANH ─── */}
      <Modal
        isOpen={Boolean(completingTask)}
        onClose={() => setCompletingTask(null)}
        title="Nộp Kết Quả Công Việc Thực Địa"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
            <h4 className="font-bold text-emerald-950">{completingTask?.title}</h4>
            <p className="text-emerald-800">{completingTask?.description || 'Kiểm tra và thực hiện công việc được giao tại khu vực.'}</p>
            <div className="text-[11px] text-emerald-700 flex items-center gap-1">
              <MapPin size={11} /> {completingTask?.zoneName || 'Khu vực'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Mô tả kết quả đã làm & Ghi chú thực địa: *
            </label>
            <textarea
              rows={3}
              value={resultNotes}
              onChange={e => setResultNotes(e.target.value)}
              placeholder="Ví dụ: Đã kiểm tra xong toàn bộ đầu vòi phun sương, phát hiện 1 vòi nghẹt đã vệ sinh sạch, áp lực nước đạt 2.5 bar ổn định..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#119653] focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCompletingTask(null)}>Hủy bỏ</Button>
            <Button disabled={isSubmittingTask} onClick={handleCompleteTask}>
              {isSubmittingTask ? 'Đang gửi...' : 'Xác nhận Nộp Kết Quả'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 2: TƯỚI THỦ CÔNG NHANH (QUY CHUẨN BR-SAFE-01) ─── */}
      <Modal
        isOpen={isIrrigationModalOpen}
        onClose={() => setIsIrrigationModalOpen(false)}
        title="Kích Hoạt Tưới Thủ Công An Toàn (BR-SAFE-01)"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck size={14} className="text-amber-700" />
              <span>Cơ chế bảo vệ máy bơm & cây trồng:</span>
            </div>
            <p className="text-[11px]">
              Tối đa 15 phút cho mỗi lượt tưới thủ công. Hệ thống IoT sẽ gửi lệnh ngắt tự động sau khi hết thời gian hẹn giờ.
            </p>
          </div>

          {irrigationSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#119653]" />
              <span>{irrigationSuccessMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Chọn Khu vực Nhà màng:</label>
            <select
              value={selectedIrrigationZoneId}
              onChange={e => setSelectedIrrigationZoneId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
            >
              {zones.filter(z => z.canControl).map(z => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name || z.zoneName} ({zoneCropLabel(z)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Chọn Thiết bị Rơ-le / Bơm:</label>
            {zoneActuators.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded-lg">
                Đang tìm thiết bị điều khiển trong khu vực này...
              </p>
            ) : (
              <select
                value={selectedActuatorId}
                onChange={e => setSelectedActuatorId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
              >
                {zoneActuators.map((act: any) => (
                  <option key={act.actuatorId} value={act.actuatorId}>
                    {act.name} [{act.actuatorCode || act.actuatorType}]
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Thời gian tưới: <strong>{irrigationMinutes} phút</strong>
            </label>
            <div className="flex gap-2">
              {[1, 3, 5, 10, 15].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setIrrigationMinutes(min)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    irrigationMinutes === min
                      ? 'bg-[#119653] text-white border-[#119653]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {min}p
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsIrrigationModalOpen(false)}>Đóng</Button>
            <Button
              disabled={isActuatorBusy || !selectedActuatorId}
              onClick={handleTriggerIrrigation}
            >
              <Power size={14} className="mr-1.5" />
              {isActuatorBusy ? 'Đang kích hoạt...' : `Bật tưới ngay (${irrigationMinutes} phút)`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
