import React, { useState } from 'react';
import { mockTenants } from '../../mocks/mockData';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Building2, Plus, Search, MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

export const TenantsPage: React.FC = () => {
  const [tenants, setTenants] = useState(mockTenants);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', code: '', email: '', phone: '', address: '' });

  const filtered = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      tenantId: `tenant-${Date.now()}`,
      name: newTenant.name,
      code: newTenant.code.toUpperCase(),
      email: newTenant.email,
      phone: newTenant.phone,
      address: newTenant.address,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      farmsCount: 0,
      usersCount: 1,
    };
    setTenants([created, ...tenants]);
    setIsModalOpen(false);
    setNewTenant({ name: '', code: '', email: '', phone: '', address: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-[#062326]" size={22} /> Quản lý Tổ chức Người thuê (SaaS Tenants)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách các Hợp tác xã, Doanh nghiệp Nông nghiệp đăng ký sử dụng nền tảng SmartFarm.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Đăng ký Tenant Mới
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo tên tổ chức hoặc mã Tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-xs text-slate-500">Hiển thị {filtered.length} tổ chức</span>
      </div>

      {/* Tenants Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(t => (
          <div key={t.tenantId} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-xs hover:border-[#062326]/30 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#062326] border border-slate-200">
                  {t.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1.5">{t.name}</h3>
              </div>
              <StatusBadge status={t.status} />
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={14} className="text-[#062326] shrink-0" />
                <span className="truncate">{t.address || 'Chưa cập nhật địa chỉ'}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <span className="flex items-center gap-1.5"><Mail size={13} /> {t.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={13} /> {t.phone}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500">Trang trại: <strong className="text-slate-900">{t.farmsCount}</strong></span>
                <span className="text-slate-500">Tài khoản: <strong className="text-slate-900">{t.usersCount}</strong></span>
              </div>
              <button className="text-[#062326] hover:underline font-semibold flex items-center gap-1">
                Chi tiết & Cấu hình <ExternalLink size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Tenant Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Đăng ký Hợp tác xã / Tenant Mới">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tên Tổ chức / HTX</label>
            <Input required value={newTenant.name} onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} placeholder="Ví dụ: HTX Rau Sạch Lâm Đồng" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mã Tenant Unique (Code)</label>
            <Input required value={newTenant.code} onChange={e => setNewTenant({ ...newTenant, code: e.target.value })} placeholder="HTX_LAMDONG" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Đại diện</label>
              <Input type="email" required value={newTenant.email} onChange={e => setNewTenant({ ...newTenant, email: e.target.value })} placeholder="contact@htx.vn" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại</label>
              <Input required value={newTenant.phone} onChange={e => setNewTenant({ ...newTenant, phone: e.target.value })} placeholder="0908 123 456" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Địa chỉ trụ sở</label>
            <Input value={newTenant.address} onChange={e => setNewTenant({ ...newTenant, address: e.target.value })} placeholder="TP. Đà Lạt, Lâm Đồng" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Xác nhận tạo Tenant</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
