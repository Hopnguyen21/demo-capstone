import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { supportService, farmerService } from '../../services';
import { CheckSquare, CheckCircle2 } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const FarmerTasksPage: React.FC = () => {
  const { selectedFarmId } = useAuth();
  const farmId = selectedFarmId || '30000000-0000-0000-0000-000000000001';
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    farmerService.getMyTasks().then(res => {
      if (Array.isArray(res) && res.length > 0) setTasks(res);
      else supportService.getTasks(farmId).then(r => { if (r) setTasks(r); });
    }).catch(() => {
      supportService.getTasks(farmId).then(r => { if (r) setTasks(r); }).catch(() => {});
    });
  }, [farmId]);

  const handleComplete = async (id: string) => {
    try {
      await farmerService.completeTask(id, 'Đã hoàn thành tác vụ thực địa');
    } catch {
      await supportService.updateTask(farmId, id, { action: 'Complete' }).catch(() => {});
    }
    setTasks(tasks.map(t => ((t.taskId === id || t.id === id) ? { ...t, status: 'COMPLETED' } : t)));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CheckSquare className="text-[#062326]" size={22} /> Danh sách Tác vụ Nông nghiệp
        </h1>
        <p className="text-xs text-slate-500 mt-1">Các công việc thực địa do Farm Owner giao cho bạn.</p>
      </div>

      <div className="space-y-3">
        {tasks.map(t => {
          const id = t.taskId || t.id;
          const isDone = t.status === 'COMPLETED' || t.status === 'Completed';

          return (
            <div key={id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#062326]">#{id?.substring(0, 8)}</span>
                <StatusBadge status={isDone ? 'COMPLETED' : 'PENDING'} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
              <p className="text-slate-600">{t.description || 'Không có mô tả chi tiết'}</p>
              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <span className="text-slate-500">Hạn: {t.dueDate || t.dueAtUtc?.substring(0, 10) || 'Hôm nay'}</span>
                {!isDone && (
                  <Button size="sm" onClick={() => handleComplete(id)}>
                    <CheckCircle2 size={14} className="mr-1" /> Đánh dấu Hoàn thành
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
