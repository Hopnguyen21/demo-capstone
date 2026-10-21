import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { DeviceDepreciation, Zone } from '../../types';
import { zoneContractService } from '../../services';
import {
  Cpu, Calendar, DollarSign, Clock, ShieldCheck, CheckCircle2,
  AlertTriangle, Calculator, Sparkles, Building2
} from 'lucide-react';

interface DeviceDepreciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone: Zone | null;
  nodes: any[];
  onSuccess: (newDep: DeviceDepreciation) => void;
}

export const DeviceDepreciationModal: React.FC<DeviceDepreciationModalProps> = ({
  isOpen,
  onClose,
  zone,
  nodes = [],
  onSuccess,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [originalCost, setOriginalCost] = useState<number>(4500000); // 4.5M VND default
  const [lifetimeMonths, setLifetimeMonths] = useState<number>(24); // 24 months (2 years)
  const [warrantyMonths, setWarrantyMonths] = useState<number>(24); // 24 months warranty
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('Bảo hành chính hãng 24 tháng. Khấu hao đường thẳng (Straight-line).');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto Calculations
  const today = new Date();
  const start = new Date(startDate);
  const monthsElapsed = Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth());
  const monthlyDepreciation = Math.round(originalCost / Math.max(1, lifetimeMonths));
  const accumulatedDepreciation = Math.min(originalCost, monthlyDepreciation * monthsElapsed);
  const currentBookValue = Math.max(0, originalCost - accumulatedDepreciation);
  const remainingMonths = Math.max(0, lifetimeMonths - monthsElapsed);

  const status = remainingMonths <= 0
    ? 'FullyDepreciated'
    : remainingMonths <= 3
    ? 'ExpiringSoon'
    : 'Active';

  const statusBadge = {
    Active: { text: 'Đang hoạt động (Khấu hao bình thường)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    ExpiringSoon: { text: 'Sắp hết khấu hao (Còn ≤ 3 tháng)', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    FullyDepreciated: { text: 'Đã hết khấu hao (Book value = 0đ)', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  }[status];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) {
      alert('Vui lòng chọn Zone!');
      return;
    }
    const zoneId = zone.zoneId || (zone as any).id;
    const deviceId = selectedDeviceId || (nodes.length > 0 ? (nodes[0].deviceId || nodes[0].nodeId) : '50000000-0000-0000-0000-000000000001');

    setIsSubmitting(true);
    try {
      const created = await zoneContractService.createDepreciation(zoneId, {
        deviceId,
        originalCostVnd: originalCost,
        depreciationLifetimeMonths: lifetimeMonths,
        startDate,
        notes: `Thời hạn bảo hành: ${warrantyMonths} tháng. ${notes}`,
      });
      alert('🎉 Đã thêm hồ sơ theo dõi khấu hao và tuổi thọ thiết bị thành công!');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi thêm khấu hao:', err);
      alert(`⚠️ Không thể thêm hồ sơ khấu hao: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⏱️ Đăng Ký Hồ Sơ Khấu Hao & Tuổi Thọ Thiết Bị (Asset Tracking)"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
          <div className="font-bold flex items-center gap-1.5">
            <Cpu size={15} className="text-[#119653]" />
            Quản lý tài sản thiết bị cho Zone: <strong>{zone?.name || 'Zone'}</strong>
          </div>
          <p className="text-[11px] text-emerald-800">
            Hệ thống tự động theo dõi tuổi thọ khấu hao và cảnh báo khi thiết bị sắp hết thời gian khấu hao gắn liền với nghiệp vụ gia hạn hợp đồng.
          </p>
        </div>

        {/* 1. Device Selection & Basic Dates */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Chọn Thiết bị IoT tại Phân khu *</label>
            <select
              className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium cursor-pointer"
              value={selectedDeviceId}
              onChange={e => setSelectedDeviceId(e.target.value)}
            >
              <option value="">-- Chọn thiết bị từ danh sách Node --</option>
              {nodes.map(n => (
                <option key={n.nodeId || n.deviceId} value={n.nodeId || n.deviceId}>
                  {n.name} ({n.nodeCode || n.hardwareAddress || 'LoRa Node'}) - {n.status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Ngày lắp đặt (Start Date) *</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Thời hạn bảo hành (tháng):</label>
              <select
                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                value={warrantyMonths}
                onChange={e => setWarrantyMonths(Number(e.target.value))}
              >
                <option value={12}>12 Tháng (1 Năm)</option>
                <option value={24}>24 Tháng (2 Năm)</option>
                <option value={36}>36 Tháng (3 Năm)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Thời gian khấu hao (tháng) *</label>
              <select
                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                value={lifetimeMonths}
                onChange={e => setLifetimeMonths(Number(e.target.value))}
              >
                <option value={12}>12 Tháng (1 Năm)</option>
                <option value={24}>24 Tháng (2 Năm - Tiêu chuẩn)</option>
                <option value={36}>36 Tháng (3 Năm)</option>
                <option value={48}>48 Tháng (4 Năm)</option>
                <option value={60}>60 Tháng (5 Năm)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Nguyên giá thiết bị ban đầu (VNĐ) *</label>
            <Input
              type="number"
              value={originalCost}
              onChange={e => setOriginalCost(Number(e.target.value))}
              placeholder="VD: 4500000"
              required
            />
          </div>
        </div>

        {/* 2. Automatic Live Depreciation Calculation */}
        <div className="p-4 bg-white border-2 border-slate-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Calculator size={14} className="text-[#119653]" />
              Kết quả Tự động Tính Khấu hao (Straight-Line Method):
            </h5>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>• Khấu hao hàng tháng (= Nguyên giá / {lifetimeMonths} tháng):</span>
              <strong className="font-mono text-slate-900">{monthlyDepreciation.toLocaleString('vi-VN')} đ/tháng</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>• Thời gian đã sử dụng thực tế:</span>
              <span className="font-mono font-medium">{monthsElapsed} tháng</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>• Khấu hao lũy kế đến hiện tại (= Khấu hao tháng × {monthsElapsed} tháng):</span>
              <span className="font-mono text-amber-700 font-bold">{accumulatedDepreciation.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex justify-between text-slate-700 font-bold bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span>• Giá trị sổ sách còn lại (Current Book Value):</span>
              <span className="font-mono text-emerald-700 text-sm">{currentBookValue.toLocaleString('vi-VN')} VNĐ</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>• Thời gian còn lại đến khi hết khấu hao:</span>
              <strong className="font-mono text-slate-900">{remainingMonths} tháng</strong>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ghi chú & Hồ sơ bảo dưỡng:</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button size="sm" variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
            <CheckCircle2 size={14} className="mr-1.5" />
            {isSubmitting ? 'Đang lưu...' : 'Lưu Hồ Sơ Khấu Hao'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
