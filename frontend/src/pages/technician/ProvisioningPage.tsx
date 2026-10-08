import React, { useState, useEffect } from 'react';
import { ServiceRequest } from '../../types';
import { supportService } from '../../services';
import { ZoneNodeMapperModal } from '../../components/control/ZoneNodeMapperModal';
import { ExperimentReportModal, HardwareItem } from '../../components/control/ExperimentReportModal';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { 
  CpuIcon, QrCode, Wifi, CheckCircle2, ArrowRight, MapPin, 
  CheckSquare, Layers, Lock, ShieldCheck, Wrench, Building2, 
  FlaskConical, FileText, Send, DollarSign
} from 'lucide-react';

export const ProvisioningPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequestForExperiment, setSelectedRequestForExperiment] = useState<ServiceRequest | null>(null);
  const [selectedRequestForMapper, setSelectedRequestForMapper] = useState<ServiceRequest | null>(null);
  const [selectedHardwareItems, setSelectedHardwareItems] = useState<HardwareItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // QR Provisioning tool state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [mac, setMac] = useState('24:DC:C3:98:A1:04');
  const [deviceCode, setDeviceCode] = useState('GW-ESP32-DL03');
  const [step, setStep] = useState(1);

  const loadRequests = async () => {
    try {
      const data = await supportService.getServiceRequests();
      if (Array.isArray(data)) setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Filter ONLY installation requests
  const installationRequests = requests.filter(r => r.requestType === 'INSTALLATION' || r.requestType === 'INITIAL_SETUP');

  const handleSaveMapping = async (requestId: string, mappedCount: number) => {
    await supportService.updateMappedNodes(requestId, mappedCount);
    await loadRequests();
    setSuccessMsg(`Đã cập nhật vị trí ${mappedCount} Nodes cho Phân khu! Vui lòng báo Owner ký Biên bản Nghiệm thu & 70% còn lại.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSendContractSuccess = async () => {
    await loadRequests();
    setSuccessMsg('📩 Đã gửi Báo giá & Hợp đồng thành công! Vui lòng chờ Owner Ký Hợp đồng & Thanh toán 30% tiền cọc.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleCompleteRequest = async (req: ServiceRequest) => {
    if (!req.isAcceptedByOwner) {
      alert('⚠️ Bạn chỉ có thể Xác nhận Hoàn thành sau khi Chủ trang trại (Owner) đã Ký Nghiệm thu!');
      return;
    }
    await supportService.completeByTechnician(req.serviceRequestId);
    await loadRequests();
    setSuccessMsg(`Đã xác nhận hoàn thành công trình Lắp đặt [${req.title}]!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <CpuIcon size={14} /> Quy trình Triển khai & Chấm Node IoT
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Quản lý Báo giá, Hợp đồng & Chấm vị trí Node Thực địa
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Kỹ thuật viên lập Báo giá & Hợp đồng gửi Owner &rarr; Sau khi Owner Ký & Thanh toán 30% Cọc &rarr; Kỹ thuật viên tiến hành Vào Zone Chấm Node.
          </p>
        </div>

        <Button onClick={() => setIsQrModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shrink-0">
          <QrCode size={16} className="mr-1.5" /> Quét QR Cấp phát Nhanh
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Workflow Steps Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-semibold">
        <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
          <div>
            <span className="block text-slate-900">1. Lập Báo giá & Hợp đồng</span>
            <span className="text-[10px] text-slate-500 font-normal">Kỹ thuật viên soạn danh sách thiết bị</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
          <div>
            <span className="block text-amber-950 font-bold">2. Owner Ký HĐ & Cọc 30%</span>
            <span className="text-[10px] text-amber-800 font-normal">Tiền mặt hoặc Chuyển khoản VietQR</span>
          </div>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
          <div>
            <span className="block text-emerald-950 font-bold">3. Vào Zone Chấm Node</span>
            <span className="text-[10px] text-emerald-800 font-normal">Mở khóa chấm GPS/GIS Node</span>
          </div>
        </div>

        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-sky-700 text-white flex items-center justify-center text-xs font-bold shrink-0">4</div>
          <div>
            <span className="block text-sky-950 font-bold">4. Nghiệm thu & 70%</span>
            <span className="text-[10px] text-sky-800 font-normal">Owner bàn giao & hoàn tất 100%</span>
          </div>
        </div>
      </div>

      {/* Installation Requests List */}
      <div className="space-y-4">
        {installationRequests.length === 0 ? (
          <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 italic">
            Không có yêu cầu Lắp đặt mới nào cần xử lý.
          </div>
        ) : (
          installationRequests.map(req => {
            const contract = req.contractDetails;
            const is30Paid = Boolean(contract?.isSignedByOwner && contract?.is30PercentPaid);
            const isAccepted = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned);
            const isCompleted = req.status === 'RESOLVED' || req.status === 'CLOSED';

            return (
              <div key={req.serviceRequestId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
                {/* Request Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
                        ⚡ YÊU CẦU LẮP ĐẶT IOT
                      </span>
                      <StatusBadge status={req.status} />

                      {is30Paid ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={12} /> ĐÃ THANH TOÁN 30% CỌC
                        </span>
                      ) : contract?.isContractSent ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 animate-pulse">
                          ⏳ Đã gửi HĐ • Chờ Owner cọc 30%
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                          📝 Chưa tạo Hợp đồng
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
                      <span>Khách hàng: <strong>{req.assignedOwnerName || 'Lê Văn An'}</strong></span>
                    </p>
                  </div>

                  <div className="text-right text-xs shrink-0 font-mono">
                    <span className="text-slate-400 block text-[10px]">Sơ đồ Node</span>
                    <strong className="text-emerald-700 font-bold">{req.mappedNodesCount || 0} Nodes đã chấm</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                  {req.description}
                </p>

                {/* Contract Summary Banner if exists */}
                {contract && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-amber-950 block">
                        📄 Hợp đồng {contract.contractId} ({contract.items?.length || 0} thiết bị)
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Tổng HĐ: <strong>{contract.totalAmount.toLocaleString('vi-VN')}đ</strong> • Cọc 30%: <strong>{contract.deposit30Percent.toLocaleString('vi-VN')}đ</strong>
                      </span>
                    </div>

                    <div className="shrink-0">
                      {is30Paid ? (
                        <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 size={13} /> Owner Đã Ký & Cọc 30%
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-amber-200 text-amber-950 font-bold text-[11px] flex items-center gap-1">
                          <Lock size={13} /> Chờ Owner Ký & Thanh toán 30%
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Interactive Actions for Technician */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Thao tác Thực địa</span>
                      <span className="text-white font-semibold">
                        {is30Paid ? 'Đã đủ điều kiện: Tiến hành Vào Zone Chấm Node' : 'Cần gửi Báo giá Hợp đồng & cọc 30% trước khi chấm Node'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* BUTTON 1: BÁO GIÁ & HỢP ĐỒNG LẮP ĐẶT */}
                    <Button
                      onClick={() => setSelectedRequestForExperiment(req)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText size={15} className="text-emerald-300" />
                      <span>{contract ? 'Xem / Sửa Báo giá HĐ' : 'Soạn Báo giá & Hợp đồng'}</span>
                    </Button>

                    {/* BUTTON 2: VÀO ZONE CHẤM NODE (LOCKED UNTIL OWNER SINGS & PAYS 30%) */}
                    {is30Paid ? (
                      <Button
                        onClick={() => setSelectedRequestForMapper(req)}
                        className="bg-[#062326] hover:bg-emerald-950 text-white font-bold flex items-center gap-1.5 shadow-md border border-emerald-500/50 ring-2 ring-emerald-500/30 animate-pulse"
                      >
                        <MapPin size={15} className="text-emerald-400" />
                        <span>🚀 Vào Zone Chấm Node (Node Mapper)</span>
                      </Button>
                    ) : (
                      <div className="relative group">
                        <Button
                          disabled
                          onClick={() => alert('⚠️ Bạn phải gửi Báo giá Hợp đồng và Owner phải ký tên + cọc 30% thì mới được tiếp tục Vào Zone Chấm Node!')}
                          className="bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed flex items-center gap-1.5"
                        >
                          <Lock size={14} className="text-amber-400" />
                          <span>Khóa Chấm Node (Chờ Cọc 30%)</span>
                        </Button>
                        <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-64 p-2.5 bg-slate-800 text-amber-300 text-[11px] rounded-xl shadow-xl border border-slate-700 z-20">
                          🔒 <strong>Yêu cầu bảo mật:</strong> Owner phải bấm "Ký Hợp đồng & Thanh toán 30% cọc" tại trang Quản lý Yêu cầu thì nút Chấm Node mới mở khóa!
                        </div>
                      </div>
                    )}

                    {/* BUTTON 3: XÁC NHẬN HOÀN THÀNH (ENABLED ONLY IF OWNER ACCEPTED 100%) */}
                    {isCompleted ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Đã hoàn thành
                      </span>
                    ) : isAccepted ? (
                      <Button
                        onClick={() => handleCompleteRequest(req)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md"
                      >
                        <CheckCircle2 size={15} className="mr-1.5" /> Xác nhận Hoàn thành (Owner đã nghiệm thu 100%)
                      </Button>
                    ) : (
                      <div className="relative group">
                        <Button
                          disabled
                          className="bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        >
                          <Lock size={14} className="mr-1.5 text-slate-500" /> Xác nhận Hoàn thành
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Step 1 Modal: Quotation & Contract Creation Modal */}
      {selectedRequestForExperiment && (
        <ExperimentReportModal
          isOpen={Boolean(selectedRequestForExperiment)}
          onClose={() => setSelectedRequestForExperiment(null)}
          request={selectedRequestForExperiment}
          onSendContractSuccess={handleSendContractSuccess}
        />
      )}

      {/* Step 2 Modal: Interactive Zone Node Mapper */}
      {selectedRequestForMapper && (
        <ZoneNodeMapperModal
          isOpen={Boolean(selectedRequestForMapper)}
          onClose={() => setSelectedRequestForMapper(null)}
          request={selectedRequestForMapper}
          selectedHardwareItems={selectedHardwareItems}
          onSaveMapping={(count) => handleSaveMapping(selectedRequestForMapper.serviceRequestId, count)}
        />
      )}
    </div>
  );
};
