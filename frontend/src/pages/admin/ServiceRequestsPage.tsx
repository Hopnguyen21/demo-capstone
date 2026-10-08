import React, { useState, useEffect } from 'react';
import { ServiceRequest } from '../../types';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { supportService, userService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';
import {
  ClipboardList, UserCheck, Wrench, Building2, Cpu, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, Search, Filter, ShieldCheck, User, Plus, CheckSquare
} from 'lucide-react';

export const ServiceRequestsPage: React.FC = () => {
  const { farms, zones } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedTechMap, setAssignedTechMap] = useState<Record<string, string>>({});

  const [technicians, setTechnicians] = useState<any[]>([]);

  const loadRequests = async () => {
    try {
      const data = await supportService.getServiceRequests();
      if (Array.isArray(data)) setRequests(data);
      const uData = await userService.getUsers();
      if (Array.isArray(uData)) {
        setTechnicians(uData.filter((u: any) => u.role === 'PLATFORM_TECHNICIAN' || u.role === 'PlatformTechnician'));
      }
    } catch (err) {
      console.error('Failed to load service requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Modal Admin Create Request on behalf of Owner
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    farmId: 'farm-01',
    zoneId: 'zone-01',
    requestType: 'INSTALLATION' as 'INSTALLATION' | 'MAINTENANCE',
    title: '',
    description: '',
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    assignedOwnerName: 'Lê Văn An (Owner Trang trại Đà Lạt)',
    assignedTechnicianName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredRequests = requests.filter(r => {
    const matchesFilter = activeFilter === 'ALL' ? true : r.status === activeFilter;
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.farmName && r.farmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.requestedBy && r.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleAssignTechnician = (requestId: string) => {
    const techName = assignedTechMap[requestId] || 'Trần Minh Trí (Kỹ thuật viên IoT)';
    setRequests(prev => prev.map(req => {
      if (req.serviceRequestId === requestId) {
        return {
          ...req,
          status: 'IN_PROGRESS',
          assignedTechnician: 'user-tech',
          assignedTechnicianName: techName,
        };
      }
      return req;
    }));
    setSuccessMsg(`Đã phân công công việc cho ${techName} thành công!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreateOnBehalfOfOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedFarm = farms.find(f => f.farmId === newRequest.farmId);
    const selectedZone = zones.find(z => z.zoneId === newRequest.zoneId);

    await supportService.createServiceRequest({
      farmId: newRequest.farmId,
      farmName: selectedFarm?.name || 'Trang trại Đà Lạt',
      zoneId: newRequest.zoneId,
      zoneName: selectedZone?.name || 'Nhà màng Z01',
      requestType: newRequest.requestType,
      title: newRequest.title,
      description: newRequest.description,
      priority: newRequest.priority,
      requestedBy: `Admin tạo thay mặt [${newRequest.assignedOwnerName}]`,
      assignedOwnerName: newRequest.assignedOwnerName,
      assignedTechnicianName: newRequest.assignedTechnicianName,
    });

    await loadRequests();
    setIsCreateModalOpen(false);
    setNewRequest({
      farmId: 'farm-01',
      zoneId: 'zone-01',
      requestType: 'INSTALLATION',
      title: '',
      description: '',
      priority: 'HIGH',
      assignedOwnerName: 'Lê Văn An (Owner Trang trại Đà Lạt)',
      assignedTechnicianName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
    });
    setSuccessMsg(`Đã khởi tạo thành công Yêu cầu [${newRequest.title}] thay cho Owner!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const pendingCount = requests.filter(r => r.status === 'OPEN').length;
  const inProgressCount = requests.filter(r => r.status === 'IN_PROGRESS').length;
  const resolvedCount = requests.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
            <ShieldCheck size={14} /> Vai trò: Quản trị viên Platform (Platform Admin)
          </div>
          <h1 className="text-2xl font-bold text-white">
            Tiếp nhận & Tạo Yêu cầu Kỹ thuật (Service & Setup Requests)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Admin có thể chủ động **Tạo Yêu cầu Lắp đặt/Bảo trì thay cho Owner** và trực tiếp điều phối cho Kỹ thuật viên IoT triển khai chấm Node.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-lg">
            <Plus size={16} className="mr-1.5" /> Tạo Request Mới (Thay mặt Owner)
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'ALL' ? 'bg-[#062326] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả Yêu cầu ({requests.length})
          </button>
          <button
            onClick={() => setActiveFilter('OPEN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'OPEN' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Chờ Phân công ({pendingCount})
          </button>
          <button
            onClick={() => setActiveFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'IN_PROGRESS' ? 'bg-sky-600 text-white shadow-xs' : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            Đang triển khai ({inProgressCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm yêu cầu hoặc nông trang..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
            Không tìm thấy yêu cầu nào phù hợp.
          </div>
        ) : (
          filteredRequests.map(req => {
            const isPending = req.status === 'OPEN';
            const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';

            return (
              <div
                key={req.serviceRequestId}
                className={`p-5 bg-white border rounded-2xl space-y-4 shadow-xs transition-all ${
                  isPending ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isInstallation ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {isInstallation ? '⚡ YÊU CẦU LẮP ĐẶT MỚI' : '🛠️ YÊU CẦU BẢO TRÌ & REPAIR'}
                      </span>
                      <StatusBadge status={req.status} label={isPending ? 'CHỜ ADMIN PHÂN CÔNG' : req.status} />
                      {req.isAcceptedByOwner ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckSquare size={11} /> OWNER ĐÃ NGHIỆM THU
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                          Chờ Owner Nghiệm thu
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">ID: {req.serviceRequestId}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1">{req.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1 font-semibold text-[#062326]">
                        <Building2 size={13} /> {req.farmName} ({req.zoneName})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User size={13} /> Khởi tạo bởi: {req.requestedBy}
                      </span>
                    </p>
                  </div>

                  <div className="text-right text-xs shrink-0">
                    <span className="text-slate-400 block text-[11px]">Thời gian gửi</span>
                    <strong className="text-slate-700 font-mono">{new Date(req.createdAt).toLocaleString('vi-VN')}</strong>
                  </div>
                </div>

                <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                  {req.description}
                </p>

                {/* Admin Assignment Control Panel */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái Phân công Kỹ thuật viên</span>
                      {req.assignedTechnicianName ? (
                        <strong className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} /> Đã phân công: {req.assignedTechnicianName}
                        </strong>
                      ) : (
                        <span className="text-amber-400 font-bold">Chưa có Kỹ thuật viên tiếp nhận</span>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <select
                        onChange={e => setAssignedTechMap({ ...assignedTechMap, [req.serviceRequestId]: e.target.value })}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-1.5 focus:outline-none"
                      >
                        {technicians.map(t => (
                          <option key={t.userId} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                      <Button size="sm" onClick={() => handleAssignTechnician(req.serviceRequestId)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
                        <UserCheck size={14} className="mr-1" /> Phân công ngay
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Admin Create Request on behalf of Owner */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tạo Request Mới (Thay mặt Chủ trang trại)">
        <form onSubmit={handleCreateOnBehalfOfOwner} className="space-y-4 text-xs">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
            <strong>Platform Admin Privilege:</strong> Admin có thể chủ động tạo Yêu cầu Lắp đặt hoặc Yêu cầu Bảo trì cho bất kỳ Farm & Zone nào của Owner.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Loại Yêu cầu *</label>
              <select
                value={newRequest.requestType}
                onChange={e => setNewRequest({ ...newRequest, requestType: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:border-[#062326]"
              >
                <option value="INSTALLATION">⚡ Lắp đặt Thiết bị Mới & Chấm Node</option>
                <option value="MAINTENANCE">🛠️ Bảo trì & Hot-Swap Phần cứng</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Mức ưu tiên *</label>
              <select
                value={newRequest.priority}
                onChange={e => setNewRequest({ ...newRequest, priority: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326]"
              >
                <option value="LOW">Thấp (Low)</option>
                <option value="MEDIUM">Trung bình (Medium)</option>
                <option value="HIGH">Cao (High)</option>
                <option value="CRITICAL">Khẩn cấp (Critical)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Trang trại (Farm) *</label>
            <select
              value={newRequest.farmId}
              onChange={e => setNewRequest({ ...newRequest, farmId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-medium focus:outline-none focus:border-[#062326]"
            >
              {farms.map((f: any) => (
                <option key={f.farmId} value={f.farmId}>{f.name} ({f.address || f.locationText || 'Trang trại'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Khu vực / Zone *</label>
            <select
              value={newRequest.zoneId}
              onChange={e => setNewRequest({ ...newRequest, zoneId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-medium focus:outline-none focus:border-[#062326]"
            >
              {zones.map((z: any) => (
                <option key={z.zoneId} value={z.zoneId}>{z.name} ({z.currentCrop || 'Chưa gán vụ'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tiêu đề Yêu cầu *</label>
            <Input
              required
              placeholder="VD: Triển khai cụm cảm biến NPK & Van điện từ cho Nhà màng Z01"
              value={newRequest.title}
              onChange={e => setNewRequest({ ...newRequest, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô tả Chi tiết Yêu cầu *</label>
            <textarea
              required
              rows={3}
              placeholder="Nhập nội dung yêu cầu triển khai hoặc bảo trì chi tiết để kỹ thuật viên thực hiện..."
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#062326]"
              value={newRequest.description}
              onChange={e => setNewRequest({ ...newRequest, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              <CheckCircle2 size={16} className="mr-1.5" /> Tạo & Phân công Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
