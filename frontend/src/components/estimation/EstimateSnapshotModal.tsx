import React, { useMemo } from 'react';
import { Calculator, X } from 'lucide-react';

type Props = { isOpen: boolean; onClose: () => void; snapshot?: string | null };

export const EstimateSnapshotModal: React.FC<Props> = ({ isOpen, onClose, snapshot }) => {
  const data = useMemo(() => {
    if (!snapshot) return null;
    try { return JSON.parse(snapshot); } catch { return null; }
  }, [snapshot]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><Calculator size={18} className="text-emerald-600" /> Dự toán thuật toán Tổ ong đã lưu</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"><X size={18} /></button>
      </div>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 text-sm">
        {!data ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">Chưa có dữ liệu dự toán thuật toán được lưu cho yêu cầu này.</div> : <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Diện tích', `${Number(data.areaM2 || 0).toLocaleString('vi-VN')} m²`], ['Gateway', data.gateways ?? 0], ['Sensor Node', data.sensors ?? 0], ['Actuator', data.actuators ?? 0]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><strong className="text-lg text-slate-900">{value}</strong></div>)}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="font-bold text-emerald-900">Mạng Tổ ong · {data.algorithmVersion || 'v1'}</div><div className="mt-1 text-xs text-slate-600">Bán kính {data.sensingRadiusM || '—'}m/node · Hệ số phủ biên {data.boundaryFactor || '—'}</div><div className="mt-2 text-xl font-black text-emerald-800">{Number(data.totalCostVnd || 0).toLocaleString('vi-VN')} đ</div></div>
          <div className="divide-y rounded-xl border border-slate-200">{(data.estimateItems || []).map((item: any, index: number) => <div key={`${item.role}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3"><div><strong className="text-slate-800">{item.name || item.role}</strong><div className="text-xs text-slate-500">{item.role} · {item.quantity} thiết bị</div></div><span className="font-mono font-semibold text-slate-800">{item.unitPrice ? `${Number(item.unitPrice).toLocaleString('vi-VN')} đ` : '—'}</span></div>)}</div>
        </>}
      </div>
    </div>
  </div>;
};
