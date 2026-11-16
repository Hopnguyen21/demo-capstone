import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { UserRole } from '../../types';
import {
  Sprout, ShieldCheck, ArrowRight, KeyRound,
  Mail, AlertCircle, Loader2, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { extractApiError } from '../../services';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  useEffect(() => {
    const state = location.state as { registeredEmail?: string; message?: string } | null;
    if (state?.registeredEmail) {
      setEmail(state.registeredEmail);
      setPassword('');
      setSuccessMessage('Đăng ký tài khoản thành công! Hãy nhập mật khẩu của bạn để đăng nhập.');
    } else if (state?.message) {
      setSuccessMessage(state.message);
    }
  }, [location.state]);

  const navigateForRole = (role: UserRole) => {
    switch (role) {
      case 'PLATFORM_ADMIN': navigate('/admin/dashboard'); break;
      case 'PLATFORM_TECHNICIAN': navigate('/technician/dashboard'); break;
      case 'FARM_OWNER': navigate('/owner/dashboard'); break;
      case 'FARMER': navigate('/farmer/home'); break;
      default: navigate('/owner/dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const loggedUser = await login(email, password);
      navigateForRole(loggedUser.role);
    } catch (err) {
      setErrorMessage(extractApiError(err) || 'Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-4 bg-slate-900 overflow-hidden">
      {/* Background landscape image with subtle dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url('/login-bg.jpg')` }}
      />
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-4xl grid md:grid-cols-2 bg-white/95 backdrop-blur-md border border-white/40 rounded-3xl shadow-2xl overflow-hidden text-slate-800 ring-1 ring-black/10">
        {/* Left column: Branding & Feature summary */}
        <div className="p-5 sm:p-8 bg-gradient-to-br from-[#119653] via-emerald-700 to-emerald-800 text-white flex flex-col justify-between border-b md:border-b-0 md:border-r border-emerald-600/40">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all select-none group" title="Về trang chủ">
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/20 border border-white/30 text-white backdrop-blur-xs shrink-0 group-hover:bg-white/25 transition-colors">
                <Sprout size={24} className="sm:w-7 sm:h-7" />
              </div>
              <span className="font-bold text-lg sm:text-xl tracking-tight text-white">SmartFarm SaaS</span>
            </Link>

            <h1 className="mt-4 sm:mt-8 text-xl sm:text-2xl font-bold text-white leading-tight">
              Nền tảng Quản lý Nông nghiệp Thông minh Tích hợp AI
            </h1>
            <p className="mt-2 sm:mt-3 text-xs text-emerald-100/90 leading-relaxed">
              Giải pháp SaaS đa người thuê (Multi-tenant) kết hợp viễn thám LoRa 433MHz, tự động hóa điều khiển vi khí hậu thích ứng theo thời kỳ sinh trưởng và Trợ lý AI Nông học Gemini.
            </p>

            <div className="mt-4 sm:mt-8 space-y-2.5 sm:space-y-3 hidden sm:block">
              <div className="flex items-center gap-2.5 text-xs text-emerald-100">
                <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
                <span>Bảo mật Tenant Isolation chuẩn PostgreSQL RLS</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-100">
                <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
                <span>Cơ chế Crop-aware điều khiển vi khí hậu thông minh</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-100">
                <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
                <span>Tư vấn Nông học AI RAG chuẩn VietGAP/GlobalGAP</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-emerald-600/40 text-[11px] text-emerald-200/80">
            SmartFarm Enterprise Platform &copy; 2026. All rights reserved.
          </div>
        </div>

        {/* Right column: Form & Quick Role Switcher */}
        <div className="p-8 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Đăng nhập Hệ thống</h2>
                <p className="text-xs text-slate-500 mt-0.5">Nhập tài khoản của bạn để truy cập Workspace</p>
              </div>
              <Link
                to="/register"
                className="text-xs font-semibold text-[#119653] hover:underline"
              >
                Đăng ký ngay
              </Link>
            </div>

            {successMessage && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#119653]" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email / Tên đăng nhập</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs"
                    placeholder="tenban@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mật khẩu</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 text-xs"
                    placeholder="Mật khẩu của bạn..."
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

              <div className="flex items-center justify-between text-xs text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded bg-slate-100 border-slate-300 text-[#119653] focus:ring-0" />
                  <span>Ghi nhớ</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-amber-700 font-semibold hover:underline hover:text-amber-800"
                  >
                    Quên mật khẩu?
                  </button>
                  <span className="text-slate-300">•</span>
                  <Link to="/register" className="text-[#119653] font-medium hover:underline">
                    Đăng ký?
                  </Link>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2 bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 py-2.5 shadow-md shadow-emerald-700/20">
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Đang xác thực...
                  </>
                ) : (
                  <>
                    Đăng nhập ngay <ArrowRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            </form>
          </div>


        </div>
      </div>
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccessReset={(resetEmail) => {
          setEmail(resetEmail);
          setPassword('');
          setSuccessMessage('Đặt lại mật khẩu thành công! Hãy nhập mật khẩu mới để đăng nhập.');
        }}
      />
    </div>
  );
};
