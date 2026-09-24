import React from 'react';
import { mockSensors, mockZones } from '../../mocks/mockData';
import { Gauge, RefreshCw, Sun, CloudRain, ShieldCheck, Activity } from 'lucide-react';
import { StatusBadge, Button, CropRangeBand } from '../../components/ui/BaseUI';

export const MonitoringRealtime: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Gauge className="text-[#062326]" size={22} /> Giám sát Vi khí hậu Thời gian thực (Real-time Telemetry)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Số liệu cảm biến trực tiếp từ các LoRa Sensor Nodes truyền về chu kỳ 60 giây.</p>
        </div>
        <Button variant="outline"><RefreshCw size={15} className="mr-1.5 animate-spin-slow" /> Cập nhật Trực tiếp</Button>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">{mockZones[0].name}</h3>
          <StatusBadge status="ONLINE" label="Khu vực An toàn" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CropRangeBand label="Độ ẩm đất (Soil Moisture)" min={60} max={80} target={70} current={68.4} unit="%" />
          <CropRangeBand label="Nhiệt độ không khí (Air Temp)" min={18} max={28} target={24} current={24.8} unit="°C" />
          <CropRangeBand label="Độ ẩm không khí (Air Humidity)" min={60} max={80} target={70} current={71.5} unit="%" />
          <CropRangeBand label="Cường độ ánh sáng (Light)" min={500} max={950} target={750} current={740} unit="lux" />
        </div>
      </div>

      {/* Sensor Cards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {mockSensors.map(s => (
          <div key={s.sensorId} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-500">{s.sensorCode}</span>
              <StatusBadge status={s.status} />
            </div>
            <h4 className="text-xs font-bold text-slate-900">{s.name}</h4>
            <div className="text-2xl font-bold text-[#062326] pt-1">
              {s.lastReading} <span className="text-xs font-normal text-slate-500">{s.unit}</span>
            </div>
            <span className="text-[10px] text-slate-400 block">Cập nhật: {s.lastReadingAt}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
