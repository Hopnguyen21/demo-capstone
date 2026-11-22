import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { supportService, cloudinaryService } from '../../services';
import { extractApiError } from '../../services/api';
import { dueLabel, DUE_TONE_CLASS } from '../../utils/dueLabel';
import { Button } from '../../components/ui/BaseUI';
import { CheckSquare, CheckCircle2, AlertTriangle, MapPin, Calendar, Camera, Image as ImageIcon, X, Loader2, Eye, Maximize2 } from 'lucide-react';
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
interface Draft { progress: number; note: string; text: string; mode: Mode; images: string[]; isUploading?: boolean }

const matchFilter = (key: 'TODO' | 'REVIEW' | 'DONE' | 'ALL', status?: string) => {
  if (key === 'ALL') return true;
  if (key === 'REVIEW') return status === 'CompletedPendingReview';
  if (key === 'DONE') return status === 'Approved' || status === 'Declined' || status === 'Cancelled';
  return ['Pending', 'Accepted', 'InProgress', 'Overdue', 'Failed'].includes(status ?? '');
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
};

export const FarmerTasksPage: React.FC = () => {
  const { user, selectedFarmId, zones } = useAuth();
  const [filter, setFilter] = useState<'TODO' | 'REVIEW' | 'DONE' | 'ALL'>('TODO');
  const farmId = (user as any)?.farmId || selectedFarmId;
  const [searchParams] = useSearchParams();
  const focusTaskId = searchParams.get('taskId');
  const focusRef = useRef<HTMLDivElement | null>(null);

  const [tasks, setTasks] = useState<FarmTaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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

  const draftOf = (task: FarmTaskDetail): Draft => drafts[task.id] ?? { progress: task.assignments[0]?.progressPercent ?? 0, note: '', text: '', mode: null, images: [] };
  const setDraft = (task: FarmTaskDetail, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [task.id]: { ...draftOf(task), ...patch } }));

  const handleUploadImages = async (task: FarmTaskDetail, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDraft(task, { isUploading: true });
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const res = await cloudinaryService.uploadFile(file, 'task-reports');
          if (res?.secureUrl || res?.url) {
            newUrls.push(res.secureUrl || res.url);
          } else {
            const base64 = await readFileAsBase64(file);
            newUrls.push(base64);
          }
        } catch {
          const base64 = await readFileAsBase64(file);
          newUrls.push(base64);
        }
      }
      const curImages = draftOf(task).images || [];
      setDraft(task, { images: [...curImages, ...newUrls], isUploading: false });
    } catch {
      setDraft(task, { isUploading: false });
    }
  };

  const removeDraftImage = (task: FarmTaskDetail, index: number) => {
    const cur = draftOf(task).images || [];
    setDraft(task, { images: cur.filter((_, i) => i !== index) });
  };

  // Chỉ cập nhật theo dữ liệu backend trả về; lỗi thì giữ nguyên nội dung đã nhập và hiện lý do.
  const act = async (task: FarmTaskDetail, body: { action: string; result?: string; failureReason?: string; progressPercent?: number; notes?: string; imageUrls?: string[] }) => {
    setBusyId(task.id);
    setErrors(prev => ({ ...prev, [task.id]: '' }));
    try {
      const updated: FarmTaskDetail = await supportService.updateTask(farmId, task.id, body);
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setDrafts(prev => ({ ...prev, [task.id]: { progress: updated.assignments[0]?.progressPercent ?? 0, note: '', text: '', mode: null, images: [] } }));
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
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
              FARM WORKER TASKS
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="text-[#119653]" size={22} /> Công việc Thực địa của Tôi
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Các công việc chủ trang trại giao cho bạn. Bạn chỉ thấy và cập nhật phần việc của chính mình.</p>
        </div>

        {tasks.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-bold">
              Tổng số: {tasks.length} việc
            </span>
          </div>
        )}
      </div>

      {!farmId && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">Bạn chưa thuộc trang trại nào. Hãy chấp nhận lời mời tham gia ở mục "Lời mời tham gia Farm".</div>}
      {loadError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">Không tải được công việc: {loadError}</div>}
      {loading && tasks.length === 0 && <p className="text-xs text-slate-500">Đang tải…</p>}
      {!loading && farmId && !loadError && tasks.length === 0 && (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">Bạn chưa được giao công việc nào.</div>
      )}

      {tasks.length > 0 && tasks.some(t => t.assignments[0]?.status === 'Pending') && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <CheckSquare size={18} className="animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                Thông báo: Có {tasks.filter(t => t.assignments[0]?.status === 'Pending').length} công việc mới được giao
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Chủ trang trại đã phân công việc mới cho bạn. Hãy bấm <strong>Nhận việc</strong> trên từng thẻ công việc để bắt đầu thực hiện.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter('TODO')}
            className="self-start sm:self-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0"
          >
            Xem danh sách chờ nhận
          </button>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([['TODO', 'Cần làm'], ['REVIEW', 'Chờ duyệt'], ['DONE', 'Đã xong'], ['ALL', 'Tất cả']] as const).map(([key, text]) => {
            const n = tasks.filter(t => matchFilter(key, t.assignments[0]?.status)).length;
            return (
              <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${filter === key ? 'bg-[#119653] text-white border-[#119653] shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
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

              {/* Ảnh báo cáo thực địa đã nộp */}
              {mine.imageUrls && mine.imageUrls.length > 0 && (
                <div className="space-y-1.5 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-[11px]">
                    <Camera size={13} className="text-[#119653]" />
                    <span>Ảnh báo cáo thực địa ({mine.imageUrls.length} ảnh):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mine.imageUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPhoto(url)}
                        className="relative group rounded-lg overflow-hidden border border-emerald-200 hover:border-[#119653] shadow-xs cursor-pointer"
                        title="Bấm để xem ảnh lớn"
                      >
                        <img src={url} alt={`Báo cáo ${idx + 1}`} className="w-14 h-14 object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Maximize2 size={13} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block font-bold text-slate-800">
                    Mô tả kết quả thực hiện: *
                  </label>
                  <textarea
                    value={d.text}
                    onChange={e => setDraft(task, { text: e.target.value })}
                    rows={3}
                    placeholder="Mô tả chi tiết công việc đã thực hiện tại khu vực... *"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white"
                  />

                  {/* Chụp hình & Tải ảnh báo cáo */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Camera size={14} className="text-[#119653]" />
                        <span>Hình ảnh minh chứng thực địa ({d.images?.length || 0} ảnh):</span>
                      </label>
                      <span className="text-[11px] text-slate-500">Hỗ trợ chụp trực tiếp từ điện thoại / máy ảnh</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#119653] hover:bg-[#0e7a43] text-white font-bold rounded-lg transition-all text-xs shadow-xs">
                        <Camera size={14} />
                        <span>Chụp ảnh / Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          className="hidden"
                          onChange={e => {
                            handleUploadImages(task, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {d.isUploading && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold animate-pulse">
                          <Loader2 size={14} className="animate-spin" /> Đang xử lý & tải ảnh lên...
                        </span>
                      )}
                    </div>

                    {d.images && d.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {d.images.map((imgUrl, idx) => (
                          <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <img src={imgUrl} alt={`Ảnh ${idx + 1}`} className="w-16 h-16 object-cover" />
                            <button
                              type="button"
                              onClick={() => removeDraftImage(task, idx)}
                              className="absolute top-0.5 right-0.5 p-1 bg-rose-600 text-white rounded-full opacity-85 hover:opacity-100 transition-opacity"
                              title="Xóa ảnh này"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <Button size="sm" variant="ghost" onClick={() => setDraft(task, { mode: null, text: '', images: [] })}>Quay lại</Button>
                    <Button
                      size="sm"
                      disabled={busy || !d.text.trim() || d.isUploading}
                      onClick={() => act(task, { action: 'Complete', result: d.text.trim(), imageUrls: d.images })}
                    >
                      <CheckCircle2 size={14} className="mr-1 text-emerald-300" /> Nộp kết quả
                    </Button>
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

      {/* Lightbox xem ảnh lớn */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 text-white border-b border-neutral-800">
              <span className="text-xs font-semibold flex items-center gap-1.5"><Camera size={14} className="text-[#119653]" /> Chi tiết ảnh báo cáo thực địa</span>
              <button type="button" onClick={() => setSelectedPhoto(null)} className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black overflow-auto">
              <img src={selectedPhoto} alt="Báo cáo công việc" className="max-h-[75vh] w-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
