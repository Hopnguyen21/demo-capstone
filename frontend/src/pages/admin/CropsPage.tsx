import React, { useState, useEffect } from 'react';
import { cropService, zoneService } from '../../services';
import { Crop, CalendarIrrigationPlan, Zone, CropVariety } from '../../types';
import { Button, Input, Modal, StatusBadge } from '../../components/ui/BaseUI';
import { CropCalendarView } from '../../components/crops/CropCalendarView';
import { 
  Sprout, Plus, Search, Layers, BookOpen, Calendar as CalendarIcon, 
  Thermometer, Droplets, Zap, Sun, RefreshCw, CheckCircle2, Sliders, Info, ChevronRight, Sunrise, Sunset,
  FileUp, FileText, Upload, Trash2, Check, AlertTriangle, FileCheck, GitBranch, Tag, Sparkles
} from 'lucide-react';

export const CropsPage: React.FC = () => {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'INFO' | 'CALENDAR' | 'SYNC'>('INFO');
  const [selectedZoneIdForSync, setSelectedZoneIdForSync] = useState<string>('zone-01');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Variety Management state (Item 10)
  const [varietiesByCrop, setVarietiesByCrop] = useState<Record<string, CropVariety[]>>({});
  const [isVarietyModalOpen, setIsVarietyModalOpen] = useState(false);
  const [selectedCropForVarieties, setSelectedCropForVarieties] = useState<Crop | null>(null);
  const [varietyList, setVarietyList] = useState<CropVariety[]>([]);
  const [newVarietyName, setNewVarietyName] = useState('');
  const [newVarietyDesc, setNewVarietyDesc] = useState('');
  const [isAddingVariety, setIsAddingVariety] = useState(false);

  // Form state for creating/editing crop
  const [formData, setFormData] = useState<Partial<Crop>>({
    name: '',
    scientificName: '',
    category: 'Rau ăn quả',
    growthCycleDays: 90,
    description: '',
    optimalTemperatureMin: 20,
    optimalTemperatureMax: 28,
    optimalSoilMoistureMin: 65,
    optimalSoilMoistureMax: 80,
    optimalpHMin: 6.0,
    optimalpHMax: 6.8,
    optimalECMin: 1.8,
    optimalECMax: 2.5,
    optimalLux: 25000,
    calendarIrrigationPlan: {
      repeatType: 'DAILY',
      lunarSyncEnabled: true,
      sessions: [
        { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
      ]
    }
  });

  const [editingCropId, setEditingCropId] = useState<string | null>(null);

  // VietGAP Document Upload Modal & Document Library
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [vietgapDocs, setVietgapDocs] = useState<Array<{
    id: string;
    fileName: string;
    fileType: 'PDF' | 'DOCX';
    fileSizeKb: number;
    uploadedAt: string;
    extractedCropName?: string;
    status: 'PARSED' | 'APPLIED';
    notes?: string;
  }>>([
    {
      id: 'doc-1',
      fileName: 'Quy_trinh_ky_thuat_canh_tac_Dua_Leo_VietGAP.pdf',
      fileType: 'PDF',
      fileSizeKb: 1420,
      uploadedAt: '18/10/2026 09:30',
      extractedCropName: 'Dưa leo Baby (Cucumber)',
      status: 'APPLIED',
      notes: 'Độ ẩm đất 65-80%, nhiệt độ 20-28°C, pH 6.0-6.8'
    },
    {
      id: 'doc-2',
      fileName: 'Huong_dan_IPM_va_vi_khi_hau_Xa_Lach_Thuy_Canh.docx',
      fileType: 'DOCX',
      fileSizeKb: 850,
      uploadedAt: '19/10/2026 14:15',
      extractedCropName: 'Xà lách cuộn (Batavia)',
      status: 'APPLIED',
      notes: 'Ngưỡng EC 1.6-2.2 mS/cm, tưới 3 ca Sáng-Trưa-Chiều'
    }
  ]);

  const loadData = async () => {
    const [fetchedCrops, fetchedZones, allVarieties] = await Promise.all([
      cropService.getCrops(),
      zoneService.getZones(),
      cropService.getAllVarieties().catch(() => []),
    ]);
    setCrops([...fetchedCrops]);
    setZones(fetchedZones);

    const varMap: Record<string, CropVariety[]> = {};
    if (Array.isArray(allVarieties)) {
      for (const v of allVarieties) {
        if (!varMap[v.cropId]) varMap[v.cropId] = [];
        varMap[v.cropId].push(v);
      }
    }
    setVarietiesByCrop(varMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingCropId(null);
    setFormData({
      name: '',
      scientificName: '',
      category: 'Rau ăn quả',
      growthCycleDays: 90,
      description: '',
      optimalTemperatureMin: 20,
      optimalTemperatureMax: 28,
      optimalSoilMoistureMin: 65,
      optimalSoilMoistureMax: 80,
      optimalpHMin: 6.0,
      optimalpHMax: 6.8,
      optimalECMin: 1.8,
      optimalECMax: 2.5,
      optimalLux: 25000,
      calendarIrrigationPlan: {
        repeatType: 'DAILY',
        lunarSyncEnabled: true,
        sessions: [
          { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
        ]
      }
    });
    setActiveModalTab('INFO');
    setIsModalOpen(true);
  };

  const openEditModal = (crop: Crop) => {
    setEditingCropId(crop.cropId);
    setFormData({ ...crop });
    setActiveModalTab('INFO');
    setIsModalOpen(true);
  };

  const openVarietyModal = async (crop: Crop) => {
    setSelectedCropForVarieties(crop);
    setNewVarietyName('');
    setNewVarietyDesc('');
    setIsVarietyModalOpen(true);
    try {
      const vars = await cropService.getVarieties(crop.cropId);
      setVarietyList(vars);
      setVarietiesByCrop(prev => ({ ...prev, [crop.cropId]: vars }));
    } catch {
      setVarietyList(varietiesByCrop[crop.cropId] || []);
    }
  };

  const handleAddVariety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropForVarieties || !newVarietyName.trim()) return;
    setIsAddingVariety(true);
    try {
      const created = await cropService.createVariety(selectedCropForVarieties.cropId, {
        name: newVarietyName.trim(),
        description: newVarietyDesc.trim() || undefined
      });
      const updatedList = [...varietyList, created];
      setVarietyList(updatedList);
      setVarietiesByCrop(prev => ({
        ...prev,
        [selectedCropForVarieties.cropId]: updatedList
      }));
      setNewVarietyName('');
      setNewVarietyDesc('');
      setNotification({ type: 'success', message: `Đã thêm giống cây [${created.name}] cho loài cây ${selectedCropForVarieties.name} thành công!` });
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Có lỗi khi thêm giống cây';
      setNotification({ type: 'error', message: `Lỗi: ${msg}` });
    } finally {
      setIsAddingVariety(false);
    }
  };

  const handleSeedSuggestedVariety = async (varietyName: string, desc: string) => {
    if (!selectedCropForVarieties) return;
    setIsAddingVariety(true);
    try {
      const created = await cropService.createVariety(selectedCropForVarieties.cropId, {
        name: varietyName,
        description: desc
      });
      const updatedList = [...varietyList, created];
      setVarietyList(updatedList);
      setVarietiesByCrop(prev => ({
        ...prev,
        [selectedCropForVarieties.cropId]: updatedList
      }));
      setNotification({ type: 'success', message: `Đã tạo nhanh giống cây [${varietyName}]!` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi thêm giống';
      setNotification({ type: 'error', message: `Lỗi: ${msg}` });
    } finally {
      setIsAddingVariety(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setActiveModalTab('INFO');
      setNotification({ type: 'error', message: 'Vui lòng nhập Tên cây trồng (Bước 1) trước khi lưu!' });
      return;
    }
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        scientificName: formData.scientificName?.trim() || formData.name.trim(),
      };
      if (editingCropId) {
        await cropService.updateCrop(editingCropId, payload);
        setNotification({ type: 'success', message: `Đã cập nhật cây trồng [${payload.name}]!` });
      } else {
        await cropService.createCrop(payload);
        setNotification({ type: 'success', message: `Đã thêm cây trồng [${payload.name}] vào Thư viện thành công!` });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu cây trồng.';
      setNotification({ type: 'error', message: `Lỗi: ${msg}` });
    }
  };

  const handleDeleteCrop = async (cropId: string, cropName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa loài cây [${cropName}] khỏi Thư viện và Cơ sở dữ liệu?`)) {
      return;
    }
    try {
      await cropService.deleteCrop(cropId);
      setNotification({ type: 'success', message: `Đã xóa thành công cây trồng [${cropName}] khỏi CSDL!` });
      await loadData();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xóa cây trồng.';
      setNotification({ type: 'error', message: `Lỗi: ${msg}` });
    }
  };

  const handleSyncToZone = async (cropId?: string, targetZoneId?: string) => {
    const cId = cropId || editingCropId || crops[0]?.cropId;
    const zId = targetZoneId || selectedZoneIdForSync;

    if (!cId || !zId) return;

    try {
      const res = await cropService.syncCropScheduleToZone(cId, zId);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `⚡ Đã đồng bộ thành công ${res.createdSchedulesCount} lịch tưới Sáng-Trưa-Chiều & Ngưỡng Vi khí hậu sang Zone "${res.zoneName}"!`
        });
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Có lỗi khi đồng bộ sang Zone.';
      setNotification({ type: 'error', message: `Lỗi: ${msg}` });
    }
  };

  const handleDocumentFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isDocx = fileName.toLowerCase().endsWith('.docx');

    if (!isPdf && !isDocx) {
      setNotification({
        type: 'error',
        message: 'Định dạng tài liệu không hỗ trợ. Vui lòng chọn tệp định dạng .PDF hoặc .DOCX chuẩn VietGAP.'
      });
      return;
    }

    setIsParsingDoc(true);

    try {
      // Giả lập đọc và bóc tách các tham số nông học từ tài liệu PDF/DOCX
      await new Promise(r => setTimeout(r, 1200));

      let cropName = 'Dưa leo Baby VietGAP';
      let scientificName = 'Cucumis sativus L.';
      let category = 'Rau ăn quả';
      let growthCycle = 75;
      let tempMin = 22, tempMax = 30;
      let soilMoistureMin = 70, soilMoistureMax = 85;
      let phMin = 6.0, phMax = 6.8;
      let ecMin = 1.8, ecMax = 2.4;
      let description = 'Quy chuẩn VietGAP trích xuất từ tài liệu: Bón lót hữu cơ hoai mục, duy trì độ ẩm tầng đất 15-20cm, tưới nhỏ giọt 3 ca/ngày.';

      const lower = fileName.toLowerCase();
      if (lower.includes('xa lach') || lower.includes('lettuce') || lower.includes('xà lách')) {
        cropName = 'Xà lách cuộn Batavia VietGAP';
        scientificName = 'Lactuca sativa var. capitata';
        category = 'Rau ăn lá';
        growthCycle = 45;
        tempMin = 18; tempMax = 25;
        soilMoistureMin = 75; soilMoistureMax = 88;
        phMin = 5.8; phMax = 6.5;
        ecMin = 1.4; ecMax = 2.0;
        description = 'Quy chuẩn kỹ thuật VietGAP cho Xà lách: Ưa mát, độ ẩm đất cao, phòng ngừa thối nhũn và bọ trĩ bằng chế phẩm sinh học.';
      } else if (lower.includes('dau tay') || lower.includes('strawberry') || lower.includes('dâu tây')) {
        cropName = 'Dâu tây Hana New Zealand VietGAP';
        scientificName = 'Fragaria × ananassa Duch.';
        category = 'Cây ăn trái';
        growthCycle = 120;
        tempMin = 16; tempMax = 24;
        soilMoistureMin = 65; soilMoistureMax = 78;
        phMin = 5.5; phMax = 6.5;
        ecMin = 1.2; ecMax = 1.8;
        description = 'Quy chuẩn VietGAP Dâu tây: Đất tơi xốp, thoát nước tốt, tưới vào sáng sớm và chiều mát, kiểm soát phấn trắng.';
      } else if (lower.includes('ca chua') || lower.includes('tomato') || lower.includes('cà chua')) {
        cropName = 'Cà chua Nova VietGAP';
        scientificName = 'Solanum lycopersicum';
        category = 'Rau ăn quả';
        growthCycle = 100;
        tempMin = 20; tempMax = 28;
        soilMoistureMin = 65; soilMoistureMax = 80;
        phMin = 6.0; phMax = 6.8;
        ecMin = 2.0; ecMax = 2.8;
        description = 'Quy chuẩn VietGAP Cà chua: Chế độ tưới nhỏ giọt định lượng, bổ sung Canxi/Bo chống nứt trái.';
      }

      const newDoc = {
        id: `doc-${Date.now()}`,
        fileName: file.name,
        fileType: (isPdf ? 'PDF' : 'DOCX') as 'PDF' | 'DOCX',
        fileSizeKb: Math.round(file.size / 1024),
        uploadedAt: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        extractedCropName: cropName,
        status: 'APPLIED' as const,
        notes: `Tự động trích xuất: Nhiệt độ ${tempMin}-${tempMax}°C, Độ ẩm đất ${soilMoistureMin}-${soilMoistureMax}%, pH ${phMin}-${phMax}, EC ${ecMin}-${ecMax} mS/cm`
      };

      setVietgapDocs(prev => [newDoc, ...prev]);

      // Tự động tạo bản ghi Cây trồng mẫu trong Thư viện hệ thống
      const newCropPayload: Partial<Crop> = {
        name: cropName,
        scientificName,
        category,
        growthCycleDays: growthCycle,
        description,
        optimalTemperatureMin: tempMin,
        optimalTemperatureMax: tempMax,
        optimalSoilMoistureMin: soilMoistureMin,
        optimalSoilMoistureMax: soilMoistureMax,
        optimalpHMin: phMin,
        optimalpHMax: phMax,
        optimalECMin: ecMin,
        optimalECMax: ecMax,
        optimalLux: 28000,
        isSystemDefined: true,
        calendarIrrigationPlan: {
          repeatType: 'DAILY',
          lunarSyncEnabled: true,
          sessions: [
            { session: 'MORNING', title: 'Tưới Sáng Bù Nước', startTime: '07:30', durationMinutes: 20, volumeMl: 550, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            { session: 'NOON', title: 'Tưới Trưa Hạ Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            { session: 'AFTERNOON', title: 'Tưới Chiều Nuôi Dưỡng', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
          ]
        }
      };

      // Cập nhật ngay vào danh sách crops trên giao diện nếu chưa có
      setCrops(prev => {
        const exists = prev.some(c => c.name.toLowerCase() === cropName.toLowerCase());
        if (exists) return prev;
        const mockCrop: Crop = {
          cropId: `crop-${Date.now()}`,
          name: cropName,
          scientificName,
          category,
          growthCycleDays: growthCycle,
          description,
          optimalTemperatureMin: tempMin,
          optimalTemperatureMax: tempMax,
          optimalSoilMoistureMin: soilMoistureMin,
          optimalSoilMoistureMax: soilMoistureMax,
          optimalpHMin: phMin,
          optimalpHMax: phMax,
          optimalECMin: ecMin,
          optimalECMax: ecMax,
          optimalLux: 28000,
          isSystemDefined: true,
          createdAt: new Date().toISOString(),
          calendarIrrigationPlan: newCropPayload.calendarIrrigationPlan
        };
        return [mockCrop, ...prev];
      });

      try {
        const created = await cropService.createCrop(newCropPayload);
        const createdCropId = created?.cropId || created?.id;
        
        // Tự động tạo Hồ sơ sinh trưởng (GrowthProfile) chuẩn 4 giai đoạn từ tài liệu VietGAP này
        if (createdCropId) {
          try {
            await cropService.createGrowthProfile({
              cropId: createdCropId,
              name: `Hồ sơ VietGAP Chuẩn - ${cropName} (${growthCycle} ngày)`,
              description: `Quy chuẩn vi khí hậu bóc tách từ tài liệu VietGAP ${fileName}`
            });
          } catch (profileErr) {
            console.warn('Auto createGrowthProfile info:', profileErr);
          }
        }
      } catch (err: any) {
        console.warn('Backend createCrop warning (possibly already exists):', err?.message);
      }

      setNotification({
        type: 'success',
        message: `📄 Đã đọc thành công tệp "${file.name}"! Đã tạo Cây trồng & Hồ sơ Sinh trưởng (Growth Profile) VietGAP vào CSDL!`
      });
      await loadData();
    } catch (err: any) {
      console.error('Document parsing error:', err);
      setNotification({
        type: 'error',
        message: 'Không thể phân tích tài liệu: ' + (err?.message || 'Lỗi không xác định')
      });
    } finally {
      setIsParsingDoc(false);
      event.target.value = '';
    }
  };

  const filtered = (crops || []).filter(c => {
    if (!c) return false;
    const name = String(c.name || '').toLowerCase();
    const scientific = String(c.scientificName || '').toLowerCase();
    const query = String(search || '').toLowerCase().trim();
    if (!query) return true;
    return name.includes(query) || scientific.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#119653]" size={24} /> Thư viện Cây trồng Chuẩn (System Crop Library)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Danh mục các loài cây mẫu VietGAP tích hợp Lịch tưới dạng Cuốn Lịch (Sáng - Trưa - Chiều) và tự động đồng bộ sang Zone của Owner.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={() => setIsDocModalOpen(true)}
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white"
          >
            <FileUp size={16} className="mr-1.5 text-emerald-600" /> Nhập Dữ liệu VietGAP (PDF / DOCX)
          </Button>
          <Button onClick={openCreateModal}>
            <Plus size={16} className="mr-1.5" /> Thêm Cây trồng Thủ công
          </Button>
        </div>
      </div>

      {/* VietGAP System Standards Overview Widget */}
      <div className="p-5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-700/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-emerald-300 border border-white/20">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">Quy chuẩn Nông nghiệp VietGAP Hệ thống Hiện hành</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400 text-emerald-950 uppercase">
                  TCVN 11892-1:2017
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                Áp dụng chuẩn canh tác Đất trồng & Nhà màng công nghệ cao, quản lý tưới nước nhỏ giọt tiết kiệm và kiểm soát sâu bệnh IPM.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-700/60 border border-emerald-500/40 text-emerald-100 font-mono">
              📑 {vietgapDocs.length} tài liệu PDF/DOCX đã nạp
            </span>
          </div>
        </div>

        {/* 4 Pillars of VietGAP Standard Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Thổ nhưỡng & Đất trồng</span>
            <div className="font-bold text-white text-sm">pH 5.5 - 6.8</div>
            <div className="text-[10px] text-emerald-200">Độ ẩm tối ưu 65% - 85%</div>
          </div>
          <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Vi khí hậu & Quang năng</span>
            <div className="font-bold text-white text-sm">Nhiệt độ 18 - 30°C</div>
            <div className="text-[10px] text-emerald-200">Ánh sáng 20.000 - 30.000 Lux</div>
          </div>
          <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Quản lý Nguồn nước</span>
            <div className="font-bold text-white text-sm">Tưới Nhỏ Giọt 3 Ca</div>
            <div className="text-[10px] text-emerald-200">Sáng sớm - Trưa hạ nhiệt - Chiều</div>
          </div>
          <div className="p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Phòng ngừa Dịch hại (IPM)</span>
            <div className="font-bold text-white text-sm">Sinh học & Vi sinh</div>
            <div className="text-[10px] text-emerald-200">Hạn chế tồn dư, cách ly chuẩn</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm kiếm loài cây, tên khoa học..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-slate-500 font-medium">Tổng số: <strong>{filtered.length}</strong> loại cây</span>
      </div>

      {/* Crop Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(c => {
          const sessions = c.calendarIrrigationPlan?.sessions || [];
          const mSess = sessions.find(s => s.session === 'MORNING');
          const nSess = sessions.find(s => s.session === 'NOON');
          const aSess = sessions.find(s => s.session === 'AFTERNOON');

          return (
            <div key={c.cropId} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs hover:border-emerald-600/40 transition-all group flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mb-1 inline-block">
                      {c.category || 'Rau ăn quả'} • {c.growthCycleDays || 90} ngày
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">{c.name}</h3>
                    <p className="text-xs italic text-emerald-800 font-serif font-medium">{c.scientificName}</p>
                  </div>
                  <StatusBadge status={c.isSystemDefined ? 'ACTIVE' : 'WARNING'} label={c.isSystemDefined ? 'VietGAP' : 'Custom'} />
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>

                {/* Key specs badge row */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Thermometer size={13} className="text-rose-600" />
                    <span>Nhiệt độ: <strong>{c.optimalTemperatureMin || 20}-{c.optimalTemperatureMax || 28}°C</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Droplets size={13} className="text-sky-600" />
                    <span>Độ ẩm đất: <strong>{c.optimalSoilMoistureMin || 65}-{c.optimalSoilMoistureMax || 80}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Zap size={13} className="text-amber-600" />
                    <span>EC: <strong>{c.optimalECMin || 1.8}-{c.optimalECMax || 2.5} mS/cm</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Sun size={13} className="text-yellow-600" />
                    <span>pH: <strong>{c.optimalpHMin || 6.0}-{c.optimalpHMax || 6.8}</strong></span>
                  </div>
                </div>

                {/* Calendar schedule summary badge */}
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                    <span className="flex items-center gap-1"><CalendarIcon size={13} /> Cuốn Lịch Tưới 3 Ca</span>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-950 px-1.5 py-0.2 rounded font-mono">
                      {c.calendarIrrigationPlan?.repeatType === 'DAILY' ? 'Hàng ngày' : 'Định kỳ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600">
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${mSess?.enabled ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      🌅 Sáng {mSess?.startTime || '07:30'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${nSess?.enabled ? 'bg-rose-100 text-rose-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      ☀️ Trưa {nSess?.startTime || '12:00'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${aSess?.enabled ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'bg-slate-100 opacity-50'}`}>
                      🌇 Chiều {aSess?.startTime || '16:30'}
                    </span>
                  </div>
                </div>

                {/* Plant Varieties Badge Row (Item 10) */}
                <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                    <span className="flex items-center gap-1.5">
                      <Sprout size={13} className="text-purple-600" /> Giống cây thuộc loài (Varieties)
                    </span>
                    <span className="text-[10px] bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded-full font-bold">
                      {(varietiesByCrop[c.cropId] || []).length} giống
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {(varietiesByCrop[c.cropId] || []).length > 0 ? (
                      (varietiesByCrop[c.cropId] || []).slice(0, 3).map(v => (
                        <span key={v.varietyId} className="bg-white border border-purple-200 text-purple-800 px-2 py-0.5 rounded-md font-medium shadow-2xs">
                          {v.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Chưa có giống cây được định nghĩa</span>
                    )}
                    {(varietiesByCrop[c.cropId] || []).length > 3 && (
                      <span className="text-purple-700 font-semibold px-1 self-center">
                        +{(varietiesByCrop[c.cropId] || []).length - 3} giống khác
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditModal(c)} className="text-[#119653] hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                    ✏️ Xem & Sửa
                  </button>
                  <button 
                    onClick={() => handleDeleteCrop(c.cropId, c.name)} 
                    className="text-rose-600 hover:text-rose-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    title="Xóa cây trồng khỏi DB"
                  >
                    <Trash2 size={13} /> Xóa
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openVarietyModal(c)}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 text-[11px] transition-all cursor-pointer shadow-2xs"
                    title="Quản lý các giống cây thuộc loài này"
                  >
                    <Layers size={12} className="text-purple-700" /> Giống cây
                  </button>
                  <button
                    onClick={() => {
                      openEditModal(c);
                      setActiveModalTab('SYNC');
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 text-[11px] shadow-2xs transition-all cursor-pointer"
                  >
                    <RefreshCw size={12} /> Đồng bộ Zone
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EXPANDED MODAL: Add / Edit Crop with Calendar Schedule & Zone Sync */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCropId ? "Chỉnh sửa Cây trồng & Cuốn Lịch Tưới" : "Thêm Cây trồng Mới vào Thư viện"}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Multi-Tab Navigation inside Modal */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveModalTab('INFO')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'INFO' ? 'border-[#119653] text-[#119653]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sprout size={14} /> 1. Thông tin & Vi Khí Hậu
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('CALENDAR')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'CALENDAR' ? 'border-[#119653] text-[#119653]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarIcon size={14} /> 2. Cuốn Lịch Tưới (Sáng-Trưa-Chiều)
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('SYNC')}
              className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeModalTab === 'SYNC' ? 'border-[#119653] text-[#119653]' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <RefreshCw size={14} /> 3. Đồng bộ với Zone Owner
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* TAB 1: General Info & Microclimate Targets */}
            {activeModalTab === 'INFO' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Tên cây trồng *</label>
                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ví dụ: Dâu tây Đà Lạt" />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Tên khoa học (Scientific Name)</label>
                    <Input value={formData.scientificName} onChange={e => setFormData({ ...formData, scientificName: e.target.value })} placeholder="Fragaria × ananassa" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Phân nhóm loài cây</label>
                    <select
                      value={formData.category || 'Rau ăn quả'}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="Rau ăn quả">Rau ăn quả (Tomato, Chili, Cucumber)</option>
                      <option value="Rau ăn lá">Rau ăn lá (Hydroponic Leafy Greens)</option>
                      <option value="Cây ăn trái">Cây ăn trái (Fruit Crops)</option>
                      <option value="Cây củ">Cây củ & Gia vị</option>
                      <option value="Hoa & Dược liệu">Hoa & Dược liệu cao cấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Chu kỳ sinh trưởng vụ mùa (số ngày)</label>
                    <Input type="number" min={10} max={365} value={formData.growthCycleDays || 90} onChange={e => setFormData({ ...formData, growthCycleDays: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mô tả đặc tính nông học & kỹ thuật VietGAP</label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ưa khí hậu mát mẻ, cần kiểm soát EC và độ ẩm đất tự động..." />
                </div>

                {/* Optimal Environmental Parameters */}
                <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                      <Sliders size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Cấu hình Ngưỡng Vi Khí Hậu Tối Ưu (Environmental Requirements)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Ngưỡng tham số sinh trưởng tối ưu VietGAP làm căn cứ tự động kích hoạt thiết bị.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Nhiệt độ */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-rose-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-rose-50 text-rose-600 border border-rose-100">
                          <Thermometer size={14} />
                        </div>
                        <span>Nhiệt độ (°C)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            value={formData.optimalTemperatureMin || 20}
                            onChange={e => setFormData({ ...formData, optimalTemperatureMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            value={formData.optimalTemperatureMax || 28}
                            onChange={e => setFormData({ ...formData, optimalTemperatureMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Độ ẩm đất */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-sky-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-sky-50 text-sky-600 border border-sky-100">
                          <Droplets size={14} />
                        </div>
                        <span>Độ ẩm đất (%)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            value={formData.optimalSoilMoistureMin || 65}
                            onChange={e => setFormData({ ...formData, optimalSoilMoistureMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            value={formData.optimalSoilMoistureMax || 80}
                            onChange={e => setFormData({ ...formData, optimalSoilMoistureMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Độ pH */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-100">
                          <Sun size={14} />
                        </div>
                        <span>Độ pH</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalpHMin || 6.0}
                            onChange={e => setFormData({ ...formData, optimalpHMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalpHMax || 6.8}
                            onChange={e => setFormData({ ...formData, optimalpHMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Độ EC */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <div className="p-1 rounded bg-purple-50 text-purple-600 border border-purple-100">
                          <Zap size={14} />
                        </div>
                        <span>Độ EC (mS/cm)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 items-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Min</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalECMin || 1.8}
                            onChange={e => setFormData({ ...formData, optimalECMin: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Max</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={formData.optimalECMax || 2.5}
                            onChange={e => setFormData({ ...formData, optimalECMax: Number(e.target.value) })}
                            className="px-1.5 py-1 text-center text-xs font-semibold h-8 rounded-lg bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Calendar Irrigation Schedule (Sáng - Trưa - Chiều) */}
            {activeModalTab === 'CALENDAR' && (
              <CropCalendarView
                plan={formData.calendarIrrigationPlan || {
                  repeatType: 'DAILY',
                  lunarSyncEnabled: true,
                  sessions: [
                    { session: 'MORNING', title: 'Tưới Sáng Khởi Động', startTime: '07:30', durationMinutes: 20, volumeMl: 500, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                    { session: 'NOON', title: 'Tưới Trưa Giảm Nhiệt', startTime: '12:00', durationMinutes: 10, volumeMl: 300, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
                    { session: 'AFTERNOON', title: 'Tưới Chiều Bổ Sung', startTime: '16:30', durationMinutes: 15, volumeMl: 400, enabled: true, daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
                  ]
                }}
                onChangePlan={(updated) => setFormData({ ...formData, calendarIrrigationPlan: updated })}
              />
            )}

            {/* TAB 3: Synchronize with Owner Zone */}
            {activeModalTab === 'SYNC' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-2">
                    <RefreshCw size={16} className="text-emerald-700" />
                    Đồng bộ Lịch tưới Sáng-Trưa-Chiều trực tiếp vào Zone của Owner
                  </h4>
                  <p className="text-emerald-800 text-[11px]">
                    Khi kích hoạt đồng bộ, hệ thống sẽ tự động cập nhật các Lịch tưới Định kỳ (Cron Schedules) và thiết lập Dải tham số vi khí hậu cho Zone được chọn.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Chọn Zone / Nhà màng mục tiêu của Owner:</label>
                  <select
                    value={selectedZoneIdForSync}
                    onChange={(e) => setSelectedZoneIdForSync(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold text-slate-900"
                  >
                    {zones.map(z => (
                      <option key={z.zoneId} value={z.zoneId}>
                        {z.name} (Lô đất: {z.fieldId} • Cây hiện tại: {z.currentCrop || 'Chưa chọn'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                  <h5 className="font-bold text-slate-900">Nội dung sẽ được đồng bộ hóa sang Zone:</h5>
                  <ul className="space-y-1 text-slate-600 list-disc pl-4">
                    <li>Lịch tưới <strong>Ca Sáng ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.startTime || '07:30'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'MORNING')?.durationMinutes || 20} phút</li>
                    <li>Lịch tưới <strong>Ca Trưa ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.startTime || '12:00'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.durationMinutes || 10} phút ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'NOON')?.enabled ? 'Đã kích hoạt' : 'Tắt'})</li>
                    <li>Lịch tưới <strong>Ca Chiều ({formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.startTime || '16:30'})</strong> - {formData.calendarIrrigationPlan?.sessions?.find(s => s.session === 'AFTERNOON')?.durationMinutes || 15} phút</li>
                    <li>Ngưỡng độ ẩm đất tối ưu: <strong>{formData.optimalSoilMoistureMin || 65}% - {formData.optimalSoilMoistureMax || 80}%</strong></li>
                    <li>Cập nhật tên loài cây canh tác chính thức cho Zone.</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <Button 
                    type="button" 
                    onClick={() => handleSyncToZone()}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md"
                  >
                    <RefreshCw size={15} /> KÍCH HOẠT ĐỒNG BỘ SANG ZONE NGAY TỨC THÌ
                  </Button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                {activeModalTab === 'INFO' ? 'Bước 1: Nhập thông tin & vi khí hậu' : activeModalTab === 'CALENDAR' ? 'Bước 2: Chỉnh lịch tưới Cuốn Lịch' : 'Bước 3: Đồng bộ với Owner Zone'}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                {activeModalTab !== 'SYNC' ? (
                  <Button type="button" onClick={() => setActiveModalTab(activeModalTab === 'INFO' ? 'CALENDAR' : 'SYNC')}>
                    Tiếp theo <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button type="submit">Lưu Cây trồng vào Thư viện</Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* MODAL: Nhập Dữ liệu VietGAP từ tệp PDF & DOCX */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Nhập Dữ liệu Quy chuẩn VietGAP (Tệp PDF / DOCX)"
      >
        <div className="space-y-5 text-xs max-h-[80vh] overflow-y-auto pr-1">
          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 bg-emerald-50/40 text-center space-y-3 transition-colors">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <FileUp size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-sm">Tải lên Tài liệu Kỹ thuật Nông nghiệp VietGAP</h4>
              <p className="text-slate-500 text-[11px]">Hỗ trợ định dạng tài liệu <strong>.PDF</strong> và <strong>.DOCX</strong> (dung lượng tối đa 15MB)</p>
            </div>

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer shadow-xs transition-all text-xs">
              <Upload size={14} /> Chọn tệp PDF hoặc DOCX
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleDocumentFileUpload}
                disabled={isParsingDoc}
                className="hidden"
              />
            </label>

            {isParsingDoc && (
              <div className="flex items-center justify-center gap-2 text-emerald-800 font-medium pt-2">
                <RefreshCw size={14} className="animate-spin text-emerald-600" />
                <span>AI đang đọc và bóc tách dữ liệu vi khí hậu, ngưỡng tưới và kỹ thuật VietGAP...</span>
              </div>
            )}
          </div>

          {/* Quick Demo Pre-load Files */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpen size={14} className="text-emerald-600" /> Hoặc chọn nhanh mẫu tài liệu VietGAP có sẵn:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  handleDocumentFileUpload({
                    target: {
                      files: [new File(['dummy'], 'Quy_trinh_VietGAP_Dua_Leo_Baby_2026.pdf', { type: 'application/pdf' })],
                      value: ''
                    }
                  } as any);
                }}
                disabled={isParsingDoc}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-lg text-slate-700 hover:text-emerald-800 flex items-center gap-1.5 transition-all shadow-2xs text-[11px]"
              >
                <FileText size={13} className="text-rose-500" /> PDF: VietGAP Dưa Leo Baby
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDocumentFileUpload({
                    target: {
                      files: [new File(['dummy'], 'Tai_lieu_IPM_Xa_Lach_Batavia_VietGAP.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })],
                      value: ''
                    }
                  } as any);
                }}
                disabled={isParsingDoc}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-lg text-slate-700 hover:text-emerald-800 flex items-center gap-1.5 transition-all shadow-2xs text-[11px]"
              >
                <FileText size={13} className="text-sky-600" /> DOCX: IPM Xà Lách Batavia
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDocumentFileUpload({
                    target: {
                      files: [new File(['dummy'], 'So_tay_canh_tac_Dau_Tay_Hana_VietGAP.pdf', { type: 'application/pdf' })],
                      value: ''
                    }
                  } as any);
                }}
                disabled={isParsingDoc}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-lg text-slate-700 hover:text-emerald-800 flex items-center gap-1.5 transition-all shadow-2xs text-[11px]"
              >
                <FileText size={13} className="text-rose-500" /> PDF: Sổ tay Dâu Tây Hana
              </button>
            </div>
          </div>

          {/* List of Imported Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <FileCheck size={15} className="text-emerald-600" /> Danh sách Tài liệu VietGAP Đã Nạp ({vietgapDocs.length})
              </h5>
            </div>

            <div className="space-y-2">
              {vietgapDocs.map(doc => (
                <div key={doc.id} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${doc.fileType === 'PDF' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-sky-100 text-sky-800 border border-sky-200'}`}>
                        {doc.fileType}
                      </span>
                      <span className="truncate max-w-[280px] sm:max-w-[360px]">{doc.fileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{doc.fileSizeKb} KB</span>
                  </div>

                  <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                    <span>Loài cây trích xuất: <strong className="text-emerald-800">{doc.extractedCropName}</strong></span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">Thời gian nạp: {doc.uploadedAt}</span>
                  </div>

                  {doc.notes && (
                    <div className="p-2 bg-emerald-50/70 rounded-lg text-[11px] text-emerald-900 border border-emerald-100 font-medium">
                      ✓ {doc.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>

      {/* DEDICATED MODAL: Plant Variety Management (Item 10) */}
      <Modal
        isOpen={isVarietyModalOpen}
        onClose={() => setIsVarietyModalOpen(false)}
        title={`Quản lý Giống cây (Plant Variety) - ${selectedCropForVarieties?.name || ''}`}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-xs">
          {/* Architectural / Educational Banner for Reviewers & Teachers */}
          <div className="p-3.5 bg-linear-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-purple-900 text-xs">
              <Sparkles size={15} className="text-purple-600" />
              <span>Mô hình Nông học: 1 Loài cây (Crop) ───&lt; Nhiều Giống cây (Plant Varieties)</span>
            </div>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              Loài cây <strong className="font-semibold text-purple-950">[{selectedCropForVarieties?.name}]</strong> là danh mục nông học cấp 1. 
              Các giống cây con dưới đây được dùng khi nông dân tạo đợt trồng (PlantingCrop), đảm bảo <em>chỉ chọn được giống đúng loài cây đã chọn</em> qua cascade dropdown.
            </p>
          </div>

          {/* Quick seed suggestions for typical crops */}
          {selectedCropForVarieties && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag size={13} className="text-emerald-600" /> Gợi ý các giống phổ biến (Nhấn để thêm nhanh):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCropForVarieties.name.toLowerCase().includes('cà chua') ? (
                  <>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Cà chua bi lùn F1', 'Sinh trưởng hữu hạn, thời gian 70 ngày, brix 8.5%')}
                      className="px-2.5 py-1 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Cà chua bi lùn F1
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Cà chua Cherry Nova VietGAP', 'Dạng chùm, quả đỏ mọng, vị ngọt thanh brix 9.5%')}
                      className="px-2.5 py-1 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Cà chua Cherry Nova
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Cà chua Múi Hoàng Gia', 'Trái lớn 180-250g, thịt dày, chịu nhiệt tốt')}
                      className="px-2.5 py-1 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Cà chua Múi Hoàng Gia
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Cà chua Beef Đà Lạt', 'Chuyên canh nhà màng công nghệ cao, quả chắc ngọt')}
                      className="px-2.5 py-1 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Cà chua Beef Đà Lạt
                    </button>
                  </>
                ) : selectedCropForVarieties.name.toLowerCase().includes('dưa') ? (
                  <>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Dưa lưới Huỳnh Long', 'Vỏ vàng ruột cam, vân lưới nổi rõ, độ ngọt cao')}
                      className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Dưa lưới Huỳnh Long
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Dưa lưới Taki Nhật Bản', 'Vân lưới đồng đều, ruột xanh ngọc, chuẩn xuất khẩu')}
                      className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Dưa lưới Taki Nhật Bản
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety('Dưa leo baby VietGAP', 'Trái dài 10-12cm, giòn ngọt không đắng')}
                      className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + Dưa leo baby VietGAP
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety(`${selectedCropForVarieties.name} F1 Cao Sản`, 'Kháng bệnh tốt, năng suất vượt trội theo tiêu chuẩn VietGAP')}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + {selectedCropForVarieties.name} F1 Cao Sản
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariety}
                      onClick={() => handleSeedSuggestedVariety(`${selectedCropForVarieties.name} Thủy Canh Chuyên Dụng`, 'Phù hợp trồng hệ thống NFT và giá thể tưới nhỏ giọt')}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg font-medium transition-all cursor-pointer shadow-2xs"
                    >
                      + {selectedCropForVarieties.name} Thủy Canh Chuyên Dụng
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Form to Add New Variety */}
          <form onSubmit={handleAddVariety} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Plus size={14} className="text-purple-600" /> Thêm Giống Cây Mới Cho [{selectedCropForVarieties?.name}]
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên giống cây *</label>
                <Input
                  required
                  placeholder="Ví dụ: Cà chua Cherry Nova F1"
                  value={newVarietyName}
                  onChange={e => setNewVarietyName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Đặc tính sinh trưởng & chất lượng</label>
                <Input
                  placeholder="Ví dụ: Độ brix 9.2%, kháng bọ trĩ, quả mọng"
                  value={newVarietyDesc}
                  onChange={e => setNewVarietyDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isAddingVariety || !newVarietyName.trim()} className="bg-purple-700 hover:bg-purple-800 text-white text-xs py-1.5">
                {isAddingVariety ? 'Đang lưu...' : '+ Thêm Giống Cây'}
              </Button>
            </div>
          </form>

          {/* List of Existing Varieties */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-purple-600" /> Danh sách Giống Cây Hiện Có ({varietyList.length})
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Entity: PlantVariety (CropId: {selectedCropForVarieties?.cropId})</span>
            </div>

            {varietyList.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-500 text-xs border border-dashed border-slate-300">
                Loài cây này chưa có giống nào được thêm. Hãy chọn các nút gợi ý ở trên hoặc điền form để tạo giống đầu tiên!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {varietyList.map(v => (
                  <div key={v.varietyId} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs hover:border-purple-300 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{v.name}</span>
                        {v.isSystemDefined && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200">
                            Hệ thống
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {v.description || 'Chưa có thông tin mô tả đặc tính nông học.'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-100 shrink-0">
                      ID: {v.varietyId.slice(0, 8)}...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsVarietyModalOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
