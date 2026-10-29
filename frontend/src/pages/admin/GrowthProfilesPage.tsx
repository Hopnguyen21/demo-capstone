import React, { useState, useEffect } from 'react';
import { CropRangeBand } from '../../components/ui/BaseUI';
import { 
  Activity, Clock, CheckCircle, Sliders, RefreshCw, Sprout, 
  Layers, ShieldCheck, Thermometer, Droplets, Zap, Sun, Edit3, X, Check, AlertCircle, Save 
} from 'lucide-react';
import { cropService } from '../../services';

export const GrowthProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingStages, setLoadingStages] = useState(false);

  // Trạng thái modal chỉnh sửa Dải ngưỡng vi khí hậu cho Giai đoạn
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdError, setThresholdError] = useState('');
  const [thresholdSuccess, setThresholdSuccess] = useState('');
  const [thresholdForm, setThresholdForm] = useState({
    soilMoisture: { min: 60, target: 70, max: 80, unit: '%' },
    temperature: { min: 18, target: 24, max: 28, unit: '°C' },
    airHumidity: { min: 60, target: 70, max: 80, unit: '%' },
    lightIntensity: { min: 500, target: 750, max: 950, unit: 'lux' },
    ph: { min: 5.8, target: 6.4, max: 6.8, unit: 'pH' },
    ec: { min: 1.2, target: 1.8, max: 2.4, unit: 'mS/cm' },
  });

  // Nạp danh sách tất cả Growth Profiles từ Backend API CSDL
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    cropService.getAllGrowthProfiles().then(async (data: any[]) => {
      if (!isMounted) return;
      if (Array.isArray(data) && data.length > 0) {
        // Chuẩn hóa danh sách profiles từ backend
        const normalizedProfiles = data.map((p, idx) => ({
          ...p,
          growthProfileId: p.profileId || p.id || `profile-${idx}`,
          cropId: p.cropId,
          name: p.profileName || p.name || `Hồ sơ ${p.cropName || idx + 1}`,
          cropName: p.cropName || 'Cây trồng',
          totalDays: p.totalDays || 90,
          isSystemDefined: p.isSystemDefined ?? false
        }));

        // Giữ đầy đủ tất cả hồ sơ (cả Hệ thống và Nông trại), ưu tiên hồ sơ Mặc định và Hệ thống lên trước
        const finalProfiles = [...normalizedProfiles].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          if (a.isSystemDefined && !b.isSystemDefined) return -1;
          if (!a.isSystemDefined && b.isSystemDefined) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setProfiles(finalProfiles);

        // Đọc tham số URL query (?cropId=... hoặc ?profileId=...) để đồng bộ mở đúng hồ sơ
        const urlParams = new URLSearchParams(window.location.search);
        const targetCropId = urlParams.get('cropId');
        const targetProfileId = urlParams.get('profileId');

        let initial: any = null;
        if (targetProfileId) {
          initial = normalizedProfiles.find(p => (p.growthProfileId || p.profileId || p.id) === targetProfileId);
        }
        if (!initial && targetCropId) {
          initial = normalizedProfiles.find(p => String(p.cropId).toLowerCase() === String(targetCropId).toLowerCase());
        }
        if (!initial) {
          initial = finalProfiles[0];
        }

        if (initial) {
          setSelectedProfileId(initial.growthProfileId || initial.profileId);
          await loadProfileDetails(initial);
        }
      } else {
        setProfiles([]);
        setActiveProfile(null);
      }
    }).catch(err => {
      console.warn('Lỗi khi tải hồ sơ sinh trưởng từ CSDL:', err);
      setProfiles([]);
      setActiveProfile(null);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Tải chi tiết các giai đoạn của Profile từ CSDL
  const loadProfileDetails = async (targetProfile: any) => {
    setLoadingStages(true);
    try {
      const profId = targetProfile.profileId || targetProfile.growthProfileId || targetProfile.id;
      let fetchedStages: any[] = [];

      if (Array.isArray(targetProfile.stages) && targetProfile.stages.length > 0) {
        fetchedStages = targetProfile.stages;
      } else if (profId) {
        fetchedStages = await cropService.getGrowthStages(profId).catch(() => []);
      }

      if (Array.isArray(fetchedStages) && fetchedStages.length > 0) {
        const mappedStages = fetchedStages.map((st: any, idx: number) => ({
          growthStageId: st.stageId || st.growthStageId || st.id || `stg-${idx + 1}`,
          stageOrder: st.stageOrder ?? (idx + 1),
          name: st.name || st.stageName || `Giai đoạn ${idx + 1}`,
          durationDays: Math.max(1, Number(st.durationDays) || 15),
          description: st.description || `Chăm sóc vi khí hậu theo quy chuẩn cho ${targetProfile.cropName || targetProfile.name}.`,
          fertilizerAction: st.fertilizerAction || '',
          ipmAction: st.ipmAction || '',
          requirements: Array.isArray(st.requirements) ? st.requirements : []
        }));

        const totalDays = mappedStages.reduce((sum: number, s: any) => sum + s.durationDays, 0);

        setActiveProfile({
          ...targetProfile,
          name: targetProfile.profileName || targetProfile.name,
          totalDays: totalDays || targetProfile.totalDays || 90,
          stages: mappedStages
        });

        setSelectedStageId(mappedStages[0].growthStageId);
      } else {
        setActiveProfile({
          ...targetProfile,
          name: targetProfile.profileName || targetProfile.name,
          totalDays: targetProfile.totalDays || 90,
          stages: []
        });
      }
    } catch (e) {
      console.warn('Lỗi tải stages từ CSDL:', e);
      setActiveProfile(targetProfile);
    } finally {
      setLoadingStages(false);
    }
  };

  // Chuyển đổi khi người dùng chọn Profile khác
  const handleSelectProfile = async (profId: string) => {
    setIsEditingThresholds(false);
    setIsInlineEditing(false);
    setSelectedProfileId(profId);
    const target = profiles.find(p => (p.growthProfileId || p.profileId || p.id) === profId);
    if (target) {
      const search = new URLSearchParams(window.location.search);
      if (target.cropId) search.set('cropId', target.cropId);
      search.set('profileId', target.growthProfileId || target.profileId || target.id);
      window.history.replaceState(null, '', `${window.location.pathname}?${search.toString()}`);
      await loadProfileDetails(target);
    }
  };

  if (loading && !activeProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="animate-spin text-emerald-600" size={32} />
        <span className="text-sm font-medium text-slate-600">Đang tải hồ sơ sinh trưởng từ CSDL hệ thống...</span>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Sprout className="text-slate-400" size={40} />
        <span className="text-sm font-semibold text-slate-700">Chưa tìm thấy hồ sơ sinh trưởng nào trong CSDL.</span>
      </div>
    );
  }

  const profile = activeProfile;
  const stages = profile.stages || [];
  const currentStage = stages.find((s: any) => s.growthStageId === selectedStageId || String(s.stageOrder) === String(selectedStageId)) || stages[0];

  // Trích xuất dải ngưỡng yêu cầu của giai đoạn hiện tại
  const rawRequirements = currentStage?.requirements || [];
  const getParam = (code: string) => rawRequirements.find((r: any) => {
    const c = (r.parameterCode || r.parameterName || '').toUpperCase();
    return c === code.toUpperCase() || c.includes(code.toUpperCase());
  });

  const soilMoist = getParam('SOIL_MOISTURE') || getParam('SOILMOISTURE') || { minValue: 60, maxValue: 80, targetValue: 70, unit: '%' };
  const airTemp = getParam('TEMPERATURE') || getParam('TEMP') || { minValue: 18, maxValue: 28, targetValue: 24, unit: '°C' };
  const airHumid = getParam('AIR_HUMIDITY') || getParam('AIRHUMIDITY') || getParam('HUMIDITY') || { minValue: 60, maxValue: 80, targetValue: 70, unit: '%' };
  const light = getParam('LIGHT_INTENSITY') || getParam('LIGHTINTENSITY') || getParam('LIGHT') || { minValue: 500, maxValue: 950, targetValue: 750, unit: 'lux' };
  const phVal = getParam('PH') || { minValue: 6.0, maxValue: 6.8, targetValue: 6.4, unit: 'pH' };
  const ecVal = getParam('EC') || { minValue: 1.5, maxValue: 2.4, targetValue: 2.0, unit: 'mS/cm' };

  // Giá trị đo giả lập tiệm cận điểm mục tiêu
  const calcCurrent = (target: number, min: number, max: number) => {
    const val = Number(target) || ((Number(min) + Number(max)) / 2);
    return Math.round(val * 10) / 10;
  };

  // Bật/tắt chế độ sửa trực tiếp trên thẻ
  const toggleInlineEditing = () => {
    if (!isInlineEditing) {
      openEditThresholds();
      setIsEditingThresholds(false);
      setIsInlineEditing(true);
    } else {
      setIsInlineEditing(false);
    }
  };

  // Mở modal cấu hình dải ngưỡng vi khí hậu
  const openEditThresholds = () => {
    setThresholdForm({
      soilMoisture: {
        min: Number(soilMoist.minValue) || 60,
        target: Number(soilMoist.targetValue) || 70,
        max: Number(soilMoist.maxValue) || 80,
        unit: soilMoist.unit || '%',
      },
      temperature: {
        min: Number(airTemp.minValue) || 18,
        target: Number(airTemp.targetValue) || 24,
        max: Number(airTemp.maxValue) || 28,
        unit: airTemp.unit || '°C',
      },
      airHumidity: {
        min: Number(airHumid.minValue) || 60,
        target: Number(airHumid.targetValue) || 70,
        max: Number(airHumid.maxValue) || 80,
        unit: airHumid.unit || '%',
      },
      lightIntensity: {
        min: Number(light.minValue) || 500,
        target: Number(light.targetValue) || 750,
        max: Number(light.maxValue) || 950,
        unit: light.unit || 'lux',
      },
      ph: {
        min: Number(phVal.minValue) || 5.8,
        target: Number(phVal.targetValue) || 6.4,
        max: Number(phVal.maxValue) || 6.8,
        unit: phVal.unit || 'pH',
      },
      ec: {
        min: Number(ecVal.minValue) || 1.2,
        target: Number(ecVal.targetValue) || 1.8,
        max: Number(ecVal.maxValue) || 2.4,
        unit: ecVal.unit || 'mS/cm',
      },
    });
    setThresholdError('');
    setThresholdSuccess('');
    setIsEditingThresholds(true);
  };

  // Lưu cấu hình dải ngưỡng vi khí hậu xuống CSDL thông qua API
  const handleSaveThresholds = async () => {
    const stageId = currentStage?.growthStageId || currentStage?.stageId;
    if (!stageId) return;

    setIsSavingThresholds(true);
    setThresholdError('');
    setThresholdSuccess('');

    const configs = [
      { key: 'soilMoisture', label: 'Độ ẩm đất (Soil Moisture)', data: thresholdForm.soilMoisture, code: 'SoilMoisture' },
      { key: 'temperature', label: 'Nhiệt độ không khí (Temperature)', data: thresholdForm.temperature, code: 'Temperature' },
      { key: 'airHumidity', label: 'Độ ẩm không khí (Air Humidity)', data: thresholdForm.airHumidity, code: 'AirHumidity' },
      { key: 'lightIntensity', label: 'Cường độ ánh sáng (Light Intensity)', data: thresholdForm.lightIntensity, code: 'LightIntensity' },
      { key: 'ph', label: 'Độ pH đất / giá thể', data: thresholdForm.ph, code: 'Ph' },
      { key: 'ec', label: 'Độ dẫn điện EC', data: thresholdForm.ec, code: 'Ec' },
    ];

    for (const c of configs) {
      const min = Number(c.data.min);
      const tgt = Number(c.data.target);
      const max = Number(c.data.max);
      if (isNaN(min) || isNaN(tgt) || isNaN(max)) {
        setThresholdError(`Vui lòng nhập đầy đủ giá trị số cho ${c.label}.`);
        setIsSavingThresholds(false);
        return;
      }
      if (min > tgt || tgt > max) {
        setThresholdError(`Lỗi dải ngưỡng tại "${c.label}": Yêu cầu Tối thiểu (${min}) ≤ Mục tiêu (${tgt}) ≤ Tối đa (${max}).`);
        setIsSavingThresholds(false);
        return;
      }
    }

    const payload = configs.map(c => ({
      parameterCode: c.code,
      minValue: Number(c.data.min),
      targetValue: Number(c.data.target),
      maxValue: Number(c.data.max),
      unit: c.data.unit || '',
    }));

    try {
      const res = await cropService.updateStageRequirements(stageId, payload);
      setThresholdSuccess('Đã cập nhật dải ngưỡng vi khí hậu thành công vào CSDL!');

      // Cập nhật state activeProfile cho giai đoạn hiện tại
      const updatedReqs = res?.requirements || payload;
      setActiveProfile((prev: any) => {
        if (!prev || !prev.stages) return prev;
        const newStages = prev.stages.map((st: any) => {
          if ((st.growthStageId || st.stageId) === stageId) {
            return {
              ...st,
              requirements: updatedReqs,
            };
          }
          return st;
        });
        return { ...prev, stages: newStages };
      });

      setTimeout(() => {
        setIsEditingThresholds(false);
        setThresholdSuccess('');
      }, 1000);
    } catch (err: any) {
      const data = err?.response?.data;
      setThresholdError(data?.detail || data?.message || (data?.errors ? Object.values(data.errors).flat().join(' ') : '') || 'Không thể lưu ngưỡng vi khí hậu.');
    } finally {
      setIsSavingThresholds(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Bộ chọn Hồ sơ Sinh trưởng */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="text-[#119653]" size={24} /> Cấu hình Hồ sơ Sinh trưởng & Ngưỡng Vi khí hậu Mẫu
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Cơ chế Crop-aware 4 tầng: Cây ➔ Giống ➔ Hồ sơ sinh trưởng ➔ Giai đoạn ➔ Dải ngưỡng vi khí hậu thích ứng tự động IoT.
          </p>
        </div>

        {/* Dropdown Selector chọn Hồ sơ Sinh trưởng */}
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-2xl p-2 shadow-xs">
          <Layers className="w-4 h-4 text-emerald-600 ml-1 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Chọn Hồ sơ:</span>
          <select
            value={selectedProfileId}
            onChange={(e) => handleSelectProfile(e.target.value)}
            disabled={loading || loadingStages}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 max-w-xs md:max-w-md cursor-pointer"
          >
            {profiles.map((p) => {
              const id = p.growthProfileId || p.profileId || p.id;
              const name = p.profileName || p.name || 'Hồ sơ sinh trưởng';
              const crop = p.cropName ? `(${p.cropName})` : '';
              return (
                <option key={id} value={id}>
                  {name} {crop}
                </option>
              );
            })}
          </select>
          {loadingStages && <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin mr-1" />}
        </div>
      </div>

      {/* Profile Overview Banner */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              profile.isSystemDefined 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : 'bg-cyan-50 text-cyan-800 border-cyan-300'
            }`}>
              {profile.isSystemDefined ? '✓ HỒ SƠ CHUẨN SYSTEM DEFAULT' : '🌾 HỒ SƠ TÙY BIẾN NÔNG TRẠI (VIETGAP)'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              • Cây trồng: <strong className="text-slate-800">{profile.cropName || 'Cây trồng'}</strong>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            {profile.name}
            {profile.isDefault && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800">Mặc định</span>}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">{profile.description}</p>
        </div>

        <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200 w-full sm:w-auto">
          <span className="text-xs text-slate-500 block">Tổng thời gian chu kỳ</span>
          <span className="text-2xl font-bold text-[#119653] font-mono">{profile.totalDays || 90} Ngày</span>
          <span className="text-[11px] text-slate-500 block">({stages.length} giai đoạn liên tục)</span>
        </div>
      </div>

      {/* Timeline of Growth Stages (Interactive Stage Cards) */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-[#119653]" /> Các giai đoạn sinh trưởng (Growth Stages Timeline)
            </h3>
            <p className="text-xs text-slate-500">Nhấp chọn một giai đoạn bên dưới để xem và điều chỉnh dải ngưỡng vi khí hậu IoT tương ứng.</p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 w-fit">
            Đang chọn: Giai đoạn {currentStage?.stageOrder} ({currentStage?.name})
          </span>
        </div>

        {/* Dynamic Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {stages.map((st: any) => {
            const isSelected = (st.growthStageId === selectedStageId || String(st.stageOrder) === String(selectedStageId));
            return (
              <button
                key={st.growthStageId || st.stageOrder}
                type="button"
                onClick={() => setSelectedStageId(st.growthStageId || String(st.stageOrder))}
                className={`p-4 rounded-2xl text-left transition-all relative border flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      isSelected ? 'bg-[#119653] text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {st.stageOrder}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                      {st.durationDays} ngày
                    </span>
                  </div>
                  <h4 className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {st.name}
                  </h4>
                  <p className="text-xs text-slate-600 leading-snug line-clamp-3">
                    {st.description || 'Chăm sóc tối ưu theo giai đoạn sinh trưởng'}
                  </p>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-2 border-t border-emerald-200/80 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5" /> Đang kích hoạt vi khí hậu
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Environmental Requirements Range Bands for Active Stage */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders size={18} className="text-[#119653]" /> 
              Dải ngưỡng Vi khí hậu Giai đoạn: <span className="text-emerald-700 font-extrabold">{currentStage?.name}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động cập nhật vào Alert Engine & Relay Control khi vụ mùa bước sang giai đoạn này.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-500 font-mono">
              Thời lượng: <strong className="text-slate-800">{currentStage?.durationDays} ngày</strong>
            </span>
            <button
              type="button"
              onClick={toggleInlineEditing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition shadow-2xs ${
                isInlineEditing
                  ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Edit3 size={13} />
              {isInlineEditing ? 'Đang sửa trực tiếp trên thẻ' : 'Sửa trực tiếp các ngưỡng'}
            </button>
            <button
              type="button"
              onClick={openEditThresholds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer transition shadow-2xs"
            >
              <Sliders size={13} className="text-slate-600" />
              Mở hộp thoại
            </button>
          </div>
        </div>

        {/* Thông báo lỗi / thành công khi sửa trực tiếp */}
        {isInlineEditing && thresholdError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{thresholdError}</span>
          </div>
        )}
        {isInlineEditing && thresholdSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{thresholdSuccess}</span>
          </div>
        )}

        {/* 6 Khối Thông Số Vi Khí Hậu Range Bands: Chế độ Xem hoặc Chế độ Sửa trực tiếp */}
        {isInlineEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Độ ẩm đất */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Droplets size={15} className="text-blue-600" /> Độ ẩm đất (Soil Moisture)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">%</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.soilMoisture.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.soilMoisture.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.soilMoisture.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Nhiệt độ không khí */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Thermometer size={15} className="text-amber-600" /> Nhiệt độ không khí (Air Temp)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">°C</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.temperature.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.temperature.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.temperature.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Độ ẩm không khí */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Droplets size={15} className="text-sky-600" /> Độ ẩm không khí (Humidity)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">%</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.airHumidity.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.airHumidity.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={thresholdForm.airHumidity.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Cường độ ánh sáng */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sun size={15} className="text-amber-500" /> Cường độ ánh sáng (Lux)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">lux</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="50"
                      value={thresholdForm.lightIntensity.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="50"
                      value={thresholdForm.lightIntensity.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="50"
                      value={thresholdForm.lightIntensity.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Độ pH */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sprout size={15} className="text-emerald-600" /> Độ pH đất / giá thể
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">pH</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ph.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ph.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ph.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Độ dẫn điện EC */}
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap size={15} className="text-yellow-600" /> Độ dẫn điện EC
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">mS/cm</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ec.min}
                      onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, min: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ec.target}
                      onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, target: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-100/60 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thresholdForm.ec.max}
                      onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, max: parseFloat(e.target.value) || 0 } })}
                      className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thanh tác vụ lưu trực tiếp */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsInlineEditing(false)}
                disabled={isSavingThresholds}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveThresholds}
                disabled={isSavingThresholds}
                className="px-5 py-2 rounded-xl bg-[#119653] hover:bg-[#0e7d45] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSavingThresholds ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang lưu dải ngưỡng vào CSDL...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Lưu dải ngưỡng giai đoạn này
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CropRangeBand 
              label="Độ ẩm đất (Soil Moisture)" 
              min={Number(soilMoist.minValue) || 60} 
              max={Number(soilMoist.maxValue) || 80} 
              target={Number(soilMoist.targetValue) || 70} 
              current={calcCurrent(soilMoist.targetValue, soilMoist.minValue, soilMoist.maxValue)} 
              unit={soilMoist.unit || '%'} 
            />
            <CropRangeBand 
              label="Nhiệt độ không khí (Air Temp)" 
              min={Number(airTemp.minValue) || 18} 
              max={Number(airTemp.maxValue) || 28} 
              target={Number(airTemp.targetValue) || 24} 
              current={calcCurrent(airTemp.targetValue, airTemp.minValue, airTemp.maxValue)} 
              unit={airTemp.unit || '°C'} 
            />
            <CropRangeBand 
              label="Độ ẩm không khí (Humidity)" 
              min={Number(airHumid.minValue) || 60} 
              max={Number(airHumid.maxValue) || 80} 
              target={Number(airHumid.targetValue) || 70} 
              current={calcCurrent(airHumid.targetValue, airHumid.minValue, airHumid.maxValue)} 
              unit={airHumid.unit || '%'} 
            />
            <CropRangeBand 
              label="Cường độ ánh sáng (Lux)" 
              min={Number(light.minValue) || 500} 
              max={Number(light.maxValue) || 950} 
              target={Number(light.targetValue) || 750} 
              current={calcCurrent(light.targetValue, light.minValue, light.maxValue)} 
              unit={light.unit || 'lux'} 
            />
            <CropRangeBand 
              label="Độ pH đất / giá thể (pH)" 
              min={Number(phVal.minValue) || 5.8} 
              max={Number(phVal.maxValue) || 6.8} 
              target={Number(phVal.targetValue) || 6.4} 
              current={calcCurrent(phVal.targetValue, phVal.minValue, phVal.maxValue)} 
              unit={phVal.unit || 'pH'} 
            />
            <CropRangeBand 
              label="Độ dẫn điện EC (mS/cm)" 
              min={Number(ecVal.minValue) || 1.2} 
              max={Number(ecVal.maxValue) || 2.4} 
              target={Number(ecVal.targetValue) || 1.8} 
              current={calcCurrent(ecVal.targetValue, ecVal.minValue, ecVal.maxValue)} 
              unit={ecVal.unit || 'mS/cm'} 
            />
          </div>
        )}

        {/* Hướng dẫn Tưới tiêu & Sâu bệnh IPM cho Giai đoạn đang chọn */}
        {(currentStage?.fertilizerAction || currentStage?.ipmAction) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {currentStage.fertilizerAction && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm mb-1">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  <span>Quy trình Dinh dưỡng & Tưới bón VietGAP:</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {currentStage.fertilizerAction}
                </p>
              </div>
            )}
            {currentStage.ipmAction && (
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200">
                <div className="flex items-center gap-2 font-bold text-teal-900 text-xs sm:text-sm mb-1">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Kiểm soát Sâu bệnh IPM & Cách ly (PHI):</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {currentStage.ipmAction}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Chỉnh sửa Dải ngưỡng Vi khí hậu */}
      {isEditingThresholds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Chỉnh sửa Dải ngưỡng Vi khí hậu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Giai đoạn: <strong className="text-emerald-700 font-extrabold">{currentStage?.name}</strong> • Chu kỳ {currentStage?.durationDays} ngày
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingThresholds(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-800 leading-relaxed">
                💡 <strong>Quy tắc ngưỡng:</strong> Giá trị <strong>Tối thiểu (Min)</strong> phải nhỏ hơn hoặc bằng <strong>Mục tiêu (Target)</strong>, và <strong>Mục tiêu</strong> phải nhỏ hơn hoặc bằng <strong>Tối đa (Max)</strong>. Dải ngưỡng này sẽ tự động cập nhật vào Alert Engine cảnh báo vi khí hậu và kích hoạt điều khiển Relay / Actuator IoT.
              </div>

              {thresholdError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{thresholdError}</span>
                </div>
              )}

              {thresholdSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <Check size={16} className="shrink-0" />
                  <span>{thresholdSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Độ ẩm đất */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Droplets size={14} className="text-blue-600" /> Độ ẩm đất (Soil Moisture)
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      %
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.soilMoisture.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.soilMoisture.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.soilMoisture.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, soilMoisture: { ...thresholdForm.soilMoisture, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Nhiệt độ không khí */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Thermometer size={14} className="text-amber-600" /> Nhiệt độ không khí (Air Temp)
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      °C
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.temperature.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.temperature.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.temperature.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, temperature: { ...thresholdForm.temperature, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Độ ẩm không khí */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Droplets size={14} className="text-sky-600" /> Độ ẩm không khí (Humidity)
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      %
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.airHumidity.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.airHumidity.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.airHumidity.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, airHumidity: { ...thresholdForm.airHumidity, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Cường độ ánh sáng */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sun size={14} className="text-amber-500" /> Cường độ ánh sáng (Lux)
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      lux
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="10"
                        value={thresholdForm.lightIntensity.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="10"
                        value={thresholdForm.lightIntensity.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="10"
                        value={thresholdForm.lightIntensity.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, lightIntensity: { ...thresholdForm.lightIntensity, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Độ pH */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sprout size={14} className="text-emerald-600" /> Độ pH đất / giá thể
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      pH
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ph.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ph.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ph.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, ph: { ...thresholdForm.ph, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Độ dẫn điện EC */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap size={14} className="text-yellow-600" /> Độ dẫn điện EC
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      mS/cm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ec.min}
                        onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, min: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ec.target}
                        onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, target: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/50 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={thresholdForm.ec.max}
                        onChange={e => setThresholdForm({ ...thresholdForm, ec: { ...thresholdForm.ec, max: parseFloat(e.target.value) || 0 } })}
                        className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsEditingThresholds(false)}
                disabled={isSavingThresholds}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveThresholds}
                disabled={isSavingThresholds}
                className="px-4 py-2 rounded-xl bg-[#119653] hover:bg-[#0e7d45] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingThresholds ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Đang lưu vào CSDL...
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    Lưu dải ngưỡng vi khí hậu
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
