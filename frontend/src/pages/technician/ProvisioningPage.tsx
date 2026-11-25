import React, { useState, useEffect } from 'react';
import { ServiceRequest } from '../../types';
import { supportService, deviceService } from '../../services';
import { ZoneNodeMapperModal } from '../../components/control/ZoneNodeMapperModal';
import { ExperimentReportModal, HardwareItem } from '../../components/control/ExperimentReportModal';
import { FieldSurveyReportModal } from '../../components/reports/FieldSurveyReportModal';
import { Button, StatusBadge } from '../../components/ui/BaseUI';
import { 
  Wifi, CheckCircle2, ArrowRight, MapPin, 
  CheckSquare, Layers, Lock, ShieldCheck, Wrench, 
  FlaskConical, FileText, Send, DollarSign, ChevronDown, ChevronUp,
  Search, Filter, Clock
} from 'lucide-react';

const savedEstimateSnapshot = (deployment: any) => {
  if (!deployment) return undefined;
  if (deployment.estimateSnapshotJson) return deployment.estimateSnapshotJson;
  const items = Array.isArray(deployment.estimateItems) ? deployment.estimateItems : [];
  if (items.length === 0) return undefined;
  const total = items.reduce((sum: number, item: any) => sum + Number(item.lineTotal ?? (Number(item.quantity || 0) * Number(item.unitPrice || 0))), 0);
  return JSON.stringify({
    algorithmName: 'Hexagonal WSN', algorithmVersion: 'v1',
    gateways: items.filter((x: any) => x.role === 'Gateway').reduce((n: number, x: any) => n + Number(x.quantity || 0), 0),
    sensors: items.filter((x: any) => x.role === 'SensorNode').reduce((n: number, x: any) => n + Number(x.quantity || 0), 0),
    actuators: items.filter((x: any) => x.role === 'ActuatorNode').reduce((n: number, x: any) => n + Number(x.quantity || 0), 0),
    totalCostVnd: total, estimateItems: items,
  });
};

export const ProvisioningPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deploymentRequests, setDeploymentRequests] = useState<any[]>([]);
  const [selectedRequestForExperiment, setSelectedRequestForExperiment] = useState<ServiceRequest | null>(null);
  const [selectedRequestForMapper, setSelectedRequestForMapper] = useState<ServiceRequest | null>(null);
  const [selectedRequestForSurvey, setSelectedRequestForSurvey] = useState<ServiceRequest | null>(null);
  const [selectedHardwareItems, setSelectedHardwareItems] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Collapsible list state like Owner side
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<string, boolean>>({});
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'INSTALLATION' | 'MAINTENANCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deploymentStatusFilter, setDeploymentStatusFilter] = useState<string>('SUBMITTED');
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
  }, []);

  const handleSaveMapping = async (requestId: string, nodes: any[], mappedCount: number) => {
    try {
      const req = requests.find(r => r.serviceRequestId === requestId);
      if (!req?.zoneId) throw new Error('Deployment request chưa có Zone hợp lệ.');
      // ZoneNodeMapperModal performs the single authoritative GIS write.
      // This callback only refreshes the request list; a second PUT here could
      // race with the modal close and overwrite a partial mapping.
      await loadRequests();
      setSuccessMsg(`✅ Đã cập nhật biểu đồ GIS và lưu thành công ${mappedCount} Nodes cho Phân khu! Vui lòng báo Owner ký Biên bản Nghiệm thu & 70% còn lại.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to update mapped nodes:', err);
      alert('Lỗi lưu biểu đồ GIS: ' + (err?.response?.data?.message || err?.message || 'Vui lòng thử lại.'));
    }
  };

  const handleSendContractSuccess = async () => {
    await loadRequests();
    setSuccessMsg('📩 Đã gửi Báo giá & Hợp đồng thành công! Vui lòng chờ Owner Ký Hợp đồng & Thanh toán 30% tiền cọc.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleCompleteRequest = async (req: ServiceRequest) => {
    try {
      if (!req.isAcceptedByOwner) {
        alert('⚠️ Chờ Owner nghiệm thu trước khi xác nhận hoàn thành cuối.');
        return;
      }
      await supportService.completeByTechnician(req.serviceRequestId);
      await loadRequests();
      setSuccessMsg(`✅ Đã xác nhận hoàn thành công trình [${req.title}].`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`❌ Không thể xác nhận hoàn thành: ${err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Backend không phản hồi.'}`);
    }
  };

  const handleRequestAcceptance = async (req: ServiceRequest) => {
    try {
      if (!req.deploymentRequestId) {
        alert('⚠️ Yêu cầu này chưa có Deployment Request.');
        return;
      }
      if ((req.mappedNodesCount || 0) === 0) {
        alert('⚠️ Backend chưa ghi nhận node nào đã chấm GIS. Hãy mở GIS, bấm Lưu Sơ đồ GIS & Đồng bộ Backend rồi tải lại trang.');
        return;
      }
      const deployment = deploymentRequests.find(item => String(item.requestId || item.deploymentRequestId) === String(req.deploymentRequestId));
      if (String(req.deploymentStatus || deployment?.status || '').toLowerCase() === 'completed') {
        await loadRequests();
        setSuccessMsg('Yêu cầu nghiệm thu đã được gửi trước đó. Đang chờ Owner nghiệm thu.');
        return;
      }
      await deviceService.completeDeploymentRequest(req.deploymentRequestId);
      await loadRequests();
      setSuccessMsg(`Đã gửi yêu cầu nghiệm thu [${req.title}] cho Owner.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`❌ Chưa thể gửi yêu cầu nghiệm thu: ${err?.response?.data?.detail || err?.response?.data?.title || err?.message || 'Backend từ chối hoàn tất triển khai.'}`);
    }
  };

  // Filter requests based on tab, status and search
  const filteredRequests = requests.filter(req => {
    const linkedDeployment = deploymentRequests.find(item => String(item.requestId || item.deploymentRequestId) === String(req.deploymentRequestId));
    const linkedDeploymentStatus = String(linkedDeployment?.status || '').toUpperCase();
    // Deployment chưa được kỹ thuật viên nhận thì chưa được đưa xuống luồng báo giá/Service.
    if (linkedDeployment && (linkedDeploymentStatus === 'SUBMITTED' || linkedDeploymentStatus === 'CANCELLED')) return false;
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
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white rounded-2xl shadow-md border border-emerald-400/40">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Quản lý Báo giá, Hợp đồng & Chấm vị trí Node Thực địa</h1>
        </div>

      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <section className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Yêu cầu triển khai IoT</h2>
            <p className="text-[11px] text-slate-500">Ưu tiên tiếp nhận các yêu cầu mới trước khi chuyển sang báo giá và lắp đặt.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={deploymentStatusFilter} onChange={e => setDeploymentStatusFilter(e.target.value)} className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold">
              <option value="SUBMITTED">Chưa tiếp nhận</option>
              <option value="ALL">Tất cả tiến độ</option>
              <option value="ACCEPTED">Đã tiếp nhận</option>
              <option value="SURVEYED">Đã khảo sát</option>
              <option value="PLANCONFIRMED">Đã xác nhận kế hoạch</option>
              <option value="INSTALLING">Đang lắp đặt</option>
              <option value="COMPLETED">Đã hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
            <Button size="sm" variant="outline" onClick={refreshDeploymentRequests}>Làm mới</Button>
          </div>
        </div>
        {deploymentRequests.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có yêu cầu triển khai cần xử lý.</p>
        ) : (
          <div className="grid gap-2 grid-cols-1">
            {[...deploymentRequests].sort((a: any, b: any) => {
              const rank: Record<string, number> = { submitted: 0, accepted: 1, surveyed: 2, planconfirmed: 3, installing: 4, completed: 5, cancelled: 6 };
              return (rank[String(a.status || '').toLowerCase()] ?? 99) - (rank[String(b.status || '').toLowerCase()] ?? 99);
            }).filter((item: any) => deploymentStatusFilter === 'ALL' || String(item.status || '').toUpperCase() === deploymentStatusFilter).map((item: any) => {
              const id = item.requestId || item.deploymentRequestId;
              const status = String(item.status || '').toLowerCase();
              const labels: Record<string, string> = { submitted: 'Mới gửi', accepted: 'Đã tiếp nhận', surveyed: 'Đã khảo sát', planconfirmed: 'Đã xác nhận kế hoạch', installing: 'Đang lắp đặt', completed: 'Đã hoàn tất', cancelled: 'Đã hủy' };
              const action = status === 'submitted' ? 'Nhận yêu cầu' : status === 'accepted' ? 'Khảo sát' : status === 'surveyed' ? 'Xác nhận kế hoạch' : status === 'planconfirmed' ? 'Bắt đầu lắp đặt' : null;
              return <div key={id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="min-w-0"><div className="text-xs font-semibold text-slate-800 truncate">Yêu cầu triển khai #{String(id).slice(0, 8)}</div><div className="text-[11px] text-slate-500">{item.farmName || item.zoneName ? `${item.farmName || ''}${item.farmName && item.zoneName ? ' · ' : ''}${item.zoneName || ''}` : 'Khu vực chưa xác định'}</div></div>
                <div className="flex items-center gap-2 shrink-0"><span className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold">{labels[status] || 'Chưa xác định'}</span>{action && <Button size="sm" onClick={() => advanceDeployment(item)} className="bg-emerald-600 text-white">{action}</Button>}</div>
              </div>;
            })}
          </div>
        )}
      </section>

      {/* Workflow Steps Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-semibold">
        <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2.5 shadow-2xs">
          <div className="w-7 h-7 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
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

      {/* Filter Tabs & Search / Filter Controls (Like Owner SupportPage) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTabFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTabFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('INSTALLATION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTabFilter === 'INSTALLATION'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>⚡ Lắp đặt thiết bị</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTabFilter === 'INSTALLATION' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {requests.filter(r => r.requestType === 'INSTALLATION' || r.requestType === 'INITIAL_SETUP').length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('MAINTENANCE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTabFilter === 'MAINTENANCE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🛠️ Bảo trì & Thay thế</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTabFilter === 'MAINTENANCE' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
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
              <option value="OPEN">Mới tạo / Chờ tiếp nhận</option>
              <option value="IN_PROGRESS">Đang triển khai</option>
              <option value="CONTRACT_SENT">Đã gửi báo giá</option>
              <option value="CONTRACT_SIGNED_30PAID">Đã cọc 30%</option>
              <option value="ACCEPTED_BY_OWNER">Đã nghiệm thu</option>
              <option value="RESOLVED">Đã hoàn tất</option>
              <option value="CLOSED">Đã đóng</option>
            </select>
          </div>
        </div>
      </div>

      {/* List Action Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-700 font-semibold">Danh sách yêu cầu kỹ thuật ({filteredRequests.length})</span>
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
            const deployment = deploymentRequests.find(item => String(item.requestId || item.deploymentRequestId) === String(req.deploymentRequestId));
            const is30Paid = Boolean((contract?.isSignedByOwner && contract?.is30PercentPaid) || req.isContractSigned || req.isDepositPaid || req.isFullyPaid);
            const isAccepted = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned);
            const isCompleted = req.status === 'RESOLVED' || req.status === 'CLOSED';
            const isAcceptanceRequested = String(req.deploymentStatus || deployment?.status || '').toLowerCase() === 'completed';
            const isExpanded = !!expandedRequestIds[req.serviceRequestId];

            return (
              <div 
                key={req.serviceRequestId} 
                className={`bg-white border rounded-2xl shadow-xs transition-all ${
                  isExpanded 
                    ? 'p-5 border-slate-300 ring-1 ring-slate-200 space-y-4' 
                    : 'p-4 border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                }`}
              >
                {/* Header Summary Row */}
                <div 
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isExpanded ? 'border-b border-slate-100 pb-3.5' : 'cursor-pointer select-none'
                  }`}
                  onClick={() => !isExpanded && toggleExpand(req.serviceRequestId)}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        isInstallation ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {isInstallation ? '⚡ LẮP ĐẶT THIẾT BỊ MỚI' : '🛠️ BẢO TRÌ & THAY THẾ'}
                      </span>
                      <StatusBadge status={req.status} />

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

                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-bold text-slate-900">{req.title}</h3>
                      {contract?.totalAmount && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          Tổng HĐ: {Number(contract.totalAmount).toLocaleString('vi-VN')} VNĐ
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px]">
                      <div className="min-w-0">
                        <span className="block text-slate-400">Khu vực</span>
                        <strong className="text-emerald-800 truncate block">{req.farmName || 'Chưa xác định'}{req.zoneName ? ` · ${req.zoneName}` : ''}</strong>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-slate-400">Chủ trang trại</span>
                        <strong className="text-slate-700 truncate block">{req.assignedOwnerName || 'Chưa xác định'}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400">GIS Node</span>
                        <strong className="text-emerald-700">{req.mappedNodesCount || 0} node đã chấm</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400">Ngày tạo</span>
                        <strong className="text-slate-600">{req.createdAt ? new Date(req.createdAt).toLocaleDateString('vi-VN') : 'Chưa có dữ liệu'}</strong>
                      </div>
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
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isExpanded
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
                              : isAccepted && !isCompleted
                              ? 'Xác nhận Hoàn thành'
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
                    <div className="p-3.5 bg-emerald-900 border border-emerald-700/80 text-white rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-300 shrink-0" />
                        <div>
                          <span className="text-emerald-200 block text-[10px] uppercase font-bold tracking-wide">Thao tác Thực địa Kỹ thuật</span>
                          <span className="text-emerald-50 font-semibold">
                            {is30Paid ? 'Hợp đồng đã ký & cọc (Không thể sửa) • Tiến hành Vào Zone Chấm Node' : 'Cần gửi Báo giá Hợp đồng & cọc 30% trước khi chấm Node'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* BUTTON 0: PHIẾU BÁO CÁO KHẢO SÁT THỰC ĐỊA */}
                        <Button
                          onClick={() => setSelectedRequestForSurvey(req)}
                          className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm border border-emerald-600/50"
                          title="Lập hoặc xem Phiếu khảo sát thực địa trước khi ký hợp đồng"
                        >
                          <FileText size={15} className="text-emerald-300" />
                          <span>📋 Phiếu Khảo sát Thực địa</span>
                        </Button>

                        {/* BUTTON 1: BÁO GIÁ & HỢP ĐỒNG LẮP ĐẶT */}
                        {isInstallation && (
                          is30Paid ? (
                            <Button
                              onClick={() => setSelectedRequestForExperiment(req)}
                              className="bg-emerald-950/80 hover:bg-emerald-950 text-emerald-100 font-bold flex items-center gap-1.5 shadow-sm border border-emerald-600/60"
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
                          <span>Sửa Biểu đồ GIS ({req.mappedNodesCount || 0} Nodes)</span>
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
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 size={14} /> Đã hoàn thành
                          </span>
                        ) : isAcceptanceRequested && !isAccepted ? (
                          <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                            <Clock size={14} /> Đã gửi · Chờ Owner nghiệm thu
                          </span>
                        ) : isAccepted ? (
                          <Button
                            onClick={() => handleCompleteRequest(req)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md"
                          >
                            <CheckCircle2 size={15} className="mr-1.5" /> Xác nhận hoàn thành
                          </Button>
                        ) : (
                          <Button onClick={() => handleRequestAcceptance(req)} disabled={!is30Paid || (req.mappedNodesCount || 0) === 0} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={14} className="mr-1.5" /> Yêu cầu nghiệm thu
                          </Button>
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
          estimateSnapshotJson={savedEstimateSnapshot(deploymentRequests.find((item: any) => String(item.requestId || item.deploymentRequestId) === String(selectedRequestForExperiment.deploymentRequestId)))}
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

      {/* Step 0 Modal: Field Survey Report Modal */}
      {selectedRequestForSurvey && (
        <FieldSurveyReportModal
          isOpen={Boolean(selectedRequestForSurvey)}
          onClose={() => setSelectedRequestForSurvey(null)}
          serviceRequest={{
            id: selectedRequestForSurvey.serviceRequestId,
            requestCode: selectedRequestForSurvey.serviceRequestId.substring(0, 8),
            farmId: selectedRequestForSurvey.farmId,
            farmName: selectedRequestForSurvey.farmName,
            zoneId: selectedRequestForSurvey.zoneId,
            zoneName: selectedRequestForSurvey.zoneName,
            title: selectedRequestForSurvey.title,
            status: selectedRequestForSurvey.status,
            estimateSnapshotJson: savedEstimateSnapshot(deploymentRequests.find((item: any) => String(item.requestId || item.deploymentRequestId) === String(selectedRequestForSurvey.deploymentRequestId))),
          }}
          onSaved={() => {
            setSuccessMsg('Đã lưu phiếu khảo sát thực địa thành công!');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}

    </div>
  );
};
