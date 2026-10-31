import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button, Modal, Input } from '../ui/BaseUI';
import { farmingSeasonService, seasonService } from '../../services';
import type { Crop, FarmingSeason, Zone } from '../../types';
import { NO_CROP_LABEL, zoneCropLabel } from '../../utils/zoneCrop';

/** Các Zone đang áp dụng một mùa vụ (mỗi Zone có một vụ trồng riêng) và nút đi tới Zone. */
export const SeasonZonesModal: React.FC<{
  season: FarmingSeason | null;
  onClose: () => void;
  onOpenZone: (zoneId: string) => void;
}> = ({ season, onClose, onOpenZone }) => {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    setItems(null);
    if (!season) return;
    farmingSeasonService.getSeasonPlantingCrops(season.id).then(r => setItems(Array.isArray(r) ? r : [])).catch(() => setItems([]));
  }, [season?.id]);

  return (
    <Modal isOpen={!!season} onClose={onClose} title={`Zone áp dụng mùa vụ: ${season?.name ?? ''}`} size="lg">
      {items === null ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Chưa có Zone nào áp dụng mùa vụ này.</p>
      ) : (
        <div className="space-y-2">
          {items.map((b: any) => (
            <div key={b.plantingSeasonId ?? b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 text-sm">
              <div>
                <strong className="text-slate-900">{b.zoneName ?? 'Zone'}</strong>
                <div className="text-xs text-slate-600">{b.cropName}{b.varietyName ? ` (${b.varietyName})` : ''} • {b.status} • {b.startDate} → {b.expectedEndDate}</div>
              </div>
              <button type="button" onClick={() => onOpenZone(b.zoneId)} className="text-[#119653] font-bold text-xs flex items-center gap-1 hover:underline">
                Đến Zone <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

/** Tạo vụ cho nhiều Zone: mỗi Zone một vụ trồng riêng cùng mùa vụ; kiểm tra trước, rồi tạo tất cả hoặc chỉ các Zone hợp lệ. */
export const BulkSeasonModal: React.FC<{
  season: FarmingSeason | null;
  zones: Zone[];
  crops: Crop[];
  cropProfiles: Record<string, any[]>;
  onClose: () => void;
  onCreated: () => void;
}> = ({ season, zones, crops, cropProfiles, onClose, onCreated }) => {
  const [cropId, setCropId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [prefix, setPrefix] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmCrop, setConfirmCrop] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!season) return;
    setCropId(''); setProfileId(''); setPrefix(season.name); setResults(null); setError(''); setSelected({}); setConfirmCrop({});
    setStartDate(new Date().toISOString().slice(0, 10)); setEndDate('');
  }, [season?.id]);

  const profiles = cropProfiles[cropId] ?? [];
  const profileIdOf = (p: any): string => p?.growthProfileId || p?.profileId || p?.id || '';
  const chosenProfile = profiles.find(p => profileIdOf(p) === profileId);
  const selectedIds = useMemo(() => zones.filter(z => selected[z.zoneId]).map(z => z.zoneId), [zones, selected]);
  const ready = !!cropId && !!profileId && !!prefix.trim() && !!endDate && selectedIds.length > 0;

  const call = async (dryRun: boolean, skipInvalid: boolean) => {
    if (!season) return;
    setBusy(true); setError('');
    try {
      const res = await seasonService.bulkCreate(season.id, {
        cropId, varietyId: chosenProfile?.varietyId || undefined, growthProfileId: profileId, namePrefix: prefix.trim(),
        startDate, expectedEndDate: endDate,
        zones: selectedIds.map(zoneId => ({ zoneId, setZoneCrop: !!confirmCrop[zoneId] })),
        dryRun, skipInvalid,
      });
      setResults(res.zones);
      if (res.created) { onCreated(); onClose(); }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Không thực hiện được.');
    } finally { setBusy(false); }
  };

  const problemsOf = (zoneId: string): string[] => results?.find(r => r.zoneId === zoneId)?.problems ?? [];

  return (
    <Modal isOpen={!!season} onClose={onClose} title={`Áp dụng mùa vụ cho nhiều Zone: ${season?.name ?? ''}`} size="xl">
      <div className="space-y-4 text-sm">
        <p className="text-xs text-slate-600">Mỗi Zone được tạo một vụ trồng riêng (giai đoạn, sản lượng và ngày thu hoạch của Zone này không ảnh hưởng Zone khác). Một Zone chỉ có một vụ trong một mùa vụ.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Cây trồng *</label>
            <select value={cropId} onChange={e => { setCropId(e.target.value); setProfileId(''); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">-- Chọn cây --</option>
              {crops.filter(c => (cropProfiles[c.cropId]?.length ?? 0) > 0).map(c => <option key={c.cropId} value={c.cropId}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Hồ sơ sinh trưởng *</label>
            <select value={profileId} onChange={e => setProfileId(e.target.value)} disabled={!cropId} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">-- Chọn hồ sơ --</option>
              {profiles.map(p => <option key={profileIdOf(p)} value={profileIdOf(p)}>{p.name + (p.isSystemDefined ? ' — hệ thống' : ' — của trang trại')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Tiền tố tên vụ *</label>
            <Input value={prefix} onChange={e => setPrefix(e.target.value)} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ngày bắt đầu *</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ngày kết thúc dự kiến *</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="font-bold text-slate-700 mb-1">Chọn Zone ({selectedIds.length})</div>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {zones.map(z => {
              const needsConfirm = !!cropId && z.cropId !== cropId;
              const problems = problemsOf(z.zoneId);
              return (
                <div key={z.zoneId} className={`p-2.5 rounded-lg border ${problems.length ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!selected[z.zoneId]} onChange={e => setSelected(s => ({ ...s, [z.zoneId]: e.target.checked }))} />
                    <strong>{z.name}</strong>
                    <span className="text-xs text-slate-500">• {zoneCropLabel(z)}</span>
                  </label>
                  {selected[z.zoneId] && needsConfirm && (
                    <label className="mt-1 ml-6 flex items-center gap-2 text-xs text-amber-800">
                      <input type="checkbox" checked={!!confirmCrop[z.zoneId]} onChange={e => setConfirmCrop(s => ({ ...s, [z.zoneId]: e.target.checked }))} />
                      {z.currentCrop ? `Xác nhận đổi cây của Zone từ “${z.currentCrop}” sang cây này` : `Xác nhận gán cây này cho Zone (hiện: ${NO_CROP_LABEL})`}
                    </label>
                  )}
                  {problems.map(p => <div key={p} className="mt-1 ml-6 text-xs text-rose-700 flex items-center gap-1"><AlertTriangle size={12} /> {p}</div>)}
                  {results && selected[z.zoneId] && problems.length === 0 && <div className="mt-1 ml-6 text-xs text-emerald-700 flex items-center gap-1"><Check size={12} /> Hợp lệ</div>}
                </div>
              );
            })}
          </div>
        </div>

        {error && <div className="text-xs text-rose-700">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose}>Hủy</Button>
          <Button variant="outline" type="button" disabled={!ready || busy} onClick={() => call(true, false)}>Kiểm tra</Button>
          <Button variant="outline" type="button" disabled={!ready || busy} onClick={() => call(false, true)}>Tạo cho Zone hợp lệ</Button>
          <Button type="button" disabled={!ready || busy} onClick={() => call(false, false)}>Tạo tất cả (hủy nếu có lỗi)</Button>
        </div>
      </div>
    </Modal>
  );
};
