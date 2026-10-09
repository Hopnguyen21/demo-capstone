import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { extractApiError } from '../../services';
import {
  Sprout, ShieldCheck, ArrowRight, KeyRound, Mail,
  AlertCircle, Loader2, User as UserIcon, Phone,
  Eye, EyeOff, CheckCircle2, ChevronRight, Check
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'FarmOwner' | 'Farmer'>('FarmOwner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;
  const isMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage('Mật khẩu chưa đáp ứng đủ các yêu cầu bảo mật (tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt).');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách dịch vụ.');
      return;
    }

    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
      });

      setSuccess(true);
    } catch (err) {
      setErrorMessage(extractApiError(err) || 'Đăng ký tài khoản thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800">
        {/* Left column: Branding & Feature summary */}
        <div className="p-8 bg-[#062326] text-white flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#0d3b40]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                <Sprout size={28} />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight text-white block">SmartFarm SaaS</span>
                <span className="text-[10px] text-emerald-200/70 uppercase tracking-widest font-mono">Đăng ký tài khoản</span>
              </div>
            </div>

            <h1 className="mt-8 text-2xl font-bold text-white leading-tight">
              Khởi tạo Nông trang Công nghệ cao cùng SmartFarm
            </h1>
            <p className="mt-3 text-xs text-emerald-100/70 leading-relaxed">
              Giải pháp toàn diện quản lý hạ tầng IoT nông nghiệp, tự động hóa vi khí hậu và cố vấn nông học AI chuyên sâu dành riêng cho các mô hình nông trại hiện đại.
            </p>

            <div className="mt-8 space-y-3.5">
              <div className="flex items-start gap-3 text-xs text-emerald-100/90">
                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <span className="font-semibold block text-white">Kiến trúc Đa người thuê an toàn</span>
                  <span className="text-emerald-100/60 text-[11px]">Dữ liệu nông trang của bạn được phân vùng độc lập và bảo mật tuyệt đối.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs text-emerald-100/90">
                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <span className="font-semibold block text-white">Tự động hóa theo giai đoạn sinh trưởng</span>
                  <span className="text-emerald-100/60 text-[11px]">Hệ thống kích hoạt máy bơm, van tưới và quạt thông gió dựa trên ngưỡng vi khí hậu thực tế.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs text-emerald-100/90">
                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <span className="font-semibold block text-white">Trợ lý AI Nông học Gemini</span>
                  <span className="text-emerald-100/60 text-[11px]">Chẩn đoán sâu bệnh, tư vấn dinh dưỡng và tối ưu chi phí phân bón theo tiêu chuẩn VietGAP.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[#0d3b40] text-[11px] text-emerald-200/50 flex items-center justify-between">
            <span>SmartFarm Enterprise Platform &copy; 2026</span>
            <Link to="/login" className="text-emerald-300 hover:underline flex items-center gap-1">
              Đã có tài khoản? <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* Right column: Form */}
        <div className="p-8 flex flex-col justify-between bg-white overflow-y-auto max-h-[90vh]">
          {success ? (
            <div className="my-auto py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Đăng ký thành công!</h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Tài khoản <strong className="text-slate-900">{email}</strong> của bạn đã được khởi tạo thành công với vai trò{' '}
                <strong className="text-[#119653]">
                  {role === 'FarmOwner' ? 'Chủ nông trang (Farm Owner)' : 'Nông dân (Farmer)'}
                </strong>.
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => navigate('/login', { state: { registeredEmail: email } })}
                  className="w-full max-w-xs mx-auto bg-[#062326] hover:bg-[#093539] flex items-center justify-center gap-2"
                >
                  Đăng nhập ngay <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Đăng ký Tài khoản</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Điền thông tin để tạo tài khoản Workspace mới</p>
                </div>
                <Link
                  to="/login"
                  className="text-xs font-semibold text-[#119653] hover:underline"
                >
                  Đăng nhập
                </Link>
              </div>

              {errorMessage && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                {/* Full name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Địa chỉ Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="nongdan@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Số điện thoại liên hệ <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="tel"
                      placeholder="0912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                {/* Role selection */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Vai trò đăng ký <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('FarmOwner')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        role === 'FarmOwner'
                          ? 'border-[#119653] bg-emerald-50/70 text-emerald-950 ring-1 ring-[#119653]'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">Chủ Nông trang</span>
                        {role === 'FarmOwner' && <Check size={14} className="text-[#119653]" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Quản lý nông trại, thiết bị IoT, mùa vụ & nhân sự
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('Farmer')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        role === 'Farmer'
                          ? 'border-[#119653] bg-emerald-50/70 text-emerald-950 ring-1 ring-[#119653]'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">Nông dân / Nhân sự</span>
                        {role === 'Farmer' && <Check size={14} className="text-[#119653]" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Thực thi công việc thực địa, giám sát khu vực & tưới tiêu
                      </p>
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ít nhất 8 ký tự..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                  {/* Password requirements visual helper */}
                  {password.length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-1 text-[10px]">
                      <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        <Check size={11} className={hasMinLength ? 'text-emerald-600' : 'text-slate-300'} />
                        Tối thiểu 8 ký tự
                      </span>
                      <span className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        <Check size={11} className={hasUpper ? 'text-emerald-600' : 'text-slate-300'} />
                        Chữ hoa (A-Z)
                      </span>
                      <span className={`flex items-center gap-1 ${hasLower ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        <Check size={11} className={hasLower ? 'text-emerald-600' : 'text-slate-300'} />
                        Chữ thường (a-z)
                      </span>
                      <span className={`flex items-center gap-1 ${hasDigit && hasSpecial ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                        <Check size={11} className={hasDigit && hasSpecial ? 'text-emerald-600' : 'text-slate-300'} />
                        Chữ số & ký tự đặc biệt
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Xác nhận Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập lại mật khẩu..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 text-xs"
                      required
                    />
                  </div>
                  {confirmPassword.length > 0 && !isMatch && (
                    <p className="text-[11px] text-rose-500 mt-1">Mật khẩu xác nhận chưa khớp.</p>
                  )}
                </div>

                {/* Terms agreement */}
                <div className="pt-1">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="rounded mt-0.5 bg-slate-100 border-slate-300 text-[#062326] focus:ring-0"
                    />
                    <span>
                      Tôi đồng ý với{' '}
                      <a href="#terms" className="text-[#119653] font-medium hover:underline">
                        Điều khoản dịch vụ
                      </a>{' '}
                      và{' '}
                      <a href="#privacy" className="text-[#119653] font-medium hover:underline">
                        Chính sách bảo mật
                      </a>
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid || !isMatch || !agreeTerms}
                  className="w-full mt-3 bg-[#062326] hover:bg-[#093539] flex items-center justify-center gap-2 py-2.5"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Đang tạo tài khoản...
                    </>
                  ) : (
                    <>
                      Đăng ký tài khoản <ArrowRight size={16} className="ml-1" />
                    </>
                  )}
                </Button>
              </form>

              {/* Login link */}
              <div className="mt-5 text-center text-xs text-slate-500 border-t border-slate-100 pt-3">
                Đã có tài khoản?{' '}
                <Link to="/login" className="font-semibold text-[#062326] hover:underline">
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
