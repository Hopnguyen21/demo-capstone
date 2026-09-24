import React from 'react';
import { FileText, Download, BarChart2, PieChart } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const waterUsageData = [
  { day: 'Thứ 2', waterLiters: 1200, electricityKwh: 14 },
  { day: 'Thứ 3', waterLiters: 950, electricityKwh: 11 },
  { day: 'Thứ 4', waterLiters: 1400, electricityKwh: 16 },
  { day: 'Thứ 5', waterLiters: 1100, electricityKwh: 13 },
  { day: 'Thứ 6', waterLiters: 1300, electricityKwh: 15 },
  { day: 'Thứ 7', waterLiters: 850, electricityKwh: 10 },
  { day: 'Chủ Nhật', waterLiters: 1500, electricityKwh: 18 },
];

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-[#062326]" size={22} /> Báo cáo Tổng hợp & Tiêu thụ Tài nguyên (Analytics & Reports)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Thống kê lượng nước tưới, điện năng tiêu thụ và tần suất cảnh báo theo tuần/tháng.</p>
        </div>
        <Button variant="outline"><Download size={15} className="mr-1.5" /> Xuất Báo cáo PDF</Button>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Thống kê Tiêu thụ Nước tưới (Lít) trong Tuần</h3>
          <span className="text-xs font-mono font-bold text-[#062326]">Tổng: 8,300 Lít</span>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterUsageData}>
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="waterLiters" fill="#062326" radius={[4, 4, 0, 0]} name="Lượng nước (Lít)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
