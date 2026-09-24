import React, { useState } from 'react';
import { mockUsers } from '../../mocks/mockData';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Users, Plus, Search, ShieldCheck, Mail, Phone } from 'lucide-react';
import { UserRole } from '../../types';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState(mockUsers);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', username: '', role: 'FARM_OWNER' as UserRole });

  const filtered = users.filter(u => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      userId: `user-${Date.now()}`,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    };
    setUsers([created, ...users]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-[#062326]" size={22} /> Quản lý Tài khoản & Phân quyền Hệ thống
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách người dùng trên toàn hệ thống bao gồm Admin, Kỹ thuật viên, Farm Owner và Công nhân.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Tạo Tài khoản Mới
        </Button>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm theo tên hoặc email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-slate-500">Tổng số: {filtered.length} tài khoản</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <th className="p-4">Họ và tên</th>
              <th className="p-4">Tên đăng nhập</th>
              <th className="p-4">Vai trò (Role)</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Đăng nhập gần nhất</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
            {filtered.map(u => (
              <tr key={u.userId} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 font-semibold text-slate-900">
                  <div>{u.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-normal">{u.email}</div>
                </td>
                <td className="p-4 font-mono text-slate-600">@{u.username}</td>
                <td className="p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-[#062326] border border-slate-200">
                    <ShieldCheck size={12} className="mr-1 text-[#062326]" /> {u.role}
                  </span>
                </td>
                <td className="p-4"><StatusBadge status={u.status} /></td>
                <td className="p-4 text-slate-500">{u.lastLoginAt || 'Chưa đăng nhập'}</td>
                <td className="p-4 text-right space-x-2">
                  <button className="text-[#062326] font-medium hover:underline">Sửa</button>
                  <button className="text-rose-600 font-medium hover:underline">Khóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tạo Tài khoản Mới">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Họ và tên</label>
            <Input required value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <Input type="email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@smartfarm.vn" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
            <Input required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="user123" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vai trò hệ thống</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-[#062326] focus:ring-1 focus:ring-[#062326] shadow-xs"
            >
              <option value="PLATFORM_ADMIN">Platform Admin</option>
              <option value="PLATFORM_TECHNICIAN">Platform Technician</option>
              <option value="FARM_OWNER">Farm Owner</option>
              <option value="FARMER">Farmer / Farm Worker</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Xác nhận tạo</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
