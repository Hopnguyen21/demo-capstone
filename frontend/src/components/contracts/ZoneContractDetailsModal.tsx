import React from 'react';
import { Modal, Button } from '../ui/BaseUI';
import { ZoneContract } from '../../types';
import {
  FileText, Calendar, DollarSign, ShieldCheck, Clock, CheckCircle2,
  AlertTriangle, RefreshCw, User, Phone, MapPin, Tag, PlusCircle, History
} from 'lucide-react';

interface ZoneContractDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ZoneContract | null;
  onOpenRenewModal: (contract: ZoneContract) => void;
  onOpenNewContractModal: (parentContract: ZoneContract) => void;
}

export const ZoneContractDetailsModal: React.FC<ZoneContractDetailsModalProps> = ({
  isOpen,
  onClose,
  contract,
  onOpenRenewModal,
  onOpenNewContractModal,
}) => {
  if (!contract) return null;

  const isExpired = contract.daysRemaining < 0;
  const isExpiringSoon = !isExpired && contract.daysRemaining <= 30;
  const monthlyRent = Number(contract.monthlyRentVnd || 0);
  const totalValue = Number(contract.totalContractValueVnd || 0);
  const deposit = Number(contract.depositVnd || (totalValue * 0.3));
  const remaining = Math.max(0, totalValue - deposit);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📄 Chi Tiết Hợp Đồng #${contract.contractNumber}`}
      size="xl"
    >
      <div className="space-y-5 text-xs text-slate-700">
        {/* Status Header Banner */}
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isExpired
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : isExpiringSoon
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              isExpired
                ? 'bg-rose-600 text-white'
                : isExpiringSoon
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-emerald-600 text-white'
            }`}>
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 font-mono">{contract.contractNumber}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isExpired
                    ? 'bg-rose-200 text-rose-900'
                    : isExpiringSoon
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {contract.statusText || (isExpired ? 'Đã hết hạn' : isExpiringSoon ? 'Sắp hết hạn' : 'Còn hiệu lực')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isExpired
                  ? 'Hợp đồng này đã hết hạn hiệu lực. Cần tiến hành gia hạn hoặc thanh lý/tái ký mới.'
                  : isExpiringSoon
                  ? `Hợp đồng sắp hết hạn trong ${contract.daysRemaining} ngày tới. Khuyến nghị gia hạn ngay!`
                  : `Hợp đồng đang có hiệu lực sử dụng còn ${contract.daysRemaining} ngày.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onOpenRenewModal(contract);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
            >
              <RefreshCw size={13} className="mr-1.5" /> Gia hạn Hợp đồng (Renew)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenNewContractModal(contract);
              }}
              className="text-[#119653] border-emerald-300 hover:bg-emerald-50 font-bold text-xs"
            >
              <PlusCircle size={13} className="mr-1.5" /> Tái ký HĐ Mới
            </Button>
          </div>
        </div>

        {/* General & Lessee Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <Tag size={14} className="text-emerald-600" /> Thông tin Vị trí & Cây trồng
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Trang trại (Farm):</span>
                <strong className="text-slate-800">{contract.farmName || 'Trang trại'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phân khu (Zone):</span>
                <strong className="text-slate-800">{contract.zoneName || 'Zone'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cây trồng áp dụng:</span>
                <strong className="text-[#119653] font-bold">{contract.cropType || 'Rau màu'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày bắt đầu:</span>
                <span className="font-mono text-slate-800 font-medium">{contract.startDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày kết thúc:</span>
                <span className="font-mono text-slate-800 font-bold">{contract.endDate}</span>
              </div>
              {contract.parentContractNumber && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Tái ký từ HĐ trước:</span>
                  <span className="font-mono text-indigo-700 font-bold">{contract.parentContractNumber}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <User size={14} className="text-emerald-600" /> Thông tin Khách hàng / Bên thuê
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Đại diện bên thuê:</span>
                <strong className="text-slate-800">{contract.lesseeName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-mono text-slate-800">{contract.lesseePhone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số CCCD / MST:</span>
                <span className="font-mono text-slate-800">{contract.lesseeIdentityNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Địa chỉ liên hệ:</span>
                <span className="text-slate-800 text-right max-w-[200px] truncate">{contract.lesseeAddress || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày ký kết:</span>
                <span className="font-mono text-slate-800">{contract.signedAtUtc ? new Date(contract.signedAtUtc).toLocaleDateString('vi-VN') : contract.startDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Automatic Financial Formula Table */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <DollarSign size={15} className="text-[#119653]" />
              Bảng Tính Tiền & Thanh Toán Tự Động (Theo công thức chuẩn)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Đơn vị: VNĐ</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>1. Đơn giá thuê tháng (Đơn giá):</span>
              <span className="font-mono font-medium">{monthlyRent.toLocaleString('vi-VN')} đ/tháng</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>2. Tổng giá trị hợp đồng (Thành tiền = Đơn giá × Thời gian):</span>
              <strong className="font-mono text-slate-900">{totalValue.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>3. Tỷ lệ thuế VAT quy định (8%):</span>
              <span className="font-mono text-slate-600">Đã bao gồm trong tổng gói</span>
            </div>
            <div className="flex justify-between text-amber-900 font-bold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <span>4. Tạm ứng bắt buộc khi ký (Tạm ứng 30% = Tổng tiền × 30%):</span>
              <span className="font-mono text-sm">{deposit.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-slate-700 font-semibold p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span>5. Còn lại thanh toán theo kỳ / nghiệm thu (70%):</span>
              <span className="font-mono text-sm">{remaining.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>
        </div>

        {/* Special Terms & Notes */}
        {(contract.specialTerms || contract.notes) && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <h5 className="font-bold text-slate-800 text-[11px]">Điều khoản đặc biệt & Ghi chú:</h5>
            {contract.specialTerms && <p className="text-slate-600 italic leading-relaxed">{contract.specialTerms}</p>}
            {contract.notes && <p className="text-slate-500 leading-relaxed">{contract.notes}</p>}
          </div>
        )}

        {/* Renewal History List */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <History size={14} className="text-amber-600" />
            Lịch Sử Các Lần Gia Hạn (Renewals History) ({contract.renewals?.length || 0})
          </h4>
          {contract.renewals && contract.renewals.length > 0 ? (
            <div className="space-y-2">
              {contract.renewals.map((ren, idx) => (
                <div key={ren.id || idx} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 flex items-center gap-1">
                      <RefreshCw size={12} /> Lần {contract.renewals!.length - idx}: Gia hạn đến {ren.newEndDate}
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      +{ren.renewalValueVnd.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>{ren.notes || 'Gia hạn thời gian sử dụng'}</span>
                    <span className="font-mono">{new Date(ren.createdAtUtc).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Chưa có lần gia hạn nào cho hợp đồng này. Bấm nút "Gia hạn Hợp đồng" ở trên khi hợp đồng sắp hết hạn.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
