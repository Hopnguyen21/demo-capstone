import React from 'react';
import { mockZones, mockTasks, mockAlerts, mockWeather } from '../../mocks/mockData';
import { StatusBadge, Button } from '../../components/ui/BaseUI';
import { Sprout, CheckSquare, ShieldAlert, Sun, Power, Bot, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FarmerHome: React.FC = () => {
  const navigate = useNavigate();
  const assignedZones = mockZones.slice(0, 2);
  const myTasks = mockTasks.filter(t => t.status !== 'COMPLETED');
  const activeAlerts = mockAlerts.filter(a => a.status === 'OPEN');

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Mobile Header Banner */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-200 rounded-2xl shadow-xs space-y-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#062326]">Giao diện Nông dân Thực địa</span>
        <h1 className="text-xl font-bold text-slate-900">Xin chào, Trần Văn Bình!</h1>
        <p className="text-xs text-slate-600">Bạn được phân quyền quản lý <strong className="text-[#062326]">2 Nhà màng</strong> tại Trang trại Đà Lạt.</p>
      </div>

      {/* Quick Field Alert Warning */}
      {activeAlerts.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700">
            <span className="flex items-center gap-1.5"><ShieldAlert size={16} /> Cảnh báo Thực địa Khẩn cấp</span>
            <span className="text-[10px] bg-rose-100 px-2 py-0.5 rounded border border-rose-200">{activeAlerts.length} Cảnh báo</span>
          </div>
          <p className="text-xs text-slate-700">{activeAlerts[0].title}</p>
          <div className="pt-1 text-right">
            <Button size="sm" variant="danger" onClick={() => navigate('/farmer/alerts')}>Xem & Xác nhận</Button>
          </div>
        </div>
      )}

      {/* Today's Assigned Tasks Checklist */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare size={16} className="text-amber-600" /> Tác vụ Cần làm Hôm nay ({myTasks.length})
          </h3>
        </div>

        <div className="space-y-2.5">
          {myTasks.map(t => (
            <div key={t.taskId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">{t.title}</span>
                <span className="text-[11px] text-slate-500">{t.zoneName} • Hạn chót: {t.dueDate}</span>
              </div>
              <Button size="sm" variant="success" onClick={() => navigate('/farmer/tasks')}>Báo Hoàn thành</Button>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned Zones Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sprout size={16} className="text-[#062326]" /> Nhà màng được Phân công
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {assignedZones.map(z => (
            <div key={z.zoneId} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">{z.name}</h4>
                <StatusBadge status="ACTIVE" label={z.currentStage} />
              </div>
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                <div><span className="text-slate-500 block text-[10px]">Độ ẩm đất</span><strong className="text-[#062326]">68.4% (An toàn)</strong></div>
                <div><span className="text-slate-500 block text-[10px]">Nhiệt độ</span><strong className="text-amber-700">24.8°C</strong></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => navigate('/farmer/irrigation')}>
                  <Power size={13} className="mr-1" /> Bật Bơm Tưới
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
