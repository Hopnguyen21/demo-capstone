import React, { useState } from 'react';
import { mockServiceRequests } from '../../mocks/mockData';
import { ServiceRequest } from '../../types';
import { supportService } from '../../services';
import { ZoneNodeMapperModal } from '../../components/control/ZoneNodeMapperModal';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { CpuIcon, QrCode, Wifi, CheckCircle2, ArrowRight, MapPin, CheckSquare, Layers, Lock, ShieldCheck, Wrench, Building2 } from 'lucide-react';

export const ProvisioningPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>(mockServiceRequests);
  const [selectedRequestForMapper, setSelectedRequestForMapper] = useState<ServiceRequest | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // QR Provisioning tool state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [mac, setMac] = useState('24:DC:C3:98:A1:04');
  const [deviceCode, setDeviceCode] = useState('GW-ESP32-DL03');
  const [step, setStep] = useState(1);

  // Filter ONLY installation requests
  const installationRequests = requests.filter(r => r.requestType === 'INSTALLATION' || r.requestType === 'INITIAL_SETUP');

  const handleSaveMapping = async (requestId: string, mappedCount: number) => {
    await supportService.updateMappedNodes(requestId, mappedCount);
    setRequests([...mockServiceRequests]);
    setSuccessMsg(`Đã cập nhật vị trí ${mappedCount} Nodes cho Phân khu! Vui lòng báo Owner nghiệm thu.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCompleteRequest = async (req: ServiceRequest) => {
    if (!req.isAcceptedByOwner) {
      alert('⚠️ Bạn chỉ có thể Xác nhận Hoàn thành sau khi Chủ trang trại (Owner) đã bấm "Đã nghiệm thu"!');
      return;
    }
    await supportService.completeByTechnician(req.serviceRequestId);
    setRequests([...mockServiceRequests]);
    setSuccessMsg(`Đã xác nhận hoàn thành công trình Lắp đặt [${req.title}]!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <CpuIcon size={14} /> Vai trò: Kỹ thuật viên IoT Platform
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            Quản lý Yêu cầu Lắp đặt Mới & Chấm Node (Installation & Provisioning)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Kỹ thuật viên chọn Zone của Yêu cầu Lắp đặt ➔ Chấm các Node thiết bị ➔ Chờ Owner bấm **"Đã nghiệm thu"** ➔ Bấm **"Xác nhận hoàn thành"**.
          </p>
        </div>

        <Button onClick={() => setIsQrModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shrink-0">
          <QrCode size={16} className="mr-1.5" /> Quét QR Nạp Whitelist MAC
        </Button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Installation Requests List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="text-[#062326]" size={18} /> Danh sách Yêu cầu Lắp đặt Mới ({installationRequests.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Quy trình: Chấm Node ➔ Owner Nghiệm thu ➔ Kỹ thuật hoàn tất</span>
        </div>

        {installationRequests.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
            Hiện không có yêu cầu lắp đặt mới nào cần xử lý.
          </div>
        ) : (
          installationRequests.map(req => {
            const isAccepted = Boolean(req.isAcceptedByOwner);
            const isCompleted = req.status === 'RESOLVED' || req.status === 'CLOSED';

            return (
              <div key={req.serviceRequestId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
                        ⚡ LẮP ĐẶT HẠ TẦNG IOT MỚI
                      </span>
                      <StatusBadge status={req.status} />
                      {isAccepted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckSquare size={12} /> OWNER ĐÃ NGHIỆM THU
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                          Chờ Owner Nghiệm thu
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">#{req.serviceRequestId}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1">{req.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="font-semibold text-[#062326] flex items-center gap-1">
                        <Building2 size={13} /> {req.farmName} ({req.zoneName})
                      </span>
                      <span>•</span>
                      <span>Yêu cầu bởi: {req.requestedBy}</span>
                    </p>
                  </div>

                  <div className="text-right text-xs shrink-0 font-mono">
                    <span className="text-slate-400 block text-[10px]">Tiến độ Node</span>
                    <strong className="text-emerald-700 font-bold">{req.mappedNodesCount || 0} Nodes đã chấm</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                  {req.description}
                </p>

                {/* Interactive Actions for Technician */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Thao tác Thực địa</span>
                      <span className="text-white font-semibold">Vào Zone để chấm các Node trên sơ đồ 2D</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Button 1: Vào Zone Chấm Node */}
                    <Button
                      onClick={() => setSelectedRequestForMapper(req)}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold"
                    >
                      <MapPin size={15} className="mr-1.5" /> Vào Zone Chấm Node (Node Mapper)
                    </Button>

                    {/* Button 2: Xác nhận hoàn thành (Enabled only if Owner accepted) */}
                    {isCompleted ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Đã hoàn thành
                      </span>
                    ) : isAccepted ? (
                      <Button
                        onClick={() => handleCompleteRequest(req)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold animate-pulse shadow-md"
                      >
                        <CheckCircle2 size={15} className="mr-1.5" /> Xác nhận Hoàn thành (Owner đã nghiệm thu)
                      </Button>
                    ) : (
                      <div className="relative group">
                        <Button
                          disabled
                          className="bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                        >
                          <Lock size={14} className="mr-1.5 text-slate-500" /> Xác nhận Hoàn thành
                        </Button>
                        <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block w-56 p-2 bg-slate-800 text-amber-300 text-[10px] rounded shadow-lg border border-slate-700">
                          Chờ Chủ trang trại (Owner) bấm "Đã nghiệm thu" mới kích hoạt nút này!
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Interactive Zone Node Mapper */}
      {selectedRequestForMapper && (
        <ZoneNodeMapperModal
          isOpen={Boolean(selectedRequestForMapper)}
          onClose={() => setSelectedRequestForMapper(null)}
          request={selectedRequestForMapper}
          onSaveMapping={(count) => handleSaveMapping(selectedRequestForMapper.serviceRequestId, count)}
        />
      )}

      {/* QR Whitelist Provisioning Wizard Modal */}
      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Cấp phát Whitelist MAC cho Gateway ESP32">
        <div className="space-y-4 text-xs">
          {/* Stepper Header */}
          <div className="grid grid-cols-3 gap-2 pb-3 border-b border-slate-100 font-bold">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-100 border flex items-center justify-center text-[10px]">1</span>
              <span>Quét QR</span>
            </div>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-100 border flex items-center justify-center text-[10px]">2</span>
              <span>Captive Portal</span>
            </div>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-100 border flex items-center justify-center text-[10px]">3</span>
              <span>Hoàn tất</span>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="p-6 border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl text-center">
                <QrCode size={40} className="text-[#062326] mx-auto mb-2 animate-pulse" />
                <span className="font-bold text-slate-900 text-xs">Quét tem QR trên vỏ thiết bị Gateway/Node</span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Mã MAC Address ESP32</label>
                <Input value={mac} onChange={e => setMac(e.target.value)} className="font-mono" />
              </div>
              <Button onClick={() => setStep(2)} className="w-full">
                Tiếp tục Captive Portal <ArrowRight size={15} className="ml-1" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] font-bold">
                <Wifi size={16} className="inline mr-1 text-emerald-600" /> Đã kết nối AP SmartFarm-ESP32
              </div>
              <Button onClick={() => setStep(3)} className="w-full">
                Nạp Whitelist MAC & Kết nối MQTT <CheckCircle2 size={15} className="ml-1" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
              <h4 className="font-bold text-slate-900">Cấp phát Nạp Whitelist Thành công!</h4>
              <Button onClick={() => { setStep(1); setIsQrModalOpen(false); }} variant="outline">Đóng</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
