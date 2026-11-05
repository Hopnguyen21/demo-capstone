import React from 'react';
import { mockZones } from '../../mocks/mockData';
import { Sprout } from 'lucide-react';

export const FarmerZonesPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sprout className="text-[#062326]" size={22} /> Nhà màng được Phân công
        </h1>
        <p className="text-xs text-slate-500 mt-1">Danh sách khu vực nhà màng thuộc phạm vi phụ trách của bạn.</p>
      </div>

      <div className="space-y-3">
        {mockZones.slice(0, 2).map(z => (
          <div key={z.zoneId} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">{z.name}</h3>
            <p className="text-slate-600">{z.description}</p>
            <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 space-y-1 border border-slate-100">
              <div>Cây trồng: <strong className="text-[#062326]">{z.currentCrop}</strong></div>
              <div>Giai đoạn: <strong className="text-emerald-700">{z.currentStage}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
