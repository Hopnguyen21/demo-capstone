import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { Settings, RefreshCw, Radio, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { deviceService } from '../../services';

interface GatewayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateway: {
    gatewayId: string;
    gatewaySerial: string;
    macAddress: string;
    frequencyBand: string;
    telemetryIntervalSec?: number;
    samplesPerInterval?: number;
    configVersion?: number;
    pollingIntervalSeconds?: number;
    heartbeatIntervalSeconds?: number;
    responseTimeoutMs?: number;
    retryCount?: number;
    configSyncStatus?: string;
    configuredNodeIds?: string[];
  };
  onSuccess?: () => void;
}

export const GatewayConfigModal: React.FC<GatewayConfigModalProps> = ({
  isOpen,
  onClose,
  gateway,
  onSuccess
}) => {
  const [pollingSec, setPollingSec] = useState(gateway.pollingIntervalSeconds || 60);
  const [backendSec, setBackendSec] = useState(gateway.telemetryIntervalSec || 30);
  const [heartbeatSec, setHeartbeatSec] = useState(gateway.heartbeatIntervalSeconds || 15);
  const [timeoutMs, setTimeoutMs] = useState(gateway.responseTimeoutMs || 3000);
  const [retry, setRetry] = useState(gateway.retryCount || 2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await deviceService.configureGateway(gateway.gatewayId, {
        nodeIds: gateway.configuredNodeIds || [],
        telemetryIntervalSec: Number(backendSec),
        samplesPerInterval: gateway.samplesPerInterval || 1,
        pollingIntervalSeconds: Number(pollingSec),
        heartbeatIntervalSeconds: Number(heartbeatSec),
        responseTimeoutMs: Number(timeoutMs),
        retryCount: Number(retry)
      });
      setNotice(`✅ Đã lưu cấu hình phiên bản v${(gateway.configVersion || 1) + 1}. Trạng thái: Pending Delivery.`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setNotice(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert('Lỗi lưu cấu hình Gateway: ' + (err?.response?.data?.message || err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cấu hình Gateway Trực tuyến · ${gateway.gatewaySerial || gateway.macAddress}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Status card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Radio size={14} className="text-[#119653]" /> Phiên bản hiện hành: <span className="font-mono text-emerald-800">v{gateway.configVersion || 1}</span>
            </div>
            <p className="text-[11px] text-slate-500">Gateway chỉ thực thi cấu hình do Backend cấp phát chính thức.</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${gateway.configSyncStatus === 'Applied' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'}`}>
            {gateway.configSyncStatus || 'Applied'}
          </span>
        </div>

        {notice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chu kỳ POLL Node (giây)</label>
            <Input
              type="number"
              min={10}
              max={3600}
              value={pollingSec}
              onChange={e => setPollingSec(Number(e.target.value))}
            />
            <span className="text-[10px] text-slate-400">Gateway gọi LoRa từng Node</span>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chu kỳ gửi Backend (giây)</label>
            <Input
              type="number"
              min={10}
              max={86400}
              value={backendSec}
              onChange={e => setBackendSec(Number(e.target.value))}
            />
            <span className="text-[10px] text-slate-400">Gateway gửi Telemetry lên Cloud</span>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chu kỳ Heartbeat (giây)</label>
            <Input
              type="number"
              min={5}
              max={300}
              value={heartbeatSec}
              onChange={e => setHeartbeatSec(Number(e.target.value))}
            />
            <span className="text-[10px] text-slate-400">Định kỳ báo trạng thái sống</span>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Response Timeout (ms)</label>
            <Input
              type="number"
              min={500}
              max={10000}
              step={500}
              value={timeoutMs}
              onChange={e => setTimeoutMs(Number(e.target.value))}
            />
            <span className="text-[10px] text-slate-400">Thời gian chờ Node phản hồi</span>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Số lần Retry (lần)</label>
            <Input
              type="number"
              min={0}
              max={5}
              value={retry}
              onChange={e => setRetry(Number(e.target.value))}
            />
            <span className="text-[10px] text-slate-400">Thử lại khi không có phản hồi</span>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tần số LoRa (MHz)</label>
            <input
              type="text"
              readOnly
              value={gateway.frequencyBand || '915MHz'}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono text-slate-600"
            />
            <span className="text-[10px] text-slate-400">Khóa theo phần cứng Gateway</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-[10px] text-slate-400">ACK chỉ được xác nhận từ Gateway qua MQTT</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Settings size={13} />}
              <span>Lưu & Gửi cấu hình (v{(gateway.configVersion || 1) + 1})</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
