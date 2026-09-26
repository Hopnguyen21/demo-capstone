import React from 'react';
import { Sliders, ShieldCheck } from 'lucide-react';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FarmerIrrigationPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
            TIÊU CHUẨN CF3 - FARM WORKER HUB
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="text-[#062326]" size={22} /> Kích hoạt Bơm Tưới Thực địa & Quản lý Vi khí hậu
          </h1>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Nông dân được cấp quyền bật/tắt tưới thủ công (hẹn giờ tối đa 15 phút per BR-SAFE-01) và theo dõi lịch tưới tự động tại Zone phụ trách.
        </p>
      </div>

      {/* Standardized Reusable CF3 Control Hub Scoped for Farmer */}
      <CF3ControlSection
        scopeLevel="FARMER"
        title="Trung tâm Bật Tưới Thủ công & Lịch tưới Nông dân"
        subtitle="Vận hành trực tiếp Rơ-le rơ-le Bơm/Van solenoid theo thời lượng an toàn, theo dõi vi khí hậu thực địa."
        showVisualizerTab={true}
      />
    </div>
  );
};
