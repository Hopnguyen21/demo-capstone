import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Building2, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { Button, Input, Modal } from '../ui/BaseUI';
import { userService, extractApiError } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateCurrentUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(user?.role || '');
  const [email, setEmail] = useState(user?.email || '');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);

    userService.getMe()
      .then((data: any) => {
        if (cancelled) return;
        setFullName(data.fullName || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setRole(data.role || '');
        setTenantId(data.tenantId || null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(`Không thể tải thông tin hồ sơ: ${extractApiError(err)}`);
        // Fallback to auth context
        if (user) {
          setFullName(user.fullName || '');
          setEmail(user.email || '');
          setRole(user.role || '');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      setError('Họ và tên bắt buộc và phải từ 2 đến 100 ký tự.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.length > 20) {
      setError('Số điện thoại không được vượt quá 20 ký tự.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await userService.updateProfile({
        fullName: trimmedName,
        phone: trimmedPhone || null
      });

      updateCurrentUser({
        fullName: updated.fullName,
        phone: updated.phone || undefined
      });

      setSuccess('Cập nhật hồ sơ cá nhân thành công!');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err) {
      setError(`Lỗi cập nhật: ${extractApiError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hồ Sơ Cá Nhân &amp; Tài Khoản">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {loading && (
          <div className="p-3 text-center text-slate-500">Đang tải dữ liệu hồ sơ...</div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Read-Only Account Info */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" /> Email đăng nhập
            </span>
            <div className="flex items-center gap-1 font-mono text-slate-700">
              <span>{email}</span>
              <span title="Email định danh không thể thay đổi"><Lock size={11} className="text-slate-400" /></span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Shield size={13} className="text-slate-400" /> Vai trò (Role)
            </span>
            <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-200/80 text-slate-800">
              {role}
            </span>
          </div>

          {tenantId && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400" /> Mã Tenant
              </span>
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]" title={tenantId}>
                {tenantId}
              </span>
            </div>
          )}
        </div>

        {/* Editable Fields */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ..."
                className="pl-9 text-xs"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Tên hiển thị trên toàn hệ thống và trong các tác vụ.</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Số điện thoại liên hệ
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ví dụ: 0912345678"
                className="pl-9 text-xs"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Dùng để liên hệ điều phối công việc và khẩn cấp.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button type="submit" disabled={saving || loading} className="bg-[#119653] hover:bg-[#0e8046] text-white">
            {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
