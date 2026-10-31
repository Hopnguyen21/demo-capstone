import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { alertService, farmerService, telemetryService } from '../../services';
import { Alert } from '../../types';
import { Button } from '../../components/ui/BaseUI';
import { dueLabel, DUE_TONE_CLASS as TONE } from '../../utils/dueLabel';
import { Sprout, CheckSquare, ShieldAlert, Power, ClipboardList, Gauge, Bot, AlertTriangle } from 'lucide-react';

// Trạng thái công việc của chính Farmer: chỉ những việc còn cần làm mới hiện ở trang chủ.
const OPEN_TASK_STATUSES = new Set(['pending', 'accepted', 'inprogress', 'overdue', 'failed']);

interface ZoneReadings { soil?: { value: number; unit: string }; temp?: { value: number; unit: string }; fresh: boolean; loaded: boolean }

export const FarmerHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readings, setReadings] = useState<Record<string, ZoneReadings>>({});
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    alertService.getAlerts().then(res => { if (Array.isArray(res)) setAlerts(res); }).catch(() => {});
    farmerService.getMyTasks().then(res => { if (Array.isArray(res)) setTasks(res); }).catch(() => {});
    farmerService.getMyZones().then(res => { if (Array.isArray(res)) setZones(res); }).catch(() => {});
  }, []);

  // Số đo thật của từng Zone (không dùng số mẫu).
  useEffect(() => {
    zones.forEach(z => {
      const id = z.zoneId;
      telemetryService.getRealtime(id).then((r: any) => {
        const metrics: any[] = r?.metrics ?? r?.value?.metrics ?? [];
        const pick = (code: string) => metrics.find(m => m.parameterCode === code && m.isFresh);
        const soil = pick('SoilMoisture'), temp = pick('Temperature');
        setReadings(prev => ({ ...prev, [id]: { soil: soil && { value: soil.value, unit: soil.unit }, temp: temp && { value: temp.value, unit: temp.unit }, fresh: Boolean(soil || temp), loaded: true } }));
      }).catch(() => setReadings(prev => ({ ...prev, [id]: { fresh: false, loaded: true } })));
    });
  }, [zones]);

  const myTasks = useMemo(() => tasks
    .filter(t => OPEN_TASK_STATUSES.has(String(t.status ?? '').toLowerCase()))
    .sort((a, b) => new Date(a.dueAtUtc ?? a.dueDate ?? 0).getTime() - new Date(b.dueAtUtc ?? b.dueDate ?? 0).getTime()), [tasks]);
  const openAlerts = alerts.filter(a => a.status === 'OPEN');
  const lateCount = myTasks.filter(t => dueLabel(t.dueAtUtc ?? t.dueDate).tone === 'late').length;
  const visibleTasks = showAllTasks ? myTasks : myTasks.slice(0, 4);
  const zoneName = (id?: string) => zones.find(z => z.zoneId === id)?.zoneName ?? 'Khu vực';

  return (
    <div className="space-y-5 w-full max-w-7xl mx-auto">
      {/* Chào + tóm tắt: nhìn một lần biết hôm nay có gì */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-200 rounded-2xl shadow-xs space-y-3">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#119653]">Nông dân thực địa</span>
          <h1 className="text-xl font-bold text-slate-900">Xin chào, {user?.fullName || 'Nông dân'}!</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <button onClick={() => navigate('/farmer/tasks')} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400">
            <div className={`text-xl font-black ${lateCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{myTasks.length}</div>
            <div className="text-[11px] text-slate-500">Việc cần làm{lateCount > 0 ? ` (${lateCount} quá hạn)` : ''}</div>
          </button>
          <button onClick={() => navigate('/farmer/alerts')} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400">
            <div className={`text-xl font-black ${openAlerts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{openAlerts.length}</div>
            <div className="text-[11px] text-slate-500">Cảnh báo đang mở</div>
          </button>
          <button onClick={() => navigate('/farmer/zones')} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400">
            <div className="text-xl font-black text-slate-900">{zones.length}</div>
            <div className="text-[11px] text-slate-500">Khu vực phụ trách</div>
          </button>
        </div>
      </div>

      {/* Lối tắt lớn, dễ bấm trên điện thoại */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Công việc', icon: <ClipboardList size={20} />, to: '/farmer/tasks' },
          { label: 'Cảnh báo', icon: <ShieldAlert size={20} />, to: '/farmer/alerts' },
          { label: 'Vi khí hậu', icon: <Gauge size={20} />, to: '/farmer/monitoring' },
          { label: 'Hỏi AI', icon: <Bot size={20} />, to: '/farmer/ai' },
        ].map(item => (
          <button key={item.to} onClick={() => navigate(item.to)} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 text-[11px] font-semibold">
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      {/* Cảnh báo cần xử lý */}
      {openAlerts.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-sm font-bold text-rose-700">
            <span className="flex items-center gap-1.5"><ShieldAlert size={16} /> Cần xử lý ngay</span>
            <span className="text-[11px] bg-rose-100 px-2 py-0.5 rounded border border-rose-200">{openAlerts.length} cảnh báo</span>
          </div>
          <ul className="space-y-1.5">
            {openAlerts.slice(0, 3).map(a => (
              <li key={a.alertId ?? a.title} className="text-xs text-slate-800 flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-rose-500" />
                <span><strong>{a.zoneName || zoneName(a.zoneId)}:</strong> {a.title}</span>
              </li>
            ))}
          </ul>
          <div className="text-right">
            <Button size="sm" variant="danger" onClick={() => navigate('/farmer/alerts')}>Xem & xác nhận{openAlerts.length > 3 ? ` (${openAlerts.length})` : ''}</Button>
          </div>
        </div>
      )}

      {/* Việc cần làm: sắp theo hạn */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CheckSquare size={16} className="text-amber-600" /> Việc cần làm ({myTasks.length})
        </h3>
        {myTasks.length === 0 ? (
          <p className="text-xs text-slate-500">Không có việc nào đang chờ. Bạn đã xong hết!</p>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map(t => {
              const due = dueLabel(t.dueAtUtc ?? t.dueDate);
              return (
                <button key={t.taskId || t.id} onClick={() => navigate('/farmer/tasks')} className="w-full text-left p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-400 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-bold text-slate-900 text-sm block truncate">{t.title}</span>
                    <span className="text-[11px] text-slate-500">{t.zoneName || 'Khu vực'}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded border ${TONE[due.tone]}`}>{due.text}</span>
                </button>
              );
            })}
            {myTasks.length > 4 && (
              <button onClick={() => setShowAllTasks(v => !v)} className="text-xs font-semibold text-emerald-700 hover:underline">
                {showAllTasks ? 'Thu gọn' : `Xem thêm ${myTasks.length - 4} việc`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Khu vực phụ trách */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sprout size={16} className="text-[#119653]" /> Khu vực phụ trách
        </h3>
        {zones.length === 0 && <p className="text-xs text-slate-500 p-4 bg-white border border-dashed border-slate-200 rounded-xl">Bạn chưa được cấp quyền Zone nào. Hãy nhờ chủ trang trại cấp quyền.</p>}
        {zones.map(z => {
          const r = readings[z.zoneId];
          const zoneAlerts = openAlerts.filter(a => a.zoneId === z.zoneId).length;
          return (
            <div key={z.zoneId} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">{z.zoneName}</h4>
                {zoneAlerts > 0 && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-300 flex items-center gap-1">
                    <ShieldAlert size={10} /> {zoneAlerts} cảnh báo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Độ ẩm đất</span>
                  <strong className="text-emerald-800">{r?.soil ? `${r.soil.value} ${r.soil.unit}` : (r?.loaded ? 'Chưa có số đo mới' : '…')}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Nhiệt độ</span>
                  <strong className="text-amber-700">{r?.temp ? `${r.temp.value} ${r.temp.unit}` : (r?.loaded ? 'Chưa có số đo mới' : '…')}</strong>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate('/farmer/zones')}>Xem khu vực</Button>
                {z.canControl && (
                  <Button size="sm" onClick={() => navigate('/farmer/irrigation')}>
                    <Power size={13} className="mr-1" /> Tưới thủ công
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
