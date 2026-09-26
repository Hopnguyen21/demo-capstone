import React, { useState } from 'react';
import { mockZones } from '../../mocks/mockData';
import { Sprout, Sliders, CheckCircle2 } from 'lucide-react';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FarmerZonesPage: React.FC = () => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(mockZones[0]?.zoneId || 'zone-01');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
            ASSIGNED ZONES
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#062326]" size={22} /> Nhà màng được Phân công Canh tác
          </h1>
        </div>
        <p className="text-xs text-slate-600 mt-1">Danh sách khu vực nhà màng thuộc phạm vi phụ trách kỹ thuật của bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockZones.slice(0, 2).map(z => {
          const isSelected = selectedZoneId === z.zoneId;

          return (
            <div
              key={z.zoneId}
              onClick={() => setSelectedZoneId(z.zoneId)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                isSelected
                  ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-200">
                    ASSIGNED ZONE
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{z.name}</h3>
                  <p className="text-xs text-slate-500">{z.description}</p>
                </div>
                {isSelected && <CheckCircle2 className="text-emerald-600" size={20} />}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100 font-mono">
                <div className="flex justify-between"><span>Cây trồng:</span><strong className="text-[#062326]">{z.currentCrop}</strong></div>
                <div className="flex justify-between"><span>Giai đoạn:</span><strong className="text-emerald-700">{z.currentStage}</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Embedded CF3 Control Section for the selected assigned zone */}
      <CF3ControlSection
        scopeLevel="ZONE"
        zoneId={selectedZoneId}
        title={`Điều khiển & Lịch tưới chuẩn CF3 cho Nhà màng [${mockZones.find(z => z.zoneId === selectedZoneId)?.name}]`}
        subtitle="Quản lý vi khí hậu, kích hoạt rơ-le tưới nhỏ giọt / quạt và theo dõi lịch tưới tự động cho Zone được chọn."
      />
    </div>
  );
};
