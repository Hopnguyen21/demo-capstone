import React, { useState } from 'react';
import { Power, Sliders, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';

export const FarmerIrrigationPage: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="text-[#062326]" size={22} /> Kích hoạt Bơm Tưới Thực địa
        </h1>
        <p className="text-xs text-slate-600 mt-1">Nông dân được cấp quyền bật tưới thủ công 15 phút tại Zone phụ trách.</p>
      </div>

      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs text-center space-y-4">
        <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 transition-all ${isRunning ? 'bg-emerald-50 border-[#062326] text-[#062326] animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
          <Power size={40} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">Bơm Tưới Nhỏ Giọt Zone 01</h3>
          <p className="text-xs text-slate-500">Trạng thái: <strong className={isRunning ? 'text-[#062326]' : 'text-slate-500'}>{isRunning ? 'ĐANG CHẠY TƯỚI (15 PHÚT)' : 'ĐANG TẮT'}</strong></p>
        </div>

        <Button size="lg" variant={isRunning ? 'danger' : 'primary'} onClick={() => setIsRunning(!isRunning)} className="w-full">
          {isRunning ? 'TẮT BƠM NGAY' : 'BẬT BƠM TƯỚI (15 PHÚT)'}
        </Button>
      </div>
    </div>
  );
};
