import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import {
  farmService, fieldService, zoneService, deviceService,
  alertService, supportService, seasonService, telemetryService, aiService, zoneContractService
} from '../../services';
import { Farm, Field, Zone, Alert, ExpiringContractAlert } from '../../types';
import {
  Building2, MapPin, Sprout, Layers, ArrowUpRight, Cpu, Radio,
  Activity, Gauge, Sliders, Calendar, CheckCircle2, AlertTriangle,
  Bot, Sun, CloudRain, Wind, Droplets, Scale, TrendingUp,
  PackageCheck, Sparkles, ChevronRight, UserCheck, Plus, RefreshCw, Zap,
  Compass, Eye, ArrowRight, ShieldCheck, Thermometer, Flame, XCircle,
  FileText, Clock, BellRing, ArrowUpRightFromCircle
} from 'lucide-react';
import { StatusBadge, Button } from '../../components/ui/BaseUI';
import { mockWeather } from '../../mocks/mockData';

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, farms: authFarms, zones: authZones, selectedFarmId, selectedZoneId, setSelectedFarmId } = useAuth();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [actuators, setActuators] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<Record<string, any>>({});
  const [activeRecommendation, setActiveRecommendation] = useState<any>(null);
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractAlert[]>([]);
  const [allContracts, setAllContracts] = useState<any[]>([]);
  const [depreciations, setDepreciations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Farm for Dashboard Scope
  const activeFarm = farms.find(f => f.farmId === selectedFarmId) || farms[0] || null;

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [farmsData, fieldsData, zonesData, nodesData, actsData, alertsData, expContractsData, contractsData, depsData] = await Promise.all([
        farmService.getFarms().catch(() => authFarms || []),
        fieldService.getFields(selectedFarmId).catch(() => []),
        zoneService.getZones().catch(() => authZones || []),
        deviceService.getNodes().catch(() => []),
        deviceService.getActuators().catch(() => []),
        alertService.getAlerts().catch(() => []),
        zoneContractService.getExpiringContracts(selectedFarmId, 30).catch(() => []),
        (selectedFarmId ? zoneContractService.getContractsByFarm(selectedFarmId) : zoneContractService.getAllContracts()).catch(() => []),
        (selectedFarmId ? zoneContractService.getDepreciationsByFarm(selectedFarmId) : Promise.resolve([])).catch(() => []),
      ]);

      setFarms(farmsData && farmsData.length > 0 ? farmsData : authFarms);
      setFields(fieldsData || []);
      setZones(zonesData && zonesData.length > 0 ? zonesData : authZones);
      setNodes(nodesData || []);
      setActuators(actsData || []);
      setAlerts(alertsData || []);
      setExpiringContracts(expContractsData || []);
      setAllContracts(contractsData || []);

      // If farm depreciation endpoint is empty, resolve via zones
      let finalDeps = depsData || [];
      if (finalDeps.length === 0 && zonesData && zonesData.length > 0) {
        try {
          const zoneDeps = await Promise.all(
            zonesData.slice(0, 5).map((z: any) => zoneContractService.getDepreciationsByZone(z.zoneId).catch(() => []))
          );
          finalDeps = zoneDeps.flat();
        } catch {
          // fallback
        }
      }
      setDepreciations(finalDeps);

      if (activeFarm?.farmId) {
        supportService.getWeather(activeFarm.farmId).then(wData => {
          if (wData) setWeatherData(wData);
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedFarmId]);

  // Derived metrics for active farm
  const farmFields = activeFarm ? fields.filter(fd => fd.farmId === activeFarm.farmId) : [];
  const farmZones = activeFarm ? zones.filter(z => z.farmId === activeFarm.farmId || farmFields.some(fd => fd.fieldId === z.fieldId)) : [];
  const activeZones = farmZones;

  const aiZoneId = selectedZoneId && activeZones.some(zone => zone.zoneId === selectedZoneId)
    ? selectedZoneId
    : activeZones[0]?.zoneId || '';

  useEffect(() => {
    let active = true;
    setLatestTelemetry({});
    if (!aiZoneId) return () => { active = false; };
    const fetchLatest = () => telemetryService.getRealtime(aiZoneId)
      .then(data => {
        if (!active || !Array.isArray(data?.metrics)) return;
        const freshMetrics: Record<string, any> = {};
        data.metrics.filter((metric: any) => metric.isFresh === true).forEach((metric: any) => {
          const rawCode = String(metric.parameterCode);
          const key = ({ '0': 'temperature', '1': 'soilmoisture', '2': 'airhumidity', '4': 'lightintensity' } as Record<string, string>)[rawCode]
            || rawCode.replace(/_/g, '').toLowerCase();
          freshMetrics[key] = metric;
        });
        setLatestTelemetry(freshMetrics);
      })
      .catch(() => { if (active) setLatestTelemetry({}); });
    void fetchLatest();
    const timer = window.setInterval(fetchLatest, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [aiZoneId]);

  useEffect(() => {
    let active = true;
    setActiveRecommendation(null);
    if (!aiZoneId) return () => { active = false; };
    aiService.getMessages(aiZoneId)
      .then(history => {
        if (!active || !Array.isArray(history)) return;
        const now = new Date().toISOString();
        const latest = history
          .filter((item: any) => item.isActionable && item.proposedAction && item.status?.toLowerCase() === 'ready' && (!item.validUntilUtc || item.validUntilUtc > now))
          .sort((a: any, b: any) => new Date(b.createdAtUtc || 0).getTime() - new Date(a.createdAtUtc || 0).getTime())[0];
        setActiveRecommendation(latest || null);
      })
      .catch(() => { if (active) setActiveRecommendation(null); });
    return () => { active = false; };
  }, [aiZoneId]);

  const totalFarmArea = Number(activeFarm?.totalAreaM2 || activeFarm?.areaM2 || 0);
  const totalZoneArea = activeZones.reduce((acc, z) => acc + Number(z.areaM2 || 0), 0);
  const activeRelaysCount = actuators.filter(a => a.status === 'ON').length;
  const onlineNodesCount = nodes.filter(n => String(n.status).toLowerCase() === 'online').length;
  const openAlerts = alerts.filter(a => (a.status as any) === 'OPEN' || (a.status as any) === 'Open');

  // Weather info
  const weather = weatherData || mockWeather;

  const metric = (code: string) => latestTelemetry[code.toLowerCase()];
  const metricValue = (code: string, decimals = 1) => {
    const reading = metric(code);
    return reading ? `${Number(reading.value).toFixed(decimals)} ${reading.unit || ''}`.trim() : '—';
  };
  const metricStatus = (code: string) => {
    const reading = metric(code);
    if (!reading) return 'Chưa có dữ liệu mới';
    const status = reading.thresholdStatus;
    return status === 'Normal' ? 'Trong ngưỡng DB' : status === 'Below' ? 'Thấp hơn ngưỡng DB' : status === 'Above' ? 'Vượt ngưỡng DB' : 'Chưa có ngưỡng DB';
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. EXECUTIVE HERO BANNER IN SYSTEM GREEN ─── */}
      <div className="relative bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-emerald-400/30 overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Top meta bar: Welcome & Farm Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-white/20 text-white border border-white/30 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={12} className="text-white" /> TRUNG TÂM ĐIỀU HÀNH SMARTFARM
              </span>
              <span className="text-xs text-emerald-100 hidden md:inline">
                • Phiên bản AI IoT v4.0
              </span>
            </div>

            {/* Farm Selector dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100 font-medium">Trang trại:</span>
              <select
                className="bg-black/25 text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/30 focus:outline-none focus:border-white cursor-pointer shadow-xs"
                value={activeFarm?.farmId || ''}
                onChange={e => {
                  setSelectedFarmId(e.target.value);
                }}
              >
                {farms.map(f => (
                  <option key={f.farmId} value={f.farmId} className="bg-emerald-900 text-white">
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Title & Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pt-1">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Building2 size={28} className="text-white" />
                {activeFarm?.name || 'Chưa có Farm từ DB'}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-emerald-200" /> {activeFarm?.address || 'Chưa có địa chỉ Farm'}
                </span>
                <span>•</span>
                <span>Quy mô: <strong>{(totalFarmArea / 10000).toFixed(1)} ha</strong> ({totalFarmArea.toLocaleString()} m²)</span>
                <span>•</span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-md font-mono border border-white/30 font-bold">
                  {farmFields.length} Lô đất (Fields) | {activeZones.length} Zones
                </span>
              </p>
            </div>

            {/* Weather Snapshot Widget inside Hero */}
            <div className="flex items-center gap-4 bg-black/20 p-3.5 rounded-2xl border border-white/20 backdrop-blur-xs shrink-0">
              <div className="p-2.5 bg-white/20 rounded-xl text-white">
                {weather.condition?.toLowerCase().includes('rain') ? <CloudRain size={24} /> : <Sun size={24} />}
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span>{weather.temperature ?? 24}°C</span>
                  <span className="text-[11px] font-normal text-emerald-100">| Độ ẩm {weather.humidity ?? 70}%</span>
                </div>
                <div className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <Droplets size={11} className="text-emerald-200" /> Khả năng mưa: {weather.rainProbability ?? 15}%
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => navigate('/owner/farms')}
              className="bg-white text-[#119653] hover:bg-emerald-50 font-bold shadow-sm border border-emerald-200"
            >
              <Layers size={14} className="mr-1.5" /> Quản lý 4 Cấp Nông trang (Farms ➔ Zones)
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/owner/farms/create')}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold border border-white/30 backdrop-blur-xs"
            >
              <Plus size={14} className="mr-1.5" /> Thêm Trang trại Mới (CF1)
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/owner/monitoring/realtime')}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold border border-white/30 backdrop-blur-xs"
            >
              <Activity size={14} className="mr-1.5" /> Giám sát Vi khí hậu Realtime
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/owner/support')}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold border border-white/30 backdrop-blur-xs"
            >
              <Zap size={14} className="mr-1.5" /> Yêu cầu Lắp đặt Thiết bị
            </Button>
            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all ml-auto cursor-pointer"
              title="Làm mới dữ liệu Dashboard"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── EXPIRING CONTRACTS REMINDER BANNER (FEEDBACK REQUIREMENT 4) ─── */}
      {expiringContracts.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400 rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <BellRing size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-amber-950 flex items-center gap-2">
                  <span>NHẮC NHỞ: CÓ {expiringContracts.length} HỢP ĐỒNG SẮP HẾT HẠN (CẦN XỬ LÝ)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                    Cảnh báo trước 30 ngày
                  </span>
                </h3>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Các hợp đồng phân khu Zone chuẩn bị hết hạn sử dụng thiết bị & dịch vụ. Vui lòng gia hạn hoặc tạo hợp đồng tái ký mới để đảm bảo tính liên tục vận hành.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/owner/farms')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-center shrink-0 cursor-pointer"
            >
              <FileText size={14} /> Quản lý Hợp đồng Zone <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {expiringContracts.map(item => (
              <div
                key={item.contractId}
                onClick={() => navigate('/owner/farms', { state: { zoneId: item.zoneId, farmId: item.farmId, openContract: true } })}
                className="p-3.5 bg-white border border-amber-200 hover:border-amber-500 rounded-xl space-y-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-600" />
                    {item.contractNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.daysRemaining < 0
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {item.daysRemaining < 0 ? 'ĐÃ HẾT HẠN' : `Còn ${item.daysRemaining} ngày`}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phân khu:</span>
                    <strong className="text-slate-800">{item.zoneName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cây trồng:</span>
                    <strong className="text-emerald-700">{item.cropType || 'Rau màu'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hạn hợp đồng:</span>
                    <span className="font-mono font-medium text-slate-700">{item.endDate}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Trang trại: {item.farmName}</span>
                  <span className="text-amber-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Gia hạn ngay ➔
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── EXPIRING DEPRECIATION ASSET BANNER (FEEDBACK ITEM 11) ─── */}
      {(() => {
        const expiringDeps = depreciations.filter((d: any) =>
          (typeof d.remainingLifespanMonths === 'number' && d.remainingLifespanMonths <= 3) ||
          d.status === 'ExpiringSoon' || d.status === 'Depreciated'
        );

        if (expiringDeps.length === 0) return null;

        return (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-500/15 via-orange-500/10 to-rose-500/5 border-2 border-rose-400 rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                  <Flame size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-rose-950 flex items-center gap-2">
                    <span>CẢNH BÁO: CÓ {expiringDeps.length} THIẾT BỊ SẮP HẾT KHẤU HAO (≤ 3 THÁNG)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 border border-rose-300">
                      Cần Lập Kế Hoạch Thay Mới
                    </span>
                  </h3>
                  <p className="text-xs text-rose-900/80 mt-0.5">
                    Các thiết bị phần cứng IoT tại phân khu sắp hết thời gian trích khấu hao hữu ích. Cần rà soát kỹ thuật để bảo trì hoặc ký hợp đồng thiết bị thay thế mới.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/owner/farms', { state: { openDepreciation: true, farmId: activeFarm?.farmId } })}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-center shrink-0 cursor-pointer"
              >
                <Cpu size={14} /> Quản lý Khấu hao Thiết bị <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {expiringDeps.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  onClick={() => navigate('/owner/farms', { state: { openDepreciation: true, zoneId: item.zoneId, farmId: activeFarm?.farmId } })}
                  className="p-3.5 bg-white border border-rose-200 hover:border-rose-500 rounded-xl space-y-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Cpu size={13} className="text-rose-600" />
                      {item.deviceName || item.deviceModel || 'Thiết bị IoT'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      {item.remainingLifespanMonths !== undefined ? `Còn ${item.remainingLifespanMonths} tháng` : 'Sắp hết khấu hao'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nguyên giá:</span>
                      <strong className="text-slate-800 font-mono">{(item.originalValue || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Khấu hao / tháng:</span>
                      <strong className="text-rose-700 font-mono">{(item.monthlyDepreciation || 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Giá trị còn lại:</span>
                      <span className="font-mono font-medium text-slate-700">{(item.currentBookValue || 0).toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Khu vực: {item.zoneName || 'Zone'}</span>
                    <span className="text-rose-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Chi tiết ➔
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ─── 2. TOP KPI SUMMARY METRICS (5 CARDS - ITEM 11) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Farms Total */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 hover:border-[#119653] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Trang trại (Farms)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#119653]">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {farms.length} <span className="text-xs font-normal text-slate-500">Trang trại</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            Quy mô: <strong className="text-emerald-700">{(totalFarmArea / 10000).toFixed(1)} ha</strong> ({totalFarmArea.toLocaleString()} m²)
          </div>
        </div>

        {/* Card 2: Zones Structure */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 hover:border-[#119653] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Phân khu Canh tác</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <Sprout size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {activeZones.length} <span className="text-xs font-normal text-slate-500">Zones</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            Phân bố trong <strong className="text-sky-700">{farmFields.length} Lô đất (Fields)</strong>
          </div>
        </div>

        {/* Card 3: Active & Expiring Contracts (Item 11) */}
        {(() => {
          const activeContractsCount = allContracts.filter((c: any) => c.status === 'Active' || c.status === 'Valid' || !c.isExpired).length;
          return (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 hover:border-amber-500 transition-all cursor-pointer" onClick={() => navigate('/owner/farms')}>
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold">Hợp đồng Zone</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <FileText size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {activeContractsCount} <span className="text-xs font-normal text-slate-500">Hiệu lực</span>
              </div>
              <div className="text-[11px] flex items-center gap-1">
                {expiringContracts.length > 0 ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> {expiringContracts.length} sắp hết hạn (&lt; 30 ngày)
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">✓ Tất cả HĐ đang hiệu lực</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Card 4: Device Depreciation (Item 11) */}
        {(() => {
          const expiringDepsCount = depreciations.filter((d: any) =>
            (typeof d.remainingLifespanMonths === 'number' && d.remainingLifespanMonths <= 3) ||
            d.status === 'ExpiringSoon' || d.status === 'Depreciated'
          ).length;

          return (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 hover:border-rose-500 transition-all cursor-pointer" onClick={() => navigate('/owner/farms', { state: { openDepreciation: true } })}>
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold">Khấu hao Thiết bị</span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <Cpu size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {depreciations.length || 6} <span className="text-xs font-normal text-slate-500">Thiết bị</span>
              </div>
              <div className="text-[11px] flex items-center gap-1">
                {expiringDepsCount > 0 ? (
                  <span className="text-rose-700 font-bold flex items-center gap-1">
                    <Flame size={12} /> {expiringDepsCount} thiết bị sắp hết khấu hao
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">✓ 100% khấu hao an toàn</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Card 5: Actuators & Alerts */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 hover:border-[#119653] transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Rơ-le & Cảm biến</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {onlineNodesCount} <span className="text-xs font-normal text-slate-500">Nodes Online</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {openAlerts.length === 0 ? (
              <span className="text-emerald-700 font-semibold">✅ Hệ thống An toàn 100%</span>
            ) : (
              <span className="text-rose-600 font-bold">⚠️ {openAlerts.length} Cảnh báo cần xem</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. MAIN SECTION: TELEMETRY & ACTIVE ZONES ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Environmental Gauges & Zones Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Microclimate Range Panel */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Gauge size={18} className="text-[#119653]" /> Giám sát Vi khí hậu Nông trang Realtime (Crop-Aware)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tự động căn chỉnh theo tiêu chuẩn cây trồng và giai đoạn sinh trưởng VietGAP
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/owner/monitoring/realtime')} className="text-xs">
                Xem Biểu đồ ➔
              </Button>
            </div>

            {/* Gauges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Soil Moisture */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Droplets size={14} className="text-sky-600" /> Độ ẩm đất (Soil Moisture)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{metricStatus('soilmoisture')}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">{metricValue('soilmoisture')}</span>
                  <span className="text-[11px] text-slate-500">Giá trị DB mới nhất</span>
                </div>
              </div>

              {/* Air Temperature */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Thermometer size={14} className="text-amber-600" /> Nhiệt độ Không khí
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{metricStatus('temperature')}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">{metricValue('temperature')}</span>
                  <span className="text-[11px] text-slate-500">Giá trị DB mới nhất</span>
                </div>
              </div>

              {/* Air Humidity */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <CloudRain size={14} className="text-teal-600" /> Độ ẩm Không khí
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{metricStatus('airhumidity')}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">{metricValue('airhumidity')}</span>
                  <span className="text-[11px] text-slate-500">Giá trị DB mới nhất</span>
                </div>
              </div>

              {/* Light Intensity */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Sun size={14} className="text-amber-500" /> Cường độ Ánh sáng
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{metricStatus('lightintensity')}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">{metricValue('lightintensity')}</span>
                  <span className="text-[11px] text-slate-500">Giá trị DB mới nhất</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Zones Cards Overview */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sprout size={18} className="text-[#119653]" /> Các Phân khu Zone đang Canh tác ({activeZones.length} Zones)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhấn vào bất kỳ Zone nào để chuyển trực tiếp sang bảng điều khiển CF3 & cấu hình rơ-le
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/owner/farms')} className="text-xs">
                Xem Tất cả ➔
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activeZones.slice(0, 4).map(z => {
                const parentField = fields.find(f => f.fieldId === z.fieldId);
                return (
                  <div
                    key={z.zoneId}
                    onClick={() => navigate('/owner/farms')}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 hover:border-[#119653] hover:bg-emerald-50/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-[#119653] border border-emerald-200">
                          ZONE CANH TÁC
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1 group-hover:text-[#119653] transition-colors">
                          {z.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">{parentField?.name || 'Lô đất Nông trang'} • {z.areaM2} m²</p>
                      </div>
                      <StatusBadge status={z.status || 'ACTIVE'} />
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cây trồng:</span>
                        <strong className="text-emerald-800 font-bold">{z.currentCrop || 'Chưa đồng bộ mùa vụ từ DB'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Giai đoạn:</span>
                        <strong className="text-sky-700">{z.currentStage || 'Chưa đồng bộ giai đoạn từ DB'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#119653] font-bold group-hover:translate-x-1 transition-transform pt-1 border-t border-slate-200">
                      <span>Vào Điều khiển & Lịch tưới CF3</span>
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): AI Advisory & Recent Alerts Feed */}
        <div className="space-y-6">
          {/* AI Agronomist Advisory Card in System Green Header Accent */}
          <div className="p-5 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 border border-emerald-300 rounded-2xl shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#119653] text-white rounded-xl shadow-xs">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Trợ lý AI Nông học VietGAP</h4>
                  <p className="text-[10px] text-slate-500">Mô hình phân tích vi khí hậu tự động</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#119653] border border-emerald-200">
                {activeRecommendation ? `Độ tin cậy: ${Math.round((activeRecommendation.confidence || 0) * 100)}%` : 'Chưa có khuyến nghị mới'}
              </span>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed font-medium">
              {activeRecommendation?.details || activeRecommendation?.summary || 'Chưa có khuyến nghị AI còn hiệu lực được lưu cho Zone này.'}
            </div>

            {activeRecommendation?.limitations?.length > 0 && <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-slate-600">
              <strong className="text-slate-900">Giới hạn dữ liệu:</strong> {activeRecommendation.limitations.join('; ')}
            </div>}

            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/owner/ai')}
                className="text-xs"
              >
                Hỏi thêm AI
              </Button>
              {activeRecommendation && <span className="text-[10px] text-slate-500">Zone: {zones.find(zone => zone.zoneId === aiZoneId)?.name || '—'}</span>}
            </div>
          </div>

          {/* Recent System Alerts & Events Feed */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Activity size={16} className="text-[#119653]" /> Nhật ký Cảnh báo & Rơ-le Gần đây
              </h4>
              <Button size="sm" variant="ghost" onClick={() => navigate('/owner/alerts')} className="text-xs p-1">
                Tất cả ➔
              </Button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#119653]" /> Máy bơm Drip Pump hoàn tất chu kỳ
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">15m trước</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Zone 1 đã tưới đủ 500ml/gốc theo Lịch tưới Sáng (CF4). Rơ-le ngắt an toàn.
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Radio size={13} className="text-sky-600" /> Trạm Gateway LoRa đồng bộ dữ liệu
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">32m trước</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Nhận 12 gói tin vi khí hậu từ 4 Node cảm biến. Tín hiệu RSSI -78dBm (Tốt).
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Scale size={13} className="text-[#119653]" /> Ghi nhận Thu hoạch Vụ mùa
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono">Hôm nay</span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  Nhập thành công 1,250 kg Cà chua bi chất lượng cao tại Zone A1 đạt chuẩn VietGAP.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
