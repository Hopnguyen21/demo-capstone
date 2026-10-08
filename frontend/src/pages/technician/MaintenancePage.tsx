import React, { useState, useEffect } from 'react';
import { ServiceRequest } from '../../types';
import { supportService, deviceService } from '../../services';
import { ZoneNodeMapperModal } from '../../components/control/ZoneNodeMapperModal';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { Wrench, RefreshCw, CheckCircle2, ArrowRight, MapPin, CheckSquare, Layers, Lock, Building2 } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedRequestForMapper, setSelectedRequestForMapper] = useState<ServiceRequest | null>(null);
  const [isHotSwapOpen, setIsHotSwapOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const data = await supportService.getServiceRequests();
      if (Array.isArray(data)) setRequests(data);
      const nodeData = await deviceService.getNodes();
      if (Array.isArray(nodeData)) setNodes(nodeData);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Filter ONLY maintenance, repair, and replacement requests
  const maintenanceRequests = requests.filter(r =>
    r.requestType === 'MAINTENANCE' || r.requestType === 'REPAIR' || r.requestType === 'REPLACEMENT'
  );

  const handleSaveMapping = async (requestId: string, mappedCount: number) => {
    await supportService.updateMappedNodes(requestId, mappedCount);
    await loadRequests();
    setSuccessMsg(`Đã cập nhật vị trí ${mappedCount} Nodes cho Phân khu Bảo trì! Vui lòng báo Owner nghiệm thu.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCompleteRequest = async (req: ServiceRequest) => {
    if (!req.isAcceptedByOwner) {
      alert('⚠️ Bạn chỉ có thể Xác nhận Hoàn thành sau khi Chủ trang trại (Owner) đã bấm "Đã nghiệm thu"!');
      return;
    }
    await supportService.completeByTechnician(req.serviceRequestId);
    await loadRequests();
    setSuccessMsg(`Đã xác nhận hoàn thành công trình Bảo trì [${req.title}]!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-2 border border-amber-500/30">
            <Wrench size={14} /> Vai trò: Kỹ thuật viên IoT Platform
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            Quản lý Yêu cầu Bảo trì & Thay thế Hot-Swap (Maintenance Requests)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Kỹ thuật viên xử lý yêu cầu bảo trì ➔ Vào Zone để chấm/định vị lại các Node thay thế ➔ Chờ Owner bấm **"Đã nghiệm thu"** ➔ Bấm **"Xác nhận hoàn thành"**.
          </p>
        </div>

        <Button onClick={() => setIsHotSwapOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0">
          <RefreshCw size={16} className="mr-1.5" /> Hot-Swap Thay 1-Đổi-1
        </Button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Maintenance Requests List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="text-[#062326]" size={18} /> Danh sách Yêu cầu Bảo trì ({maintenanceRequests.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Chức năng Chấm Node hoạt động ở cả 2 phần Lắp đặt & Bảo trì</span>
        </div>

        {maintenanceRequests.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
            Hiện không có yêu cầu bảo trì nào cần xử lý.
          </div>
        ) : (
          maintenanceRequests.map(req => {
            const isAccepted = Boolean(req.isAcceptedByOwner);
            const isCompleted = req.status === 'RESOLVED' || req.status === 'CLOSED';

            return (
              <div key={req.serviceRequestId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                        🛠️ YÊU CẦU BẢO TRÌ / HOT-SWAP NODE
                      </span>
                      <StatusBadge status={req.status} />
                      {isAccepted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckSquare size={12} /> OWNER ĐÃ NGHIỆM THU
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
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
                    <strong className="text-amber-700 font-bold">{req.mappedNodesCount || 0} Nodes đã chấm</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                  {req.description}
                </p>

                {/* Interactive Actions for Technician */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-amber-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Thao tác Thực địa Bảo trì</span>
                      <span className="text-white font-semibold">Vào Zone để chấm các Node thay thế trên sơ đồ</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Button 1: Vào Zone Chấm Node */}
                    <Button
                      onClick={() => setSelectedRequestForMapper(req)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    >
                      <MapPin size={15} className="mr-1.5" /> Vào Zone Chấm Node Bảo Trì
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

      {/* Hot Swap Wizard Modal */}
      <Modal isOpen={isHotSwapOpen} onClose={() => setIsHotSwapOpen(false)} title="Quy trình Hot-Swap 1-đổi-1 phần cứng">
        <div className="space-y-4 text-xs">
          <p className="text-slate-700">Chọn Node bị hỏng và gán Serial Number Node mới để duy trì lịch sử telemetry của Zone:</p>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Node cần thay thế (Old Node)</label>
            <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326]">
              {nodes.length > 0 ? nodes.map((n: any) => (
                <option key={n.nodeId || n.id} value={n.nodeId || n.id}>{n.name || n.nodeCode} - Pin {n.batteryLevel ?? 85}%</option>
              )) : (
                <option value="node-default">Node Cảm biến Lô A (SN-NODE-001) - Pin 85%</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Mã Serial Number Node mới (Replacement Node)</label>
            <input className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono focus:outline-none focus:border-[#062326]" placeholder="SN-NODE-2026-NEW-99" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsHotSwapOpen(false)}>Hủy</Button>
            <Button onClick={() => setIsHotSwapOpen(false)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
              <CheckCircle2 size={15} className="mr-1" /> Xác nhận Hot-Swap 1-đổi-1
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
