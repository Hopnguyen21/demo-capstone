import React, { useState } from 'react';
import { Mail, KeyRound, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Button, Input, Modal } from '../ui/BaseUI';
import { authService, extractApiError } from '../../services';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessReset?: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, onSuccessReset }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setDemoOtpHint(null);
    setStep(1);
    onClose();
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email tài khoản.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setDemoOtpHint(null);

    try {
      const res = await authService.forgotPassword(trimmedEmail);
      setSuccess(res.message || 'Mã OTP đã được gửi đến email của bạn.');
      if (res.demoOtp) {
        setDemoOtpHint(res.demoOtp);
        setOtp(res.demoOtp); // Auto-fill for convenience in Demo
      }
      setStep(2);
    } catch (err: any) {
      setError(extractApiError(err) || 'Không thể tạo mã xác thực. Vui lòng kiểm tra lại email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Vui lòng nhập mã xác thực OTP.');
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

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authService.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      setSuccess(res.message || 'Đặt lại mật khẩu thành công!');
      setTimeout(() => {
        if (onSuccessReset) onSuccessReset(email.trim());
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(extractApiError(err) || 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quên & Đặt Lại Mật Khẩu">
      <div className="space-y-4 text-xs">
        {/* Step indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 1 ? 'bg-[#119653] text-white' : 'bg-emerald-100 text-[#119653]'
            }`}>
              1
            </span>
            <span className={`font-semibold ${step === 1 ? 'text-slate-900' : 'text-slate-400'}`}>
              Nhập Email
            </span>
          </div>
          <div className="h-0.5 w-12 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 2 ? 'bg-[#119653] text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              2
            </span>
            <span className={`font-semibold ${step === 2 ? 'text-slate-900' : 'text-slate-400'}`}>
              Nhập OTP & Đặt Mật Khẩu
            </span>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {demoOtpHint && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck size={15} className="text-amber-600" />
              Mã OTP Demo tạo tự động:
            </span>
            <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-700">
              {demoOtpHint}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Email tài khoản đã đăng ký <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenban@example.com"
                  className="pl-9 text-xs"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Hệ thống sẽ tạo mã OTP xác thực có hiệu lực trong 15 phút.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Đóng
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                <span>Nhận Mã OTP Tiếp Tục</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold">
                  Mã xác thực OTP (6 chữ số) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[11px] text-[#119653] hover:underline flex items-center gap-1"
                >
                  <ArrowLeft size={12} /> Đổi email ({email})
                </button>
              </div>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Ví dụ: 123456"
                className="font-mono text-center tracking-widest text-sm font-bold"
                required
                maxLength={6}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số..."
                  className="pl-9 pr-9 text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Nhập lại mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại chính xác mật khẩu mới..."
                  className="pl-9 pr-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={loading}>
                <ArrowLeft size={13} className="mr-1" /> Quay Lại
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                <span>Xác Nhận Đặt Lại Mật Khẩu</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

