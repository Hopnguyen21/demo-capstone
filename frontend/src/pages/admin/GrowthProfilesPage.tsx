import React, { useState, useEffect } from 'react';
import { CropRangeBand } from '../../components/ui/BaseUI';
import {
  Activity, Clock, CheckCircle, Sliders, RefreshCw, Sprout,
  Layers, ShieldCheck, Thermometer, Droplets, Zap, Sun, Edit3, X, Check,
  AlertCircle, Save, Plus, Trash2, Radio, Wind, Gauge, Info, Filter
} from 'lucide-react';
import { cropService, environmentalMetricService, EnvironmentalMetricDefinition } from '../../services';

export interface EditableMetric {
  parameterCode: string;
  metricName: string;
  unit: string;
  description?: string;
  min: number | '';
  target: number | '';
  max: number | '';
  isEnabled: boolean;
  hasSensorSupport?: boolean;
}

const DEFAULT_METRIC_CATALOG: EnvironmentalMetricDefinition[] = [
  { id: '1', metricCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', defaultMin: 60, defaultTarget: 70, defaultMax: 75, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '2', metricCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', defaultMin: 20, defaultTarget: 24, defaultMax: 28, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '3', metricCode: 'AirHumidity', metricName: 'Độ ẩm không khí', unit: '%', defaultMin: 60, defaultTarget: 70, defaultMax: 80, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '4', metricCode: 'LightIntensity', metricName: 'Cường độ ánh sáng', unit: 'Lux', defaultMin: 1000, defaultTarget: 3000, defaultMax: 5000, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '5', metricCode: 'Ph', metricName: 'Độ pH đất / dung dịch', unit: 'pH', defaultMin: 5.5, defaultTarget: 6.0, defaultMax: 6.5, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '6', metricCode: 'Ec', metricName: 'Độ dẫn điện EC', unit: 'mS/cm', defaultMin: 1.2, defaultTarget: 1.8, defaultMax: 2.5, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '7', metricCode: 'SoilTemperature', metricName: 'Nhiệt độ đất', unit: '°C', defaultMin: 18, defaultTarget: 22, defaultMax: 26, hasSensorSupport: true, isSystemDefined: true, isActive: true },
  { id: '8', metricCode: 'CO2', metricName: 'Nồng độ CO2', unit: 'ppm', defaultMin: 400, defaultTarget: 800, defaultMax: 1200, hasSensorSupport: false, isSystemDefined: true, isActive: true },
  { id: '9', metricCode: 'WIND_SPEED', metricName: 'Tốc độ gió', unit: 'm/s', defaultMin: 0, defaultTarget: 2, defaultMax: 5, hasSensorSupport: false, isSystemDefined: true, isActive: true },
  { id: '10', metricCode: 'WATER_FLOW', metricName: 'Lưu lượng nước tưới', unit: 'L/h', defaultMin: 10, defaultTarget: 50, defaultMax: 100, hasSensorSupport: false, isSystemDefined: true, isActive: true }
];

export const GrowthProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingStages, setLoadingStages] = useState(false);

  // Danh mục định nghĩa chỉ số & chỉ số động cho giai đoạn đang chọn
  const [metricCatalog, setMetricCatalog] = useState<EnvironmentalMetricDefinition[]>(DEFAULT_METRIC_CATALOG);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editableMetrics, setEditableMetrics] = useState<EditableMetric[]>([]);
  const [isAddMetricOpen, setIsAddMetricOpen] = useState(false);
  const [isCreateMetricOpen, setIsCreateMetricOpen] = useState(false);
  const [creatingMetric, setCreatingMetric] = useState(false);
  const [newMetricForm, setNewMetricForm] = useState({
    metricCode: '',
    metricName: '',
    unit: '',
    description: '',
    defaultMin: 0,
    defaultTarget: 10,
    defaultMax: 20,
    hasSensorSupport: false
  });

  // Trạng thái chỉnh sửa
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [stageError, setStageError] = useState('');
  const [newStage, setNewStage] = useState({ name: '', durationDays: '', position: '' });
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [thresholdError, setThresholdError] = useState('');
  const [thresholdSuccess, setThresholdSuccess] = useState('');

  // Nạp danh sách Growth Profiles và Danh mục Metric Definitions từ CSDL
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      cropService.getAllGrowthProfiles().catch(() => []),
      environmentalMetricService.getMetricDefinitions().catch(() => DEFAULT_METRIC_CATALOG)
    ]).then(async ([data, defs]) => {
      if (!isMounted) return;

      if (Array.isArray(defs) && defs.length > 0) {
        setMetricCatalog(defs);
      }

      if (Array.isArray(data) && data.length > 0) {
        const normalizedProfiles = data.map((p, idx) => ({
          ...p,
          growthProfileId: p.profileId || p.id || `profile-${idx}`,
          cropId: p.cropId,
          name: p.profileName || p.name || `Hồ sơ ${p.cropName || idx + 1}`,
          cropName: p.cropName || 'Cây trồng',
          totalDays: p.totalDays || 0,
          isSystemDefined: p.isSystemDefined ?? false
        }));

        const finalProfiles = [...normalizedProfiles].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          if (a.isSystemDefined && !b.isSystemDefined) return -1;
          if (!a.isSystemDefined && b.isSystemDefined) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setProfiles(finalProfiles);

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
          durationDays: Number(st.durationDays) || 0,
          description: st.description || '',
          fertilizerAction: st.fertilizerAction || '',
          ipmAction: st.ipmAction || '',
          requirements: Array.isArray(st.requirements) ? st.requirements : []
        }));

        const totalDays = mappedStages.reduce((sum: number, s: any) => sum + s.durationDays, 0);

        setActiveProfile({
          ...targetProfile,
          name: targetProfile.profileName || targetProfile.name,
          totalDays,
          stages: mappedStages
        });

        setSelectedStageId(mappedStages[0].growthStageId);
        populateEditableMetrics(mappedStages[0]);
      } else {
        setActiveProfile({
          ...targetProfile,
          name: targetProfile.profileName || targetProfile.name,
          totalDays: 0,
          stages: []
        });
        setEditableMetrics([]);
      }
    } catch (e) {
      console.warn('Lỗi tải stages từ CSDL:', e);
      setActiveProfile(targetProfile);
    } finally {
      setLoadingStages(false);
    }
  };

  const populateEditableMetrics = (stage: any) => {
    const reqs = stage?.requirements || [];
    const list: EditableMetric[] = reqs.map((r: any) => ({
      parameterCode: r.parameterCode,
      metricName: r.metricName || r.name || r.parameterCode,
      unit: r.unit || '%',
      description: r.description || '',
      min: r.minValue !== undefined && r.minValue !== null ? Number(r.minValue) : '',
      target: r.targetValue !== undefined && r.targetValue !== null ? Number(r.targetValue) : '',
      max: r.maxValue !== undefined && r.maxValue !== null ? Number(r.maxValue) : '',
      isEnabled: r.isEnabled ?? true,
      hasSensorSupport: r.hasSensorSupport ?? ['SoilMoisture', 'Temperature', 'AirHumidity', 'LightIntensity', 'Ph', 'Ec', 'SoilTemperature'].some(k => k.toLowerCase() === (r.parameterCode || '').toLowerCase())
    }));
    setEditableMetrics(list);
  };

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

  const profile = activeProfile;
  const stages = profile?.stages || [];
  const currentStage = stages.find((s: any) => s.growthStageId === selectedStageId || String(s.stageOrder) === String(selectedStageId)) || stages[0];

  useEffect(() => {
    if (currentStage) {
      populateEditableMetrics(currentStage);
    }
  }, [selectedStageId, activeProfile]);

  const toggleInlineEditing = () => {
    if (!isInlineEditing) {
      populateEditableMetrics(currentStage);
      setIsEditingThresholds(false);
      setIsInlineEditing(true);
    } else {
      setIsInlineEditing(false);
    }
  };

  const openEditThresholds = () => {
    populateEditableMetrics(currentStage);
    setThresholdError('');
    setThresholdSuccess('');
    setIsEditingThresholds(true);
  };

  const handleAddMetricToStage = (def: EnvironmentalMetricDefinition) => {
    if (editableMetrics.some(m => m.parameterCode.toUpperCase() === def.metricCode.toUpperCase())) {
      setThresholdError(`Chỉ số "${def.metricName}" đã có trong giai đoạn này.`);
      return;
    }
    const item: EditableMetric = {
      parameterCode: def.metricCode,
      metricName: def.metricName,
      unit: def.unit,
      description: def.description || '',
      min: Number(def.defaultMin),
      target: Number(def.defaultTarget),
      max: Number(def.defaultMax),
      isEnabled: true,
      hasSensorSupport: def.hasSensorSupport
    };
    setEditableMetrics(prev => [...prev, item]);
    setIsAddMetricOpen(false);
    setThresholdError('');
  };

  const handleRemoveMetric = (paramCode: string) => {
    setEditableMetrics(prev => prev.filter(m => m.parameterCode !== paramCode));
  };

  const updateMetricField = (paramCode: string, field: keyof EditableMetric, value: any) => {
    setEditableMetrics(prev => prev.map(m => m.parameterCode === paramCode ? { ...m, [field]: value } : m));
  };

  const handleCreateNewMetricDefinition = async () => {
    if (!newMetricForm.metricName.trim() || !newMetricForm.metricCode.trim() || !newMetricForm.unit.trim()) {
      setThresholdError('Vui lòng nhập đủ Tên chỉ số, Mã định danh (Code) và Đơn vị tính.');
      return;
    }
    setCreatingMetric(true);
    try {
      const code = newMetricForm.metricCode.trim().toUpperCase();
      const res = await environmentalMetricService.createMetricDefinition({
        metricCode: code,
        metricName: newMetricForm.metricName.trim(),
        unit: newMetricForm.unit.trim(),
        description: newMetricForm.description.trim() || undefined,
        defaultMin: Number(newMetricForm.defaultMin),
        defaultTarget: Number(newMetricForm.defaultTarget),
        defaultMax: Number(newMetricForm.defaultMax),
        hasSensorSupport: newMetricForm.hasSensorSupport
      });
      setMetricCatalog(prev => [...prev.filter(m => m.metricCode !== res.metricCode), res]);
      handleAddMetricToStage(res);
      setIsCreateMetricOpen(false);
      setNewMetricForm({
        metricCode: '',
        metricName: '',
        unit: '',
        description: '',
        defaultMin: 0,
        defaultTarget: 10,
        defaultMax: 20,
        hasSensorSupport: false
      });
    } catch (err: any) {
      setThresholdError(err?.response?.data?.message || err?.message || 'Lỗi khi tạo định nghĩa chỉ số mới.');
    } finally {
      setCreatingMetric(false);
    }
  };

  const handleAddStage = async () => {
    const profId = activeProfile?.profileId || activeProfile?.growthProfileId || activeProfile?.id;
    if (!profId) return;
    const name = newStage.name.trim();
    const days = Number(newStage.durationDays);
    if (!name) { setStageError('Nhập tên giai đoạn.'); return; }
    if (!Number.isInteger(days) || days < 1 || days > 365) { setStageError('Số ngày phải là số nguyên từ 1 đến 365.'); return; }
    setIsSavingStage(true);
    setStageError('');
    try {
      const created = await cropService.addGrowthStage(profId, {
        name,
        durationDays: days,
        insertAtOrder: newStage.position ? Number(newStage.position) : undefined,
      });
      await loadProfileDetails({ ...activeProfile, stages: [] });
      setSelectedStageId(created?.stageId || created?.growthStageId);
      setNewStage({ name: '', durationDays: '', position: '' });
      setIsAddingStage(false);
    } catch (err: any) {
      const data = err?.response?.data;
      setStageError(data?.detail || data?.message || 'Không thêm được giai đoạn (cần quyền sửa hồ sơ này).');
    } finally {
      setIsSavingStage(false);
    }
  };

  const handleSaveThresholds = async () => {
    const stageId = currentStage?.growthStageId || currentStage?.stageId;
    if (!stageId) return;

    if (editableMetrics.length === 0) {
      setThresholdError('Cần có ít nhất một chỉ số môi trường cho giai đoạn.');
      return;
    }

    for (const m of editableMetrics) {
      if (!m.isEnabled) continue;
      if (m.min === '' || m.target === '' || m.max === '') {
        setThresholdError(`Vui lòng nhập đủ Min, Target và Max cho chỉ số "${m.metricName || m.parameterCode}".`);
        return;
      }
      const min = Number(m.min);
      const tgt = Number(m.target);
      const max = Number(m.max);
      if (isNaN(min) || isNaN(tgt) || isNaN(max)) {
        setThresholdError(`Giá trị ngưỡng của "${m.metricName || m.parameterCode}" phải là số.`);
        return;
      }
      if (min > tgt || tgt > max) {
        setThresholdError(`Lỗi dải ngưỡng tại "${m.metricName || m.parameterCode}": Yêu cầu Min (${min}) ≤ Target (${tgt}) ≤ Max (${max}).`);
        return;
      }
    }

    setIsSavingThresholds(true);
    setThresholdError('');
    setThresholdSuccess('');

    const payload = editableMetrics.map(m => ({
      parameterCode: m.parameterCode,
      metricName: m.metricName,
      description: m.description,
      minValue: Number(m.min),
      targetValue: Number(m.target),
      maxValue: Number(m.max),
      unit: m.unit,
      isEnabled: m.isEnabled
    }));

    try {
      const res = await cropService.updateStageRequirements(stageId, payload);
      setThresholdSuccess('Đã cập nhật dải ngưỡng vi khí hậu thành công vào CSDL!');

      const updatedReqs = res?.requirements || payload;
      setActiveProfile((prev: any) => {
        if (!prev || !prev.stages) return prev;
        return {
          ...prev,
          stages: prev.stages.map((st: any) =>
            (st.growthStageId === stageId || st.stageId === stageId)
              ? { ...st, requirements: updatedReqs }
              : st
          )
        };
      });
      setTimeout(() => {
        setIsInlineEditing(false);
        setIsEditingThresholds(false);
        setThresholdSuccess('');
      }, 1200);
    } catch (err: any) {
      const data = err?.response?.data;
      setThresholdError(data?.detail || data?.message || 'Không thể lưu ngưỡng vi khí hậu.');
    } finally {
      setIsSavingThresholds(false);
    }
  };

  const getMetricIcon = (code: string) => {
    const c = (code || '').toUpperCase();
    if (c.includes('SOIL') && c.includes('MOIST')) return <Droplets size={16} className="text-blue-600" />;
    if (c.includes('TEMP')) return <Thermometer size={16} className="text-amber-600" />;
    if (c.includes('HUMID')) return <Droplets size={16} className="text-sky-600" />;
    if (c.includes('LIGHT') || c.includes('LUX')) return <Sun size={16} className="text-amber-500" />;
    if (c.includes('PH')) return <Sprout size={16} className="text-emerald-600" />;
    if (c.includes('EC')) return <Zap size={16} className="text-yellow-600" />;
    if (c.includes('WIND')) return <Wind size={16} className="text-teal-600" />;
    if (c.includes('CO2') || c.includes('GAS')) return <Gauge size={16} className="text-purple-600" />;
    return <Activity size={16} className="text-slate-600" />;
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
            <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${profile.isSystemDefined
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
          <span className="text-2xl font-bold text-[#119653] font-mono">{profile.totalDays ? `${profile.totalDays} Ngày` : "Chưa có"}</span>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 w-fit">
              Đang chọn: Giai đoạn {currentStage?.stageOrder} ({currentStage?.name})
            </span>
            <button
              type="button"
              onClick={() => { setIsAddingStage(v => !v); setStageError(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-600 bg-white text-emerald-800 font-bold text-xs hover:bg-emerald-50 cursor-pointer"
            >
              + Thêm giai đoạn
            </button>
          </div>
        </div>

        {isAddingStage && (
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700">Tên giai đoạn
                <input value={newStage.name} onChange={e => setNewStage({ ...newStage, name: e.target.value })} maxLength={150}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal" placeholder="Ví dụ: Ra hoa" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Số ngày (1–365)
                <input type="number" min={1} max={365} value={newStage.durationDays} onChange={e => setNewStage({ ...newStage, durationDays: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Vị trí
                <select value={newStage.position} onChange={e => setNewStage({ ...newStage, position: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal">
                  <option value="">Thêm vào cuối</option>
                  {stages.map((st: any) => (<option key={st.growthStageId} value={st.stageOrder}>Trước giai đoạn {st.stageOrder} ({st.name})</option>))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-slate-600">Giai đoạn mới chưa có ngưỡng vi khí hậu: chọn giai đoạn đó rồi dùng "Sửa trực tiếp các ngưỡng" để bổ sung.</p>
            {stageError && <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">{stageError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setIsAddingStage(false); setStageError(''); }} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer">Hủy</button>
              <button type="button" disabled={isSavingStage} onClick={handleAddStage} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{isSavingStage ? 'Đang thêm…' : 'Thêm giai đoạn'}</button>
            </div>
          </div>
        )}

        {/* Dynamic Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {stages.map((st: any) => {
            const isSelected = (st.growthStageId === selectedStageId || String(st.stageOrder) === String(selectedStageId));
            return (
              <button
                key={st.growthStageId || st.stageOrder}
                type="button"
                onClick={() => setSelectedStageId(st.growthStageId || String(st.stageOrder))}
                className={`p-4 rounded-2xl text-left transition-all relative border flex flex-col justify-between cursor-pointer ${isSelected
                  ? 'bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 shadow-2xs'
                  }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${isSelected ? 'bg-[#119653] text-white shadow-xs' : 'bg-slate-200 text-slate-700'
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
                    {st.description}
                  </p>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-2 border-t border-emerald-200/80 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5" /> Đang xem ngưỡng
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
              Hệ thống chỉ số môi trường động: Có thể thêm, bớt và cấu hình độc lập cho từng giai đoạn sinh trưởng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-500 font-mono">
              Thời lượng: <strong className="text-slate-800">{currentStage?.durationDays} ngày</strong>
            </span>
            <button
              type="button"
              onClick={toggleInlineEditing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition shadow-2xs ${isInlineEditing
                ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
            >
              <Edit3 size={13} />
              {isInlineEditing ? 'Đóng chế độ sửa' : 'Sửa trực tiếp các ngưỡng'}
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

        {/* Thông báo lỗi / thành công khi sửa */}
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

        {/* Chế độ Sửa trực tiếp (Inline Editing) */}
        {isInlineEditing ? (
          <div className="space-y-4">
            {/* Thanh công cụ thêm chỉ số */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Info size={15} className="text-emerald-600 shrink-0" />
                <span>Bạn đang cấu hình <strong>{editableMetrics.length}</strong> chỉ số cho riêng giai đoạn này.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setCatalogSearch(''); setIsAddMetricOpen(true); }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Plus size={14} /> Thêm chỉ số từ danh mục
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateMetricOpen(true)}
                  className="px-3 py-1.5 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Plus size={14} /> Tự tạo chỉ số mới
                </button>
              </div>
            </div>

            {/* Danh sách các chỉ số môi trường động */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {editableMetrics.map((m) => (
                <div
                  key={m.parameterCode}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    m.isEnabled
                      ? 'border-emerald-300 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 opacity-60'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      {getMetricIcon(m.parameterCode)}
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{m.metricName}</span>
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {m.unit}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {m.parameterCode}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={m.isEnabled}
                          onChange={(e) => updateMetricField(m.parameterCode, 'isEnabled', e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span>{m.isEnabled ? 'Bật' : 'Tắt'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveMetric(m.parameterCode)}
                        title="Xóa chỉ số khỏi giai đoạn"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Sensor Badge */}
                  <div>
                    {m.hasSensorSupport ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Radio size={10} className="animate-pulse" /> 📡 Cảm biến online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        ⚠️ Chưa có cảm biến (Chỉ lưu cấu hình)
                      </span>
                    )}
                  </div>

                  {/* Min / Target / Max Inputs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối thiểu (Min)</label>
                      <input
                        type="number"
                        step="any"
                        value={m.min}
                        onChange={(e) => updateMetricField(m.parameterCode, 'min', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!m.isEnabled}
                        className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu (Target)</label>
                      <input
                        type="number"
                        step="any"
                        value={m.target}
                        onChange={(e) => updateMetricField(m.parameterCode, 'target', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!m.isEnabled}
                        className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-50 border border-emerald-500 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tối đa (Max)</label>
                      <input
                        type="number"
                        step="any"
                        value={m.max}
                        onChange={(e) => updateMetricField(m.parameterCode, 'max', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!m.isEnabled}
                        className="w-full text-xs font-bold px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
          /* Chế độ Xem (View Mode) */
          <div>
            {(currentStage?.requirements && currentStage.requirements.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentStage.requirements.map((req: any) => {
                  const isSensor = req.hasSensorSupport ?? ['SoilMoisture', 'Temperature', 'AirHumidity', 'LightIntensity', 'Ph', 'Ec', 'SoilTemperature'].some(k => k.toLowerCase() === (req.parameterCode || '').toLowerCase());
                  const displayName = req.metricName || req.name || req.parameterCode;

                  return (
                    <div key={req.parameterCode || req.id} className="relative">
                      <CropRangeBand
                        label={displayName}
                        min={Number(req.minValue)}
                        max={Number(req.maxValue)}
                        target={Number(req.targetValue)}
                        unit={req.unit || ''}
                      />
                      <div className="mt-1.5 flex items-center justify-between text-[10px] px-1">
                        <span className="font-mono text-slate-400">{req.parameterCode}</span>
                        {isSensor ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Radio size={9} className="animate-pulse" /> 📡 Cảm biến online
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            ⚠️ Cấu hình nông học (Chưa có cảm biến)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-3">
                <Sliders className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Chưa có chỉ số vi khí hậu nào cho giai đoạn này.</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Bạn có thể bổ sung các chỉ số tùy chỉnh linh hoạt phù hợp với giống cây và mùa vụ mà không bị gò bó danh sách cứng.
                </p>
                <button
                  type="button"
                  onClick={toggleInlineEditing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  + Thiết lập chỉ số ngay
                </button>
              </div>
            )}
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

      {/* Modal Chỉnh sửa Dải ngưỡng Vi khí hậu Popup */}
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
                    Chỉnh sửa Dải ngưỡng Vi khí hậu Động
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
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                <div className="text-xs text-emerald-800 leading-relaxed">
                  💡 <strong>Quy tắc ngưỡng:</strong> Yêu cầu <strong>Tối thiểu (Min)</strong> ≤ <strong>Mục tiêu (Target)</strong> ≤ <strong>Tối đa (Max)</strong>. Dải ngưỡng cập nhật trực tiếp vào Alert Engine và Actuator Rule.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setCatalogSearch(''); setIsAddMetricOpen(true); }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Plus size={13} /> Thêm chỉ số
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateMetricOpen(true)}
                    className="px-3 py-1.5 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Plus size={13} /> Tạo mới
                  </button>
                </div>
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
                {editableMetrics.map((m) => (
                  <div
                    key={m.parameterCode}
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      m.isEnabled ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 bg-slate-100/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-1.5">
                        {getMetricIcon(m.parameterCode)}
                        <div>
                          <div className="text-xs font-bold text-slate-800">{m.metricName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{m.parameterCode}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {m.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMetric(m.parameterCode)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {m.hasSensorSupport ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          📡 Cảm biến online
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          ⚠️ Chưa có cảm biến
                        </span>
                      )}
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={m.isEnabled}
                          onChange={(e) => updateMetricField(m.parameterCode, 'isEnabled', e.target.checked)}
                          className="w-3 h-3 text-emerald-600 rounded"
                        />
                        <span>{m.isEnabled ? 'Áp dụng' : 'Tắt'}</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Min</label>
                        <input
                          type="number"
                          step="any"
                          value={m.min}
                          onChange={(e) => updateMetricField(m.parameterCode, 'min', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          disabled={!m.isEnabled}
                          className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-emerald-700 block mb-0.5">Target</label>
                        <input
                          type="number"
                          step="any"
                          value={m.target}
                          onChange={(e) => updateMetricField(m.parameterCode, 'target', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          disabled={!m.isEnabled}
                          className="w-full text-xs font-semibold px-2 py-1.5 bg-emerald-50/60 border border-emerald-400 rounded-lg text-emerald-900 focus:outline-none focus:border-emerald-600 text-center disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Max</label>
                        <input
                          type="number"
                          step="any"
                          value={m.max}
                          onChange={(e) => updateMetricField(m.parameterCode, 'max', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          disabled={!m.isEnabled}
                          className="w-full text-xs font-semibold px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 text-center disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Modal Chọn Chỉ số từ Danh mục */}
      {isAddMetricOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Danh mục Chỉ số Môi trường</h3>
                <p className="text-xs text-slate-500">Chọn chỉ số để bổ sung vào giai đoạn {currentStage?.name}</p>
              </div>
              <button
                onClick={() => setIsAddMetricOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên chỉ số hoặc mã code..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => { setIsAddMetricOpen(false); setIsCreateMetricOpen(true); }}
                className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Tạo mới
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
              {metricCatalog
                .filter(m =>
                  !catalogSearch ||
                  m.metricName.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                  m.metricCode.toLowerCase().includes(catalogSearch.toLowerCase())
                )
                .map(m => {
                  const isAlreadyAdded = editableMetrics.some(em => em.parameterCode.toUpperCase() === m.metricCode.toUpperCase());
                  return (
                    <div
                      key={m.metricCode}
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 flex items-center justify-between transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{m.metricName}</span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {m.unit}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({m.metricCode})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>Mặc định: {m.defaultMin} – {m.defaultTarget} – {m.defaultMax} {m.unit}</span>
                          {m.hasSensorSupport ? (
                            <span className="text-emerald-700 font-medium">📡 Cảm biến IoT</span>
                          ) : (
                            <span className="text-amber-700 font-medium">⚠️ Chưa có cảm biến</span>
                          )}
                        </div>
                      </div>

                      <button
                        disabled={isAlreadyAdded}
                        onClick={() => handleAddMetricToStage(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                          isAlreadyAdded
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs'
                        }`}
                      >
                        {isAlreadyAdded ? 'Đã thêm' : <><Plus size={13} /> Thêm</>}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tự Tạo Chỉ Số Mới Hoàn Toàn */}
      {isCreateMetricOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tạo Chỉ số Môi trường Mới</h3>
                <p className="text-xs text-slate-500">Lưu vào danh mục của trang trại và tự động thêm vào giai đoạn</p>
              </div>
              <button
                onClick={() => setIsCreateMetricOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tên chỉ số *</label>
                  <input
                    type="text"
                    value={newMetricForm.metricName}
                    onChange={(e) => {
                      const name = e.target.value;
                      const code = name
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-zA-Z0-9]/g, '_')
                        .toUpperCase();
                      setNewMetricForm(prev => ({
                        ...prev,
                        metricName: name,
                        metricCode: prev.metricCode || code
                      }));
                    }}
                    placeholder="VD: Nồng độ CO2, Tốc độ gió"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Mã định danh (Code/Key) *</label>
                  <input
                    type="text"
                    value={newMetricForm.metricCode}
                    onChange={(e) => setNewMetricForm(prev => ({ ...prev, metricCode: e.target.value.toUpperCase() }))}
                    placeholder="VD: CO2, WIND_SPEED"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Đơn vị đo *</label>
                  <input
                    type="text"
                    value={newMetricForm.unit}
                    onChange={(e) => setNewMetricForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="VD: ppm, m/s, lux, %"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Loại hỗ trợ phần cứng</label>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMetricForm.hasSensorSupport}
                      onChange={(e) => setNewMetricForm(prev => ({ ...prev, hasSensorSupport: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs text-slate-700">Có cảm biến IoT vật lý</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Min mặc định</label>
                  <input
                    type="number"
                    step="any"
                    value={newMetricForm.defaultMin}
                    onChange={(e) => setNewMetricForm(prev => ({ ...prev, defaultMin: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 block mb-1">Target mặc định</label>
                  <input
                    type="number"
                    step="any"
                    value={newMetricForm.defaultTarget}
                    onChange={(e) => setNewMetricForm(prev => ({ ...prev, defaultTarget: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-xs text-center text-emerald-900 focus:outline-none focus:border-emerald-600 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Max mặc định</label>
                  <input
                    type="number"
                    step="any"
                    value={newMetricForm.defaultMax}
                    onChange={(e) => setNewMetricForm(prev => ({ ...prev, defaultMax: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mô tả ý nghĩa nông học (Tùy chọn)</label>
                <textarea
                  rows={2}
                  value={newMetricForm.description}
                  onChange={(e) => setNewMetricForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả ý nghĩa của chỉ số đối với cây trồng..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setIsCreateMetricOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                disabled={creatingMetric}
                onClick={handleCreateNewMetricDefinition}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {creatingMetric ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                Tạo và áp dụng ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
