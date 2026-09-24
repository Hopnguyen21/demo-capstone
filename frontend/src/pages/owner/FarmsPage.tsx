import React from 'react';
import { mockFarms } from '../../mocks/mockData';
import { StatusBadge, Button } from '../../components/ui/BaseUI';
import { Building2, MapPin, Layers, Plus, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FarmsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-[#062326]" size={22} /> Danh sách Trang trại Sở hữu (My Farms)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Quản lý toàn bộ danh sách Nông trang thuộc quyền sở hữu Tenant.</p>
        </div>
        <Button onClick={() => navigate('/owner/farms/create')}>
          <Plus size={16} className="mr-1.5" /> Tạo Trang trại Mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockFarms.map(f => (
          <div key={f.farmId} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-xs hover:border-[#062326]/30 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{f.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin size={13} className="text-[#062326] shrink-0" /> {f.address}
                </p>
              </div>
              <StatusBadge status={f.status} />
            </div>

            <p className="text-xs text-slate-600 line-clamp-2">{f.description}</p>

            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-center text-xs">
              <div><span className="text-slate-500 block text-[10px]">Diện tích</span><strong className="text-slate-900">{(f.areaM2/10000).toFixed(1)} ha</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Lô đất</span><strong className="text-[#062326]">{f.fieldsCount} Fields</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Nhà màng</span><strong className="text-sky-700">{f.zonesCount} Zones</strong></div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => navigate('/owner/dashboard')}>
                Vào Dashboard Chi tiết <ArrowUpRight size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
