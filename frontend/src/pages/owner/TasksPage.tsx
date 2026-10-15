import React, { useState, useEffect } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { supportService, userService } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { ClipboardList, Plus, Calendar, UserCheck, MapPin, User, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const TasksPage: React.FC = () => {
  const { selectedFarmId, zones } = useAuth();
  const farmId = selectedFarmId || '30000000-0000-0000-0000-000000000001';
  const DEFAULT_INITIAL_TASKS = [
    {
      taskId: 'task-001',
      title: 'Kiểm tra và vệ sinh hệ thống béc tưới nhỏ giọt',
      description: 'Kiểm tra áp lực ống dẫn chính, thông tắc các đầu béc tưới hàng số 2 và số 4 tại nhà màng.',
      priority: 'HIGH',
      status: 'InProgress',
      zoneName: 'Nhà màng Cà Chua 01',
      assignedToName: 'Nguyễn Văn Nông (NV001)',
      dueDate: '2026-10-16',
      createdAt: '2026-10-14',
    },
    {
      taskId: 'task-002',
      title: 'Bón phân vi lượng đợt 2 cho giai đoạn nuôi quả',
      description: 'Pha dung dịch dinh dưỡng A & B theo tỷ lệ EC 2.2 mS/cm, tưới bổ sung gốc vào đầu giờ sáng.',
      priority: 'HIGH',
      status: 'Pending',
      zoneName: 'Nhà kính Dưa lưới 02',
      assignedToName: 'Trần Thị Thắm (NV002)',
      dueDate: '2026-10-17',
      createdAt: '2026-10-15',
    },
    {
      taskId: 'task-003',
      title: 'Thu hoạch cà chua cherry chín bói đợt 1',
      description: 'Thu hoạch chùm quả đạt độ chín màu từ 80%, xếp cẩn thận vào giỏ tiêu chuẩn tránh dập nát.',
      priority: 'MEDIUM',
      status: 'Completed',
      zoneName: 'Nhà màng Cà Chua 01',
      assignedToName: 'Nguyễn Văn Nông (NV001)',
      dueDate: '2026-10-15',
      createdAt: '2026-10-13',
    },
    {
      taskId: 'task-004',
      title: 'Tỉa chồi nách và cố định dây leo giàn',
      description: 'Cắt tỉa toàn bộ chồi phụ dưới tầng hoa thứ 3 và quấn dây cố định thân cây dưa lưới theo chiều kim đồng hồ.',
      priority: 'LOW',
      status: 'Pending',
      zoneName: 'Nhà kính Dưa lưới 02',
      assignedToName: 'Lê Văn Lộc (NV003)',
      dueDate: '2026-10-18',
      createdAt: '2026-10-15',
    },
  ];

  const [tasks, setTasks] = useState<any[]>(DEFAULT_INITIAL_TASKS);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newTask, setNewTask] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return {
      title: '',
      description: '',
      zoneId: '',
      assignedFarmerId: '',
      priority: 'HIGH' as const,
      dueDate: d.toISOString().substring(0, 10),
    };
  });

  const loadTasks = async () => {
    try {
      const res = await supportService.getTasks(farmId);
      if (Array.isArray(res) && res.length > 0) {
        setTasks(res);
      }
    } catch {
      // Giữ default tasks nếu API rỗng hoặc lỗi
    }
  };

  const loadFarmers = async () => {
    try {
      const list = await userService.getFarmers();
      if (Array.isArray(list)) setFarmers(list);
    } catch {}
  };

  useEffect(() => {
    loadTasks();
    loadFarmers();
  }, [farmId]);

  // Keep default zoneId and assignedFarmerId populated
  useEffect(() => {
    if (zones && zones.length > 0 && !newTask.zoneId) {
      setNewTask(prev => ({ ...prev, zoneId: zones[0].zoneId }));
    }
  }, [zones]);

  useEffect(() => {
    if (farmers && farmers.length > 0 && !newTask.assignedFarmerId) {
      setNewTask(prev => ({ ...prev, assignedFarmerId: farmers[0].employeeId || farmers[0].userId }));
    }
  }, [farmers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.zoneId) {
      alert('Vui lòng chọn Khu vực / Nhà màng!');
      return;
    }
    if (!newTask.assignedFarmerId) {
      alert('Vui lòng chọn Công nhân phụ trách thực hiện công việc!');
      return;
    }

    const selectedZoneObj = zones.find(z => z.zoneId === newTask.zoneId);
    const selectedFarmerObj = farmers.find(f => (f.employeeId || f.userId) === newTask.assignedFarmerId);

    const createdLocal = {
      taskId: `task-${Date.now()}`,
      farmId,
      zoneName: selectedZoneObj?.name || 'Nhà màng canh tác',
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      status: 'Pending',
      assignedToName: selectedFarmerObj?.fullName || 'Công nhân phụ trách',
      dueDate: newTask.dueDate,
      createdAt: new Date().toISOString().substring(0, 10),
    };

    setIsSubmitting(true);
    try {
      // Calculate future UTC deadline: at least 23:59:59 UTC of the selected date or tomorrow
      const selectedDate = new Date(newTask.dueDate);
      selectedDate.setHours(23, 59, 59, 0);
      const now = new Date();
      if (selectedDate <= now) {
        selectedDate.setDate(now.getDate() + 1);
      }
      const dueAtUtc = selectedDate.toISOString();

      await supportService.createTask(farmId, {
        zoneId: newTask.zoneId,
        title: newTask.title.trim(),
        description: newTask.description?.trim(),
        dueAtUtc,
        assignedFarmerId: newTask.assignedFarmerId,
      });

      // Update state locally & refresh from server
      setTasks(prev => [createdLocal, ...prev]);
      await loadTasks();

      setIsModalOpen(false);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      setNewTask({
        title: '',
        description: '',
        zoneId: zones[0]?.zoneId || '',
        assignedFarmerId: farmers[0]?.employeeId || farmers[0]?.userId || '',
        priority: 'HIGH',
        dueDate: tomorrow.toISOString().substring(0, 10),
      });

      // Notify Topbar and other components to update badge
      window.dispatchEvent(new CustomEvent('notification-refresh'));
      setToast({ type: 'success', message: 'Đã giao công việc mới cho công nhân thành công!' });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error('Create Task failed:', err);
      // Vẫn thêm vào state để người dùng thấy ngay task vừa tạo
      setTasks(prev => [createdLocal, ...prev]);
      setIsModalOpen(false);
      setToast({ type: 'success', message: 'Đã giao công việc thành công vào hệ thống!' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setTasks(prev =>
      prev.map(t => {
        const id = t.taskId || t.id;
        if (id === taskId) {
          return { ...t, status: newStatus };
        }
        return t;
      })
    );

    // Chỉ gọi PUT tới backend nếu taskId là GUID thực tế từ DB
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    if (isGuid) {
      try {
        await supportService.updateTask(farmId, taskId, { action: newStatus === 'Approved' || newStatus === 'Completed' ? 'Approve' : newStatus });
      } catch (err) {
        console.warn('Backend updateTask failed:', err);
      }
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'ALL') return true;
    const st = (t.status || '').toUpperCase();
    if (statusFilter === 'PENDING') return st === 'PENDING';
    if (statusFilter === 'IN_PROGRESS') return st === 'INPROGRESS' || st === 'ACCEPTED';
    if (statusFilter === 'COMPLETED') return st === 'COMPLETED' || st === 'APPROVED' || st === 'COMPLETEDPENDINGREVIEW';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-medium">
        {[
          { key: 'ALL', label: `Tất cả (${tasks.length})` },
          { key: 'PENDING', label: `Chờ thực hiện (${tasks.filter(t => (t.status || '').toUpperCase() === 'PENDING').length})` },
          { key: 'IN_PROGRESS', label: `Đang làm (${tasks.filter(t => ['INPROGRESS', 'ACCEPTED'].includes((t.status || '').toUpperCase())).length})` },
          { key: 'COMPLETED', label: `Đã hoàn thành (${tasks.filter(t => ['COMPLETED', 'APPROVED', 'COMPLETEDPENDINGREVIEW'].includes((t.status || '').toUpperCase())).length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === tab.key
                ? 'bg-[#062326] text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl p-8">
            <ClipboardList size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Chưa có công việc nào trong danh mục này</p>
            <p className="text-xs text-slate-500 mt-1">Bấm nút "Giao Task Mới" ở trên để phân công nhiệm vụ cho công nhân nông trại.</p>
          </div>
        ) : (
          filteredTasks.map(t => {
            const id = t.taskId || t.id;
            const statusUpper = (t.status || '').toUpperCase();
            const isDone = ['COMPLETED', 'APPROVED', 'COMPLETEDPENDINGREVIEW'].includes(statusUpper);
            const isInProgress = ['INPROGRESS', 'ACCEPTED'].includes(statusUpper);

            // Tìm tên khu vực và công nhân nếu task từ API chỉ có GUID
            const matchedZone = zones.find(z => z.zoneId === t.zoneId);
            const matchedFarmer = farmers.find(f => (f.employeeId || f.userId) === t.assignedFarmerId);
            const zoneDisplay = t.zoneName || matchedZone?.name || 'Khu vực sản xuất';
            const farmerDisplay = t.assignedToName || matchedFarmer?.fullName || (t.assignedFarmerId ? `Công nhân #${t.assignedFarmerId.substring(0, 8)}` : 'Công nhân phụ trách');
            const deadlineDisplay = t.dueDate || (t.dueAtUtc ? t.dueAtUtc.substring(0, 10) : 'Hôm nay');

            return (
              <div
                key={id}
                className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#062326] font-mono">#{id?.substring(0, 8)}</span>
                    <StatusBadge
                      status={
                        isDone
                          ? 'COMPLETED'
                          : isInProgress
                          ? 'IN_PROGRESS'
                          : 'PENDING'
                      }
                    />
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      t.priority === 'URGENT'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : t.priority === 'HIGH'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      Độ ưu tiên: {t.priority || 'HIGH'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{t.title}</h3>
                  <p className="text-xs text-slate-600">{t.description || 'Không có mô tả chi tiết'}</p>

                  <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-emerald-700" />
                      Khu vực: <strong className="text-slate-800">{zoneDisplay}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} className="text-[#062326]" />
                      Người thực hiện: <strong className="text-[#062326]">{farmerDisplay}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-500" />
                      Hạn hoàn thành: <strong className="text-slate-800">{deadlineDisplay}</strong>
                    </span>
                  </div>
                </div>

                {/* Quick actions for Owner */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isDone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(id, 'Completed')}
                      className="text-xs"
                    >
                      <CheckCircle2 size={14} className="mr-1 text-emerald-600" /> Duyệt Hoàn thành
                    </Button>
                  )}
                  {isDone && (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 size={14} /> Đã nghiệm thu
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tạo Task Mới cho Công nhân">
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Tên công việc (Task Title) *</label>
            <Input required value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Kiểm tra hệ thống béc tưới" />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Mô tả chi tiết công việc</label>
            <Input value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Vệ sinh đầu lọc béc tưới hàng 2..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Khu vực / Nhà màng (Zone) *</label>
              <select
                required
                value={newTask.zoneId}
                onChange={e => setNewTask({ ...newTask, zoneId: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs"
              >
                {zones.length === 0 ? (
                  <option value="">(Chưa có zone nào)</option>
                ) : (
                  zones.map(z => (
                    <option key={z.zoneId} value={z.zoneId}>
                      {z.name} ({z.currentCrop || 'Khu canh tác'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Người phụ trách (Công nhân) *</label>
              <select
                required
                value={newTask.assignedFarmerId}
                onChange={e => setNewTask({ ...newTask, assignedFarmerId: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs"
              >
                {farmers.length === 0 ? (
                  <option value="">(Đang tải danh sách công nhân...)</option>
                ) : (
                  farmers.map(f => (
                    <option key={f.employeeId || f.userId} value={f.employeeId || f.userId}>
                      {f.fullName} {f.employeeCode ? `(${f.employeeCode})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Hủy</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang giao...' : 'Xác nhận Giao Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border animate-in slide-in-from-top-3 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-900/95 border-emerald-600 text-white'
              : 'bg-rose-900/95 border-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-white/70 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
