import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { UserRole } from '../../types';
import {
  Sprout, ShieldCheck, ArrowRight, UserCheck, KeyRound,
  Mail, AlertCircle, Loader2, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { extractApiError } from '../../services';

export const LoginPage: React.FC = () => {
  const { login, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('owner@smartfarm.demo');
  const [password, setPassword] = useState('Demo@12345');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleDevRoleLogin = async (targetRole: UserRole) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await switchRole(targetRole);
      navigateForRole(targetRole);
    } catch (err) {
      setErrorMessage(extractApiError(err) || 'Không thể chuyển đổi vai trò.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-800">
        {/* Left column: Branding & Feature summary */}
        <div className="p-8 bg-[#062326] text-white flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#0d3b40]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                <Sprout size={28} />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">SmartFarm SaaS</span>
            </div>

            <h1 className="mt-8 text-2xl font-bold text-white leading-tight">
              Nền tảng Quản lý Nông nghiệp Thông minh Tích hợp AI
            </h1>
            <p className="mt-3 text-xs text-emerald-100/70 leading-relaxed">
              Giải pháp SaaS đa người thuê (Multi-tenant) kết hợp viễn thám LoRa 433MHz, tự động hóa điều khiển vi khí hậu thích ứng theo thời kỳ sinh trưởng và Trợ lý AI Nông học Gemini.
            </p>

            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-2.5 text-xs text-emerald-100/90">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Bảo mật Tenant Isolation chuẩn PostgreSQL RLS</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-100/90">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Cơ chế Crop-aware điều khiển vi khí hậu thông minh</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-100/90">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>Tư vấn Nông học AI RAG chuẩn VietGAP/GlobalGAP</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[#0d3b40] text-[11px] text-emerald-200/50">
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
                  <input type="checkbox" defaultChecked className="rounded bg-slate-100 border-slate-300 text-[#062326] focus:ring-0" />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <Link to="/register" className="text-[#119653] font-medium hover:underline">
                  Tạo tài khoản mới?
                </Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2 bg-[#062326] hover:bg-[#093539] flex items-center justify-center gap-2 py-2.5">
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

          {/* Quick Role Selection for Frontend Evaluation */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
              <UserCheck size={14} className="text-[#062326]" /> Chuyển nhanh 4 Vai trò (Quick Dev Switch)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDevRoleLogin('PLATFORM_ADMIN')}
                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-left text-xs transition-all disabled:opacity-50"
              >
                <div className="font-semibold">1. Platform Admin</div>
                <div className="text-[10px] text-rose-600">Quản trị toàn sàn SaaS</div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDevRoleLogin('PLATFORM_TECHNICIAN')}
                className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-left text-xs transition-all disabled:opacity-50"
              >
                <div className="font-semibold">2. Technician</div>
                <div className="text-[10px] text-sky-600">Triển khai & Cấp phát IoT</div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDevRoleLogin('FARM_OWNER')}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-left text-xs transition-all disabled:opacity-50"
              >
                <div className="font-semibold">3. Farm Owner</div>
                <div className="text-[10px] text-emerald-600">Chủ Nông trang Tenant Root</div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDevRoleLogin('FARMER')}
                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-left text-xs transition-all disabled:opacity-50"
              >
                <div className="font-semibold">4. Farmer / Worker</div>
                <div className="text-[10px] text-amber-600">Công nhân thực địa</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
