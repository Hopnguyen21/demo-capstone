import React, { useState, useEffect } from 'react';
import { MetricCard, StatusBadge } from '../../components/ui/BaseUI';
import { tenantService, farmService, deviceService, adminService } from '../../services';
import { AuditLog } from '../../types';
import { Building2, Sprout, Radio, Cpu, Users, ShieldAlert, Activity, ArrowUpRight, FileCheck, BookOpen, CheckCircle2, FileText, Droplets, Thermometer } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const tenantGrowthData = [
  { month: 'T1', tenants: 12, farms: 28 },
  { month: 'T2', tenants: 15, farms: 34 },
  { month: 'T3', tenants: 19, farms: 45 },
  { month: 'T4', tenants: 24, farms: 58 },
  { month: 'T5', tenants: 30, farms: 72 },
  { month: 'T6', tenants: 38, farms: 95 },
];

export const AdminDashboard: React.FC = () => {
  const [tenantsCount, setTenantsCount] = useState(2);
  const [farmsCount, setFarmsCount] = useState(1);
  const [gatewaysCount, setGatewaysCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    tenantService.getTenants().then((data: any) => {
      if (Array.isArray(data)) setTenantsCount(data.length);
    }).catch((err: any) => console.error(err));

    farmService.getFarms().then((data: any) => {
      if (Array.isArray(data)) setFarmsCount(data.length);
    }).catch((err: any) => console.error(err));

    deviceService.getGateways().then((data: any) => {
      if (Array.isArray(data)) setGatewaysCount(data.length);
    }).catch((err: any) => console.error(err));

    adminService.getAuditLogs().then((data: any) => {
      if (Array.isArray(data)) setAuditLogs(data.slice(0, 5));
    }).catch((err: any) => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-200/80 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs font-mono font-semibold text-[#119653] uppercase tracking-wider">Bảng điều khiển Bổn mạng</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform Admin Management Console</h1>
          <p className="text-xs text-slate-600 mt-1">Quản trị toàn bộ hạ tầng SaaS Cloud, người thuê (Tenants) và thư viện Nông học hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status="ACTIVE" label="SaaS Platform Operational" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tổng người thuê (Tenants)"
          value={tenantsCount}
          unit="Tổ chức"
          subtext="+24% so với tháng trước"
          icon={<Building2 size={20} />}
          trend="up"
          trendValue="+8 mới"
        />
        <MetricCard
          title="Nông trang trên sàn"
          value={farmsCount}
          unit="Trang trại"
          subtext="Tổng diện tích 450 ha"
          icon={<Sprout size={20} />}
          trend="up"
          trendValue="+12%"
        />
        <MetricCard
          title="Gateway ESP32 LoRa"
          value={gatewaysCount}
          unit="Trạm"
          subtext="Tỷ lệ trực tuyến 98.4%"
          icon={<Radio size={20} />}
          trend="neutral"
          trendValue="Online"
        />
        <MetricCard
          title="Dữ liệu Cảm biến / Ngày"
          value="1.42M"
          unit="Readings"
          subtext="TimescaleDB Hypertable"
          icon={<Activity size={20} />}
          trend="up"
          trendValue="99.9% Uptime"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tăng trưởng Người thuê & Trang trại</h3>
              <p className="text-xs text-slate-500">Số lượng SaaS Tenants và Trang trại kích hoạt theo tháng</p>
            </div>
            <span className="text-xs text-[#119653] font-mono font-semibold">+185% YOY</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tenantGrowthData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="farms" stroke="#119653" fill="#119653" fillOpacity={0.15} name="Trang trại" />
                <Area type="monotone" dataKey="tenants" stroke="#0284c7" fill="#0284c7" fillOpacity={0.15} name="Tenants" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Resource Health Widget */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>Sức khỏe Hạ tầng Máy chủ</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-700 mb-1 font-medium">
                <span>EMQX MQTT Broker</span>
                <span className="text-emerald-800 font-mono font-bold">1,240 msg/s</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-[#119653] w-[42%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-700 mb-1 font-medium">
                <span>TimescaleDB Storage</span>
                <span className="text-sky-700 font-mono font-bold">42.8 GB / 500 GB</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-sky-500 w-[18%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-700 mb-1 font-medium">
                <span>PostgreSQL CPU Load</span>
                <span className="text-amber-700 font-mono font-bold">28% Load</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-amber-500 w-[28%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-700 mb-1 font-medium">
                <span>Gemini API Rate Limit</span>
                <span className="text-emerald-800 font-mono font-bold">14/60 RPM</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-emerald-500 w-[23%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VietGAP Standards & System Agronomy Status */}
      <div className="p-5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-2xl shadow-sm space-y-4 border border-emerald-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center text-emerald-300 border border-emerald-400/30">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">Quy chuẩn Nông nghiệp VietGAP Hệ thống Hiện hành</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400 text-emerald-950 uppercase">
                  TCVN 11892-1:2017
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-800 text-teal-200 border border-teal-600">
                  Canh tác Đất & Nhà Màng
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-0.5">
                Thiết lập chuẩn hóa vi khí hậu, ngưỡng độ ẩm đất, lịch tưới nhỏ giọt 3 ca và phòng trừ IPM cho toàn bộ các Tenant & Trang trại.
              </p>
            </div>
          </div>
          <a
            href="/admin/crops"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <BookOpen size={13} /> Thư viện Cây trồng & Nhập PDF/DOCX
          </a>
        </div>

        {/* 4 VietGAP Standard Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <Droplets size={13} /> Thổ Nhưỡng Đất
            </div>
            <div className="font-bold text-white text-sm">pH 5.5 - 6.8 • Ẩm 65-85%</div>
            <div className="text-[10px] text-emerald-200/70">EC an toàn 1.4 - 2.5 mS/cm</div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <Thermometer size={13} /> Vi Khí Hậu Tối Ưu
            </div>
            <div className="font-bold text-white text-sm">Nhiệt độ 18°C - 30°C</div>
            <div className="text-[10px] text-emerald-200/70">Quang thông 20k - 30k Lux</div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <CheckCircle2 size={13} /> Quản Lý Nước Tưới
            </div>
            <div className="font-bold text-white text-sm">Tưới Nhỏ Giọt 3 Ca</div>
            <div className="text-[10px] text-emerald-200/70">07:30 Sáng • 12:00 Trưa • 16:30 Chiều</div>
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <FileText size={13} /> Hồ Sơ & Nguồn Gốc
            </div>
            <div className="font-bold text-white text-sm">Nhật ký VietGAP Tự động</div>
            <div className="text-[10px] text-emerald-200/70">Minh bạch truy xuất nguồn gốc QR</div>
          </div>
        </div>
      </div>

      {/* Global Audit Logs Preview */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600" /> Nhật ký Hoạt động Toàn sàn (Platform Audit Log)
          </h3>
          <a href="/admin/audit-logs" className="text-xs text-[#119653] font-semibold hover:underline flex items-center gap-1">
            Xem tất cả <ArrowUpRight size={13} />
          </a>
        </div>

        <div className="divide-y divide-slate-100">
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic">
              Chưa có nhật ký hoạt động nào gần đây.
            </div>
          ) : (
            auditLogs.map((log, index) => {
              const logId = log.id || log.auditLogId || `audit-${index}`;
              const userName = log.actorName || log.userName || 'Hệ thống';
              const userRole = log.actorRole || log.userRole || 'System';
              const createdAt = log.createdAtUtc || log.createdAt || '-';
              const initial = (userName?.trim()?.charAt(0) || 'H').toUpperCase();

              return (
                <div key={logId} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center font-bold text-[#119653] border border-emerald-200">
                      {initial}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {log.action} <span className="font-normal text-slate-500">bởi</span> {userName} ({userRole})
                      </div>
                      <div className="text-[11px] text-slate-500">{log.details || '-'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 font-mono text-[10px]">{log.ipAddress || '-'}</span>
                    <span className="text-slate-400 block text-[10px]">{createdAt}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
