import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';
import { telemetryService } from '../../services';
import { useAuth } from '../../app/providers/AuthContext';
import { useNavigate } from 'react-router-dom';

const PARAMETER_LABELS: Record<string, string> = {
  Temperature: 'Nhiệt độ (°C)', AirHumidity: 'Độ ẩm KK (%)', SoilMoisture: 'Độ ẩm đất (%)',
  LightIntensity: 'Ánh sáng (lux)', Ph: 'pH', Ec: 'EC',
};
const PARAMETER_COLORS: Record<string, string> = {
  Temperature: '#d97706', AirHumidity: '#0284c7', SoilMoisture: '#119653',
  LightIntensity: '#ca8a04', Ph: '#7c3aed', Ec: '#0891b2',
};
const normalizeParameter = (value: unknown) => {
  const text = String(value ?? '');
  const aliases: Record<string, string> = { TEMPERATURE: 'Temperature', AIR_HUMIDITY: 'AirHumidity', SOIL_MOISTURE: 'SoilMoisture', LIGHT_INTENSITY: 'LightIntensity', PH: 'Ph', EC: 'Ec' };
  return aliases[text.toUpperCase()] || text;
};
const DEFAULT_PARAMETERS = [
  { code: 'Temperature', label: 'Nhiệt độ (°C)', color: '#d97706' },
  { code: 'AirHumidity', label: 'Độ ẩm KK (%)', color: '#0284c7' },
  { code: 'SoilMoisture', label: 'Độ ẩm đất (%)', color: '#119653' },
  { code: 'LightIntensity', label: 'Ánh sáng (lux)', color: '#ca8a04' },
  { code: 'Ph', label: 'pH', color: '#7c3aed' },
  { code: 'Ec', label: 'EC', color: '#0891b2' },
];

export const MonitoringHistory: React.FC = () => {
  const { zones } = useAuth();
  const navigate = useNavigate();
  const [zoneId, setZoneId] = useState('');
  const [deviceId, setDeviceId] = useState('ALL');
  const [rangeHours, setRangeHours] = useState(24);
  const [interval, setInterval] = useState('15m');
  const [devices, setDevices] = useState<any[]>([]);
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [parameter, setParameter] = useState(DEFAULT_PARAMETERS[0].code);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Chọn Zone để tải lịch sử telemetry thật từ Backend.');
  useEffect(() => { if (!zoneId && zones.length > 0) setZoneId(zones[0].zoneId); }, [zones, zoneId]);
  useEffect(() => {
    if (!zoneId) return;
    telemetryService.getLatestByDevice(zoneId).then((result: any) => {
      const rows = (result?.devices ?? []).filter((d: any) => (d.metrics ?? []).length > 0);
      setDevices(rows);
      const codes: string[] = [...new Set<string>(rows.flatMap((d: any) => (d.metrics ?? []).map((m: any) => normalizeParameter(m.parameterCode))))]
        .filter(code => Boolean(PARAMETER_LABELS[code]));
      const next = codes.map(code => ({ code, label: PARAMETER_LABELS[code], color: PARAMETER_COLORS[code] }));
      setParameters(next);
      setParameter(current => next.some(x => x.code === current) ? current : (next[0]?.code || ''));
      setDeviceId(current => current === 'ALL' || rows.some((d: any) => String(d.deviceId) === current) ? current : 'ALL');
    }).catch(() => { setDevices([]); setParameters([]); setParameter(''); });
  }, [zoneId]);
  const selectedParameter = useMemo(() => parameters.find(x => x.code === parameter) || parameters[0], [parameters, parameter]);
  const load = async () => {
    if (!zoneId) { setData([]); setMessage('Chưa có Zone để truy vấn.'); return; }
    setLoading(true);
    try {
      const to = new Date();
      // Mốc bắt đầu luôn ở giờ chẵn để biểu đồ không bắt đầu giữa một bucket.
      const alignedTo = new Date(to);
      alignedTo.setMinutes(0, 0, 0);
      const from = new Date(alignedTo.getTime() - rangeHours * 60 * 60 * 1000);
      if (!parameter || parameters.length === 0) { setData([]); setMessage('Chưa có thông số nào được gửi về từ node.'); return; }
      const requested = parameter === 'ALL' ? parameters : parameters.filter(x => x.code === parameter);
      const results = await Promise.all(requested.map(item => telemetryService.getHistory(zoneId, item.code, from.toISOString(), to.toISOString(), interval, deviceId === 'ALL' ? undefined : deviceId)));
      const merged = new Map<string, any>();
      results.forEach((result: any, index) => {
        const code = requested[index].code;
        (Array.isArray(result?.data) ? result.data : []).forEach((p: any) => {
          const key = p.bucketStartUtc;
          const row = merged.get(key) || { time: new Date(key).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) };
          row[`${code}_average`] = Number(p.average);
          row[`${code}_minimum`] = Number(p.minimum);
          row[`${code}_maximum`] = Number(p.maximum);
          merged.set(key, row);
        });
      });
      // Giữ đúng khung thời gian; các mốc này không tạo reading giả.
      const startKey = from.toISOString();
      const endKey = to.toISOString();
      if (!merged.has(startKey)) merged.set(startKey, { time: from.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) });
      if (!merged.has(endKey)) merged.set(endKey, { time: to.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) });
      const points = [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
      setData(points);
      setMessage(points.length ? '' : 'Chưa có telemetry thật trong 24 giờ qua.');
    } catch { setData([]); setMessage('Không thể tải lịch sử telemetry từ Backend.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [zoneId, parameter, deviceId, rangeHours, interval]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Activity className="text-[#119653]" size={22} /> Biểu đồ Lịch sử Vi khí hậu</h1><p className="text-xs text-slate-600 mt-1">Dữ liệu lấy từ telemetry thực tế của Gateway/Node.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft size={15} className="mr-1.5" /> Quay lại</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới</Button></div>
      </div>
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value="">-- Chọn Zone --</option>{zones.map(zone => <option key={zone.zoneId} value={zone.zoneId}>{zone.name}</option>)}</select>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value="ALL">Tất cả node</option>{devices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.hardwareAddress || device.deviceId}</option>)}</select>
          <select value={parameter} onChange={e => setParameter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value="ALL">Tất cả chỉ số</option>{parameters.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>
          <select value={rangeHours} onChange={e => setRangeHours(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value={6}>6 giờ qua</option><option value={12}>12 giờ qua</option><option value={24}>24 giờ qua</option><option value={72}>3 ngày qua</option><option value={168}>7 ngày qua</option></select>
          <select value={interval} onChange={e => setInterval(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs"><option value="1m">Mỗi 1 phút</option><option value="5m">Mỗi 5 phút</option><option value="15m">Mỗi 15 phút</option><option value="1h">Mỗi giờ</option><option value="6h">Mỗi 6 giờ</option><option value="1d">Mỗi ngày</option></select>
          <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={13} /> Từ đầu giờ chẵn · đến đầu giờ hiện tại</span>
        </div>
        <div className="h-80">
          {data.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">{message}</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="time" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }} /><Legend />{(parameter === 'ALL' ? parameters : parameters.filter(x => x.code === parameter)).map(item => <React.Fragment key={item.code}><Line type="monotone" dataKey={`${item.code}_average`} stroke={item.color} strokeWidth={2.5} name={`${item.label} trung bình`} dot={false} /></React.Fragment>)}</LineChart></ResponsiveContainer>}
        </div>
      </div>
    </div>
  );
};
