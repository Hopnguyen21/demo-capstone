import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Search, Filter, CheckCircle2, XCircle, AlertCircle,
  Calendar, DollarSign, Percent, Edit3, Trash2, ShieldCheck, Power,
  Clock, ArrowRight, Sparkles, Building2, Layers
} from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { discountService, extractApiError } from '../../services';
import { DiscountCode } from '../../types';

export const DiscountCodesPage: React.FC = () => {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'Percentage' | 'FixedAmount'>('Percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minContractValue, setMinContractValue] = useState<number>(5000000);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usageLimit, setUsageLimit] = useState<number | ''>(100);
  const [isActive, setIsActive] = useState(true);

  const fetchDiscountCodes = async () => {
    setLoading(true);
    try {
      const data = await discountService.getAll(false);
      setDiscountCodes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải danh sách mã giảm giá:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountCodes();
  }, []);

  const openCreateModal = () => {
    setEditingCode(null);
    setCode('');
    setDescription('');
    setDiscountType('Percentage');
    setDiscountValue(10);
    setMinContractValue(5000000);
    setMaxDiscountAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setUsageLimit(100);
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: DiscountCode) => {
    setEditingCode(item);
    setCode(item.code);
    setDescription(item.description);
    setDiscountType(item.discountType === 2 || item.discountType === 'FixedAmount' ? 'FixedAmount' : 'Percentage');
    setDiscountValue(item.discountValue);
    setMinContractValue(item.minContractValue || 0);
    setMaxDiscountAmount(item.maxDiscountAmount ?? '');
    setStartDate(item.startDateUtc ? item.startDateUtc.split('T')[0] : '');
    setEndDate(item.endDateUtc ? item.endDateUtc.split('T')[0] : '');
    setUsageLimit(item.usageLimit ?? '');
    setIsActive(item.isActive);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Vui lòng nhập mã giảm giá.');
      return;
    }
    if (discountValue <= 0) {
      setErrorMsg('Mức giảm giá phải lớn hơn 0.');
      return;
    }
    if (discountType === 'Percentage' && discountValue > 100) {
      setErrorMsg('Phần trăm giảm giá không được vượt quá 100%.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType: discountType === 'Percentage' ? 1 : 2,
        discountValue: Number(discountValue),
        minContractValue: Number(minContractValue) || 0,
        maxDiscountAmount: maxDiscountAmount !== '' ? Number(maxDiscountAmount) : null,
        startDateUtc: startDate ? new Date(startDate).toISOString() : null,
        endDateUtc: endDate ? new Date(endDate).toISOString() : null,
        usageLimit: usageLimit !== '' ? Number(usageLimit) : null,
        isActive,
      };

      if (editingCode) {
        await discountService.update(editingCode.id, payload);
        setSuccessMsg(`Đã cập nhật mã giảm giá [${code.toUpperCase()}] thành công!`);
      } else {
        await discountService.create(payload);
        setSuccessMsg(`Đã tạo mới mã giảm giá [${code.toUpperCase()}] thành công!`);
      }

      setIsModalOpen(false);
      await fetchDiscountCodes();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(extractApiError(err) || 'Lưu mã giảm giá thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: DiscountCode) => {
    try {
      await discountService.update(item.id, {
        description: item.description,
        discountType: item.discountType === 2 || item.discountType === 'FixedAmount' ? 2 : 1,
        discountValue: item.discountValue,
        minContractValue: item.minContractValue,
        maxDiscountAmount: item.maxDiscountAmount,
        startDateUtc: item.startDateUtc,
        endDateUtc: item.endDateUtc,
        usageLimit: item.usageLimit,
        isActive: !item.isActive,
      });
      await fetchDiscountCodes();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể đổi trạng thái mã.');
    }
  };

  const handleDelete = async (item: DiscountCode) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mã giảm giá [${item.code}]? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      await discountService.delete(item.id);
      await fetchDiscountCodes();
      setSuccessMsg(`Đã xóa mã giảm giá [${item.code}].`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(extractApiError(err) || 'Không thể xóa mã giảm giá.');
    }
  };

  const filteredCodes = discountCodes.filter(c => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.isActive) ||
      (statusFilter === 'INACTIVE' && !c.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#119653] mb-1">
            <ShieldCheck size={16} /> Quản trị Tài chính & Khuyến Mãi
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Tag className="text-[#119653]" size={26} /> Quản Lý Mã Giảm Giá & Ưu Đãi Hợp Đồng
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Chỉ <strong>Platform Admin</strong> có quyền tạo và kích hoạt các mã giảm giá. 
            Kỹ thuật viên (<strong>Technician</strong>) được cấp quyền tra cứu và tự động thêm mã phù hợp với giá trị hợp đồng khi lập báo giá & hợp đồng triển khai.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-2 px-5 py-2.5 shadow-md shadow-emerald-700/20 shrink-0"
        >
          <Plus size={16} /> Tạo Mã Giảm Giá Mới
        </Button>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 size={16} className="text-[#119653]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã hoặc mô tả..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#119653]"
          >
            <option value="ALL">Tất cả ({discountCodes.length})</option>
            <option value="ACTIVE">Đang hoạt động ({discountCodes.filter(c => c.isActive).length})</option>
            <option value="INACTIVE">Tạm khóa ({discountCodes.filter(c => !c.isActive).length})</option>
          </select>
        </div>
      </div>

      {/* Discount Codes Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Đang tải danh sách mã ưu đãi...</div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#119653] flex items-center justify-center mx-auto">
              <Tag size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Không tìm thấy mã giảm giá nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Chưa có mã giảm giá nào phù hợp với bộ lọc. Hãy bấm nút "Tạo Mã Giảm Giá Mới" để tạo ưu đãi cho kỹ thuật viên sử dụng.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3.5">Mã Giảm Giá</th>
                  <th className="p-3.5">Mô Tả Chương Trình</th>
                  <th className="p-3.5 text-center">Mức Giảm</th>
                  <th className="p-3.5">Điều Kiện HĐ</th>
                  <th className="p-3.5">Thời Hạn</th>
                  <th className="p-3.5 text-center">Lượt Dùng</th>
                  <th className="p-3.5 text-center">Trạng Thái</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCodes.map(item => {
                  const isPct = item.discountType === 1 || item.discountType === 'Percentage';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Code Badge */}
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 font-mono font-black text-xs text-emerald-800">
                          <Tag size={12} className="text-[#119653]" />
                          <span>{item.code}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 leading-snug">{item.description}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Tạo bởi: {item.createdByName || 'Admin'}</div>
                      </td>

                      {/* Value */}
                      <td className="p-3.5 text-center">
                        <span className="font-mono font-bold text-sm text-[#119653]">
                          {isPct ? `${item.discountValue}%` : `${item.discountValue.toLocaleString()} đ`}
                        </span>
                        {isPct && item.maxDiscountAmount && (
                          <div className="text-[10px] text-slate-500">Tối đa {item.maxDiscountAmount.toLocaleString()} đ</div>
                        )}
                      </td>

                      {/* Condition */}
                      <td className="p-3.5">
                        <div className="text-slate-700">
                          Tối thiểu:{' '}
                          <strong className="font-mono text-slate-900">
                            {item.minContractValue > 0 ? `${item.minContractValue.toLocaleString()} đ` : 'Mọi giá trị'}
                          </strong>
                        </div>
                      </td>

                      {/* Validity */}
                      <td className="p-3.5">
                        <div className="text-slate-700 flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span>
                            {item.startDateUtc ? new Date(item.startDateUtc).toLocaleDateString('vi-VN') : 'Từ nay'}
                            {' → '}
                            {item.endDateUtc ? new Date(item.endDateUtc).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                          </span>
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="p-3.5 text-center font-mono">
                        <span className="font-bold text-slate-800">{item.usedCount}</span>
                        <span className="text-slate-400">/{item.usageLimit ?? '∞'}</span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          title="Bấm để bật/tắt kích hoạt mã"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                            item.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-[#119653]' : 'bg-slate-400'}`} />
                          {item.isActive ? 'Hoạt động' : 'Tạm khóa'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa mã"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa mã"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tạo / Sửa Mã Giảm Giá */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCode ? `Chỉnh Sửa Mã Giảm Giá #${editingCode.code}` : 'Tạo Mã Giảm Giá / Khuyến Mãi Mới'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mã Giảm Giá (Code) *</label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="VD: WELCOME10, VIETGAP15..."
                disabled={!!editingCode}
                className="font-mono font-bold uppercase"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Ký tự viết hoa không dấu, không khoảng trắng</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Hình Thức Giảm Giá *</label>
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-semibold"
              >
                <option value="Percentage">Phần trăm chiết khấu (%)</option>
                <option value="FixedAmount">Số tiền cố định (VNĐ)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mô Tả Ưu Đãi *</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="VD: Ưu đãi chào mừng thành viên mới ký hợp đồng lần đầu"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {discountType === 'Percentage' ? 'Mức Giảm (%) *' : 'Mức Giảm (VNĐ) *'}
              </label>
              <Input
                type="number"
                min={0}
                max={discountType === 'Percentage' ? 100 : undefined}
                step={discountType === 'Percentage' ? 0.5 : 10000}
                value={discountValue}
                onChange={e => setDiscountValue(Number(e.target.value))}
                required
                className="font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Giá Trị HĐ Tối Thiểu (VNĐ)</label>
              <Input
                type="number"
                min={0}
                step={100000}
                value={minContractValue}
                onChange={e => setMinContractValue(Number(e.target.value))}
                className="font-mono"
                placeholder="0 = Không yêu cầu"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Giảm Tối Đa (VNĐ)</label>
              <Input
                type="number"
                min={0}
                step={100000}
                value={maxDiscountAmount}
                onChange={e => setMaxDiscountAmount(e.target.value ? Number(e.target.value) : '')}
                disabled={discountType !== 'Percentage'}
                className="font-mono"
                placeholder="Trống = Không giới hạn"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ngày Bắt Đầu</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Ngày Hết Hạn</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Giới Hạn Lượt Dùng</label>
              <Input
                type="number"
                min={1}
                value={usageLimit}
                onChange={e => setUsageLimit(e.target.value ? Number(e.target.value) : '')}
                placeholder="Trống = Vô hạn"
                className="font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-[#119653] focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="isActiveCheck" className="font-semibold text-slate-800 cursor-pointer">
              Kích hoạt ngay cho Kỹ thuật viên sử dụng
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#119653] hover:bg-emerald-700 text-white font-bold"
            >
              {submitting ? 'Đang lưu...' : editingCode ? 'Cập Nhật Mã' : 'Lưu & Phát Hành Mã'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
