import React, { useState } from 'react';
import { mockServiceRequests, mockUsers } from '../../mocks/mockData';
import { ServiceRequest } from '../../types';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import {
  ClipboardList, UserCheck, Wrench, Building2, Cpu, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, Search, Filter, ShieldCheck, User
} from 'lucide-react';

export const ServiceRequestsPage: React.FC = () => {
  // Enhanced mock requests for initial setup & maintenance
  const [requests, setRequests] = useState<ServiceRequest[]>([
    {
      serviceRequestId: 'sr-cf1-02',
      tenantId: 'tenant-01',
      farmId: 'farm-02',
      farmName: 'Trang trại Nông nghiệp Công nghệ cao Đà Lạt 02',
      deviceName: '1x Gateway ESP32 + 4x LoRa Sensor Nodes',
      requestedBy: 'Lê Văn An (Chủ Trang trại - Tenant Green Valley)',
      title: 'Khởi tạo & Cấp phát IoT cho Trang trại Đà Lạt 02 (CF1 Setup Flow)',
      description: 'Chủ nông trang vừa tạo xong phân cấp Nông trang ➔ Lô đất A1 ➔ Nhà màng Z01 (Cà chua Beefsteak). Đăng ký Admin phân công Kỹ thuật viên cấp phát phần cứng và nạp Whitelist MAC.',
      priority: 'HIGH',
      status: 'OPEN',
      requestType: 'INITIAL_SETUP',
      createdAt: '2026-09-26T01:30:00Z',
    },
    ...mockServiceRequests,
  ]);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [assignedTechMap, setAssignedTechMap] = useState<Record<string, string>>({});

  // Filter list of technicians from mockUsers
  const technicians = mockUsers.filter(u => u.role === 'PLATFORM_TECHNICIAN');

  const filteredRequests = requests.filter(r => {
    const matchesFilter = activeFilter === 'ALL' ? true : r.status === activeFilter;
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.farmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
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
    alert(`Đã phân công công việc cho ${techName} thành công! Thông báo đã chuyển đến tài khoản Kỹ thuật viên.`);
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
            Trang Tiếp nhận & Phân công Yêu cầu (Service & Setup Requests)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Trung tâm tiếp nhận các Yêu cầu Khởi tạo Nông trang (Luồng CF1) & Yêu cầu Bảo trì từ Chủ trang trại, trực tiếp điều phối cho Kỹ thuật viên IoT.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
            <span className="text-amber-400 block text-xs">Chờ Phân công</span>
            <strong className="text-lg text-white font-bold">{pendingCount}</strong>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
            <span className="text-sky-400 block text-xs">Đang xử lý</span>
            <strong className="text-lg text-white font-bold">{inProgressCount}</strong>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-center min-w-[100px]">
            <span className="text-emerald-400 block text-xs">Hoàn thành</span>
            <strong className="text-lg text-white font-bold">{resolvedCount}</strong>
          </div>
        </div>
      </div>

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
            Đã Phân công / Đang triển khai ({inProgressCount})
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
            Không tìm thấy yêu cầu nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredRequests.map(req => {
            const isPending = req.status === 'OPEN';
            const isInitialSetup = req.requestType === 'INITIAL_SETUP';

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
                        isInitialSetup ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {isInitialSetup ? 'CF1: KHỞI TẠO NÔNG TRANG MỚI' : 'BẢO TRÌ VẬT TƯ'}
                      </span>
                      <StatusBadge status={req.status} label={isPending ? 'CHỜ ADMIN PHÂN CÔNG' : req.status} />
                      <span className="text-[10px] text-slate-400 font-mono">ID: {req.serviceRequestId}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1">{req.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1 font-semibold text-[#062326]">
                        <Building2 size={13} /> {req.farmName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User size={13} /> Yêu cầu bởi: {req.requestedBy}
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
                    <Wrench size={16} className="text-sky-400 shrink-0" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Trạng thái Phân công Kỹ thuật viên</span>
                      {req.assignedTechnicianName ? (
                        <strong className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} /> Đã phân công cho: {req.assignedTechnicianName}
                        </strong>
                      ) : (
                        <strong className="text-amber-400 font-bold">Đang chờ Admin chỉ định Kỹ thuật viên IoT...</strong>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <select
                        className="bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-sky-400"
                        value={assignedTechMap[req.serviceRequestId] || 'Trần Minh Trí (Kỹ thuật viên IoT)'}
                        onChange={e => setAssignedTechMap({ ...assignedTechMap, [req.serviceRequestId]: e.target.value })}
                      >
                        {technicians.map(t => (
                          <option key={t.userId} value={t.fullName}>
                            {t.fullName}
                          </option>
                        ))}
                        <option value="Nguyễn Hoàng Nam (Kỹ thuật viên LoRa)">Nguyễn Hoàng Nam (Kỹ thuật viên LoRa)</option>
                      </select>

                      <Button
                        size="sm"
                        onClick={() => handleAssignTechnician(req.serviceRequestId)}
                        className="bg-sky-600 hover:bg-sky-500 text-white whitespace-nowrap"
                      >
                        <UserCheck size={14} className="mr-1" /> Phân công Ngay
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
