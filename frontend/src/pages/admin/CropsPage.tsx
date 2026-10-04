import React, { useState, useEffect } from 'react';
import { cropService, zoneService } from '../../services';
import { Crop, CalendarIrrigationPlan, Zone } from '../../types';
import { Button, Input, Modal, StatusBadge } from '../../components/ui/BaseUI';
import { CropCalendarView } from '../../components/crops/CropCalendarView';
import { 
  Sprout, Plus, Search, Layers, BookOpen, Calendar as CalendarIcon, 
  Thermometer, Droplets, Zap, Sun, RefreshCw, CheckCircle2, Sliders, Info, ChevronRight, Sunrise, Sunset 
} from 'lucide-react';

export const CropsPage: React.FC = () => {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'INFO' | 'CALENDAR' | 'SYNC'>('INFO');
  const [selectedZoneIdForSync, setSelectedZoneIdForSync] = useState<string>('zone-01');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state for creating/editing crop
  const [formData, setFormData] = useState<Partial<Crop>>({
    name: '',
    scientificName: '',
    category: 'Rau ăn quả',
    growthCycleDays: 90,
    description: '',
    optimalTemperatureMin: 20,
    optimalTemperatureMax: 28,
    optimalSoilMoistureMin: 65,
    optimalSoilMoistureMax: 80,
    optimalpHMin: 6.0,
    optimalpHMax: 6.8,
    optimalECMin: 1.8,
    optimalECMax: 2.5,
    optimalLux: 25000,
    calendarIrrigationPlan: {
      repeatType: 'DAILY',
      lunarSyncEnabled: true,
      sessions: [
        { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
      ]
    }
  });

  const [editingCropId, setEditingCropId] = useState<string | null>(null);

  const loadData = async () => {
    const [fetchedCrops, fetchedZones] = await Promise.all([
      cropService.getCrops(),
      zoneService.getZones(),
    ]);
    setCrops([...fetchedCrops]);
    setZones(fetchedZones);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingCropId(null);
    setFormData({
      name: '',
      scientificName: '',
      category: 'Rau ăn quả',
      growthCycleDays: 90,
      description: '',
      optimalTemperatureMin: 20,
      optimalTemperatureMax: 28,
      optimalSoilMoistureMin: 65,
      optimalSoilMoistureMax: 80,
      optimalpHMin: 6.0,
      optimalpHMax: 6.8,
      optimalECMin: 1.8,
      optimalECMax: 2.5,
      optimalLux: 25000,
      calendarIrrigationPlan: {
        repeatType: 'DAILY',
        lunarSyncEnabled: true,
        sessions: [
          { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ]
      }
    });
    setActiveModalTab('INFO');
    setIsModalOpen(true);
  };

  const openEditModal = (crop: Crop) => {
    setEditingCropId(crop.cropId);
    setFormData({ ...crop });
    setActiveModalTab('INFO');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCropId) {
      await cropService.updateCrop(editingCropId, formData);
      setNotification({ type: 'success', message: `Đã cập nhật cây trồng [${formData.name}]!` });
    } else {
      await cropService.createCrop(formData);
      setNotification({ type: 'success', message: `Đã thêm cây trồng [${formData.name}] với Lịch tưới Sáng-Trưa-Chiều thành công!` });
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleSyncToZone = async (cropId?: string, targetZoneId?: string) => {
    const cId = cropId || editingCropId || crops[0]?.cropId;
    const zId = targetZoneId || selectedZoneIdForSync;

    if (!cId || !zId) return;

    const res = await cropService.syncCropScheduleToZone(cId, zId);
    if (res.success) {
      setNotification({
        type: 'success',
        message: `⚡ Đã đồng bộ thành công ${res.createdSchedulesCount} lịch tưới Sáng-Trưa-Chiều & Ngưỡng Vi khí hậu sang Zone "${res.zoneName}"!`
      });
      loadData();
    }
  };

  const filtered = crops.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.scientificName && c.scientificName.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#062326]" size={24} /> Thư viện Cây trồng Chuẩn (System Crop Library)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Danh mục các loài cây mẫu VietGAP tích hợp Lịch tưới dạng Cuốn Lịch (Sáng - Trưa - Chiều) và tự động đồng bộ sang Zone của Owner.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={16} className="mr-1.5" /> Thêm Cây trồng Mới vào Thư viện
        </Button>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm kiếm loài cây, tên khoa học..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-slate-500 font-medium">Tổng số: <strong>{filtered.length}</strong> loại cây</span>
      </div>

      {/* Crop Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(c => {
          const sessions = c.calendarIrrigationPlan?.sessions || [];
          const mSess = sessions.find(s => s.session === 'MORNING');
          const nSess = sessions.find(s => s.session === 'NOON');
          const aSess = sessions.find(s => s.session === 'AFTERNOON');

          return (
            <div key={c.cropId} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs hover:border-emerald-600/40 transition-all group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mb-1 inline-block">
                      {c.category || 'Rau ăn quả'} • {c.growthCycleDays || 90} ngày
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">{c.name}</h3>
                    <p className="text-xs italic text-emerald-800 font-serif font-medium">{c.scientificName}</p>
                  </div>
                  <StatusBadge status={c.isSystemDefined ? 'ACTIVE' : 'WARNING'} label={c.isSystemDefined ? 'VietGAP' : 'Custom'} />
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>

                {/* Key specs badge row */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Thermometer size={13} className="text-rose-600" />
                    <span>Nhiệt độ: <strong>{c.optimalTemperatureMin || 20}-{c.optimalTemperatureMax || 28}°C</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Droplets size={13} className="text-sky-600" />
                    <span>Độ ẩm đất: <strong>{c.optimalSoilMoistureMin || 65}-{c.optimalSoilMoistureMax || 80}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Zap size={13} className="text-amber-600" />
                    <span>EC: <strong>{c.optimalECMin || 1.8}-{c.optimalECMax || 2.5} mS/cm</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Sun size={13} className="text-yellow-600" />
                    <span>pH: <strong>{c.optimalpHMin || 6.0}-{c.optimalpHMax || 6.8}</strong></span>
                  </div>
                </div>

                {/* Calendar schedule summary badge */}
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                    <span className="flex items-center gap-1"><CalendarIcon size={13} /> Cuốn Lịch Tưới 3 Ca</span>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-950 px-1.5 py-0.2 rounded font-mono">
                      {c.calendarIrrigationPlan?.repeatType === 'DAILY' ? 'Hàng ngày' : 'Định kỳ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600">
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${mSess?.enabled ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      🌅 Sáng {mSess?.startTime || '07:30'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${nSess?.enabled ? 'bg-rose-100 text-rose-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      ☀️ Trưa {nSess?.startTime || '12:00'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${aSess?.enabled ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      🌇 Chiều {aSess?.startTime || '16:30'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                <button onClick={() => openEditModal(c)} className="text-[#062326] hover:underline font-semibold flex items-center gap-1">
                  ✏️ Xem / Chỉnh sửa Lịch
                </button>
                <button
                  onClick={() => {
                    openEditModal(c);
                    setActiveModalTab('SYNC');
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 text-[11px] shadow-2xs transition-all"
                >
                  <RefreshCw size={12} /> Đồng bộ sang Zone
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* EXPANDED MODAL: Add / Edit Crop with Calendar Schedule & Zone Sync */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCropId ? "Chỉnh sửa Cây trồng & Cuốn Lịch Tưới" : "Thêm Cây trồng Mới vào Thư viện"}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Multi-Tab Navigation inside Modal */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveModalTab('INFO')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'INFO' ? 'border-[#062326] text-[#062326]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sprout size={14} /> 1. Thông tin & Vi Khí Hậu
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('CALENDAR')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'CALENDAR' ? 'border-[#062326] text-[#062326]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon size={14} /> 2. Cuốn Lịch Tưới (Sáng-Trưa-Chiều)
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('SYNC')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'SYNC' ? 'border-[#062326] text-[#062326]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <RefreshCw size={14} /> 3. Đồng bộ với Zone Owner
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* TAB 1: General Info & Microclimate Targets */}
            {activeModalTab === 'INFO' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Tên cây trồng *</label>
                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Dâu tây Đà Lạt" />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Tên khoa học (Scientific Name)</label>
                    <Input value={formData.scientificName} onChange={e => setFormData({ ...formData, scientificName: e.target.value })} placeholder="Fragaria × ananassa" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Phân nhóm loài cây</label>
                    <select
                      value={formData.category || 'Rau ăn quả'}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="Rau ăn quả">Rau ăn quả (Tomato, Chili, Cucumber)</option>
                      <option value="Rau ăn lá">Rau ăn lá (Hydroponic Leafy Greens)</option>
                      <option value="Cây ăn trái">Cây ăn trái (Fruit Crops)</option>
                      <option value="Cây củ">Cây củ & Gia vị</option>
                      <option value="Hoa & Dược liệu">Hoa & Dược liệu cao cấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Chu kỳ sinh trưởng vụ mùa (số ngày)</label>
                    <Input type="number" min={10} max={365} value={formData.growthCycleDays || 90} onChange={e => setFormData({ ...formData, growthCycleDays: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mô tả đặc tính nông học & kỹ thuật VietGAP</label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ưa khí hậu mát mẻ, cần kiểm soát EC và độ ẩm đất tự động..." />
                </div>

                {/* Optimal Environmental Parameters */}
                <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                      <Sliders size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Cấu hình Ngưỡng Vi Khí Hậu Tối Ưu (Environmental Requirements)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Ngưỡng tham số sinh trưởng tối ưu VietGAP làm căn cứ tự động kích hoạt thiết bị.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Nhiệt độ */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-rose-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-rose-50 text-rose-600 border border-rose-100">
                          <Thermometer size={14} />
                        </div>
                        <span>Nhiệt độ (°C)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            value={formData.optimalTemperatureMin || 20}
                            onChange={e => setFormData({ ...formData, optimalTemperatureMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            value={formData.optimalTemperatureMax || 28}
                            onChange={e => setFormData({ ...formData, optimalTemperatureMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Độ ẩm đất */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-sky-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-sky-50 text-sky-600 border border-sky-100">
                          <Droplets size={14} />
                        </div>
                        <span>Độ ẩm đất (%)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            value={formData.optimalSoilMoistureMin || 65}
                            onChange={e => setFormData({ ...formData, optimalSoilMoistureMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            value={formData.optimalSoilMoistureMax || 80}
                            onChange={e => setFormData({ ...formData, optimalSoilMoistureMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Độ pH */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-100">
                          <Sun size={14} />
                        </div>
                        <span>Độ pH</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalpHMin || 6.0}
                            onChange={e => setFormData({ ...formData, optimalpHMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalpHMax || 6.8}
                            onChange={e => setFormData({ ...formData, optimalpHMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Độ EC */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-purple-50 text-purple-600 border border-purple-100">
                          <Zap size={14} />
                        </div>
                        <span>Độ EC (mS/cm)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalECMin || 1.8}
                            onChange={e => setFormData({ ...formData, optimalECMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalECMax || 2.5}
                            onChange={e => setFormData({ ...formData, optimalECMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Calendar Irrigation Schedule (Sáng - Trưa - Chiều) */}
            {activeModalTab === 'CALENDAR' && (
              <CropCalendarView
                plan={formData.calendarIrrigationPlan || {
                  repeatType: 'DAILY',
                  lunarSyncEnabled: true,
                  sessions: [
                    { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                    { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                    { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
                  ]
                }}
                onChangePlan={(updated) => setFormData({ ...formData, calendarIrrigationPlan: updated })}
              />
            )}

            {/* TAB 3: Synchronize with Owner Zone */}
            {activeModalTab === 'SYNC' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-2">
                    <RefreshCw size={16} className="text-emerald-700" />
                    Đồng bộ Lịch tưới Sáng-Trưa-Chiều trực tiếp vào Zone của Owner
                  </h4>
                  <p className="text-emerald-800 text-[11px]">
                    Khi kích hoạt đồng bộ, hệ thống sẽ tự động cập nhật các Lịch tưới Định kỳ (Cron Schedules) và thiết lập Dải tham số vi khí hậu cho Zone được chọn.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Chọn Zone / Nhà màng mục tiêu của Owner:</label>
                  <select
                    value={selectedZoneIdForSync}
                    onChange={(e) => setSelectedZoneIdForSync(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold text-slate-900"
                  >
                    {zones.map(z => (
                      <option key={z.zoneId} value={z.zoneId}>
                        {z.name} (Lô đất: {z.fieldId} • Cây hiện tại: {z.currentCrop || 'Chưa chọn'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                  <h5 className="font-bold text-slate-900">Nội dung sẽ được đồng bộ hóa sang Zone:</h5>
                  <ul className="space-y-1 text-slate-600 list-disc pl-4">
                    <li>Lịch tưới <strong>Ca Sáng ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.startTime || '07:30'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.durationMinutes || 20} phút</li>
                    <li>Lịch tưới <strong>Ca Trưa ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.startTime || '12:00'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.durationMinutes || 10} phút ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.enabled ? 'Đã kích hoạt' : 'Tắt'})</li>
                    <li>Lịch tưới <strong>Ca Chiều ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.startTime || '16:30'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.durationMinutes || 15} phút</li>
                    <li>Ngưỡng độ ẩm đất tối ưu: <strong>{formData.optimalSoilMoistureMin || 65}% - {formData.optimalSoilMoistureMax || 80}%</strong></li>
                    <li>Cập nhật tên loài cây canh tác chính thức cho Zone.</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button 
                    type="button" 
                    onClick={() => handleSyncToZone()}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md"
                  >
                    <RefreshCw size={15} /> KÍCH HOẠT ĐỒNG BỘ SANG ZONE NGAY TỨC THÌ
                  </Button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                {activeModalTab === 'INFO' ? 'Bước 1: Nhập thông tin & vi khí hậu' : activeModalTab === 'CALENDAR' ? 'Bước 2: Chỉnh lịch tưới Cuốn Lịch' : 'Bước 3: Đồng bộ với Owner Zone'}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                {activeModalTab !== 'SYNC' ? (
                  <Button type="button" onClick={() => setActiveModalTab(activeModalTab === 'INFO' ? 'CALENDAR' : 'SYNC')}>
                    Tiếp theo <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button type="submit">Lưu Cây trồng vào Thư viện</Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
