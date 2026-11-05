import React from 'react';
import { MetricCard, StatusBadge } from '../../components/ui/BaseUI';
import { mockTenants, mockFarms, mockGateways, mockAuditLogs } from '../../mocks/mockData';
import { Building2, Sprout, Radio, Cpu, Users, ShieldAlert, Activity, ArrowUpRight } from 'lucide-react';
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
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-200/80 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs font-mono font-semibold text-[#062326] uppercase tracking-wider">Bảng điều khiển Bổn mạng</span>
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
          value={mockTenants.length + 36}
          unit="Tổ chức"
          subtext="+24% so với tháng trước"
          icon={<Building2 size={20} />}
          trend="up"
          trendValue="+8 mới"
        />
        <MetricCard
          title="Nông trang trên sàn"
          value={mockFarms.length + 93}
          unit="Trang trại"
          subtext="Tổng diện tích 450 ha"
          icon={<Sprout size={20} />}
          trend="up"
          trendValue="+12%"
        />
        <MetricCard
          title="Gateway ESP32 LoRa"
          value={mockGateways.length + 42}
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
            <span className="text-xs text-[#062326] font-mono font-semibold">+185% YOY</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tenantGrowthData}>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="farms" stroke="#062326" fill="#062326" fillOpacity={0.15} name="Trang trại" />
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
                <span className="text-[#062326] font-mono font-bold">1,240 msg/s</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-[#062326] w-[42%]" />
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
                <span className="text-[#062326] font-mono font-bold">14/60 RPM</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-emerald-500 w-[23%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Audit Logs Preview */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600" /> Nhật ký Hoạt động Toàn sàn (Platform Audit Log)
          </h3>
          <a href="/admin/audit-logs" className="text-xs text-[#062326] font-semibold hover:underline flex items-center gap-1">
            Xem tất cả <ArrowUpRight size={13} />
          </a>
        </div>

        <div className="divide-y divide-slate-100">
          {mockAuditLogs.map(log => (
            <div key={log.auditLogId} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[#062326] border border-slate-200">
                  {log.userName.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{log.action} <span className="font-normal text-slate-500">bởi</span> {log.userName} ({log.userRole})</div>
                  <div className="text-[11px] text-slate-500">{log.details}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-mono text-[10px]">{log.ipAddress}</span>
                <span className="text-slate-400 block text-[10px]">{log.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
