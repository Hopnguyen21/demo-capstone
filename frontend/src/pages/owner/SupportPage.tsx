import React, { useState } from 'react';
import { mockServiceRequests, mockFarms, mockZones } from '../../mocks/mockData';
import { ServiceRequest } from '../../types';
import { supportService } from '../../services';
import { Headphones, Plus, CheckSquare, CheckCircle2, Clock, Wrench, Building2, User, AlertCircle, Info, Layers } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';

export const SupportPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>(mockServiceRequests);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Owner Create Support / Maintenance Request
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReq, setNewReq] = useState({
    farmId: 'farm-01',
    zoneId: 'zone-01',
    requestType: 'MAINTENANCE' as 'INSTALLATION' | 'MAINTENANCE',
    title: '',
    description: '',
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  });

  const handleAcceptByOwner = async (requestId: string) => {
    await supportService.acceptByOwner(requestId);
    setRequests([...mockServiceRequests]);
    setSuccessMsg('Đã ghi nhận [ĐÃ NGHIỆM THU]! Kỹ thuật viên hiện có thể bấm "Xác nhận hoàn thành".');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const farm = mockFarms.find(f => f.farmId === newReq.farmId);
    const zone = mockZones.find(z => z.zoneId === newReq.zoneId);

    await supportService.createServiceRequest({
      farmId: newReq.farmId,
      farmName: farm?.name || 'Trang trại Đà Lạt',
      zoneId: newReq.zoneId,
      zoneName: zone?.name || 'Nhà màng Z01',
      requestType: newReq.requestType,
      title: newReq.title,
      description: newReq.description,
      priority: newReq.priority,
      requestedBy: 'Lê Văn An (Owner)',
      assignedOwnerName: 'Lê Văn An',
      assignedTechnicianName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
    });

    setRequests([...mockServiceRequests]);
    setIsModalOpen(false);
    setNewReq({ farmId: 'farm-01', zoneId: 'zone-01', requestType: 'MAINTENANCE', title: '', description: '', priority: 'HIGH' });
    setSuccessMsg('Đã gửi phiếu Yêu cầu Kỹ thuật thành công!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <Headphones size={14} /> Quản lý Yêu cầu & Nghiệm thu Công trình IoT
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Phiếu Yêu cầu Kỹ thuật & Nghiệm thu (Service & Setup Requests)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Chủ trang trại theo dõi tiến độ lắp đặt/bảo trì của Kỹ thuật viên, thực hiện **Nghiệm thu ("Đã nghiệm thu")** để Kỹ thuật viên hoàn tất phiếu.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shrink-0">
          <Plus size={16} className="mr-1.5" /> Gửi Yêu cầu Hỗ trợ Mới
        </Button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {requests.map(req => {
          const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
          const isAccepted = Boolean(req.isAcceptedByOwner);

          return (
            <div key={req.serviceRequestId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      isInstallation ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {isInstallation ? '⚡ LẮP ĐẶT THIẾT BỊ MỚI' : '🛠️ BẢO TRÌ & BẢO DƯỠNG'}
                    </span>
                    <StatusBadge status={req.status} />
                    {isAccepted ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1">
                        <CheckSquare size={12} /> OWNER ĐÃ NGHIỆM THU
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 animate-pulse">
                        ⏳ Chờ Owner Nghiệm Thu
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
                    <span>Khởi tạo: {req.requestedBy}</span>
                  </p>
                </div>

                <div className="text-right text-xs shrink-0 font-mono">
                  <span className="text-slate-400 block text-[10px]">Ngày tạo</span>
                  <strong className="text-slate-700">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                {req.description}
              </p>

              {/* Progress & Acceptance Actions */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Wrench size={15} /> Kỹ thuật viên phụ trách: {req.assignedTechnicianName || 'Chưa phân công'}
                  </div>
                  <div className="text-slate-300 text-[11px] font-mono flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Layers size={13} className="text-sky-400" /> Sơ đồ Node: <strong>{req.mappedNodesCount || 0} Nodes đã chấm</strong>
                    </span>
                    {req.acceptedAtByOwner && (
                      <span>• Nghiệm thu lúc: {new Date(req.acceptedAtByOwner).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                </div>

                {/* Owner Acceptance Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {isAccepted ? (
                    <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>Đã nghiệm thu</span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleAcceptByOwner(req.serviceRequestId)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 shadow-md animate-bounce"
                    >
                      <CheckSquare size={16} className="mr-1.5" /> Đã nghiệm thu (Owner Accept)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Owner Create Support Request */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gửi Yêu cầu Hỗ trợ Kỹ thuật / Bảo trì">
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Loại Yêu cầu *</label>
            <select
              value={newReq.requestType}
              onChange={e => setNewReq({ ...newReq, requestType: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:border-[#062326]"
            >
              <option value="INSTALLATION">⚡ Lắp đặt Thiết bị Mới & Chấm Node</option>
              <option value="MAINTENANCE">🛠️ Bảo trì & Thay thế Phần cứng</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Khu vực / Zone cần xử lý *</label>
            <select
              value={newReq.zoneId}
              onChange={e => setNewReq({ ...newReq, zoneId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326]"
            >
              {mockZones.map(z => (
                <option key={z.zoneId} value={z.zoneId}>{z.name} ({z.currentCrop})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tiêu đề Yêu cầu *</label>
            <Input
              required
              placeholder="VD: Cần kiểm tra lại cảm biến độ ẩm đất bị mất kết nối"
              value={newReq.title}
              onChange={e => setNewReq({ ...newReq, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô tả Chi tiết *</label>
            <textarea
              required
              rows={3}
              placeholder="Nhập chi tiết thông tin hiện trạng phần cứng hoặc khu vực cần triển khai..."
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#062326]"
              value={newReq.description}
              onChange={e => setNewReq({ ...newReq, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              Gửi Yêu cầu
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
