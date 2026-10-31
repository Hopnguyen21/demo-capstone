import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/BaseUI';
import { cropService, seasonService } from '../../services';
import type { Zone } from '../../types';
import { zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';

const PARAM_LABEL: Record<string, string> = {
  Temperature: 'Nhiệt độ', SoilMoisture: 'Độ ẩm đất', AirHumidity: 'Độ ẩm không khí', Ph: 'pH', LightIntensity: 'Ánh sáng', Ec: 'EC',
};

const daysBetween = (fromIso: string, to = new Date()) => {
  const [y, m, d] = fromIso.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const today = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(0, Math.round((today - start) / 86400000));
};

/** Chi tiết cây trồng của một Zone từ dữ liệu thật: cây của Zone, vụ đang chạy, các giai đoạn và ngưỡng của hồ sơ sinh trưởng. */
export const ZoneCropDetailModal: React.FC<{ zone: Zone | null; onClose: () => void }> = ({ zone, onClose }) => {
  const [season, setSeason] = useState<any | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeason(null); setStages([]);
    if (!zone || zone.seasonStatus !== 'InProgress') return;
    setLoading(true);
    seasonService.getSeasons(zone.zoneId)
      .then(async (list: any[]) => {
        const active = (Array.isArray(list) ? list : []).find(s => s.status === 'InProgress');
        setSeason(active ?? null);
        if (active?.growthProfileId) {
          const st = await cropService.getGrowthStages(active.growthProfileId).catch(() => []);
          setStages(Array.isArray(st) ? [...st].sort((a, b) => a.stageOrder - b.stageOrder) : []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [zone?.zoneId, zone?.seasonStatus]);

  return (
    <Modal isOpen={!!zone} onClose={onClose} title={`Cây trồng của Zone: ${zone?.name ?? ''}`} size="lg">
      {zone && (
        <div className="space-y-4 text-sm">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-600">Cây trồng:</span><strong className="text-emerald-900">{zoneCropLabel(zone)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate-600 shrink-0">Giai đoạn:</span><strong className="text-sky-800 text-right">{zoneStageLabel(zone)}</strong></div>
            {season && (
              <>
                <div className="flex justify-between"><span className="text-slate-600">Vụ:</span><strong>{season.name}</strong></div>
                <div className="flex justify-between"><span className="text-slate-600">Bắt đầu:</span><strong>{season.startDate} (đã {daysBetween(season.startDate)} ngày)</strong></div>
                <div className="flex justify-between"><span className="text-slate-600">Kết thúc dự kiến:</span><strong>{season.expectedEndDate}</strong></div>
                <p className="text-[11px] text-slate-500 pt-1">Ngày kết thúc dự kiến của vụ không phải ngày thu hoạch.</p>
              </>
            )}
          </div>

          {loading && <p className="text-xs text-slate-500">Đang tải…</p>}
          {!loading && zone.seasonStatus !== 'InProgress' && (
            <p className="text-xs text-slate-600">Chưa có vụ đang canh tác cùng cây của Zone nên chưa có giai đoạn và ngưỡng. Nhờ chủ trang trại tạo vụ mùa cho Zone này.</p>
          )}

          {stages.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Các giai đoạn của hồ sơ “{season?.growthProfileName}”</h4>
              {stages.map(s => {
                const current = s.stageId === season?.currentGrowthStageId;
                return (
                  <div key={s.stageId} className={`p-3 rounded-xl border ${current ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900">{s.stageOrder}. {s.name}</strong>
                      <span className="text-[11px] text-slate-500">{s.durationDays} ngày kế hoạch{current ? ' • đang ở giai đoạn này' : ''}</span>
                    </div>
                    {(s.requirements ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {s.requirements.map((r: any) => (
                          <span key={r.parameterCode} className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700">
                            {PARAM_LABEL[r.parameterCode] ?? r.parameterCode}: {r.minValue}–{r.maxValue} {r.unit}
                          </span>
                        ))}
                      </div>
                    )}
                    {(s.fertilizerAction || s.ipmAction) && (
                      <p className="mt-1.5 text-[11px] text-slate-600">
                        {s.fertilizerAction && <span>Bón phân: {s.fertilizerAction}. </span>}
                        {s.ipmAction && <span>Phòng trừ: {s.ipmAction}.</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
