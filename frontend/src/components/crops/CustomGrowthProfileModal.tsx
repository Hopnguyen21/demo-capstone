import React, { useState, useEffect } from 'react';
import {
  Sprout, Plus, Trash2, Check, ArrowRight, ArrowLeft,
  Sliders, ShieldCheck, Thermometer, Droplets, Sun, Zap, Info, AlertCircle, RefreshCw, X
} from 'lucide-react';
import { cropService } from '../../services';

export interface CustomGrowthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProfile: any) => void;
  initialCropId?: string;
  initialVarietyId?: string;
  templateProfile?: any;
}

interface StageDraft {
  name: string;
  durationDays: number;
  description?: string;
  requirements: {
    parameterCode: string;
    minValue: number;
    targetValue: number;
    maxValue: number;
    unit: string;
    enabled: boolean;
  }[];
}

const DEFAULT_PARAMETERS = [
  { code: 'SoilMoisture', name: 'Độ ẩm đất', unit: '%', defaultMin: 60, defaultTarget: 70, defaultMax: 80, icon: Droplets, color: 'text-sky-600' },
  { code: 'Temperature', name: 'Nhiệt độ không khí', unit: '°C', defaultMin: 20, defaultTarget: 25, defaultMax: 30, icon: Thermometer, color: 'text-amber-600' },
  { code: 'AirHumidity', name: 'Độ ẩm không khí', unit: '%', defaultMin: 55, defaultTarget: 68, defaultMax: 80, icon: Droplets, color: 'text-cyan-600' },
  { code: 'LightIntensity', name: 'Cường độ ánh sáng', unit: 'Lux', defaultMin: 10000, defaultTarget: 25000, defaultMax: 45000, icon: Sun, color: 'text-yellow-600' },
  { code: 'Ph', name: 'Độ pH đất', unit: 'pH', defaultMin: 5.5, defaultTarget: 6.2, defaultMax: 6.8, icon: Sliders, color: 'text-emerald-600' },
  { code: 'Ec', name: 'Độ dẫn điện EC', unit: 'mS/cm', defaultMin: 1.2, defaultTarget: 1.8, defaultMax: 2.5, icon: Zap, color: 'text-indigo-600' }
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
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form State
  const [cropId, setCropId] = useState<string>('');
  const [varietyId, setVarietyId] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  // Stages State
  const [stages, setStages] = useState<StageDraft[]>([
    {
      name: 'Giai đoạn 1: Cây con (Seedling)',
      durationDays: 20,
      description: 'Giai đoạn nảy mầm và phát triển bộ rễ ban đầu',
      requirements: DEFAULT_PARAMETERS.map(p => ({
        parameterCode: p.code,
        minValue: p.defaultMin,
        targetValue: p.defaultTarget,
        maxValue: p.defaultMax,
        unit: p.unit,
        enabled: true
      }))
    },
    {
      name: 'Giai đoạn 2: Sinh trưởng (Vegetative)',
      durationDays: 30,
      description: 'Giai đoạn phát triển thân lá và sinh khối',
      requirements: DEFAULT_PARAMETERS.map(p => ({
        parameterCode: p.code,
        minValue: p.defaultMin,
        targetValue: p.defaultTarget,
        maxValue: p.defaultMax,
        unit: p.unit,
        enabled: true
      }))
    },
    {
      name: 'Giai đoạn 3: Ra hoa & Đậu quả (Flowering)',
      durationDays: 25,
      description: 'Phân hóa mầm hoa và thụ phấn',
      requirements: DEFAULT_PARAMETERS.map(p => ({
        parameterCode: p.code,
        minValue: p.defaultMin,
        targetValue: p.defaultTarget,
        maxValue: p.defaultMax,
        unit: p.unit,
        enabled: true
      }))
    },
    {
      name: 'Giai đoạn 4: Thu hoạch (Harvest)',
      durationDays: 30,
      description: 'Trái chín và thu hoạch định kỳ',
      requirements: DEFAULT_PARAMETERS.map(p => ({
        parameterCode: p.code,
        minValue: p.defaultMin,
        targetValue: p.defaultTarget,
        maxValue: p.defaultMax,
        unit: p.unit,
        enabled: true
      }))
    }
  ]);

  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);

  // Load Crops
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    cropService.getCrops().then((cList: any[]) => {
      const validCrops = Array.isArray(cList) ? cList : [];
      setCrops(validCrops);
      const targetCropId = initialCropId || (validCrops[0]?.cropId || '');
      setCropId(targetCropId);
    }).catch(err => {
      console.error('Lỗi tải danh mục cây trồng:', err);
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
        requirements: DEFAULT_PARAMETERS.map(param => {
          const matched = (st.requirements || []).find((r: any) =>
            (r.parameterCode || '').toLowerCase() === param.code.toLowerCase()
          );
          return {
            parameterCode: param.code,
            minValue: matched ? Number(matched.minValue) : param.defaultMin,
            targetValue: matched ? Number(matched.targetValue) : param.defaultTarget,
            maxValue: matched ? Number(matched.maxValue) : param.defaultMax,
            unit: matched?.unit || param.unit,
            enabled: !!matched
          };
        })
      })));
    }
  }, [templateProfile, isOpen]);

  if (!isOpen) return null;

  const totalCycleDays = stages.reduce((acc, st) => acc + (Number(st.durationDays) || 0), 0);

  const handleAddStage = () => {
    const nextOrder = stages.length + 1;
    setStages(prev => [
      ...prev,
      {
        name: `Giai đoạn ${nextOrder}`,
        durationDays: 15,
        description: '',
        requirements: DEFAULT_PARAMETERS.map(p => ({
          parameterCode: p.code,
          minValue: p.defaultMin,
          targetValue: p.defaultTarget,
          maxValue: p.defaultMax,
          unit: p.unit,
          enabled: true
        }))
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

  const updateRequirement = (stageIdx: number, paramCode: string, field: 'minValue' | 'targetValue' | 'maxValue' | 'enabled', value: any) => {
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

      for (const req of st.requirements) {
        if (!req.enabled) continue;
        if (req.minValue > req.targetValue || req.targetValue > req.maxValue) {
          setErrorMsg(`Ngưỡng ${req.parameterCode} ở giai đoạn "${st.name}" không hợp lệ: Yêu cầu Min (${req.minValue}) <= Mục tiêu (${req.targetValue}) <= Max (${req.maxValue}).`);
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
            minValue: Number(r.minValue),
            targetValue: Number(r.targetValue),
            maxValue: Number(r.maxValue),
            unit: r.unit
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
                Thiết lập quy trình sinh trưởng và dải ngưỡng vi khí hậu thích ứng tự động cho Farm
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

        {/* Stepper Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-white text-xs font-bold text-slate-600">
          {[
            { s: 1, title: '1. Thông tin cây' },
            { s: 2, title: '2. Các giai đoạn' },
            { s: 3, title: '3. Ngưỡng vi khí hậu' },
            { s: 4, title: '4. Xác nhận & Lưu' }
          ].map(tab => (
            <button
              key={tab.s}
              type="button"
              onClick={() => setStep(tab.s)}
              className={`py-3 text-center border-b-2 transition cursor-pointer ${
                step === tab.s
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                  : 'border-transparent hover:bg-slate-50 text-slate-500'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Alert Error Box */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Loài cây trồng (Crop) *
                  </label>
                  <select
                    value={cropId}
                    onChange={e => setCropId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Chọn loài cây --</option>
                    {crops.map(c => (
                      <option key={c.cropId} value={c.cropId}>
                        {c.name} {c.scientificName ? `(${c.scientificName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giống thương mại / Variety (Tùy chọn)
                  </label>
                  <select
                    value={varietyId}
                    onChange={e => setVarietyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Áp dụng chung cho tất cả các giống --</option>
                    {varieties.map(v => (
                      <option key={v.varietyId} value={v.varietyId}>
                        {v.name} {v.description ? `— ${v.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên cấu hình quy trình canh tác *
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="VD: Quy trình Dưa lưới VietGAP Mùa Khô - Nông trại Xanh"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả / Ghi chú kỹ thuật canh tác
                </label>
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
                    Sắp xếp theo trình tự sinh trưởng từ lúc xuống giống đến khi thu hoạch.
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Environmental Thresholds */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Stage selector tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
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
                    GĐ {idx + 1}: {st.name} ({st.durationDays}d)
                  </button>
                ))}
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                💡 <strong>Quy chuẩn Min &le; Target &le; Max:</strong> Alert Engine và thiết bị Rơ-le điều khiển sẽ dựa vào dải ngưỡng của giai đoạn này để kích hoạt bơm/quạt và gửi cảnh báo khi vi phạm.
              </div>

              {/* Requirements Grid for active stage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {stages[activeStageIdx]?.requirements.map(req => {
                  const meta = DEFAULT_PARAMETERS.find(p => p.code === req.parameterCode);
                  const Icon = meta?.icon || Sliders;

                  return (
                    <div
                      key={req.parameterCode}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        req.enabled ? 'bg-white border-slate-300 shadow-2xs' : 'bg-slate-50/80 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Icon size={14} className={meta?.color || 'text-slate-600'} />
                          {meta?.name || req.parameterCode}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {req.unit}
                          </span>
                          <input
                            type="checkbox"
                            checked={req.enabled}
                            onChange={e => updateRequirement(activeStageIdx, req.parameterCode, 'enabled', e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                            title="Bật/Tắt áp dụng chỉ số này"
                          />
                        </div>
                      </div>

                      {req.enabled ? (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Min</span>
                            <input
                              type="number"
                              step="0.1"
                              value={req.minValue}
                              onChange={e => updateRequirement(activeStageIdx, req.parameterCode, 'minValue', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs font-bold px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 block mb-1">Mục tiêu</span>
                            <input
                              type="number"
                              step="0.1"
                              value={req.targetValue}
                              onChange={e => updateRequirement(activeStageIdx, req.parameterCode, 'targetValue', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs font-bold px-2 py-1.5 bg-emerald-50 border border-emerald-400 rounded-lg text-center text-emerald-900 focus:border-emerald-600 focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">Max</span>
                            <input
                              type="number"
                              step="0.1"
                              value={req.maxValue}
                              onChange={e => updateRequirement(activeStageIdx, req.parameterCode, 'maxValue', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs font-bold px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 text-[11px] text-slate-400 font-medium">
                          Chỉ số này đang tắt cho giai đoạn này
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Summary & Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  TỔNG QUAN CẤU HÌNH CANH TÁC
                </span>
                <h3 className="text-base font-bold text-slate-900">{profileName}</h3>
                <p className="text-xs text-slate-600">{description || 'Không có mô tả thêm.'}</p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-700 font-medium">
                  <span>Loài cây: <strong className="text-slate-900">{crops.find(c => c.cropId === cropId)?.name || 'Cây trồng'}</strong></span>
                  <span>• Giống: <strong className="text-slate-900">{varieties.find(v => v.varietyId === varietyId)?.name || 'Chung cho mọi giống'}</strong></span>
                  <span>• Tổng chu kỳ: <strong className="text-emerald-700 font-bold">{totalCycleDays} ngày</strong></span>
                  <span>• Số giai đoạn: <strong className="text-slate-900">{stages.length}</strong></span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Tóm tắt các giai đoạn &amp; dải thông số
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stages.map((st, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>{idx + 1}. {st.name}</span>
                        <span className="text-emerald-700 font-mono">{st.durationDays} ngày</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{st.description || 'Chưa có ghi chú'}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {st.requirements.filter(r => r.enabled).map(r => (
                          <span key={r.parameterCode} className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {r.parameterCode}: {r.minValue}-{r.maxValue}{r.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !profileName.trim()) {
                    setErrorMsg('Vui lòng nhập tên cấu hình canh tác.');
                    return;
                  }
                  setErrorMsg('');
                  setStep(s => s + 1);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-[#119653] hover:bg-[#0e7d45] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Đang lưu cấu hình...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Hoàn tất &amp; Lưu cấu hình
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
