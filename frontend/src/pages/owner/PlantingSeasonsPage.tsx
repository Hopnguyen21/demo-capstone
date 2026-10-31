import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, Clock, CheckCircle2, Sliders, Droplets, Radio, Play,
  ShieldCheck, Sparkles, QrCode, FileText, Printer, Download, Package,
  DollarSign, AlertTriangle, Check, Layers, History, Filter, ArrowRight,
  Edit2, Trash2, Sprout, Tag, ChevronRight, BarChart3, Info
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { BulkSeasonModal, SeasonZonesModal } from '../../components/seasons/SeasonZonesModals';
import {
  controlService, farmService, fieldService, seasonService,
  zoneService, farmingSeasonService, cropService
} from '../../services';
import {
  PlantingSeason, ControlSchedule, Actuator, FarmingSeason,
  Crop, CropVariety, Zone, Farm
} from '../../types';

export const PlantingSeasonsPage: React.FC = () => {
  // Navigation tabs: Item 8 (Seasons) & Item 9 (Planting Batches)
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zonesOfSeason, setZonesOfSeason] = useState<FarmingSeason | null>(null);
  const [bulkSeason, setBulkSeason] = useState<FarmingSeason | null>(null);
  const [activeTab, setActiveTab] = useState<'PLANTING_CROPS' | 'SEASONS'>('PLANTING_CROPS');

  // Master Data
  const [farms, setFarms] = useState<Farm[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  // Hồ sơ sinh trưởng theo cây: vụ mùa cần hồ sơ (giai đoạn, ngưỡng) nên chỉ cây đã có hồ sơ mới được chọn.
  const [cropProfiles, setCropProfiles] = useState<Record<string, any[]>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [varieties, setVarieties] = useState<CropVariety[]>([]);
  const [farmingSeasons, setFarmingSeasons] = useState<FarmingSeason[]>([]);
  const [plantingBatches, setPlantingBatches] = useState<PlantingSeason[]>([]);
  const [schedules, setSchedules] = useState<ControlSchedule[]>([]);
  const [actuators, setActuators] = useState<Actuator[]>([]);

  // Selected entities for modals
  const [selectedSeason, setSelectedSeason] = useState<PlantingSeason | null>(null);
  const [selectedZoneForHistory, setSelectedZoneForHistory] = useState<{ zoneId: string; zoneName: string } | null>(null);

  // Modals state
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isMasterSeasonModalOpen, setIsMasterSeasonModalOpen] = useState(false);
  const [editingMasterSeason, setEditingMasterSeason] = useState<FarmingSeason | null>(null);
  const [isZoneHistoryModalOpen, setIsZoneHistoryModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isVietgapLogModalOpen, setIsVietgapLogModalOpen] = useState(false);

  // Notifications
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters for Planting Crops (Tab 1)
  const [filterFarmId, setFilterFarmId] = useState<string>('ALL');
  const [filterZoneId, setFilterZoneId] = useState<string>('ALL');
  const [filterSeasonId, setFilterSeasonId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Filters for Master Seasons (Tab 2)
  const [seasonYearFilter, setSeasonYearFilter] = useState<string>('ALL');
  const [seasonStatusFilter, setSeasonStatusFilter] = useState<string>('ALL');

  // Form: Master Season (Item 8)
  const [masterSeasonForm, setMasterSeasonForm] = useState({
    code: 'DX-2026',
    name: 'Vụ Đông - Xuân 2026',
    year: 2026,
    startDate: '2026-10-15',
    endDate: '2027-02-15',
    description: 'Vụ mùa chính Đông Xuân cho nhà kính công nghệ cao, khí hậu mát mẻ thích hợp cho cây ăn quả và rau ôn đới.',
    status: 'Active',
  });

  // Form: New Planting Batch in Zone (Item 9 & 10)
  const [newBatchForm, setNewBatchForm] = useState({
    farmId: '',
    zoneId: '',
    farmingSeasonId: '',
    cropId: '',
    growthProfileId: '',
    varietyId: '',
    name: '',
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: '2027-01-20',
    notes: 'Quy trình tưới nhỏ giọt định lượng, giá thể xơ dừa xử lý sạch mầm bệnh VietGAP.',
  });

  // Schedule Form State
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    actuatorId: '',
    startTime: '07:30',
    durationMinutes: 20,
    daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
    growthStageName: '',
    targetSoilMoisture: 65,
  });

  // Load all master data and batches
  const loadData = async () => {
    try {
      const [fetchedFarms, fetchedCrops, fetchedVarieties, fetchedSeasons] = await Promise.all([
        farmService.getFarms().catch(() => []),
        cropService.getCrops().catch(() => []),
        cropService.getAllVarieties().catch(() => []),
        farmingSeasonService.getSeasons().catch(() => []),
      ]);

      setFarms(fetchedFarms);
      setCrops(fetchedCrops);
      // Không có hồ sơ (hoặc không tải được) thì cây đó không được chọn: không dùng hồ sơ mặc định thay thế.
      const profileEntries = await Promise.all(
        (fetchedCrops as Crop[]).map(async c => {
          try {
            const profiles = await cropService.getGrowthProfiles(c.cropId);
            return [c.cropId, Array.isArray(profiles) ? profiles : []] as const;
          } catch {
            return [c.cropId, []] as const;
          }
        })
      );
      setCropProfiles(Object.fromEntries(profileEntries));
      setProfilesLoaded(true);
      setVarieties(fetchedVarieties);
      setFarmingSeasons(fetchedSeasons);

      // Load zones per farm/field
      const fieldsByFarm = await Promise.all(fetchedFarms.map(async (farm: any) => ({
        farmId: farm.farmId,
        farmName: farm.name,
        fields: await fieldService.getFields(farm.farmId).catch(() => []),
      })));

      const zonesWithMeta: Zone[] = [];
      for (const fbf of fieldsByFarm) {
        for (const f of fbf.fields) {
          const zList = await zoneService.getZones(f.fieldId).catch(() => []);
          for (const z of zList) {
            zonesWithMeta.push({
              ...z,
              farmId: fbf.farmId,
              farmName: fbf.farmName,
            });
          }
        }
      }
      setZones(zonesWithMeta);

      // Load planting seasons / batches across zones
      const batchesList: PlantingSeason[] = [];
      const schedulesList: ControlSchedule[] = [];
      const actuatorsMap = new Map<string, Actuator>();

      for (const z of zonesWithMeta) {
        const [zBatches, zScheds, zActs] = await Promise.all([
          seasonService.getSeasons(z.zoneId).catch(() => []),
          controlService.getSchedules(z.zoneId).catch(() => []),
          controlService.getActuators(z.zoneId).catch(() => []),
        ]);

        for (const b of zBatches) {
          batchesList.push({
            ...b,
            zoneName: b.zoneName || z.name,
            farmId: b.farmId || z.farmId,
            farmName: z.farmName,
          });
        }
        for (const s of zScheds) {
          schedulesList.push({ ...s, zoneName: z.name });
        }
        for (const a of zActs) {
          actuatorsMap.set(a.actuatorId, a);
        }
      }

      setPlantingBatches(batchesList);
      setSchedules(schedulesList);
      setActuators(Array.from(actuatorsMap.values()));

      // Initialize form defaults if empty
      if (fetchedFarms.length > 0 && !newBatchForm.farmId) {
        const firstFarm = fetchedFarms[0];
        const farmZones = zonesWithMeta.filter(z => z.farmId === firstFarm.farmId);
        const firstCrop = fetchedCrops[0];
        const firstSeason = fetchedSeasons[0];
        const cropVars = (fetchedVarieties as CropVariety[]).filter((v: CropVariety) => v.cropId === firstCrop?.cropId);

        setNewBatchForm(prev => ({
          ...prev,
          farmId: firstFarm.farmId,
          zoneId: farmZones[0]?.zoneId || '',
          farmingSeasonId: firstSeason?.id || '',
          cropId: firstCrop?.cropId || '',
          varietyId: cropVars[0]?.varietyId || '',
          name: firstCrop ? `[${cropVars[0]?.name || firstCrop.name}] Đợt 1 - ${firstSeason?.name || 'Vụ 2026'}` : 'Đợt trồng mới',
        }));
      }
    } catch (err) {
      console.error('Failed to load season data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Đến từ nút “Tạo vụ mùa” của Zone: mở sẵn form với Zone đó và cây của Zone (nếu có).
  useEffect(() => {
    const zid = searchParams.get('zoneId');
    if (!zid || zones.length === 0) return;
    const z = zones.find(x => x.zoneId === zid);
    if (!z) return;
    setActiveTab('PLANTING_CROPS');
    setNewBatchForm(prev => ({ ...prev, zoneId: z.zoneId, farmId: z.farmId }));
    if (z.cropId) handleCropChange(z.cropId);
    setIsNewBatchModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [zones, searchParams]);

  // Cascade dropdown: Available zones based on selected farm in form
  const availableZonesForForm = useMemo(() => {
    if (!newBatchForm.farmId) return zones;
    return zones.filter(z => z.farmId === newBatchForm.farmId);
  }, [zones, newBatchForm.farmId]);

  // Cascade dropdown: Available varieties strictly filtered by selected crop (Item 10)
  const availableVarietiesForForm = useMemo(() => {
    if (!newBatchForm.cropId) return [];
    return varieties.filter(v => v.cropId === newBatchForm.cropId);
  }, [varieties, newBatchForm.cropId]);

  // Handler: When user selects a farm in new batch modal
  const handleFarmChange = (newFarmId: string) => {
    const matchingZones = zones.filter(z => z.farmId === newFarmId);
    setNewBatchForm(prev => ({
      ...prev,
      farmId: newFarmId,
      zoneId: matchingZones[0]?.zoneId || '',
    }));
  };

  const profileIdOf = (p: any): string => p?.growthProfileId || p?.profileId || p?.id || '';
  // Hồ sơ gắn riêng cho một giống chỉ dùng với giống đó; hồ sơ chung (không có giống) dùng khi không chọn giống. Backend đòi khớp đúng.
  const pickProfile = (cropId: string, varietyId?: string) => {
    const profiles = cropProfiles[cropId] ?? [];
    return profiles.find(p => p.varietyId && p.varietyId === varietyId) ?? profiles.find(p => !p.varietyId) ?? profiles[0];
  };
  const selectableCrops = crops.filter(c => (cropProfiles[c.cropId]?.length ?? 0) > 0);
  const cropsWithoutProfile = profilesLoaded ? crops.filter(c => (cropProfiles[c.cropId]?.length ?? 0) === 0) : [];

  // Handler: When user selects a crop in new batch modal -> CASCADE to varieties
  const handleCropChange = (newCropId: string) => {
    const matchingVars = varieties.filter(v => v.cropId === newCropId);
    const chosenCrop = crops.find(c => c.cropId === newCropId);
    const chosenSeason = farmingSeasons.find(s => s.id === newBatchForm.farmingSeasonId);
    const varName = matchingVars[0]?.name || chosenCrop?.name || 'Giống mới';

    setNewBatchForm(prev => ({
      ...prev,
      cropId: newCropId,
      growthProfileId: profileIdOf(pickProfile(newCropId, matchingVars[0]?.varietyId)),
      varietyId: pickProfile(newCropId, matchingVars[0]?.varietyId)?.varietyId || '',
      name: `[${varName}] Đợt 1 - ${chosenSeason?.name || 'Vụ 2026'}`,
      // auto adjust expected end date based on crop growth cycle
      expectedEndDate: new Date(Date.now() + (chosenCrop?.growthCycleDays || 90) * 86400000).toISOString().slice(0, 10),
    }));
  };

  // Handler: When user selects variety in new batch modal
  const handleVarietyChange = (newVarietyId: string) => {
    const chosenVar = varieties.find(v => v.varietyId === newVarietyId);
    const chosenSeason = farmingSeasons.find(s => s.id === newBatchForm.farmingSeasonId);
    const matchedProfile = pickProfile(newBatchForm.cropId, newVarietyId);
    setNewBatchForm(prev => ({
      ...prev,
      varietyId: matchedProfile?.varietyId || '',
      growthProfileId: profileIdOf(matchedProfile) || prev.growthProfileId,
      name: chosenVar ? `[${chosenVar.name}] Đợt 1 - ${chosenSeason?.name || 'Vụ 2026'}` : prev.name,
    }));
  };

  // Filtered planting crops (Tab 1)
  const filteredBatches = useMemo(() => {
    return plantingBatches.filter(b => {
      if (filterFarmId !== 'ALL' && b.farmId !== filterFarmId) return false;
      if (filterZoneId !== 'ALL' && b.zoneId !== filterZoneId) return false;
      if (filterSeasonId !== 'ALL' && b.farmingSeasonId !== filterSeasonId) return false;
      if (filterStatus !== 'ALL') {
        const s = (b.status || '').toUpperCase();
        if (filterStatus === 'ACTIVE' && s !== 'ACTIVE' && s !== 'INPROGRESS' && s !== 'IN_PROGRESS') return false;
        if (filterStatus === 'HARVESTED' && s !== 'HARVESTED' && s !== 'COMPLETED') return false;
        if (filterStatus === 'PLANNED' && s !== 'PLANNED' && s !== 'UPCOMING') return false;
      }
      return true;
    });
  }, [plantingBatches, filterFarmId, filterZoneId, filterSeasonId, filterStatus]);

  // Filtered master seasons (Tab 2)
  const filteredMasterSeasons = useMemo(() => {
    return farmingSeasons.filter(s => {
      if (seasonYearFilter !== 'ALL' && s.year !== Number(seasonYearFilter)) return false;
      if (seasonStatusFilter !== 'ALL' && s.status.toLowerCase() !== seasonStatusFilter.toLowerCase()) return false;
      return true;
    });
  }, [farmingSeasons, seasonYearFilter, seasonStatusFilter]);

  // Submit Handler: Create or Update Master Season (Item 8)
  const handleSaveMasterSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation: StartDate < EndDate
    if (new Date(masterSeasonForm.endDate) <= new Date(masterSeasonForm.startDate)) {
      setErrorMessage('Lỗi validation: Ngày kết thúc vụ mùa phải sau ngày bắt đầu!');
      return;
    }

    try {
      if (editingMasterSeason) {
        const updated = await farmingSeasonService.updateSeason(editingMasterSeason.id, {
          code: masterSeasonForm.code,
          name: masterSeasonForm.name,
          year: Number(masterSeasonForm.year),
          startDate: masterSeasonForm.startDate,
          endDate: masterSeasonForm.endDate,
          description: masterSeasonForm.description,
          status: masterSeasonForm.status,
        });
        setFarmingSeasons(prev => prev.map(s => s.id === updated.id ? updated : s));
        setSuccessToast(`Đã cập nhật thông tin vụ mùa [${updated.name}]!`);
      } else {
        const created = await farmingSeasonService.createSeason({
          code: masterSeasonForm.code,
          name: masterSeasonForm.name,
          year: Number(masterSeasonForm.year),
          startDate: masterSeasonForm.startDate,
          endDate: masterSeasonForm.endDate,
          description: masterSeasonForm.description,
          status: masterSeasonForm.status,
        });
        setFarmingSeasons(prev => [created, ...prev]);
        setSuccessToast(`Đã tạo mới Vụ mùa [${created.name}] thành công!`);
      }
      setIsMasterSeasonModalOpen(false);
      setEditingMasterSeason(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi khi lưu vụ mùa.';
      setErrorMessage(`Lỗi: ${msg}`);
    }
  };

  // Submit Handler: Create New Planting Crop in Zone (Item 9 & 10)
  const handleCreatePlantingBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newBatchForm.zoneId) {
      setErrorMessage('Vui lòng chọn Khu vực (Zone) để lập đợt trồng!');
      return;
    }
    if (!newBatchForm.cropId) {
      setErrorMessage('Vui lòng chọn Loại cây trồng!');
      return;
    }
    // Validation: ExpectedEndDate > StartDate
    if (new Date(newBatchForm.expectedEndDate) <= new Date(newBatchForm.startDate)) {
      setErrorMessage('Lỗi validation: Ngày dự kiến thu hoạch phải sau ngày gieo trồng!');
      return;
    }

    try {
      const chosenCrop = crops.find(c => c.cropId === newBatchForm.cropId);
      const chosenZone = zones.find(z => z.zoneId === newBatchForm.zoneId);
      const chosenSeason = farmingSeasons.find(s => s.id === newBatchForm.farmingSeasonId);

      // Vụ mùa bắt buộc dựa trên hồ sơ sinh trưởng của đúng cây đã chọn; không có thì không tạo.
      const selectedProfile = (cropProfiles[newBatchForm.cropId] ?? []).find(p => profileIdOf(p) === newBatchForm.growthProfileId) ?? pickProfile(newBatchForm.cropId, newBatchForm.varietyId);
      const targetProfileId = profileIdOf(selectedProfile);
      // Giống gửi lên theo đúng hồ sơ đã chọn (hồ sơ chung thì không có giống), để backend xác nhận khớp.
      const seasonVarietyId: string | undefined = selectedProfile?.varietyId || undefined;
      if (!targetProfileId) {
        setErrorMessage(`Loại cây "${chosenCrop?.name || ''}" chưa có hồ sơ sinh trưởng nên chưa thể lập đợt trồng. Hãy tạo hồ sơ sinh trưởng cho cây này trước.`);
        return;
      }

      // Cây của Zone là thuộc tính riêng; chỉ gán/đổi khi Owner xác nhận rõ ràng.
      let setZoneCrop = false;
      if (chosenZone?.cropId !== newBatchForm.cropId || (chosenZone?.varietyId && seasonVarietyId && chosenZone.varietyId !== seasonVarietyId)) {
        const message = chosenZone?.currentCrop
          ? `Zone đang gán cây "${chosenZone.currentCrop}". Bắt đầu vụ cây "${chosenCrop?.name}" sẽ đổi cây của Zone sang cây này. Xác nhận?`
          : `Zone chưa được gán cây. Gán cây "${chosenCrop?.name}" cho Zone khi bắt đầu vụ này?`;
        if (!window.confirm(message)) return;
        setZoneCrop = true;
      }

      await seasonService.createSeason(newBatchForm.zoneId, {
        name: newBatchForm.name.trim(),
        setZoneCrop,
        cropId: newBatchForm.cropId,
        varietyId: seasonVarietyId,
        growthProfileId: targetProfileId,
        farmingSeasonId: newBatchForm.farmingSeasonId || undefined,
        startDate: newBatchForm.startDate,
        expectedEndDate: newBatchForm.expectedEndDate,
      });

      const chosenVar = varieties.find(v => v.varietyId === seasonVarietyId);

      // Construct view item
      const newBatch: PlantingSeason = {
        plantingSeasonId: `batch-${Date.now()}`,
        zoneId: newBatchForm.zoneId,
        zoneName: chosenZone?.name || 'Phân khu',
        farmId: newBatchForm.farmId || chosenZone?.farmId || '',
        farmName: chosenZone?.farmName || '',
        cropId: newBatchForm.cropId,
        cropName: chosenCrop?.name || 'Cây trồng',
        varietyId: seasonVarietyId || '',
        varietyName: chosenVar?.name || 'Theo hồ sơ chung của cây',
        farmingSeasonId: newBatchForm.farmingSeasonId,
        farmingSeasonName: chosenSeason?.name || 'Vụ Đông Xuân 2026',
        growthProfileId: targetProfileId,
        name: newBatchForm.name.trim(),
        startDate: newBatchForm.startDate,
        expectedEndDate: newBatchForm.expectedEndDate,
        currentGrowthStageId: 'stage-1',
        currentGrowthStageName: 'Cây non (Seedling)',
        status: 'ACTIVE',
        progressPercent: 5,
      };

      setPlantingBatches(prev => [newBatch, ...prev]);
      setIsNewBatchModalOpen(false);
      setSuccessToast(`Đã lập thành công đợt trồng mới [${newBatch.name}] tại ${chosenZone?.name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || 'Có lỗi khi lập đợt trồng.';
      setErrorMessage(`Lỗi: ${msg}`);
    }
  };

  // Open Edit Master Season
  const handleOpenEditMasterSeason = (s: FarmingSeason) => {
    setEditingMasterSeason(s);
    setMasterSeasonForm({
      code: s.code,
      name: s.name,
      year: s.year,
      startDate: s.startDate,
      endDate: s.endDate,
      description: s.description || '',
      status: s.status,
    });
    setErrorMessage(null);
    setIsMasterSeasonModalOpen(true);
  };

  // Delete Master Season
  const handleDeleteMasterSeason = async (s: FarmingSeason) => {
    if (!window.confirm(`Bạn có chắc chắn muốn lưu trữ / đóng Vụ mùa [${s.name}]? Dữ liệu lịch sử các đợt trồng liên kết vẫn sẽ được bảo lưu.`)) {
      return;
    }
    try {
      await farmingSeasonService.deleteSeason(s.id);
      setFarmingSeasons(prev => prev.filter(item => item.id !== s.id));
      setSuccessToast(`Đã lưu trữ vụ mùa [${s.name}]!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Không thể xóa vụ mùa này.');
    }
  };

  // Open Zone History Modal
  const handleOpenZoneHistory = (zoneId: string, zoneName: string) => {
    setSelectedZoneForHistory({ zoneId, zoneName });
    setIsZoneHistoryModalOpen(true);
  };

  // Setup Schedule Modal
  const handleOpenSetupSchedule = (season: PlantingSeason) => {
    setSelectedSeason(season);
    const zoneActuators = actuators.filter(a => a.zoneId === season.zoneId);
    setScheduleForm({
      name: `Lịch tưới [${season.name}] - ${season.currentGrowthStageName || 'Sinh trưởng'}`,
      actuatorId: zoneActuators[0]?.actuatorId || actuators[0]?.actuatorId || '',
      startTime: '07:30',
      durationMinutes: 20,
      daysOfWeek: ['Mon', 'Wed', 'Fri', 'Sun'],
      growthStageName: season.currentGrowthStageName || 'Sinh trưởng (Vegetative)',
      targetSoilMoisture: 65,
    });
    setIsScheduleModalOpen(true);
  };

  // Save Schedule
  const handleSaveSeasonSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeason) return;

    await controlService.createSeasonSchedule(selectedSeason.zoneId, {
      name: scheduleForm.name,
      zoneId: selectedSeason.zoneId,
      actuatorId: scheduleForm.actuatorId,
      startTime: scheduleForm.startTime,
      durationMinutes: Number(scheduleForm.durationMinutes),
      daysOfWeek: scheduleForm.daysOfWeek,
      plantingSeasonId: selectedSeason.plantingSeasonId,
      seasonName: selectedSeason.name,
      growthStageName: scheduleForm.growthStageName,
    });

    setIsScheduleModalOpen(false);
    setSuccessToast(`Đã cấu hình Lịch tưới Mùa vụ mới cho [${selectedSeason.name}]!`);
    loadData();
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Open VietGAP Log Modal
  const handleOpenVietgapLog = (season: PlantingSeason) => {
    setSelectedSeason(season);
    setIsVietgapLogModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono tracking-wider">
              SMARTFARM AGRONOMY SUITE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
              MỤC C.8 + C.9 + C.10
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Calendar className="text-[#119653]" size={22} />
            Quản Lý Vụ Mùa, Đợt Trồng &amp; Giống Cây Trồng
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Nghiệp vụ quản lý canh tác nông học thông thường: Định nghĩa Vụ mùa (Đông-Xuân, Hè-Thu), lập Đợt trồng theo Phân khu và lọc Giống cây theo cascade dropdown.
          </p>
        </div>

        {/* Action Buttons based on active tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'PLANTING_CROPS' ? (
            <Button
              className="bg-[#119653] hover:bg-[#0e8046] text-white font-bold text-xs shadow-xs"
              onClick={() => {
                setErrorMessage(null);
                setIsNewBatchModalOpen(true);
              }}
            >
              <Plus size={15} className="mr-1.5" /> Lập Đợt Trồng Mới (PlantingCrop)
            </Button>
          ) : (
            <Button
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs"
              onClick={() => {
                setEditingMasterSeason(null);
                setMasterSeasonForm({
                  code: `VU-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`,
                  name: `Vụ Đông - Xuân ${new Date().getFullYear()}`,
                  year: new Date().getFullYear(),
                  startDate: `${new Date().getFullYear()}-10-15`,
                  endDate: `${new Date().getFullYear() + 1}-02-15`,
                  description: 'Vụ mùa Đông Xuân chính vụ, tập trung cây ăn quả và rau ôn đới.',
                  status: 'Active',
                });
                setErrorMessage(null);
                setIsMasterSeasonModalOpen(true);
              }}
            >
              <Plus size={15} className="mr-1.5" /> Tạo Vụ Mùa Mới (Master Season)
            </Button>
          )}
        </div>
      </div>

      {/* Toast Notifications */}
      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center gap-2 shadow-2xs">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('PLANTING_CROPS')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'PLANTING_CROPS'
              ? 'border-[#119653] text-[#119653]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sprout size={16} />
          <span>9. Đợt Trồng Theo Phân Khu (Planting Crops)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 font-mono text-slate-700">
            {plantingBatches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SEASONS')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'SEASONS'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar size={16} />
          <span>8. Quản Lý Vụ Mùa Master (Seasons)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 font-mono text-purple-800">
            {farmingSeasons.length}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PLANTING CROPS (ITEM 9 & 10) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'PLANTING_CROPS' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><Filter size={14} className="text-[#119653]" /> Bộ lọc đợt trồng</span>
              <span className="text-slate-400 font-normal">Hiển thị {filteredBatches.length} / {plantingBatches.length} đợt canh tác</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 text-[10px] mb-1 font-semibold">Nông trại (Farm)</label>
                <select
                  value={filterFarmId}
                  onChange={e => {
                    setFilterFarmId(e.target.value);
                    setFilterZoneId('ALL');
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">-- Tất cả Nông trại --</option>
                  {farms.map(f => (
                    <option key={f.farmId} value={f.farmId}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] mb-1 font-semibold">Phân khu (Zone)</label>
                <select
                  value={filterZoneId}
                  onChange={e => setFilterZoneId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">-- Tất cả Phân khu --</option>
                  {(filterFarmId === 'ALL' ? zones : zones.filter(z => z.farmId === filterFarmId)).map(z => (
                    <option key={z.zoneId} value={z.zoneId}>{z.name} ({z.farmName || 'Farm'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] mb-1 font-semibold">Vụ mùa áp dụng (Season)</label>
                <select
                  value={filterSeasonId}
                  onChange={e => setFilterSeasonId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">-- Tất cả Vụ mùa --</option>
                  {farmingSeasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] mb-1 font-semibold">Trạng thái đợt trồng</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="ACTIVE">Đang sinh trưởng (Active)</option>
                  <option value="PLANNED">Lên kế hoạch (Planned)</option>
                  <option value="HARVESTED">Đã thu hoạch (Harvested)</option>
                </select>
              </div>
            </div>
          </div>

          {/* List of Planting Batches */}
          {filteredBatches.length === 0 ? (
            <div className="p-12 bg-white border border-dashed border-slate-300 rounded-2xl text-center space-y-3">
              <Sprout size={36} className="text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700 text-sm">Chưa tìm thấy đợt trồng nào phù hợp</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hãy nhấn nút <strong>"Lập Đợt Trồng Mới"</strong> phía trên để gieo trồng đợt đầu tiên cho phân khu của bạn.
              </p>
              <Button onClick={() => setIsNewBatchModalOpen(true)} className="bg-[#119653] text-white text-xs">
                <Plus size={14} className="mr-1" /> Lập Đợt Trồng Ngay
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBatches.map(b => {
                const batchSchedules = schedules.filter(sch => sch.plantingSeasonId === b.plantingSeasonId || sch.zoneId === b.zoneId);

                return (
                  <div key={b.plantingSeasonId} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-emerald-300 transition-all">
                    {/* Header line */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Loài: {b.cropName}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <Tag size={10} /> Giống: {b.varietyName || 'Cao Sản F1'}
                          </span>
                          {b.farmingSeasonName && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1">
                              <Calendar size={10} /> {b.farmingSeasonName}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1">{b.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span>Phân khu: <strong className="text-slate-800">{b.zoneName}</strong></span>
                          <span>•</span>
                          <span>Nông trại: <strong className="text-slate-700">{b.farmName || 'Trang trại'}</strong></span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={b.status} />
                        <button
                          type="button"
                          onClick={() => handleOpenZoneHistory(b.zoneId, b.zoneName || 'Phân khu')}
                          className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          title="Xem toàn bộ lịch sử các đợt trồng qua các năm của phân khu này"
                        >
                          <History size={12} /> Lịch sử Zone
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                        <span>Tiến độ sinh trưởng đợt trồng</span>
                        <span className="text-emerald-800 font-bold">{typeof b.progressPercent === 'number' ? `${b.progressPercent}%` : 'Đang canh tác'}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#119653] rounded-full transition-all duration-500" style={{ width: `${typeof b.progressPercent === 'number' ? b.progressPercent : 35}%` }} />
                      </div>
                    </div>

                    {/* Key Dates & Stage Specs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Ngày gieo trồng</span>
                        <strong className="text-slate-900">{b.startDate}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Dự kiến thu hoạch</span>
                        <strong className="text-slate-900">{b.expectedEndDate}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Giai đoạn hiện tại</span>
                        <strong className="text-slate-900">{b.currentGrowthStageName || 'Sinh trưởng (Vegetative)'}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Sản lượng thực tế</span>
                        <strong className="text-emerald-700 font-bold">{b.actualYieldKg ? `${b.actualYieldKg} kg` : 'Chưa chốt thu hoạch'}</strong>
                      </div>
                    </div>

                    {/* Irrigation & VietGAP Actions */}
                    <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Droplets size={14} className="text-emerald-700" /> Vận Hành Canh Tác &amp; Thu Hoạch
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => handleOpenVietgapLog(b)} className="text-xs">
                            <FileText size={13} className="mr-1.5 text-emerald-700" /> Nhật Ký VietGAP &amp; Vật Tư
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => handleOpenSetupSchedule(b)}>
                            <Clock size={13} className="mr-1.5" /> Setup Lịch tưới
                          </Button>
                        </div>
                      </div>

                      {batchSchedules.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                          {batchSchedules.map(sch => (
                            <div key={sch.scheduleId} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Clock size={12} className="text-emerald-600" /> {sch.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {sch.startTime} ({sch.durationMinutes}p)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MASTER SEASONS (ITEM 8) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'SEASONS' && (
        <div className="space-y-5">
          {/* Architectural Banner */}
          <div className="p-4 bg-linear-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
              <Calendar size={16} className="text-purple-600" />
              <span>Nghiệp vụ Quản lý Vụ mùa (Master Season) — Quan hệ 1 Vụ mùa ───&lt; Nhiều Đợt Trồng</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">
              Vụ mùa lưu thông tin chu kỳ thời vụ (ví dụ: Đông-Xuân, Hè-Thu, Thu-Đông), ngày bắt đầu và kết thúc của cả mùa canh tác. 
              Các đợt trồng trong từng nhà kính / phân khu sẽ gắn với một vụ mùa tương ứng để dễ dàng theo dõi sản lượng và đối soát chi phí.
            </p>
          </div>

          {/* Master Season Filters */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Năm vụ:</span>
                <select
                  value={seasonYearFilter}
                  onChange={e => setSeasonYearFilter(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">Tất cả các năm</option>
                  <option value="2026">Năm 2026</option>
                  <option value="2027">Năm 2027</option>
                  <option value="2025">Năm 2025</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Trạng thái:</span>
                <select
                  value={seasonStatusFilter}
                  onChange={e => setSeasonStatusFilter(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Active">Đang diễn ra (Active)</option>
                  <option value="Upcoming">Sắp tới (Upcoming)</option>
                  <option value="Completed">Đã kết thúc (Completed)</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Tổng số: <strong>{filteredMasterSeasons.length}</strong> vụ mùa
            </span>
          </div>

          {/* Grid of Master Seasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredMasterSeasons.map(s => {
              const linkedCount = s.linkedBatchesCount ?? plantingBatches.filter(b => b.farmingSeasonId === s.id).length;

              return (
                <div key={s.id} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                            {s.code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            Năm {s.year}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{s.name}</h3>
                      </div>
                      <StatusBadge status={s.status.toUpperCase()} />
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {s.description || 'Chưa có thông tin mô tả chi tiết vụ mùa này.'}
                    </p>

                    {/* Date specs & Linked count */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs">
                      <div>
                        <span className="text-[10px] text-purple-900 block font-medium">Thời gian bắt đầu</span>
                        <strong className="text-slate-900">{s.startDate}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-purple-900 block font-medium">Thời gian kết thúc</span>
                        <strong className="text-slate-900">{s.endDate}</strong>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Sprout size={13} className="text-emerald-600" /> Số đợt trồng liên kết:
                      </span>
                      <strong className="text-purple-900 font-bold font-mono">
                        {linkedCount} đợt trồng
                      </strong>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSeasonId(s.id);
                        setActiveTab('PLANTING_CROPS');
                      }}
                      className="text-[#119653] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sprout size={13} /> Xem {linkedCount} đợt trồng <ArrowRight size={12} />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setZonesOfSeason(s)}
                        className="p-1.5 text-sky-700 hover:bg-sky-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                        title="Xem các Zone đang áp dụng mùa vụ này"
                      >
                        <Layers size={13} /> Các Zone
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSeason(s)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                        title="Áp dụng mùa vụ này cho nhiều Zone"
                      >
                        <Plus size={13} /> Áp dụng nhiều Zone
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditMasterSeason(s)}
                        className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa thông tin vụ mùa"
                      >
                        <Edit2 size={13} /> Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMasterSeason(s)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                        title="Đóng vụ mùa (Lưu trữ)"
                      >
                        <Trash2 size={13} /> Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: LẬP ĐỢT TRỒNG MỚI (ITEM 9 & 10 CASCADE DROPDOWN) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <SeasonZonesModal season={zonesOfSeason} onClose={() => setZonesOfSeason(null)} onOpenZone={() => navigate('/owner/farms')} />
      <BulkSeasonModal
        season={bulkSeason}
        zones={zones}
        crops={crops}
        cropProfiles={cropProfiles}
        onClose={() => setBulkSeason(null)}
        onCreated={() => { loadData(); }}
      />

      <Modal
        isOpen={isNewBatchModalOpen}
        onClose={() => setIsNewBatchModalOpen(false)}
        title="Lập Đợt Trồng Mới Cho Phân Khu (PlantingCrop Batch)"
      >
        <form onSubmit={handleCreatePlantingBatch} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Educational notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
            <strong className="block font-bold">Quy chuẩn Nông học (Feedback Thầy Cô):</strong>
            <p className="text-[11px] leading-tight text-emerald-800">
              Chọn Nông trại ➔ Phân khu, Loại cây ➔ Giống cây phù hợp (cascade dropdown lọc tự động), và liên kết vào Vụ mùa chuẩn.
            </p>
          </div>

          {/* Step 1: Farm & Zone Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">1. Chọn Nông trại (Farm) *</label>
              <select
                required
                value={newBatchForm.farmId}
                onChange={e => handleFarmChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Chọn Nông trại --</option>
                {farms.map(f => (
                  <option key={f.farmId} value={f.farmId}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">2. Chọn Phân khu (Zone) *</label>
              <select
                required
                value={newBatchForm.zoneId}
                onChange={e => {
                  const zid = e.target.value;
                  setNewBatchForm(prev => ({ ...prev, zoneId: zid }));
                  // Cây của vụ mặc định là cây đã gán cho Zone (Owner vẫn đổi được và sẽ được hỏi xác nhận).
                  const zoneCropId = zones.find(z => z.zoneId === zid)?.cropId;
                  if (zoneCropId) handleCropChange(zoneCropId);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Chọn Phân khu canh tác --</option>
                {availableZonesForForm.map(z => (
                  <option key={z.zoneId} value={z.zoneId}>{z.name} (Diện tích: {z.areaM2 || 500}m²)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Farming Season & Crop Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">3. Chọn Vụ mùa áp dụng (Season) *</label>
              <select
                required
                value={newBatchForm.farmingSeasonId}
                onChange={e => {
                  const seasonId = e.target.value;
                  const chosenSeason = farmingSeasons.find(s => s.id === seasonId);
                  const chosenVar = varieties.find(v => v.varietyId === newBatchForm.varietyId);
                  const chosenCrop = crops.find(c => c.cropId === newBatchForm.cropId);
                  setNewBatchForm(prev => ({
                    ...prev,
                    farmingSeasonId: seasonId,
                    name: `[${chosenVar?.name || chosenCrop?.name || 'Cây trồng'}] Đợt 1 - ${chosenSeason?.name || 'Vụ mùa'}`,
                  }));
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Chọn Vụ mùa --</option>
                {farmingSeasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code} - Năm {s.year})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">4. Chọn Loại Cây (Crop) *</label>
              <select
                required
                value={newBatchForm.cropId}
                onChange={e => handleCropChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Chọn Loài cây --</option>
                {selectableCrops.map(c => (
                  <option key={c.cropId} value={c.cropId}>{c.name} ({c.category || 'Rau ăn quả'})</option>
                ))}
              </select>
              {profilesLoaded && cropsWithoutProfile.length > 0 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Chỉ hiện loại cây đã có hồ sơ sinh trưởng. Chưa có hồ sơ: {cropsWithoutProfile.map(c => c.name).join(', ')}.
                </p>
              )}
              {newBatchForm.cropId && (cropProfiles[newBatchForm.cropId]?.length ?? 0) > 1 && (
                <div className="mt-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hồ sơ sinh trưởng áp dụng</label>
                  <select
                    value={newBatchForm.growthProfileId}
                    onChange={e => {
                      const chosen = (cropProfiles[newBatchForm.cropId] ?? []).find(p => profileIdOf(p) === e.target.value);
                      setNewBatchForm(prev => ({ ...prev, growthProfileId: e.target.value, varietyId: chosen?.varietyId || '' }));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                  >
                    {cropProfiles[newBatchForm.cropId].map(p => (
                      <option key={profileIdOf(p)} value={profileIdOf(p)}>{(p.name || profileIdOf(p)) + (p.isSystemDefined ? ' — hệ thống' : ' — của trang trại')}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: CASCADE DROPDOWN VARIETY (ITEM 10) */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <label className="block text-purple-950 font-bold text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag size={13} className="text-purple-600" /> 5. Chọn Giống Cây Trồng (PlantVariety - Cascade Filter) *
              </span>
              <span className="text-[10px] text-purple-700 font-normal">
                {availableVarietiesForForm.length} giống phù hợp với loài đã chọn
              </span>
            </label>

            {availableVarietiesForForm.length > 0 ? (
              <select
                required
                value={newBatchForm.varietyId}
                onChange={e => handleVarietyChange(e.target.value)}
                className="w-full bg-white border border-purple-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-purple-500"
              >
                <option value="">-- Chọn Giống cây con phù hợp --</option>
                {availableVarietiesForForm.map(v => (
                  <option key={v.varietyId} value={v.varietyId}>
                    {v.name} {v.description ? `— ${v.description}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 bg-white rounded-lg border border-purple-200 text-slate-600 text-[11px] flex items-center justify-between">
                <span>Loài cây này chưa có giống con. Hệ thống sẽ áp dụng giống chuẩn F1.</span>
                <span className="text-purple-800 font-bold">Giống Chuẩn F1 VietGAP</span>
              </div>
            )}
          </div>

          {/* Batch Name */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Đợt Trồng (Planting Batch Name) *</label>
            <Input
              required
              value={newBatchForm.name}
              onChange={e => setNewBatchForm({ ...newBatchForm, name: e.target.value })}
              placeholder="VD: [Cà chua bi lùn F1] Đợt 1 - Vụ Đông Xuân 2026"
            />
          </div>

          {/* Dates: StartDate & ExpectedEndDate with Validation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Ngày Gieo Trồng *</label>
              <Input
                type="date"
                required
                value={newBatchForm.startDate}
                onChange={e => setNewBatchForm({ ...newBatchForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dự Kiến Thu Hoạch *</label>
              <Input
                type="date"
                required
                value={newBatchForm.expectedEndDate}
                onChange={e => setNewBatchForm({ ...newBatchForm, expectedEndDate: e.target.value })}
              />
            </div>
          </div>

          {/* Agronomy Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Ghi Chú Kỹ Thuật Canh Tác VietGAP</label>
            <Input
              value={newBatchForm.notes}
              onChange={e => setNewBatchForm({ ...newBatchForm, notes: e.target.value })}
              placeholder="Mật độ trồng, chế độ phân bón lót, tưới nhỏ giọt..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsNewBatchModalOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" className="bg-[#119653] hover:bg-[#0e8046] text-white">
              Xác Nhận Lập Đợt Trồng
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: TẠO / SỬA VỤ MÙA MASTER (ITEM 8) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isMasterSeasonModalOpen}
        onClose={() => setIsMasterSeasonModalOpen(false)}
        title={editingMasterSeason ? `Chỉnh sửa Vụ Mùa: ${editingMasterSeason.name}` : 'Tạo Vụ Mùa Master Mới (Farming Season)'}
      >
        <form onSubmit={handleSaveMasterSeason} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Mã Vụ Mùa (Code) *</label>
              <Input
                required
                value={masterSeasonForm.code}
                onChange={e => setMasterSeasonForm({ ...masterSeasonForm, code: e.target.value.toUpperCase() })}
                placeholder="VD: DX-2026, HT-2026, TD-2026"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Năm Vụ Canh Tác *</label>
              <Input
                type="number"
                min={2020}
                max={2035}
                required
                value={masterSeasonForm.year}
                onChange={e => setMasterSeasonForm({ ...masterSeasonForm, year: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Vụ Mùa *</label>
            <Input
              required
              value={masterSeasonForm.name}
              onChange={e => setMasterSeasonForm({ ...masterSeasonForm, name: e.target.value })}
              placeholder="VD: Vụ Đông - Xuân 2026, Vụ Hè - Thu 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Thời Gian Bắt Đầu *</label>
              <Input
                type="date"
                required
                value={masterSeasonForm.startDate}
                onChange={e => setMasterSeasonForm({ ...masterSeasonForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Thời Gian Kết Thúc *</label>
              <Input
                type="date"
                required
                value={masterSeasonForm.endDate}
                onChange={e => setMasterSeasonForm({ ...masterSeasonForm, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Trạng Thái Vụ Mùa</label>
            <select
              value={masterSeasonForm.status}
              onChange={e => setMasterSeasonForm({ ...masterSeasonForm, status: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-purple-500"
            >
              <option value="Active">Đang diễn ra (Active)</option>
              <option value="Upcoming">Sắp tới (Upcoming)</option>
              <option value="Completed">Đã hoàn thành / Kết thúc (Completed)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô Tả &amp; Khuyến Cáo Canh Tác</label>
            <Input
              value={masterSeasonForm.description}
              onChange={e => setMasterSeasonForm({ ...masterSeasonForm, description: e.target.value })}
              placeholder="Đặc điểm khí hậu, khuyến nông, phòng trừ sâu bệnh..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsMasterSeasonModalOpen(false)}>Hủy</Button>
            <Button variant="primary" type="submit" className="bg-purple-700 hover:bg-purple-800 text-white">
              {editingMasterSeason ? 'Lưu Thay Đổi' : 'Tạo Vụ Mùa'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: LỊCH SỬ ĐỢT TRỒNG THEO PHÂN KHU (ZONE HISTORY - ITEM 9) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isZoneHistoryModalOpen}
        onClose={() => setIsZoneHistoryModalOpen(false)}
        title={`Lịch Sử Đợt Canh Tác Theo Thời Gian: ${selectedZoneForHistory?.zoneName || ''}`}
      >
        <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <History size={14} className="text-[#119653]" /> Cho phép một Zone có nhiều đợt trồng theo thời gian (Farming History)
            </span>
            <p className="text-[11px] text-slate-600">
              Hệ thống lưu giữ đầy đủ các đợt trồng trong quá khứ để phân tích năng suất, lịch sử luân canh cây trồng và kiểm tra dư lượng đất.
            </p>
          </div>

          {/* Filter batches for selected zone */}
          {(() => {
            const zoneBatches = plantingBatches.filter(b => b.zoneId === selectedZoneForHistory?.zoneId);

            if (zoneBatches.length === 0) {
              return (
                <div className="p-8 text-center text-slate-400 italic">
                  Chưa có đợt trồng nào được ghi nhận tại phân khu này.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {zoneBatches.map((b, idx) => (
                  <div key={b.plantingSeasonId || idx} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{b.name}</span>
                      <StatusBadge status={b.status} />
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span>Loài: <strong className="text-emerald-800">{b.cropName}</strong></span>
                      <span>•</span>
                      <span>Giống: <strong className="text-purple-800">{b.varietyName || 'Cao Sản F1'}</strong></span>
                      <span>•</span>
                      <span>Vụ: <strong>{b.farmingSeasonName || 'Đông Xuân'}</strong></span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-[10px] text-slate-600">
                      <div>Gieo trồng: <strong>{b.startDate}</strong></div>
                      <div>Dự kiến thu: <strong>{b.expectedEndDate}</strong></div>
                      <div>Sản lượng: <strong className="text-emerald-700">{b.actualYieldKg ? `${b.actualYieldKg} kg` : 'N/A'}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsZoneHistoryModalOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: SETUP SEASON IRRIGATION SCHEDULE */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={`Setup Lịch tưới Mùa vụ: "${selectedSeason?.name || ''}"`}>
        {selectedSeason && (
          <form onSubmit={handleSaveSeasonSchedule} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">{selectedSeason.name}</div>
              <div className="text-slate-500">{selectedSeason.zoneName} • Giai đoạn: <strong className="text-emerald-700">{selectedSeason.currentGrowthStageName || 'Sinh trưởng'}</strong></div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Tên Lịch tưới Mùa vụ *</label>
              <Input
                required
                value={scheduleForm.name}
                onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Giai đoạn Sinh trưởng *</label>
                <select
                  value={scheduleForm.growthStageName}
                  onChange={e => setScheduleForm({ ...scheduleForm, growthStageName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Cây non (Seedling)">Cây non (Seedling)</option>
                  <option value="Sinh trưởng (Vegetative)">Sinh trưởng (Vegetative)</option>
                  <option value="Ra hoa (Flowering)">Ra hoa (Flowering)</option>
                  <option value="Nuôi trái (Fruit Development)">Nuôi trái (Fruit Development)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chọn Thiết bị Chấp hành (Rơ-le) *</label>
                <select
                  value={scheduleForm.actuatorId}
                  onChange={e => setScheduleForm({ ...scheduleForm, actuatorId: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Chọn Rơ-le tưới --</option>
                  {actuators.map(a => (
                    <option key={a.actuatorId} value={a.actuatorId}>{a.name} ({a.actuatorType})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Giờ Bật Tưới *</label>
                <Input
                  type="time"
                  required
                  value={scheduleForm.startTime}
                  onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Thời Lượng Tưới (phút) *</label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={scheduleForm.durationMinutes}
                  onChange={e => setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" type="button" onClick={() => setIsScheduleModalOpen(false)}>Hủy</Button>
              <Button variant="primary" type="submit" className="bg-[#119653] text-white">Lưu Lịch Tưới</Button>
            </div>
          </form>
        )}
      </Modal>


      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 6: NHẬT KÝ CANH TÁC VIETGAP */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isVietgapLogModalOpen}
        onClose={() => setIsVietgapLogModalOpen(false)}
        title={`Nhật Ký Canh Tác & Hồ Sơ VietGAP: "${selectedSeason?.name || ''}"`}
      >
        <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-bold text-emerald-950 text-sm">Hồ Sơ Canh Tác Chuẩn VietGAP (TCVN 11892-1:2017)</div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Vụ: {selectedSeason?.name} • Khu vực: {selectedSeason?.zoneName} • Cây trồng: {selectedSeason?.cropName}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ 100% Tuân Thủ
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                  <th className="p-2.5">Ngày</th>
                  <th className="p-2.5">Hoạt Động / Công Việc</th>
                  <th className="p-2.5">Vật Tư &amp; Mã Lô (Lot #)</th>
                  <th className="p-2.5">Liều Lượng</th>
                  <th className="p-2.5">Cách Ly (PHI)</th>
                  <th className="p-2.5">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-15</td>
                  <td className="p-2.5 font-medium text-slate-900">Bón lót chuẩn bị luống</td>
                  <td className="p-2.5">Phân trùn quế vi sinh <span className="font-mono text-emerald-700">(LOT-TQ-01)</span></td>
                  <td className="p-2.5">0.5 kg/m²</td>
                  <td className="p-2.5 font-bold text-emerald-700">0 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-18</td>
                  <td className="p-2.5 font-medium text-slate-900">Phun phòng nấm sinh học</td>
                  <td className="p-2.5">Chế phẩm Trichoderma <span className="font-mono text-emerald-700">(LOT-BIO-02)</span></td>
                  <td className="p-2.5">10 ml/m²</td>
                  <td className="p-2.5 font-bold text-emerald-700">3 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-500">2026-10-20</td>
                  <td className="p-2.5 font-medium text-slate-900">Tưới phân hữu cơ hòa tan</td>
                  <td className="p-2.5">NPK Hữu Cơ Rong Biển <span className="font-mono text-emerald-700">(LOT-NPK-04)</span></td>
                  <td className="p-2.5">5 g/gốc</td>
                  <td className="p-2.5 font-bold text-emerald-700">7 ngày</td>
                  <td className="p-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">Đạt chuẩn</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsVietgapLogModalOpen(false)}>Đóng</Button>
            <Button onClick={() => window.print()} className="bg-[#119653] hover:bg-[#0e8046] text-white flex items-center gap-1.5 font-bold">
              <Printer size={15} /> Xuất Hồ Sơ Thẩm Định VietGAP (In / PDF)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
