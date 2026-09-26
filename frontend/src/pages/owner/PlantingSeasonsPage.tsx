import React, { useState, useEffect } from 'react';
import { mockPlantingSeasons, mockActuators } from '../../mocks/mockData';
import { Calendar, Plus, Clock, CheckCircle2, Sliders, Droplets, Radio, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { controlService } from '../../services';
import { PlantingSeason, ControlSchedule, Actuator } from '../../types';

export const PlantingSeasonsPage: React.FC = () => {
  const [seasons, setSeasons] = useState<PlantingSeason[]>(mockPlantingSeasons);
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<PlantingSeason | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
    const [allSchedules, allActuators] = await Promise.all([
      controlService.getSchedules(),
      controlService.getActuators(),
    ]);
    setSchedules(allSchedules);
    setActuators(allActuators);
  };

  useEffect(() => {
    loadData();
  }, []);

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

        <Button className="font-bold">
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
                      <div key={sch.scheduleId} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <Clock size={13} className="text-emerald-600" /> {sch.name}
                          </span>
                          <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex justify-between pt-1">
                          <span>Giờ chạy: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                          <span>Thứ: <strong className="text-sky-700">{sch.daysOfWeek.join(', ')}</strong></span>
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
                  {actuators.filter(a => a.zoneId === selectedSeason.zoneId).map(a => (
                    <option key={a.actuatorId} value={a.actuatorId}>
                      {a.name} ({a.actuatorCode})
                    </option>
                  ))}
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
    </div>
  );
};
