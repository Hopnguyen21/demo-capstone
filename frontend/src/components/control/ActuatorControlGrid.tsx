import React, { useState } from 'react';
import { 
  Power, ShieldAlert, CheckCircle2, AlertTriangle, 
  RotateCw, Droplets, Wind, Sun, Sliders, Clock, Zap, Cpu, Sparkles, Check
} from 'lucide-react';
import { Button, StatusBadge, Modal } from '../ui/BaseUI';
import { Actuator } from '../../types';

interface ActuatorControlGridProps {
  actuators: Actuator[];
  onToggleActuator: (actuatorId: string, targetState: 'ON' | 'OFF', durationMinutes?: number) => Promise<void>;
  isProcessing?: boolean;
}

export const ActuatorControlGrid: React.FC<ActuatorControlGridProps> = ({
  actuators,
  onToggleActuator,
  isProcessing = false,
}) => {
  const [demoActuators, setDemoActuators] = useState<Actuator[]>([]);
  const [selectedActuator, setSelectedActuator] = useState<Actuator | null>(null);
  const [targetState, setTargetState] = useState<'ON' | 'OFF'>('ON');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [interlockError, setInterlockError] = useState<string | null>(null);

  // Combine real actuators or demo actuators if empty
  const effectiveActuators = actuators.length > 0 ? actuators : demoActuators;

  const handleInitDemoActuators = () => {
    setDemoActuators([
      {
        actuatorId: 'demo-pump-01',
        actuatorCode: 'PUMP-MAIN',
        name: 'Máy bơm tưới nhỏ giọt chính 1.5HP (Main Drip Pump)',
        actuatorType: 'PUMP',
        status: 'OFF',
        zoneName: 'Zone Canh tác',
        lastStateChangeAt: 'Hôm nay 08:30:12',
        ratedPowerWatt: 1100,
        relayChannel: 1,
      } as Actuator,
      {
        actuatorId: 'demo-valve-01',
        actuatorCode: 'VALVE-SOL',
        name: 'Van điện từ Solenoid cấp dinh dưỡng phân bón A/B',
        actuatorType: 'VALVE',
        status: 'ON',
        zoneName: 'Zone Canh tác',
        lastStateChangeAt: 'Hôm nay 10:15:00',
        ratedPowerWatt: 24,
        relayChannel: 2,
      } as Actuator,
      {
        actuatorId: 'demo-fan-01',
        actuatorCode: 'FAN-AIR',
        name: 'Quạt thông gió & đối lưu không khí vi khí hậu 200W',
        actuatorType: 'FAN',
        status: 'OFF',
        zoneName: 'Zone Canh tác',
        lastStateChangeAt: 'Hôm qua 16:45:00',
        ratedPowerWatt: 200,
        relayChannel: 3,
      } as Actuator,
    ]);
  };

  // Helper to check interlock safety rule (BR-INTERLOCK-01: Disallow >= 2 pumps >= 500W simultaneously)
  const checkInterlockSafety = (actuator: Actuator, state: 'ON' | 'OFF'): boolean => {
    if (state === 'OFF') return true;
    if (actuator.actuatorType !== 'PUMP') return true;

    // Check if another pump is currently running ON
    const otherPumpsRunning = effectiveActuators.filter(a => 
      a.actuatorId !== actuator.actuatorId && 
      a.actuatorType === 'PUMP' && 
      a.status === 'ON'
    );

    if (otherPumpsRunning.length >= 1) {
      setInterlockError(`BR-INTERLOCK-01: Cấm kích hoạt đồng thời 2 bơm công suất lớn trong cùng hệ thống. Bơm [${otherPumpsRunning[0].name}] đang hoạt động!`);
      return false;
    }

    setInterlockError(null);
    return true;
  };

  const handleRequestClick = (act: Actuator, state: 'ON' | 'OFF') => {
    setSelectedActuator(act);
    setTargetState(state);
    setDurationMinutes(15);
    checkInterlockSafety(act, state);
    setIsModalOpen(true);
  };

  const confirmAndExecute = async () => {
    if (!selectedActuator) return;
    if (targetState === 'ON' && !checkInterlockSafety(selectedActuator, 'ON')) {
      return;
    }
    setIsModalOpen(false);

    // If in demo mode, update local demo state
    if (demoActuators.some(d => d.actuatorId === selectedActuator.actuatorId)) {
      setDemoActuators(prev => prev.map(d => {
        if (d.actuatorId === selectedActuator.actuatorId) {
          return {
            ...d,
            status: targetState,
            lastStateChangeAt: `Vừa xong (${new Date().toLocaleTimeString('vi-VN')})`,
          };
        }
        return d;
      }));
      return;
    }

    await onToggleActuator(selectedActuator.actuatorId, targetState, durationMinutes);
  };

  const getActuatorTypeIcon = (type: Actuator['actuatorType'], isOn: boolean) => {
    switch (type) {
      case 'PUMP':
        return (
          <div className={`p-2.5 rounded-xl border transition-all ${
            isOn ? 'bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/30' : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}>
            <Droplets size={22} className={isOn ? 'animate-pulse' : ''} />
          </div>
        );
      case 'VALVE':
        return (
          <div className={`p-2.5 rounded-xl border transition-all ${
            isOn ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <Zap size={22} className={isOn ? 'animate-bounce' : ''} />
          </div>
        );
      case 'FAN':
        return (
          <div className={`p-2.5 rounded-xl border transition-all ${
            isOn ? 'bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Wind size={22} className={isOn ? 'animate-spin' : ''} />
          </div>
        );
      case 'GROW_LIGHT':
        return (
          <div className={`p-2.5 rounded-xl border transition-all ${
            isOn ? 'bg-purple-500 text-white border-purple-400 shadow-sm shadow-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}>
            <Sun size={22} />
          </div>
        );
      default:
        return (
          <div className={`p-2.5 rounded-xl border transition-all ${
            isOn ? 'bg-[#062326] text-emerald-400 border-emerald-500' : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            <Sliders size={22} />
          </div>
        );
    }
  };

  const onCount = effectiveActuators.filter(a => a.status === 'ON').length;
  const offCount = effectiveActuators.filter(a => a.status === 'OFF').length;

  return (
    <div className="space-y-5">
      {/* Visual Summary Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Cpu size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng Rơ-le</div>
            <div className="text-lg font-bold text-slate-900">{effectiveActuators.length} Thiết bị</div>
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Power size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Đang Bật (ON)
            </div>
            <div className="text-lg font-bold text-emerald-900">{onCount} Đang hoạt động</div>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
            <Power size={20} className="opacity-60" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Đang Tắt (OFF)</div>
            <div className="text-lg font-bold text-slate-800">{offCount} Sẵn sàng</div>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Failsafe Timer</div>
            <div className="text-sm font-bold text-amber-950">Tối đa 30 Phút</div>
          </div>
        </div>
      </div>

      {/* Main Grid Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
            <Power className="text-[#062326]" size={18} />
            Điều khiển Trực tiếp Thiết bị Chấp hành (Actuators Control Grid)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Bật/tắt rơ-le chấp hành thủ công qua chuẩn giao tiếp LoRa Gateway kèm bảo vệ Interlock & Hardware Failsafe Timer.
          </p>
        </div>
        
        {effectiveActuators.length > 0 && demoActuators.length > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 shrink-0 self-start sm:self-auto flex items-center gap-1">
            <Sparkles size={12} /> Chế độ Rơ-le Mô phỏng
          </span>
        )}
      </div>

      {/* When Empty: High-End Empty State Card */}
      {effectiveActuators.length === 0 ? (
        <div className="p-8 md:p-12 bg-gradient-to-b from-slate-50 to-white rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-500 shadow-inner">
            <Zap size={32} className="text-emerald-700/60" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h4 className="text-base font-bold text-slate-900">
              Chưa có Rơ-le Điều khiển nào được kết nối tại Zone này
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Zone hiện tại chưa có module rơ-le phần cứng (bơm, van, quạt) liên kết với Gateway LoRa. 
              Bạn có thể kích hoạt các Rơ-le mẫu thử nghiệm để kiểm tra tính năng bật/tắt và bảo vệ an toàn ngay lập tức.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleInitDemoActuators}
              className="bg-[#062326] text-emerald-400 hover:bg-[#0a3539] font-bold shadow-md text-xs py-2.5 px-4"
            >
              <Sparkles size={15} className="mr-1.5 text-emerald-400" />
              Kích hoạt 3 Rơ-le Thử nghiệm (Demo Relays)
            </Button>
          </div>
        </div>
      ) : (
        /* Grid of Actuator Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {effectiveActuators.map(act => {
            const isOn = act.status === 'ON';
            const isError = act.status === 'ERROR';

            return (
              <div
                key={act.actuatorId}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 relative overflow-hidden ${
                  isOn
                    ? 'bg-gradient-to-b from-emerald-50/70 to-white border-emerald-400 shadow-md ring-2 ring-emerald-500/20'
                    : isError
                    ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Active Glow Accent Bar */}
                {isOn && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" />
                )}

                {/* Card Top: Type Icon, Code, Name, Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getActuatorTypeIcon(act.actuatorType, isOn)}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {act.actuatorCode}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          Kênh {act.relayChannel ?? 1}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1" title={act.name}>
                        {act.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {act.zoneName || 'Zone Canh tác'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isOn ? (
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" /> ON
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        OFF
                      </span>
                    )}
                  </div>
                </div>

                {/* Actuator Specs & Meta */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600 font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-sans">Công suất định mức:</span>
                    <span className="font-semibold text-slate-900">{act.ratedPowerWatt ?? 500} W</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-sans">Lần đổi trạng thái:</span>
                    <span className="text-slate-700 font-sans text-[11px]">{act.lastStateChangeAt || 'Chưa bật'}</span>
                  </div>
                </div>

                {/* Control Action Button */}
                <div className="pt-2">
                  {isOn ? (
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full font-bold shadow-xs py-2 text-xs flex items-center justify-center gap-1.5"
                      onClick={() => handleRequestClick(act, 'OFF')}
                      disabled={isProcessing}
                    >
                      <Power size={15} />
                      TẮT RƠ-LE NGAY (OFF)
                    </Button>
                  ) : (
                    <Button
                      variant="success"
                      size="sm"
                      className="w-full font-bold shadow-xs py-2 text-xs flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleRequestClick(act, 'ON')}
                      disabled={isProcessing}
                    >
                      <Power size={15} />
                      KÍCH HOẠT BẬT (LORA)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safety Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Xác nhận Lệnh Kích Hoạt Rơ-le (LoRa Downlink)"
      >
        {selectedActuator && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[#062326] text-emerald-400 font-bold font-mono text-xs">
                {selectedActuator.actuatorCode}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedActuator.name}</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Kênh Relay {selectedActuator.relayChannel ?? 1} • {selectedActuator.ratedPowerWatt ?? 500}W</p>
              </div>
            </div>

            {/* Interlock warning if any */}
            {interlockError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2 font-medium">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <strong className="text-rose-950">Vi phạm Luật An toàn Interlock:</strong>
                  <p className="mt-0.5 text-rose-800">{interlockError}</p>
                </div>
              </div>
            )}

            {/* Safety Failsafe Duration Slider */}
            {targetState === 'ON' && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-700" /> Hẹn giờ Tự Ngắt Failsafe (BR-SAFE-01)
                  </span>
                  <span className="text-amber-900 font-mono text-sm px-2 py-0.5 bg-white rounded border border-amber-300">
                    {durationMinutes} Phút
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <p className="text-[11px] text-amber-800 leading-tight">
                  Tối đa 30 phút/lần kích hoạt. Rơ-le tự ngắt cứng ngay cả khi mất kết nối mạng.
                </p>
              </div>
            )}

            <div className="p-3 bg-slate-100 rounded-xl text-slate-600 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span>Mức độ ưu tiên (Priority):</span>
                <strong className="text-emerald-800 font-sans">1 (Thủ công / Manual Override)</strong>
              </div>
              <div className="flex justify-between">
                <span>Giao thức Downlink:</span>
                <strong className="text-slate-900 font-sans">MQTT LoRa GW-ESP32-DL01</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                variant={targetState === 'ON' ? 'success' : 'danger'}
                onClick={confirmAndExecute}
                disabled={Boolean(targetState === 'ON' && interlockError)}
                className="font-bold"
              >
                Xác nhận {targetState === 'ON' ? 'BẬT RƠ-LE' : 'TẮT RƠ-LE'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
