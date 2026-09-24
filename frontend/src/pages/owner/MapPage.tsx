import React from 'react';
import { MapPin, Layers } from 'lucide-react';
import { FarmGISMap } from '../../components/maps/FarmGISMap';

export const MapPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="text-[#062326]" size={22} /> Bản đồ GIS Số Phân vùng Nông trang
        </h1>
        <p className="text-xs text-slate-500 mt-1">Trực quan hóa vị trí địa lý của Trang trại, Lô đất, Nhà màng, Gateway và các Node cảm biến LoRa.</p>
      </div>

      <FarmGISMap height="650px" />
    </div>
  );
};
