import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Clock, CheckCircle2, Sliders, Droplets, Radio, Play,
  ShieldCheck, Sparkles, QrCode, FileText, Printer, Download, Package,
  DollarSign, AlertTriangle, Check
} from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { controlService, farmService, fieldService, seasonService, zoneService } from '../../services';
import { PlantingSeason, ControlSchedule, Actuator } from '../../types';

export const PlantingSeasonsPage: React.FC = () => {
  const [seasons, setSeasons] = useState<PlantingSeason[]>([]);
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<PlantingSeason | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState<boolean>(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState<boolean>(false);
  const [isVietgapLogModalOpen, setIsVietgapLogModalOpen] = useState<boolean>(false);
  const [harvestSaved, setHarvestSaved] = useState<boolean>(false);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Harvest Form State
  const [harvestForm, setHarvestForm] = useState({
    harvestDate: '2026-10-21',
    totalYieldKg: 850,
    gradeAKg: 720,
    gradeBKg: 100,
    scrapKg: 30,
    unitPrice: 45000,
    notes: 'Thu hoạch lứa 1 đạt chuẩn xuất khẩu VietGAP, độ ngọt Brix 9.2%',
  });

  // New Planting Season Form State
  const [seasonForm, setSeasonForm] = useState({
    name: 'Vụ Cà Chua Vụ Đông Xuân 2026',
    cropName: 'Cà chua Cherry Red Ruby',
    varietyName: 'F1 Cao Sản VietGAP',
    zoneName: 'Nhà màng Cà Chua 01',
    growthStageName: 'Sinh trưởng (Vegetative)',
    startDate: '2026-10-15',
    expectedEndDate: '2027-01-15',
    progressPercent: 15,
  });

  // New Season Schedule Form State
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    actuatorId: '',
    startTime: '07:30',
    durationMinutes: 20,
    daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
    growthStageName: '',
    targetSoilMoisture: 65,
  });

  const loadData = async () => {
    try {
      const farms = await farmService.getFarms();
      const fieldsByFarm = await Promise.all(farms.map(async (farm: any) => ({
        farmId: farm.farmId,
        fields: await fieldService.getFields(farm.farmId),
      })));
      const zonesByField = await Promise.all(fieldsByFarm.flatMap(({ farmId, fields }) =>
        fields.map(async (field: any) => ({
          farmId,
          zones: await zoneService.getZones(field.fieldId),
        }))
      ));
      const zoneRefs = zonesByField.flatMap(({ farmId, zones }) =>
        zones.map((zone: any) => ({ zoneId: zone.zoneId, zoneName: zone.name, farmId }))
      );
      const [seasonGroups, scheduleGroups, actuatorGroups] = await Promise.all([
        Promise.all(zoneRefs.map(async zone => ({
          zone,
          seasons: await seasonService.getSeasons(zone.zoneId).catch(() => []),
        }))),
        Promise.all(zoneRefs.map(async zone => ({
          zone,
          schedules: await controlService.getSchedules(zone.zoneId).catch(() => []),
        }))),
        Promise.all(zoneRefs.map(async zone => ({
          actuators: await controlService.getActuators(zone.zoneId).catch(() => []),
        }))),
      ]);
      setSeasons(seasonGroups.flatMap(({ zone, seasons }) => seasons.map((season: PlantingSeason) => ({
        ...season,
        zoneName: zone.zoneName,
        farmId: zone.farmId,
      }))));
      setSchedules(scheduleGroups.flatMap(({ zone, schedules }) => schedules.map((schedule: ControlSchedule) => ({
        ...schedule,
        zoneName: schedule.zoneName || zone.zoneName,
      }))));
      setActuators(Array.from(new Map(actuatorGroups.flatMap(group => group.actuators)
        .map((actuator: Actuator) => [actuator.actuatorId, actuator])).values()));
    } catch (err) {
      console.error('Failed to load season data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSeason: PlantingSeason = {
      plantingSeasonId: `season-${Date.now()}`,
      zoneId: '32000000-0000-0000-0000-000000000001',
      zoneName: seasonForm.zoneName,
      farmId: '30000000-0000-0000-0000-000000000001',
      cropId: `crop-${Date.now()}`,
      cropName: seasonForm.cropName,
      varietyName: seasonForm.varietyName,
      growthProfileId: `gp-${Date.now()}`,
      name: seasonForm.name,
      startDate: seasonForm.startDate,
      expectedEndDate: seasonForm.expectedEndDate,
      currentGrowthStageId: 'stage-1',
      currentGrowthStageName: seasonForm.growthStageName,
      status: 'ACTIVE',
      progressPercent: Number(seasonForm.progressPercent),
    };

    setSeasons(prev => [newSeason, ...prev]);
    setIsSeasonModalOpen(false);
    setSuccessToast(`Đã kích hoạt thành công Vụ mùa mới: [${newSeason.name}]!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenSetupSchedule = (season: PlantingSeason) => {
    setSelectedSeason(season);
    const zoneActuators = actuators.filter(a => a.zoneId === season.zoneId);
    setScheduleForm({
      name: `Lịch tưới mùa vụ [${season.name}] - ${season.currentGrowthStageName || 'Ra hoa'}`,
      actuatorId: zoneActuators[0]?.actuatorId || actuators[0]?.actuatorId || '',
      startTime: '07:30',
      durationMinutes: 20,
      daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
      growthStageName: season.currentGrowthStageName || 'Ra hoa (Flowering)',
      targetSoilMoisture: 65,
    });
    setIsScheduleModalOpen(true);
  };

  const handleOpenHarvest = (season: PlantingSeason) => {
    setSelectedSeason(season);
    setHarvestSaved(false);
    setHarvestForm({
      harvestDate: new Date().toISOString().slice(0, 10),
      totalYieldKg: 850,
      gradeAKg: 720,
      gradeBKg: 100,
      scrapKg: 30,
      unitPrice: 45000,
      notes: `Thu hoạch ${season.name} đạt chuẩn xuất khẩu VietGAP, độ ngọt Brix 9.2%`,
    });
    setIsHarvestModalOpen(true);
  };

  const handleSaveHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeason) return;
    setHarvestSaved(true);
    setSuccessToast(`Đã ghi nhận sản lượng thu hoạch ${harvestForm.totalYieldKg}kg cho [${selectedSeason.name}]!`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleOpenVietgapLog = (season: PlantingSeason) => {
    setSelectedSeason(season);
    setIsVietgapLogModalOpen(true);
  };

  const handleSaveSeasonSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeason) return;

    await controlService.createSeasonSchedule({
      name: scheduleForm.name,
      zoneId: selectedSeason.zoneId,
      actuatorId: scheduleForm.actuatorId,
      startTime: scheduleForm.startTime,
      durationMinutes: Number(scheduleForm.durationMinutes),
      daysOfWeek: scheduleForm.daysOfWeek,
      plantingSeasonId: selectedSeason.plantingSeasonId,
      seasonName: selectedSeason.name,
      growthStageName: scheduleForm.growthStageName,
    });

    setIsScheduleModalOpen(false);
    setSuccessToast(`Đã khởi tạo Lịch tưới Mùa vụ mới cho [${selectedSeason.name}]!`);
    loadData();
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const toggleDayOfWeek = (day: string) => {
    if (scheduleForm.daysOfWeek.includes(day)) {
      setScheduleForm({ ...scheduleForm, daysOfWeek: scheduleForm.daysOfWeek.filter(d => d !== day) });
    } else {
      setScheduleForm({ ...scheduleForm, daysOfWeek: [...scheduleForm.daysOfWeek, day] });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
              CF3 CROP SEASON IRRIGATION
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="text-[#119653]" size={22} /> Quản lý Vụ mùa & Setup Lịch tưới Mùa vụ (Planting Seasons)
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Thiết lập lịch tưới Cron tự động thích ứng theo từng vụ canh tác và từng giai đoạn sinh trưởng của cây trồng (Ra hoa, Nuôi trái, Sinh trưởng).
          </p>
        </div>

        <Button className="font-bold" onClick={() => setIsSeasonModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Kích hoạt Vụ mùa Mới
        </Button>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Season Cards Grid */}
      <div className="space-y-4">
        {seasons.map(s => {
          const seasonSchedules = schedules.filter(sch => sch.plantingSeasonId === s.plantingSeasonId || sch.zoneId === s.zoneId);

          return (
            <div key={s.plantingSeasonId} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {s.cropName} ({s.varietyName || 'Chưa có dữ liệu giống'})
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{s.name}</h3>
                  <p className="text-xs text-slate-500">{s.zoneName || 'Chưa có dữ liệu Zone'}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Tiến độ sinh trưởng vụ mùa</span>
                  <span className="text-emerald-800 font-bold">{typeof s.progressPercent === 'number' ? `${s.progressPercent}%` : 'Chưa có dữ liệu'}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#119653] rounded-full transition-all duration-500" style={{ width: `${typeof s.progressPercent === 'number' ? s.progressPercent : 0}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                <div><span className="text-slate-500 block text-[10px]">Ngày bắt đầu</span><strong className="text-slate-900">{s.startDate}</strong></div>
                <div><span className="text-slate-500 block text-[10px]">Dự kiến thu hoạch</span><strong className="text-slate-900">{s.expectedEndDate}</strong></div>
                <div><span className="text-slate-500 block text-[10px]">Giai đoạn hiện tại</span><strong className="text-slate-900">{s.currentGrowthStageName || 'Chưa có dữ liệu'}</strong></div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px]">Số Lịch tưới Mùa vụ</span>
                  <strong className="text-emerald-700 font-bold">{seasonSchedules.length} Lịch hoạt động</strong>
                </div>
              </div>

              {/* Season Irrigation Schedules Embedded Section */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Droplets size={14} className="text-emerald-700" /> Lịch Tưới &amp; Vận Hành Canh Tác
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleOpenVietgapLog(s)} className="text-xs">
                      <FileText size={13} className="mr-1.5 text-emerald-700" /> Nhật Ký VietGAP &amp; Vật Tư
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenHarvest(s)} className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50">
                      <QrCode size={13} className="mr-1.5 text-amber-600" /> Thu Hoạch &amp; Mã QR
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleOpenSetupSchedule(s)}>
                      <Clock size={13} className="mr-1.5" /> Setup Lịch tưới
                    </Button>
                  </div>
                </div>

                {seasonSchedules.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Chưa có lịch tưới mùa vụ nào. Bấm nút phía trên để khởi tạo lịch tưới cho vụ này!</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {seasonSchedules.map(sch => (
                      <div key={sch.scheduleId} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs shadow-xs hover:border-emerald-300 transition-colors">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="flex items-center gap-1.5 text-sm">
                            <Clock size={14} className="text-emerald-600" /> {sch.name}
                          </span>
                          <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </div>

                        {/* Zone & Actuator information */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5 pb-1 border-b border-slate-100 flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            Khu vực: <strong className="text-slate-800">{s.zoneName || 'Chưa có dữ liệu Zone'}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span>
                            Thiết bị: <strong className="text-emerald-700">{sch.actuatorName || 'Chưa có dữ liệu thiết bị'}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono flex justify-between items-center pt-0.5">
                          <span>Giờ chạy: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                          <span>Thứ: <strong className="text-sky-700">{Array.isArray(sch.daysOfWeek) && sch.daysOfWeek.length > 0 ? sch.daysOfWeek.join(', ') : 'Hằng ngày'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Setup Season Irrigation Schedule */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={`Setup Lịch tưới Mùa vụ: "${selectedSeason?.name || ''}"`}>
        {selectedSeason && (
          <form onSubmit={handleSaveSeasonSchedule} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">{selectedSeason.name}</div>
              <div className="text-slate-500">{selectedSeason.zoneName} • Giai đoạn: <strong className="text-emerald-700">{selectedSeason.currentGrowthStageName}</strong></div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Tên Lịch tưới Mùa vụ *</label>
              <Input
                required
                value={scheduleForm.name}
                onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Giai đoạn Sinh trưởng *</label>
                <select
                  value={scheduleForm.growthStageName}
                  onChange={e => setScheduleForm({ ...scheduleForm, growthStageName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Cây non (Seedling)">Cây non (Seedling)</option>
                  <option value="Sinh trưởng (Vegetative)">Sinh trưởng (Vegetative)</option>
                  <option value="Ra hoa (Flowering)">Ra hoa (Flowering)</option>
                  <option value="Nuôi trái (Fruit Development)">Nuôi trái (Fruit Development)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chọn Thiết bị Chấp hành (Rơ-le) *</label>
                <select
                  value={scheduleForm.actuatorId}
                  onChange={e => setScheduleForm({ ...scheduleForm, actuatorId: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                >
                  {actuators.filter(a => a.zoneId === selectedSeason.zoneId).length === 0 ? (
                    <option value="default-pump">Máy bơm tưới nhỏ giọt tiêu chuẩn (Mặc định)</option>
                  ) : (
                    actuators
                      .filter(a => a.zoneId === selectedSeason.zoneId)
                      .map((a, idx) => {
                        const actKey = a.actuatorId || (a as any).id || (a as any).code || `actuator-${idx}`;
                        return (
                          <option key={actKey} value={actKey}>
                            {a.name || 'Thiết bị chấp hành'} ({a.actuatorCode || actKey})
                          </option>
                        );
                      })
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Giờ Bắt đầu (Cron Start Time) *</label>
                <Input
                  type="time"
                  required
                  value={scheduleForm.startTime}
                  onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Thời lượng Tưới (Phút - Max 30) *</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={scheduleForm.durationMinutes}
                  onChange={e => setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-2">Tần suất Lặp lại trong Tuần (Days of Week):</label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                  const isChecked = scheduleForm.daysOfWeek.includes(day);

                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDayOfWeek(day)}
                      className={`px-3 py-1.5 rounded-lg border font-mono font-bold transition-all ${
                        isChecked ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
              <strong className="block font-bold">Kích hoạt Tự động hóa & Failsafe Timer:</strong>
              <p className="text-[11px] leading-tight">
                Lịch tưới mùa vụ sau khi lưu sẽ tự động đăng ký với Quartz Cron Engine (`BR-SCH-01`) và kích hoạt quy tắc hoãn khi mưa (`BR-WEATHER-01`).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" type="button" onClick={() => setIsScheduleModalOpen(false)}>Hủy</Button>
              <Button variant="primary" type="submit">Lưu & Kích hoạt Lịch tưới Mùa vụ</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Kích hoạt Vụ mùa Mới */}
      <Modal isOpen={isSeasonModalOpen} onClose={() => setIsSeasonModalOpen(false)} title="Kích hoạt Vụ mùa Canh tác Mới">
        <form onSubmit={handleCreateSeason} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Vụ mùa (Season Name) *</label>
            <Input
              required
              value={seasonForm.name}
              onChange={e => setSeasonForm({ ...seasonForm, name: e.target.value })}
              placeholder="VD: Demo Season 2026, Vụ Cà Chua Đông Xuân..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Cây trồng *</label>
              <Input
                required
                value={seasonForm.cropName}
                onChange={e => setSeasonForm({ ...seasonForm, cropName: e.target.value })}
                placeholder="VD: Dưa leo Baby, Cà chua Cherry..."
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Giống cây (Variety)</label>
              <Input
                value={seasonForm.varietyName}
                onChange={e => setSeasonForm({ ...seasonForm, varietyName: e.target.value })}
                placeholder="VD: Giống VietGAP, F1 Thái Lan..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Khu vực / Nhà kính *</label>
              <Input
                required
                value={seasonForm.zoneName}
                onChange={e => setSeasonForm({ ...seasonForm, zoneName: e.target.value })}
                placeholder="VD: Demo Greenhouse Zone (Zone 1)"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Giai đoạn ban đầu *</label>
              <select
                value={seasonForm.growthStageName}
                onChange={e => setSeasonForm({ ...seasonForm, growthStageName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Cây non (Seedling)">Cây non (Seedling)</option>
                <option value="Sinh trưởng (Vegetative)">Sinh trưởng (Vegetative)</option>
                <option value="Ra hoa (Flowering)">Ra hoa (Flowering)</option>
                <option value="Nuôi trái (Fruit Development)">Nuôi trái (Fruit Development)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Ngày bắt đầu *</label>
              <Input
                type="date"
                required
                value={seasonForm.startDate}
                onChange={e => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dự kiến thu hoạch *</label>
              <Input
                type="date"
                required
                value={seasonForm.expectedEndDate}
                onChange={e => setSeasonForm({ ...seasonForm, expectedEndDate: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
            <strong className="block font-bold">Tự động cấu hình vi khí hậu & Failsafe:</strong>
            <p className="text-[11px] leading-tight">
              Khi kích hoạt vụ mùa mới, hệ thống tự động gắn hồ sơ sinh trưởng tiêu chuẩn và sẵn sàng đồng bộ các lịch tưới mùa vụ tự động theo giai đoạn.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsSeasonModalOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit">Kích hoạt Vụ mùa</Button>
          </div>
        </form>
      </Modal>

      {/* Modal 1: Ghi Nhận Thu Hoạch & Tạo Tem Mã QR Truy Xuất */}
      <Modal
        isOpen={isHarvestModalOpen}
        onClose={() => setIsHarvestModalOpen(false)}
        title={`Ghi Nhận Thu Hoạch & Sinh Mã QR Truy Xuất: "${selectedSeason?.name || ''}"`}
      >
        <div className="space-y-4 text-xs">
          {!harvestSaved ? (
            <form onSubmit={handleSaveHarvest} className="space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block text-[10px]">Cây trồng & Vụ mùa:</span>
                <strong className="text-slate-900 text-sm">{selectedSeason?.cropName} ({selectedSeason?.varietyName})</strong>
                <p className="text-[11px] text-slate-500 mt-0.5">Khu vực: {selectedSeason?.zoneName} • Tiêu chuẩn VietGAP TCVN 11892-1:2017</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ngày Thu Hoạch *</label>
                  <Input
                    type="date"
                    required
                    value={harvestForm.harvestDate}
                    onChange={e => setHarvestForm({ ...harvestForm, harvestDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tổng Sản Lượng (kg) *</label>
                  <Input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={harvestForm.totalYieldKg}
                    onChange={e => setHarvestForm({ ...harvestForm, totalYieldKg: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <div>
                  <label className="block text-emerald-900 font-bold text-[11px] mb-1">Loại 1 (VIP - kg)</label>
                  <Input
                    type="number"
                    min="0"
                    value={harvestForm.gradeAKg}
                    onChange={e => setHarvestForm({ ...harvestForm, gradeAKg: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-emerald-900 font-bold text-[11px] mb-1">Loại 2 (Thường - kg)</label>
                  <Input
                    type="number"
                    min="0"
                    value={harvestForm.gradeBKg}
                    onChange={e => setHarvestForm({ ...harvestForm, gradeBKg: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-rose-900 font-bold text-[11px] mb-1">Hao hụt/Loại (kg)</label>
                  <Input
                    type="number"
                    min="0"
                    value={harvestForm.scrapKg}
                    onChange={e => setHarvestForm({ ...harvestForm, scrapKg: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Giá Bán Dự Kiến (VNĐ/kg)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={harvestForm.unitPrice}
                    onChange={e => setHarvestForm({ ...harvestForm, unitPrice: Number(e.target.value) })}
                  />
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Doanh Thu Dự Kiến:</span>
                  <span className="text-base font-black text-emerald-700">
                    {((harvestForm.gradeAKg + harvestForm.gradeBKg) * harvestForm.unitPrice).toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Ghi Chú Nghiệm Thu / Độ Ngọt Brix</label>
                <Input
                  value={harvestForm.notes}
                  onChange={e => setHarvestForm({ ...harvestForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="ghost" type="button" onClick={() => setIsHarvestModalOpen(false)}>Hủy</Button>
                <Button variant="primary" type="submit" className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5">
                  <QrCode size={15} /> Lưu &amp; Sinh Tem QR Truy Xuất
                </Button>
              </div>
            </form>
          ) : (
            /* Printable QR Label Tag Preview */
            <div className="space-y-4">
              <div className="p-5 bg-white border-2 border-dashed border-emerald-500 rounded-2xl shadow-sm text-center space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full font-bold text-xs uppercase tracking-wide">
                  <Check size={14} /> Tem Truy Xuất Nguồn Gốc VietGAP
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">{selectedSeason?.cropName}</h3>
                  <p className="text-xs text-slate-600 font-medium">Giống: {selectedSeason?.varietyName || 'Cao Sản F1'} • {selectedSeason?.zoneName}</p>
                </div>

                {/* Simulated QR Code Graphic */}
                <div className="flex justify-center py-2">
                  <div className="p-3 bg-white border border-slate-300 rounded-xl shadow-xs inline-block">
                    <div className="w-32 h-32 bg-slate-900 p-2 rounded-lg flex flex-col justify-between items-center text-white">
                      <div className="flex justify-between w-full">
                        <div className="w-6 h-6 border-2 border-white rounded flex items-center justify-center"><div className="w-3 h-3 bg-white" /></div>
                        <div className="w-6 h-6 border-2 border-white rounded flex items-center justify-center"><div className="w-3 h-3 bg-white" /></div>
                      </div>
                      <div className="text-[9px] font-mono font-bold tracking-widest text-emerald-400">SMARTFARM</div>
                      <div className="flex justify-between w-full">
                        <div className="w-6 h-6 border-2 border-white rounded flex items-center justify-center"><div className="w-3 h-3 bg-white" /></div>
                        <div className="w-3 h-3 bg-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>Mã Lô Thu Hoạch:</span><strong className="font-mono text-emerald-700">LOT-VIE-2026-H01</strong></div>
                  <div className="flex justify-between"><span>Ngày Thu Hoạch:</span><strong>{harvestForm.harvestDate}</strong></div>
                  <div className="flex justify-between"><span>Sản Lượng Đóng Gói:</span><strong>{harvestForm.totalYieldKg} kg (Hạng A: {harvestForm.gradeAKg}kg)</strong></div>
                  <div className="flex justify-between"><span>Thời Gian Cách Ly PHI:</span><strong className="text-emerald-700">Đã đảm bảo 7 ngày</strong></div>
                  <div className="flex justify-between"><span>Tiêu Chuẩn:</span><strong>TCVN 11892-1:2017</strong></div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsHarvestModalOpen(false)}>Đóng</Button>
                <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                  <Printer size={15} /> In Tem Nhãn Bao Bì
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 2: Nhật Ký Canh Tác Điện Tử & Hồ Sơ VietGAP */}
      <Modal
        isOpen={isVietgapLogModalOpen}
        onClose={() => setIsVietgapLogModalOpen(false)}
        title={`Nhật Ký Canh Tác & Hồ Sơ Thẩm Định VietGAP: "${selectedSeason?.name || ''}"`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-bold text-emerald-950 text-sm">Hồ Sơ Canh Tác Chuẩn VietGAP (TCVN 11892-1:2017)</div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Vụ: {selectedSeason?.name} • Khu vực: {selectedSeason?.zoneName} • Cây trồng: {selectedSeason?.cropName}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ 100% Tuân Thủ
            </span>
          </div>

          {/* Farming Log Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                  <th className="p-2.5">Ngày</th>
                  <th className="p-2.5">Hoạt Động / Công Việc</th>
                  <th className="p-2.5">Vật Tư &amp; Mã Lô (Lot #)</th>
                  <th className="p-2.5">Liều Lượng</th>
                  <th className="p-2.5">Cách Ly (PHI)</th>
                  <th className="p-2.5">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-15</td>
                  <td className="p-2.5 font-medium text-slate-900">Bón lót chuẩn bị luống</td>
                  <td className="p-2.5">Phân trùn quế vi sinh <span className="font-mono text-emerald-700">(LOT-TQ-01)</span></td>
                  <td className="p-2.5">0.5 kg/m²</td>
                  <td className="p-2.5 font-bold text-emerald-700">0 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-18</td>
                  <td className="p-2.5 font-medium text-slate-900">Phun phòng nấm sinh học</td>
                  <td className="p-2.5">Chế phẩm Trichoderma <span className="font-mono text-emerald-700">(LOT-BIO-02)</span></td>
                  <td className="p-2.5">10 ml/m²</td>
                  <td className="p-2.5 font-bold text-emerald-700">3 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-20</td>
                  <td className="p-2.5 font-medium text-slate-900">Tưới phân hữu cơ hòa tan</td>
                  <td className="p-2.5">NPK Hữu Cơ Rong Biển <span className="font-mono text-emerald-700">(LOT-NPK-04)</span></td>
                  <td className="p-2.5">5 g/gốc</td>
                  <td className="p-2.5 font-bold text-emerald-700">7 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-600 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <CheckCircle2 size={15} className="text-emerald-600" /> Hồ Sơ Sẵn Sàng Thẩm Định
            </div>
            <p>
              Nhật ký được đối soát chéo tự động với phiếu xuất kho vật tư và lệnh điều khiển máy bơm IoT. Không phát hiện vi phạm dư lượng hóa chất độc hại.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsVietgapLogModalOpen(false)}>Đóng</Button>
            <Button onClick={() => window.print()} className="bg-[#119653] hover:bg-[#0e8046] text-white flex items-center gap-1.5 font-bold">
              <Printer size={15} /> Xuất Hồ Sơ Thẩm Định VietGAP (In / PDF)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
