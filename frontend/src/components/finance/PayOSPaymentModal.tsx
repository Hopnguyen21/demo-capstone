import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Button } from '../ui/BaseUI';
import { paymentService, extractApiError } from '../../services';
import { Bill } from '../../types';

interface PayOSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onPaymentSuccess: () => void;
}

export const PayOSPaymentModal: React.FC<PayOSPaymentModalProps> = ({
  isOpen,
  onClose,
  bill,
  onPaymentSuccess
}) => {
  const [payAmount, setPayAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [manualConfirming, setManualConfirming] = useState<boolean>(false);
  const [paymentData, setPaymentData] = useState<any | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 mins in seconds

  const pollIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Initialize amount whenever bill opens
  useEffect(() => {
    if (bill && isOpen) {
      setPayAmount(bill.remainingAmount > 0 ? bill.remainingAmount : bill.amount);
      setPaymentData(null);
      setIsSuccess(false);
      setErrorMessage(null);
      setTimeLeft(900);
    }
    return () => {
      clearInterval(pollIntervalRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [bill, isOpen]);

  // Start polling and countdown when paymentData is available
  useEffect(() => {
    if (!paymentData || isSuccess) {
      clearInterval(pollIntervalRef.current);
      clearInterval(countdownIntervalRef.current);
      return;
    }

    // Countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-poll status every 3.5 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await paymentService.checkPayOSStatus(paymentData.orderCode);
        if (res && res.isSuccess) {
          handleSuccess();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 3500);

    return () => {
      clearInterval(pollIntervalRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [paymentData, isSuccess]);

  const handleSuccess = () => {
    setIsSuccess(true);
    clearInterval(pollIntervalRef.current);
    clearInterval(countdownIntervalRef.current);
    setTimeout(() => {
      onPaymentSuccess();
    }, 2500);
  };

  if (!isOpen || !bill) return null;

  const handleCreatePaymentLink = async () => {
    if (payAmount <= 0) {
      setErrorMessage('Số tiền thanh toán phải lớn hơn 0 đ.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await paymentService.createBillPayment(bill.id, {
        amount: payAmount
      });
      setPaymentData(res);
      setTimeLeft(900);
    } catch (err: any) {
      setErrorMessage(extractApiError(err) || 'Không thể khởi tạo thanh toán PayOS. Vui lòng kiểm tra lại cấu hình.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!paymentData?.orderCode) return;
    setChecking(true);
    try {
      const res = await paymentService.checkPayOSStatus(paymentData.orderCode);
      if (res && res.isSuccess) {
        handleSuccess();
      } else {
        setErrorMessage('Giao dịch chưa hoàn tất hoặc tiền chưa về tài khoản. Vui lòng đợi trong giây lát và kiểm tra lại.');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(extractApiError(err) || 'Lỗi kiểm tra trạng thái giao dịch.');
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmManual = async () => {
    if (!paymentData?.orderCode) return;
    setManualConfirming(true);
    try {
      const res = await paymentService.confirmManualPayOS(paymentData.orderCode);
      if (res && res.isSuccess) {
        handleSuccess();
      }
    } catch (err: any) {
      setErrorMessage(extractApiError(err) || 'Lỗi xác nhận thanh toán thủ công.');
    } finally {
      setManualConfirming(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate VietQR Image URL
  const vietQrImageUrl = paymentData?.qrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.qrCode)}`
    : paymentData
      ? `https://img.vietqr.io/image/${paymentData.bankBin || '970422'}-${paymentData.bankAccountNumber}-compact2.png?amount=${paymentData.amount}&addInfo=${encodeURIComponent(paymentData.description)}&accountName=${encodeURIComponent(paymentData.bankAccountName || '')}`
      : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <CreditCard size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Thanh toán PayOS (VietQR)
                <span className="text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-full">Tự động 24/7</span>
              </h2>
              <p className="text-xs text-emerald-100">Hóa đơn #{bill.billCode} · Khách hàng: {bill.lesseeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Thanh toán thành công qua PayOS!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Đã ghi nhận số tiền <span className="font-bold text-emerald-700">{paymentData?.amount?.toLocaleString('vi-VN')} đ</span> vào Hóa đơn #{bill.billCode}.
                </p>
                <p className="text-xs text-slate-500 mt-2">Hệ thống đang tự động cập nhật dữ liệu...</p>
              </div>
            </div>
          ) : !paymentData ? (
            /* Step 1: Confirm Amount & Generate Payment Link */
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Tổng tiền hóa đơn:</span>
                  <span className="font-bold text-slate-900 text-sm">{bill.amount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Đã thanh toán:</span>
                  <span className="font-semibold text-emerald-700">{bill.paidAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 pt-2 border-t border-slate-200">
                  <span className="font-semibold">Còn lại cần thanh toán:</span>
                  <span className="font-black text-amber-700 text-base">{bill.remainingAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số tiền thanh toán qua PayOS (VNĐ):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1000}
                    max={bill.remainingAmount}
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VNĐ</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                  <span>Tối thiểu 1,000 đ</span>
                  {payAmount !== bill.remainingAmount && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(bill.remainingAmount)}
                      className="text-emerald-700 font-medium hover:underline"
                    >
                      Thanh toán hết còn lại ({bill.remainingAmount.toLocaleString('vi-VN')} đ)
                    </button>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <div className="pt-2 border-t border-rose-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-rose-600 font-medium">Bạn đã chuyển tiền qua ngân hàng rồi?</span>
                    <button
                      type="button"
                      onClick={handleConfirmManual}
                      disabled={manualConfirming}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-colors"
                    >
                      {manualConfirming ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      {manualConfirming ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất thanh toán ngay'}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-700" /> Thanh toán quét mã VietQR tự động:
                </p>
                <p className="text-[11px] text-emerald-700">
                  Khi tạo link, hệ thống tạo mã VietQR theo chuẩn Napas247. Bạn có thể mở bất kỳ ứng dụng ngân hàng nào (Vietcombank, MBBank, Techcombank, VPBank, MoMo...) để quét mã và chuyển tiền.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Hủy
                </Button>
                <Button onClick={handleCreatePaymentLink} disabled={loading || payAmount <= 0}>
                  {loading ? <RefreshCw size={15} className="animate-spin mr-1.5" /> : <QrCode size={16} className="mr-1.5" />}
                  {loading ? 'Đang tạo mã VietQR...' : 'Tạo mã QR thanh toán'}
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2: QR Code & Bank Transfer Details */
            <div className="space-y-4">
              {/* Timer & Status */}
              <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span>Đang chờ bạn chuyển khoản...</span>
                </div>
                <div className="flex items-center gap-1 font-mono font-bold text-amber-800">
                  <Clock size={14} />
                  <span>{formatSeconds(timeLeft)}</span>
                </div>
              </div>

              {/* VietQR Display & Bank Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* QR Image */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {vietQrImageUrl ? (
                    <img
                      src={vietQrImageUrl}
                      alt="VietQR Code"
                      className="w-48 h-48 object-contain rounded-xl shadow-xs border border-slate-100 bg-white p-1"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-xl text-slate-400">
                      <QrCode size={48} />
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-slate-600 mt-2 text-center">
                    Mở app Ngân hàng để Quét QR
                  </p>
                  <p className="text-[10px] text-slate-400 text-center">Tự động điền số tiền & nội dung</p>
                </div>

                {/* Transfer Details with One-click Copy */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Ngân hàng thụ hưởng</span>
                    <p className="font-bold text-slate-900">{paymentData.bankName || 'Ngân hàng Quân Đội (MBBank)'}</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Số tài khoản</span>
                      <p className="font-mono font-black text-slate-900 text-sm">{paymentData.bankAccountNumber}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentData.bankAccountNumber, 'acc')}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'acc' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chủ tài khoản</span>
                      <p className="font-bold text-slate-900">{paymentData.bankAccountName || 'SMARTFARM'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentData.bankAccountName || '', 'name')}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Sao chép tên chủ tài khoản"
                    >
                      {copiedField === 'name' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Số tiền</span>
                      <p className="font-mono font-black text-emerald-800 text-sm">
                        {paymentData.amount?.toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentData.amount.toString(), 'amount')}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                      title="Sao chép số tiền"
                    >
                      {copiedField === 'amount' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Nội dung chuyển khoản (bắt buộc)</span>
                      <p className="font-mono font-black text-slate-900 text-sm">{paymentData.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentData.description, 'desc')}
                      className="p-1.5 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
                      title="Sao chép nội dung"
                    >
                      {copiedField === 'desc' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <div className="pt-2 border-t border-rose-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-rose-600 font-medium">Bạn đã chuyển tiền qua ngân hàng rồi?</span>
                    <button
                      type="button"
                      onClick={handleConfirmManual}
                      disabled={manualConfirming}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] inline-flex items-center justify-center gap-1 shadow-xs transition-colors"
                    >
                      {manualConfirming ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      {manualConfirming ? 'Đang hoàn tất...' : 'Xác nhận hoàn tất thanh toán ngay'}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {paymentData.checkoutUrl && (
                  <a
                    href={paymentData.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    <span>Mở trang thanh toán PayOS</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Đóng
                  </Button>
                  <Button size="sm" onClick={handleManualCheck} disabled={checking}>
                    {checking ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <RefreshCw size={13} className="mr-1.5" />}
                    {checking ? 'Đang kiểm tra...' : 'Tôi đã chuyển tiền'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
