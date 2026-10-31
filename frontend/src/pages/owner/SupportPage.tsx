import { NO_CROP_LABEL, zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';
import React, { useState, useEffect } from 'react';
import { ServiceRequest, ZoneContract } from '../../types';
import { supportService, zoneContractService } from '../../services';
import { useAuth } from '@/app/providers/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Headphones, Plus, CheckSquare, CheckCircle2, Clock, Wrench,
  Building2, User, AlertCircle, Info, Layers, FileText, DollarSign,
  QrCode, CreditCard, ShieldCheck, Lock, ChevronDown, ChevronUp, Package,
  RefreshCw, Loader2, Sparkles, ArrowUpRight, ExternalLink, Sprout
} from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';

export const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { farms, zones } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [zoneContracts, setZoneContracts] = useState<ZoneContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).createRequest) {
      const { farmId, zoneId, zoneName } = location.state as any;
      setNewReq(prev => ({
        ...prev,
        farmId: farmId || prev.farmId,
        zoneId: zoneId || prev.zoneId,
        requestType: 'INSTALLATION',
        title: `Khảo sát & Báo giá Hợp đồng thiết bị IoT cho ${zoneName || 'Phân khu'}`,
        description: `Kính gửi phòng Kỹ thuật: Trang trại đề nghị khảo sát thực địa, báo giá thiết bị IoT và lập Hợp đồng phân khu cho ${zoneName || 'Zone'}.`,
        priority: 'HIGH'
      }));
      setIsModalOpen(true);
    }
  }, [location.state]);

  // State for Payment Success Screen / Receipt Modal
  interface PaymentSuccessModalData {
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

  // Form states for Owner Contract Signature & 30% Payment
  const [ownerSignatures, setOwnerSignatures] = useState<Record<string, string>>({});
  const [paymentMethods30, setPaymentMethods30] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

  // Form states for Owner Acceptance & 70% Final Payment
  const [acceptanceSignatures, setAcceptanceSignatures] = useState<Record<string, string>>({});
  const [paymentMethods70, setPaymentMethods70] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

  // Modal Owner Create Support / Maintenance Request
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'INSTALLATION' | 'MAINTENANCE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [newReq, setNewReq] = useState({
    farmId: '30000000-0000-0000-0000-000000000001',
    zoneId: '32000000-0000-0000-0000-000000000001',
    requestType: 'MAINTENANCE' as 'INSTALLATION' | 'MAINTENANCE',
    title: '',
    description: '',
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  });

  const handleSignContractAndPay30 = async (requestId: string) => {
    const signature = ownerSignatures[requestId] || 'Lê Văn An (Chủ Trang Trại)';
    const method = paymentMethods30[requestId] || 'BANK_TRANSFER';
    setIsProcessingId(requestId);
    setErrorMsg(null);

    try {
      const paymentRes = await supportService.signContractAndPay30(requestId, signature, method);
      const req = requests.find(r => r.serviceRequestId === requestId);
      const amount = paymentRes?.amount || req?.contractDetails?.deposit30Percent || 0;

      // Show Payment Success Screen Modal
      setPaymentSuccessData({
        stage: 'DEPOSIT_30',
        requestId,
        title: 'KÝ HỢP ĐỒNG & THANH TOÁN 30% TẠM ỨNG THÀNH CÔNG',
        amount,
        paymentMethod: paymentRes?.paymentMethod || method,
        signerFullName: paymentRes?.signerFullName || signature,
        transactionRef: paymentRes?.transactionReference || `PAY30-${Date.now()}`,
        paidAt: paymentRes?.paidAtUtc || new Date().toISOString(),
        status: paymentRes?.status || 'Confirmed',
        contractTotal: req?.contractDetails?.totalAmount,
        notes: 'Hệ thống SmartFarm đã ghi nhận thanh toán tạm ứng 30% và Hợp đồng đã có hiệu lực. Nút Ký hợp đồng & Thanh toán đã được KHÓA. Kỹ thuật viên hiện đã có thể tiếp tục Vào Zone Chấm Node (Node Mapper).',
      });

      await loadRequests();
      setSuccessMsg('🎉 ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN 30% TẠM ỨNG THÀNH CÔNG!');
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
    const signature = acceptanceSignatures[requestId] || 'Lê Văn An (Chủ Trang Trại)';
    const method = paymentMethods70[requestId] || 'BANK_TRANSFER';
    setIsProcessingId(requestId);
    setErrorMsg(null);

    try {
      const paymentRes = await supportService.signAcceptanceAndPay70(requestId, signature, method);
      const req = requests.find(r => r.serviceRequestId === requestId);
      const amount = paymentRes?.amount || req?.contractDetails?.remaining70Percent || 0;

      // Show Payment Success Screen Modal
      setPaymentSuccessData({
        stage: 'FINAL_70',
        requestId,
        title: 'NGHIỆM THU BÀN GIAO & QUYẾT TOÁN 70% THÀNH CÔNG',
        amount,
        paymentMethod: paymentRes?.paymentMethod || method,
        signerFullName: paymentRes?.signerFullName || signature,
        transactionRef: paymentRes?.transactionReference || `PAY70-${Date.now()}`,
        paidAt: paymentRes?.paidAtUtc || new Date().toISOString(),
        status: paymentRes?.status || 'Confirmed',
        contractTotal: req?.contractDetails?.totalAmount,
        notes: 'Đã hoàn tất nghiệm thu bàn giao 100% công trình và thanh toán đầy đủ toàn bộ giá trị hợp đồng. Nút Nghiệm thu đã được KHÓA. Toàn bộ thiết bị đã chuyển sang trạng thái Vận hành chính thức!',
      });

      await loadRequests();
      setSuccessMsg('✅ ĐÃ KÝ NGHIỆM THU BÀN GIAO & THANH TOÁN 70% CÒN LẠI! Phiếu yêu cầu đã hoàn tất 100%.');
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
        requestedBy: 'Lê Văn An (Owner)',
        assignedOwnerName: 'Lê Văn An',
        assignedTechnicianName: 'Trần Minh Trí (Kỹ thuật viên IoT)',
      });

      await loadRequests();
      setIsModalOpen(false);
      setNewReq({ farmId: '30000000-0000-0000-0000-000000000001', zoneId: '32000000-0000-0000-0000-000000000001', requestType: 'MAINTENANCE', title: '', description: '', priority: 'HIGH' });
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white rounded-2xl shadow-md border border-emerald-400/40">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-800/30 text-emerald-100 text-xs font-semibold mb-2 border border-emerald-300/30 backdrop-blur-xs">
            <Headphones size={14} /> Quản lý Yêu cầu • Hợp đồng & Nghiệm thu Công trình
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Quản lý Yêu cầu Dịch vụ, Ký Hợp đồng & Nghiệm thu (Owner Portal)
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            Chủ trang trại nhận Hợp đồng báo giá, ký tên & cọc 30% tiền mặt/chuyển khoản để cho phép Kỹ thuật viên chấm Node, sau đó ký Nghiệm thu và thanh toán 70% còn lại.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => loadRequests()}
            disabled={isLoading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới API</span>
          </Button>

          <Button onClick={() => setIsModalOpen(true)} className="bg-white hover:bg-emerald-50 text-[#119653] font-bold shrink-0 shadow-sm">
            <Plus size={16} className="mr-1.5" /> Gửi Yêu cầu Hỗ trợ Mới
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && requests.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <Loader2 size={32} className="mx-auto text-emerald-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Đang tải dữ liệu Hợp đồng, Báo giá & Nghiệm thu từ máy chủ...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && requests.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <Headphones size={36} className="mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">Chưa có Phiếu Yêu cầu Kỹ thuật nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Chủ trang trại có thể tạo yêu cầu lắp đặt mới hoặc bảo dưỡng để nhận báo giá hợp đồng từ Kỹ thuật viên.
          </p>
          <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
            <Plus size={14} className="mr-1" /> Gửi Yêu cầu Hỗ trợ Đầu tiên
          </Button>
        </div>
      )}

      {/* Filter Tabs & Search / Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTabFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="OPEN">Chờ tiếp nhận (Open)</option>
            <option value="IN_PROGRESS">Đang xử lý (In Progress)</option>
            <option value="ACCEPTED_BY_OWNER">Đã nghiệm thu (Accepted)</option>
            <option value="RESOLVED">Đã hoàn tất (Resolved)</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-6">
        {requests
          .filter(req => {
            const isInst = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
            const isMaint = req.requestType === 'MAINTENANCE' || req.requestType === 'REPAIR' || req.requestType === 'REPLACEMENT';
            if (activeTabFilter === 'INSTALLATION' && !isInst) return false;
            if (activeTabFilter === 'MAINTENANCE' && !isMaint) return false;
            if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
            return true;
          })
          .map(req => {
          const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
          const contract = req.contractDetails;
          const isContractSigned = Boolean(contract?.isSignedByOwner && contract?.is30PercentPaid);
          const isAcceptanceDone = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned);

          // Resolve exact Zone name of the contract
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

          return (
            <div key={req.serviceRequestId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5 hover:border-slate-300 transition-all">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      isInstallation ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {isInstallation ? '⚡ LẮP ĐẶT THIẾT BỊ MỚI' : '🛠️ BẢO TRÌ & BẢO DƯỠNG'}
                    </span>
                    <StatusBadge status={req.status} />

                    {isContractSigned ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 size={12} /> ĐÃ KÝ HĐ & CỌC 30%
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 animate-pulse">
                        ⏳ Chờ Ký HĐ & Cọc 30%
                      </span>
                    )}

                    {isAcceptanceDone && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                        <CheckSquare size={12} /> ĐÃ NGHIỆM THU 100%
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">#{req.serviceRequestId}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-1">{req.title}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
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
                      className="font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-200/90 hover:border-emerald-300 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs group"
                      title={`Nhấn để chuyển đến ${contractZoneDisplayName} và mở Hợp đồng phân khu`}
                    >
                      <Sprout size={13} className="text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="underline decoration-emerald-500/50 underline-offset-2 group-hover:decoration-emerald-800">
                        {contractZoneDisplayName}
                      </span>
                      <ArrowUpRight size={13} className="text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                    </button>
                    <span>•</span>
                    <span>Kỹ thuật viên: <strong>{req.assignedTechnicianName || 'Trần Minh Trí'}</strong></span>
                  </div>
                </div>

                <div className="text-right text-xs shrink-0 font-mono">
                  <span className="text-slate-400 block text-[10px]">Ngày gửi yêu cầu</span>
                  <strong className="text-slate-700">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</strong>
                </div>
              </div>

              <p className="text-xs text-slate-700 p-3 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                {req.description}
              </p>

              {/* CRITICAL SECTION 1 & SECTION 2 RENDERED TOGETHER ON THE SAME REQUEST! */}
              <div className="space-y-4 pt-2">
                {/* ========================================================================= */}
                {/* SECTION 1: HỢP ĐỒNG & BÁO GIÁ LẮP ĐẶT (BƯỚC 1: KÝ HĐ & THANH TOÁN TẠM ỨNG 30%) */}
                {/* ========================================================================= */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-amber-950 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <FileText size={16} className="text-amber-700" />
                      1. Hợp đồng Báo giá Thiết bị & Thanh toán Tạm ứng 30%
                    </h4>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 transition-all shadow-2xs cursor-pointer"
                        title={`Xem hồ sơ hợp đồng của ${contractZoneDisplayName} tại Trang trại`}
                      >
                        <ExternalLink size={12} className="text-amber-700" />
                        <span>Xem HĐ của Zone</span>
                      </button>
                      {isContractSigned ? (
                        <span className="px-2.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={12} /> Đã Ký & Thanh toán 30%
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[10px]">
                          Cần Owner Ký tên & Cọc 30%
                        </span>
                      )}
                    </div>
                  </div>

                  {contract && contract.items && contract.items.length > 0 ? (
                    <div className="space-y-3">
                      {/* Product Quotation Table (Image 2 style format!) */}
                      <div className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-amber-100/80 text-amber-950 font-bold sticky top-0 border-b border-amber-200">
                              <tr>
                                <th className="p-2">Mã hàng</th>
                                <th className="p-2">Tên sản phẩm / Thiết bị</th>
                                <th className="p-2 text-center">ĐVT</th>
                                <th className="p-2 text-right">Đơn giá (đ)</th>
                                <th className="p-2 text-center">VAT</th>
                                <th className="p-2 text-center">SL</th>
                                <th className="p-2 text-right">Thành tiền (đ)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {contract.items.map(item => (
                                <tr key={item.id} className="hover:bg-amber-50/50">
                                  <td className="p-2 font-mono font-bold text-slate-900">{item.code}</td>
                                  <td className="p-2">
                                    <div className="font-semibold text-slate-800">{item.name}</div>
                                    {item.notes && <div className="text-[10px] text-slate-400 italic">{item.notes}</div>}
                                  </td>
                                  <td className="p-2 text-center text-slate-600">{item.unit}</td>
                                  <td className="p-2 text-right font-mono text-slate-700">{item.unitPrice.toLocaleString('vi-VN')}đ</td>
                                  <td className="p-2 text-center font-mono text-slate-500">{item.vatPercent}%</td>
                                  <td className="p-2 text-center font-mono font-bold">{item.quantity}</td>
                                  <td className="p-2 text-right font-mono font-bold text-emerald-900">{item.totalAmount.toLocaleString('vi-VN')}đ</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Contract Totals & Deposit summary */}
                      <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-2 text-xs">
                        {contract.notes?.includes('lần 2 trong 2 tháng') && (
                          <div className="flex items-center gap-1.5 p-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-950 rounded-lg font-bold text-xs border border-amber-300">
                            <Sparkles size={15} className="text-amber-600 shrink-0" />
                            <span>🎉 Hợp đồng đã áp dụng Ưu đãi Mua lần 2 trong vòng 2 tháng (Giảm giá 15%)!</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-600">
                          <span>Tổng cộng (gồm VAT 8%):</span>
                          <strong className="font-mono text-slate-900">{contract.totalAmount.toLocaleString('vi-VN')} VNĐ</strong>
                        </div>
                        <div className="flex justify-between font-bold text-amber-900 text-sm pt-1 border-t border-slate-100">
                          <span>SỐ TIỀN TẠM ỨNG 30% CẦN THANH TOÁN TẠI ĐÂY:</span>
                          <span className="font-mono text-amber-900 text-base">{contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ</span>
                        </div>
                      </div>

                      {/* CONTRACT SIGNATURE & 30% PAYMENT FORM FOR OWNER */}
                      {!isContractSigned ? (
                        <div className="p-3.5 bg-white border-2 border-amber-400 rounded-xl space-y-3 shadow-xs">
                          <h5 className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                            <ShieldCheck size={16} className="text-amber-600" />
                            Xác nhận Ký Hợp đồng & Thanh toán 30% Tạm ứng ({contract.deposit30Percent.toLocaleString('vi-VN')}đ)
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Họ tên Người đại diện Ký Hợp đồng *</label>
                              <Input
                                value={ownerSignatures[req.serviceRequestId] || 'Lê Văn An (Chủ Trang Trại)'}
                                onChange={e => setOwnerSignatures({ ...ownerSignatures, [req.serviceRequestId]: e.target.value })}
                                placeholder="Nhập tên người ký..."
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Phương thức Thanh toán 30% Cọc *</label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethods30({ ...paymentMethods30, [req.serviceRequestId]: 'BANK_TRANSFER' })}
                                  className={`flex-1 p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    (paymentMethods30[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <QrCode size={14} /> Chuyển khoản (VietQR)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethods30({ ...paymentMethods30, [req.serviceRequestId]: 'CASH' })}
                                  className={`flex-1 p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    paymentMethods30[req.serviceRequestId] === 'CASH'
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <DollarSign size={14} /> Tiền mặt
                                </button>
                              </div>
                            </div>
                          </div>

                          {(paymentMethods30[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER' ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-[11px]">
                              <div>
                                <span className="font-bold text-amber-900 block">Ngân hàng MBBank - STK: 0903666888 (SMARTFARM IOT)</span>
                                <span className="text-slate-600">Nội dung chuyển khoản: <strong className="font-mono text-amber-950">COC30 #{req.serviceRequestId.toUpperCase()}</strong></span>
                              </div>
                              <span className="bg-amber-200 text-amber-950 font-bold px-2 py-1 rounded text-[10px] font-mono shrink-0">
                                Scan VietQR OK
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                              💵 Đã chọn thanh toán <strong>Tiền mặt</strong> trực tiếp cho Kỹ thuật viên phụ trách.
                            </div>
                          )}

                          <Button
                            disabled={isProcessingId === req.serviceRequestId}
                            onClick={() => handleSignContractAndPay30(req.serviceRequestId)}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2"
                          >
                            {isProcessingId === req.serviceRequestId ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Đang xác thực Ký HĐ & Ghi nhận Cọc 30% qua API...
                              </>
                            ) : (
                              <>
                                <CheckSquare size={16} />
                                KÝ HỢP ĐỒNG & THANH TOÁN 30% CỌC ({contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ)
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl space-y-3 text-emerald-950 text-xs shadow-xs">
                          <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-200 pb-2">
                            <span className="flex items-center gap-2 text-sm text-emerald-800">
                              <CheckCircle2 size={18} className="text-emerald-600" />
                              ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN 30% CỌC THÀNH CÔNG
                            </span>
                            <span className="text-[11px] bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
                              <Lock size={12} /> Đã khóa thao tác
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-900 bg-white/80 p-3 rounded-lg border border-emerald-200">
                            <div>
                              <span className="text-slate-500 block">Đại diện ký:</span>
                              <strong>{contract.ownerSignatureName || 'Lê Văn An (Chủ Trang Trại)'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Số tiền tạm ứng 30%:</span>
                              <strong className="text-emerald-700 font-mono text-xs">{contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Phương thức thanh toán:</span>
                              <strong>{contract.payment30Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (VietQR)'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Mã GD / Thời gian:</span>
                              <strong className="font-mono text-[10px]">{contract.payment30Ref} ({contract.paid30At ? new Date(contract.paid30At).toLocaleString('vi-VN') : 'Vừa xong'})</strong>
                            </div>
                          </div>

                          {/* KHÓA NÚT KÝ HỢP ĐỒNG VÀ THANH TOÁN - KHÔNG CHO BẤM NỮA */}
                          <button
                            type="button"
                            disabled={true}
                            className="w-full bg-slate-100 text-slate-400 font-bold py-2.5 px-4 rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-2 cursor-not-allowed select-none opacity-90 shadow-2xs"
                            title="Hợp đồng đã được ký và thanh toán 30% cọc thành công. Nút này đã bị khóa."
                          >
                            <Lock size={15} className="text-slate-400" />
                            ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN 30% CỌC (NÚT ĐÃ KHÓA HOÀN TOÀN)
                          </button>

                          <p className="text-[11px] text-emerald-900 font-semibold pt-0.5 flex items-center justify-between gap-2 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <span>🚀</span> Kỹ thuật viên hiện đã được mở khóa quyền Vào Zone Chấm Node (Node Mapper) trên bản đồ!
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
                              className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-bold underline text-[11px] cursor-pointer"
                            >
                              <span>Đi đến Zone & Hợp đồng</span>
                              <ArrowUpRight size={12} />
                            </button>
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200">
                      ⏳ Kỹ thuật viên chưa soạn Báo giá & Hợp đồng cho Yêu cầu này.
                    </div>
                  )}
                </div>

                {/* ========================================================================= */}
                {/* SECTION 2: BIÊN BẢN NGHIỆM THU & THANH TOÁN 70% CÒN LẠI (BƯỚC 2: BÀN GIAO) */}
                {/* ========================================================================= */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-emerald-950 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <CheckSquare size={16} className="text-emerald-700" />
                      2. Biên bản Nghiệm thu Công trình & Thanh toán 70% còn lại
                    </h4>
                    {isAcceptanceDone ? (
                      <span className="px-2.5 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]">
                        Đã Nghiệm thu 100%
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                        {isContractSigned ? 'Chờ Nghiệm Thu' : 'Khóa Nghiệm thu'}
                      </span>
                    )}
                  </div>

                  {!isContractSigned ? (
                    <div className="p-3 bg-slate-100 text-slate-500 rounded-xl text-center italic text-xs">
                      🔒 Bước này bị khóa. Cần ký Hợp đồng & thanh toán 30% cọc tại Bước 1 trước khi nghiệm thu.
                    </div>
                  ) : !isAcceptanceDone ? (
                    <div className="p-3.5 bg-white border-2 border-emerald-400 rounded-xl space-y-3 shadow-xs text-xs">
                      <div className="flex items-center justify-between text-emerald-900 font-bold">
                        <span>Tiến độ chấm Node thực địa:</span>
                        <span className="font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                          {req.mappedNodesCount || 0} Nodes đã chấm trên GIS Map
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between font-bold text-slate-900">
                        <span>SỐ TIỀN 70% CÒN LẠI CẦN THANH TOÁN KHI NGHIỆM THU:</span>
                        <span className="font-mono text-emerald-950 text-sm">
                          {(contract?.remaining70Percent || 9450000).toLocaleString('vi-VN')} VNĐ
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Họ tên Người ký Biên bản Nghiệm thu *</label>
                          <Input
                            value={acceptanceSignatures[req.serviceRequestId] || 'Lê Văn An (Chủ Trang Trại)'}
                            onChange={e => setAcceptanceSignatures({ ...acceptanceSignatures, [req.serviceRequestId]: e.target.value })}
                            placeholder="Nhập tên người nghiệm thu..."
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Phương thức Thanh toán 70% còn lại *</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPaymentMethods70({ ...paymentMethods70, [req.serviceRequestId]: 'BANK_TRANSFER' })}
                              className={`flex-1 p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                (paymentMethods70[req.serviceRequestId] || 'BANK_TRANSFER') === 'BANK_TRANSFER'
                                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <QrCode size={14} /> Chuyển khoản (VietQR)
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentMethods70({ ...paymentMethods70, [req.serviceRequestId]: 'CASH' })}
                              className={`flex-1 p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                paymentMethods70[req.serviceRequestId] === 'CASH'
                                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <DollarSign size={14} /> Tiền mặt
                            </button>
                          </div>
                        </div>
                      </div>

                      <Button
                        disabled={isProcessingId === req.serviceRequestId}
                        onClick={() => handleSignAcceptanceAndPay70(req.serviceRequestId)}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2"
                      >
                        {isProcessingId === req.serviceRequestId ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Đang xác nhận Ký Nghiệm thu & Ghi nhận 70% qua API...
                          </>
                        ) : (
                          <>
                            <CheckSquare size={16} />
                            KÝ BÀN GIAO NGHIỆM THU & THANH TOÁN 70% CÒN LẠI ({(contract?.remaining70Percent || 9450000).toLocaleString('vi-VN')} VNĐ)
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-100/80 border-2 border-emerald-500 rounded-xl space-y-3 text-emerald-950 text-xs shadow-xs">
                      <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-300 pb-2">
                        <span className="flex items-center gap-2 text-sm text-emerald-800">
                          <CheckCircle2 size={18} className="text-emerald-700" />
                          ĐÃ KÝ NGHIỆM THU & QUYẾT TOÁN 100% CÔNG TRÌNH
                        </span>
                        <span className="text-[11px] bg-emerald-700 text-white px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
                          <Lock size={12} /> Đã khóa hoàn tất
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-900 bg-white/80 p-3 rounded-lg border border-emerald-200">
                        <div>
                          <span className="text-slate-500 block">Đại diện nghiệm thu:</span>
                          <strong>{req.acceptanceDetails?.ownerSignatureName || 'Lê Văn An (Chủ Trang Trại)'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Số tiền thanh toán 70%:</span>
                          <strong className="text-emerald-700 font-mono text-xs">{(contract?.remaining70Percent || 0).toLocaleString('vi-VN')} VNĐ</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Phương thức thanh toán:</span>
                          <strong>{req.acceptanceDetails?.payment70Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (VietQR)'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Thời gian nghiệm thu:</span>
                          <strong className="font-mono text-[10px]">{req.acceptedAtByOwner ? new Date(req.acceptedAtByOwner).toLocaleString('vi-VN') : 'Vừa xong'}</strong>
                        </div>
                      </div>

                      {/* KHÓA NÚT KÝ NGHIỆM THU VÀ THANH TOÁN 70% - KHÔNG CHO BẤM NỮA */}
                      <button
                        type="button"
                        disabled={true}
                        className="w-full bg-slate-100 text-slate-400 font-bold py-2.5 px-4 rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-2 cursor-not-allowed select-none opacity-90 shadow-2xs"
                        title="Công trình đã được nghiệm thu và thanh toán 100%, nút này đã bị khóa."
                      >
                        <Lock size={15} className="text-slate-400" />
                        ĐÃ HOÀN TẤT NGHIỆM THU & THANH TOÁN 100% (NÚT ĐÃ KHÓA HOÀN TOÀN)
                      </button>

                      <p className="text-[11px] text-emerald-900 font-medium pt-0.5">
                        🎉 Đã thanh toán đầy đủ 100% giá trị hợp đồng ({(contract?.totalAmount || 0).toLocaleString('vi-VN')} VNĐ). Thiết bị đã chuyển sang trạng thái Vận hành chính thức!
                      </p>
                    </div>
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
            <label className="block text-slate-700 font-bold mb-1">Chọn Khu vực / Zone cần xử lý *</label>
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
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#119653]"
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

          <div>
            <label className="block text-slate-700 font-bold mb-1">Loại Yêu cầu *</label>
            <select
              value={newReq.requestType}
              onChange={e => setNewReq({ ...newReq, requestType: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:outline-none focus:border-[#119653]"
            >
              {!getZoneContract(newReq.zoneId) && (
                <option value="INSTALLATION">⚡ Lắp đặt Thiết bị Mới & Chấm Node</option>
              )}
              {getZoneContract(newReq.zoneId) && (
                <option value="INSTALLATION" disabled>
                  ⚡ Lắp đặt Mới (Zone đã có HĐ - Vui lòng chọn Tái kí HĐ)
                </option>
              )}
              <option value="MAINTENANCE">🛠️ Bảo trì & Thay thế Phần cứng</option>
            </select>
          </div>

          {/* Warning banner when a zone with contract is selected */}
          {(() => {
            const targetZoneContract = getZoneContract(newReq.zoneId);
            if (!targetZoneContract) return null;
            return (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-2 text-indigo-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <RefreshCw size={14} className="text-indigo-600" />
                    <span>Zone đã có Hợp đồng #{targetZoneContract.contractNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      navigate('/owner/farms', { state: { zoneId: newReq.zoneId, openContract: true } });
                    }}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>Tái kí hợp đồng</span>
                  </button>
                </div>
                <p className="text-[11px] text-indigo-800">
                  Khu vực này đã có hợp đồng hoạt động. Hệ thống không mở yêu cầu lắp đặt mới cho Zone này mà hỗ trợ <strong>Tái kí hợp đồng</strong> hoặc <strong>🛠️ Bảo trì & Thay thế Phần cứng</strong>.
                </p>
              </div>
            );
          })()}

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
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#119653]"
              value={newReq.description}
              onChange={e => setNewReq({ ...newReq, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {isCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" /> Đang gửi API...
                </>
              ) : (
                'Gửi Yêu cầu'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MÀN HÌNH THANH TOÁN THÀNH CÔNG (PAYMENT SUCCESS MODAL / RECEIPT)          */}
      {/* ========================================================================= */}
      {paymentSuccessData && (
        <Modal
          isOpen={true}
          onClose={() => setPaymentSuccessData(null)}
          title="Biên lai Xác nhận Giao dịch Thanh toán"
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

            {/* Prominent Amount Box */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block tracking-wider">
                Số tiền đã thanh toán
              </span>
              <div className="text-2xl font-black text-emerald-900 font-mono mt-0.5">
                {paymentSuccessData.amount.toLocaleString('vi-VN')} <span className="text-base font-bold">VNĐ</span>
              </div>
              <span className="text-[10px] text-emerald-700 mt-1 inline-block font-medium">
                {paymentSuccessData.stage === 'DEPOSIT_30'
                  ? 'Giai đoạn: Tạm ứng 30% Hợp đồng triển khai'
                  : 'Giai đoạn: Quyết toán 70% Bàn giao nghiệm thu'}
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
                Nút Thao Tác Ký & Thanh Toán Đã Được Khóa
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                {paymentSuccessData.notes}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <Button
                onClick={() => setPaymentSuccessData(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                Xác nhận & Đóng biên lai
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
