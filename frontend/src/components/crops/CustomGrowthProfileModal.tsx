import React, { useState, useEffect } from 'react';
import {
  Sprout, Plus, Trash2, Check, ArrowRight, ArrowLeft,
  Sliders, ShieldCheck, Thermometer, Droplets, Sun, Zap, Info, AlertCircle, RefreshCw, X, Radio, Wind, Gauge, Activity
} from 'lucide-react';
import { cropService, environmentalMetricService, EnvironmentalMetricDefinition } from '../../services';

export interface CustomGrowthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProfile: any) => void;
  initialCropId?: string;
  initialVarietyId?: string;
  templateProfile?: any;
}

export interface MetricDraft {
  parameterCode: string;
  metricName: string;
  unit: string;
  description?: string;
  minValue: number;
  targetValue: number;
  maxValue: number;
  enabled: boolean;
  hasSensorSupport: boolean;
}

interface StageDraft {
  name: string;
  durationDays: number;
  description?: string;
  requirements: MetricDraft[];
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

export const CustomGrowthProfileModal: React.FC<CustomGrowthProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCropId,
  initialVarietyId,
  templateProfile
}) => {
  const [step, setStep] = useState<number>(1);
  const [crops, setCrops] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [metricCatalog, setMetricCatalog] = useState<EnvironmentalMetricDefinition[]>(DEFAULT_METRIC_CATALOG);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form State
  const [cropId, setCropId] = useState<string>('');
  const [varietyId, setVarietyId] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  // Custom Metric Creator Modal State
  const [isAddMetricOpen, setIsAddMetricOpen] = useState<boolean>(false);
  const [isCreateMetricModalOpen, setIsCreateMetricModalOpen] = useState<boolean>(false);
  const [creatingMetric, setCreatingMetric] = useState<boolean>(false);
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

  // Stages State with independent metrics per stage
  const [stages, setStages] = useState<StageDraft[]>([
    {
      name: 'Giai đoạn 1: Cây con (Seedling)',
      durationDays: 20,
      description: 'Giai đoạn nảy mầm và phát triển bộ rễ ban đầu',
      requirements: [
        { parameterCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', minValue: 65, targetValue: 72, maxValue: 80, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', minValue: 20, targetValue: 24, maxValue: 28, enabled: true, hasSensorSupport: true },
        { parameterCode: 'AirHumidity', metricName: 'Độ ẩm không khí', unit: '%', minValue: 60, targetValue: 70, maxValue: 75, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Ph', metricName: 'Độ pH đất / dung dịch', unit: 'pH', minValue: 5.5, targetValue: 6.0, maxValue: 6.5, enabled: true, hasSensorSupport: true }
      ]
    },
    {
      name: 'Giai đoạn 2: Sinh trưởng (Vegetative)',
      durationDays: 30,
      description: 'Giai đoạn phát triển thân lá và sinh khối',
      requirements: [
        { parameterCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', minValue: 60, targetValue: 70, maxValue: 78, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', minValue: 21, targetValue: 25, maxValue: 30, enabled: true, hasSensorSupport: true },
        { parameterCode: 'AirHumidity', metricName: 'Độ ẩm không khí', unit: '%', minValue: 55, targetValue: 65, maxValue: 75, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Ph', metricName: 'Độ pH đất / dung dịch', unit: 'pH', minValue: 5.5, targetValue: 6.2, maxValue: 6.8, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Ec', metricName: 'Độ dẫn điện EC', unit: 'mS/cm', minValue: 1.2, targetValue: 1.8, maxValue: 2.2, enabled: true, hasSensorSupport: true }
      ]
    },
    {
      name: 'Giai đoạn 3: Ra hoa & Đậu quả (Flowering)',
      durationDays: 25,
      description: 'Phân hóa mầm hoa và thụ phấn',
      requirements: [
        { parameterCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', minValue: 55, targetValue: 65, maxValue: 72, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', minValue: 22, targetValue: 26, maxValue: 29, enabled: true, hasSensorSupport: true },
        { parameterCode: 'AirHumidity', metricName: 'Độ ẩm không khí', unit: '%', minValue: 50, targetValue: 62, maxValue: 70, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Ec', metricName: 'Độ dẫn điện EC', unit: 'mS/cm', minValue: 1.8, targetValue: 2.2, maxValue: 2.6, enabled: true, hasSensorSupport: true }
      ]
    },
    {
      name: 'Giai đoạn 4: Thu hoạch (Harvest)',
      durationDays: 30,
      description: 'Trái chín và thu hoạch định kỳ',
      requirements: [
        { parameterCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', minValue: 50, targetValue: 60, maxValue: 68, enabled: true, hasSensorSupport: true },
        { parameterCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', minValue: 20, targetValue: 25, maxValue: 30, enabled: true, hasSensorSupport: true }
      ]
    }
  ]);

  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);

  // Load Crops & Metric Definitions
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      cropService.getCrops(),
      environmentalMetricService.getMetricDefinitions().catch(() => DEFAULT_METRIC_CATALOG)
    ]).then(([cList, defs]) => {
      const validCrops = Array.isArray(cList) ? cList : [];
      setCrops(validCrops);
      const targetCropId = initialCropId || (validCrops[0]?.cropId || '');
      setCropId(targetCropId);

      if (Array.isArray(defs) && defs.length > 0) {
        setMetricCatalog(defs);
      }
    }).catch(err => {
      console.error('Lỗi tải dữ liệu:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [isOpen, initialCropId]);

  // Load Varieties when cropId changes
  useEffect(() => {
    if (!cropId) {
      setVarieties([]);
      setVarietyId('');
      return;
    }
    cropService.getVarieties(cropId).then((vList: any[]) => {
      const validVars = Array.isArray(vList) ? vList : [];
      setVarieties(validVars);
      if (initialVarietyId && validVars.some(v => v.varietyId === initialVarietyId)) {
        setVarietyId(initialVarietyId);
      } else {
        setVarietyId('');
      }
    }).catch(() => setVarieties([]));
  }, [cropId, initialVarietyId]);

  // Pre-fill if templateProfile is provided
  useEffect(() => {
    if (!templateProfile || !isOpen) return;
    if (templateProfile.cropId) setCropId(templateProfile.cropId);
    if (templateProfile.varietyId) setVarietyId(templateProfile.varietyId);
    setProfileName(templateProfile.name ? `Bản sao - ${templateProfile.name}` : 'Cấu hình canh tác tùy biến');
    setDescription(templateProfile.description || 'Quy trình canh tác được sao chép và tinh chỉnh theo điều kiện trang trại.');
    if (Array.isArray(templateProfile.stages) && templateProfile.stages.length > 0) {
      setStages(templateProfile.stages.map((st: any, idx: number) => ({
        name: st.name || `Giai đoạn ${idx + 1}`,
        durationDays: Number(st.durationDays) || 20,
        description: st.description || '',
        requirements: (st.requirements || []).map((r: any) => ({
          parameterCode: r.parameterCode,
          metricName: r.metricName || r.name || r.parameterCode,
          unit: r.unit || '%',
          description: r.description || '',
          minValue: Number(r.minValue),
          targetValue: Number(r.targetValue),
          maxValue: Number(r.maxValue),
          enabled: r.isEnabled ?? true,
          hasSensorSupport: r.hasSensorSupport ?? ['SoilMoisture', 'Temperature', 'AirHumidity', 'LightIntensity', 'Ph', 'Ec', 'SoilTemperature'].includes(r.parameterCode)
        }))
      })));
    }
  }, [templateProfile, isOpen]);

  if (!isOpen) return null;

  const totalCycleDays = stages.reduce((acc, st) => acc + (Number(st.durationDays) || 0), 0);
  const activeStage = stages[activeStageIdx] || stages[0];

  const handleAddStage = () => {
    const nextOrder = stages.length + 1;
    setStages(prev => [
      ...prev,
      {
        name: `Giai đoạn ${nextOrder}`,
        durationDays: 15,
        description: '',
        requirements: [
          { parameterCode: 'SoilMoisture', metricName: 'Độ ẩm đất', unit: '%', minValue: 60, targetValue: 70, maxValue: 75, enabled: true, hasSensorSupport: true },
          { parameterCode: 'Temperature', metricName: 'Nhiệt độ không khí', unit: '°C', minValue: 20, targetValue: 24, maxValue: 28, enabled: true, hasSensorSupport: true }
        ]
      }
    ]);
    setActiveStageIdx(stages.length);
  };

  const handleRemoveStage = (idxToRemove: number) => {
    if (stages.length <= 1) {
      setErrorMsg('Cấu hình sinh trưởng phải có ít nhất 1 giai đoạn.');
      return;
    }
    setStages(prev => prev.filter((_, i) => i !== idxToRemove));
    if (activeStageIdx >= stages.length - 1) {
      setActiveStageIdx(Math.max(0, stages.length - 2));
    }
  };

  const updateStageField = (idx: number, field: keyof StageDraft, value: any) => {
    setStages(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const updateMetricInStage = (stageIdx: number, paramCode: string, field: keyof MetricDraft, value: any) => {
    setStages(prev => {
      const copy = [...prev];
      const stage = { ...copy[stageIdx] };
      stage.requirements = stage.requirements.map(req => {
        if (req.parameterCode === paramCode) {
          return { ...req, [field]: value };
        }
        return req;
      });
      copy[stageIdx] = stage;
      return copy;
    });
  };

  const removeMetricFromStage = (stageIdx: number, paramCode: string) => {
    setStages(prev => {
      const copy = [...prev];
      const stage = { ...copy[stageIdx] };
      stage.requirements = stage.requirements.filter(r => r.parameterCode !== paramCode);
      copy[stageIdx] = stage;
      return copy;
    });
  };

  const addMetricToCurrentStage = (def: EnvironmentalMetricDefinition) => {
    if (!activeStage) return;
    if (activeStage.requirements.some(r => r.parameterCode.toUpperCase() === def.metricCode.toUpperCase())) {
      setErrorMsg(`Chỉ số "${def.metricName}" đã có trong giai đoạn này.`);
      return;
    }

    const newReq: MetricDraft = {
      parameterCode: def.metricCode,
      metricName: def.metricName,
      unit: def.unit,
      description: def.description || '',
      minValue: Number(def.defaultMin),
      targetValue: Number(def.defaultTarget),
      maxValue: Number(def.defaultMax),
      enabled: true,
      hasSensorSupport: def.hasSensorSupport
    };

    setStages(prev => {
      const copy = [...prev];
      const stage = { ...copy[activeStageIdx] };
      stage.requirements = [...stage.requirements, newReq];
      copy[activeStageIdx] = stage;
      return copy;
    });
    setIsAddMetricOpen(false);
    setErrorMsg('');
  };

  const handleCreateNewMetricDefinition = async () => {
    if (!newMetricForm.metricName.trim() || !newMetricForm.metricCode.trim() || !newMetricForm.unit.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên chỉ số, Mã chỉ số và Đơn vị tính.');
      return;
    }
    if (newMetricForm.defaultMin > newMetricForm.defaultTarget || newMetricForm.defaultTarget > newMetricForm.defaultMax) {
      setErrorMsg('Ngưỡng mặc định phải thỏa mãn Min <= Target <= Max.');
      return;
    }

    setCreatingMetric(true);
    setErrorMsg('');
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

      // Update catalog
      const updatedCatalog = [...metricCatalog.filter(m => m.metricCode !== res.metricCode), res];
      setMetricCatalog(updatedCatalog);

      // Add directly to active stage
      addMetricToCurrentStage(res);

      setIsCreateMetricModalOpen(false);
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
      console.error('Lỗi tạo chỉ số mới:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Không thể tạo chỉ số mới.';
      setErrorMsg(msg);
    } finally {
      setCreatingMetric(false);
    }
  };

  const validateAll = (): boolean => {
    setErrorMsg('');
    if (!profileName.trim()) {
      setErrorMsg('Vui lòng nhập tên cấu hình canh tác.');
      setStep(1);
      return false;
    }
    if (!cropId) {
      setErrorMsg('Vui lòng chọn loại cây trồng.');
      setStep(1);
      return false;
    }
    if (stages.length === 0) {
      setErrorMsg('Cấu hình phải có ít nhất một giai đoạn sinh trưởng.');
      setStep(2);
      return false;
    }

    for (let i = 0; i < stages.length; i++) {
      const st = stages[i];
      if (!st.name.trim()) {
        setErrorMsg(`Giai đoạn số ${i + 1} chưa có tên.`);
        setStep(2);
        return false;
      }
      if (st.durationDays <= 0 || !Number.isInteger(Number(st.durationDays))) {
        setErrorMsg(`Thời gian giai đoạn "${st.name}" phải là số nguyên dương ngày.`);
        setStep(2);
        return false;
      }
      if (st.requirements.length === 0) {
        setErrorMsg(`Giai đoạn "${st.name}" chưa có chỉ số môi trường nào. Vui lòng thêm ít nhất 1 chỉ số.`);
        setActiveStageIdx(i);
        setStep(3);
        return false;
      }

      for (const req of st.requirements) {
        if (!req.enabled) continue;
        if (req.minValue > req.targetValue || req.targetValue > req.maxValue) {
          setErrorMsg(`Ngưỡng "${req.metricName || req.parameterCode}" ở giai đoạn "${st.name}" không hợp lệ: Yêu cầu Min (${req.minValue}) <= Mục tiêu (${req.targetValue}) <= Max (${req.maxValue}).`);
          setActiveStageIdx(i);
          setStep(3);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateAll()) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const payloadStages = stages.map((st, idx) => ({
        name: st.name.trim(),
        stageOrder: idx + 1,
        durationDays: Number(st.durationDays),
        description: st.description || undefined,
        requirements: st.requirements
          .filter(r => r.enabled)
          .map(r => ({
            parameterCode: r.parameterCode,
            metricName: r.metricName,
            description: r.description || undefined,
            minValue: Number(r.minValue),
            targetValue: Number(r.targetValue),
            maxValue: Number(r.maxValue),
            unit: r.unit,
            isEnabled: r.enabled
          }))
      }));

      const res = await cropService.createGrowthProfile({
        cropId,
        varietyId: varietyId || undefined,
        name: profileName.trim(),
        description: description.trim() || undefined,
        isDefault,
        stages: payloadStages
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu cấu hình:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Không thể lưu cấu hình. Vui lòng kiểm tra lại.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  // Metrics in catalog not yet added to current stage
  const availableToAdd = metricCatalog.filter(def =>
    !activeStage?.requirements.some(r => r.parameterCode.toUpperCase() === def.metricCode.toUpperCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
              <Sprout size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Tự Tạo Cấu Hình Canh Tác Riêng (Growth Profile)
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập quy trình sinh trưởng và chỉ số vi khí hậu động thích ứng tự động cho Farm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200/80 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition cursor-pointer ${
                step === 1 ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Thông tin chung</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition cursor-pointer ${
                step === 2 ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Giai đoạn sinh trưởng ({stages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition cursor-pointer ${
                step === 3 ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Chỉ số môi trường động ({activeStage?.requirements.length || 0})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px]">
            <span>Tổng chu kỳ:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {totalCycleDays} ngày
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: General Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loài cây trồng *</label>
                  <select
                    value={cropId}
                    onChange={e => setCropId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {crops.map(c => (
                      <option key={c.cropId} value={c.cropId}>
                        {c.name} {c.scientificName ? `(${c.scientificName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giống thương mại (Tùy chọn)</label>
                  <select
                    value={varietyId}
                    onChange={e => setVarietyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Áp dụng chung cho loài (Tất cả giống)</option>
                    {varieties.map(v => (
                      <option key={v.varietyId} value={v.varietyId}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên cấu hình canh tác *</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Ví dụ: Quy trình Dưa lưới Chuẩn VietGAP - Farm Bình An"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả quy trình & hướng dẫn kỹ thuật</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ghi chú về phân bón lót, chế độ tưới nhỏ giọt, giá thể phù hợp cho cấu hình này..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="isDefault" className="text-slate-700 font-semibold cursor-pointer">
                  Đặt làm cấu hình mặc định cho loại cây này trên nông trại của bạn
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Stages List */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Các giai đoạn sinh trưởng ({stages.length} giai đoạn • Tổng {totalCycleDays} ngày)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mỗi giai đoạn sẽ sở hữu danh sách chỉ số môi trường hoàn toàn độc lập ở Bước 3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition"
                >
                  <Plus size={14} /> Thêm giai đoạn
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={st.name}
                          onChange={e => updateStageField(idx, 'name', e.target.value)}
                          placeholder={`Tên giai đoạn ${idx + 1}`}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={st.durationDays}
                            onChange={e => updateStageField(idx, 'durationDays', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 text-xs font-bold text-center text-emerald-800 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-500 font-medium">ngày</span>
                        </div>

                        {stages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStage(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa giai đoạn này"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={st.description || ''}
                      onChange={e => updateStageField(idx, 'description', e.target.value)}
                      placeholder="Mô tả đặc điểm giai đoạn (ví dụ: tưới kích rễ, giữ ẩm nhẹ, che sáng...)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-600 focus:outline-none focus:border-emerald-500"
                    />

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Đang có <strong>{st.requirements.length}</strong> chỉ số môi trường</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => { setActiveStageIdx(idx); setStep(3); }}
                        className="text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        Chỉnh sửa chỉ số giai đoạn này ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Environmental Thresholds (DYNAMIC) */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Stage selector tabs */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="flex items-center gap-2 overflow-x-auto flex-1 mr-2">
                  {stages.map((st, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveStageIdx(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        activeStageIdx === idx
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      GĐ {idx + 1}: {st.name} ({st.requirements.length} chỉ số)
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddMetricOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer shrink-0 transition"
                >
                  <Plus size={14} /> Thêm chỉ số cho giai đoạn
                </button>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                <Info size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Cấu hình độc lập theo giai đoạn:</strong> Bạn có thể thêm, bớt hoặc đặt ngưỡng riêng cho giai đoạn <em>"{activeStage?.name}"</em> mà không làm ảnh hưởng các giai đoạn khác. Các chỉ số có <span className="text-emerald-700 font-bold">📡 Cảm biến online</span> sẽ kích hoạt cảnh báo & tự động hóa; chỉ số chưa có cảm biến vẫn được lưu trữ làm chuẩn quy trình canh tác.
                </div>
              </div>

              {/* Requirements List for active stage */}
              {activeStage?.requirements.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                  <Sliders size={32} className="mx-auto text-slate-400" />
                  <p className="text-xs text-slate-600 font-medium">Giai đoạn này chưa có chỉ số môi trường nào được cấu hình.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddMetricOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Thêm chỉ số đầu tiên
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeStage?.requirements.map(req => (
                    <div
                      key={req.parameterCode}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        req.enabled ? 'bg-white border-slate-300 shadow-2xs' : 'bg-slate-50/80 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sliders size={14} className="text-emerald-700" />
                          <span className="text-xs font-bold text-slate-800">
                            {req.metricName || req.parameterCode}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">({req.parameterCode})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {req.unit}
                          </span>
                          <input
                            type="checkbox"
                            checked={req.enabled}
                            onChange={e => updateMetricInStage(activeStageIdx, req.parameterCode, 'enabled', e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                            title="Bật/Tắt áp dụng chỉ số này"
                          />
                          <button
                            type="button"
                            onClick={() => removeMetricFromStage(activeStageIdx, req.parameterCode)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa chỉ số này khỏi giai đoạn"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Sensor status badge */}
                      <div className="mb-2.5">
                        {req.hasSensorSupport ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Radio size={11} className="text-emerald-700" />
                            📡 Cảm biến online (Tự động kích hoạt Rơ-le & Cảnh báo)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            ⚠️ Chưa có cảm biến kết nối (Chỉ lưu cấu hình mục tiêu)
                          </span>
                        )}
                      </div>

                      {/* Threshold Inputs */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Tối thiểu (Min)</label>
                          <input
                            type="number"
                            step="any"
                            value={req.minValue}
                            onChange={e => updateMetricInStage(activeStageIdx, req.parameterCode, 'minValue', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-200">
                          <label className="block text-[10px] text-emerald-800 font-semibold mb-0.5">Mục tiêu (Target)</label>
                          <input
                            type="number"
                            step="any"
                            value={req.targetValue}
                            onChange={e => updateMetricInStage(activeStageIdx, req.parameterCode, 'targetValue', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-emerald-400 rounded px-1.5 py-1 text-xs font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Tối đa (Max)</label>
                          <input
                            type="number"
                            step="any"
                            value={req.maxValue}
                            onChange={e => updateMetricInStage(activeStageIdx, req.parameterCode, 'maxValue', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Hủy
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !profileName.trim()) {
                    setErrorMsg('Vui lòng nhập tên cấu hình canh tác.');
                    return;
                  }
                  setErrorMsg('');
                  setStep(step + 1);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Đang lưu cấu hình...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Hoàn tất & Lưu Cấu Hình
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* POPUP: SELECT METRIC FROM CATALOG TO ADD TO ACTIVE STAGE */}
      {isAddMetricOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Thêm chỉ số vào "{activeStage?.name}"</h3>
                <p className="text-[11px] text-slate-500">Chọn từ danh mục hệ thống hoặc tự tạo chỉ số mới</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMetricOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableToAdd.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  Tất cả chỉ số trong danh mục đã được thêm vào giai đoạn này.
                </div>
              ) : (
                availableToAdd.map(def => (
                  <div
                    key={def.metricCode}
                    onClick={() => addMetricToCurrentStage(def)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                        {def.metricName} <span className="font-mono text-[10px] text-slate-400 font-normal">({def.metricCode})</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Ngưỡng chuẩn: {def.defaultMin} - {def.defaultMax} {def.unit} • {def.hasSensorSupport ? '📡 Cảm biến online' : '⚠️ Cấu hình mục tiêu'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">+ Thêm</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsAddMetricOpen(false);
                  setIsCreateMetricModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> + Tự tạo chỉ số mới hoàn toàn
              </button>
              <button
                type="button"
                onClick={() => setIsAddMetricOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: CREATE A COMPLETELY NEW METRIC DEFINITION */}
      {isCreateMetricModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tạo Chỉ Số Môi Trường Tùy Chỉnh Mới</h3>
                <p className="text-[11px] text-slate-500">Chỉ số này sẽ được lưu vào CSDL của Farm và có thể tái sử dụng</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateMetricModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên chỉ số *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tốc độ gió, Nồng độ CO2, Độ dẫn điện..."
                  value={newMetricForm.metricName}
                  onChange={e => {
                    const name = e.target.value;
                    const autoCode = name
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-zA-Z0-9]/g, '_')
                      .toUpperCase();
                    setNewMetricForm(prev => ({
                      ...prev,
                      metricName: name,
                      metricCode: prev.metricCode ? prev.metricCode : autoCode
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mã định danh (Code/Key) *</label>
                  <input
                    type="text"
                    placeholder="WIND_SPEED"
                    value={newMetricForm.metricCode}
                    onChange={e => setNewMetricForm({ ...newMetricForm, metricCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn vị đo (Unit) *</label>
                  <input
                    type="text"
                    placeholder="m/s, ppm, Lux..."
                    value={newMetricForm.unit}
                    onChange={e => setNewMetricForm({ ...newMetricForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Mô tả ý nghĩa</label>
                <input
                  type="text"
                  placeholder="Ý nghĩa nông học và phương pháp đo..."
                  value={newMetricForm.description}
                  onChange={e => setNewMetricForm({ ...newMetricForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Dải ngưỡng mặc định (Min &le; Target &le; Max)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Min"
                    value={newMetricForm.defaultMin}
                    onChange={e => setNewMetricForm({ ...newMetricForm, defaultMin: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-center font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Target"
                    value={newMetricForm.defaultTarget}
                    onChange={e => setNewMetricForm({ ...newMetricForm, defaultTarget: parseFloat(e.target.value) || 0 })}
                    className="bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-center font-bold text-emerald-800"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Max"
                    value={newMetricForm.defaultMax}
                    onChange={e => setNewMetricForm({ ...newMetricForm, defaultMax: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-center font-bold"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSensor"
                  checked={newMetricForm.hasSensorSupport}
                  onChange={e => setNewMetricForm({ ...newMetricForm, hasSensorSupport: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="hasSensor" className="text-[11px] text-slate-700 font-medium cursor-pointer">
                  Trang trại có gắn cảm biến vật lý online cho chỉ số này
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateMetricModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={creatingMetric}
                onClick={handleCreateNewMetricDefinition}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                {creatingMetric ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Lưu & Thêm vào giai đoạn
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
