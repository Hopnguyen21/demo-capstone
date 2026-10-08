import React from 'react';
import { CropRangeBand } from '../../components/ui/BaseUI';
import { Activity, Clock, CheckCircle, Sliders, ArrowRight } from 'lucide-react';

const defaultProfile = {
  growthProfileId: 'profile-tomato-std',
  cropId: 'crop-tomato',
  varietyId: 'var-beefsteak',
  name: 'Quy trình Cà chua Beefsteak Chuẩn 90 ngày',
  description: 'Hồ sơ sinh trưởng 5 giai đoạn thích ứng vi khí hậu',
  isDefault: true,
  stages: [
    { growthStageId: 'stage-1', growthProfileId: 'profile-tomato-std', name: 'Cây non (Seedling)', stageOrder: 1, durationDays: 14, description: 'Yêu cầu độ ẩm đất cao và ánh sáng vừa phải' },
    { growthStageId: 'stage-2', growthProfileId: 'profile-tomato-std', name: 'Sinh trưởng (Vegetative)', stageOrder: 2, durationDays: 25, description: 'Cần dinh dưỡng NPK cân bằng và độ ẩm 65-75%' },
    { growthStageId: 'stage-3', growthProfileId: 'profile-tomato-std', name: 'Ra hoa (Flowering)', stageOrder: 3, durationDays: 15, description: 'Giai đoạn nhạy cảm nhiệt độ (tối ưu 22-26°C), duy trì ẩm đất 70%' },
    { growthStageId: 'stage-4', growthProfileId: 'profile-tomato-std', name: 'Nuôi trái (Fruit Dev)', stageOrder: 4, durationDays: 26, description: 'Nhu cầu nước lớn nhất, ánh sáng mạnh 700-900 lux' },
    { growthStageId: 'stage-5', growthProfileId: 'profile-tomato-std', name: 'Thu hoạch (Harvest)', stageOrder: 5, durationDays: 10, description: 'Giảm lượng nước tưới nhẹ để tăng độ đường brix' },
  ],
  requirements: {
    'stage-3': [
      { requirementId: 'req-1', growthStageId: 'stage-3', parameterCode: 'SOIL_MOISTURE', minValue: 60, maxValue: 80, targetValue: 70, unit: '%', description: 'Độ ẩm đất tối ưu cho thụ phấn ra hoa' },
      { requirementId: 'req-2', growthStageId: 'stage-3', parameterCode: 'TEMPERATURE', minValue: 18, maxValue: 28, targetValue: 24, unit: '°C', description: 'Nhiệt độ không khí duy trì độ nảy mầm hạt phấn' },
      { requirementId: 'req-3', growthStageId: 'stage-3', parameterCode: 'AIR_HUMIDITY', minValue: 60, maxValue: 80, targetValue: 70, unit: '%', description: 'Tránh nấm phấn trắng khi ẩm quá cao' },
      { requirementId: 'req-4', growthStageId: 'stage-3', parameterCode: 'LIGHT_INTENSITY', minValue: 500, maxValue: 950, targetValue: 750, unit: 'lux', description: 'Ánh sáng tổng hợp diệp lục' },
    ]
  }
};

export const GrowthProfilesPage: React.FC = () => {
  const profile = defaultProfile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="text-[#062326]" size={22} /> Cấu hình Hồ sơ Sinh trưởng & Ngưỡng Vi khí hậu mẫu
        </h1>
        <p className="text-xs text-slate-600 mt-1">Cơ chế Crop-aware 4 tầng: Cây ➔ Giống ➔ Hồ sơ sinh trưởng ➔ Giai đoạn ➔ Dải ngưỡng vi khí hậu thích ứng.</p>
      </div>

      {/* Profile Overview Banner */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#062326] border border-emerald-200">
            HỒ SƠ CHUẨN SYSTEM DEFAULT
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">{profile.name}</h2>
          <p className="text-xs text-slate-600">{profile.description}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">Tổng thời gian chu kỳ</span>
          <span className="text-xl font-bold text-[#062326]">90 Ngày</span>
        </div>
      </div>

      {/* Timeline of Growth Stages */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock size={16} className="text-[#062326]" /> Các giai đoạn sinh trưởng (Growth Stages Timeline)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {profile.stages.map(st => (
            <div key={st.growthStageId} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-5 h-5 rounded-full bg-[#062326] text-white text-xs font-bold flex items-center justify-center">
                  {st.stageOrder}
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-500">{st.durationDays} ngày</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{st.name}</h4>
              <p className="text-[11px] text-slate-600 leading-snug line-clamp-3">{st.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Environmental Requirements Range Bands for Active Stage */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders size={16} className="text-[#062326]" /> Dải ngưỡng Vi khí hậu Giai đoạn: <span className="text-[#062326] font-semibold">Ra hoa (Flowering)</span>
            </h3>
            <p className="text-xs text-slate-500">Tự động cập nhật vào Alert Engine & Relay Control khi vụ mùa bước sang giai đoạn này.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CropRangeBand label="Độ ẩm đất (Soil Moisture)" min={60} max={80} target={70} current={68.4} unit="%" />
          <CropRangeBand label="Nhiệt độ không khí (Air Temp)" min={18} max={28} target={24} current={24.8} unit="°C" />
          <CropRangeBand label="Độ ẩm không khí (Humidity)" min={60} max={80} target={70} current={71.5} unit="%" />
          <CropRangeBand label="Cường độ ánh sáng (Lux)" min={500} max={950} target={750} current={740} unit="lux" />
        </div>
      </div>
    </div>
  );
};
