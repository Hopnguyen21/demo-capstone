import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sprout, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight,
  Radio, Cpu, Droplets, Sun, Activity, Bot, MapPin, Layers,
  FileText, Award, Phone, Mail, Sparkles, ExternalLink, Play,
  BarChart3, Check, Globe, HelpCircle, Users, ArrowUpRight
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'iot' | 'gis' | 'ai' | 'contract'>('iot');
  const [consultModal, setConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({ name: '', phone: '', farmArea: '', province: 'Lâm Đồng' });
  const [consultSuccess, setConsultSuccess] = useState(false);

  const handleConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConsultSuccess(true);
    setTimeout(() => {
      setConsultSuccess(false);
      setConsultModal(false);
      setConsultForm({ name: '', phone: '', farmArea: '', province: 'Lâm Đồng' });
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────── */}
      {/* 1. TOP ANNOUNCEMENT BAR                                     */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#062326] via-[#093d39] to-[#062326] text-emerald-200 text-xs py-2 px-4 border-b border-emerald-900/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              Mới 2026
            </span>
            <span className="truncate">
              Khởi tạo Nông trang số hóa chuẩn VietGAP & Tích hợp Trợ lý AI Gemini Nông học chuyên sâu.
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-emerald-300">
            <span className="flex items-center gap-1"><Phone size={12} /> Hotline hỗ trợ: 1900 6899</span>
            <span>•</span>
            <span className="flex items-center gap-1"><ShieldCheck size={12} /> Bảo hành phần cứng LoRa 24 tháng</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 2. STICKY GLASSMORPHIC HEADER NAVIGATION                     */}
      {/* ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-emerald-100 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#062326] to-[#0d5045] flex items-center justify-center text-emerald-400 shadow-md shadow-[#062326]/20 group-hover:scale-105 transition-transform">
              <Sprout size={24} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-[#062326]">SmartFarm</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-[#062326] border border-emerald-300">
                  IoT
                </span>
              </div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-700 block -mt-0.5">
                Nông nghiệp số công nghệ cao
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-700">
            <a href="#solutions" className="hover:text-[#062326] transition-colors">Giải pháp</a>
            <a href="#hardware" className="hover:text-[#062326] transition-colors">Thiết bị LoRa</a>
            <a href="#vietgap" className="hover:text-[#062326] transition-colors">Quy trình VietGAP</a>
            <a href="#workflow" className="hover:text-[#062326] transition-colors">Triển khai GIS</a>
            <a href="#testimonials" className="hover:text-[#062326] transition-colors">Khách hàng</a>
          </nav>

          {/* Action Buttons: Đăng nhập, Đăng ký, Đăng ký ngay */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              to="/login"
              className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-[#062326] hover:bg-slate-100 rounded-xl transition-all border border-transparent"
              id="btn-login-nav"
            >
              Đăng nhập
            </Link>

            <Link
              to="/register"
              className="hidden sm:inline-flex px-4 py-2 text-xs sm:text-sm font-bold text-[#062326] bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition-all"
              id="btn-register-nav"
            >
              Đăng ký
            </Link>

            <Link
              to="/register"
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#062326] via-[#0b4840] to-[#047857] hover:opacity-95 rounded-xl shadow-md shadow-[#062326]/20 transition-all transform hover:-translate-y-0.5 flex items-center gap-1.5"
              id="btn-register-now-nav"
            >
              <span>Đăng ký ngay</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 3. HERO SECTION WITH BANNER.JPG                              */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-emerald-50/60 via-[#f8faf9] to-[#f8faf9]">
        {/* Decorative background grid and blurs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-300/10 via-amber-200/10 to-teal-400/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Asian Cultural & High-Tech Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-emerald-200/90 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-xs font-bold text-[#062326] tracking-wide">
                  HỆ THỐNG QUẢN TRỊ NÔNG NGHIỆP THÔNG MINH SỐ 1
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Chuẩn VietGAP
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-slate-900 leading-[1.18] tracking-tight">
                Kiến tạo Nông trang số{' '}
                <span className="bg-gradient-to-r from-[#062326] via-[#047857] to-emerald-600 bg-clip-text text-transparent">
                  Tự động hóa Vi khí hậu
                </span>{' '}
                & Quản trị IoT Thực địa
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                Nền tảng Cloud SaaS đồng bộ trạm cảm biến LoRa tầm xa, bản đồ vệ tinh GIS, rơ-le tưới nhỏ giọt tự động và Trợ lý AI nông học chuyên biệt cho các Hợp tác xã & Nhà vườn hiện đại.
              </p>

              {/* Action Buttons Group */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/register"
                  className="px-7 py-3.5 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-[#062326] via-[#09433d] to-[#047857] hover:brightness-110 rounded-2xl shadow-lg shadow-[#062326]/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                  id="btn-hero-register-now"
                >
                  <Sparkles size={18} className="text-amber-300" />
                  <span>Đăng ký ngay</span>
                  <ArrowRight size={18} />
                </Link>

                <Link
                  to="/login"
                  className="px-6 py-3.5 text-sm sm:text-base font-bold text-[#062326] bg-white hover:bg-emerald-50 rounded-2xl border-2 border-[#062326]/20 transition-all flex items-center gap-2"
                  id="btn-hero-login"
                >
                  <span>Đăng nhập</span>
                  <ExternalLink size={16} />
                </Link>

                <button
                  type="button"
                  onClick={() => setConsultModal(true)}
                  className="px-5 py-3.5 text-sm font-semibold text-emerald-800 hover:text-[#062326] hover:bg-emerald-100/60 rounded-2xl transition-all flex items-center gap-2"
                >
                  <Phone size={16} />
                  <span>Yêu cầu tư vấn thiết bị</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-4 max-w-xl text-left">
                <div>
                  <div className="text-2xl font-black text-[#062326] font-mono">500+</div>
                  <div className="text-xs font-medium text-slate-500">Hecta chuẩn hóa</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#062326] font-mono">99.9%</div>
                  <div className="text-xs font-medium text-slate-500">Thời gian Uptime</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#062326] font-mono">-35%</div>
                  <div className="text-xs font-medium text-slate-500">Chi phí nước & phân</div>
                </div>
              </div>
            </div>

            {/* Right Hero Image Card using banner.jpg */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Glowing decorative backdrop */}
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-amber-500/20 rounded-3xl blur-xl" />

                {/* Main Card with Banner Image */}
                <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-300/80 shadow-2xl bg-white">
                  <div className="relative h-80 sm:h-96 w-full overflow-hidden group">
                    <img
                      src="/banner.jpg"
                      alt="Hệ thống tưới nhỏ giọt thông minh SmartFarm IoT"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    />
                    {/* Asian-themed emerald gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#062326]/90 via-[#062326]/20 to-transparent" />

                    {/* Badge on top of image */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#062326]/80 text-white backdrop-blur-md border border-emerald-400/30 flex items-center gap-1.5">
                        <Droplets size={14} className="text-emerald-400" /> Hệ thống tưới nhỏ giọt tự động
                      </span>
                    </div>

                    {/* Bottom overlay info */}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-300 font-mono font-semibold">TRANG TRẠI THỰC ĐỊA #01</div>
                          <div className="text-lg font-bold">Vườn Cà Chua Công Nghệ Cao Đà Lạt</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-xs font-bold">
                          Online 24/7
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time stats bar right below image */}
                  <div className="p-4 bg-white grid grid-cols-3 divide-x divide-slate-100 text-center">
                    <div>
                      <div className="text-[11px] text-slate-500">Độ ẩm đất</div>
                      <div className="text-sm font-bold text-emerald-700 font-mono">68.4%</div>
                      <span className="text-[10px] text-emerald-600 font-medium">✓ Đạt chuẩn</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Nhiệt độ KK</div>
                      <div className="text-sm font-bold text-slate-800 font-mono">24.5°C</div>
                      <span className="text-[10px] text-slate-600 font-medium">Tối ưu</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Trạng thái Bơm</div>
                      <div className="text-sm font-bold text-sky-700 font-mono">AUTO ON</div>
                      <span className="text-[10px] text-sky-600 font-medium">Van #1 (12p)</span>
                    </div>
                  </div>
                </div>

                {/* Floating Widget 1: AI Recommendation */}
                <div className="absolute -bottom-6 -left-4 sm:-left-8 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-emerald-200/90 max-w-xs text-left animate-bounce-subtle hidden sm:block">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#062326]">
                      <Bot size={14} />
                    </div>
                    <span className="text-xs font-bold text-[#062326]">Trợ lý AI Nông học VietGAP</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    "Thời tiết chiều nay hanh khô, hệ thống đã tự động bù ẩm 15 phút bảo vệ rễ non."
                  </p>
                </div>

                {/* Floating Widget 2: LoRa Signal */}
                <div className="absolute -top-4 -right-2 sm:-right-6 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-emerald-200/90 text-left hidden sm:flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <div className="text-[11px] font-bold text-[#062326]">LoRa Mesh Gateway</div>
                    <div className="text-[10px] text-slate-500 font-mono">Bán kính phủ sóng 2.5km</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 4. KEY METRICS HIGHLIGHT RIBBON                              */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#062326] text-white py-10 border-y border-[#0c3c38]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-emerald-800/60">
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">1,200+</div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-100 mt-1">Trạm Cảm Biến & Node LoRa</div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5">Thời lượng pin 3 năm liên tục</div>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">150+</div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-100 mt-1">Hợp Tác Xã & Doanh Nghiệp</div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5">Trên 18 tỉnh thành toàn quốc</div>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-teal-300 font-mono">1.4M+</div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-100 mt-1">Bản Ghi Vi Khí Hậu / Ngày</div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5">Xử lý TimescaleDB Hypertable</div>
            </div>
            <div className="pt-4 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black text-emerald-300 font-mono">100%</div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-100 mt-1">Hợp Đồng & Nghiệm Thu Số</div>
              <div className="text-[11px] text-emerald-400/80 mt-0.5">Tạm ứng 30% - Hoàn tất 70%</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 5. ECOSYSTEM FEATURE CARDS (ASIAN-TAILORED VISUAL GRID)      */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section id="solutions" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold font-mono text-[#062326] uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300">
              Hệ sinh thái Nông nghiệp Toàn diện
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Mọi công cụ cần thiết cho Nhà vườn số hóa
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Tích hợp chặt chẽ từ phần cứng cảm biến, bản đồ địa không gian GIS đến hồ sơ sinh trưởng cây trồng VietGAP và trợ lý AI thông minh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {/* Feature 1: GIS Map */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-[#062326] text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MapPin size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Bản đồ Vệ tinh GIS Đa tầng</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Phân cấp không gian chính xác từ Nông trang ➔ Thửa đất (Field) ➔ Khu vực (Zone). Vẽ ranh giới Polygon thực địa và tự động tính toán diện tích m².
              </p>
              <div className="flex items-center text-xs font-bold text-[#062326] group-hover:translate-x-1 transition-transform">
                <span>Khám phá tính năng GIS</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Feature 2: LoRa IoT & Hardware */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-800 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Radio size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Trạm ESP32 LoRa & Cảm biến RS485</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Thu thập chỉ số độ ẩm đất, nhiệt độ, pH, EC, cường độ ánh sáng và độ ẩm không khí theo chu kỳ 60 giây qua sóng LoRa khoảng cách đến 2km.
              </p>
              <div className="flex items-center text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform">
                <span>Chi tiết phần cứng</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Feature 3: Auto Microclimate CF3 */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Droplets size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Tự động hóa Vi khí hậu & Lịch Cron</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Bộ luật IF-THEN tự động bảo vệ cây trồng: bật tưới khi ẩm đất &lt; 60%, ngắt quạt khi lạnh, cùng nút Dừng khẩn cấp (Emergency Stop) 1 chạm.
              </p>
              <div className="flex items-center text-xs font-bold text-teal-800 group-hover:translate-x-1 transition-transform">
                <span>Trạm điều khiển CF3</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Feature 4: Crop-Aware Growth Profiles */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-700 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sprout size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hồ sơ Sinh trưởng 4 Tầng</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Cơ chế Crop-aware độc quyền: Cây trồng ➔ Giống ➔ Hồ sơ sinh trưởng ➔ Giai đoạn. Tự điều chỉnh ngưỡng vi khí hậu theo từng ngày tuổi.
              </p>
              <div className="flex items-center text-xs font-bold text-amber-700 group-hover:translate-x-1 transition-transform">
                <span>Thư viện cây trồng</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Feature 5: AI Agronomist Gemini */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-900 text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bot size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Trợ lý AI Nông học Gemini</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Tích hợp AI RAG chẩn đoán bệnh cây qua hình ảnh thực địa, đề xuất lịch bón phân và cảnh báo rủi ro thời tiết cực đoan trước 24 giờ.
              </p>
              <div className="flex items-center text-xs font-bold text-indigo-900 group-hover:translate-x-1 transition-transform">
                <span>Trải nghiệm AI Demo</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Feature 6: Electronic Quotation & Contract */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-200/80 shadow-xs hover:border-[#062326] hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Báo giá & Ký Hợp đồng Điện tử</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Kỹ thuật viên khảo sát thực địa, xuất báo giá phần cứng chi tiết, ký hợp đồng điện tử online và nghiệm thu bàn giao 2 pha minh bạch.
              </p>
              <div className="flex items-center text-xs font-bold text-slate-800 group-hover:translate-x-1 transition-transform">
                <span>Quy trình ký số</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 6. HARDWARE & FIELD PROVISIONING SHOWCASE                   */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section id="hardware" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Visual Hardware Specs Left */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold font-mono text-emerald-800 uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300">
                Phần cứng LoRa chuẩn công nghiệp
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Trạm Gateway & Cảm biến Bền bỉ Ngoài trời
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Được thiết kế chuyên biệt cho điều kiện nông nghiệp Việt Nam chịu được nắng mưa nhiệt đới gió mùa, chuẩn kháng nước IP67 và pin năng lượng mặt trời.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#062326] flex items-center justify-center shrink-0">
                    <Radio size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Central LoRa Gateway ESP32-S3 Dual Antenna</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Kết nối đến 128 sensor node thực địa trong bán kính 2.5km không cần kéo dây mạng.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#062326] flex items-center justify-center shrink-0">
                    <Droplets size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Đầu dò Đất RS485 Modbus 3-trong-1</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Đo chính xác độ ẩm đất, nhiệt độ đất và độ dẫn điện EC, chống ăn mòn hóa chất phân bón.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#062326] flex items-center justify-center shrink-0">
                    <Sun size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Trạm Vi khí hậu SHT30 & Ánh sáng Lux</h4>
                    <p className="text-xs text-slate-600 mt-0.5">Giám sát vi khí hậu nhà màng liên tục, tự động phát hiện sốc nhiệt và nguy cơ nấm bệnh.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Interactive Hardware Display */}
            <div className="lg:col-span-6">
              <div className="p-6 rounded-3xl bg-[#062326] text-white shadow-2xl border border-emerald-900/60 relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-emerald-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold font-mono">BẢNG TỔNG QUAN THỰC ĐỊA LORA</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-300">ESP32 Firmware v2.6</span>
                </div>

                <div className="grid grid-cols-2 gap-4 my-6">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-emerald-300">RSSI Tín hiệu sóng</div>
                    <div className="text-2xl font-bold font-mono mt-1">-68 dBm</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">Tín hiệu Cực mạnh</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-emerald-300">Pin Lithium dự phòng</div>
                    <div className="text-2xl font-bold font-mono mt-1">94%</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">Năng lượng mặt trời</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-emerald-300">Chu kỳ gửi dữ liệu</div>
                    <div className="text-2xl font-bold font-mono mt-1">60s</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">Realtime TimescaleDB</span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-emerald-300">Rơ-le đóng ngắt</div>
                    <div className="text-2xl font-bold font-mono mt-1">4 Cổng</div>
                    <span className="text-[10px] text-emerald-400 font-semibold">Bảo vệ Optocoupler</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs">
                  <span className="text-emerald-300">Cần tư vấn triển khai phần cứng cho nông trang?</span>
                  <button
                    onClick={() => setConsultModal(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#062326] font-bold transition-colors"
                  >
                    Báo giá ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 7. STEP-BY-STEP WORKFLOW (TRIỂN KHAI 4 BƯỚC)                */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono text-[#062326] uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300">
              Quy trình vận hành chuẩn mực
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Từ Khảo sát Thực địa đến Thu hoạch Năng suất cao
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Mọi bước triển khai đều được số hóa, minh bạch hợp đồng và bảo đảm kết quả nghiệm thu trước khi bàn giao.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative">
              <span className="text-3xl font-black text-emerald-300 font-mono">01</span>
              <h3 className="text-base font-bold text-slate-900 mt-2 mb-1.5">Khảo sát & Chấm GIS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Kỹ thuật viên đến hiện trường, đo đạc ranh giới và chấm tọa độ các trạm Gateway & Node LoRa trên bản đồ số.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative">
              <span className="text-3xl font-black text-emerald-300 font-mono">02</span>
              <h3 className="text-base font-bold text-slate-900 mt-2 mb-1.5">Ký Số & Tạm ứng 30%</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Xuất bảng báo giá chi tiết, Owner ký hợp đồng điện tử và thực hiện thanh toán tạm ứng 30% để triển khai.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative">
              <span className="text-3xl font-black text-emerald-300 font-mono">03</span>
              <h3 className="text-base font-bold text-slate-900 mt-2 mb-1.5">Lắp đặt & Provisioning</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Kỹ thuật viên cấu hình trạm ESP32, kiểm thử kết nối telemetry và hiệu chuẩn cảm biến với đất thực tế.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-400 relative">
              <span className="text-3xl font-black text-emerald-600 font-mono">04</span>
              <h3 className="text-base font-bold text-[#062326] mt-2 mb-1.5">Nghiệm thu & Vận hành 70%</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chủ trang trại kiểm tra hệ thống tưới tự động hoạt động ổn định, ký biên bản nghiệm thu và thanh toán 70% còn lại.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 8. TESTIMONIALS (KHÁCH HÀNG & HTX VIỆT NAM)                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 bg-emerald-950 text-white border-t border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold font-mono text-emerald-300 uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-900/80 border border-emerald-700">
              Niềm tin từ các Nhà vườn & HTX
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
              Đồng hành cùng nền Nông nghiệp Bền vững
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                "Nhờ hệ thống tự động tưới nhỏ giọt kết hợp cảm biến đất LoRa, 8ha cà chua của chúng tôi tại Đơn Dương tiết kiệm được 40% chi phí nhân công và năng suất tăng 22%."
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-emerald-300">
                  NA
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Ông Nguyễn Văn An</div>
                  <div className="text-[11px] text-emerald-400">Giám đốc HTX Nông nghiệp Công nghệ cao Đà Lạt</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                "Quy trình số hóa bản đồ GIS và hồ sơ sinh trưởng rất chuẩn mực. Kỹ thuật viên hỗ trợ tận tình từ khâu khảo sát đến khi ký nghiệm thu hợp đồng điện tử."
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-emerald-300">
                  TH
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Bà Trần Thị Hoa</div>
                  <div className="text-[11px] text-emerald-400">Chủ trang trại Dưa lưới Organic Mộc Châu</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                "Trợ lý AI Nông học Gemini trả lời chẩn đoán bệnh lá và lịch tưới cực kỳ chính xác. Chúng tôi hoàn toàn yên tâm quản lý trang trại từ xa qua điện thoại."
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-emerald-300">
                  LM
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Kỹ sư Lê Minh Tuấn</div>
                  <div className="text-[11px] text-emerald-400">Quản lý Kỹ thuật Farm Đức Trọng FarmTech</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 9. BOTTOM CALL TO ACTION BANNER                             */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-[#062326] via-[#093e38] to-[#047857] text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 text-xs font-semibold border border-emerald-700/50">
            <Sparkles size={14} className="text-amber-400" /> Sẵn sàng bắt đầu mùa vụ thắng lợi mới?
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Nâng tầm Nông trang của bạn lên Kỷ nguyên Số ngay hôm nay
          </h2>

          <p className="text-emerald-100 text-sm sm:text-base max-w-2xl mx-auto">
            Đăng ký tài khoản miễn phí để khám phá trạm điều khiển IoT, lập lịch tưới tự động và nhận tư vấn khảo sát thực địa từ chuyên gia.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              to="/register"
              className="px-8 py-4 text-base font-bold text-[#062326] bg-amber-400 hover:bg-amber-300 rounded-2xl shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
              id="btn-footer-register-now"
            >
              <span>Đăng ký ngay</span>
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/login"
              className="px-8 py-4 text-base font-bold text-white bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 transition-all flex items-center gap-2 backdrop-blur-md"
              id="btn-footer-login"
            >
              <span>Đăng nhập</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 10. FOOTER                                                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#031315] text-slate-400 text-xs py-12 border-t border-[#092e2c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                  <Sprout size={18} />
                </div>
                <span className="text-base font-bold text-white">SmartFarm IoT</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Nền tảng Quản trị Nông nghiệp Thông minh & Tự động hóa Vi khí hậu chuẩn VietGAP hàng đầu Việt Nam.
              </p>
              <div className="text-[11px] text-slate-500">
                © 2026 SmartFarm Platform. Bản quyền thuộc về Đội ngũ Kỹ sư Công nghệ Nông nghiệp.
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Sản phẩm & Giải pháp</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#solutions" className="hover:text-emerald-400 transition-colors">Bản đồ vệ tinh GIS Nông trang</a></li>
                <li><a href="#hardware" className="hover:text-emerald-400 transition-colors">Trạm LoRa Gateway & Sensor Nodes</a></li>
                <li><a href="#solutions" className="hover:text-emerald-400 transition-colors">Bộ luật Tự động hóa CF3</a></li>
                <li><a href="#solutions" className="hover:text-emerald-400 transition-colors">Trợ lý AI Nông học Gemini</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Cổng Dịch vụ</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors">Cổng Chủ Trang Trại (Owner Portal)</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors">Cổng Kỹ Thuật Viên (Technician)</Link></li>
                <li><Link to="/login" className="hover:text-emerald-400 transition-colors">Cổng Quản Trị Hệ Thống (Admin)</Link></li>
                <li><Link to="/register" className="hover:text-emerald-400 transition-colors">Đăng ký Nông trang Mới</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Liên hệ & Hỗ trợ</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-emerald-400" />
                  <span>1900 6899 (8:00 - 20:00)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-emerald-400" />
                  <span>hotro@smartfarm.vn</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-400" />
                  <span>Đà Lạt, Lâm Đồng & TP. Hồ Chí Minh</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 11. QUICK CONSULTATION MODAL                                */}
      {/* ─────────────────────────────────────────────────────────── */}
      {consultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 text-left relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setConsultModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2 text-[#062326]">
              <Sprout size={22} />
              <h3 className="text-lg font-bold">Đăng ký Tư vấn & Khảo sát Thực địa</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Kỹ thuật viên sẽ liên hệ trong vòng 15 phút để tư vấn số lượng thiết bị LoRa và giải pháp phù hợp với diện tích trang trại của bạn.
            </p>

            {consultSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-emerald-900">Gửi thông tin thành công!</div>
                <p className="text-xs text-emerald-700">Kỹ thuật viên SmartFarm sẽ gọi lại cho bạn sớm nhất.</p>
              </div>
            ) : (
              <form onSubmit={handleConsultSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Họ và tên chủ trang trại / đại diện</label>
                  <input
                    required
                    placeholder="VD: Nguyễn Văn Nam"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#062326] outline-hidden"
                    value={consultForm.name}
                    onChange={e => setConsultForm({ ...consultForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Số điện thoại liên hệ (Zalo)</label>
                  <input
                    required
                    placeholder="VD: 0988 123 456"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#062326] outline-hidden"
                    value={consultForm.phone}
                    onChange={e => setConsultForm({ ...consultForm, phone: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Diện tích trang trại</label>
                    <input
                      placeholder="VD: 2.5 Hecta"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#062326] outline-hidden"
                      value={consultForm.farmArea}
                      onChange={e => setConsultForm({ ...consultForm, farmArea: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tỉnh / Thành phố</label>
                    <select
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#062326] outline-hidden bg-white"
                      value={consultForm.province}
                      onChange={e => setConsultForm({ ...consultForm, province: e.target.value })}
                    >
                      <option value="Lâm Đồng">Lâm Đồng (Đà Lạt)</option>
                      <option value="Đắk Lắk">Đắk Lắk</option>
                      <option value="Gia Lai">Gia Lai</option>
                      <option value="Sơn La">Sơn La (Mộc Châu)</option>
                      <option value="Đồng Nai">Đồng Nai</option>
                      <option value="Khác">Tỉnh thành khác</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#062326] to-[#047857] text-white font-bold text-xs hover:opacity-95 shadow-md shadow-[#062326]/20 transition-all"
                  >
                    Xác nhận gửi thông tin khảo sát
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
