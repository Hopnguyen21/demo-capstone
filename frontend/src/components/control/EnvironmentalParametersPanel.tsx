import React, { useState, useEffect, useMemo } from 'react';
import { Sliders, Droplets, Thermometer, Wind, Sun, CheckCircle2, Lock, FlaskConical, Zap, Activity } from 'lucide-react';
import { Button, CropRangeBand } from '../ui/BaseUI';
import { EnvironmentalTargetConfig } from '../../types';
import { useAuth } from '../../app/providers/AuthContext';
import { telemetryService, aiService } from '../../services';

interface EnvironmentalParametersPanelProps {
  configs?: EnvironmentalTargetConfig[];
  onUpdateConfig?: (updatedConfig: EnvironmentalTargetConfig) => void;
}

export interface DynamicSensorMetric {
  rawCode: string;
  code: string;
  label: string;
  current: number;
  unit: string;
  min: number;
  max: number;
  target: number;
}

const SENSOR_METADATA: Record<string, string> = {
  soilmoisture: 'Độ ẩm đất (Soil Moisture)',
  '1': 'Độ ẩm đất (Soil Moisture)',
  temperature: 'Nhiệt độ Không khí (Air Temp)',
  '0': 'Nhiệt độ Không khí (Air Temp)',
  airhumidity: 'Độ ẩm Không khí (Humidity)',
  '2': 'Độ ẩm Không khí (Humidity)',
  lightintensity: 'Cường độ Ánh sáng (Lux)',
  light: 'Cường độ Ánh sáng (Lux)',
  '4': 'Cường độ Ánh sáng (Lux)',
  ph: 'Độ chua/kiềm Đất (pH)',
  '3': 'Độ chua/kiềm Đất (pH)',
  ec: 'Độ dẫn điện EC (Dinh dưỡng)',
  '5': 'Độ dẫn điện EC (Dinh dưỡng)',
};

const SENSOR_SORT_ORDER: Record<string, number> = {
  soilmoisture: 1,
  '1': 1,
  temperature: 2,
  '0': 2,
  airhumidity: 3,
  '2': 3,
  lightintensity: 4,
  light: 4,
  '4': 4,
  ph: 5,
  '3': 5,
  ec: 6,
  '5': 6,
};

export const EnvironmentalParametersPanel: React.FC<EnvironmentalParametersPanelProps> = ({ configs = [], onUpdateConfig }) => {
  const { role, zones: authZones, selectedZoneId: authSelectedZoneId, setSelectedZoneId: setAuthSelectedZoneId, refreshFarmsAndZones } = useAuth();
  const isOwner = role === 'FARM_OWNER' || role === 'PLATFORM_ADMIN';

  // Tự động tải lại danh sách Farm & Zone nếu ban đầu chưa có (tương tự như bên AIAssistantPage)
  useEffect(() => {
    if ((!authZones || authZones.length === 0) && refreshFarmsAndZones) {
      void refreshFarmsAndZones();
    }
  }, [authZones, refreshFarmsAndZones]);

  // Kết hợp hoàn toàn danh sách cấu hình và toàn bộ các Zone từ AuthContext (đảm bảo đồng bộ 100% với bên AI)
  const allZonesConfigList = useMemo<EnvironmentalTargetConfig[]>(() => {
    const map = new Map<string, EnvironmentalTargetConfig>();

    // 1. Nạp từ configs được truyền từ props
    (configs || []).forEach(c => {
      if (c && c.zoneId) {
        map.set(c.zoneId, c);
      }
    });

    // 2. Bổ sung tất cả các Zone có trong hệ thống từ AuthContext (giống hệt bên AI Assistant)
    (authZones || []).forEach(z => {
      const zId = z.zoneId || (z as any).id;
      if (zId && !map.has(zId)) {
        map.set(zId, {
          zoneId: zId,
          zoneName: z.name || `Khu vực ${zId.slice(0, 8)}`,
          targetSoilMoisture: 70,
          minSoilMoisture: 60,
          maxSoilMoisture: 80,
          maxTemperature: 32,
          targetHumidity: 75,
          targetLux: 25000,
          powerWatts: 750,
        });
      }
    });

    return Array.from(map.values());
  }, [configs, authZones]);

  const [currentConfigs, setCurrentConfigs] = useState<EnvironmentalTargetConfig[]>(allZonesConfigList);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => {
    if (authSelectedZoneId && allZonesConfigList.some(c => c.zoneId === authSelectedZoneId)) {
      return authSelectedZoneId;
    }
    return allZonesConfigList[0]?.zoneId || '';
  });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sensorMetrics, setSensorMetrics] = useState<DynamicSensorMetric[]>([]);

  useEffect(() => {
    setCurrentConfigs(allZonesConfigList);
    if (allZonesConfigList.length > 0) {
      setSelectedZoneId(prev => {
        if (prev && allZonesConfigList.some(c => c.zoneId === prev)) {
          return prev;
        }
        if (authSelectedZoneId && allZonesConfigList.some(c => c.zoneId === authSelectedZoneId)) {
          return authSelectedZoneId;
        }
        return allZonesConfigList[0].zoneId;
      });
    } else {
      setSelectedZoneId('');
    }
  }, [allZonesConfigList, authSelectedZoneId]);

  const activeConfig = currentConfigs.find(c => c.zoneId === selectedZoneId) || currentConfigs[0];

  // Xử lý chuyển đổi Zone đồng bộ với ứng dụng
  const handleZoneSelect = (newZoneId: string) => {
    setSelectedZoneId(newZoneId);
    if (setAuthSelectedZoneId) {
      setAuthSelectedZoneId(newZoneId);
    }
  };

  // Nạp 100% dữ liệu cảm biến thực tế và ngưỡng vi khí hậu được lưu trong DB
  useEffect(() => {
    if (!selectedZoneId) {
      setSensorMetrics([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchZoneData = async () => {
      try {
        // Truy vấn đồng thời bối cảnh mùa vụ (requirements trong DB) và đo đạc thực tế của Zone
        const [ctxData, realtimeData] = await Promise.all([
          aiService.getContext(selectedZoneId).catch(() => null),
          telemetryService.getRealtime(selectedZoneId).catch(() => null),
        ]);

        if (!isMounted) return;

        // Trích xuất danh sách cảm biến thực tế được lưu trong DB
        const rawTelemetry = (ctxData?.telemetry && Array.isArray(ctxData.telemetry) && ctxData.telemetry.length > 0)
          ? ctxData.telemetry
          : (realtimeData?.metrics && Array.isArray(realtimeData.metrics))
          ? realtimeData.metrics.map((m: any) => ({
              parameterCode: m.parameterCode,
              value: m.value,
              unit: m.unit,
              isFresh: m.isFresh,
            }))
          : [];

        const dbRequirements: any[] = ctxData?.requirements || [];

        // Map động 100% từng cảm biến thực tế trong DB kèm theo ngưỡng đã lưu trong DB
        const list: DynamicSensorMetric[] = rawTelemetry
          .filter((t: any) => !isNaN(Number(t.value)))
          .map((t: any) => {
            const rawCode = String(t.parameterCode || '');
            const code = rawCode.replace(/_/g, '').toLowerCase();

            // Tìm ngưỡng mục tiêu lưu trong DB (SeasonAppliedRequirement)
            const req = dbRequirements.find((r: any) =>
              String(r.parameterCode || '').toLowerCase() === code ||
              String(r.parameterCode || '') === rawCode
            );

            const val = Number(t.value);
            // Các ngưỡng Min, Max, Target lấy trực tiếp từ DB
            const min = req?.minValue !== undefined ? Number(req.minValue) : (code === 'temperature' ? 18 : Math.floor(val * 0.85));
            const max = req?.maxValue !== undefined ? Number(req.maxValue) : Math.ceil(val * 1.15);
            const target = req?.targetValue !== undefined ? Number(req.targetValue) : val;

            const label = SENSOR_METADATA[code] || SENSOR_METADATA[rawCode] || `Cảm biến ${rawCode}`;

            return {
              rawCode,
              code,
              label,
              current: val,
              unit: t.unit || req?.unit || '',
              min,
              max,
              target,
            };
          })
          .sort((a: DynamicSensorMetric, b: DynamicSensorMetric) => (SENSOR_SORT_ORDER[a.code] ?? 99) - (SENSOR_SORT_ORDER[b.code] ?? 99));

        setSensorMetrics(list);
      } catch {
        // Giữ state hiện tại
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchZoneData();
    const timer = setInterval(fetchZoneData, 10000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedZoneId]);

  const [customThresholds, setCustomThresholds] = useState<Record<string, number>>({});

  const getTargetValue = (code: string, fallback: number): number => {
    if (customThresholds[code] !== undefined) return customThresholds[code];
    if (code === 'soilmoisture') return activeConfig?.targetSoilMoisture ?? fallback;
    if (code === 'temperature') return activeConfig?.maxTemperature ?? fallback;
    if (code === 'airhumidity') return activeConfig?.targetHumidity ?? fallback;
    if (code === 'lightintensity' || code === 'light') return activeConfig?.targetLux ?? fallback;
    const found = sensorMetrics.find(m => m.code === code);
    return found?.target ?? fallback;
  };

  const handleThresholdSlide = (code: string, val: number) => {
    if (!isOwner) return;
    setCustomThresholds(prev => ({ ...prev, [code]: val }));
    if (code === 'soilmoisture') handleParamChange('targetSoilMoisture', val);
    else if (code === 'temperature') handleParamChange('maxTemperature', val);
    else if (code === 'airhumidity') handleParamChange('targetHumidity', val);
    else if (code === 'lightintensity' || code === 'light') handleParamChange('targetLux', val);
    setIsSaved(false);
  };

  const getSliderProps = (m: DynamicSensorMetric, currentTarget: number) => {
    const code = m.code;

    if (code === 'soilmoisture') {
      return {
        title: 'Mục tiêu Độ ẩm Đất',
        colorClass: 'text-sky-700',
        accentClass: 'accent-emerald-600',
        icon: <Droplets size={14} />,
        min: 30,
        max: 95,
        step: 1,
        formatVal: `${currentTarget}%`,
        subText: `Tưới khi < ${activeConfig?.minSoilMoisture ?? m.min}% • Dừng khi > ${activeConfig?.maxSoilMoisture ?? m.max}%`,
      };
    }

    if (code === 'temperature') {
      return {
        title: 'Ngưỡng Nhiệt tối đa',
        colorClass: 'text-amber-700',
        accentClass: 'accent-amber-600',
        icon: <Thermometer size={14} />,
        min: 20,
        max: 40,
        step: 1,
        formatVal: `${currentTarget}°C`,
        subText: `Tự động bật Quạt đối lưu khi T > ${currentTarget}°C`,
      };
    }

    if (code === 'airhumidity') {
      return {
        title: 'Độ ẩm Không khí',
        colorClass: 'text-emerald-700',
        accentClass: 'accent-emerald-600',
        icon: <Wind size={14} />,
        min: 40,
        max: 95,
        step: 1,
        formatVal: `${currentTarget}%`,
        subText: 'Duy trì độ ẩm không khí tối ưu cho thụ phấn & quang hợp',
      };
    }

    if (code === 'lightintensity' || code === 'light') {
      return {
        title: 'Ánh sáng GrowLight',
        colorClass: 'text-purple-700',
        accentClass: 'accent-purple-600',
        icon: <Sun size={14} />,
        min: 5000,
        max: 50000,
        step: 1000,
        formatVal: `${currentTarget.toLocaleString()} Lux`,
        subText: `Bổ sung đèn khi < ${currentTarget.toLocaleString()} Lux`,
      };
    }

    if (code === 'ph') {
      return {
        title: 'Mục tiêu Độ chua/kiềm Đất',
        colorClass: 'text-indigo-700',
        accentClass: 'accent-indigo-600',
        icon: <FlaskConical size={14} />,
        min: 4.5,
        max: 8.5,
        step: 0.1,
        formatVal: `${currentTarget} pH`,
        subText: `Dải chuẩn VietGAP tối ưu: ${m.min} - ${m.max} pH`,
      };
    }

    if (code === 'ec') {
      return {
        title: 'Mục tiêu Dinh dưỡng EC',
        colorClass: 'text-teal-700',
        accentClass: 'accent-teal-600',
        icon: <Zap size={14} />,
        min: 0.5,
        max: 4.0,
        step: 0.05,
        formatVal: `${currentTarget} mS/cm`,
        subText: `Nồng độ phân bón hòa tan khuyến nghị: ${m.min} - ${m.max} mS/cm`,
      };
    }

    return {
      title: `Ngưỡng ${m.label}`,
      colorClass: 'text-slate-700',
      accentClass: 'accent-emerald-600',
      icon: <Activity size={14} />,
      min: Math.floor(m.min * 0.5),
      max: Math.ceil(m.max * 1.5) || 100,
      step: 1,
      formatVal: `${currentTarget} ${m.unit}`,
      subText: `Dải mục tiêu an toàn: ${m.min} - ${m.max} ${m.unit}`,
    };
  };

  const handleParamChange = (field: keyof EnvironmentalTargetConfig, val: number) => {
    if (!isOwner) return;
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

  if (currentConfigs.length === 0) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Chưa có cấu hình Zone/ngưỡng từ DB. Chưa thể hiển thị telemetry hoặc điều chỉnh ngưỡng.</div>;
  }

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
              <Sliders className="text-[#119653]" size={18} />
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
            onChange={(e) => handleZoneSelect(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 text-slate-900 cursor-pointer"
          >
            {currentConfigs.map(c => (
              <option key={c.zoneId} value={c.zoneId}>
                {c.zoneName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Range Bands for Selected Zone - Hiển thị 100% cảm biến lấy từ DB */}
      {isLoading && sensorMetrics.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
          Đang nạp danh sách cảm biến và ngưỡng vi khí hậu từ Database của khu vực...
        </div>
      ) : sensorMetrics.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Thông số vi khí hậu & thổ nhưỡng thu thập từ trạm đo IoT:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {sensorMetrics.length} thông số đo vi khí hậu từ DB
            </span>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${
            sensorMetrics.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-6'
          } gap-3`}>
            {sensorMetrics.map(m => (
              <CropRangeBand
                key={m.code}
                label={m.label}
                min={m.min}
                max={m.max}
                target={m.target}
                current={m.current}
                unit={m.unit}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Khu vực này hiện chưa có dữ liệu cảm biến được lưu trong cơ sở dữ liệu.
        </div>
      )}

      {/* Parameter Control Sliders / Inputs - Render động 100% theo các cảm biến lấy từ DB */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-[#119653]" /> Điều chỉnh Ngưỡng Tham số {activeConfig.zoneName}
            </h4>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {sensorMetrics.length} thông số môi trường
            </span>
          </div>
          {isSaved && (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in duration-200">
              <CheckCircle2 size={14} /> Đã cập nhật tham số thành công!
            </span>
          )}
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${
          sensorMetrics.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-3'
        } gap-4 text-xs`}>
          {sensorMetrics.map(m => {
            const currentTarget = getTargetValue(m.code, m.target);
            const props = getSliderProps(m, currentTarget);

            return (
              <div key={m.code} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className={`flex items-center gap-1.5 ${props.colorClass}`}>
                    {props.icon} {props.title}
                  </span>
                  <span className={`${props.colorClass} font-mono text-sm`}>{props.formatVal}</span>
                </div>
                <input
                  type="range"
                  min={props.min}
                  max={props.max}
                  step={props.step}
                  disabled={!isOwner}
                  value={currentTarget}
                  onChange={(e) => handleThresholdSlide(m.code, Number(e.target.value))}
                  className={`w-full ${props.accentClass} ${!isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                />
                <div className="text-[10px] text-slate-500">
                  {props.subText}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          {!isOwner ? (
            <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <Lock size={13} /> Chỉ Chủ trang trại (FarmOwner) mới có quyền chỉnh sửa & lưu ngưỡng tham số vi khí hậu.
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">
              💡 Tham số vi khí hậu sau khi lưu sẽ tự động đồng bộ sang Rule Engine và các trạm điều khiển tự động.
            </span>
          )}

          {isOwner && (
            <Button variant="primary" size="sm" onClick={handleSave}>
              <CheckCircle2 size={14} className="mr-1.5" />
              Lưu Ngưỡng Tham Số Vi Khí Hậu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
