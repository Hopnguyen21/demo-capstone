import React from 'react';
import { mockZones } from '../../mocks/mockData';
import { StatusBadge, Button, CropRangeBand } from '../../components/ui/BaseUI';
import { Sprout, Plus, Sliders, ArrowUpRight, Gauge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ZonesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#062326]" size={22} /> Quản lý Nhà màng / Khu vực Canh tác (Zones)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Các zone nhà màng khép kín được trang bị cảm biến LoRa và thiết bị chấp hành relay.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Tạo Zone Mới</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockZones.map(z => (
          <div key={z.zoneId} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-xs hover:border-[#062326]/30 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{z.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{z.description}</p>
              </div>
              <StatusBadge status={z.status} />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1 text-slate-700">
              <div className="flex justify-between"><span>Cây trồng hiện tại:</span><strong className="text-[#062326]">{z.currentCrop}</strong></div>
              <div className="flex justify-between"><span>Giai đoạn sinh trưởng:</span><strong className="text-sky-700">{z.currentStage}</strong></div>
              <div className="flex justify-between"><span>Diện tích:</span><strong className="text-slate-900">{z.areaM2} m²</strong></div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1"><Gauge size={13} className="text-[#062326]" /> Cảm biến trực tuyến</span>
              <Button size="sm" variant="outline" onClick={() => navigate('/owner/monitoring/realtime')}>
                Xem Vi khí hậu Realtime <ArrowUpRight size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
