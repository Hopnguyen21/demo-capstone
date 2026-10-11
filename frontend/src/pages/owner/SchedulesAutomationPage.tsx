import React, { useState, useEffect } from 'react';
import { controlService, deviceService } from '../../services';
import { ControlSchedule, AutomationRule, Actuator } from '../../types';
import { Calendar, Sliders, Plus, Clock, Cpu, CheckCircle2, Trash2, Power, AlertCircle } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { useAuth } from '../../app/providers/AuthContext';

export const SchedulesAutomationPage: React.FC = () => {
  const { zones } = useAuth();
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Schedule Form
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    zoneId: '',
    actuatorId: '',
    startTime: '06:30',
    durationMinutes: 15,
    cronExpression: '30 6 * * *',
    daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  });

  // Rule Form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    zoneId: '',
    parameterCode: 'SOIL_MOISTURE',
    operator: '<',
    thresholdValue: 60,
    actuatorId: '',
    actionType: 'TURN_ON',
    actionDurationMinutes: 15,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [schData, ruleData, actData] = await Promise.all([
        controlService.getSchedules().catch(() => []),
        controlService.getAutoRules().catch(() => []),
        deviceService.getActuators().catch(() => []),
      ]);
      if (Array.isArray(schData)) setSchedules(schData);
      if (Array.isArray(ruleData)) setRules(ruleData);
      if (Array.isArray(actData)) setActuators(actData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (zones.length > 0) {
      const defaultZone = zones[0].zoneId;
      setScheduleForm(prev => ({ ...prev, zoneId: defaultZone }));
      setRuleForm(prev => ({ ...prev, zoneId: defaultZone }));
    }
    if (actuators.length > 0) {
      const defaultAct = actuators[0].actuatorId;
      setScheduleForm(prev => ({ ...prev, actuatorId: defaultAct }));
      setRuleForm(prev => ({ ...prev, actuatorId: defaultAct }));
    }
  }, [zones, actuators]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const zoneId = scheduleForm.zoneId || zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
      const [hour, min] = scheduleForm.startTime.split(':');
      const cron = `${min || '0'} ${hour || '6'} * * *`;

      await controlService.createSeasonSchedule(zoneId, {
        name: scheduleForm.name,
        actuatorId: scheduleForm.actuatorId || actuators[0]?.actuatorId || 'act-01',
        cronExpression: cron,
        durationSeconds: scheduleForm.durationMinutes * 60,
        actionType: 'TURN_ON',
        isActive: true,
      });

      setNotification(`Đã tạo lịch tưới "${scheduleForm.name}" thành công!`);
      setIsScheduleModalOpen(false);
      setScheduleForm({
        name: '',
        zoneId: zones[0]?.zoneId || '',
        actuatorId: actuators[0]?.actuatorId || '',
        startTime: '06:30',
        durationMinutes: 15,
        cronExpression: '30 6 * * *',
        daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
      });
      await loadData();
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const zoneId = ruleForm.zoneId || zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
      await controlService.createAutoRule(zoneId, {
        name: ruleForm.name,
        parameterCode: ruleForm.parameterCode,
        operator: ruleForm.operator,
        thresholdValue: Number(ruleForm.thresholdValue),
        actuatorId: ruleForm.actuatorId || actuators[0]?.actuatorId || 'act-01',
        actionType: ruleForm.actionType,
        actionDurationMinutes: Number(ruleForm.actionDurationMinutes),
        isActive: true,
      });

      setNotification(`Đã thiết lập bộ luật vi khí hậu "${ruleForm.name}" thành công!`);
      setIsRuleModalOpen(false);
      setRuleForm({
        name: '',
        zoneId: zones[0]?.zoneId || '',
        parameterCode: 'SOIL_MOISTURE',
        operator: '<',
        thresholdValue: 60,
        actuatorId: actuators[0]?.actuatorId || '',
        actionType: 'TURN_ON',
        actionDurationMinutes: 15,
      });
      await loadData();
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveSchedule = async (scheduleId: string, zoneId?: string) => {
    const targetZone = zoneId || zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001';
    try {
      await controlService.archiveSchedule(targetZone, scheduleId);
      setNotification('Đã gỡ bỏ lịch tưới định kỳ!');
      await loadData();
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-[#062326]" size={22} /> Lập lịch Định kỳ & Luật Tự động hóa (Schedules & Auto-Rules)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Cấu hình lịch tưới Cron và thiết lập bộ luật tự động WHEN-IF-THEN thích ứng theo cây trồng.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsScheduleModalOpen(true)}>
            <Plus size={16} className="mr-1.5" /> Tạo Lịch Cron Mới
          </Button>
          <Button variant="outline" onClick={() => setIsRuleModalOpen(true)}>
            <Sliders size={16} className="mr-1.5" /> Thiết lập Luật Tự động
          </Button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Schedules Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock size={16} className="text-[#062326]" /> Lịch Tưới Định kỳ (Cron Schedules)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Tổng cộng: {schedules.length} lịch</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map(sch => (
            <div key={sch.scheduleId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 hover:border-[#062326]/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#062326]">{sch.name}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <button
                    onClick={() => handleArchiveSchedule(sch.scheduleId, sch.zoneId)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Xóa lịch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-600">{sch.zoneName || 'Nhà màng'} - {sch.actuatorName || 'Van tưới tự động'}</div>
              <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200 font-mono">
                <span>Khởi chạy: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                <span>Lặp lại: <strong className="text-emerald-700">{Array.isArray(sch.daysOfWeek) && sch.daysOfWeek.length > 0 ? sch.daysOfWeek.join(', ') : 'Hằng ngày'}</strong></span>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <div className="col-span-2 text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Chưa có lịch tưới định kỳ nào. Bấm "Tạo Lịch Cron Mới" để thêm.
            </div>
          )}
        </div>
      </div>

      {/* Visual WHEN-IF-THEN Automation Rules Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders size={16} className="text-sky-700" /> Bộ luật Tự động hóa Vi khí hậu (Rule Engine)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Tổng cộng: {rules.length} bộ luật</span>
        </div>

        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.ruleId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-sky-300 transition-all">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{rule.name}</h4>
                  <StatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <div className="text-xs text-slate-600 mt-1 font-mono">
                  KHI <span className="text-[#062326] font-bold">{rule.parameterCode}</span> {rule.operator} <span className="text-amber-700 font-bold">{rule.thresholdValue}</span> THÌ KÍCH HOẠT <span className="text-sky-700 font-bold">{rule.actuatorName || 'Thiết bị'} ({rule.actionType})</span> TRONG {rule.actionDurationMinutes} PHÚT
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2.5 py-1 bg-emerald-100/70 text-[#062326] font-semibold rounded-lg border border-emerald-200">
                  Auto-Protection Active
                </span>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Chưa có bộ luật tự động hóa nào. Bấm "Thiết lập Luật Tự động" để thêm.
            </div>
          )}
        </div>
      </div>

      {/* Modal Create Schedule */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Tạo Lịch Tưới Định Kỳ Mới (Cron Schedule)">
        <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tên lịch tưới</label>
            <Input
              required
              placeholder="VD: Tưới ẩm đầu buổi sáng cà chua"
              value={scheduleForm.name}
              onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Khu vực (Zone)</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={scheduleForm.zoneId}
                onChange={e => setScheduleForm({ ...scheduleForm, zoneId: e.target.value })}
              >
                {zones.map(z => (
                  <option key={z.zoneId} value={z.zoneId}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Thiết bị Rơ-le (Actuator)</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={scheduleForm.actuatorId}
                onChange={e => setScheduleForm({ ...scheduleForm, actuatorId: e.target.value })}
              >
                {actuators.map(a => (
                  <option key={a.actuatorId} value={a.actuatorId}>{a.name} ({a.actuatorType || (a as any).type})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Giờ bắt đầu</label>
              <Input
                type="time"
                required
                value={scheduleForm.startTime}
                onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Thời lượng tưới (phút)</label>
              <Input
                type="number"
                min={1}
                max={120}
                required
                value={scheduleForm.durationMinutes}
                onChange={e => setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsScheduleModalOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu Lịch Định Kỳ</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Create Rule */}
      <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} title="Thiết Lập Bộ Luật Tự Động Vi Khí Hậu (IF-THEN)">
        <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tên bộ luật</label>
            <Input
              required
              placeholder="VD: Cứu hạn độ ẩm đất khi dưới 50%"
              value={ruleForm.name}
              onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Chỉ số cảm biến</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={ruleForm.parameterCode}
                onChange={e => setRuleForm({ ...ruleForm, parameterCode: e.target.value })}
              >
                <option value="SOIL_MOISTURE">Độ ẩm đất (Soil Moisture)</option>
                <option value="TEMPERATURE">Nhiệt độ không khí (°C)</option>
                <option value="AIR_HUMIDITY">Độ ẩm không khí (%)</option>
                <option value="LIGHT_INTENSITY">Cường độ ánh sáng (Lux)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Toán tử so sánh</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={ruleForm.operator}
                onChange={e => setRuleForm({ ...ruleForm, operator: e.target.value })}
              >
                <option value="<">Nhỏ hơn (&lt;)</option>
                <option value="<=">Nhỏ hơn hoặc bằng (&le;)</option>
                <option value=">">Lớn hơn (&gt;)</option>
                <option value=">=">Lớn hơn hoặc bằng (&ge;)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ngưỡng kích hoạt</label>
              <Input
                type="number"
                required
                value={ruleForm.thresholdValue}
                onChange={e => setRuleForm({ ...ruleForm, thresholdValue: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Thiết bị Rơ-le kích hoạt</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={ruleForm.actuatorId}
                onChange={e => setRuleForm({ ...ruleForm, actuatorId: e.target.value })}
              >
                {actuators.map(a => (
                  <option key={a.actuatorId} value={a.actuatorId}>{a.name} ({a.actuatorType || (a as any).type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hành động</label>
              <select
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                value={ruleForm.actionType}
                onChange={e => setRuleForm({ ...ruleForm, actionType: e.target.value })}
              >
                <option value="TURN_ON">Bật (TURN_ON)</option>
                <option value="TURN_OFF">Tắt (TURN_OFF)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Thời gian duy trì tác vụ (phút)</label>
            <Input
              type="number"
              min={1}
              max={180}
              required
              value={ruleForm.actionDurationMinutes}
              onChange={e => setRuleForm({ ...ruleForm, actionDurationMinutes: Number(e.target.value) })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsRuleModalOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu Bộ Luật Tự Động</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
