import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Headphones, Plus, CheckSquare, CheckCircle2, Clock, Wrench,
  Building2, User, AlertCircle, Info, Layers, FileText, DollarSign,
  QrCode, CreditCard, ShieldCheck, Lock, ChevronDown, ChevronUp, Package,
  RefreshCw, Loader2, Sparkles, ArrowUpRight, ExternalLink, Sprout, XCircle, Truck,
  Search, Filter, Calendar, MapPin, Copy, Check, ArrowRight, CheckCircle,
  HelpCircle, ChevronRight
} from 'lucide-react';
import { ServiceRequestStatus, serviceStatusLabels, deploymentLabels } from '../../components/ui/ServiceRequestStatus';
import { useBusinessParameters, contractDepositPercent } from '../../services/businessParameters';
import { NO_CROP_LABEL, zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';
import { ServiceRequest, ZoneContract } from '../../types';
import { supportService, zoneContractService } from '../../services';
import { FieldSurveyReportModal } from '../../components/reports/FieldSurveyReportModal';
import { useAuth } from '@/app/providers/AuthContext';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';

export const SupportPage: React.FC = () => {
  const bp = useBusinessParameters();
  const depositPct = bp.depositPercent;
  const navigate = useNavigate();
  const location = useLocation();
  const { farms, zones, user } = useAuth();
  const currentOwnerName = user?.fullName || 'Chủ Trang Trại';
  const defaultSignatureName = `${currentOwnerName} (Chủ Trang Trại)`;

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [zoneContracts, setZoneContracts] = useState<ZoneContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'INSTALLATION' | 'MAINTENANCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // State for collapsible request list items
  const [expandedRequestIds, setExpandedRequestIds] = useState<Record<string, boolean>>({});
  // State for contract terms agreement checkbox per request
  const [agreedTerms, setAgreedTerms] = useState<Record<string, boolean>>({});
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedRequestForSurvey, setSelectedRequestForSurvey] = useState<ServiceRequest | null>(null);

  // Form states for Owner Contract Signature & 30% Payment
  const [ownerSignatures, setOwnerSignatures] = useState<Record<string, string>>({});
  const [paymentMethods30, setPaymentMethods30] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

  // Form states for Owner Acceptance & 70% Final Payment
  const [acceptanceSignatures, setAcceptanceSignatures] = useState<Record<string, string>>({});
  const [paymentMethods70, setPaymentMethods70] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

  // Modal Owner Create Support / Maintenance Request
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReq, setNewReq] = useState({
    farmId: '30000000-0000-0000-0000-000000000001',
    zoneId: '32000000-0000-0000-0000-000000000001',
    requestType: 'MAINTENANCE' as 'INSTALLATION' | 'MAINTENANCE',
    title: '',
    description: '',
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  });

  // State for Payment Success Screen / Receipt Modal
  interface PaymentSuccessModalData {
    depositPercent?: number;
    stage: 'DEPOSIT_30' | 'FINAL_70';
    requestId: string;
    title: string;
    amount: number;
    paymentMethod: string;
    signerFullName: string;
    transactionRef: string;
    paidAt: string;
    status: string;
    contractTotal?: number;
    notes?: string;
  }
  const [paymentSuccessData, setPaymentSuccessData] = useState<PaymentSuccessModalData | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCancelRequest = async () => {
    if (!cancellingRequestId) return;
    setIsCancelling(true);
    try {
      await supportService.cancelServiceRequest(cancellingRequestId, cancelReason.trim() || 'Chủ trang trại chủ động hủy');
      await loadRequests();
      setSuccessMsg('Đã hủy phiếu yêu cầu dịch vụ thành công!');
      setCancellingRequestId(null);
      setCancelReason('');
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.message || 'Hủy yêu cầu thất bại.');
    } finally {
      setIsCancelling(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRequestIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = (reqList: ServiceRequest[]) => {
    const next: Record<string, boolean> = {};
    reqList.forEach(r => { next[r.serviceRequestId] = true; });
    setExpandedRequestIds(next);
  };

  const collapseAll = () => {
    setExpandedRequestIds({});
  };

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [data, cData] = await Promise.all([
        supportService.getServiceRequests(),
        zoneContractService.getAllContracts().catch(() => []),
      ]);
      if (Array.isArray(data)) setRequests(data);
      if (Array.isArray(cData)) setZoneContracts(cData);
    } catch (err: any) {
      console.error('Failed to load support requests:', err);
      setErrorMsg('Không thể tải danh sách phiếu yêu cầu từ máy chủ API.');
    } finally {
      setIsLoading(false);
    }
  };

  const getZoneContract = (zoneId: string) => {
    return zoneContracts.find(c => c.zoneId === zoneId && (c.status === 'Active' || c.status === 'ExpiringSoon' || (typeof c.status === 'number' && (c.status === 0 || c.status === 1))))
      || zoneContracts.find(c => c.zoneId === zoneId);
  };

  const depositPctOf = (requestId: string) =>
    contractDepositPercent(requests.find(r => r.serviceRequestId === requestId)?.contractDetails, bp.depositPercent);

  useEffect(() => {
    loadRequests();
    const refresh = () => { void loadRequests(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).createRequest) {
      const state = location.state as any;
      const { farmId, zoneId, zoneName, requestType, title, description, priority, deviceName } = state;
      const targetReqType = requestType || (getZoneContract(zoneId) ? 'MAINTENANCE' : 'INSTALLATION');

      setNewReq(prev => ({
        ...prev,
        farmId: farmId || prev.farmId,
        zoneId: zoneId || prev.zoneId,
        requestType: targetReqType,
        title: title || (targetReqType === 'MAINTENANCE'
          ? `Yêu cầu thay thế / bảo trì thiết bị ${deviceName ? `: ${deviceName}` : `tại ${zoneName || 'phân khu'}`}`
          : `Khảo sát & Báo giá Hợp đồng thiết bị IoT cho ${zoneName || 'Phân khu'}`),
        description: description || (targetReqType === 'MAINTENANCE'
          ? `Kính gửi phòng Kỹ thuật: Đề nghị kiểm tra và thực hiện bảo trì, thay thế thiết bị phần cứng ${deviceName || ''} tại ${zoneName || 'Zone'}.`
          : `Kính gửi phòng Kỹ thuật: Trang trại đề nghị khảo sát thực địa, báo giá thiết bị IoT và lập Hợp đồng phân khu cho ${zoneName || 'Zone'}.`),
        priority: priority || 'HIGH'
      }));

      if (targetReqType === 'MAINTENANCE') {
        setActiveTabFilter('MAINTENANCE');
      }
      setIsModalOpen(true);
    }
  }, [location.state]);

  const handleSignContractAndPay30 = async (requestId: string) => {
    const signature = ownerSignatures[requestId] || defaultSignatureName;
    const method = paymentMethods30[requestId] || 'BANK_TRANSFER';
    setIsProcessingId(requestId);
    setErrorMsg(null);

    try {
      const paymentRes = await supportService.signContractAndPay30(
        requestId,
        signature,
        method,
        requests.find(r => r.serviceRequestId === requestId)?.contractDetails?.deposit30Percent
      );
      const req = requests.find(r => r.serviceRequestId === requestId);
      const amount = paymentRes?.amount || req?.contractDetails?.deposit30Percent || 0;

      setPaymentSuccessData({
        stage: 'DEPOSIT_30',
        requestId,
        title: `KÝ HỢP ĐỒNG & THANH TOÁN ${depositPctOf(requestId)}% TẠM ỨNG THÀNH CÔNG`,
        depositPercent: depositPctOf(requestId),
        amount,
        paymentMethod: paymentRes?.paymentMethod || method,
        signerFullName: paymentRes?.signerFullName || signature,
        transactionRef: paymentRes?.transactionReference || `PAY30-${Date.now()}`,
        paidAt: paymentRes?.paidAtUtc || new Date().toISOString(),
        status: paymentRes?.status || 'Confirmed',
        contractTotal: req?.contractDetails?.totalAmount,
        notes: `Hệ thống SmartFarm đã ghi nhận thanh toán tạm ứng ${depositPctOf(requestId)}% và Hợp đồng đã có hiệu lực. Kỹ thuật viên hiện đã có thể tiếp tục Vào Zone Chấm Node (Node Mapper).`,
      });

      await loadRequests();
      setSuccessMsg(`🎉 ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN ${depositPctOf(requestId)}% TẠM ỨNG THÀNH CÔNG!`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to sign contract deposit:', err);
      const msg = err.response?.data?.detail || err.response?.data?.title || err.message || 'Lỗi khi ký hợp đồng';
      setErrorMsg(`⚠️ Không thể ký Hợp đồng: ${msg}`);
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleSignAcceptanceAndPay70 = async (requestId: string) => {
    const request = requests.find(r => r.serviceRequestId === requestId);
    if (request?.deploymentLinkInvalid || request?.deploymentStatus !== 'Completed') {
      setErrorMsg('Chỉ nghiệm thu sau khi triển khai đúng farm/zone đã hoàn tất. Tải lại dữ liệu để kiểm tra trạng thái.');
      return;
    }
    const signature = acceptanceSignatures[requestId] || defaultSignatureName;
    const method = paymentMethods70[requestId] || 'BANK_TRANSFER';
    setIsProcessingId(requestId);
    setErrorMsg(null);

    try {
      const paymentRes = await supportService.signAcceptanceAndPay70(requestId, signature, method);
      const req = requests.find(r => r.serviceRequestId === requestId);
      const amount = paymentRes?.amount || req?.contractDetails?.remaining70Percent || 0;

      setPaymentSuccessData({
        stage: 'FINAL_70',
        requestId,
        title: `NGHIỆM THU BÀN GIAO & QUYẾT TOÁN ${100 - depositPctOf(requestId)}% THÀNH CÔNG`,
        depositPercent: depositPctOf(requestId),
        amount,
        paymentMethod: paymentRes?.paymentMethod || method,
        signerFullName: paymentRes?.signerFullName || signature,
        transactionRef: paymentRes?.transactionReference || `PAY70-${Date.now()}`,
        paidAt: paymentRes?.paidAtUtc || new Date().toISOString(),
        status: paymentRes?.status || 'Confirmed',
        contractTotal: req?.contractDetails?.totalAmount,
        notes: 'Đã hoàn tất nghiệm thu bàn giao 100% công trình và thanh toán đầy đủ toàn bộ giá trị hợp đồng. Toàn bộ thiết bị đã chuyển sang trạng thái Vận hành chính thức!',
      });

      await loadRequests();
      setSuccessMsg(`✅ ĐÃ KÝ NGHIỆM THU BÀN GIAO & THANH TOÁN ${100 - depositPctOf(requestId)}% CÒN LẠI! Phiếu yêu cầu đã hoàn tất 100%.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to sign acceptance:', err);
      const msg = err.response?.data?.detail || err.response?.data?.title || err.message || 'Lỗi khi ký nghiệm thu';
      setErrorMsg(`⚠️ Không thể ký Nghiệm thu: ${msg}`);
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const existingContract = getZoneContract(newReq.zoneId);
    if (newReq.requestType === 'INSTALLATION' && existingContract) {
      alert(`Zone này đã có hợp đồng (#${existingContract.contractNumber}). Hệ thống không hỗ trợ tạo yêu cầu lắp đặt mới, vui lòng chọn "Tái kí hợp đồng".`);
      setIsModalOpen(false);
      navigate('/owner/farms', { state: { zoneId: newReq.zoneId, openContract: true } });
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);

    try {
      const farm = farms.find(f => f.farmId === newReq.farmId);
      const zone = zones.find(z => z.zoneId === newReq.zoneId);

      await supportService.createServiceRequest({
        farmId: newReq.farmId,
        farmName: farm?.name || 'Trang trại Đà Lạt',
        zoneId: newReq.zoneId,
        zoneName: zone?.name || 'Nhà màng Z01',
        requestType: newReq.requestType,
        title: newReq.title,
        description: newReq.description,
        priority: newReq.priority,
        requestedBy: `${currentOwnerName} (Owner)`,
        assignedOwnerName: currentOwnerName,
      });

      await loadRequests();
      setIsModalOpen(false);
      setNewReq({
        farmId: '30000000-0000-0000-0000-000000000001',
        zoneId: '32000000-0000-0000-0000-000000000001',
        requestType: 'MAINTENANCE',
        title: '',
        description: '',
        priority: 'HIGH'
      });
      setSuccessMsg('Đã gửi phiếu Yêu cầu Kỹ thuật thành công lên API máy chủ!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Failed to create service request:', err);
      const msg = err.response?.data?.detail || err.response?.data?.title || err.message || 'Lỗi khi gửi yêu cầu';
      alert(`Không thể gửi yêu cầu: ${msg}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Filtered requests computation
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const isInst = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
      const isMaint = req.requestType === 'MAINTENANCE' || req.requestType === 'REPAIR' || req.requestType === 'REPLACEMENT';

      if (activeTabFilter === 'INSTALLATION' && !isInst) return false;
      if (activeTabFilter === 'MAINTENANCE' && !isMaint) return false;
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = req.title?.toLowerCase().includes(q);
        const matchesId = req.serviceRequestId?.toLowerCase().includes(q);
        const matchesZone = req.zoneName?.toLowerCase().includes(q);
        const matchesFarm = req.farmName?.toLowerCase().includes(q);
        const matchesTech = req.assignedTechnicianName?.toLowerCase().includes(q);
        const matchesDesc = req.description?.toLowerCase().includes(q);
        return matchesTitle || matchesId || matchesZone || matchesFarm || matchesTech || matchesDesc;
      }

      return true;
    });
  }, [requests, activeTabFilter, statusFilter, searchQuery]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = requests.length;
    let pendingDeposit = 0;
    let inProgress = 0;
    let completed = 0;

    requests.forEach(r => {
      const contract = r.contractDetails;
      const isSigned = Boolean((contract?.isSignedByOwner && contract?.is30PercentPaid) || r.isContractSigned || r.isDepositPaid || r.isFullyPaid);
      const isDone = Boolean(
        r.isAcceptedByOwner ||
        r.acceptanceDetails?.isAcceptanceSigned ||
        (r.status as any) === 'ACCEPTED_BY_OWNER' ||
        ['RESOLVED', 'Resolved', 'CLOSED', 'Closed', 'COMPLETED', 'Completed'].includes(r.status as string)
      );

      if (isDone) {
        completed++;
      } else if (!isSigned && contract && contract.totalAmount > 0) {
        pendingDeposit++;
      } else {
        inProgress++;
      }
    });

    return { total, pendingDeposit, inProgress, completed };
  }, [requests]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ─── 1. HERO BANNER (SYSTEM GREEN THEME) ─── */}
      <div className="relative bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-400/30 overflow-hidden">
        {/* Glow ambient background orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-xs font-semibold border border-white/20 backdrop-blur-xs">
                <Sparkles size={13} className="text-emerald-200" />
                <span className="uppercase tracking-wider">Hỗ Trợ Kỹ Thuật & Dịch Vụ IoT</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Yêu Cầu Kỹ Thuật, Hợp Đồng & Nghiệm Thu
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
                Theo dõi tiến độ xử lý sự cố thiết bị, duyệt báo giá phần cứng, ký hợp đồng điện tử tạm ứng cọc {depositPct}%, và nghiệm thu bàn giao thực địa trực tiếp.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => loadRequests()}
                disabled={isLoading}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-2 backdrop-blur-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Làm mới danh sách từ máy chủ"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-[#119653] font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]"
              >
                <Plus size={16} className="text-[#119653]" />
                <span>Tạo Yêu Cầu Mới</span>
              </button>
            </div>
          </div>

          {/* Quick Stat KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex items-center gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl text-white shrink-0">
                <Layers size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100 font-medium truncate">Tổng số phiếu</div>
                <div className="text-xl font-black text-white font-mono">{stats.total}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex items-center gap-3">
              <div className="p-2.5 bg-amber-400/25 rounded-xl text-amber-200 shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100 font-medium truncate">Chờ Ký HĐ & Cọc</div>
                <div className="text-xl font-black text-amber-200 font-mono">{stats.pendingDeposit}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex items-center gap-3">
              <div className="p-2.5 bg-sky-400/25 rounded-xl text-sky-200 shrink-0">
                <Wrench size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100 font-medium truncate">Đang triển khai</div>
                <div className="text-xl font-black text-sky-200 font-mono">{stats.inProgress}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-400/25 rounded-xl text-emerald-200 shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100 font-medium truncate">Đã nghiệm thu</div>
                <div className="text-xl font-black text-emerald-200 font-mono">{stats.completed}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── NOTIFICATION BANNERS ─── */}
      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-white" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-600 text-white rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-in fade-in">
          <AlertCircle size={18} className="shrink-0 text-white" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ─── 2. SEARCH & FILTER TOOLBAR ─── */}
      <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, mã phiếu, phân khu, kỹ thuật viên..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#119653] focus:ring-1 focus:ring-[#119653] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XCircle size={15} />
              </button>
            )}
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
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
              <span>⚡ Lắp đặt mới</span>
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

          {/* Status Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter size={14} className="text-slate-400 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(serviceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar Footer: List summary & Expand/Collapse toggle */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 px-1">
          <span className="text-slate-500 font-medium">
            Hiển thị <strong>{filteredRequests.length}</strong> / {requests.length} yêu cầu
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => expandAll(filteredRequests)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[11px] transition-all cursor-pointer"
            >
              Mở rộng tất cả
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[11px] transition-all cursor-pointer"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. REQUEST LIST ─── */}
      {isLoading && requests.length === 0 ? (
        <div className="p-14 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <Loader2 size={36} className="mx-auto text-emerald-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Đang tải dữ liệu Hợp đồng, Báo giá & Phiếu yêu cầu từ máy chủ...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-xs space-y-3">
          <Headphones size={40} className="mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Không tìm thấy yêu cầu nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'ALL' || activeTabFilter !== 'ALL'
              ? 'Thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm để xem các phiếu khác.'
              : 'Chưa có phiếu yêu cầu dịch vụ nào. Bạn có thể gửi yêu cầu khảo sát, lắp đặt thiết bị mới hoặc bảo trì phần cứng ngay bên dưới.'}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus size={15} /> Gửi Yêu Cầu Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(req => {
            const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
            const contract = req.contractDetails;
            const cardDepositPct = contractDepositPercent(contract, bp.depositPercent);
            const isContractSigned = Boolean((contract?.isSignedByOwner && contract?.is30PercentPaid) || req.isContractSigned || req.isDepositPaid || req.isFullyPaid);
            const isAcceptanceDone = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned || (req.status as any) === 'ACCEPTED_BY_OWNER');
            const isCompleted = Boolean(
              isAcceptanceDone ||
              ['RESOLVED', 'Resolved', 'CLOSED', 'Closed', 'WORK_COMPLETED', 'WorkCompleted', 'VERIFIED', 'Verified', 'COMPLETED', 'Completed'].includes(req.status as string) ||
              req.deploymentStatus === 'Completed' ||
              req.deploymentStatus === 'COMPLETED'
            );
            const isCancelled = ['CANCELLED', 'Cancelled'].includes(req.status as string);
            const isExpanded = !!expandedRequestIds[req.serviceRequestId];
            const isTechAssigned = Boolean(req.assignedTechnicianName && ['ASSIGNED', 'Assigned'].includes(req.status));

            // Matching Zone resolution
            const matchingContract = zoneContracts.find(c =>
              (req.zoneId && c.zoneId === req.zoneId) ||
              (req.contractDetails?.contractId && c.id === req.contractDetails.contractId)
            );
            const matchingZone = zones.find(z =>
              (req.zoneId && (z.zoneId === req.zoneId || (z as any).id === req.zoneId)) ||
              (matchingContract?.zoneId && (z.zoneId === matchingContract.zoneId || (z as any).id === matchingContract.zoneId))
            );
            const descZoneMatch = req.description?.match(/cho\s+["']?(?:Nhà\s+màng|Zone)\s+["']?([^"'\.\,\n]+)["']?/i)
              || req.description?.match(/(?:Nhà\s+màng|Zone)\s+["']([^"'\.\,\n]+)["']/i);
            const extractedZone = descZoneMatch ? descZoneMatch[1].trim() : '';

            const rawContractZoneName =
              matchingZone?.name ||
              matchingContract?.zoneName ||
              (extractedZone ? (extractedZone.toLowerCase().startsWith('nhà màng') ? extractedZone : `Nhà màng "${extractedZone}"`) : '') ||
              (req.zoneName && req.zoneName !== 'Nhà màng Z01' ? req.zoneName : '') ||
              req.zoneName ||
              'Zone hợp đồng';

            const contractZoneDisplayName =
              rawContractZoneName.toLowerCase().startsWith('nhà màng') || rawContractZoneName.toLowerCase().startsWith('zone')
                ? rawContractZoneName
                : `Zone ${rawContractZoneName}`;

            // Priority badge styling
            const priorityColor =
              req.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              req.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 border-orange-300' :
              req.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-300' :
              'bg-slate-100 text-slate-700 border-slate-200';

            const priorityLabel =
              req.priority === 'CRITICAL' ? 'Khẩn cấp' :
              req.priority === 'HIGH' ? 'Ưu tiên cao' :
              req.priority === 'MEDIUM' ? 'Trung bình' : 'Tiêu chuẩn';

            // Left stripe border color
            const borderAccent =
              isCancelled ? 'border-l-slate-300' :
              isCompleted ? 'border-l-emerald-500' :
              !isContractSigned && contract && contract.totalAmount > 0 ? 'border-l-amber-500' :
              isTechAssigned ? 'border-l-sky-500' :
              'border-l-emerald-600';

            return (
              <div
                key={req.serviceRequestId}
                className={`bg-white border rounded-2xl shadow-xs transition-all border-l-4 ${borderAccent} ${
                  isExpanded
                    ? 'p-5 sm:p-6 border-slate-300 ring-1 ring-slate-200 space-y-5 shadow-sm'
                    : 'p-4 sm:p-5 border-slate-200 hover:border-emerald-300 hover:shadow-md'
                }`}
              >
                {/* ─── CARD HEADER ROW ─── */}
                <div
                  className={`flex flex-col lg:flex-row lg:items-start justify-between gap-4 ${
                    isExpanded ? 'border-b border-slate-100 pb-4' : 'cursor-pointer select-none'
                  }`}
                  onClick={() => !isExpanded && toggleExpand(req.serviceRequestId)}
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Top Tag Badges Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide uppercase ${
                        isInstallation
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {isInstallation ? '⚡ Lắp đặt mới' : '🛠️ Bảo trì & Thay thế'}
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityColor}`}>
                        {priorityLabel}
                      </span>

                      {/* Main Stage Badge */}
                      {isCancelled ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-[10px] font-bold flex items-center gap-1">
                          <XCircle size={12} /> Đã Hủy
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 size={12} /> Đã Nghiệm Thu 100%
                        </span>
                      ) : !isContractSigned && contract && contract.totalAmount > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs animate-pulse">
                          <Clock size={12} /> Chờ Ký HĐ & Cọc {cardDepositPct}%
                        </span>
                      ) : isContractSigned && !isAcceptanceDone ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-700" /> Đã Cọc {cardDepositPct}% • Chờ Nghiệm Thu
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px]">
                          {serviceStatusLabels[req.status] || req.status}
                        </span>
                      )}

                      {/* Technician In-transit alert pill */}
                      {isTechAssigned && (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300 font-bold text-[10px] flex items-center gap-1.5 shadow-2xs animate-pulse">
                          <Truck size={12} className="text-sky-700" />
                          <span>Kỹ thuật viên đang tới ({req.assignedTechnicianName})</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono ml-auto lg:ml-0">
                        #{req.serviceRequestId.substring(0, 8)}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-emerald-800 transition-colors">
                        {req.title}
                      </h3>
                      {contract?.totalAmount ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 shrink-0 font-mono">
                          Tổng HĐ: {Number(contract.totalAmount).toLocaleString('vi-VN')} VNĐ
                        </span>
                      ) : null}
                    </div>

                    {/* Metadata line: Zone link, Technician, Created date */}
                    <div className="text-xs text-slate-500 flex items-center gap-2.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/owner/farms', {
                            state: {
                              farmId: req.farmId,
                              farmName: req.farmName,
                              zoneId: req.zoneId,
                              zoneName: rawContractZoneName,
                              openContract: true,
                            }
                          });
                        }}
                        className="font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50/80 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-all inline-flex items-center gap-1 cursor-pointer group/link"
                        title={`Xem hồ sơ ${contractZoneDisplayName} và hợp đồng`}
                      >
                        <Sprout size={12} className="text-emerald-600 group-hover/link:scale-110 transition-transform" />
                        <span className="underline decoration-emerald-400/50 underline-offset-2">
                          {contractZoneDisplayName}
                        </span>
                        <ArrowUpRight size={12} className="text-emerald-600" />
                      </button>

                      <span>•</span>

                      <span className="flex items-center gap-1">
                        <User size={13} className="text-slate-400" />
                        <span>Kỹ thuật viên: </span>
                        <strong className={req.assignedTechnicianName ? "text-slate-800 font-semibold" : "text-amber-700 font-semibold"}>
                          {req.assignedTechnicianName || 'Chờ phân công'}
                        </strong>
                      </span>

                      <span>•</span>

                      <span className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                        <Calendar size={12} />
                        <span>{new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                      </span>
                    </div>

                    {/* Brief description snippet if not expanded */}
                    {!isExpanded && req.description && (
                      <p className="text-xs text-slate-600 line-clamp-1 pt-1 italic">
                        "{req.description}"
                      </p>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-start lg:self-center pt-2 lg:pt-0">
                    {!isCompleted && !isCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancellingRequestId(req.serviceRequestId);
                          setCancelReason('');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Hủy phiếu yêu cầu này"
                      >
                        <XCircle size={14} />
                        <span className="hidden sm:inline">Hủy</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequestForSurvey(req);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="Xem Phiếu báo cáo khảo sát thực địa do kỹ thuật viên lập"
                    >
                      <FileText size={14} className="text-teal-600" />
                      <span className="hidden sm:inline">Phiếu Khảo sát</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(req.serviceRequestId);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isExpanded
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : !isContractSigned && contract && contract.totalAmount > 0
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                          : !isAcceptanceDone && isContractSigned
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
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
                            {!isContractSigned && contract && contract.totalAmount > 0
                              ? `Ký HĐ & Cọc ${cardDepositPct}%`
                              : !isAcceptanceDone && isContractSigned
                              ? 'Nghiệm thu & Quyết toán'
                              : 'Xem chi tiết'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* ─── EXPANDED DETAILED WORKFLOW ─── */}
                {isExpanded && (
                  <div className="space-y-6 pt-2 animate-in fade-in duration-200">
                    {/* Full Description Box */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        Chi tiết yêu cầu từ trang trại:
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium">
                        {req.description}
                      </p>
                    </div>

                    {/* Alert: Technician on the way */}
                    {isTechAssigned && (
                      <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3.5 text-sky-950 shadow-2xs">
                        <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl shrink-0 mt-0.5">
                          <Truck size={22} className="animate-pulse" />
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="font-bold text-sky-950 flex items-center gap-2">
                            <span>🚀 Nhân viên kỹ thuật đang tới trang trại của bạn!</span>
                            <span className="px-2 py-0.5 rounded-full bg-sky-200 text-sky-900 text-[10px] font-bold">Đang di chuyển</span>
                          </div>
                          <p className="text-sky-800 leading-relaxed">
                            Yêu cầu đã được phân công cho kỹ thuật viên <strong className="text-sky-950 font-bold">{req.assignedTechnicianName}</strong>. Kỹ thuật viên đang trên đường di chuyển đến thực địa nông trại. Quý khách vui lòng giữ liên lạc điện thoại khi nhân viên liên hệ tiếp nhận.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ─── 3-STEP PIPELINE PROGRESS STEPPER ─── */}
                    <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-[#119653]" />
                        <span>Quy trình triển khai dịch vụ IoT 3 bước:</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Step 1 indicator */}
                        <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                          isContractSigned
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                            : contract && contract.totalAmount > 0
                            ? 'bg-amber-50 border-amber-300 text-amber-950 ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isContractSigned
                              ? 'bg-emerald-600 text-white'
                              : contract && contract.totalAmount > 0
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isContractSigned ? <Check size={14} /> : '1'}
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold truncate">1. Báo giá & Ký HĐ Cọc {cardDepositPct}%</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {isContractSigned ? '✓ Đã ký & tạm ứng cọc' : 'Chờ Owner ký & cọc'}
                            </div>
                          </div>
                        </div>

                        {/* Step 2 indicator */}
                        <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                          isAcceptanceDone
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                            : isContractSigned
                            ? 'bg-sky-50 border-sky-300 text-sky-950 ring-1 ring-sky-300'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isAcceptanceDone
                              ? 'bg-emerald-600 text-white'
                              : isContractSigned
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isAcceptanceDone ? <Check size={14} /> : '2'}
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold truncate">2. Thi công & Chấm Node GIS</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {isAcceptanceDone ? '✓ Hoàn tất đo kiểm' : isContractSigned ? 'KTV đang triển khai' : 'Khóa (chờ bước 1)'}
                            </div>
                          </div>
                        </div>

                        {/* Step 3 indicator */}
                        <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                          isAcceptanceDone
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 ring-1 ring-emerald-300'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isAcceptanceDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isAcceptanceDone ? <Check size={14} /> : '3'}
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold truncate">3. Nghiệm thu & Quyết toán</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {isAcceptanceDone ? '✓ Đã bàn giao 100%' : 'Thanh toán ' + (100 - cardDepositPct) + '% còn lại'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ─── SECTION 1: HỢP ĐỒNG & BÁO GIÁ LẮP ĐẶT (BƯỚC 1: KÝ HĐ & CỌC) ─── */}
                    <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                            <FileText size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              1. Báo Giá Thiết Bị & Hợp Đồng Dịch Vụ
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Ký hợp đồng điện tử và nộp tạm ứng {cardDepositPct}% để xuất kho & triển khai thực địa
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/owner/farms', {
                                state: {
                                  farmId: req.farmId,
                                  farmName: req.farmName,
                                  zoneId: req.zoneId,
                                  zoneName: rawContractZoneName,
                                  openContract: true,
                                }
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-all cursor-pointer shadow-2xs"
                            title={`Xem hồ sơ hợp đồng của ${contractZoneDisplayName}`}
                          >
                            <ExternalLink size={13} className="text-slate-500" />
                            <span>Hồ sơ HĐ Zone</span>
                          </button>

                          {isContractSigned ? (
                            <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                              <CheckCircle2 size={13} /> Đã Ký & Cọc {cardDepositPct}%
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300">
                              Chờ Ký & Cọc {cardDepositPct}%
                            </span>
                          )}
                        </div>
                      </div>

                      {contract && contract.items && contract.items.length > 0 ? (
                        <div className="space-y-4">
                          {/* Quotation Table */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="overflow-x-auto max-h-56">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                                  <tr>
                                    <th className="p-2.5">Mã thiết bị</th>
                                    <th className="p-2.5">Tên sản phẩm / Thiết bị</th>
                                    <th className="p-2.5 text-center">ĐVT</th>
                                    <th className="p-2.5 text-right">Đơn giá</th>
                                    <th className="p-2.5 text-center">VAT</th>
                                    <th className="p-2.5 text-center">SL</th>
                                    <th className="p-2.5 text-right">Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {contract.items.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="p-2.5 font-mono font-bold text-slate-800">{item.code}</td>
                                      <td className="p-2.5">
                                        <div className="font-semibold text-slate-900">{item.name}</div>
                                        {item.notes && <div className="text-[10px] text-slate-400 italic">{item.notes}</div>}
                                      </td>
                                      <td className="p-2.5 text-center text-slate-600">{item.unit}</td>
                                      <td className="p-2.5 text-right font-mono text-slate-700">{item.unitPrice.toLocaleString('vi-VN')} đ</td>
                                      <td className="p-2.5 text-center font-mono text-slate-500">{item.vatPercent}%</td>
                                      <td className="p-2.5 text-center font-mono font-bold text-slate-900">{item.quantity}</td>
                                      <td className="p-2.5 text-right font-mono font-bold text-emerald-800">{item.totalAmount.toLocaleString('vi-VN')} đ</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Financial Summary Box */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                            {contract.notes?.includes('lần 2 trong 2 tháng') && (
                              <div className="flex items-center gap-2 p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-950 rounded-xl font-bold text-xs border border-amber-200">
                                <Sparkles size={16} className="text-amber-600 shrink-0" />
                                <span>🎉 Hợp đồng đã áp dụng Ưu đãi Mua lần 2 trong vòng 2 tháng (Giảm giá 15%)!</span>
                              </div>
                            )}

                            <div className="flex justify-between text-slate-600">
                              <span>Tổng cộng chi phí (đã gồm VAT 8%):</span>
                              <strong className="font-mono text-slate-900 font-bold">{contract.totalAmount.toLocaleString('vi-VN')} VNĐ</strong>
                            </div>

                            <div className="flex justify-between items-center font-bold text-emerald-950 text-sm pt-2 border-t border-slate-200">
                              <span>SỐ TIỀN TẠM ỨNG CỌC {cardDepositPct}% CẦN THANH TOÁN:</span>
                              <span className="font-mono text-emerald-800 text-lg font-black">{contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ</span>
                            </div>
                          </div>

                          {/* SIGNATURE & PAYMENT FORM (IF NOT SIGNED) */}
                          {!isContractSigned ? (
                            <div className="p-4 bg-amber-50/60 border border-amber-300/80 rounded-2xl space-y-4 shadow-xs">
                              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wide">
                                <ShieldCheck size={18} className="text-amber-600" />
                                <span>Xác nhận Ký Hợp Đồng & Thanh Toán Tạm Ứng {cardDepositPct}%</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Họ tên Người đại diện Ký Hợp đồng *
                                  </label>
                                  <Input
                                    value={ownerSignatures[req.serviceRequestId] || defaultSignatureName}
                                    onChange={e => setOwnerSignatures({ ...ownerSignatures, [req.serviceRequestId]: e.target.value })}
                                    placeholder="Nhập họ tên người ký..."
                                    className="bg-white text-xs py-2"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Phương thức Thanh toán Cọc {cardDepositPct}% *
                                  </label>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPaymentMethods30({ ...paymentMethods30, [req.serviceRequestId]: 'BANK_TRANSFER' })}
                                      className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        (paymentMethods30[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER'
                                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <QrCode size={14} /> Chuyển khoản (VietQR)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentMethods30({ ...paymentMethods30, [req.serviceRequestId]: 'CASH' })}
                                      className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        paymentMethods30[req.serviceRequestId] === 'CASH'
                                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <DollarSign size={14} /> Tiền mặt
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Bank transfer info card */}
                              {(paymentMethods30[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER' ? (
                                <div className="p-3 bg-white border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                                      <span>Ngân hàng MBBank — STK: <strong>0903666888</strong></span>
                                      <span className="text-[10px] text-slate-500">(SMARTFARM IOT)</span>
                                    </div>
                                    <div className="text-slate-600 flex items-center gap-2">
                                      <span>Cú pháp: <strong className="font-mono text-amber-900 font-bold">COC30 #{req.serviceRequestId.toUpperCase()}</strong></span>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(`COC30 #${req.serviceRequestId.toUpperCase()}`, req.serviceRequestId)}
                                        className="inline-flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
                                      >
                                        {copiedCode === req.serviceRequestId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        <span>{copiedCode === req.serviceRequestId ? 'Đã sao chép' : 'Sao chép'}</span>
                                      </button>
                                    </div>
                                  </div>
                                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg text-[10px] font-mono shrink-0 self-start sm:self-center">
                                    VietQR 24/7 Tự Động
                                  </span>
                                </div>
                              ) : (
                                <div className="p-3 bg-white border border-amber-200 rounded-xl text-xs text-slate-700">
                                  💵 Thanh toán trực tiếp bằng <strong>Tiền mặt</strong> cho Kỹ thuật viên phụ trách khi bàn giao vật tư tại trang trại.
                                </div>
                              )}

                              {/* Terms & Conditions box */}
                              <div className="p-3.5 bg-white border border-amber-200 rounded-xl space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                                    <FileText size={14} className="text-amber-700" />
                                    Điều khoản cam kết thỏa thuận hợp đồng:
                                  </span>
                                  <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                                    Bắt buộc đồng ý
                                  </span>
                                </div>

                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1.5 max-h-32 overflow-y-auto leading-relaxed">
                                  <p>• <strong>Điều 1 (Tạm ứng & Triển khai):</strong> Bên A đồng ý thanh toán tạm ứng {cardDepositPct}% giá trị hợp đồng để Bên B tiến hành xuất kho thiết bị, điều động kỹ thuật viên và tiến hành lắp đặt trên thực địa phân khu.</p>
                                  <p>• <strong>Điều 2 (Nghiệm thu & Quyết toán):</strong> Sau khi Bên B thi công hoàn tất, đo kiểm kết nối vi khí hậu đạt chuẩn và bàn giao thực địa, Bên A sẽ ký biên bản nghiệm thu và thanh toán {100 - cardDepositPct}% còn lại trong vòng 03 ngày làm việc.</p>
                                  <p>• <strong>Điều 3 (Bảo hành & Bảo dưỡng):</strong> Toàn bộ cảm biến, trạm node và thiết bị điều khiển tự động được bảo hành chính hãng 12 tháng, bảo dưỡng định kỳ và hỗ trợ kỹ thuật 24/7 theo tiêu chuẩn SmartFarm.</p>
                                  <p>• <strong>Điều 4 (Kích hoạt số hóa phân khu):</strong> Phân khu sẽ được kích hoạt quyền quản lý hợp đồng chính thức, mở khóa bản đồ GIS và điều khiển tự động ngay khi khoản cọc {cardDepositPct}% được xác nhận.</p>
                                </div>

                                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!agreedTerms[req.serviceRequestId]}
                                    onChange={(e) => setAgreedTerms(prev => ({
                                      ...prev,
                                      [req.serviceRequestId]: e.target.checked
                                    }))}
                                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <span className="text-xs text-slate-800 font-semibold leading-snug">
                                    Tôi đã đọc, hiểu rõ và <span className="text-emerald-900 font-bold underline">đồng ý với toàn bộ các điều khoản hợp đồng nêu trên</span>, đồng thời cam kết thanh toán tạm ứng {cardDepositPct}% để tiến hành triển khai.
                                  </span>
                                </label>
                              </div>

                              <button
                                type="button"
                                disabled={!agreedTerms[req.serviceRequestId] || isProcessingId === req.serviceRequestId}
                                onClick={() => handleSignContractAndPay30(req.serviceRequestId)}
                                className={`w-full font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                  !agreedTerms[req.serviceRequestId]
                                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'
                                }`}
                              >
                                {isProcessingId === req.serviceRequestId ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Đang xác thực Ký HĐ & Ghi nhận Cọc {cardDepositPct}% qua API...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckSquare size={16} />
                                    <span>KÝ HỢP ĐỒNG & THANH TOÁN {cardDepositPct}% CỌC ({contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ)</span>
                                  </>
                                )}
                              </button>

                              {!agreedTerms[req.serviceRequestId] && (
                                <p className="text-[11px] text-amber-800 text-center font-medium italic">
                                  🔒 Vui lòng tích chọn "Tôi đã đọc và đồng ý..." ở trên để mở khóa nút ký HĐ & cọc.
                                </p>
                              )}
                            </div>
                          ) : (
                            /* Contract Already Signed Box */
                            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between font-bold text-emerald-950 border-b border-emerald-200/80 pb-2.5">
                                <span className="flex items-center gap-2 text-sm text-emerald-900">
                                  <CheckCircle2 size={18} className="text-emerald-600" />
                                  ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN TẠM ỨNG {cardDepositPct}% THÀNH CÔNG
                                </span>
                                <span className="text-[11px] bg-emerald-200/80 text-emerald-950 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
                                  <Lock size={12} /> Đã khóa hợp đồng
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-emerald-950 bg-white/90 p-3 rounded-xl border border-emerald-200">
                                <div>
                                  <span className="text-slate-500 block text-[11px]">Đại diện ký tên:</span>
                                  <strong>{contract.ownerSignatureName || defaultSignatureName}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[11px]">Số tiền tạm ứng {cardDepositPct}%:</span>
                                  <strong className="text-emerald-700 font-mono text-sm">{contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[11px]">Phương thức thanh toán:</span>
                                  <strong>{contract.payment30Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (VietQR)'}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[11px]">Mã GD / Thời gian:</span>
                                  <strong className="font-mono text-[11px]">
                                    {contract.payment30Ref} ({contract.paid30At ? new Date(contract.paid30At).toLocaleString('vi-VN') : 'Vừa xong'})
                                  </strong>
                                </div>
                              </div>

                              <div className="pt-1 flex items-center justify-between text-xs text-emerald-900 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span>🚀</span>
                                  <span>Kỹ thuật viên đã được mở khóa quyền Vào Zone Chấm Node (Node Mapper) trên thực địa!</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate('/owner/farms', {
                                      state: {
                                        farmId: req.farmId,
                                        farmName: req.farmName,
                                        zoneId: req.zoneId,
                                        zoneName: rawContractZoneName,
                                        openContract: true,
                                      }
                                    });
                                  }}
                                  className="text-emerald-800 hover:text-emerald-950 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Xem Zone</span>
                                  <ArrowUpRight size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                          <Clock size={20} className="mx-auto text-slate-400" />
                          <p className="font-semibold text-slate-700">Kỹ thuật viên đang chuẩn bị Báo giá & Hợp đồng thiết bị</p>
                          <p className="text-[11px] text-slate-500">Sau khi hoàn tất khảo sát thực địa, báo giá thiết bị chi tiết sẽ tự động hiển thị tại đây để bạn duyệt.</p>
                        </div>
                      )}
                    </div>

                    {/* ─── SECTION 2: BIÊN BẢN NGHIỆM THU & QUYẾT TOÁN 70% ─── */}
                    <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                            <CheckSquare size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              2. Biên Bản Nghiệm Thu & Quyết Toán {100 - cardDepositPct}% Còn Lại
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Nghiệm thu bàn giao đo kiểm thiết bị thực địa và hoàn tất thanh toán toàn bộ giá trị hợp đồng
                            </p>
                          </div>
                        </div>

                        {isAcceptanceDone ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 size={13} /> Đã Nghiệm Thu 100%
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                            {isContractSigned ? 'Chờ Nghiệm Thu' : 'Khóa Nghiệm Thu'}
                          </span>
                        )}
                      </div>

                      {!isContractSigned ? (
                        <div className="p-5 bg-slate-50 text-slate-500 rounded-xl text-center text-xs space-y-1 border border-slate-200">
                          <Lock size={20} className="mx-auto text-slate-400" />
                          <p className="font-bold text-slate-700">Bước Nghiệm thu đang tạm khóa</p>
                          <p className="text-[11px] text-slate-500">
                            Bạn cần ký Hợp đồng và thanh toán tạm ứng {cardDepositPct}% tại Bước 1 trước để kỹ thuật viên triển khai thực địa.
                          </p>
                        </div>
                      ) : !isAcceptanceDone ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs">
                          <div className="flex items-center justify-between text-slate-800 font-bold">
                            <span>Tiến độ chấm Node thực địa:</span>
                            <span className="font-mono bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg text-xs">
                              {req.mappedNodesCount ?? 'Đang kết nối'} Nodes đã chấm trên GIS Map
                            </span>
                          </div>

                          <div className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center font-bold text-slate-900">
                            <span>SỐ TIỀN {100 - cardDepositPct}% CÒN LẠI CẦN QUYẾT TOÁN:</span>
                            <span className="font-mono text-emerald-800 text-base font-black">
                              {(contract?.remaining70Percent?.toLocaleString('vi-VN') ?? '0')} VNĐ
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Họ tên Người ký Biên bản Nghiệm thu *
                              </label>
                              <Input
                                value={acceptanceSignatures[req.serviceRequestId] || defaultSignatureName}
                                onChange={e => setAcceptanceSignatures({ ...acceptanceSignatures, [req.serviceRequestId]: e.target.value })}
                                placeholder="Nhập tên người nghiệm thu..."
                                className="bg-white text-xs py-2"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Phương thức Quyết toán {100 - cardDepositPct}% còn lại *
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethods70({ ...paymentMethods70, [req.serviceRequestId]: 'BANK_TRANSFER' })}
                                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    (paymentMethods70[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER'
                                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <QrCode size={14} /> Chuyển khoản (VietQR)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethods70({ ...paymentMethods70, [req.serviceRequestId]: 'CASH' })}
                                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    paymentMethods70[req.serviceRequestId] === 'CASH'
                                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <DollarSign size={14} /> Tiền mặt
                                </button>
                              </div>
                            </div>
                          </div>

                          {req.deploymentStatus && req.deploymentStatus !== 'Completed' && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                              <AlertCircle size={16} className="text-amber-600 shrink-0" />
                              <span>
                                Tiến độ triển khai hiện tại: <strong>{deploymentLabels[req.deploymentStatus] || req.deploymentStatus}</strong>. Biên bản nghiệm thu sẽ mở hoàn tất sau khi Kỹ thuật viên đo kiểm kết nối trọn vẹn.
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={isProcessingId === req.serviceRequestId || (Boolean(req.deploymentStatus) && req.deploymentStatus !== 'Completed')}
                            onClick={() => handleSignAcceptanceAndPay70(req.serviceRequestId)}
                            className={`w-full font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              Boolean(req.deploymentStatus) && req.deploymentStatus !== 'Completed'
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'
                            }`}
                          >
                            {isProcessingId === req.serviceRequestId ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Đang xác nhận Ký Nghiệm thu & Ghi nhận qua API...</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare size={16} />
                                <span>KÝ BÀN GIAO NGHIỆM THU & QUYẾT TOÁN {100 - cardDepositPct}% CÒN LẠI ({(contract?.remaining70Percent?.toLocaleString('vi-VN') ?? '0')} VNĐ)</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        /* Acceptance Already Done Box */
                        <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-emerald-950 border-b border-emerald-200/80 pb-2.5">
                            <span className="flex items-center gap-2 text-sm text-emerald-900">
                              <CheckCircle2 size={18} className="text-emerald-700" />
                              ĐÃ KÝ NGHIỆM THU & QUYẾT TOÁN 100% CÔNG TRÌNH
                            </span>
                            <span className="text-[11px] bg-emerald-700 text-white px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
                              <Lock size={12} /> Đã khóa hoàn tất
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-emerald-950 bg-white/90 p-3 rounded-xl border border-emerald-200">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Đại diện nghiệm thu:</span>
                              <strong>{req.acceptanceDetails?.ownerSignatureName || defaultSignatureName}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Số tiền quyết toán {100 - cardDepositPct}%:</span>
                              <strong className="text-emerald-700 font-mono text-sm">{(contract?.remaining70Percent || 0).toLocaleString('vi-VN')} VNĐ</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Phương thức thanh toán:</span>
                              <strong>{req.acceptanceDetails?.payment70Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (VietQR)'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Thời gian nghiệm thu:</span>
                              <strong className="font-mono text-[11px]">
                                {req.acceptedAtByOwner ? new Date(req.acceptedAtByOwner).toLocaleString('vi-VN') : 'Vừa xong'}
                              </strong>
                            </div>
                          </div>

                          <p className="text-xs text-emerald-900 font-medium pt-0.5">
                            🎉 Toàn bộ thiết bị phần cứng đã được bàn giao và chuyển sang trạng thái <strong>Vận hành chính thức</strong> trên nền tảng SmartFarm!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Collapse Button At Bottom */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(req.serviceRequestId)}
                        className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <ChevronUp size={14} /> Thu gọn chi tiết
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL: TẠO YÊU CẦU MỚI ─── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Gửi Yêu Cầu Hỗ Trợ Kỹ Thuật & Bảo Trì"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          {/* Request Type Selector Cards */}
          <div>
            <label className="block text-slate-700 font-bold mb-2">Loại Yêu Cầu *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={Boolean(getZoneContract(newReq.zoneId))}
                onClick={() => setNewReq({ ...newReq, requestType: 'INSTALLATION' })}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  Boolean(getZoneContract(newReq.zoneId))
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : newReq.requestType === 'INSTALLATION'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>⚡</span> Lắp Đặt Mới
                  </span>
                  {newReq.requestType === 'INSTALLATION' && (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Khảo sát thực địa, báo giá thiết bị IoT và lập Hợp đồng phân khu mới.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNewReq({ ...newReq, requestType: 'MAINTENANCE' })}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  newReq.requestType === 'MAINTENANCE'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🛠️</span> Bảo Trì & Thay Thế
                  </span>
                  {newReq.requestType === 'MAINTENANCE' && (
                    <CheckCircle2 size={16} className="text-amber-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Khắc phục sự cố cảm biến, thay thế van/bơm hoặc sửa chữa trạm node.
                </p>
              </button>
            </div>
          </div>

          {/* Zone Selector */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Khu Vực / Phân Khu Cần Xử Lý *</label>
            <select
              value={newReq.zoneId}
              onChange={e => {
                const zid = e.target.value;
                const c = getZoneContract(zid);
                setNewReq(prev => ({
                  ...prev,
                  zoneId: zid,
                  requestType: c && prev.requestType === 'INSTALLATION' ? 'MAINTENANCE' : prev.requestType
                }));
              }}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs focus:outline-none focus:border-[#119653]"
            >
              {zones.map(z => {
                const c = getZoneContract(z.zoneId);
                return (
                  <option key={z.zoneId} value={z.zoneId}>
                    {z.name} ({zoneCropLabel(z)}) {c ? `• [Đã có HĐ #${c.contractNumber}]` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Existing contract notice */}
          {(() => {
            const targetZoneContract = getZoneContract(newReq.zoneId);
            if (!targetZoneContract) return null;
            return (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <RefreshCw size={13} className="text-emerald-700" />
                    <span>Zone đã có Hợp đồng #{targetZoneContract.contractNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      navigate('/owner/farms', { state: { zoneId: newReq.zoneId, openContract: true } });
                    }}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Tái kí HĐ</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Phân khu này đang có hợp đồng hoạt động. Hệ thống hỗ trợ <strong>🛠️ Bảo trì & Thay thế Phần cứng</strong> hoặc <strong>Tái kí hợp đồng</strong>.
                </p>
              </div>
            );
          })()}

          {/* Title input */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tiêu Đề Yêu Cầu *</label>
            <Input
              required
              placeholder="VD: Cảm biến độ ẩm đất khu A mất tín hiệu kết nối"
              value={newReq.title}
              onChange={e => setNewReq({ ...newReq, title: e.target.value })}
              className="text-xs py-2 bg-white"
            />
          </div>

          {/* Description textarea */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô Tả Chi Tiết *</label>
            <textarea
              required
              rows={3}
              placeholder="Nhập chi tiết hiện trạng thiết bị, triệu chứng lỗi hoặc nhu cầu khảo sát thực địa..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#119653]"
              value={newReq.description}
              onChange={e => setNewReq({ ...newReq, description: e.target.value })}
            />
          </div>

          {/* Priority selector */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Mức Độ Ưu Tiên</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 'LOW', label: 'Thấp' },
                { val: 'MEDIUM', label: 'Bình thường' },
                { val: 'HIGH', label: 'Ưu tiên cao' },
                { val: 'CRITICAL', label: 'Khẩn cấp' },
              ].map(p => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setNewReq({ ...newReq, priority: p.val as any })}
                  className={`py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    newReq.priority === p.val
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang gửi API...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Gửi Yêu Cầu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: XÁC NHẬN HỦY PHIẾU ─── */}
      <Modal
        isOpen={!!cancellingRequestId}
        onClose={() => setCancellingRequestId(null)}
        title="Hủy Phiếu Yêu Cầu Dịch Vụ"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong>Xác nhận hủy phiếu yêu cầu #{cancellingRequestId?.substring(0, 8)}</strong>
              <p className="text-rose-700 leading-relaxed">
                Sau khi xác nhận hủy, yêu cầu sẽ chuyển sang trạng thái <strong>ĐÃ HỦY</strong> và kỹ thuật viên sẽ không tiếp tục thực hiện công việc này nữa.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Lý do hủy yêu cầu (tùy chọn)</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="VD: Đã khắc phục được sự cố, thay đổi kế hoạch sản xuất..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCancellingRequestId(null)}
              disabled={isCancelling}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <XCircle size={15} />
              <span>{isCancelling ? 'Đang xử lý...' : 'Xác Nhận Hủy'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: BIÊN LAI THANH TOÁN THÀNH CÔNG ─── */}
      {paymentSuccessData && (
        <Modal
          isOpen={true}
          onClose={() => setPaymentSuccessData(null)}
          title="Biên Lai Xác Nhận Giao Dịch Điện Tử"
        >
          <div className="text-center py-2 space-y-4">
            {/* Success Icon */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-75" />
              <div className="relative w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 size={36} />
              </div>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] uppercase tracking-wider inline-block">
                ✓ Giao dịch Thành công
              </span>
              <h3 className="text-base font-black text-slate-900 mt-2">
                {paymentSuccessData.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Biên lai điện tử xác nhận giao dịch trên nền tảng SmartFarm Platform
              </p>
            </div>

            {/* Amount Box */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block tracking-wider">
                Số tiền đã thanh toán
              </span>
              <div className="text-2xl font-black text-emerald-900 font-mono mt-0.5">
                {paymentSuccessData.amount.toLocaleString('vi-VN')} <span className="text-base font-bold">VNĐ</span>
              </div>
              <span className="text-[10px] text-emerald-700 mt-1 inline-block font-medium">
                {paymentSuccessData.stage === 'DEPOSIT_30'
                  ? `Giai đoạn: Tạm ứng ${paymentSuccessData.depositPercent ?? depositPct}% Hợp đồng triển khai`
                  : `Giai đoạn: Quyết toán ${100 - (paymentSuccessData.depositPercent ?? depositPct)}% Bàn giao nghiệm thu`}
              </span>
            </div>

            {/* Receipt Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-left space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mã phiếu yêu cầu:</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">#{paymentSuccessData.requestId.substring(0, 16)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Người đại diện ký:</span>
                <span className="font-bold text-slate-800">{paymentSuccessData.signerFullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Phương thức thanh toán:</span>
                <span className="font-semibold text-slate-800">
                  {paymentSuccessData.paymentMethod === 'CASH' ? '💵 Tiền mặt' : '💳 Chuyển khoản (VietQR)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Mã giao dịch (Ref):</span>
                <span className="font-mono text-emerald-800 font-bold">{paymentSuccessData.transactionRef}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Thời gian giao dịch:</span>
                <span className="font-mono text-slate-700">{new Date(paymentSuccessData.paidAt).toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Trạng thái xác thực:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {paymentSuccessData.status === 'Confirmed' ? 'ĐÃ XÁC NHẬN (CONFIRMED)' : paymentSuccessData.status}
                </span>
              </div>
            </div>

            {/* Next Steps Notice */}
            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-left text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <Lock size={14} className="text-amber-700" />
                Hợp đồng & Biên lai đã được cập nhật thành công
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                {paymentSuccessData.notes}
              </p>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPaymentSuccessData(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Xác nhận & Đóng biên lai</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Field Survey Report Modal (Read-only for Owner) */}
      {selectedRequestForSurvey && (
        <FieldSurveyReportModal
          isOpen={Boolean(selectedRequestForSurvey)}
          onClose={() => setSelectedRequestForSurvey(null)}
          readOnly={true}
          serviceRequest={{
            id: selectedRequestForSurvey.serviceRequestId,
            requestCode: selectedRequestForSurvey.serviceRequestId.substring(0, 8),
            farmId: selectedRequestForSurvey.farmId,
            farmName: selectedRequestForSurvey.farmName,
            zoneId: selectedRequestForSurvey.zoneId,
            zoneName: selectedRequestForSurvey.zoneName,
            title: selectedRequestForSurvey.title,
            status: selectedRequestForSurvey.status,
          }}
        />
      )}
    </div>
  );
};
