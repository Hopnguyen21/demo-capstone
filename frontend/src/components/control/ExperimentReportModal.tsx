import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { ServiceRequest, QuotationItem } from '../../types';
import { supportService } from '../../services';
import {
  FileText, Send, CheckCircle2, ShieldCheck, Info,
  Package, DollarSign, Calculator, Cpu, Sparkles, Building2, User, Lock
} from 'lucide-react';

export interface HardwareItem {
  id: string;
  code: string;
  name: string;
  category: 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP' | 'EC_PH';
  serialNumber: string;
  mac: string;
  status: 'READY' | 'DEPLOYED';
  specification: string;
  isSelected: boolean;
}

interface ExperimentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onSendContractSuccess?: () => void;
}

export const ExperimentReportModal: React.FC<ExperimentReportModalProps> = ({
  isOpen,
  onClose,
  request,
  onSendContractSuccess,
}) => {
  // Default quotation items matching Image 2 table layout!
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([
    {
      id: 'item-gw-01',
      code: 'GW-ESP32-DL01',
      name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
      unit: 'Trạm',
      unitPrice: 3800000,
      vatPercent: 8,
      quantity: 1,
      totalAmount: 4104000,
      notes: 'LoRa 915MHz, Chống nước IP67, Bảo hành 24 tháng',
      isSelected: true,
    },
    {
      id: 'item-soil-01',
      code: 'SN-SOIL-01',
      name: 'Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe',
      unit: 'Node',
      unitPrice: 1250000,
      vatPercent: 8,
      quantity: 2,
      totalAmount: 2700000,
      notes: 'Đầu đo 3-in-1 (Nhiệt, Ẩm, EC Đất), Giảm 5%',
      isSelected: true,
    },
    {
      id: 'item-air-02',
      code: 'SN-AIR-02',
      name: 'Node Cảm biến Vi khí hậu Không khí SHT30',
      unit: 'Node',
      unitPrice: 950000,
      vatPercent: 8,
      quantity: 2,
      totalAmount: 2052000,
      notes: 'Sensirion SHT30, Đo Nhiệt độ, Độ ẩm & CO2',
      isSelected: true,
    },
    {
      id: 'item-valve-01',
      code: 'ACT-VALVE-01',
      name: 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng',
      unit: 'Bộ',
      unitPrice: 2150000,
      vatPercent: 8,
      quantity: 2,
      totalAmount: 4644000,
      notes: '4 Relay 12V/24V, Hỗ trợ phản hồi trạng thái công tắc',
      isSelected: true,
    },
    {
      id: 'item-pump-02',
      code: 'ACT-PUMP-02',
      name: 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động',
      unit: 'Bộ',
      unitPrice: 1800000,
      vatPercent: 8,
      quantity: 1,
      totalAmount: 1944000,
      notes: 'Điều chế xung PWM châm dung dịch A/B',
      isSelected: false,
    }
  ]);

  const [contractNote, setContractNote] = useState(
    'Báo giá lắp đặt trọn gói hệ thống IoT nhà màng. Đã bao gồm thiết bị, công lắp đặt thực địa và bảo hành 2 năm.'
  );

  const isLocked = Boolean(
    request.contractDetails?.isSignedByOwner ||
    request.contractDetails?.is30PercentPaid ||
    request.isContractSigned ||
    request.isDepositPaid ||
    request.isFullyPaid
  );

  useEffect(() => {
    if (request.contractDetails?.items && request.contractDetails.items.length > 0) {
      setQuotationItems(
        request.contractDetails.items.map((it: any) => ({
          ...it,
          isSelected: true,
        }))
      );
    }
    if (request.contractDetails?.notes) {
      setContractNote(request.contractDetails.notes);
    }
  }, [request]);

  const toggleSelectItem = (id: string) => {
    if (isLocked) return;
    setQuotationItems(prev =>
      prev.map(item => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const updateQuantity = (id: string, delta: number) => {
    if (isLocked) return;
    setQuotationItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          const rawPrice = item.unitPrice * newQty;
          const totalWithVat = rawPrice * (1 + item.vatPercent / 100);
          return { ...item, quantity: newQty, totalAmount: Math.round(totalWithVat) };
        }
        return item;
      })
    );
  };

  const addNewItem = () => {
    if (isLocked) return;
    const newItemId = `item-custom-${Date.now()}`;
    setQuotationItems([
      ...quotationItems,
      {
        id: newItemId,
        code: 'SP-MOI',
        name: 'Tên thiết bị mới',
        unit: 'Cái',
        unitPrice: 1000000,
        vatPercent: 8,
        quantity: 1,
        totalAmount: 1080000,
        notes: 'Nhập ghi chú hoặc mô tả liên kết',
        isSelected: true,
      }
    ]);
  };

  const updateItemField = (id: string, field: keyof QuotationItem, value: any) => {
    if (isLocked) return;
    setQuotationItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'unitPrice' || field === 'quantity' || field === 'vatPercent') {
          const rawPrice = updated.unitPrice * updated.quantity;
          updated.totalAmount = Math.round(rawPrice * (1 + updated.vatPercent / 100));
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    if (isLocked) return;
    setQuotationItems(prev => prev.filter(item => item.id !== id));
  };

  const selectedItems = quotationItems.filter(i => i.isSelected);
  const subtotal = selectedItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const vatTotal = selectedItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity * (i.vatPercent / 100)), 0);
  const grandTotal = subtotal + vatTotal;
  const deposit30 = Math.round(grandTotal * 0.3);
  const remaining70 = grandTotal - deposit30;

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      alert('🔒 Hợp đồng đã được Chủ trang trại ký kết và thanh toán cọc. Kỹ thuật viên không được phép chỉnh sửa hợp đồng.');
      return;
    }
    if (selectedItems.length === 0) {
      alert('⚠️ Vui lòng chọn ít nhất 1 sản phẩm/thiết bị để lập Báo giá & Hợp đồng!');
      return;
    }

    await supportService.sendContract(request.serviceRequestId, {
      items: selectedItems,
      subtotal,
      vatTotal,
      totalAmount: grandTotal,
      deposit30Percent: deposit30,
      remaining70Percent: remaining70,
    });

    if (onSendContractSuccess) {
      onSendContractSuccess();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLocked ? "🔒 Hợp Đồng Triển Khai IoT (Đã Ký & Thanh Toán Cọc - Khóa Chỉnh Sửa)" : "📄 Bảng Dự Toán Thiết Bị & Hợp Đồng Triển Khai IoT"}
      size="full"
    >
      <form onSubmit={handleSendContract} className="space-y-4 text-xs">
        {/* Warning Banner when locked */}
        {isLocked && (
          <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-bold text-xs uppercase tracking-wide text-amber-950 flex items-center gap-1.5">
                🔒 HỢP ĐỒNG ĐÃ ĐƯỢC CHỦ TRANG TRẠI KÝ KẾT & THANH TOÁN TIỀN CỌC
              </h4>
              <p className="text-[11px] text-amber-900 leading-snug">
                Hợp đồng này đã có hiệu lực pháp lý và đã xác nhận thanh toán cọc thành công từ Chủ trang trại. <strong>Kỹ thuật viên không được phép chỉnh sửa hoặc thay đổi danh mục thiết bị, số lượng, đơn giá và điều khoản hợp đồng.</strong> Chế độ xem thông tin chỉ đọc.
              </p>
            </div>
          </div>
        )}

        {/* Header Info Banner */}
        <div className="p-3.5 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              {isLocked ? <Lock size={16} className="text-amber-400" /> : <FileText size={16} />}
              Hợp đồng Lắp đặt IoT #{request.serviceRequestId.toUpperCase()}
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
              Khách hàng: {request.assignedOwnerName || 'Lê Văn An'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 flex items-center gap-3">
            <span><strong>Trang trại:</strong> {request.farmName}</span>
            <span>•</span>
            <span><strong>Phân khu:</strong> {request.zoneName}</span>
          </p>
        </div>

        {/* Contract Note */}
        <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block font-bold text-slate-800">
            Ghi chú Điều khoản & Phạm vi Lắp đặt * {isLocked && <span className="text-amber-700 text-[11px] font-normal">(Đã khóa)</span>}
          </label>
          <Input
            value={contractNote}
            onChange={e => setContractNote(e.target.value)}
            placeholder="Nhập ghi chú điều khoản báo giá..."
            required
            disabled={isLocked}
            readOnly={isLocked}
          />
        </div>

        {/* Product Quotation Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Package size={15} className="text-[#062326]" /> Bảng Báo giá Thiết bị & Vật tư IoT ({selectedItems.length}/{quotationItems.length})
            </h4>
            <div className="flex items-center gap-3">
              {!isLocked ? (
                <>
                  <button
                    type="button"
                    onClick={addNewItem}
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline flex items-center gap-1"
                  >
                    + Thêm thiết bị ngoài
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuotationItems(prev => prev.map(item => ({ ...item, isSelected: true })))}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                  >
                    Chọn tất cả
                  </button>
                </>
              ) : (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                  <Lock size={12} /> Bảng giá cố định (Không thể sửa)
                </span>
              )}
            </div>
          </div>

          {/* Table Container styled */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="p-2 text-center w-8">Chọn</th>
                    <th className="p-2 w-28">Mã hàng</th>
                    <th className="p-2">Tên hàng / Mô tả / Mối quan hệ điều khiển</th>
                    <th className="p-2 text-center w-16">ĐVT</th>
                    <th className="p-2 text-right w-28">Đơn giá (đ)</th>
                    <th className="p-2 text-center w-16">VAT</th>
                    <th className="p-2 text-center w-24">SL</th>
                    <th className="p-2 text-right w-28">Thành tiền (đ)</th>
                    <th className="p-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotationItems.map(item => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${item.isSelected ? 'bg-emerald-50/40' : 'opacity-60 bg-slate-50/50'}`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          disabled={isLocked}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.code}
                          onChange={(e) => updateItemField(item.id, 'code', e.target.value)}
                          disabled={isLocked}
                          readOnly={isLocked}
                          className="w-full font-mono font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                          disabled={isLocked}
                          readOnly={isLocked}
                          className="w-full font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none mb-1 disabled:cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItemField(item.id, 'notes', e.target.value)}
                          disabled={isLocked}
                          readOnly={isLocked}
                          placeholder="Mô tả hoặc: Sensor này điều khiển bơm nào?"
                          className="w-full text-[10px] text-slate-500 font-serif italic bg-transparent border-b border-transparent focus:border-emerald-300 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                          disabled={isLocked}
                          readOnly={isLocked}
                          className="w-full text-center font-medium text-slate-600 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItemField(item.id, 'unitPrice', Number(e.target.value))}
                          disabled={isLocked}
                          readOnly={isLocked}
                          className="w-full text-right font-mono font-medium text-slate-700 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="p-2 text-center font-mono text-slate-500">{item.vatPercent}%</td>
                      <td className="p-2 text-center">
                        {isLocked ? (
                          <span className="font-mono font-bold text-slate-800 text-center block">{item.quantity}</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1 border border-slate-200 rounded bg-white px-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-1 text-slate-500 hover:text-slate-900 font-bold"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-1 text-slate-500 hover:text-slate-900 font-bold"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-950">
                        {item.totalAmount.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="p-2 text-center">
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-rose-400 hover:text-rose-600 font-bold"
                            title="Xóa thiết bị"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Contract Financial Summary Box */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-700 text-xs">
            <span>Tiền hàng chưa thuế:</span>
            <span className="font-mono font-semibold">{subtotal.toLocaleString('vi-VN')} VNĐ</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 text-xs">
            <span>Thuế VAT (8%):</span>
            <span className="font-mono font-semibold">{vatTotal.toLocaleString('vi-VN')} VNĐ</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-emerald-200">
            <span>TỔNG GIÁ TRỊ HỢP ĐỒNG:</span>
            <span className="font-mono text-emerald-950 text-base">{grandTotal.toLocaleString('vi-VN')} VNĐ</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 text-xs">
            <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-950">
              <span className="block text-[10px] font-bold uppercase text-amber-900">💳 Tạm ứng 30% khi ký HĐ (Owner cọc)</span>
              <strong className="text-sm font-mono block font-bold text-amber-950 mt-0.5">
                {deposit30.toLocaleString('vi-VN')} VNĐ
              </strong>
            </div>

            <div className="p-2 bg-sky-100/70 border border-sky-300 rounded-lg text-sky-950">
              <span className="block text-[10px] font-bold uppercase text-sky-900">📋 Thanh toán 70% khi Nghiệm thu</span>
              <strong className="text-sm font-mono block font-bold text-sky-950 mt-0.5">
                {remaining70.toLocaleString('vi-VN')} VNĐ
              </strong>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {isLocked ? (
              <span className="text-amber-800 font-semibold flex items-center gap-1">
                <Lock size={13} className="text-amber-600" /> Hợp đồng đã có giá trị pháp lý và đã nhận thanh toán cọc thành công.
              </span>
            ) : (
              'Sau khi gửi, Owner sẽ nhận được Hợp đồng để ký & đặt cọc 30%.'
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              {isLocked ? 'Đóng' : 'Hủy bỏ'}
            </Button>
            {isLocked ? (
              <div className="px-3.5 py-2 rounded-xl bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                <Lock size={14} className="text-amber-700" />
                <span>Hợp đồng đã thanh toán cọc (Khóa chỉnh sửa)</span>
              </div>
            ) : (
              <Button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md px-4 py-2"
              >
                <CheckCircle2 size={15} />
                <span>Xác nhận & Gửi Hợp đồng ngay cho Khách</span>
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
