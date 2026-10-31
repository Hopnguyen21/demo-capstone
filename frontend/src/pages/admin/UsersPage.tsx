import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { userService } from '../../services';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Users, Plus, Search, ShieldCheck, Mail, Phone } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = (users || []).filter(u => {
    if (!u) return false;
    const name = String(u.fullName || '').toLowerCase();
    const email = String(u.email || '').toLowerCase();
    const query = String(search || '').toLowerCase().trim();
    if (!query) return true;
    return name.includes(query) || email.includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-[#119653]" size={22} /> Quản lý Tài khoản & Phân quyền Hệ thống
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách người dùng trên toàn hệ thống bao gồm Admin, Kỹ thuật viên, Farm Owner và Công nhân.</p>
        </div>
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <ShieldCheck size={12} className="mr-1 text-[#119653]" /> {u.role}
                  </span>
                </td>
                <td className="p-4"><StatusBadge status={u.status} /></td>
                <td className="p-4 text-slate-500">{u.lastLoginAt || 'Chưa đăng nhập'}</td>
                <td className="p-4 text-right space-x-2">
                  <button className="text-[#119653] font-medium hover:underline">Sửa</button>
                  <button className="text-rose-600 font-medium hover:underline">Khóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
