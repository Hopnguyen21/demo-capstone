import React, { useState } from 'react';
import { 
  Power, ShieldAlert, CheckCircle2, AlertTriangle, 
  RotateCw, Droplets, Wind, Sun, Sliders, Clock, Zap 
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
  const [selectedActuator, setSelectedActuator] = useState<Actuator | null>(null);
  const [targetState, setTargetState] = useState<'ON' | 'OFF'>('ON');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [interlockError, setInterlockError] = useState<string | null>(null);

  // Helper to check interlock safety rule (BR-INTERLOCK-01: Disallow >= 2 pumps >= 500W simultaneously)
  const checkInterlockSafety = (actuator: Actuator, state: 'ON' | 'OFF'): boolean => {
    if (state === 'OFF') return true;
    if (actuator.actuatorType !== 'PUMP') return true;

    // Check if another pump is currently running ON
    const otherPumpsRunning = actuators.filter(a => 
      a.actuatorId !== actuator.actuatorId && 
      a.actuatorType === 'PUMP' && 
      a.status === 'ON'
    );

    if (otherPumpsRunning.length >= 1) {
      setInterlockError(`BR-INTERLOCK-01: Cấm kích hoạt đồng thời 2 bơm công suất lớn trong cùng trang trại. Bơm [${otherPumpsRunning[0].name}] đang hoạt động!`);
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
    await onToggleActuator(selectedActuator.actuatorId, targetState, durationMinutes);
  };

  const getActuatorTypeIcon = (type: Actuator['actuatorType']) => {
    switch (type) {
      case 'PUMP':
        return <Droplets className="text-sky-600" size={20} />;
      case 'VALVE':
        return <Zap className="text-emerald-600" size={20} />;
      case 'FAN':
        return <Wind className="text-amber-600" size={20} />;
      case 'GROW_LIGHT':
        return <Sun className="text-purple-600" size={20} />;
      default:
        return <Sliders className="text-[#062326]" size={20} />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Power className="text-[#062326]" size={18} />
            Điều khiển Trực tiếp Thiết bị Chấp hành (Actuators Control Grid)
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Bật/tắt rơ-le chấp hành thủ công qua chuẩn giao tiếp LoRa Gateway kèm bảo vệ Interlock & Hardware Failsafe Timer.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-slate-100 rounded-full border border-slate-200 text-slate-700 font-semibold">
          Tổng số: {actuators.length} Thiết bị
        </span>
      </div>

      {/* Grid of Actuator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actuators.map(act => {
          const isOn = act.status === 'ON';
          const isError = act.status === 'ERROR';

          return (
            <div
              key={act.actuatorId}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isOn
                  ? 'bg-emerald-50/40 border-emerald-300 shadow-md ring-1 ring-emerald-400'
                  : isError
                  ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl border shadow-xs ${
                    isOn ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-100 border-slate-200'
                  }`}>
                    {getActuatorTypeIcon(act.actuatorType)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-[#062326] border border-slate-200">
                      {act.actuatorCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">{act.name}</h4>
                    <p className="text-xs text-slate-500">{act.zoneName || 'Khu vực 01'}</p>
                  </div>
                </div>
                <StatusBadge status={act.status} />
              </div>

              {/* Actuator Specs & Last Change */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Loại rơ-le:</span>
                  <span className="font-semibold text-slate-900">{act.actuatorType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thay đổi lần cuối:</span>
                  <span className="text-slate-800">{act.lastStateChangeAt || 'Chưa bật'}</span>
                </div>
              </div>

              {/* Control Action Button */}
              <div className="pt-2">
                {isOn ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full font-bold shadow-xs"
                    onClick={() => handleRequestClick(act, 'OFF')}
                    disabled={isProcessing}
                  >
                    <Power size={14} className="mr-1.5" />
                    TẮT THIẾT BỊ NGAY
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    className="w-full font-bold shadow-xs"
                    onClick={() => handleRequestClick(act, 'ON')}
                    disabled={isProcessing}
                  >
                    <Power size={14} className="mr-1.5" />
                    KÍCH HOẠT BẬT (LORA)
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Xác nhận Phát Lệnh Kích Hoạt Rơ-le (LoRa Downlink)"
      >
        {selectedActuator && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                {selectedActuator.actuatorCode}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedActuator.name}</h4>
                <p className="text-slate-500">{selectedActuator.zoneName}</p>
              </div>
            </div>

            {/* Interlock warning if any */}
            {interlockError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2 font-medium">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <strong>Vi phạm Luật An toàn Interlock:</strong>
                  <p className="mt-0.5">{interlockError}</p>
                </div>
              </div>
            )}

            {/* Safety Failsafe Duration Slider */}
            {targetState === 'ON' && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-bold text-amber-900">
                  <span className="flex items-center gap-1">
                    <Clock size={14} className="text-amber-700" /> Hẹn giờ Tự Ngắt Failsafe (BR-SAFE-01)
                  </span>
                  <span className="text-amber-800 font-mono text-sm">{durationMinutes} Phút</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
                <p className="text-[11px] text-amber-800 leading-tight">
                  Tối đa 30 phút/lần tưới. Rơ-le tự ngắt cứng ngay cả khi mất kết nối Internet.
                </p>
              </div>
            )}

            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 space-y-1">
              <div className="flex justify-between font-mono">
                <span>Ưu tiên lệnh (Priority):</span>
                <strong className="text-emerald-700">1 (Thủ công / Manual)</strong>
              </div>
              <div className="flex justify-between font-mono">
                <span>Kênh phát LoRa:</span>
                <strong className="text-slate-900">MQTT Downlink GW-ESP32-DL01</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Hủy lệnh
              </Button>
              <Button
                variant={targetState === 'ON' ? 'success' : 'danger'}
                onClick={confirmAndExecute}
                disabled={Boolean(targetState === 'ON' && interlockError)}
              >
                Xác nhận Phát lệnh {targetState === 'ON' ? 'BẬT' : 'TẮT'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
