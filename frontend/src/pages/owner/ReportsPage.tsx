import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Droplets, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Filter
} from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';

const mockWeeklyWater = [
  { day: 'Thứ 2', waterLiters: 1250, electricityKwh: 14.2 },
  { day: 'Thứ 3', waterLiters: 980, electricityKwh: 11.5 },
  { day: 'Thứ 4', waterLiters: 1420, electricityKwh: 16.0 },
  { day: 'Thứ 5', waterLiters: 1150, electricityKwh: 13.1 },
  { day: 'Thứ 6', waterLiters: 1310, electricityKwh: 15.4 },
  { day: 'Thứ 7', waterLiters: 890, electricityKwh: 10.2 },
  { day: 'Chủ Nhật', waterLiters: 1540, electricityKwh: 17.8 },
];

const mockZoneEfficiency = [
  { zone: 'Khu A1 (Cà chua)', usagePercent: 35, compliance: '98% VietGAP' },
  { zone: 'Khu A2 (Dâu tây)', usagePercent: 28, compliance: '95% VietGAP' },
  { zone: 'Khu B1 (Xà lách)', usagePercent: 22, compliance: '100% VietGAP' },
  { zone: 'Khu B2 (Dưa lưới)', usagePercent: 15, compliance: '92% VietGAP' },
];

export const ReportsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'season'>('week');
  const [isExporting, setIsExporting] = useState(false);

  const totalWater = mockWeeklyWater.reduce((acc, cur) => acc + cur.waterLiters, 0);
  const totalPower = mockWeeklyWater.reduce((acc, cur) => acc + cur.electricityKwh, 0);

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      window.print();
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-[#119653] rounded-xl border border-emerald-100">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Báo Cáo Tài Nguyên & Năng Suất (Analytics & Reports)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Thống kê lượng nước tưới, điện năng tiêu thụ, chi phí vận hành và tỷ lệ tuân thủ quy chuẩn VietGAP.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setTimeRange('season')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeRange === 'season' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Vụ mùa
            </button>
          </div>

          <Button 
            onClick={handleExportPdf}
            className="bg-[#119653] hover:bg-[#0e8046] text-white flex items-center gap-2"
          >
            <Download size={15} />
            <span>{isExporting ? 'Đang xuất PDF...' : 'Xuất Báo Cáo PDF'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng Nước Tưới</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Droplets size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {totalWater.toLocaleString()} <span className="text-sm font-normal text-slate-500">Lít</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span>↓ 8.2%</span> <span className="text-slate-400">tiết kiệm so với tuần trước</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Điện Năng Tiêu Thụ</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Zap size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {totalPower.toFixed(1)} <span className="text-sm font-normal text-slate-500">kWh</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span>↓ 5.4%</span> <span className="text-slate-400">tối ưu nhờ tự động hóa</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tỷ Lệ Đạt VietGAP</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              96.8% <span className="text-sm font-normal text-slate-500">chỉ số chuẩn</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-600 mt-1">
              An toàn tồn dư vi sinh & hóa chất
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cảnh Báo Đã Xử Lý</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              14 / 14 <span className="text-sm font-normal text-slate-500">sự cố</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              100% sự cố được khắc phục kịp thời
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Water Usage Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biểu Đồ Tiêu Thụ Nước Tưới</h2>
              <p className="text-xs text-slate-500">Lưu lượng nước phân bổ qua hệ thống van tưới nhỏ giọt</p>
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
              Tổng: {totalWater.toLocaleString()} L
            </span>
          </div>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockWeeklyWater} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    fontSize: '12px'
                  }} 
                  formatter={(val: number) => [`${val.toLocaleString()} Lít`, 'Lượng nước']}
                />
                <Bar dataKey="waterLiters" fill="#0284c7" radius={[6, 6, 0, 0]} name="Lượng nước (Lít)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Electricity Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biểu Đồ Điện Năng Tiêu Thụ</h2>
              <p className="text-xs text-slate-500">Năng lượng vận hành máy bơm, quạt thông gió & cảm biến</p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
              Tổng: {totalPower.toFixed(1)} kWh
            </span>
          </div>

          <div className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockWeeklyWater} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#e2e8f0', 
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    fontSize: '12px'
                  }} 
                  formatter={(val: number) => [`${val} kWh`, 'Điện năng']}
                />
                <Area type="monotone" dataKey="electricityKwh" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#powerGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Zone Efficiency Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Hiệu Suất & Phân Bổ Theo Khu Vực Canh Tác</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase">
                <th className="pb-3">Khu vực & Cây trồng</th>
                <th className="pb-3">Tỷ lệ tiêu thụ tài nguyên</th>
                <th className="pb-3">Tiêu chuẩn VietGAP</th>
                <th className="pb-3 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockZoneEfficiency.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 font-semibold text-slate-800">{item.zone}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#119653] h-full rounded-full" 
                          style={{ width: `${item.usagePercent}%` }}
                        />
                      </div>
                      <span className="font-medium text-slate-600">{item.usagePercent}%</span>
                    </div>
                  </td>
                  <td className="py-3 font-medium text-emerald-700">{item.compliance}</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tối ưu
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
