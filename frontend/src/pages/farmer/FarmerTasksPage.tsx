import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { supportService } from '../../services';
import { extractApiError } from '../../services/api';
import { dueLabel, DUE_TONE_CLASS } from '../../utils/dueLabel';
import { Button } from '../../components/ui/BaseUI';
import { CheckSquare, CheckCircle2, AlertTriangle, MapPin, Calendar } from 'lucide-react';
import { FarmTaskDetail, TaskAssignmentStatus } from '../../types';

const STATUS_LABEL: Record<TaskAssignmentStatus, { text: string; style: string }> = {
  Pending: { text: 'Chờ bạn nhận việc', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  Accepted: { text: 'Đã nhận việc', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  InProgress: { text: 'Đang thực hiện', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  CompletedPendingReview: { text: 'Đã nộp, chờ chủ trang trại duyệt', style: 'bg-violet-50 text-violet-800 border-violet-200' },
  Approved: { text: 'Đã được duyệt', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Failed: { text: 'Bạn báo không hoàn thành', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  Overdue: { text: 'Quá hạn', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  Cancelled: { text: 'Đã gỡ khỏi công việc', style: 'bg-slate-100 text-slate-600 border-slate-200' },
  Declined: { text: 'Bạn đã từ chối', style: 'bg-rose-50 text-rose-800 border-rose-200' }
};

type Mode = 'decline' | 'fail' | 'complete' | null;
interface Draft { progress: number; note: string; text: string; mode: Mode }

const matchFilter = (key: 'TODO' | 'REVIEW' | 'DONE' | 'ALL', status?: string) => {
  if (key === 'ALL') return true;
  if (key === 'REVIEW') return status === 'CompletedPendingReview';
  if (key === 'DONE') return status === 'Approved' || status === 'Declined' || status === 'Cancelled';
  return ['Pending', 'Accepted', 'InProgress', 'Overdue', 'Failed'].includes(status ?? '');
};

export const FarmerTasksPage: React.FC = () => {
  const { selectedFarmId, zones } = useAuth();
  const [filter, setFilter] = useState<'TODO' | 'REVIEW' | 'DONE' | 'ALL'>('TODO');
  const farmId = selectedFarmId;
  const [searchParams] = useSearchParams();
  const focusTaskId = searchParams.get('taskId');
  const focusRef = useRef<HTMLDivElement | null>(null);

  const [tasks, setTasks] = useState<FarmTaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const list = await supportService.getTasks(farmId);
      setTasks(Array.isArray(list) ? list : []);
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
    if (focusTaskId && focusRef.current) focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusTaskId, tasks.length]);

  const draftOf = (task: FarmTaskDetail): Draft => drafts[task.id] ?? { progress: task.assignments[0]?.progressPercent ?? 0, note: '', text: '', mode: null };
  const setDraft = (task: FarmTaskDetail, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [task.id]: { ...draftOf(task), ...patch } }));

  // Chỉ cập nhật theo dữ liệu backend trả về; lỗi thì giữ nguyên nội dung đã nhập và hiện lý do.
  const act = async (task: FarmTaskDetail, body: { action: string; result?: string; failureReason?: string; progressPercent?: number; notes?: string }) => {
    setBusyId(task.id);
    setErrors(prev => ({ ...prev, [task.id]: '' }));
    try {
      const updated: FarmTaskDetail = await supportService.updateTask(farmId, task.id, body);
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setDrafts(prev => ({ ...prev, [task.id]: { progress: updated.assignments[0]?.progressPercent ?? 0, note: '', text: '', mode: null } }));
      window.dispatchEvent(new Event('notification-refresh'));
    } catch (err) {
      setErrors(prev => ({ ...prev, [task.id]: extractApiError(err) }));
    } finally {
      setBusyId(null);
    }
  };

  const visibleTasks = tasks
    .filter(t => matchFilter(filter, t.assignments[0]?.status))
    .sort((a, b) => new Date(a.dueAtUtc ?? 0).getTime() - new Date(b.dueAtUtc ?? 0).getTime());

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CheckSquare className="text-[#119653]" size={22} /> Công việc của tôi
        </h1>
        <p className="text-xs text-slate-500 mt-1">Các công việc chủ trang trại giao cho bạn. Bạn chỉ thấy và cập nhật phần việc của chính mình.</p>
      </div>

      {!farmId && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">Bạn chưa thuộc trang trại nào. Hãy chấp nhận lời mời tham gia ở mục "Lời mời tham gia Farm".</div>}
      {loadError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">Không tải được công việc: {loadError}</div>}
      {loading && tasks.length === 0 && <p className="text-xs text-slate-500">Đang tải…</p>}
      {!loading && farmId && !loadError && tasks.length === 0 && (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">Bạn chưa được giao công việc nào.</div>
      )}

      {tasks.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([['TODO', 'Cần làm'], ['REVIEW', 'Chờ duyệt'], ['DONE', 'Đã xong'], ['ALL', 'Tất cả']] as const).map(([key, text]) => {
            const n = tasks.filter(t => matchFilter(key, t.assignments[0]?.status)).length;
            return (
              <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${filter === key ? 'bg-[#119653] text-white border-[#119653]' : 'bg-white text-slate-600 border-slate-200'}`}>
                {text} ({n})
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {visibleTasks.map(task => {
          const mine = task.assignments[0];
          if (!mine) return null;
          const d = draftOf(task);
          const busy = busyId === task.id;
          const label = STATUS_LABEL[mine.status] ?? { text: mine.status, style: 'bg-slate-50 text-slate-700 border-slate-200' };
          return (
            <div
              key={task.id}
              ref={focusTaskId === task.id ? focusRef : undefined}
              className={`p-4 bg-white border rounded-xl space-y-3 text-xs shadow-sm ${focusTaskId === task.id ? 'border-[#119653] ring-2 ring-emerald-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${label.style}`}>{label.text}</span>
              </div>
              {task.description && <p className="text-slate-600">{task.description}</p>}
              {task.requirements && <p className="text-slate-500">Yêu cầu: {task.requirements}</p>}
              <div className="text-slate-500 flex items-center gap-4 flex-wrap">
                {(() => { const due = dueLabel(task.dueAtUtc); return <span className={`flex items-center gap-1 px-2 py-0.5 rounded border font-semibold ${DUE_TONE_CLASS[due.tone]}`}><Calendar size={12} /> {due.text}</span>; })()}
                <span className="flex items-center gap-1"><MapPin size={12} /> {(zones as any[]).find((z: any) => z.zoneId === task.zoneId)?.name ?? 'Khu vực'}</span>
              </div>

              {['Accepted', 'InProgress', 'CompletedPendingReview', 'Approved'].includes(mine.status) && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#119653]" style={{ width: `${mine.progressPercent}%` }} /></div>
                  <span className="font-mono text-[10px] text-slate-500">{mine.progressPercent}%</span>
                </div>
              )}
              {mine.progressNote && <p className="text-slate-500">Ghi chú tiến độ: {mine.progressNote}</p>}
              {mine.result && <p className="text-slate-700">Kết quả đã nộp: {mine.result}</p>}
              {mine.failureReason && <p className="text-rose-700">Lý do: {mine.failureReason}</p>}

              {/* Hành động theo trạng thái phân công của chính bạn */}
              {mine.status === 'Pending' && (
                <div className="space-y-2">
                  {d.mode === 'decline' ? (
                    <>
                      <textarea value={d.text} onChange={e => setDraft(task, { text: e.target.value })} rows={2} placeholder="Lý do từ chối (không bắt buộc)" className="w-full border border-slate-300 rounded-lg p-2" />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: null })}>Quay lại</Button>
                        <Button size="sm" disabled={busy} onClick={() => act(task, { action: 'Decline', failureReason: d.text.trim() || undefined })}>Xác nhận từ chối</Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: 'decline' })}>Từ chối</Button>
                      <Button size="sm" disabled={busy} onClick={() => act(task, { action: 'Accept' })}>
                        <CheckCircle2 size={14} className="mr-1" /> Nhận việc
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {mine.status === 'Accepted' && d.mode === null && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: 'fail' })}>Báo không thể hoàn thành</Button>
                  <Button size="sm" disabled={busy} onClick={() => act(task, { action: 'Start' })}>Bắt đầu làm</Button>
                </div>
              )}

              {mine.status === 'InProgress' && d.mode === null && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <label className="flex items-center gap-2 text-slate-700">
                    Tiến độ: <strong>{d.progress}%</strong>
                    <input type="range" min={0} max={100} step={5} value={d.progress} onChange={e => setDraft(task, { progress: Number(e.target.value) })} className="flex-1" />
                  </label>
                  <input value={d.note} onChange={e => setDraft(task, { note: e.target.value })} placeholder="Ghi chú tiến độ (không bắt buộc)" className="w-full border border-slate-300 rounded-lg p-2" />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: 'fail' })}>Báo không thể hoàn thành</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(task, { action: 'UpdateProgress', progressPercent: d.progress, notes: d.note.trim() || undefined })}>Cập nhật tiến độ</Button>
                    <Button size="sm" onClick={() => setDraft(task, { mode: 'complete' })}>Nộp kết quả</Button>
                  </div>
                </div>
              )}

              {d.mode === 'complete' && (
                <div className="space-y-2">
                  <textarea value={d.text} onChange={e => setDraft(task, { text: e.target.value })} rows={3} placeholder="Mô tả kết quả đã làm *" className="w-full border border-slate-300 rounded-lg p-2" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: null, text: '' })}>Quay lại</Button>
                    <Button size="sm" disabled={busy || !d.text.trim()} onClick={() => act(task, { action: 'Complete', result: d.text.trim() })}>Nộp kết quả</Button>
                  </div>
                </div>
              )}

              {d.mode === 'fail' && (
                <div className="space-y-2">
                  <textarea value={d.text} onChange={e => setDraft(task, { text: e.target.value })} rows={2} placeholder="Vì sao không thể hoàn thành? *" className="w-full border border-slate-300 rounded-lg p-2" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: null, text: '' })}>Quay lại</Button>
                    <Button size="sm" disabled={busy || !d.text.trim()} onClick={() => act(task, { action: 'Fail', failureReason: d.text.trim() })}>Gửi báo cáo</Button>
                  </div>
                </div>
              )}

              {errors[task.id] && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{errors[task.id]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
