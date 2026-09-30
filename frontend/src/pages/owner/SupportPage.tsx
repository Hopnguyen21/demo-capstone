import React, { useState } from 'react';
import { mockServiceRequests, mockFarms, mockZones } from '../../mocks/mockData';
import { ServiceRequest } from '../../types';
import { supportService } from '../../services';
import {
  Headphones, Plus, CheckSquare, CheckCircle2, Clock, Wrench,
  Building2, User, AlertCircle, Info, Layers, FileText, DollarSign,
  QrCode, CreditCard, ShieldCheck, Lock, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';

export const SupportPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>(mockServiceRequests);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for Owner Contract Signature & 30% Payment
  const [ownerSignatures, setOwnerSignatures] = useState<Record<string, string>>({});
  const [paymentMethods30, setPaymentMethods30] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

  // Form states for Owner Acceptance & 70% Final Payment
  const [acceptanceSignatures, setAcceptanceSignatures] = useState<Record<string, string>>({});
  const [paymentMethods70, setPaymentMethods70] = useState<Record<string, 'CASH' | 'BANK_TRANSFER'>>({});

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

  const handleSignContractAndPay30 = async (requestId: string) => {
    const signature = ownerSignatures[requestId] || 'Lê Văn An (Chủ Trang Trại)';
    const method = paymentMethods30[requestId] || 'BANK_TRANSFER';

    await supportService.signContractAndPay30(requestId, signature, method);
    setRequests([...mockServiceRequests]);
    setSuccessMsg('🎉 ĐÃ KÝ HỢP ĐỒNG & THANH TOÁN 30% TẠM ỨNG THÀNH CÔNG! Kỹ thuật viên hiện đã có thể tiếp tục Vào Zone Chấm Node (Node Mapper).');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleSignAcceptanceAndPay70 = async (requestId: string) => {
    const signature = acceptanceSignatures[requestId] || 'Lê Văn An (Chủ Trang Trại)';
    const method = paymentMethods70[requestId] || 'BANK_TRANSFER';

    await supportService.signAcceptanceAndPay70(requestId, signature, method);
    setRequests([...mockServiceRequests]);
    setSuccessMsg('✅ ĐÃ KÝ NGHIỆM THU BÀN GIAO & THANH TOÁN 70% CÒN LẠI! Phiếu yêu cầu đã hoàn tất 100%.');
    setTimeout(() => setSuccessMsg(null), 5000);
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
            <Headphones size={14} /> Quản lý Yêu cầu • Hợp đồng & Nghiệm thu Công trình
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Quản lý Yêu cầu Dịch vụ, Ký Hợp đồng & Nghiệm thu (Owner Portal)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Chủ trang trại nhận Hợp đồng báo giá, ký tên & cọc 30% tiền mặt/chuyển khoản để cho phép Kỹ thuật viên chấm Node, sau đó ký Nghiệm thu và thanh toán 70% còn lại.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shrink-0">
          <Plus size={16} className="mr-1.5" /> Gửi Yêu cầu Hỗ trợ Mới
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-6">
        {requests.map(req => {
          const isInstallation = req.requestType === 'INSTALLATION' || req.requestType === 'INITIAL_SETUP';
          const contract = req.contractDetails;
          const isContractSigned = Boolean(contract?.isSignedByOwner && contract?.is30PercentPaid);
          const isAcceptanceDone = Boolean(req.isAcceptedByOwner || req.acceptanceDetails?.isAcceptanceSigned);

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
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="font-semibold text-[#062326] flex items-center gap-1">
                      <Building2 size={13} /> {req.farmName} ({req.zoneName})
                    </span>
                    <span>•</span>
                    <span>Kỹ thuật viên: <strong>{req.assignedTechnicianName || 'Trần Minh Trí'}</strong></span>
                  </p>
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
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-amber-950 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <FileText size={16} className="text-amber-700" />
                      1. Hợp đồng Báo giá Thiết bị & Thanh toán Tạm ứng 30%
                    </h4>
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
                            onClick={() => handleSignContractAndPay30(req.serviceRequestId)}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2"
                          >
                            <CheckSquare size={16} />
                            KÝ HỢP ĐỒNG & THANH TOÁN 30% CỌC ({contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ)
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950 text-xs">
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              Đã ký Hợp đồng bởi Owner ({contract.ownerSignatureName || 'Lê Văn An'})
                            </span>
                            <span className="text-[10px] bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded font-mono">
                              {contract.paid30At ? new Date(contract.paid30At).toLocaleString('vi-VN') : 'Vừa xong'}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800">
                            Đã thanh toán 30% Tạm ứng: <strong>{contract.deposit30Percent.toLocaleString('vi-VN')} VNĐ</strong> qua <strong>{contract.payment30Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (VietQR)'}</strong>. (Mã GD: <span className="font-mono">{contract.payment30Ref}</span>).
                          </p>
                          <p className="text-[11px] text-emerald-900 font-semibold pt-1">
                            🚀 Kỹ thuật viên hiện đã được mở khóa và đang tiến hành Vào Zone Chấm Node (Node Mapper)!
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
                        onClick={() => handleSignAcceptanceAndPay70(req.serviceRequestId)}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-md text-xs flex items-center justify-center gap-2"
                      >
                        <CheckSquare size={16} />
                        KÝ BÀN GIAO NGHIỆM THU & THANH TOÁN 70% CÒN LẠI ({(contract?.remaining70Percent || 9450000).toLocaleString('vi-VN')} VNĐ)
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl space-y-1 text-emerald-950 text-xs">
                      <div className="flex items-center justify-between font-bold text-emerald-900">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={16} className="text-emerald-700" />
                          Đã ký Nghiệm thu & Bàn giao bởi Owner ({req.acceptanceDetails?.ownerSignatureName || 'Lê Văn An'})
                        </span>
                        <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded font-mono">
                          {req.acceptedAtByOwner ? new Date(req.acceptedAtByOwner).toLocaleString('vi-VN') : 'Hoàn tất'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900">
                        Đã thanh toán đủ 100% Hợp đồng (70% còn lại: <strong>{(contract?.remaining70Percent || 9450000).toLocaleString('vi-VN')} VNĐ</strong> qua <strong>{req.acceptanceDetails?.payment70Method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</strong>).
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
