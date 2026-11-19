import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { Zone, Farm, ZoneContract, ContractPackage } from '../../types';
import { zoneContractService, discountService, contractPackageService } from '../../services';
import { useBusinessParameters } from '../../services/businessParameters';
import {
  FileText, Calendar, DollarSign, Percent, ShieldCheck, CheckCircle2,
  Building2, MapPin, Tag, User, Phone, Sparkles, AlertCircle, Link, PackageCheck
} from 'lucide-react';

interface ZoneContractCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: Farm | null;
  zone: Zone | null;
  existingContracts?: ZoneContract[];
  parentContract?: ZoneContract | null;
  onSuccess: (newContract: ZoneContract) => void;
}

export const ZoneContractCreateModal: React.FC<ZoneContractCreateModalProps> = ({
  isOpen,
  onClose,
  farm,
  zone,
  existingContracts = [],
  parentContract = null,
  onSuccess,
}) => {
  const [contractNumber, setContractNumber] = useState<string>('');
  const [cropType, setCropType] = useState<string>('');
  const [lesseeName, setLesseeName] = useState<string>('HTX Nông Nghiệp Công Nghệ Cao LangBiang');
  const [lesseePhone, setLesseePhone] = useState<string>('0912345678');
  const [lesseeIdentityNumber, setLesseeIdentityNumber] = useState<string>('049095001234');
  const [lesseeAddress, setLesseeAddress] = useState<string>('Phường 7, TP. Đà Lạt, Tỉnh Lâm Đồng');

  // Dates
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState<number>(12); // default 12 months

  // Selected parent contract for returning customer link
  const [selectedParentId, setSelectedParentId] = useState<string>(parentContract?.id || '');

  // Package Selection & Mode
  const [availablePackages, setAvailablePackages] = useState<ContractPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(false);
  const [applyPackage, setApplyPackage] = useState<boolean>(true); // ô tích chọn có kèm gói hay không
  const [packageMode, setPackageMode] = useState<'standard' | 'custom'>('standard');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [customPackageName, setCustomPackageName] = useState<string>('');
  const [customPackageDesc, setCustomPackageDesc] = useState<string>('');
  const [customPackagePrice, setCustomPackagePrice] = useState<number>(9500000);

  // Check if user has an existing contract signed/created within the last 2 months (60 days)
  const recentTwoMonthsContract = React.useMemo(() => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const match = existingContracts.find(c => {
      const dateStr = c.createdAtUtc || c.signedAtUtc || c.startDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d >= twoMonthsAgo;
    });

    if (match) return match;
    if (parentContract) {
      const pDateStr = parentContract.createdAtUtc || parentContract.signedAtUtc || parentContract.startDate;
      if (pDateStr) {
        const pd = new Date(pDateStr);
        if (!isNaN(pd.getTime()) && pd >= twoMonthsAgo) return parentContract;
      }
    }
    return null;
  }, [existingContracts, parentContract]);

  const isSecondPurchaseInTwoMonths = Boolean(recentTwoMonthsContract);

  // Pricing inputs
  const [monthlyRent, setMonthlyRent] = useState<number>(12000000); // 12,000,000 đ/tháng
  const [vatPercent, setVatPercent] = useState<number>(8); // 8% VAT
  const businessParams = useBusinessParameters(); // tỷ lệ cọc và mức giảm giá do Admin cấu hình, không hardcode
  const depositPercent = businessParams.depositPercent;
  const [discountPercent, setDiscountPercent] = useState<number>(parentContract ? businessParams.renewalDiscountPercent : 0);

  const [specialTerms, setSpecialTerms] = useState<string>(
    'Hợp đồng bao gồm dịch vụ kết nối mạng LoRa, bảo trì định kỳ trạm cảm biến và hỗ trợ kỹ thuật 24/7.'
  );
  const [notes, setNotes] = useState<string>('Áp dụng chính sách ưu đãi khách hàng ký hợp đồng mới.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Discount Codes (Mã giảm giá do Admin tạo, Technician sử dụng)
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number; amount: number; description: string } | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [autoApplying, setAutoApplying] = useState<boolean>(false);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      discountService.getAll(true)
        .then(list => setAvailableDiscounts(Array.isArray(list) ? list : []))
        .catch(() => {});

      setLoadingPackages(true);
      contractPackageService.getAll(true, false)
        .then(list => {
          const pkgs = Array.isArray(list) ? list : [];
          setAvailablePackages(pkgs);
          if (pkgs.length > 0) {
            setSelectedPackageId(prev => prev || pkgs[0].id);
          }
        })
        .catch(err => console.error('Error loading contract packages:', err))
        .finally(() => setLoadingPackages(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setContractNumber(`HD-ZN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`);
      if (zone?.currentCrop) setCropType(zone.currentCrop);
      setCustomPackageName(`Gói Canh Tác ${zone?.name || 'Zone'} - VIP`);
      setCustomPackageDesc(`Gói dịch vụ tùy chỉnh riêng cho khách hàng, bao gồm thiết bị IoT và bảo trì`);
      setCustomPackagePrice(9500000);
      if (recentTwoMonthsContract) {
        setSelectedParentId(parentContract?.id || recentTwoMonthsContract.id);
        setLesseeName(parentContract?.lesseeName || recentTwoMonthsContract.lesseeName || lesseeName);
        setLesseePhone(parentContract?.lesseePhone || recentTwoMonthsContract.lesseePhone || lesseePhone);
        setDiscountPercent(businessParams.repeatPurchaseDiscountPercent); // giảm giá mua lần 2 trong 2 tháng (cấu hình)
        setNotes(`Áp dụng ưu đãi Giảm giá ${businessParams.repeatPurchaseDiscountPercent}% cho khách hàng mua/ký hợp đồng lần thứ 2 trong vòng 2 tháng (HĐ trước: #${recentTwoMonthsContract.contractNumber}).`);
      } else if (parentContract) {
        setSelectedParentId(parentContract.id);
        setLesseeName(parentContract.lesseeName || lesseeName);
        setLesseePhone(parentContract.lesseePhone || lesseePhone);
        setDiscountPercent(businessParams.renewalDiscountPercent);
      }
    }
  }, [isOpen, parentContract, zone, recentTwoMonthsContract, businessParams.repeatPurchaseDiscountPercent, businessParams.renewalDiscountPercent]);

  // Selected package details
  const selectedStandardPackage = availablePackages.find(p => p.id === selectedPackageId);
  const currentPackagePrice = applyPackage
    ? (packageMode === 'standard' ? (selectedStandardPackage?.price || 0) : customPackagePrice)
    : 0;
  const currentPackageName = applyPackage
    ? (packageMode === 'standard' ? (selectedStandardPackage?.packageName || 'Gói chuẩn') : (customPackageName || 'Gói tùy chỉnh riêng'))
    : null;

  // Compute End Date
  const calculateEndDate = (): string => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + durationMonths);
    return d.toISOString().split('T')[0];
  };

  const endDate = calculateEndDate();

  // Automatic financial calculations (strictly linked!)
  const zoneRentTotal = monthlyRent * durationMonths; // Tiền thuê phân khu = Đơn giá × Số tháng
  const subtotal = zoneRentTotal + currentPackagePrice; // Thành tiền trước thuế = Tiền thuê Zone + Tiền gói dịch vụ
  const vatAmount = Math.round(subtotal * (vatPercent / 100)); // VAT = Thành tiền × Tỷ lệ VAT
  const totalWithVat = subtotal + vatAmount; // Tổng tiền = Thành tiền + VAT
  const discountAmount = Math.round(totalWithVat * (discountPercent / 100)); // Chiết khấu
  const finalTotalAmount = Math.max(0, totalWithVat - discountAmount); // Số tiền sau chiết khấu (Tổng thanh toán)
  const depositAmount = Math.round(finalTotalAmount * (depositPercent / 100)); // Tạm ứng theo tỷ lệ cấu hình
  const remainingAmount = finalTotalAmount - depositAmount; // Phần còn lại

  const isReturningCustomer = Boolean(selectedParentId);

  // Technician: Tự động add mã giảm giá phù hợp với giá hợp đồng
  const handleAutoAddBestDiscount = async () => {
    setAutoApplying(true);
    setDiscountMsg(null);
    try {
      const res = await discountService.getBestDiscount(totalWithVat);
      if (res && res.hasDiscount) {
        setAppliedDiscount({
          code: res.code,
          percent: res.discountPercent,
          amount: res.discountAmount,
          description: res.description,
        });
        setDiscountPercent(res.discountPercent);
        setDiscountMsg(res.note || `Đã tự động áp dụng mã [${res.code}]: Giảm ${res.discountAmount.toLocaleString('vi-VN')} đ!`);
      } else {
        setDiscountMsg('ℹ️ Giá trị hợp đồng hiện tại chưa đủ điều kiện áp dụng mã giảm giá nào.');
      }
    } catch (err: any) {
      console.error(err);
      setDiscountMsg('Không thể kiểm tra mã giảm giá tự động.');
    } finally {
      setAutoApplying(false);
    }
  };

  const handleApplyManualCode = async (codeToApply: string) => {
    const trimmed = codeToApply.trim().toUpperCase();
    if (!trimmed) return;
    try {
      const res = await discountService.validateCode(trimmed, totalWithVat);
      if (res && res.isValid) {
        setAppliedDiscount({
          code: res.code,
          percent: res.discountPercent,
          amount: res.discountAmount,
          description: res.message || '',
        });
        setDiscountPercent(res.discountPercent);
        setDiscountMsg(`✅ ${res.message}`);
        setManualCodeInput('');
      } else {
        alert(res?.message || 'Mã giảm giá không hợp lệ hoặc chưa đủ điều kiện hợp đồng.');
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi kiểm tra mã giảm giá.');
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountPercent(0);
    setManualCodeInput('');
    setDiscountMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) {
      alert('Vui lòng chọn Zone để lập hợp đồng!');
      return;
    }
    const zoneId = zone.zoneId || (zone as any).id;
    const farmId = farm?.farmId || (farm as any)?.id || zone.farmId;

    setIsSubmitting(true);
    try {
      const created = await zoneContractService.createContract(zoneId, {
        farmId,
        parentContractId: selectedParentId || undefined,
        contractNumber: contractNumber.trim(),
        cropType,
        monthlyRentVnd: monthlyRent,
        depositVnd: 0, // 0 → server tính theo tỷ lệ cọc đang cấu hình
        totalContractValueVnd: finalTotalAmount,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        startDate,
        endDate,
        lesseeName: lesseeName.trim(),
        lesseePhone: lesseePhone.trim(),
        lesseeIdentityNumber: lesseeIdentityNumber.trim(),
        lesseeAddress: lesseeAddress.trim(),
        specialTerms,
        notes: (isReturningCustomer ? `Hợp đồng mới tái ký từ HĐ cũ. Chiết khấu khách hàng cũ: ${discountPercent}%. ` : '') + (appliedDiscount ? `[Ưu đãi Admin: Áp dụng mã ${appliedDiscount.code} (-${appliedDiscount.amount.toLocaleString()} đ)]. ` : '') + notes,
        contractPackageId: applyPackage && packageMode === 'standard' && selectedPackageId ? selectedPackageId : undefined,
        customPackage: applyPackage && packageMode === 'custom' && customPackageName.trim() ? {
          packageName: customPackageName.trim(),
          description: customPackageDesc.trim() || undefined,
          durationMonths,
          maxZones: 1,
          price: currentPackagePrice,
          currency: 'VND'
        } : undefined
      });

      alert(`🎉 Đã tạo Hợp đồng mới #${created.contractNumber} thành công cho Zone "${zone.name}"!`);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi tạo hợp đồng:', err);
      alert(`⚠️ Không thể tạo hợp đồng: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📝 Lập Hợp Đồng Mới Cho Phân Khu (Zone Contract)"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {/* Header notice */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-700 via-[#119653] to-emerald-600 text-white rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-1.5">
              <FileText size={16} /> Thiết lập Hợp đồng sử dụng Phân khu & Dịch vụ IoT
            </span>
            <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono text-[10px] border border-white/30">
              {contractNumber || 'HD-NEW'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-100">
            Trang trại: <strong>{farm?.name || 'Trang trại'}</strong> ➔ Zone: <strong>{zone?.name || 'Zone'}</strong> ({zone?.areaM2 || 0} m²)
          </p>
        </div>

        {/* Banner for 2nd purchase within 2 months */}
        {isSecondPurchaseInTwoMonths && (
          <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400 rounded-xl space-y-1.5 text-amber-950 shadow-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                <Sparkles size={16} className="text-amber-600 animate-pulse" />
                <span>🎉 ƯU ĐÃI ĐẶC QUYỀN: GIẢM GIÁ MUA LẦN 2 TRONG VÒNG 2 THÁNG</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-xs shadow-2xs">
                GIẢM NGAY {businessParams.repeatPurchaseDiscountPercent}%
              </span>
            </div>
            <p className="text-[11px] text-amber-900 leading-snug">
              Hệ thống nhận diện bạn đã có hợp đồng <strong>#{recentTwoMonthsContract?.contractNumber}</strong> ký vào ngày <strong>{recentTwoMonthsContract?.startDate || recentTwoMonthsContract?.createdAtUtc?.split('T')[0]}</strong> (trong vòng 60 ngày qua). 
              Hệ thống tự động áp dụng chính sách chiết khấu <strong>{businessParams.repeatPurchaseDiscountPercent}%</strong> cho lần mua thứ 2 này!
            </p>
          </div>
        )}

        {/* 1. Returning Customer Link & Discount Option */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isReturningCustomer
            ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isReturningCustomer ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                <Link size={15} />
              </div>
              <div>
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  Phân loại: {isReturningCustomer ? 'Khách Hàng Tái Ký (Hợp Đồng Mới Cũ)' : 'Hợp Đồng Lần Đầu (Khách Mới)'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hợp đồng mới cho phép thay đổi cấu hình thiết bị/quy mô, đồng thời lưu liên kết HĐ trước và áp dụng chiết khấu tái ký.
                </p>
              </div>
            </div>

            {existingContracts.length > 0 && (
              <select
                className="bg-white border border-slate-300 text-xs px-2.5 py-1.5 rounded-lg font-medium cursor-pointer"
                value={selectedParentId}
                onChange={e => {
                  const pid = e.target.value;
                  setSelectedParentId(pid);
                  if (pid) {
                    const parent = existingContracts.find(c => c.id === pid);
                    if (parent) {
                      setLesseeName(parent.lesseeName || lesseeName);
                      setLesseePhone(parent.lesseePhone || lesseePhone);
                      setDiscountPercent(10);
                    }
                  } else {
                    setDiscountPercent(0);
                  }
                }}
              >
                <option value="">-- Hợp đồng độc lập (Không liên kết) --</option>
                {existingContracts.map(c => (
                  <option key={c.id} value={c.id}>
                    Liên kết với HĐ cũ: #{c.contractNumber} ({c.cropType || 'Rau màu'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {isReturningCustomer && (
            <div className="mt-2.5 pt-2 border-t border-indigo-200 flex items-center justify-between text-indigo-900 text-xs">
              <span className="flex items-center gap-1">
                <Sparkles size={13} className="text-indigo-600" />
                Được áp dụng chính sách <strong>Chiết khấu Tái ký Khách hàng cũ</strong>:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold">Mức chiết khấu:</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                  className="w-16 p-1 bg-white border border-indigo-300 rounded text-center font-bold text-indigo-700"
                />
                <span className="font-bold">%</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Lessee & Crop Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5">
            <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <User size={14} className="text-emerald-600" /> Thông tin Bên thuê (Lessee)
            </h5>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tên khách hàng / Hộ kinh doanh *</label>
              <Input value={lesseeName} onChange={e => setLesseeName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số điện thoại *</label>
                <Input value={lesseePhone} onChange={e => setLesseePhone(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số CCCD / MST</label>
                <Input value={lesseeIdentityNumber} onChange={e => setLesseeIdentityNumber(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Địa chỉ liên hệ</label>
              <Input value={lesseeAddress} onChange={e => setLesseeAddress(e.target.value)} />
            </div>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5">
            <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <Tag size={14} className="text-emerald-600" /> Cây trồng & Thời hạn hợp đồng
            </h5>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cây trồng quy hoạch tại Zone *</label>
              <Input value={cropType} onChange={e => setCropType(e.target.value)} placeholder="VD: Cà chua Cherry Đà Lạt" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày bắt đầu *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Thời hạn (tháng) *</label>
                <select
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
                  value={durationMonths}
                  onChange={e => setDurationMonths(Number(e.target.value))}
                >
                  <option value={6}>6 Tháng</option>
                  <option value={12}>12 Tháng (1 Năm)</option>
                  <option value={24}>24 Tháng (2 Năm)</option>
                  <option value={36}>36 Tháng (3 Năm)</option>
                  <option value={60}>60 Tháng (5 Năm)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày kết thúc tính toán:</label>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800">
                {endDate} ({durationMonths} tháng)
              </div>
            </div>
          </div>
        </div>

        {/* 2.5 Package Configuration (Gói Dịch Vụ Canh Tác Đi Kèm) */}
        <div className={`p-4 rounded-xl border transition-all ${
          applyPackage
            ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white border-emerald-300 shadow-2xs'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyPackage}
                onChange={e => setApplyPackage(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-[#119653] rounded border-slate-300 focus:ring-[#119653] cursor-pointer"
              />
              <div>
                <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <PackageCheck size={16} className="text-[#119653]" />
                  Đăng Ký Kèm Gói Dịch Vụ Canh Tác (Contract Package)
                </h5>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tích chọn để thêm gói dịch vụ IoT, giám sát và bảo trì vào hợp đồng. Tiền gói sẽ được cộng trực tiếp vào tổng tiền hợp đồng.
                </p>
              </div>
            </label>

            {applyPackage && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px] self-start sm:self-auto shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPackageMode('standard')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    packageMode === 'standard'
                      ? 'bg-[#119653] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PackageCheck size={12} className="inline mr-1" />
                  Gói Chuẩn Hệ Thống
                </button>
                <button
                  type="button"
                  onClick={() => setPackageMode('custom')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    packageMode === 'custom'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles size={12} className="inline mr-1" />
                  Gói Riêng Khách Hàng
                </button>
              </div>
            )}
          </div>

          {applyPackage ? (
            <div className="pt-3 space-y-3">
              {packageMode === 'standard' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-semibold">Chọn 1 gói dịch vụ tiêu chuẩn áp dụng cho phân khu này:</span>
                    {loadingPackages && <span className="text-emerald-700">Đang tải danh mục gói...</span>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {availablePackages.map(pkg => {
                      const isSelected = selectedPackageId === pkg.id;
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            setSelectedPackageId(pkg.id);
                            if (pkg.durationMonths > 0) setDurationMonths(pkg.durationMonths);
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:border-emerald-300 hover:bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-slate-900 text-[11px] truncate">{pkg.packageName}</span>
                              <input
                                type="radio"
                                name="standardPackage"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedPackageId(pkg.id);
                                  if (pkg.durationMonths > 0) setDurationMonths(pkg.durationMonths);
                                }}
                                className="w-3.5 h-3.5 text-[#119653] focus:ring-[#119653]"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                              {pkg.description || 'Gói dịch vụ canh tác công nghệ cao'}
                            </p>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">{pkg.durationMonths} tháng</span>
                            <span className="font-bold text-emerald-700 font-mono">+{pkg.price.toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 bg-white/90 p-3 rounded-lg border border-purple-200">
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-[11px] flex items-start gap-2">
                    <Sparkles size={15} className="text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Gói dịch vụ riêng biệt:</strong> Gói này được thiết kế độc quyền riêng cho khách hàng <strong>"{lesseeName || 'Bên thuê'}"</strong> của hợp đồng này và không chia sẻ cho các khách hàng khác.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tên gói riêng cho khách hàng *</label>
                      <Input
                        value={customPackageName}
                        onChange={e => setCustomPackageName(e.target.value)}
                        placeholder="VD: Gói VIP Canh Tác Nhà Màng - LangBiang"
                        required={applyPackage && packageMode === 'custom'}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Giá gói riêng (đ) *</label>
                      <Input
                        type="number"
                        min={0}
                        step={100000}
                        value={customPackagePrice}
                        onChange={e => setCustomPackagePrice(Number(e.target.value))}
                        required={applyPackage && packageMode === 'custom'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mô tả đặc quyền của gói riêng</label>
                    <Input
                      value={customPackageDesc}
                      onChange={e => setCustomPackageDesc(e.target.value)}
                      placeholder="VD: Bao gồm Gateway LoRa, 2 Node cảm biến và KTV bảo trì định kỳ trọn vụ..."
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2 text-[11px] text-slate-500 italic flex items-center gap-1.5">
              <span>Hợp đồng không đăng ký gói dịch vụ đi kèm. Đơn giá hợp đồng chỉ tính theo tiền thuê phân khu hàng tháng bên dưới.</span>
            </div>
          )}
        </div>

        {/* 3. Automatic Calculation Financial Table (Requirement 6) */}
        <div className="p-4 bg-white border-2 border-[#119653]/30 rounded-xl space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <DollarSign size={15} className="text-[#119653]" />
              Bảng Tự Động Tính Tiền Hợp Đồng (Strict Formula Breakdown)
            </h5>
            <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Công thức tự động liên kết 100%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn giá thuê hàng tháng (đ/tháng):</label>
              <Input
                type="number"
                value={monthlyRent}
                onChange={e => setMonthlyRent(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tỷ lệ thuế VAT (%):</label>
              <select
                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                value={vatPercent}
                onChange={e => setVatPercent(Number(e.target.value))}
              >
                <option value={0}>0% (Không áp dụng VAT)</option>
                <option value={8}>8% (Quy chuẩn SaaS / Thiết bị)</option>
                <option value={10}>10% (VAT phổ thông)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Chiết khấu ưu đãi (%):</label>
              <Input
                type="number"
                min="0"
                max="50"
                value={discountPercent}
                onChange={e => {
                  setDiscountPercent(Number(e.target.value));
                  if (appliedDiscount && Number(e.target.value) !== appliedDiscount.percent) {
                    setAppliedDiscount(null);
                  }
                }}
              />
            </div>
          </div>

          {/* Technician Discount Code Selection & Auto-Add Feature */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Tag size={14} className="text-[#119653]" />
                <span>Mã Giảm Giá Khuyến Mãi (Admin cấp phát cho Kỹ thuật viên)</span>
              </div>
              <button
                type="button"
                onClick={handleAutoAddBestDiscount}
                disabled={autoApplying}
                className="px-3 py-1 rounded-lg bg-[#119653] hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-transform transform active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Sparkles size={12} className="text-amber-300" />
                <span>{autoApplying ? 'Đang phân tích...' : '⚡ Tự động add mã phù hợp giá HĐ'}</span>
              </button>
            </div>

            {/* Quick dropdown or manual input */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-7">
                <select
                  value={appliedDiscount?.code || ''}
                  onChange={e => {
                    if (e.target.value) handleApplyManualCode(e.target.value);
                    else handleRemoveDiscount();
                  }}
                  className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="">-- Chọn mã ưu đãi có sẵn ({availableDiscounts.length} mã) --</option>
                  {availableDiscounts.map(d => {
                    const qualifies = totalWithVat >= d.minContractValue;
                    return (
                      <option key={d.id} value={d.code} disabled={!qualifies}>
                        [{d.code}] {d.description} {d.minContractValue > 0 ? `(HĐ từ ${d.minContractValue.toLocaleString()} đ)` : ''} {!qualifies ? '— Chưa đủ giá trị' : '— Đủ điều kiện ✓'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-5 flex items-center gap-1.5">
                <Input
                  value={manualCodeInput}
                  onChange={e => setManualCodeInput(e.target.value.toUpperCase())}
                  placeholder="Nhập mã khác..."
                  className="text-xs uppercase font-mono"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyManualCode(manualCodeInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleApplyManualCode(manualCodeInput)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-2.5 py-1.5 shrink-0"
                >
                  Áp dụng
                </Button>
              </div>
            </div>

            {/* Applied Badge or Notice */}
            {appliedDiscount ? (
              <div className="p-2 bg-white border border-emerald-300 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#119653] font-mono font-bold text-xs border border-emerald-300">
                    {appliedDiscount.code}
                  </span>
                  <span className="text-slate-700 font-medium">
                    {appliedDiscount.description} (Giảm <strong>{appliedDiscount.percent}%</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveDiscount}
                  className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] underline ml-2"
                >
                  Gỡ mã
                </button>
              </div>
            ) : discountMsg ? (
              <div className="text-[11px] text-emerald-800 font-medium">{discountMsg}</div>
            ) : null}
          </div>

          {/* Formula Line Items */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>• Tiền thuê phân khu = Đơn giá ({monthlyRent.toLocaleString('vi-VN')} đ) × Thời hạn ({durationMonths} tháng):</span>
              <strong className="font-mono text-slate-900">{zoneRentTotal.toLocaleString('vi-VN')} đ</strong>
            </div>
            {applyPackage && currentPackagePrice > 0 && (
              <div className="flex justify-between text-emerald-800 font-semibold bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200">
                <span className="flex items-center gap-1">
                  <PackageCheck size={13} className="text-[#119653]" />
                  • Phí Gói Dịch Vụ Canh Tác ({currentPackageName}):
                </span>
                <span className="font-mono text-emerald-700 font-bold">+{currentPackagePrice.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-200">
              <span>• Thành tiền trước thuế = Tiền thuê Zone {applyPackage && currentPackagePrice > 0 ? '+ Tiền Gói Dịch Vụ' : ''}:</span>
              <span className="font-mono text-slate-900 font-bold">{subtotal.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>• Thuế VAT ({vatPercent}%) = Thành tiền × {vatPercent}%:</span>
              <strong className="font-mono text-slate-900">+{vatAmount.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-slate-200">
              <span>• Tổng tiền trước chiết khấu = Thành tiền + VAT:</span>
              <span className="font-mono">{totalWithVat.toLocaleString('vi-VN')} đ</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-indigo-700 font-semibold bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-200">
                <span className="flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" />
                  • Chiết khấu {isSecondPurchaseInTwoMonths ? 'Mua lần 2 trong 2 tháng' : 'khách hàng'} ({discountPercent}%) = Tổng tiền × {discountPercent}%:
                </span>
                <span className="font-mono text-purple-800 font-bold">-{discountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-emerald-950 text-sm bg-emerald-100/70 p-2 rounded-lg border border-emerald-300">
              <span>TỔNG THANH TOÁN (Số tiền sau chiết khấu):</span>
              <span className="font-mono text-base">{finalTotalAmount.toLocaleString('vi-VN')} VNĐ</span>
            </div>
            <div className="flex justify-between text-amber-900 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200">
              <span>• Tạm ứng {depositPercent}% khi ký hợp đồng (= Tổng thanh toán × {depositPercent}%):</span>
              <span className="font-mono text-sm">{depositAmount.toLocaleString('vi-VN')} VNĐ</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[11px] pt-1">
              <span>• Còn lại thanh toán theo kỳ hoặc nghiệm thu ({100 - depositPercent}%):</span>
              <span className="font-mono font-medium">{remainingAmount.toLocaleString('vi-VN')} VNĐ</span>
            </div>
          </div>
        </div>

        {/* Special Terms & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Điều khoản dịch vụ đặc biệt:</label>
            <Input value={specialTerms} onChange={e => setSpecialTerms(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ghi chú hợp đồng:</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button size="sm" variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold shadow-md">
            <CheckCircle2 size={14} className="mr-1.5" />
            {isSubmitting ? 'Đang lập hợp đồng...' : 'Xác Nhận Lưu Hợp Đồng'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
