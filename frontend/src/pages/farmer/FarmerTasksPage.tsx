import React, { useState } from 'react';
import { mockTasks } from '../../mocks/mockData';
import { CheckSquare, CheckCircle2 } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const FarmerTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState(mockTasks);

  const handleComplete = (id: string) => {
    setTasks(tasks.map(t => t.taskId === id ? { ...t, status: 'COMPLETED' as const } : t));
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
        {tasks.map(t => (
          <div key={t.taskId} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#062326]">#{t.taskId}</span>
              <StatusBadge status={t.status} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
            <p className="text-slate-600">{t.description}</p>
            <div className="pt-2 flex justify-between items-center border-t border-slate-100">
              <span className="text-slate-500">Hạn: {t.dueDate}</span>
              {t.status !== 'COMPLETED' && (
                <Button size="sm" onClick={() => handleComplete(t.taskId)}>
                  <CheckCircle2 size={14} className="mr-1" /> Đánh dấu Hoàn thành
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
