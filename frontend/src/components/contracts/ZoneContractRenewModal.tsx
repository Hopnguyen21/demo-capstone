import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { ZoneContract } from '../../types';
import { zoneContractService } from '../../services';
import {
  RefreshCw, Calendar, DollarSign, Percent, ShieldCheck, CheckCircle2,
  Clock, ArrowRight, Sparkles, Tag, AlertCircle
} from 'lucide-react';

interface ZoneContractRenewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ZoneContract | null;
  onSuccess: (updatedContract: ZoneContract) => void;
}

export const ZoneContractRenewModal: React.FC<ZoneContractRenewModalProps> = ({
  isOpen,
  onClose,
  contract,
  onSuccess,
}) => {
  if (!contract) return null;

  // Check if contract was created or signed within the last 2 months (60 days)
  const isSecondPurchaseInTwoMonths = React.useMemo(() => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const dateStr = contract.createdAtUtc || contract.signedAtUtc || contract.startDate;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d >= twoMonthsAgo;
  }, [contract]);

  // Preset: "6_MONTHS" | "1_YEAR" | "3_YEARS" | "CUSTOM"
  const [durationPreset, setDurationPreset] = useState<'6_MONTHS' | '1_YEAR' | '3_YEARS' | 'CUSTOM'>('1_YEAR');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Price Mode: KEEP_PRICE | NEW_PRICE
  const [priceMode, setPriceMode] = useState<'KEEP' | 'NEW'>('KEEP');
  const [newMonthlyRent, setNewMonthlyRent] = useState<string>(String(contract.monthlyRentVnd || 12000000));

  // Discount for old customer - automatically 15% if 2nd purchase within 2 months!
  const [discountPercent, setDiscountPercent] = useState<number>(isSecondPurchaseInTwoMonths ? 15 : 10);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountAmount, setDiscountAmount] = useState<string>('0');

  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'FORM' | 'CONFIRM'>('FORM');

  // Compute New End Date
  const currentEndDate = contract.endDate ? new Date(contract.endDate) : new Date();

  const calculateNewEndDate = (): string => {
    if (durationPreset === 'CUSTOM' && customEndDate) return customEndDate;
    const d = new Date(currentEndDate);
    if (durationPreset === '6_MONTHS') d.setMonth(d.getMonth() + 6);
    else if (durationPreset === '1_YEAR') d.setFullYear(d.getFullYear() + 1);
    else if (durationPreset === '3_YEARS') d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().split('T')[0];
  };

  const computedNewEndDate = calculateNewEndDate();

  // Compute Months Added
  const computeMonthsAdded = (): number => {
    if (durationPreset === '6_MONTHS') return 6;
    if (durationPreset === '1_YEAR') return 12;
    if (durationPreset === '3_YEARS') return 36;
    if (customEndDate) {
      const d1 = new Date(currentEndDate);
      const d2 = new Date(customEndDate);
      const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      return Math.max(1, diffMonths);
    }
    return 12;
  };

  const monthsAdded = computeMonthsAdded();

  // Financial calculations
  const rentPerMonth = priceMode === 'KEEP'
    ? Number(contract.monthlyRentVnd || 0)
    : Number(newMonthlyRent || 0);

  const rawRenewalTotal = rentPerMonth * monthsAdded;
  const calculatedDiscount = discountType === 'PERCENT'
    ? Math.round(rawRenewalTotal * (discountPercent / 100))
    : Number(discountAmount || 0);

  const finalRenewalTotal = Math.max(0, rawRenewalTotal - calculatedDiscount);
  const deposit30 = Math.round(finalRenewalTotal * 0.3);

  const handleConfirmRenew = async () => {
    setIsSubmitting(true);
    try {
      const updated = await zoneContractService.renewContract(contract.id, {
        durationPreset,
        customEndDate: durationPreset === 'CUSTOM' ? customEndDate : undefined,
        newMonthlyRentVnd: priceMode === 'NEW' ? Number(newMonthlyRent) : undefined,
        discountPercent: discountType === 'PERCENT' ? discountPercent : undefined,
        discountAmount: discountType === 'AMOUNT' ? Number(discountAmount) : calculatedDiscount,
        notes: notes || `Gia hạn ${durationPreset === '6_MONTHS' ? '6 tháng' : durationPreset === '1_YEAR' ? '1 năm' : durationPreset === '3_YEARS' ? '3 năm' : `${monthsAdded} tháng`} (đến ${computedNewEndDate}). ${isSecondPurchaseInTwoMonths ? 'Ưu đãi mua lần 2 trong 2 tháng (-15%): ' : 'Chiết khấu tri ân khách hàng cũ: '}${calculatedDiscount.toLocaleString('vi-VN')}đ.`,
      });
      alert(`🎉 Gia hạn Hợp đồng #${contract.contractNumber} thành công! Thời hạn mới đến ngày ${computedNewEndDate}.`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi gia hạn hợp đồng:', err);
      alert(`⚠️ Không thể gia hạn: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🔄 Gia Hạn Hợp Đồng (Renew Contract) #${contract.contractNumber}`}
      size="lg"
    >
      <div className="space-y-5 text-xs text-slate-700">
        {/* Info summary */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className="text-amber-700" />
              Gia hạn cho Zone: <strong>{contract.zoneName}</strong> ({contract.farmName})
            </span>
            <span className="font-mono text-xs">{contract.contractNumber}</span>
          </div>
          <div className="flex justify-between text-[11px] text-amber-900/80 pt-1">
            <span>Cây trồng: <strong>{contract.cropType || 'Rau màu'}</strong></span>
            <span>Hạn hợp đồng hiện tại: <strong className="font-mono">{contract.endDate}</strong></span>
          </div>
        </div>

        {/* Banner for 2nd purchase within 2 months */}
        {isSecondPurchaseInTwoMonths && (
          <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400 rounded-xl space-y-1 text-amber-950 shadow-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                <Sparkles size={16} className="text-amber-600 animate-pulse" />
                <span>🎉 ƯU ĐÃI ĐẶC QUYỀN: GIẢM GIÁ MUA / TÁI KÝ LẦN 2 TRONG 2 THÁNG</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-xs shadow-2xs">
                -15% CHIẾT KHẤU
              </span>
            </div>
            <p className="text-[11px] text-amber-900 leading-snug">
              Hợp đồng này được kích hoạt gần đây (trong vòng 60 ngày). Hệ thống tự động áp dụng chính sách <strong>giảm giá 15%</strong> cho lần mua / gia hạn thứ 2 này!
            </p>
          </div>
        )}

        {step === 'FORM' ? (
          <div className="space-y-4">
            {/* 1. Select Duration */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>1. Chọn Thời Hạn Gia Hạn Mới *</span>
                <span className="text-[11px] text-emerald-700 font-normal">Hạn mới: <strong>{computedNewEndDate}</strong> (+{monthsAdded} tháng)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '6_MONTHS', label: '6 Tháng', desc: '+6 tháng' },
                  { id: '1_YEAR', label: '1 Năm', desc: '+12 tháng (Khuyên dùng)' },
                  { id: '3_YEARS', label: '3 Năm', desc: '+36 tháng (Ưu đãi cao)' },
                  { id: 'CUSTOM', label: 'Tùy chỉnh', desc: 'Chọn ngày cụ thể' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDurationPreset(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      durationPreset === opt.id
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className={`text-[10px] ${durationPreset === opt.id ? 'text-amber-100' : 'text-slate-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>

              {durationPreset === 'CUSTOM' && (
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nhập ngày kết thúc mới (EndDate):</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* 2. Select Price Option */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                2. Chính Sách Giá Thuê Hàng Tháng (Monthly Price) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceMode('KEEP')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    priceMode === 'KEEP'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-bold text-xs">Giữ nguyên giá hiện tại</div>
                  <div className={`text-[11px] font-mono mt-0.5 ${priceMode === 'KEEP' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {Number(contract.monthlyRentVnd || 0).toLocaleString('vi-VN')} đ/tháng
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPriceMode('NEW')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    priceMode === 'NEW'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-bold text-xs">Nhập đơn giá mới</div>
                  <div className={`text-[11px] mt-0.5 ${priceMode === 'NEW' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    Áp dụng mức giá điều chỉnh
                  </div>
                </button>
              </div>

              {priceMode === 'NEW' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Đơn giá thuê hàng tháng mới (VNĐ/tháng):</label>
                  <Input
                    type="number"
                    value={newMonthlyRent}
                    onChange={e => setNewMonthlyRent(e.target.value)}
                    placeholder="VD: 15000000"
                  />
                </div>
              )}
            </div>

            {/* 3. Discount for Old/Returning Customer */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  3. Mức Chiết Khấu Dành Cho Khách Hàng Thân Thiết (Tái Ký)
                </label>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${discountType === 'PERCENT' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Tỷ lệ %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('AMOUNT')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${discountType === 'AMOUNT' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Số tiền đ
                  </button>
                </div>
              </div>

              {discountType === 'PERCENT' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {[0, 5, 10, 15, 20].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          discountPercent === pct
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {pct === 0 ? '0%' : `-${pct}%`}
                      </button>
                    ))}
                    <div className="flex-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(Number(e.target.value))}
                        placeholder="Tùy chọn %"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-800">
                    Mức giảm <strong>{discountPercent}%</strong> tương đương: <strong>-{calculatedDiscount.toLocaleString('vi-VN')} VNĐ</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    placeholder="Nhập số tiền chiết khấu (VNĐ)..."
                  />
                  <p className="text-[10px] text-indigo-800">
                    Số tiền giảm trực tiếp: <strong>-{Number(discountAmount || 0).toLocaleString('vi-VN')} VNĐ</strong>
                  </p>
                </div>
              )}
            </div>

            {/* 4. Live Automatic Calculation Box */}
            <div className="p-4 bg-white border-2 border-amber-300 rounded-xl space-y-2 text-xs shadow-xs">
              <h5 className="font-bold text-amber-950 flex items-center justify-between border-b border-amber-100 pb-1.5">
                <span>TỰ ĐỘNG TÍNH TIỀN GIA HẠN (REALTIME CALCULATION):</span>
                <span className="text-[10px] text-slate-400 font-mono">Đơn vị: VNĐ</span>
              </h5>
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Thời gian gia hạn:</span>
                  <span className="font-bold text-slate-800 font-mono">+{monthsAdded} tháng (đến {computedNewEndDate})</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Thành tiền (Đơn giá × {monthsAdded} tháng):</span>
                  <span className="font-mono">{rawRenewalTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-indigo-800 font-semibold">
                  <span>Chiết khấu khách hàng cũ ({discountType === 'PERCENT' ? `${discountPercent}%` : 'Cố định'}):</span>
                  <span className="font-mono">-{calculatedDiscount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                  <span>TỔNG GIÁ TRỊ GIA HẠN SAU CHIẾT KHẤU:</span>
                  <span className="font-mono text-emerald-700 text-base">{finalRenewalTotal.toLocaleString('vi-VN')} VNĐ</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                  <span>Tạm ứng gia hạn dự kiến (30%):</span>
                  <span className="font-mono font-medium">{deposit30.toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi chú gia hạn hợp đồng (Notes):</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Nhập ghi chú hoặc điều kiện thanh toán bổ sung..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button size="sm" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={() => setStep('CONFIRM')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Xem lại & Xác nhận gia hạn <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 2: REVIEW & CONFIRM */
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
              <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Xác Nhận Thông Tin Gia Hạn Hợp Đồng
              </h4>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Vui lòng kiểm tra lại thông tin thời hạn và biểu phí gia hạn trước khi lưu vào hệ thống:
              </p>

              <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã hợp đồng:</span>
                  <strong className="font-mono">{contract.contractNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phân khu (Zone):</span>
                  <strong>{contract.zoneName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách hàng bên thuê:</span>
                  <strong>{contract.lesseeName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời hạn hiện tại:</span>
                  <span className="font-mono">{contract.endDate}</span>
                </div>
                <div className="flex justify-between bg-amber-50 p-1.5 rounded font-bold text-amber-950">
                  <span>Thời hạn mới sau gia hạn:</span>
                  <span className="font-mono text-sm">{computedNewEndDate} (+{monthsAdded} tháng)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Đơn giá áp dụng:</span>
                  <span className="font-mono">{rentPerMonth.toLocaleString('vi-VN')} đ/tháng</span>
                </div>
                <div className="flex justify-between text-indigo-700">
                  <span>Chiết khấu tri ân khách hàng cũ:</span>
                  <span className="font-mono font-bold">-{calculatedDiscount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-base font-bold text-emerald-800 pt-1 border-t border-slate-200">
                  <span>Tổng tiền thanh toán gia hạn:</span>
                  <span className="font-mono">{finalRenewalTotal.toLocaleString('vi-VN')} VNĐ</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <Button size="sm" variant="outline" onClick={() => setStep('FORM')} disabled={isSubmitting}>
                ← Quay lại chỉnh sửa
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRenew}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {isSubmitting ? 'Đang lưu vào hệ thống...' : 'Xác nhận Lưu Gia Hạn'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
