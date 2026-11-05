import React, { useState } from 'react';
import { mockTasks } from '../../mocks/mockData';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { ClipboardList, Plus, Calendar, UserCheck } from 'lucide-react';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState(mockTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'HIGH' as const, dueDate: '2026-09-24' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      taskId: `task-${Date.now()}`,
      farmId: 'farm-01',
      zoneName: 'Nhà màng 01',
      title: newTask.title,
      description: newTask.description,
      taskType: 'MAINTENANCE' as const,
      priority: newTask.priority,
      status: 'PENDING' as const,
      assignedToName: 'Trần Văn Bình',
      dueDate: newTask.dueDate,
    };
    setTasks([created, ...tasks]);
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
        {tasks.map(t => (
          <div key={t.taskId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#062326] font-mono">#{t.taskId}</span>
                <StatusBadge status={t.status} />
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {t.priority}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
              <p className="text-xs text-slate-600">{t.description}</p>
              <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-4">
                <span>Khu vực: <strong className="text-slate-800">{t.zoneName}</strong></span>
                <span>Người thực hiện: <strong className="text-[#062326]">{t.assignedToName}</strong></span>
                <span>Hạn chót: <strong className="text-slate-800">{t.dueDate}</strong></span>
              </div>
            </div>
          </div>
        ))}
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
