import React, { useState } from 'react';
import { mockTelemetryHistory } from '../../mocks/mockData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Download, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';

export const MonitoringHistory: React.FC = () => {
  const [metric, setMetric] = useState<'SOIL_MOISTURE' | 'TEMPERATURE' | 'AIR_HUMIDITY'>('SOIL_MOISTURE');

  // Format chart data for 24h
  const chartData = Array.from({ length: 24 }).map((_, i) => {
    const hour = i.toString().padStart(2, '0') + ':00';
    return {
      time: hour,
      soilMoisture: 65 + Math.sin(i / 3) * 6,
      temperature: 20 + Math.sin(i / 4) * 5,
      humidity: 75 - Math.sin(i / 4) * 8,
      minTarget: 60,
      maxTarget: 80,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-[#062326]" size={22} /> Biểu đồ Lịch sử Vi khí hậu (Historical Analytics)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Truy vấn biểu đồ chuỗi thời gian TimescaleDB kết hợp dải ngưỡng an toàn của cây trồng.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Download size={15} className="mr-1.5" /> Xuất dữ liệu CSV/Excel</Button>
        </div>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMetric('SOIL_MOISTURE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${metric === 'SOIL_MOISTURE' ? 'bg-[#062326] text-white border-[#062326]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              Độ ẩm đất (%)
            </button>
            <button
              onClick={() => setMetric('TEMPERATURE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${metric === 'TEMPERATURE' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              Nhiệt độ (°C)
            </button>
            <button
              onClick={() => setMetric('AIR_HUMIDITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${metric === 'AIR_HUMIDITY' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              Độ ẩm KK (%)
            </button>
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium"><Calendar size={13} /> 24 Giờ Qua</span>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend />
              {metric === 'SOIL_MOISTURE' && <Line type="monotone" dataKey="soilMoisture" stroke="#062326" strokeWidth={2} name="Độ ẩm đất (%)" dot={false} />}
              {metric === 'TEMPERATURE' && <Line type="monotone" dataKey="temperature" stroke="#d97706" strokeWidth={2} name="Nhiệt độ (°C)" dot={false} />}
              {metric === 'AIR_HUMIDITY' && <Line type="monotone" dataKey="humidity" stroke="#0284c7" strokeWidth={2} name="Độ ẩm không khí (%)" dot={false} />}
              <Line type="monotone" dataKey="minTarget" stroke="#e11d48" strokeDasharray="3 3" name="Ngưỡng Min" dot={false} />
              <Line type="monotone" dataKey="maxTarget" stroke="#e11d48" strokeDasharray="3 3" name="Ngưỡng Max" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
