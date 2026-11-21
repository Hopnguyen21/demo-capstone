import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { supportService, userService } from '../../services';
import { extractApiError } from '../../services/api';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { ClipboardList, Plus, Calendar, MapPin, CheckCircle2, AlertTriangle, UserPlus, X, Camera, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Employee, FarmTaskDetail, FarmTaskAssignment, TaskAssignmentStatus } from '../../types';

const STATUS_LABEL: Record<TaskAssignmentStatus, { text: string; style: string }> = {
  Pending: { text: 'Chờ nhận việc', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  Accepted: { text: 'Đã nhận việc', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  InProgress: { text: 'Đang thực hiện', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  CompletedPendingReview: { text: 'Chờ bạn duyệt', style: 'bg-violet-50 text-violet-800 border-violet-200' },
  Approved: { text: 'Đã duyệt', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Failed: { text: 'Thất bại', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  Overdue: { text: 'Quá hạn', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  Cancelled: { text: 'Đã gỡ', style: 'bg-slate-100 text-slate-600 border-slate-200' },
  Declined: { text: 'Đã từ chối', style: 'bg-rose-50 text-rose-800 border-rose-200' }
};

type Filter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'ATTENTION';
const FILTERS: { key: Filter; label: string; match: (s: TaskAssignmentStatus) => boolean }[] = [
  { key: 'ALL', label: 'Tất cả', match: () => true },
  { key: 'PENDING', label: 'Chờ nhận', match: s => s === 'Pending' },
  { key: 'IN_PROGRESS', label: 'Đang làm', match: s => s === 'Accepted' || s === 'InProgress' },
  { key: 'REVIEW', label: 'Chờ duyệt', match: s => s === 'CompletedPendingReview' },
  { key: 'DONE', label: 'Hoàn thành', match: s => s === 'Approved' },
  { key: 'ATTENTION', label: 'Cần xử lý', match: s => s === 'Overdue' || s === 'Failed' || s === 'Declined' }
];

const formatDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—');
const endOfDayIso = (dateText: string) => new Date(`${dateText}T23:59:00`).toISOString();
const defaultDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().substring(0, 10);
};

const StatusChip: React.FC<{ status: TaskAssignmentStatus }> = ({ status }) => {
  const label = STATUS_LABEL[status] ?? { text: status, style: 'bg-slate-50 text-slate-700 border-slate-200' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${label.style}`}>{label.text}</span>;
};

/** Danh sách chọn nhiều nhân công; nhân công chưa có quyền Zone bị khóa kèm lý do. */
const FarmerMultiSelect: React.FC<{
  farmers: Employee[];
  zoneId: string;
  excludeIds?: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}> = ({ farmers, zoneId, excludeIds = [], selected, onChange }) => {
  const candidates = farmers.filter(f => !excludeIds.includes(f.employeeId));
  if (candidates.length === 0) return <p className="text-xs text-slate-500">Không còn nhân công nào để chọn.</p>;
  return (
    <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-44 overflow-y-auto">
      {candidates.map(f => {
        const eligible = f.status === 'ACTIVE' && (f.zoneAccess ?? []).some(z => z.zoneId === zoneId);
        const checked = selected.includes(f.employeeId);
        return (
          <label key={f.employeeId} className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${eligible ? 'bg-white border-slate-200 cursor-pointer' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!eligible}
                checked={checked}
                onChange={() => onChange(checked ? selected.filter(id => id !== f.employeeId) : [...selected, f.employeeId])}
              />
              <span className="font-semibold text-slate-800">{f.fullName}</span>
            </span>
            {!eligible && <span className="text-[10px] text-amber-700">chưa có quyền Zone này</span>}
          </label>
        );
      })}
    </div>
  );
};

export const TasksPage: React.FC = () => {
  const { selectedFarmId, zones: allZones, farms, setSelectedFarmId } = useAuth();
  // Công việc, nhân công và Zone đều theo Farm đang chọn.
  const zones = (allZones as any[]).filter((z: any) => z.farmId === selectedFarmId);
  const farmId = selectedFarmId;
  const [searchParams] = useSearchParams();
  const focusTaskId = searchParams.get('taskId');
  const focusRef = useRef<HTMLDivElement | null>(null);

  const [tasks, setTasks] = useState<FarmTaskDetail[]>([]);
  const [farmers, setFarmers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', zoneId: '', dueDate: defaultDueDate(), farmerIds: [] as string[] });

  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [addDueDate, setAddDueDate] = useState(defaultDueDate());

  // Photo Inspector Modal cho Owner kiểm tra ảnh minh chứng thực địa
  const [inspectingPhoto, setInspectingPhoto] = useState<{
    urls: string[];
    currentIndex: number;
    taskTitle: string;
    farmerName: string;
    result?: string | null;
    submittedAtUtc?: string | null;
    status: TaskAssignmentStatus;
    task: FarmTaskDetail;
    assignment: FarmTaskAssignment;
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const [taskList, members] = await Promise.all([supportService.getTasks(farmId), userService.getFarmers()]);
      setTasks(Array.isArray(taskList) ? taskList : []);
      // Chỉ nhân công thuộc Farm đang chọn.
      setFarmers(Array.isArray(members) ? members.filter((m: any) => (m.assignedFarms ?? []).includes(farmId)) : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (zones.length > 0 && !zones.some((z: any) => z.zoneId === form.zoneId)) setForm(prev => ({ ...prev, zoneId: zones[0].zoneId }));
  }, [zones, form.zoneId]);

  useEffect(() => {
    if (focusTaskId && focusRef.current) focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusTaskId, tasks.length]);

  // Chỉ thay công việc bằng dữ liệu backend trả về sau khi API xác nhận.
  const replaceTask = (updated: FarmTaskDetail) => setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    setFormError(null);
    if (!form.zoneId) return setFormError('Hãy chọn Zone.');
    if (form.farmerIds.length === 0) return setFormError('Hãy chọn ít nhất một nhân công nhận việc.');
    const dueAtUtc = endOfDayIso(form.dueDate);
    if (new Date(dueAtUtc).getTime() <= Date.now()) return setFormError('Hạn hoàn thành phải ở tương lai.');

    setIsSubmitting(true);
    try {
      await supportService.createTask(farmId, {
        zoneId: form.zoneId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        dueAtUtc,
        farmerIds: form.farmerIds
      });
      setIsModalOpen(false);
      setForm({ title: '', description: '', zoneId: form.zoneId, dueDate: defaultDueDate(), farmerIds: [] });
      await load();
      window.dispatchEvent(new Event('notification-refresh'));
      showToast('success', `Đã giao công việc cho ${form.farmerIds.length} nhân công và gửi thông báo.`);
    } catch (err) {
      // Giữ nguyên dữ liệu form; không báo thành công khi backend chưa lưu.
      setFormError(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const approve = async (task: FarmTaskDetail, assignment: FarmTaskAssignment) => {
    setBusyKey(`${task.id}:${assignment.farmerId}`);
    try {
      replaceTask(await supportService.updateTask(farmId, task.id, { action: 'Approve', farmerId: assignment.farmerId }));
      showToast('success', `Đã duyệt kết quả của ${assignment.farmerName}.`);
    } catch (err) {
      showToast('error', extractApiError(err));
    } finally {
      setBusyKey(null);
    }
  };

  const removeAssignee = async (task: FarmTaskDetail, assignment: FarmTaskAssignment) => {
    setBusyKey(`${task.id}:${assignment.farmerId}`);
    try {
      replaceTask(await supportService.removeTaskAssignee(farmId, task.id, assignment.farmerId));
      showToast('success', `Đã gỡ ${assignment.farmerName} khỏi công việc.`);
    } catch (err) {
      showToast('error', extractApiError(err));
    } finally {
      setBusyKey(null);
    }
  };

  const addAssignees = async (task: FarmTaskDetail) => {
    if (addIds.length === 0) return showToast('error', 'Hãy chọn nhân công cần giao thêm.');
    const overdue = new Date(task.dueAtUtc).getTime() <= Date.now();
    setBusyKey(`${task.id}:add`);
    try {
      replaceTask(await supportService.addTaskAssignees(farmId, task.id, addIds, overdue ? endOfDayIso(addDueDate) : undefined));
      setAddingFor(null);
      setAddIds([]);
      window.dispatchEvent(new Event('notification-refresh'));
      showToast('success', 'Đã giao thêm công việc và gửi thông báo.');
    } catch (err) {
      showToast('error', extractApiError(err));
    } finally {
      setBusyKey(null);
    }
  };

  const visible = tasks.filter(t => {
    const rule = FILTERS.find(f => f.key === filter)!;
    return filter === 'ALL' || rule.match(t.status) || t.assignments.some(a => rule.match(a.status));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-[#119653]" size={22} /> Phân công Công việc
          </h1>
          <p className="text-xs text-slate-600 mt-1">Giao một công việc cho nhiều nhân công; theo dõi tiến độ và duyệt kết quả của từng người.</p>
        </div>
        <Button onClick={() => { setFormError(null); setIsModalOpen(true); }} disabled={!farmId}>
          <Plus size={16} className="mr-1.5" /> Giao công việc mới
        </Button>
      </div>

      {toast && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} <span>{toast.message}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs">
        <label className="font-bold text-slate-700">Nông trại:</label>
        <select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium">
          <option value="">-- Chọn nông trại --</option>
          {(farms as any[]).map((x: any) => <option key={x.farmId} value={x.farmId}>{x.name}</option>)}
        </select>
        {farmId && <span className="text-slate-500">{tasks.length} công việc • {farmers.length} nhân công • {zones.length} Zone</span>}
      </div>

      {!farmId && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">Hãy chọn một nông trại.</div>}
      {loadError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">Không tải được công việc: {loadError}</div>}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs font-medium">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg ${filter === f.key ? 'bg-[#119653] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && tasks.length === 0 && <p className="text-xs text-slate-500">Đang tải…</p>}
        {!loading && visible.length === 0 && (
          <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl p-8">
            <ClipboardList size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Chưa có công việc nào trong mục này</p>
            <p className="text-xs text-slate-500 mt-1">Bấm "Giao công việc mới" để giao việc cho nhân công.</p>
          </div>
        )}

        {visible.map(task => {
          const zoneName = zones.find((z: any) => z.zoneId === task.zoneId)?.name || 'Zone';
          const activeAssignments = task.assignments.filter(a => a.status !== 'Cancelled');
          const isFocused = focusTaskId === task.id;
          const overdue = new Date(task.dueAtUtc).getTime() <= Date.now();
          const takenIds = activeAssignments.filter(a => !['Failed', 'Overdue', 'Declined'].includes(a.status)).map(a => a.farmerId);
          return (
            <div
              key={task.id}
              ref={isFocused ? focusRef : undefined}
              className={`p-5 bg-white border rounded-xl shadow-xs space-y-3 ${isFocused ? 'border-[#119653] ring-2 ring-emerald-200' : 'border-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                    <StatusChip status={task.status} />
                  </div>
                  {task.description && <p className="text-xs text-slate-600">{task.description}</p>}
                  <div className="text-[11px] text-slate-500 flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={12} className="text-emerald-700" /> {zoneName}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> Hạn: <strong className="text-slate-800">{formatDateTime(task.dueAtUtc)}</strong></span>
                    <span>{activeAssignments.length} nhân công</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setAddingFor(addingFor === task.id ? null : task.id); setAddIds([]); }}>
                  <UserPlus size={13} className="mr-1.5" /> Giao thêm
                </Button>
              </div>

              {/* Tiến độ từng nhân công */}
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {task.assignments.length === 0 && <p className="p-3 text-xs text-slate-500">Chưa có nhân công nào được giao.</p>}
                {task.assignments.map(a => {
                  const key = `${task.id}:${a.farmerId}`;
                  return (
                    <div key={a.id} className="p-3 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{a.farmerName}</span>
                          <StatusChip status={a.status} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {a.status === 'CompletedPendingReview' && (
                            <Button size="sm" variant="outline" disabled={busyKey === key} onClick={() => approve(task, a)}>
                              <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Duyệt kết quả
                            </Button>
                          )}
                          {a.status !== 'Approved' && a.status !== 'Cancelled' && (
                            <Button size="sm" variant="ghost" disabled={busyKey === key} onClick={() => removeAssignee(task, a)} aria-label={`Gỡ ${a.farmerName}`}>
                              <X size={13} />
                            </Button>
                          )}
                        </div>
                      </div>
                      {a.status !== 'Cancelled' && a.status !== 'Declined' && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#119653]" style={{ width: `${a.progressPercent}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 w-9 text-right">{a.progressPercent}%</span>
                        </div>
                      )}
                      {a.progressNote && <p className="text-slate-500">Ghi chú tiến độ: {a.progressNote}</p>}
                      {a.result && <p className="text-slate-700">Kết quả: {a.result}</p>}
                      {a.failureReason && <p className="text-rose-700">Lý do: {a.failureReason}</p>}

                      {/* Hiển thị ảnh minh chứng báo cáo thực địa của Farmer */}
                      {a.imageUrls && a.imageUrls.length > 0 && (
                        <div className="pt-1.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                            <Camera size={13} className="text-[#119653]" />
                            <span>Hình ảnh minh chứng thực địa ({a.imageUrls.length} ảnh):</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {a.imageUrls.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setInspectingPhoto({
                                  urls: a.imageUrls!,
                                  currentIndex: idx,
                                  taskTitle: task.title,
                                  farmerName: a.farmerName,
                                  result: a.result,
                                  submittedAtUtc: a.submittedAtUtc,
                                  status: a.status,
                                  task,
                                  assignment: a
                                })}
                                className="relative group rounded-lg overflow-hidden border border-slate-200 hover:border-[#119653] shadow-xs cursor-pointer transition-all"
                                title="Bấm để phóng to và kiểm tra chi tiết"
                              >
                                <img src={url} alt={`Ảnh ${idx + 1}`} className="w-14 h-14 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Maximize2 size={13} />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {addingFor === task.id && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <FarmerMultiSelect farmers={farmers} zoneId={task.zoneId} excludeIds={takenIds} selected={addIds} onChange={setAddIds} />
                  {overdue && (
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      Công việc đã quá hạn, đặt hạn mới:
                      <input type="date" value={addDueDate} onChange={e => setAddDueDate(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1" />
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAddingFor(null)}>Hủy</Button>
                    <Button size="sm" disabled={busyKey === `${task.id}:add`} onClick={() => addAssignees(task)}>Giao cho {addIds.length} người</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Giao công việc mới">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên công việc *</label>
            <Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tỉa cành và buộc dây giàn cà chua" />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô tả</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg p-2 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Zone *</label>
              <select
                value={form.zoneId}
                onChange={e => setForm({ ...form, zoneId: e.target.value, farmerIds: [] })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
              >
                {zones.map((z: any) => <option key={z.zoneId} value={z.zoneId}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Hạn hoàn thành *</label>
              <input type="date" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Nhân công nhận việc * ({form.farmerIds.length} đã chọn)</label>
            <FarmerMultiSelect farmers={farmers} zoneId={form.zoneId} selected={form.farmerIds} onChange={ids => setForm({ ...form, farmerIds: ids })} />
            <p className="text-[11px] text-slate-500 mt-1">Chỉ nhân công đã chấp nhận lời mời và có quyền truy cập Zone này mới chọn được. Giao việc không tự cấp quyền Zone.</p>
          </div>
          {formError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{formError}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang giao…' : 'Giao công việc'}</Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: PHOTO INSPECTOR & APPROVAL WORKFLOW ─── */}
      {inspectingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setInspectingPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 text-white border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-[#119653]" />
                  <h3 className="text-sm font-bold truncate max-w-md sm:max-w-xl">{inspectingPhoto.taskTitle}</h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Báo cáo bởi <strong className="text-white">{inspectingPhoto.farmerName}</strong> • {formatDateTime(inspectingPhoto.submittedAtUtc)}
                  {inspectingPhoto.urls.length > 1 && ` (Ảnh ${inspectingPhoto.currentIndex + 1}/${inspectingPhoto.urls.length})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Image View */}
            <div className="relative flex-1 min-h-[300px] max-h-[58vh] bg-black flex items-center justify-center p-2 overflow-hidden select-none">
              <img
                src={inspectingPhoto.urls[inspectingPhoto.currentIndex]}
                alt="Báo cáo thực địa"
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
              />

              {inspectingPhoto.urls.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={inspectingPhoto.currentIndex === 0}
                    onClick={() => setInspectingPhoto(prev => prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : null)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md"
                    title="Ảnh trước"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    disabled={inspectingPhoto.currentIndex === inspectingPhoto.urls.length - 1}
                    onClick={() => setInspectingPhoto(prev => prev ? { ...prev, currentIndex: Math.min(prev.urls.length - 1, prev.currentIndex + 1) } : null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md"
                    title="Ảnh tiếp theo"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails strip if multiple */}
            {inspectingPhoto.urls.length > 1 && (
              <div className="flex gap-2 px-4 py-2 bg-slate-950 border-t border-slate-800 overflow-x-auto justify-center">
                {inspectingPhoto.urls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInspectingPhoto(prev => prev ? { ...prev, currentIndex: idx } : null)}
                    className={`rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${idx === inspectingPhoto.currentIndex ? 'border-[#119653] scale-105 shadow-md' : 'border-slate-700 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={url} alt={`Thumb ${idx + 1}`} className="w-12 h-12 object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Footer Details & Quick Action */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1 max-w-xl">
                <div className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <span>Nội dung kết quả nhân công đã nộp:</span>
                  <StatusChip status={inspectingPhoto.status} />
                </div>
                <p className="text-slate-200 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 text-xs">
                  {inspectingPhoto.result || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button variant="ghost" onClick={() => setInspectingPhoto(null)} className="text-slate-300 hover:text-white">
                  Đóng
                </Button>
                {inspectingPhoto.status === 'CompletedPendingReview' && (
                  <Button
                    size="sm"
                    disabled={busyKey === `${inspectingPhoto.task.id}:${inspectingPhoto.assignment.farmerId}`}
                    onClick={async () => {
                      const { task, assignment } = inspectingPhoto;
                      await approve(task, assignment);
                      setInspectingPhoto(null);
                    }}
                    className="bg-[#119653] hover:bg-[#0e7a43] text-white font-bold"
                  >
                    <CheckCircle2 size={15} className="mr-1.5" /> Phê duyệt kết quả này
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
