import React, { useState } from 'react';
import { Sliders, Droplets, Thermometer, Wind, Sun, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, CropRangeBand } from '../ui/BaseUI';
import { EnvironmentalTargetConfig } from '../../types';

interface EnvironmentalParametersPanelProps {
  configs: EnvironmentalTargetConfig[];
  onUpdateConfig?: (updatedConfig: EnvironmentalTargetConfig) => void;
}

export const EnvironmentalParametersPanel: React.FC<EnvironmentalParametersPanelProps> = ({ configs, onUpdateConfig }) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(configs[0]?.zoneId || 'zone-01');
  const [currentConfigs, setCurrentConfigs] = useState<EnvironmentalTargetConfig[]>(configs);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const activeConfig = currentConfigs.find(c => c.zoneId === selectedZoneId) || currentConfigs[0];

  const handleParamChange = (field: keyof EnvironmentalTargetConfig, val: number) => {
    setCurrentConfigs(prev => prev.map(c => {
      if (c.zoneId === selectedZoneId) {
        return { ...c, [field]: val };
      }
      return c;
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    if (onUpdateConfig && activeConfig) {
      onUpdateConfig(activeConfig);
    }
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
              STEP 1 OF CF3
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="text-[#062326]" size={18} />
              Set / Confirm Environmental Control Parameters
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Cấu hình dải chỉ số môi trường mục tiêu cho cây trồng để Rule Engine làm căn cứ tự động kích hoạt Bơm, Quạt, Van và Đèn quang hợp.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Khu vực (Zone):</label>
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 text-slate-900"
          >
            {currentConfigs.map(c => (
              <option key={c.zoneId} value={c.zoneId}>
                {c.zoneName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Range Bands for Selected Zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CropRangeBand
          label="Độ ẩm đất (Soil Moisture)"
          min={activeConfig.minSoilMoisture}
          max={activeConfig.maxSoilMoisture}
          target={activeConfig.targetSoilMoisture}
          current={68.4}
          unit="%"
        />
        <CropRangeBand
          label="Nhiệt độ Không khí (Air Temp)"
          min={18}
          max={activeConfig.maxTemperature}
          target={activeConfig.maxTemperature - 3}
          current={24.8}
          unit="°C"
        />
        <CropRangeBand
          label="Độ ẩm Không khí (Humidity)"
          min={60}
          max={85}
          target={activeConfig.targetHumidity}
          current={71.5}
          unit="%"
        />
        <CropRangeBand
          label="Cường độ Ánh sáng (Lux)"
          min={2000}
          max={10000}
          target={activeConfig.targetLux}
          current={740}
          unit="lux"
        />
      </div>

      {/* Parameter Control Sliders / Inputs */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders size={14} className="text-[#062326]" /> Điều chỉnh Ngưỡng Tham số {activeConfig.zoneName}
          </h4>
          {isSaved && (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in duration-200">
              <CheckCircle2 size={14} /> Đã cập nhật tham số thành công!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Soil moisture target */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1 text-sky-700">
                <Droplets size={14} /> Mục tiêu Độ ẩm Đất
              </span>
              <span className="text-emerald-700 font-mono text-sm">{activeConfig.targetSoilMoisture}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={90}
              value={activeConfig.targetSoilMoisture}
              onChange={(e) => handleParamChange('targetSoilMoisture', Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Tưới khi &lt; {activeConfig.minSoilMoisture}%</span>
              <span>Dừng khi &gt; {activeConfig.maxSoilMoisture}%</span>
            </div>
          </div>

          {/* Max Temperature */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1 text-amber-700">
                <Thermometer size={14} /> Ngưỡng Nhiệt tối đa
              </span>
              <span className="text-amber-700 font-mono text-sm">{activeConfig.maxTemperature}°C</span>
            </div>
            <input
              type="range"
              min={22}
              max={35}
              value={activeConfig.maxTemperature}
              onChange={(e) => handleParamChange('maxTemperature', Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <div className="text-[10px] text-slate-500">
              Tự động bật Quạt đối lưu khi T &gt; {activeConfig.maxTemperature}°C
            </div>
          </div>

          {/* Target Humidity */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1 text-emerald-700">
                <Wind size={14} /> Độ ẩm Không khí
              </span>
              <span className="text-emerald-700 font-mono text-sm">{activeConfig.targetHumidity}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              value={activeConfig.targetHumidity}
              onChange={(e) => handleParamChange('targetHumidity', Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="text-[10px] text-slate-500">
              Duy trì độ ẩm không khí tối ưu cho thụ phấn
            </div>
          </div>

          {/* Target Lux */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1 text-purple-700">
                <Sun size={14} /> Ánh sáng GrowLight
              </span>
              <span className="text-purple-700 font-mono text-sm">{activeConfig.targetLux} Lux</span>
            </div>
            <input
              type="range"
              min={2000}
              max={10000}
              step={500}
              value={activeConfig.targetLux}
              onChange={(e) => handleParamChange('targetLux', Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="text-[10px] text-slate-500">
              Bổ sung đèn khi ánh sáng tự nhiên &lt; {activeConfig.targetLux} Lux
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleSave}>
            <CheckCircle2 size={14} className="mr-1.5" />
            Lưu Ngưỡng Tham Số Vi Khí Hậu
          </Button>
        </div>
      </div>
    </div>
  );
};
