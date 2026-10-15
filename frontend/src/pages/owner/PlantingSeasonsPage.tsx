import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, Sliders, Droplets, Radio, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { controlService, seasonService } from '../../services';
import { PlantingSeason, ControlSchedule, Actuator } from '../../types';

export const PlantingSeasonsPage: React.FC = () => {
  const DEFAULT_INITIAL_SEASONS: PlantingSeason[] = [
    {
      plantingSeasonId: 'season-demo-2026',
      zoneId: '32000000-0000-0000-0000-000000000001',
      zoneName: 'Demo Greenhouse Zone (Zone 1)',
      farmId: '30000000-0000-0000-0000-000000000001',
      cropId: 'crop-001',
      cropName: 'Dưa leo Baby VietGAP',
      varietyId: 'var-001',
      varietyName: 'Giống VietGAP',
      growthProfileId: 'gp-001',
      name: 'Demo Season 2026',
      startDate: '2026-09-28',
      expectedEndDate: '2026-12-28',
      currentGrowthStageId: 'stage-flowering',
      currentGrowthStageName: 'Ra hoa (Flowering)',
      status: 'ACTIVE',
      progressPercent: 45,
    },
  ];

  const DEFAULT_INITIAL_SCHEDULES: ControlSchedule[] = [
    {
      scheduleId: 'sch-season-01',
      zoneId: '32000000-0000-0000-0000-000000000001',
      actuatorId: 'act-01',
      name: 'Tưới nhỏ giọt buổi sáng',
      startTime: '06:00',
      durationMinutes: 10,
      daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      actionType: 'TURN_ON',
      isActive: true,
      plantingSeasonId: 'season-demo-2026',
      seasonName: 'Demo Season 2026',
      growthStageName: 'Ra hoa (Flowering)',
    },
    {
      scheduleId: 'sch-season-02',
      zoneId: '32000000-0000-0000-0000-000000000001',
      actuatorId: 'act-02',
      name: 'Tưới phun sương hạ nhiệt chiều',
      startTime: '14:00',
      durationMinutes: 5,
      daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      actionType: 'TURN_ON',
      isActive: true,
      plantingSeasonId: 'season-demo-2026',
      seasonName: 'Demo Season 2026',
      growthStageName: 'Ra hoa (Flowering)',
    },
  ];

  const [seasons, setSeasons] = useState<PlantingSeason[]>(DEFAULT_INITIAL_SEASONS);
  const [schedules, setSchedules] = useState<ControlSchedule[]>(DEFAULT_INITIAL_SCHEDULES);
  const [selectedSeason, setSelectedSeason] = useState<PlantingSeason | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState<boolean>(false);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
      const [allSeasons, allSchedules, allActuators] = await Promise.all([
        seasonService.getSeasons().catch(() => []),
        controlService.getSchedules().catch(() => []),
        controlService.getActuators().catch(() => []),
      ]);
      if (Array.isArray(allSeasons) && allSeasons.length > 0) setSeasons(allSeasons);
      if (Array.isArray(allSchedules) && allSchedules.length > 0) setSchedules(allSchedules);
      if (Array.isArray(allActuators) && allActuators.length > 0) setActuators(allActuators);
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
      actuatorId: zoneActuators[0]?.actuatorId || actuators[0]?.actuatorId || 'act-01',
      startTime: '07:30',
      durationMinutes: 20,
      daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
      growthStageName: season.currentGrowthStageName || 'Ra hoa (Flowering)',
      targetSoilMoisture: 65,
    });
    setIsScheduleModalOpen(true);
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
              CF3 CROP SEASON IRRIGATION
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="text-[#062326]" size={22} /> Quản lý Vụ mùa & Setup Lịch tưới Mùa vụ (Planting Seasons)
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
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#062326] border border-emerald-200">
                    {s.cropName} ({s.varietyName || 'Giống VietGAP'})
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{s.name}</h3>
                  <p className="text-xs text-slate-500">{s.zoneName}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Tiến độ sinh trưởng vụ mùa</span>
                  <span className="text-[#062326] font-bold">{s.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#062326] rounded-full transition-all duration-500" style={{ width: `${s.progressPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                <div><span className="text-slate-500 block text-[10px]">Ngày bắt đầu</span><strong className="text-slate-900">{s.startDate}</strong></div>
                <div><span className="text-slate-500 block text-[10px]">Dự kiến thu hoạch</span><strong className="text-slate-900">{s.expectedEndDate}</strong></div>
                <div><span className="text-slate-500 block text-[10px]">Giai đoạn hiện tại</span><strong className="text-[#062326]">{s.currentGrowthStageName}</strong></div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px]">Số Lịch tưới Mùa vụ</span>
                  <strong className="text-emerald-700 font-bold">{seasonSchedules.length} Lịch hoạt động</strong>
                </div>
              </div>

              {/* Season Irrigation Schedules Embedded Section */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Droplets size={14} className="text-emerald-700" /> Các Lịch Tưới Đang Chạy cho Vụ này
                  </h4>
                  <Button size="sm" variant="primary" onClick={() => handleOpenSetupSchedule(s)}>
                    <Clock size={13} className="mr-1.5" /> Setup Lịch tưới Mùa vụ
                  </Button>
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
                            Khu vực: <strong className="text-slate-800">{s.zoneName || 'Demo Greenhouse Zone (Zone 1)'}</strong>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span>
                            Thiết bị: <strong className="text-emerald-700">{sch.actuatorName || (sch.actuatorId === 'act-01' ? 'Máy bơm tưới nhỏ giọt P-01' : 'Hệ thống phun sương F-02')}</strong>
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
    </div>
  );
};
