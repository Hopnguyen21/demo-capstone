import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { userService, tenantService } from '../../services';
import { extractApiError } from '../../services/api';
import { Button, Input, Modal, StatusBadge } from '../../components/ui/BaseUI';
import {
  Users, Plus, Search, ShieldCheck, Mail, Phone, Edit2, Lock,
  Unlock, KeyRound, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  Building2, Wrench, Sprout, HardHat, ShieldAlert, X
} from 'lucide-react';

interface UserItem {
  userId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  tenantId?: string | null;
  tenantName?: string | null;
  farmId?: string | null;
  lastLoginAtUtc?: string | null;
  createdAtUtc?: string | null;
}

const ROLE_OPTIONS = [
  {
    value: 'PlatformAdmin',
    label: 'Quản trị viên Nền tảng (PlatformAdmin)',
    icon: ShieldCheck,
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    desc: 'Toàn quyền cấu hình hệ thống, quản lý tài khoản & gói hợp đồng canh tác'
  },
  {
    value: 'PlatformTechnician',
    label: 'Kỹ thuật viên Nền tảng (PlatformTechnician)',
    icon: Wrench,
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    desc: 'Khảo sát thực địa, thiết lập trạm thiết bị IoT và hỗ trợ kỹ thuật'
  },
  {
    value: 'FarmOwner',
    label: 'Chủ trang trại (FarmOwner)',
    icon: Sprout,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    desc: 'Quản trị trang trại, thiết bị, mùa vụ, đơn dịch vụ và phân công nhân công'
  },
  {
    value: 'Farmer',
    label: 'Nhân công nông trại (Farmer)',
    icon: HardHat,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    desc: 'Thực hiện công việc thực địa, giám sát thiết bị tưới và nộp ảnh báo cáo'
  }
];

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Feedback notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'PlatformTechnician',
    password: '',
    tenantId: ''
  });

  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    role: 'FarmOwner',
    status: 'Active',
    tenantId: ''
  });

  const [resetPassForm, setResetPassForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Load users & tenants
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uData, tData] = await Promise.all([
        userService.getUsers(),
        tenantService.getTenants().catch(() => [])
      ]);
      if (Array.isArray(uData)) {
        setUsers(uData.map((u: any) => ({
          userId: u.userId || u.id,
          email: u.email,
          fullName: u.fullName || u.name || u.email,
          phone: u.phone,
          role: u.role || 'Farmer',
          status: u.status || 'Active',
          tenantId: u.tenantId,
          tenantName: u.tenantName || u.tenant?.companyName,
          farmId: u.farmId,
          lastLoginAtUtc: u.lastLoginAtUtc || u.lastLoginAt,
          createdAtUtc: u.createdAtUtc || u.createdAt
        })));
      }
      if (Array.isArray(tData)) setTenants(tData);
    } catch (err) {
      showToast('error', extractApiError(err) || 'Không thể tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'PlatformAdmin').length;
    const technicians = users.filter(u => u.role === 'PlatformTechnician').length;
    const owners = users.filter(u => u.role === 'FarmOwner').length;
    const farmers = users.filter(u => u.role === 'Farmer').length;
    return { total, admins, technicians, owners, farmers };
  }, [users]);

  // Filtered List
  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      if (!u) return false;
      const query = search.trim().toLowerCase();
      const matchSearch = !query ||
        u.fullName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.phone && u.phone.includes(query));

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Handlers
  const handleOpenCreate = () => {
    setCreateForm({
      fullName: '',
      email: '',
      phone: '',
      role: 'PlatformTechnician',
      password: '',
      tenantId: ''
    });
    setModalError(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim()) return setModalError('Họ và tên không được để trống.');
    if (!createForm.email.trim()) return setModalError('Email không được để trống.');
    if (!createForm.password) return setModalError('Mật khẩu không được để trống.');

    setIsSubmitting(true);
    setModalError(null);
    try {
      await userService.createUser({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined,
        role: createForm.role,
        password: createForm.password,
        tenantId: createForm.tenantId || undefined
      });
      showToast('success', `Đã tạo tài khoản "${createForm.fullName}" với vai trò ${createForm.role} thành công!`);
      setIsCreateOpen(false);
      await loadData();
    } catch (err) {
      setModalError(extractApiError(err) || 'Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.fullName,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      tenantId: user.tenantId || ''
    });
    setModalError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editForm.fullName.trim()) return setModalError('Họ và tên không được để trống.');

    setIsSubmitting(true);
    setModalError(null);
    try {
      await userService.updateUser(selectedUser.userId, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || undefined,
        role: editForm.role,
        status: editForm.status,
        tenantId: editForm.tenantId || undefined
      });
      showToast('success', `Đã cập nhật tài khoản "${editForm.fullName}" thành công!`);
      setIsEditOpen(false);
      await loadData();
    } catch (err) {
      setModalError(extractApiError(err) || 'Không thể cập nhật tài khoản.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    if (user.userId === currentUser?.userId) {
      showToast('error', 'Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }
    try {
      await userService.toggleStatus(user.userId);
      showToast('success', `Đã ${user.status === 'Active' ? 'khóa' : 'mở khóa'} tài khoản ${user.fullName}.`);
      await loadData();
    } catch (err) {
      showToast('error', extractApiError(err) || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const handleOpenResetPass = (user: UserItem) => {
    setSelectedUser(user);
    setResetPassForm({ newPassword: '', confirmPassword: '' });
    setModalError(null);
    setIsResetPassOpen(true);
  };

  const handleResetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!resetPassForm.newPassword) return setModalError('Vui lòng nhập mật khẩu mới.');
    if (resetPassForm.newPassword !== resetPassForm.confirmPassword) {
      return setModalError('Xác nhận mật khẩu mới không khớp.');
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await userService.resetPasswordAdmin(selectedUser.userId, resetPassForm.newPassword);
      showToast('success', `Đã đặt lại mật khẩu mới cho tài khoản ${selectedUser.fullName}.`);
      setIsResetPassOpen(false);
    } catch (err) {
      setModalError(extractApiError(err) || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (user: UserItem) => {
    if (user.userId === currentUser?.userId) {
      showToast('error', 'Bạn không thể xóa tài khoản của chính mình.');
      return;
    }
    setSelectedUser(user);
    setModalError(null);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await userService.deleteUser(selectedUser.userId);
      showToast('success', `Đã xóa tài khoản ${selectedUser.fullName} khỏi hệ thống.`);
      setIsDeleteOpen(false);
      await loadData();
    } catch (err) {
      setModalError(extractApiError(err) || 'Không thể xóa tài khoản này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-[#119653]" /> : <AlertTriangle size={16} className="text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
              PLATFORM USER MANAGEMENT
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 mt-1">
            <Users className="text-[#119653]" size={24} /> Quản lý Tài khoản & Phân quyền Hệ thống
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản trị toàn diện danh sách người dùng, thiết lập phân quyền vai trò (Admin, Kỹ thuật viên, Chủ trang trại, Nhân công) và kiểm soát trạng thái đăng nhập.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="shrink-0 shadow-sm">
          <Plus size={16} className="mr-1.5" /> Thêm tài khoản mới
        </Button>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tổng tài khoản</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.total}</span>
        </div>
        <div className="p-3.5 bg-white border border-purple-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">Quản trị viên (Admin)</span>
          <span className="text-2xl font-bold text-purple-900 mt-1 block">{stats.admins}</span>
        </div>
        <div className="p-3.5 bg-white border border-blue-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">Kỹ thuật viên</span>
          <span className="text-2xl font-bold text-blue-900 mt-1 block">{stats.technicians}</span>
        </div>
        <div className="p-3.5 bg-white border border-emerald-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Chủ trang trại</span>
          <span className="text-2xl font-bold text-emerald-900 mt-1 block">{stats.owners}</span>
        </div>
        <div className="p-3.5 bg-white border border-amber-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Nhân công (Farmer)</span>
          <span className="text-2xl font-bold text-amber-900 mt-1 block">{stats.farmers}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo họ tên, email, sđt..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9.5 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#119653]"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="PlatformAdmin">Quản trị viên (Admin)</option>
              <option value="PlatformTechnician">Kỹ thuật viên</option>
              <option value="FarmOwner">Chủ trang trại</option>
              <option value="Farmer">Nhân công nông trại</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-[#119653]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Active">Đang hoạt động</option>
              <option value="Locked">Đã bị khóa</option>
              <option value="Disabled">Vô hiệu hóa</option>
            </select>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            title="Tải lại danh sách"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="p-4">Người dùng & Liên hệ</th>
                <th className="p-4">Phân quyền Vai trò</th>
                <th className="p-4">Thuộc Đơn vị / Doanh nghiệp</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Đăng nhập gần nhất</th>
                <th className="p-4 text-right">Thao tác Quản trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                    {loading ? 'Đang tải danh sách tài khoản...' : 'Không tìm thấy người dùng phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const roleCfg = ROLE_OPTIONS.find(r => r.value === u.role);
                  const isCurrent = u.userId === currentUser?.userId;

                  return (
                    <tr key={u.userId} className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? 'bg-emerald-50/30' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 uppercase">
                            {u.fullName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1"><Mail size={11} /> {u.email}</span>
                              {u.phone && <span className="flex items-center gap-1 text-slate-400">| <Phone size={11} /> {u.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${roleCfg?.badgeClass || 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                          {roleCfg ? <roleCfg.icon size={13} className="mr-1.5 shrink-0" /> : <ShieldCheck size={13} className="mr-1.5" />}
                          {roleCfg?.label.split('(')[0].trim() || u.role}
                        </span>
                      </td>

                      <td className="p-4">
                        {u.tenantName ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                            <Building2 size={13} className="text-slate-400" />
                            {u.tenantName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Hệ thống chung</span>
                        )}
                      </td>

                      <td className="p-4">
                        <StatusBadge status={u.status} />
                      </td>

                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {u.lastLoginAtUtc ? new Date(u.lastLoginAtUtc).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                      </td>

                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Chỉnh sửa & Phân quyền lại"
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleOpenResetPass(u)}
                          className="p-1.5 rounded-lg text-sky-600 hover:text-sky-800 hover:bg-sky-50 transition-colors cursor-pointer"
                          title="Đặt lại mật khẩu mới"
                        >
                          <KeyRound size={15} />
                        </button>

                        {/* Lock / Unlock Toggle Button */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isCurrent
                              ? 'text-slate-300 cursor-not-allowed'
                              : u.status === 'Active'
                              ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                          title={isCurrent ? 'Không thể tự khóa tài khoản' : u.status === 'Active' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                        >
                          {u.status === 'Active' ? <Lock size={15} /> : <Unlock size={15} />}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleOpenDelete(u)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isCurrent ? 'text-slate-300 cursor-not-allowed' : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50'
                          }`}
                          title={isCurrent ? 'Không thể tự xóa tài khoản' : 'Xóa tài khoản này'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL 1: TẠO TÀI KHOẢN MỚI ─── */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Thêm Tài Khoản & Phân Quyền Mới">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-800 font-bold mb-1">Họ và tên *</label>
            <Input
              required
              placeholder="Ví dụ: Nguyễn Văn An"
              value={createForm.fullName}
              onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">Địa chỉ Email đăng nhập *</label>
              <Input
                required
                type="email"
                placeholder="an.nguyen@smartfarm.vn"
                value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-800 font-bold mb-1">Số điện thoại</label>
              <Input
                placeholder="0912345678"
                value={createForm.phone}
                onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Mật khẩu khởi tạo *</label>
            <Input
              required
              type="password"
              placeholder="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
              value={createForm.password}
              onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
            />
            <p className="text-[11px] text-slate-500 mt-1">Ví dụ hợp lệ: <code>SmartFarm@2026</code></p>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1.5">Phân quyền Vai trò (Role) *</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    createForm.role === r.value
                      ? 'border-[#119653] bg-emerald-50/50 ring-1 ring-[#119653]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="createRole"
                    value={r.value}
                    checked={createForm.role === r.value}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                    className="mt-0.5 text-[#119653] focus:ring-[#119653]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <r.icon size={14} className="text-[#119653]" />
                      <span>{r.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {['FarmOwner', 'Farmer'].includes(createForm.role) && tenants.length > 0 && (
            <div>
              <label className="block text-slate-800 font-bold mb-1">Thuộc Doanh nghiệp / Tenant</label>
              <select
                value={createForm.tenantId}
                onChange={e => setCreateForm({ ...createForm, tenantId: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="">-- Không chỉ định (tạo độc lập) --</option>
                {tenants.map((t: any) => (
                  <option key={t.tenantId} value={t.tenantId}>{t.companyName || t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 2: CHỈNH SỬA & PHÂN QUYỀN LẠI ─── */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Cập nhật & Phân quyền: ${selectedUser?.fullName}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-800 font-bold mb-1">Họ và tên *</label>
            <Input
              required
              value={editForm.fullName}
              onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">Email đăng nhập (Cố định)</label>
              <Input disabled value={selectedUser?.email || ''} className="bg-slate-100 text-slate-500" />
            </div>
            <div>
              <label className="block text-slate-800 font-bold mb-1">Số điện thoại</label>
              <Input
                placeholder="0912345678"
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1.5">Phân quyền Vai trò (Role) *</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    editForm.role === r.value
                      ? 'border-[#119653] bg-emerald-50/50 ring-1 ring-[#119653]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="editRole"
                    value={r.value}
                    checked={editForm.role === r.value}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="mt-0.5 text-[#119653] focus:ring-[#119653]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <r.icon size={13} className="text-[#119653]" />
                      <span>{r.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">Trạng thái tài khoản *</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Active">Đang hoạt động (Active)</option>
                <option value="Locked">Đã bị khóa (Locked)</option>
                <option value="Disabled">Vô hiệu hóa (Disabled)</option>
              </select>
            </div>

            {tenants.length > 0 && (
              <div>
                <label className="block text-slate-800 font-bold mb-1">Doanh nghiệp / Tenant</label>
                <select
                  value={editForm.tenantId}
                  onChange={e => setEditForm({ ...editForm, tenantId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="">-- Không thuộc Tenant --</option>
                  {tenants.map((t: any) => (
                    <option key={t.tenantId} value={t.tenantId}>{t.companyName || t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 3: ĐẶT LẠI MẬT KHẨU ─── */}
      <Modal isOpen={isResetPassOpen} onClose={() => setIsResetPassOpen(false)} title={`Đặt lại mật khẩu cho: ${selectedUser?.fullName}`}>
        <form onSubmit={handleResetPassSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            Tài khoản: <strong className="text-slate-900">{selectedUser?.email}</strong>
            <p className="text-[11px] text-slate-500 mt-1">
              Sau khi đặt lại, người dùng sẽ sử dụng mật khẩu mới này để đăng nhập vào hệ thống.
            </p>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Mật khẩu mới *</label>
            <Input
              required
              type="password"
              placeholder="Tối thiểu 8 ký tự, gồm chữ hoa, thường, số và ký tự đặc biệt"
              value={resetPassForm.newPassword}
              onChange={e => setResetPassForm({ ...resetPassForm, newPassword: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Xác nhận mật khẩu mới *</label>
            <Input
              required
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={resetPassForm.confirmPassword}
              onChange={e => setResetPassForm({ ...resetPassForm, confirmPassword: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsResetPassOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang đổi...' : 'Xác nhận đặt lại'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 4: XÁC NHẬN XÓA TÀI KHOẢN ─── */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Xác nhận xóa tài khoản">
        <div className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert size={18} className="text-rose-600" />
              <span>Hành động không thể hoàn tác!</span>
            </div>
            <p>
              Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản <strong>{selectedUser?.fullName}</strong> ({selectedUser?.email})?
            </p>
            <p className="text-[11px] text-rose-700">
              Mọi quyền truy cập và phiên đăng nhập của người dùng này sẽ bị hủy bỏ ngay lập tức.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="danger" disabled={isSubmitting} onClick={handleDeleteSubmit}>
              {isSubmitting ? 'Đang xóa...' : 'Xác nhận Xóa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
