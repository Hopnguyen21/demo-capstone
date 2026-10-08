import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { supportService } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { ClipboardList, Plus, Calendar, UserCheck } from 'lucide-react';

export const TasksPage: React.FC = () => {
  const { selectedFarmId, zones } = useAuth();
  const farmId = selectedFarmId || '30000000-0000-0000-0000-000000000001';
  const [tasks, setTasks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'HIGH' as const, dueDate: '2026-09-24' });

  const loadTasks = async () => {
    try {
      const res = await supportService.getTasks(farmId);
      if (res && res.length > 0) setTasks(res);
    } catch {}
  };

  useEffect(() => {
    loadTasks();
  }, [farmId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const createdLocal = {
      taskId: `task-${Date.now()}`,
      farmId,
      zoneName: zones[0]?.name || 'Nhà màng 01',
      title: newTask.title,
      description: newTask.description,
      taskType: 'MAINTENANCE' as const,
      priority: newTask.priority,
      status: 'PENDING' as const,
      assignedToName: 'Trần Văn Bình',
      dueDate: newTask.dueDate,
    };
    try {
      await supportService.createTask(farmId, {
        zoneId: zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001',
        title: newTask.title,
        description: newTask.description,
        dueAtUtc: new Date(newTask.dueDate).toISOString(),
        assignedFarmerId: '20000000-0000-0000-0000-000000000004',
      });
      await loadTasks();
    } catch {
      setTasks([createdLocal, ...tasks]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-[#062326]" size={22} /> Phân công Công việc Thực địa (Work Orders & Tasks)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Giao task kiểm tra, bón phân, thu hoạch cho công nhân và theo dõi trạng thái hoàn thành.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Giao Task Mới
        </Button>
      </div>

      <div className="space-y-3">
        {tasks.map(t => {
          const id = t.taskId || t.id;
          const isDone = t.status === 'COMPLETED' || t.status === 'Completed';

          return (
            <div key={id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#062326] font-mono">#{id?.substring(0, 8)}</span>
                  <StatusBadge status={isDone ? 'COMPLETED' : 'PENDING'} />
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {t.priority || 'HIGH'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
                <p className="text-xs text-slate-600">{t.description || 'Không có mô tả chi tiết'}</p>
                <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-4">
                  <span>Khu vực: <strong className="text-slate-800">{t.zoneName || 'Nhà màng'}</strong></span>
                  <span>Người thực hiện: <strong className="text-[#062326]">{t.assignedToName || 'Công nhân phụ trách'}</strong></span>
                  <span>Hạn chót: <strong className="text-slate-800">{t.dueDate || t.dueAtUtc?.substring(0, 10) || 'Hôm nay'}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tạo Task Mới cho Công nhân">
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Tên công việc (Task Title)</label>
            <Input required value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Kiểm tra hệ thống béc tưới" />
          </div>
          <div>
            <label className="block text-slate-700 font-medium mb-1">Mô tả chi tiết</label>
            <Input value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Vệ sinh đầu lọc béc tưới hàng 2..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Độ ưu tiên</label>
              <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs">
                <option value="LOW">Thấp</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Cao</option>
                <option value="URGENT">Khẩn cấp</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Hạn hoàn thành</label>
              <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Xác nhận Giao Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
