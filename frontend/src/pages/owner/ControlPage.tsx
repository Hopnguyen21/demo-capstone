import React, { useState } from 'react';
import { mockActuators } from '../../mocks/mockData';
import { StatusBadge, Button, Modal } from '../../components/ui/BaseUI';
import { Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { controlService } from '../../services';

export const ControlPage: React.FC = () => {
  const [actuators, setActuators] = useState(mockActuators);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; actuator: any; targetState: 'ON' | 'OFF' }>({
    isOpen: false,
    actuator: null,
    targetState: 'ON',
  });

  const handleToggleRequest = (actuator: any, targetState: 'ON' | 'OFF') => {
    setConfirmModal({ isOpen: true, actuator, targetState });
  };

  const executeToggle = async () => {
    if (!confirmModal.actuator) return;
    await controlService.toggleActuator(confirmModal.actuator.actuatorId, confirmModal.targetState);
    setActuators([...mockActuators]);
    setConfirmModal({ isOpen: false, actuator: null, targetState: 'ON' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="text-[#062326]" size={22} /> Điều khiển Chấp hành & Tưới tiêu (Environmental Control)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Bật/tắt thủ công Bơm tưới, Van solenoid, Quạt thông gió và Đèn quang hợp kèm xác nhận an toàn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actuators.map(act => (
          <div key={act.actuatorId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#062326] border border-slate-200">
                  {act.actuatorCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{act.name}</h3>
                <p className="text-xs text-slate-500">{act.zoneName}</p>
              </div>
              <StatusBadge status={act.status} />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">Thay đổi gần nhất: {act.lastStateChangeAt}</span>
              {act.status === 'ON' ? (
                <Button variant="danger" size="sm" onClick={() => handleToggleRequest(act, 'OFF')}>
                  <Power size={14} className="mr-1" /> Tắt ngay
                </Button>
              ) : (
                <Button variant="success" size="sm" onClick={() => handleToggleRequest(act, 'ON')}>
                  <Power size={14} className="mr-1" /> Bật ngay
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Safety Confirmation Modal */}
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} title="Xác nhận Kích hoạt Rơ-le Chấp hành">
        {confirmModal.actuator && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
              <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="block text-slate-900">Cảnh báo An toàn Vận hành:</strong>
                Bạn đang thực hiện {confirmModal.targetState === 'ON' ? 'BẬT' : 'TẮT'} thủ công thiết bị <strong>{confirmModal.actuator.name}</strong> tại {confirmModal.actuator.zoneName}. Lệnh sẽ gửi qua LoRa Gateway tới Rơ-le trong 2 giây.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Hủy</Button>
              <Button variant={confirmModal.targetState === 'ON' ? 'success' : 'danger'} onClick={executeToggle}>
                Xác nhận {confirmModal.targetState === 'ON' ? 'BẬT' : 'TẮT'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
