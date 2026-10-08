import React, { useState, useEffect } from 'react';
import { MetricCard, StatusBadge, CropRangeBand, Button } from '../../components/ui/BaseUI';
import { mockWeather } from '../../mocks/mockData';
import { useAuth } from '../../app/providers/AuthContext';
import { alertService, aiService } from '../../services';
import { Alert } from '../../types';
import { Sprout, Gauge, Sliders, ShieldAlert, Bot, Sun, CloudRain, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { farms, zones } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    alertService.getAlerts().then(data => {
      if (Array.isArray(data)) setAlerts(data);
    }).catch(err => console.error(err));
  }, []);

  const farm = farms[0] || { name: 'Demo Hydroponic Farm', farmId: '30000000-0000-0000-0000-000000000001' };
  const zone = zones[0] || { name: 'Demo Greenhouse Zone', zoneId: '32000000-0000-0000-0000-000000000001', currentCrop: 'Dưa leo (Cucumber)', currentStage: 'Vegetative' };
  const weather = mockWeather;
  const activeAlerts = alerts.filter(a => (a.status as any) === 'OPEN' || (a.status as any) === 'Open');
  const activeRecommendation = {
    title: 'Khuyến nghị Tối ưu Vi khí hậu Nông học VietGAP',
    actionText: 'Duy trì độ ẩm đất 65-70% và thông gió nhẹ buổi chiều.',
    confidenceScore: 92,
    recommendationText: 'Duy trì độ ẩm đất 65-70% và thông gió nhẹ buổi chiều nhằm tăng khả năng hấp thu khoáng chất.',
    reasoning: 'Giai đoạn phát triển thân lá đòi hỏi cân bằng bốc thoát hơi nước, giảm nguy cơ nấm cổ rễ.',
    expectedImpact: 'Tăng 8% tốc độ quang hợp và phát triển chồi non.',
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-emerald-50 via-white to-slate-50 border border-emerald-200/80 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs font-mono font-semibold text-[#062326] uppercase tracking-wider">Bảng điều khiển Trung tâm</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Nông trang: {farm.name}</h1>
          <p className="text-xs text-slate-600 mt-1 flex items-center gap-2">
            <span>Đang canh tác: <strong className="text-slate-900">{zone.currentCrop}</strong></span>
            <span>•</span>
            <span>Giai đoạn: <strong className="text-[#062326]">{zone.currentStage}</strong></span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/owner/farms/create')}>
            <Sprout size={16} className="mr-1.5" /> Tạo Trang trại Mới (Wizard)
          </Button>
        </div>
      </div>

      {/* Live Environmental Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Độ ẩm đất (Soil Moisture)"
          value="68.4"
          unit="%"
          subtext="Mục tiêu: 60% - 80%"
          icon={<Gauge size={20} />}
          status="normal"
          trend="up"
          trendValue="An toàn"
        />
        <MetricCard
          title="Nhiệt độ Không khí"
          value="24.8"
          unit="°C"
          subtext="Dải tối ưu: 18 - 28°C"
          icon={<Sun size={20} />}
          status="normal"
          trend="neutral"
          trendValue="Ổn định"
        />
        <MetricCard
          title="Độ ẩm Không khí"
          value="71.5"
          unit="%"
          subtext="Mục tiêu: 65% - 80%"
          icon={<CloudRain size={20} />}
          status="normal"
        />
        <MetricCard
          title="Trạng thái Bơm tưới"
          value="SẴN SÀNG"
          unit=""
          subtext="Lần tưới gần nhất: 15 phút trước"
          icon={<Sliders size={20} />}
          status="normal"
        />
      </div>

      {/* AI Recommendation Alert Card */}
      {activeRecommendation && (
        <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#062326] font-bold text-sm">
              <Bot size={20} className="text-[#062326]" /> Trợ lý AI Nông học VietGAP Khuyến nghị: {activeRecommendation.title}
            </div>
            <span className="text-xs font-mono font-bold text-[#062326] bg-emerald-100 px-2.5 py-1 rounded border border-emerald-200">
              Độ tin cậy: {activeRecommendation.confidenceScore}%
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">{activeRecommendation.recommendationText}</p>
          <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-emerald-100 font-mono">
            <strong>Lý do nông học:</strong> {activeRecommendation.reasoning}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-[#062326]">Tác động dự kiến: {activeRecommendation.expectedImpact}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline"><XCircle size={14} className="mr-1" /> Từ chối</Button>
              <Button size="sm" variant="primary"><CheckCircle2 size={14} className="mr-1" /> Áp dụng ngay</Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Telemetry Range Bands */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
          <span>Dải vi khí hậu Thích ứng (Crop-aware)</span>
          <span className="text-xs text-[#062326] font-semibold">Nhà màng 01</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CropRangeBand label="Độ ẩm đất (Soil Moisture)" min={60} max={80} target={70} current={68.4} unit="%" />
          <CropRangeBand label="Nhiệt độ (Temperature)" min={18} max={28} target={24} current={24.8} unit="°C" />
          <CropRangeBand label="Độ ẩm không khí (Humidity)" min={60} max={80} target={70} current={71.5} unit="%" />
          <CropRangeBand label="Ánh sáng (Light)" min={500} max={950} target={750} current={740} unit="lux" />
        </div>
      </div>
    </div>
  );
};
