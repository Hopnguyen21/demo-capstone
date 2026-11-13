import React from 'react';
import { Sliders, ShieldCheck, Power, Droplets, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FarmerIrrigationPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
              TIÊU CHUẨN CF3 - FARM WORKER HUB
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="text-[#119653]" size={22} /> Kích hoạt Bơm Tưới Thực địa & Điều khiển Rơ-le
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Nông dân được cấp quyền bật/tắt tưới thủ công theo phân khu phụ trách và theo dõi lịch tưới tự động theo tiêu chuẩn an toàn BR-SAFE-01.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#119653]" /> BR-SAFE-01: Giới hạn 15 phút
          </span>
        </div>
      </div>

      {/* Safety Guidelines Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
            <CheckCircle2 size={15} className="text-[#119653]" />
            <span>Tự ngắt bảo vệ rơ-le</span>
          </div>
          <p className="text-emerald-800 text-[11px] leading-relaxed">
            Mỗi phiên tưới thủ công hẹn giờ tối đa 15 phút. Hệ thống tự ngắt rơ-le để chống cháy bơm và ngập úng rễ.
          </p>
        </div>

        <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-2xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-sky-900">
            <Droplets size={15} className="text-sky-600" />
            <span>Độ ẩm đất trước khi tưới</span>
          </div>
          <p className="text-sky-800 text-[11px] leading-relaxed">
            Luôn kiểm tra chỉ số độ ẩm đất tại Zone. Nếu ẩm đất &gt; 70%, chỉ nên kích hoạt phun sương làm mát thay vì tưới đẫm.
          </p>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertTriangle size={15} className="text-amber-600" />
            <span>Ưu tiên lịch tự động</span>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            Lịch tưới tự động (Cron Schedule) sẽ tự kích hoạt theo thời gian biểu vụ mùa. Lệnh thủ công có thể ghi đè tạm thời.
          </p>
        </div>
      </div>

      {/* Standardized Reusable CF3 Control Hub Scoped for Farmer */}
      <CF3ControlSection
        scopeLevel="FARMER"
        title="Trung tâm Bật Tưới Thủ công & Lịch tưới Nông dân"
        subtitle="Vận hành trực tiếp Rơ-le Bơm/Van solenoid theo thời lượng an toàn, theo dõi vi khí hậu thực địa."
      />
    </div>
  );
};
