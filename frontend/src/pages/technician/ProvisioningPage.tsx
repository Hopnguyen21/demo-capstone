import { ServiceRequestStatus, serviceStatusLabels } from '../../components/ui/ServiceRequestStatus';
import React, { useState, useEffect } from 'react';
import { ServiceRequest } from '../../types';
import { supportService, deviceService } from '../../services';
import { ZoneNodeMapperModal } from '../../components/control/ZoneNodeMapperModal';
import { ExperimentReportModal, HardwareItem } from '../../components/control/ExperimentReportModal';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import {
  CpuIcon, QrCode, Wifi, CheckCircle2, ArrowRight, MapPin,
  CheckSquare, Layers, Lock, ShieldCheck, Wrench, Building2,
  FlaskConical, FileText, Send, DollarSign, ChevronDown, ChevronUp,
  Search, Filter, Clock
} from 'lucide-react';

export const ProvisioningPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deploymentRequests, setDeploymentRequests] = useState<any[]>([]);
  const [selectedRequestForExperiment, setSelectedRequestForExperiment] = useState<ServiceRequest | null>(null);
  const [selectedRequestForMapper, setSelectedRequestForMapper] = useState<ServiceRequest | null>(null);
  const [selectedHardwareItems, setSelectedHardwareItems] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Collapsible list state like Owner side
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<string, boolean>>({});
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'INSTALLATION' | 'MAINTENANCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedRequestIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = (list: ServiceRequest[]) => {
    const next: Record<string, boolean> = {};
    list.forEach(r => { next[r.serviceRequestId] = true; });
    setExpandedRequestIds(next);
  };

  const collapseAll = () => {
    setExpandedRequestIds({});
  };

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await supportService.getServiceRequests();
      if (Array.isArray(data)) setRequests(data);
      const deployments = await deviceService.getTechnicianDeploymentRequests().catch(() => []);
      setDeploymentRequests(Array.isArray(deployments) ? deployments : []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDeploymentRequests = async () => setDeploymentRequests(await deviceService.getTechnicianDeploymentRequests().catch(() => []));
  const advanceDeployment = async (request: any) => {
    const id = request.requestId || request.deploymentRequestId;
    const status = String(request.status || '').toLowerCase();
    try {
      if (status === 'submitted') await deviceService.acceptDeploymentRequest(id);
      else if (status === 'accepted') await deviceService.surveyDeploymentRequest(id, { isFeasible: true, siteConditions: 'Khảo sát tại hiện trường', notes: 'Đủ điều kiện triển khai Gateway ngoài Zone và chấm Node trên GIS.' });
      else if (status === 'surveyed') await deviceService.confirmDeploymentRequest(id);
      else if (status === 'planconfirmed') await deviceService.startDeploymentInstallation(id);
      await refreshDeploymentRequests();
    } catch (error: any) { alert(error?.response?.data?.message || error?.message || 'Không thể chuyển trạng thái Deployment.'); }
  };

  useEffect(() => {
    loadRequests();
    const refresh = () => { void loadRequests(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const handleSaveMapping = async (requestId: string, nodes: any[], mappedCount: number) => {
    try {
      const req = requests.find(r => r.serviceRequestId === requestId);
      const zoneId = req?.zoneId;
      if (!zoneId || req?.deploymentLinkInvalid) throw new Error('Thiếu Zone hoặc liên kết triển khai không hợp lệ.');
      await supportService.updateMappedNodes(zoneId, nodes, requestId, req?.deploymentRequestId);
      await loadRequests();
      setSuccessMsg(`✅ Đã cập nhật biểu đồ GIS và lưu thành công ${mappedCount} Nodes cho Phân khu! Vui lòng báo Owner ký Biên bản Nghiệm thu & 70% còn lại.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to update mapped nodes:', err);
      throw err;
    }
  };

  const handleSendContractSuccess = async () => {
    await loadRequests();
    setSuccessMsg('📩 Đã gửi Báo giá & Hợp đồng thành công! Vui lòng chờ Owner Ký Hợp đồng & Thanh toán 30% tiền cọc.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleCompleteRequest = async (req: ServiceRequest) => {
    if (req.status !== 'VERIFIED') {
      alert('Chỉ đóng dịch vụ sau khi kiểm tra kết nối thành công (Verified).');
      return;
    }
    try {
      await supportService.completeByTechnician(req.serviceRequestId);
      await loadRequests();
      setSuccessMsg(`Đã xác nhận hoàn thành công trình Lắp đặt [${req.title}]!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        alert(err?.response?.data?.detail || err?.response?.data?.message || 'Chưa đủ điều kiện đóng dịch vụ.');
        await loadRequests();
      } else {
        alert('Lỗi: ' + (err?.response?.data?.message || err?.message || 'Không thể hoàn thành yêu cầu.'));
      }
    }
  };

  // Filter requests based on tab, status and search
  const filteredRequests = requests.filter(req => {
    const isInst = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
    const isMaint = req.requestType === 'MAINTENANCE' || req.requestType === 'REPAIR' || req.requestType === 'REPLACEMENT';
    if (activeTabFilter === 'INSTALLATION' && !isInst) return false;
    if (activeTabFilter === 'MAINTENANCE' && !isMaint) return false;
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (req.title || '').toLowerCase().includes(q);
      const matchFarm = (req.farmName || '').toLowerCase().includes(q);
      const matchZone = (req.zoneName || '').toLowerCase().includes(q);
      const matchId = (req.serviceRequestId || '').toLowerCase().includes(q);
      const matchOwner = (req.assignedOwnerName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchFarm && !matchZone && !matchId && !matchOwner) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white rounded-2xl shadow-md border border-emerald-400/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-800/30 text-emerald-100 text-xs font-semibold mb-2 border border-emerald-300/30 backdrop-blur-xs">
            <CpuIcon size={14} /> Quy trình Triển khai & Chấm Node IoT
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Quản lý Báo giá, Hợp đồng & Chấm vị trí Node Thực địa
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            Kỹ thuật viên lập Báo giá & Hợp đồng gửi Owner &rarr; Sau khi Owner Ký & Thanh toán 30% Cọc &rarr; Kỹ thuật viên tiến hành Vào Zone Chấm Node.
          </p>
        </div>

      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {false && <section className="p-4 bg-slate-900 text-white rounded-2xl border border-emerald-500/30 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-sm">Luồng Deployment IoT chuẩn</h2><p className="text-[11px] text-slate-300">Đây là nơi chuyển request sang Installing trước khi provision Gateway.</p></div><Button size="sm" variant="outline" onClick={refreshDeploymentRequests} className="text-white border-slate-500">Làm mới</Button></div>
        {deploymentRequests.length === 0 ? <p className="text-xs text-amber-300">Chưa có Deployment Request IoT chuẩn được trả về cho Technician. Các thẻ bên dưới là Service Request cũ.</p> : <div className="space-y-2">{deploymentRequests.map((item: any) => { const id = item.requestId || item.deploymentRequestId; const status = String(item.status || 'Unknown'); const lower = status.toLowerCase(); const action = lower === 'submitted' ? 'Nhận yêu cầu' : lower === 'accepted' ? 'Khảo sát & chuyển bước' : lower === 'surveyed' ? 'Xác nhận kế hoạch' : lower === 'planconfirmed' ? 'Bắt đầu lắp đặt' : null; return <div key={id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg bg-slate-800 border border-slate-700"><div><span className="font-mono text-xs text-emerald-300">#{id}</span><div className="text-[11px] text-slate-300">Farm: {item.farmId} · Zone: {item.zoneId}</div></div><div className="flex items-center gap-2"><span className="px-2 py-1 rounded bg-slate-700 text-xs font-bold">{status}</span>{action && <Button size="sm" onClick={() => advanceDeployment(item)} className="bg-emerald-600 text-white">{action}</Button>}{lower === 'installing' && <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-bold">Sẵn sàng Provision Gateway</span>}</div></div>; })}</div>}
      </section>}



      {/* Filter Tabs & Search / Filter Controls (Like Owner SupportPage) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTabFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTabFilter === 'ALL'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Tất cả ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('INSTALLATION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTabFilter === 'INSTALLATION'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span>⚡ Lắp đặt mới</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'INSTALLATION' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {requests.filter(r => r.requestType === 'INSTALLATION' || r.requestType === 'INITIAL_SETUP').length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('MAINTENANCE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTabFilter === 'MAINTENANCE'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span>🛠️ Bảo trì & Thay thế</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTabFilter === 'MAINTENANCE' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {requests.filter(r => r.requestType === 'MAINTENANCE' || r.requestType === 'REPAIR' || r.requestType === 'REPLACEMENT').length}
            </span>
          </button>
        </div>

        {/* Right Search & Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, trang trại, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 w-52 md:w-64"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(serviceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* List Action Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => expandAll(filteredRequests)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            Mở rộng tất cả
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
          >
            Thu gọn tất cả
          </button>
        </div>
      </div>

      {/* Requests Collapsible List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-2xl text-slate-500 text-xs">
            {isLoading ? 'Đang tải danh sách yêu cầu...' : 'Không có yêu cầu nào phù hợp với bộ lọc hiện tại.'}
          </div>
        ) : (
          filteredRequests.map(req => {
            const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
            const contract = req.contractDetails;
            const is30Paid = Boolean((contract?.isSignedByOwner && contract?.is30PercentPaid) || (req.isContractSigned && req.isDepositPaid));
            const isAccepted = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned);
            const isCompleted = req.status === 'RESOLVED' || req.status === 'CLOSED';
            const isExpanded = !!expandedRequestIds[req.serviceRequestId];

            return (
              <div
                key={req.serviceRequestId}
                className={`bg-white border rounded-2xl shadow-xs transition-all ${isExpanded
                  ? 'p-5 border-slate-300 ring-1 ring-slate-200 space-y-4'
                  : 'p-4 border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                  }`}
              >
                {/* Header Summary Row */}
                <div
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-3 ${isExpanded ? 'border-b border-slate-100 pb-3.5' : 'cursor-pointer select-none'
                    }`}
                  onClick={() => !isExpanded && toggleExpand(req.serviceRequestId)}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${isInstallation ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                        {isInstallation ? '⚡ LẮP ĐẶT THIẾT BỊ MỚI' : '🛠️ BẢO TRÌ & THAY THẾ'}
                      </span>
                      <ServiceRequestStatus request={req} />

                      {isInstallation && (
                        is30Paid ? (
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
                        )
                      )}

                      {isAccepted && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckSquare size={12} /> ĐÃ NGHIỆM THU 100%
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono">#{req.serviceRequestId}</span>
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-bold text-slate-900">{req.title}</h3>
                      {contract?.totalAmount && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          Tổng HĐ: {Number(contract.totalAmount).toLocaleString('vi-VN')} VNĐ
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="font-semibold text-emerald-800 flex items-center gap-1">
                        <Building2 size={13} /> {req.farmName} ({req.zoneName})
                      </span>
                      <span>•</span>
                      <span>Khách hàng: <strong>{req.assignedOwnerName || 'Chủ Trang Trại'}</strong></span>
                      <span>•</span>
                      <span className="font-mono text-emerald-700 font-bold flex items-center gap-1">
                        <Layers size={13} /> {req.mappedNodesCount ?? 'Chưa tải'} Nodes đã chấm
                      </span>
                      <span>•</span>
                      <span className="text-slate-400 font-mono">Ngày tạo: {new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(req.serviceRequestId);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${isExpanded
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : isInstallation && !contract
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : is30Paid && !isAccepted
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                            : isAccepted && !isCompleted
                              ? 'bg-sky-600 hover:bg-sky-700 text-white'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={15} />
                          <span>Thu gọn</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={15} />
                          <span>
                            {isInstallation && !contract
                              ? 'Soạn Báo giá & HĐ'
                              : is30Paid && !isAccepted
                                ? 'Vào Thực địa Chấm Node'
                                : isCompleted
                                  ? 'Đã hoàn thành'
                                  : 'Xem chi tiết'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                      <strong>Mô tả yêu cầu:</strong> {req.description}
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
                              <CheckCircle2 size={13} /> Owner Đã Ký & Cọc 30% (Khóa Sửa)
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
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Thao tác Thực địa Kỹ thuật</span>
                          <span className="text-white font-semibold">
                            {is30Paid ? 'Hợp đồng đã ký & cọc (Không thể sửa) • Tiến hành Vào Zone Chấm Node' : 'Cần gửi Báo giá Hợp đồng & cọc 30% trước khi chấm Node'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* BUTTON 1: BÁO GIÁ & HỢP ĐỒNG LẮP ĐẶT */}
                        {isInstallation && (
                          is30Paid ? (
                            <Button
                              onClick={() => setSelectedRequestForExperiment(req)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 shadow-sm border border-slate-600"
                              title="Hợp đồng đã được ký kết & đặt cọc 30%. Xem chi tiết (Chỉ đọc, không thể sửa)"
                            >
                              <Lock size={14} className="text-amber-400" />
                              <span>Xem Hợp đồng (Đã khóa)</span>
                            </Button>
                          ) : (
                            <Button
                              onClick={() => setSelectedRequestForExperiment(req)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <FileText size={15} className="text-emerald-300" />
                              <span>{contract ? 'Xem / Sửa Báo giá HĐ' : 'Soạn Báo giá & Hợp đồng'}</span>
                            </Button>
                          )
                        )}

                        {/* BUTTON 2: SỬA / CHẤM BIỂU ĐỒ GIS CHO REQUEST */}
                        <Button
                          onClick={() => {
                            setSelectedHardwareItems(req.contractDetails?.items || []);
                            setSelectedRequestForMapper(req);
                          }}
                          className="bg-sky-700 hover:bg-sky-800 text-white font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Layers size={15} className="text-sky-300" />
                          <span>Sửa Biểu đồ GIS ({req.mappedNodesCount ?? 'Chưa tải'} Nodes)</span>
                        </Button>

                        {/* BUTTON 2B: THỰC ĐỊA CHẤM NODE KHI OWNER ĐÃ CỌC 30% */}
                        {is30Paid ? (
                          <Button
                            onClick={() => {
                              setSelectedHardwareItems(req.contractDetails?.items || []);
                              setSelectedRequestForMapper(req);
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shadow-md border border-emerald-500/50 ring-2 ring-emerald-500/30 animate-pulse"
                          >
                            <MapPin size={15} className="text-emerald-300" />
                            <span>🚀 Vào Thực địa Chấm Node</span>
                          </Button>
                        ) : (
                          <div className="relative group">
                            <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 text-[11px] font-semibold border border-amber-500/20 flex items-center gap-1">
                              <Lock size={12} className="text-amber-400" />
                              <span>Chờ Cọc 30% để Nghiệm thu</span>
                            </span>
                            <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-64 p-2.5 bg-slate-800 text-amber-300 text-[11px] rounded-xl shadow-xl border border-slate-700 z-20">
                              🔒 Bạn vẫn có thể bấm "Sửa Biểu đồ GIS" để phác thảo và định vị node. Sau khi Owner cọc 30%, công trình sẽ chuyển sang giai đoạn thi công thực địa.
                            </div>
                          </div>
                        )}

                        {/* BUTTON 3: XÁC NHẬN HOÀN THÀNH */}
                        {isCompleted ? (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1.5 select-none">
                            <CheckCircle2 size={15} className="text-emerald-400" /> Dịch vụ đã kết thúc
                          </span>
                        ) : req.status === 'VERIFIED' ? (
                          <Button onClick={() => handleCompleteRequest(req)}>Đóng dịch vụ</Button>
                        ) : (
                          <div className="relative group">
                            <Button
                              disabled
                              className="bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed text-xs"
                            >
                              <Lock size={14} className="mr-1.5 text-slate-500" /> Chờ kiểm tra kết nối
                            </Button>
                            <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-64 p-2.5 bg-slate-800 text-amber-300 text-[11px] rounded-xl shadow-xl border border-slate-700 z-20">
                              Đóng dịch vụ yêu cầu trạng thái Verified. Nghiệm thu và thanh toán được hiển thị riêng.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
          selectedHardwareItems={selectedHardwareItems.length > 0 ? selectedHardwareItems : (selectedRequestForMapper.contractDetails?.items || [])}
          onSaveMapping={(nodes, count) => handleSaveMapping(selectedRequestForMapper.serviceRequestId, nodes, count)}
        />
      )}

    </div>
  );
};
