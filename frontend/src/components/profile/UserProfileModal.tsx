import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Building2, CheckCircle2, AlertTriangle, Lock, KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input, Modal } from '../ui/BaseUI';
import { userService, extractApiError } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PASSWORD'>('PROFILE');

  // Profile state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(user?.role || '');
  const [email, setEmail] = useState(user?.email || '');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
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
        phone: trimmedPhone || null,
      });

      updateCurrentUser({
        fullName: updated.fullName,
        phone: updated.phone || undefined,
      });

      setSuccess('Cập nhật hồ sơ cá nhân thành công!');
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(`Lỗi cập nhật: ${extractApiError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    try {
      setChangingPassword(true);
      setError(null);
      setSuccess(null);

      const res = await userService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setSuccess(res.message || 'Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(null);
      }, 3500);
    } catch (err) {
      setError(`Lỗi đổi mật khẩu: ${extractApiError(err)}`);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hồ Sơ Cá Nhân &amp; Tài Khoản">
      <div className="space-y-4 text-xs">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('PROFILE'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs border-b-2 transition-colors ${
              activeTab === 'PROFILE'
                ? 'border-[#119653] text-[#119653]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={14} />
            <span>Thông Tin Cá Nhân</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('PASSWORD'); setError(null); setSuccess(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs border-b-2 transition-colors ${
              activeTab === 'PASSWORD'
                ? 'border-[#119653] text-[#119653]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound size={14} />
            <span>Đổi Mật Khẩu</span>
          </button>
        </div>

        {loading && (
          <div className="p-3 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-[#119653]" />
            <span>Đang tải dữ liệu hồ sơ...</span>
          </div>
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

        {activeTab === 'PROFILE' ? (
          <form onSubmit={handleUpdateProfile} className="space-y-3.5">
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
              <Button type="submit" disabled={saving || loading} className="bg-[#119653] hover:bg-[#0e8046] text-white font-bold flex items-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />}
                <span>{saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Mật khẩu hiện tại <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại..."
                  className="pl-9 pr-9 text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số..."
                  className="pl-9 pr-9 text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="pl-9 pr-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose} disabled={changingPassword}>
                Đóng
              </Button>
              <Button type="submit" disabled={changingPassword} className="bg-[#119653] hover:bg-[#0e8046] text-white font-bold flex items-center gap-1.5">
                {changingPassword && <Loader2 size={14} className="animate-spin" />}
                <span>{changingPassword ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
