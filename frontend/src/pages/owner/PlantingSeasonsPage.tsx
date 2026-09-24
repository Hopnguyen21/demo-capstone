import React from 'react';
import { mockPlantingSeasons } from '../../mocks/mockData';
import { Calendar, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const PlantingSeasonsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-[#062326]" size={22} /> Quản lý Vụ mùa & Tiến trình Sinh trưởng (Planting Seasons)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Theo dõi tiến độ phát triển của cây theo dải thời gian thực tế và chuyển giai đoạn sinh trưởng.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Kích hoạt Vụ mùa Mới</Button>
      </div>

      <div className="space-y-4">
        {mockPlantingSeasons.map(s => (
          <div key={s.plantingSeasonId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#062326] border border-emerald-200">
                  {s.cropName} ({s.varietyName})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{s.name}</h3>
                <p className="text-xs text-slate-500">{s.zoneName}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                <span>Tiến độ sinh trưởng vụ mùa</span>
                <span className="text-[#062326] font-bold">{s.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#062326] rounded-full transition-all duration-500" style={{ width: `${s.progressPercent}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
              <div><span className="text-slate-500 block text-[10px]">Ngày bắt đầu</span><strong className="text-slate-900">{s.startDate}</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Dự kiến thu hoạch</span><strong className="text-slate-900">{s.expectedEndDate}</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Giai đoạn hiện tại</span><strong className="text-[#062326]">{s.currentGrowthStageName}</strong></div>
              <div className="text-right">
                <Button size="sm" variant="outline"><Clock size={13} className="mr-1" /> Chuyển Giai đoạn</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
