import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';
import { telemetryService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';

const PARAMETERS = [
  { code: 'TEMPERATURE', label: 'Nhiệt độ (°C)', color: '#d97706' },
  { code: 'AIR_HUMIDITY', label: 'Độ ẩm KK (%)', color: '#0284c7' },
  { code: 'SOIL_MOISTURE', label: 'Độ ẩm đất (%)', color: '#119653' },
  { code: 'LIGHT_INTENSITY', label: 'Ánh sáng (lux)', color: '#ca8a04' },
  { code: 'PH', label: 'pH', color: '#7c3aed' },
  { code: 'EC', label: 'EC', color: '#0891b2' },
];

export const MonitoringHistory: React.FC = () => {
  const { zones } = useAuth();
  const [zoneId, setZoneId] = useState('');
  const [parameter, setParameter] = useState(PARAMETERS[0].code);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Chọn Zone để tải lịch sử telemetry thật từ Backend.');
  useEffect(() => { if (!zoneId && zones.length > 0) setZoneId(zones[0].zoneId); }, [zones, zoneId]);
  const selectedParameter = useMemo(() => PARAMETERS.find(x => x.code === parameter) || PARAMETERS[0], [parameter]);
  const load = async () => {
    if (!zoneId) { setData([]); setMessage('Chưa có Zone để truy vấn.'); return; }
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      const result = await telemetryService.getHistory(zoneId, parameter, from.toISOString(), to.toISOString(), '15m');
      const points = Array.isArray(result?.data) ? result.data : [];
      setData(points.map((p: any) => ({ time: new Date(p.bucketStartUtc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), average: Number(p.average), minimum: Number(p.minimum), maximum: Number(p.maximum) })));
      setMessage(points.length ? '' : 'Chưa có telemetry thật trong 24 giờ qua.');
    } catch { setData([]); setMessage('Không thể tải lịch sử telemetry từ Backend.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [zoneId, parameter]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Activity className="text-[#119653]" size={22} /> Biểu đồ Lịch sử Vi khí hậu</h1><p className="text-xs text-slate-600 mt-1">Dữ liệu chỉ lấy từ telemetry đã ghi nhận bởi Gateway/Node thật.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới</Button>
      </div>
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value="">-- Chọn Zone --</option>{zones.map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.name}</option>)}</select>
          <select value={parameter} onChange={e => setParameter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs">{PARAMETERS.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
          <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={13} /> 24 giờ qua · bucket 15 phút</span>
        </div>
        <div className="h-80">
          {data.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">{message}</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="time" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }} /><Legend /><Line type="monotone" dataKey="average" stroke={selectedParameter.color} strokeWidth={2.5} name={`${selectedParameter.label} trung bình`} dot={false} /><Line type="monotone" dataKey="minimum" stroke="#94a3b8" strokeDasharray="3 3" name="Thấp nhất" dot={false} /><Line type="monotone" dataKey="maximum" stroke="#475569" strokeDasharray="3 3" name="Cao nhất" dot={false} /></LineChart></ResponsiveContainer>}
        </div>
      </div>
    </div>
  );
};
