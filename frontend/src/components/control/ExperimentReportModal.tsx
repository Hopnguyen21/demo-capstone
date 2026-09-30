import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { ServiceRequest, QuotationItem } from '../../types';
import { supportService } from '../../services';
import {
  FileText, Send, CheckCircle2, ShieldCheck, Info,
  Package, DollarSign, Calculator, Cpu, Sparkles, Building2, User
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

  const toggleSelectItem = (id: string) => {
    setQuotationItems(prev =>
      prev.map(item => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const updateQuantity = (id: string, delta: number) => {
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

  const selectedItems = quotationItems.filter(i => i.isSelected);
  const subtotal = selectedItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const vatTotal = selectedItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity * (i.vatPercent / 100)), 0);
  const grandTotal = subtotal + vatTotal;
  const deposit30 = Math.round(grandTotal * 0.3);
  const remaining70 = grandTotal - deposit30;

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Modal isOpen={isOpen} onClose={onClose} title="📄 Báo giá & Hợp đồng Lắp đặt IoT Thực địa">
      <form onSubmit={handleSendContract} className="space-y-4 text-xs">
        {/* Header Info Banner */}
        <div className="p-3.5 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <FileText size={16} /> Hợp đồng Lắp đặt IoT #{request.serviceRequestId.toUpperCase()}
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
          <label className="block font-bold text-slate-800">Ghi chú Điều khoản & Phạm vi Lắp đặt *</label>
          <Input
            value={contractNote}
            onChange={e => setContractNote(e.target.value)}
            placeholder="Nhập ghi chú điều khoản báo giá..."
            required
          />
        </div>

        {/* Product Quotation Table (Matching Image 2 Format) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Package size={15} className="text-[#062326]" /> Bảng Báo giá Thiết bị & Vật tư IoT ({selectedItems.length}/{quotationItems.length})
            </h4>
            <button
              type="button"
              onClick={() => setQuotationItems(prev => prev.map(item => ({ ...item, isSelected: true })))}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
            >
              Chọn tất cả
            </button>
          </div>

          {/* Table Container styled like Image 2 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="p-2 text-center w-8">Chọnn</th>
                    <th className="p-2">Mã hàng</th>
                    <th className="p-2">Tên hàng / Mô tả</th>
                    <th className="p-2 text-center">ĐVT</th>
                    <th className="p-2 text-right">Đơn giá (đ)</th>
                    <th className="p-2 text-center">VAT</th>
                    <th className="p-2 text-center w-20">SL</th>
                    <th className="p-2 text-right">Thành tiền (đ)</th>
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
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="p-2">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        {item.notes && <div className="text-[10px] text-slate-400 font-serif italic">{item.notes}</div>}
                      </td>
                      <td className="p-2 text-center font-medium text-slate-600">{item.unit}</td>
                      <td className="p-2 text-right font-mono font-medium text-slate-700">
                        {item.unitPrice.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="p-2 text-center font-mono text-slate-500">{item.vatPercent}%</td>
                      <td className="p-2 text-center">
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
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-950">
                        {item.totalAmount.toLocaleString('vi-VN')}đ
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
            Sau khi gửi, Owner sẽ nhận được Hợp đồng để ký & đặt cọc 30%.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md px-4 py-2"
            >
              <Send size={15} />
              <span>Gửi Báo giá & Hợp đồng cho Khách (Owner)</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
