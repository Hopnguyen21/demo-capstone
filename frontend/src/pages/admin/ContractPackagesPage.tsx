import React, { useState, useEffect } from 'react';
import {
  PackageCheck, Plus, Edit2, Trash2, Power, CheckCircle, XCircle,
  Clock, MapPin, Layers, DollarSign, ShieldAlert, Sparkles
} from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { contractPackageService, extractApiError } from '../../services';
import { ContractPackage, PackageStatus } from '../../types';
import { useAuth } from '@/app/providers/AuthContext';

export const ContractPackagesPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'PLATFORM_ADMIN';

  const [packages, setPackages] = useState<ContractPackage[]>([]);
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ContractPackage | null>(null);

  // Form State
  const [packageName, setPackageName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [maxZones, setMaxZones] = useState<number>(1);
  const [price, setPrice] = useState<number>(10000000);
  const [currency, setCurrency] = useState('VND');

  const loadPackages = async (isCustomTab: boolean = activeTab === 'custom') => {
    setLoading(true);
    try {
      const res = await contractPackageService.getAll(undefined, isCustomTab);
      setPackages(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages(activeTab === 'custom');
  }, [activeTab]);

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setPackageName('');
    setDescription('');
    setDurationMonths(12);
    setMaxZones(2);
    setPrice(9500000);
    setCurrency('VND');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pkg: ContractPackage) => {
    setEditingPackage(pkg);
    setPackageName(pkg.packageName);
    setDescription(pkg.description || '');
    setDurationMonths(pkg.durationMonths);
    setMaxZones(pkg.maxZones);
    setPrice(pkg.price);
    setCurrency(pkg.currency || 'VND');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName.trim()) {
      alert('Vui lòng nhập tên gói hợp đồng.');
      return;
    }
    if (durationMonths <= 0 || maxZones <= 0 || price < 0) {
      alert('Thời hạn và số zone phải lớn hơn 0, giá không được âm.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingPackage) {
        await contractPackageService.update(editingPackage.id, {
          packageName: packageName.trim(),
          description: description.trim() || undefined,
          durationMonths,
          maxZones,
          price,
          currency
        });
      } else {
        await contractPackageService.create({
          packageName: packageName.trim(),
          description: description.trim() || undefined,
          durationMonths,
          maxZones,
          price,
          currency
        });
      }
      setIsModalOpen(false);
      await loadPackages();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể lưu gói hợp đồng.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (pkg: ContractPackage) => {
    setActionLoading(true);
    try {
      await contractPackageService.toggleStatus(pkg.id);
      await loadPackages();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể đổi trạng thái gói.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (pkg: ContractPackage) => {
    if (!window.confirm(`Bạn có chắc muốn xóa gói "${pkg.packageName}"?`)) return;
    setActionLoading(true);
    try {
      await contractPackageService.delete(pkg.id);
      await loadPackages();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể xóa gói hợp đồng. Hãy chọn Vô hiệu hóa thay thế nếu gói đã được sử dụng.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="text-[#119653]" size={24} /> Quản lý Gói Hợp Đồng Canh Tác (Contract Packages)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Thiết lập các gói dịch vụ mẫu (Starter, Standard, Professional) với định mức Zone, thời hạn và đơn giá chuẩn.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-sm self-start md:self-auto"
        >
          <Plus size={16} /> Thêm Gói Mới
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('standard')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'standard'
              ? 'border-[#119653] text-[#119653]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackageCheck size={15} /> Gói Tiêu Chuẩn Hệ Thống (Dùng Chung)
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'custom'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles size={15} /> Gói Riêng Cho Khách Hàng (Tạo Theo Hợp Đồng)
        </button>
      </div>

      {activeTab === 'custom' && (
        <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-purple-950 text-xs flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600 shrink-0" />
          <span>
            Danh sách dưới đây là <strong>các gói dịch vụ được thiết kế riêng cho từng khách hàng</strong> khi lập Hợp đồng. Các gói này không nằm trong danh mục gói dùng chung của hệ thống.
          </span>
        </div>
      )}

      {/* Package Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh mục gói hợp đồng...</div>
      ) : packages.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          <PackageCheck size={40} className="mx-auto text-slate-300 mb-2" />
          Chưa có gói hợp đồng nào được tạo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map(pkg => {
            const isActive = pkg.status === 'Active' || pkg.status === 0;
            return (
              <div
                key={pkg.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm flex flex-col justify-between overflow-hidden ${
                  isActive ? 'border-emerald-300 hover:shadow-md' : 'border-slate-200 opacity-75 bg-slate-50'
                }`}
              >
                <div>
                  {/* Top Bar inside card */}
                  <div className={`p-4 border-b flex items-center justify-between ${
                    isActive ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-100' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className={isActive ? 'text-[#119653]' : 'text-slate-400'} />
                      <h3 className="font-bold text-sm text-slate-900">{pkg.packageName}</h3>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {isActive ? 'Đang áp dụng' : 'Vô hiệu hóa'}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4 text-xs">
                    <div>
                      <p className="text-2xl font-black text-slate-900">
                        {pkg.price.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500">{pkg.currency || 'VND'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Khoảng {Math.round(pkg.price / Math.max(1, pkg.durationMonths)).toLocaleString('vi-VN')} {pkg.currency}/tháng
                      </p>
                    </div>

                    {pkg.isCustom && (
                      <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-purple-900 text-[11px] flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1">
                          <Sparkles size={12} className="text-purple-600" /> Khách hàng:
                        </span>
                        <strong className="font-bold truncate max-w-[150px]">{pkg.customerName || 'Theo HĐ'}</strong>
                      </div>
                    )}

                    <p className="text-slate-600 min-h-[40px] leading-relaxed">
                      {pkg.description || 'Không có mô tả chi tiết.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                        <Clock size={16} className="text-sky-600" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Thời hạn</p>
                          <p className="font-bold text-slate-900">{pkg.durationMonths} Tháng</p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                        <Layers size={16} className="text-emerald-600" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Tối đa Zone</p>
                          <p className="font-bold text-slate-900">{pkg.maxZones} Phân khu</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleStatus(pkg)}
                    disabled={actionLoading}
                    className={`font-semibold hover:underline inline-flex items-center gap-1 ${
                      isActive ? 'text-amber-700 hover:text-amber-900' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <Power size={13} />
                    {isActive ? 'Tạm ngắt' : 'Kích hoạt lại'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(pkg)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 inline-flex items-center gap-1"
                    >
                      <Edit2 size={13} /> Sửa
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(pkg)}
                        className="p-1 text-rose-500 hover:text-rose-700"
                        title="Xóa gói"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tạo/Sửa Gói */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPackage ? `Chỉnh Sửa Gói Hợp Đồng: ${editingPackage.packageName}` : 'Tạo Gói Hợp Đồng Mới'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tên gói hợp đồng (*)</label>
            <input
              type="text"
              placeholder="Ví dụ: Gói Starter, Gói Standard..."
              value={packageName}
              onChange={e => setPackageName(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-bold text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Thời hạn (Tháng) (*)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={durationMonths}
                onChange={e => setDurationMonths(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Số lượng Zone tối đa (*)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxZones}
                onChange={e => setMaxZones(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Giá trọn gói (*)</label>
              <input
                type="number"
                min="0"
                step="500000"
                value={price}
                onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-bold text-emerald-700 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tiền tệ</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Mô tả quyền lợi và tính năng gói</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Áp dụng cho nông hộ canh tác dâu tây/cà chua, tích hợp điều khiển tưới tự động..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
              Đóng
            </Button>
            <Button type="submit" disabled={actionLoading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
              {actionLoading ? 'Đang lưu...' : (editingPackage ? 'Cập Nhật Gói' : 'Tạo Gói Mới')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

