import React, { useEffect, useState } from 'react';
import { Copy, Save, X, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Button, Input } from '../ui/BaseUI';
import { cropService } from '../../services';

const PARAM_LABEL: Record<string, string> = {
  Temperature: 'Nhiệt độ', SoilMoisture: 'Độ ẩm đất', AirHumidity: 'Độ ẩm không khí', Ph: 'pH', LightIntensity: 'Ánh sáng', Ec: 'EC',
};

interface Req { parameterCode: string; minValue: number; maxValue: number; targetValue: number; unit: string }
interface Stage { stageId: string; name: string; stageOrder: number; durationDays: number; requirements: Req[] }
interface Profile {
  profileId: string; cropId: string; cropName: string; varietyId?: string | null; varietyName?: string | null;
  name: string; description?: string | null; isSystemDefined: boolean; tenantId?: string | null; sourceProfileId?: string | null; stages: Stage[];
}

const invalidRange = (reqs: Req[]) =>
  reqs.find(r => ![r.minValue, r.targetValue, r.maxValue].every(Number.isFinite) || r.minValue > r.targetValue || r.targetValue > r.maxValue);

/**
 * Hồ sơ sinh trưởng của một cây. Profile hệ thống không sửa trực tiếp: bấm "Sao chép để chỉnh" mở ô sửa với tên gợi ý
 * “Zone - Mùa vụ - Cây”; "Lưu bản sao" tạo bản của trang trại kèm ngưỡng đã chỉnh. Bản của trang trại sửa trực tiếp từng giai đoạn.
 */
export const GrowthProfilesManager: React.FC<{
  cropId?: string | null; compact?: boolean; zoneName?: string | null; seasonName?: string | null; cropName?: string | null;
}> = ({ cropId, compact, zoneName, seasonName, cropName }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, Req[]>>({});
  const [dayEdits, setDayEdits] = useState<Record<string, number>>({});
  // Bản sao đang soạn: profile nguồn, tên bản sao và ngưỡng đang chỉnh (theo stageId của profile nguồn).
  const [draft, setDraft] = useState<{ source: Profile; name: string; reqs: Record<string, Req[]>; days: Record<string, number> } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await cropService.getAllGrowthProfiles();
      setProfiles(Array.isArray(data) ? data.filter((p: Profile) => !cropId || p.cropId === cropId) : []);
    } catch { setMessage({ ok: false, text: 'Không tải được danh sách profile.' }); }
  };
  useEffect(() => { load(); }, [cropId]);

  const errorText = (e: any) => e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Không thực hiện được.';

  const suggestedName = (p: Profile) =>
    [zoneName, seasonName, cropName || p.cropName].filter(x => !!x && String(x).trim()).join(' - ') || `${p.name} - Tùy chỉnh`;

  const startCopy = (p: Profile) => {
    setDraft({ source: p, name: suggestedName(p), reqs: Object.fromEntries(p.stages.map(s => [s.stageId, s.requirements.map(r => ({ ...r }))])), days: Object.fromEntries(p.stages.map(s => [s.stageId, s.durationDays])) });
    setOpen(o => ({ ...o, [p.profileId]: true }));
    setMessage(null);
  };

  const saveCopy = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setMessage({ ok: false, text: 'Hãy đặt tên cho bản sao.' }); return; }
    for (const s of draft.source.stages) {
      const d = draft.days[s.stageId];
      if (!Number.isInteger(d) || d < 1 || d > 365) { setMessage({ ok: false, text: `Giai đoạn “${s.name}”: số ngày phải là số nguyên từ 1 đến 365.` }); return; }
      const bad = invalidRange(draft.reqs[s.stageId]);
      if (bad) { setMessage({ ok: false, text: `Giai đoạn “${s.name}” – ${PARAM_LABEL[bad.parameterCode] ?? bad.parameterCode}: cần nhỏ nhất ≤ mục tiêu ≤ lớn nhất.` }); return; }
    }
    setBusy(true);
    try {
      const created = await cropService.createGrowthProfile({
        cropId: draft.source.cropId, varietyId: draft.source.varietyId || undefined, name, description: draft.source.description || undefined,
        sourceProfileId: draft.source.profileId, isDefault: false,
      });
      // Chỉ gửi những giai đoạn có ngưỡng thay đổi so với bản gốc.
      const createdStages: Stage[] = created?.stages ?? [];
      for (const s of draft.source.stages) {
        const changed = JSON.stringify(draft.reqs[s.stageId]) !== JSON.stringify(s.requirements);
        const target = createdStages.find(c => c.stageOrder === s.stageOrder);
        if (changed && target) await cropService.updateStageRequirements(target.stageId, draft.reqs[s.stageId]);
        if (target && draft.days[s.stageId] !== s.durationDays) await cropService.updateStageDuration(target.stageId, draft.days[s.stageId]);
      }
      setDraft(null);
      setMessage({ ok: true, text: `Đã lưu bản sao “${name}”. Khi tạo vụ, chọn bản này để dùng ngưỡng đã chỉnh (không đổi vụ đang chạy).` });
      await load();
    } catch (e) { setMessage({ ok: false, text: errorText(e) }); } finally { setBusy(false); }
  };

  const reqsOf = (p: Profile, s: Stage) =>
    draft && draft.source.profileId === p.profileId ? draft.reqs[s.stageId] : (edits[s.stageId] ?? s.requirements);

  const daysOf = (p: Profile, s: Stage) => (draft && draft.source.profileId === p.profileId ? draft.days[s.stageId] : (dayEdits[s.stageId] ?? s.durationDays));
  const setDays = (p: Profile, s: Stage, value: string) => {
    const n = Number(value);
    if (draft && draft.source.profileId === p.profileId) setDraft({ ...draft, days: { ...draft.days, [s.stageId]: n } });
    else setDayEdits(prev => ({ ...prev, [s.stageId]: n }));
  };

  const setReq = (p: Profile, s: Stage, code: string, field: 'minValue' | 'targetValue' | 'maxValue', value: string) => {
    const next = reqsOf(p, s).map(r => r.parameterCode === code ? { ...r, [field]: Number(value) } : r);
    if (draft && draft.source.profileId === p.profileId) setDraft({ ...draft, reqs: { ...draft.reqs, [s.stageId]: next } });
    else setEdits(prev => ({ ...prev, [s.stageId]: next }));
  };

  const saveStage = async (s: Stage) => {
    const reqs = edits[s.stageId] ?? s.requirements;
    const days = dayEdits[s.stageId] ?? s.durationDays;
    if (!Number.isInteger(days) || days < 1 || days > 365) { setMessage({ ok: false, text: 'Số ngày phải là số nguyên từ 1 đến 365.' }); return; }
    const bad = invalidRange(reqs);
    if (bad) { setMessage({ ok: false, text: `${PARAM_LABEL[bad.parameterCode] ?? bad.parameterCode}: cần nhỏ nhất ≤ mục tiêu ≤ lớn nhất.` }); return; }
    setBusy(true);
    try {
      if (edits[s.stageId]) await cropService.updateStageRequirements(s.stageId, reqs);
      if (dayEdits[s.stageId] !== undefined && days !== s.durationDays) await cropService.updateStageDuration(s.stageId, days);
      setEdits(prev => { const { [s.stageId]: _, ...rest } = prev; return rest; });
      setDayEdits(prev => { const { [s.stageId]: _, ...rest } = prev; return rest; });
      setMessage({ ok: true, text: `Đã lưu ngưỡng giai đoạn “${s.name}”. Chỉ áp dụng cho vụ tạo sau; vụ đang chạy giữ ngưỡng đã chụp.` });
      await load();
    } catch (e) { setMessage({ ok: false, text: errorText(e) }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        {!compact && <h1 className="text-xl font-bold text-slate-900">Hồ sơ sinh trưởng</h1>}
        <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
          <Info size={14} className="mt-0.5 shrink-0" />
          Profile hệ thống không sửa trực tiếp: bấm “Sao chép để chỉnh”, sửa ngưỡng rồi lưu thành bản của trang trại. Chỉnh sửa chỉ áp dụng cho vụ tạo sau.
        </p>
      </div>
      {message && <div className={`text-xs rounded-lg p-2.5 border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{message.text}</div>}

      <div className="space-y-3">
        {profiles.map(p => {
          const mine = !p.isSystemDefined && !!p.tenantId;
          const drafting = draft?.source.profileId === p.profileId;
          const expanded = !!open[p.profileId] || drafting;
          const editable = mine || drafting;
          return (
            <div key={p.profileId} className={`bg-white border rounded-2xl ${drafting ? 'border-emerald-400' : 'border-slate-200'}`}>
              <div className="p-3.5 flex items-center justify-between gap-3">
                <button type="button" className="flex items-center gap-2 text-left" onClick={() => setOpen(o => ({ ...o, [p.profileId]: !expanded }))}>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.cropName}{p.varietyName ? ` (${p.varietyName})` : ' (chung cho cả cây)'} • {p.stages.length} giai đoạn • {p.stages.reduce((n, s) => n + daysOf(p, s), 0)} ngày kế hoạch
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${mine ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{mine ? 'Của trang trại' : 'Hệ thống'}</span>
                  {!mine && !drafting && <Button size="sm" variant="outline" disabled={busy} onClick={() => startCopy(p)}><Copy size={13} className="mr-1" /> Sao chép để chỉnh</Button>}
                </div>
              </div>

              {drafting && draft && (
                <div className="mx-3.5 mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Tên bản sao (Zone - Mùa vụ - Cây)</label>
                  <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(null)}><X size={13} className="mr-1" /> Hủy</Button>
                    <Button size="sm" disabled={busy} onClick={saveCopy}><Save size={13} className="mr-1" /> Lưu bản sao</Button>
                  </div>
                </div>
              )}

              {expanded && (
                <div className="border-t border-slate-100 p-3.5 space-y-3">
                  {[...p.stages].sort((a, b) => a.stageOrder - b.stageOrder).map(s => (
                    <div key={s.stageId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm text-slate-900 flex items-center gap-2">
                          {s.stageOrder}. {s.name}
                          {editable
                            ? <span className="text-xs font-normal text-slate-500 flex items-center gap-1">(<input type="number" min={1} max={365} value={daysOf(p, s)} onChange={e => setDays(p, s, e.target.value)} className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs" /> ngày)</span>
                            : <span className="text-xs font-normal text-slate-500">({s.durationDays} ngày)</span>}
                        </strong>
                        {mine && !drafting && (edits[s.stageId] || dayEdits[s.stageId] !== undefined) && <Button size="sm" disabled={busy} onClick={() => saveStage(s)}><Save size={13} className="mr-1" /> Lưu</Button>}
                      </div>
                      <div className="grid grid-cols-[1fr_repeat(3,90px)_50px] gap-2 text-xs items-center">
                        <span className="font-bold text-slate-500">Thông số</span><span className="font-bold text-slate-500">Nhỏ nhất</span><span className="font-bold text-slate-500">Mục tiêu</span><span className="font-bold text-slate-500">Lớn nhất</span><span />
                        {reqsOf(p, s).map(r => (
                          <React.Fragment key={r.parameterCode}>
                            <span className="text-slate-800">{PARAM_LABEL[r.parameterCode] ?? r.parameterCode}</span>
                            {(['minValue', 'targetValue', 'maxValue'] as const).map(field => (
                              editable
                                ? <Input key={field} type="number" value={r[field]} onChange={e => setReq(p, s, r.parameterCode, field, e.target.value)} />
                                : <span key={field} className="font-mono">{r[field]}</span>
                            ))}
                            <span className="text-slate-500">{r.unit}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {profiles.length === 0 && <p className="text-sm text-slate-500">Chưa có profile nào.</p>}
      </div>
    </div>
  );
};
