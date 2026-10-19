import React, { useState, useEffect } from 'react';
import { 
  CloudRain, Wind, Droplets, Thermometer, Sun, Sunrise, Sunset, 
  Compass, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, MapPin, Eye
} from 'lucide-react';
import { openMeteoService, OpenMeteoLandWeather } from '../../services/openMeteoService';

interface OpenMeteoWeatherWidgetProps {
  latitude?: number;
  longitude?: number;
  landName?: string;
  className?: string;
  compact?: boolean;
}

export const OpenMeteoWeatherWidget: React.FC<OpenMeteoWeatherWidgetProps> = ({
  latitude = 11.9404,
  longitude = 108.4583,
  landName = 'Khu đất Nông trại',
  className = '',
  compact = false,
}) => {
  const [weather, setWeather] = useState<OpenMeteoLandWeather | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedForecastIndex, setSelectedForecastIndex] = useState<number>(0);

  const loadWeather = async () => {
    setIsLoading(true);
    try {
      const data = await openMeteoService.fetchLandWeather(latitude, longitude, landName);
      setWeather(data);
    } catch (err) {
      console.warn('Failed to fetch Open-Meteo weather:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
  }, [latitude, longitude, landName]);

  if (!weather && isLoading) {
    return (
      <div className={`p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-center gap-2 text-xs text-slate-500 ${className}`}>
        <RefreshCw size={15} className="animate-spin text-[#119653]" />
        <span>Đang gọi API Open-Meteo lấy dữ liệu thời tiết thực địa...</span>
      </div>
    );
  }

  if (!weather) return null;

  const current = weather.current;
  const advice = weather.irrigationAdvice;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs ${className}`}>
        <span className="text-2xl">{current.weatherIcon}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">{current.temperature}°C</span>
            <span className="text-xs text-slate-500 font-medium">({current.weatherText})</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
            <span className="flex items-center gap-1"><Droplets size={12} className="text-sky-500" /> {current.humidity}%</span>
            <span className="flex items-center gap-1"><CloudRain size={12} className="text-blue-500" /> {current.precipitationMm} mm</span>
            <span className="flex items-center gap-1"><Wind size={12} className="text-teal-500" /> {current.windSpeedKmH} km/h</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-white via-slate-50/70 to-emerald-50/30 border border-slate-200/90 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 ${className}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#119653] text-white font-mono flex items-center gap-1">
              <Sparkles size={11} /> OPEN-METEO LIVE API
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              GPS: {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)}
            </span>
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <MapPin size={17} className="text-[#119653]" />
            Thời tiết Thực địa Khu Đất: {landName}
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400">
            Cập nhật: <strong className="text-slate-600 font-mono">{weather.fetchedAt}</strong>
          </span>
          <button
            type="button"
            onClick={loadWeather}
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer disabled:opacity-50"
            title="Làm mới thời tiết vệ tinh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#119653]' : ''} />
          </button>
        </div>
      </div>

      {/* Main Weather Display & Smart Irrigation Advice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Big Current Condition */}
        <div className="lg:col-span-1 bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thời tiết Hiện tại</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black text-slate-900 tracking-tight">{current.temperature}°</span>
                <span className="text-xs font-bold text-slate-500">Cảm giác: {current.apparentTemperature}°C</span>
              </div>
              <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <span>{current.weatherText}</span>
              </div>
            </div>
            <div className="text-5xl select-none filter drop-shadow-sm">
              {current.weatherIcon}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[11px]">
            <div className="bg-slate-50 p-2 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px]">Độ ẩm</span>
              <strong className="text-sky-700 font-mono text-xs flex items-center justify-center gap-0.5 mt-0.5">
                <Droplets size={11} /> {current.humidity}%
              </strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px]">Lượng mưa</span>
              <strong className="text-blue-700 font-mono text-xs flex items-center justify-center gap-0.5 mt-0.5">
                <CloudRain size={11} /> {current.precipitationMm} mm
              </strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px]">Gió</span>
              <strong className="text-teal-700 font-mono text-xs flex items-center justify-center gap-0.5 mt-0.5">
                <Wind size={11} /> {current.windSpeedKmH} km/h
              </strong>
            </div>
          </div>
        </div>

        {/* Right Columns: Smart Irrigation Advice & Today's Summary */}
        <div className="lg:col-span-2 flex flex-col justify-between gap-3">
          {/* Recommendation Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            advice.status === 'RAIN_DELAY' ? 'bg-rose-50/90 border-rose-200 text-rose-950' :
            advice.status === 'CAUTION' ? 'bg-amber-50/90 border-amber-200 text-amber-950' :
            'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs flex items-center gap-1.5">
                {advice.status === 'RAIN_DELAY' && <ShieldAlert size={16} className="text-rose-600" />}
                {advice.status === 'CAUTION' && <AlertTriangle size={16} className="text-amber-600" />}
                {advice.status === 'SAFE' && <CheckCircle2 size={16} className="text-[#119653]" />}
                Đề xuất Tưới Thông Minh (Open-Meteo AI Rule)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${advice.badgeColor}`}>
                {advice.badgeText}
              </span>
            </div>
            <h4 className="text-xs font-bold mt-1.5">{advice.title}</h4>
            <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
              {advice.message}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200/90">
              <span className="text-[10px] text-slate-500 font-semibold block">Nhiệt độ Ngày</span>
              <span className="font-bold text-slate-900 font-mono mt-0.5 block">
                {weather.daily[0]?.minTemp}°C - {weather.daily[0]?.maxTemp}°C
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/90">
              <span className="text-[10px] text-slate-500 font-semibold block">Xác suất mưa max</span>
              <span className="font-bold text-blue-700 font-mono mt-0.5 block">
                {weather.daily[0]?.rainProbabilityMaxPercent}%
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/90">
              <span className="text-[10px] text-slate-500 font-semibold block">Tổng mưa ngày</span>
              <span className="font-bold text-sky-700 font-mono mt-0.5 block">
                {weather.daily[0]?.precipitationSumMm.toFixed(1)} mm
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200/90">
              <span className="text-[10px] text-slate-500 font-semibold block">Chỉ số Tia UV</span>
              <span className="font-bold text-amber-700 font-mono mt-0.5 block">
                {weather.daily[0]?.uvIndexMax ? `${weather.daily[0].uvIndexMax.toFixed(1)} (Max)` : 'Trung bình'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Forecast Row */}
      <div className="space-y-2 pt-2 border-t border-slate-200/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <CloudRain size={14} className="text-[#119653]" />
            Dự báo Thời tiết 7 Ngày Tới (Open-Meteo Forecast)
          </span>
          <span className="text-[10px] text-slate-500 italic">
            Dữ liệu vệ tinh tự động đồng bộ theo tọa độ thực
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {weather.daily.map((day, idx) => {
            const isSelected = selectedForecastIndex === idx;
            return (
              <div
                key={day.date}
                onClick={() => setSelectedForecastIndex(idx)}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50 border-[#119653] ring-2 ring-emerald-300 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200/90'
                }`}
              >
                <div>
                  <span className={`text-[11px] font-bold block ${idx === 0 ? 'text-[#119653]' : 'text-slate-700'}`}>
                    {day.dayName}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {day.date.split('-').slice(1).reverse().join('/')}
                  </span>
                </div>

                <div className="my-1.5 text-2xl select-none" title={day.weatherText}>
                  {day.weatherIcon}
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-900 font-mono">
                    {day.maxTemp}° <span className="text-slate-400 font-normal">/ {day.minTemp}°</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-blue-600 font-semibold font-mono">
                    <CloudRain size={10} />
                    <span>{day.rainProbabilityMaxPercent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
