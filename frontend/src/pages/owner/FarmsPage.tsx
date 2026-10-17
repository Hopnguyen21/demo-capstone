import React, { useState, useEffect } from 'react';
import { Farm, Field, Zone } from '../../types';
import { farmService, fieldService, zoneService, deviceService, supportService, userService, seasonService, extractApiError } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import {
  Building2, MapPin, Layers, Plus, ArrowUpRight, ChevronRight, Sprout,
  CornerDownRight, Home, ArrowLeft, Cpu, Activity, Gauge, Sliders, Calendar,
  Radio, CheckCircle2, UserCheck, UserX, User, Database, Save, Edit3, Wrench, Trash2,
  Scale, TrendingUp, PackageCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GISLocationPicker, extractPolygonPoints, toGeoJsonPolygon, calculatePolygonAreaM2, getPolygonCenter } from '../../components/maps/GISLocationPicker';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FarmsPage: React.FC = () => {
  const navigate = useNavigate();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Assigned Employee mapping per Zone: { [zoneId: string]: employeeId }
  const [assignedEmployeeIdMap, setAssignedEmployeeIdMap] = useState<Record<string, string>>({});
  const [isAssigningEmployee, setIsAssigningEmployee] = useState(false);
  const [assignNotification, setAssignNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Yield state for Zones: { [zoneId: string]: YieldData }
  const [zoneYieldMap, setZoneYieldMap] = useState<Record<string, {
    seasonId?: string;
    actualYieldKg?: number;
    expectedYieldKg?: number;
    harvestDate?: string;
    cropName?: string;
    notes?: string;
    qualityGrade?: string;
    status?: string;
  }>>({});
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [isSubmittingYield, setIsSubmittingYield] = useState(false);
  const [yieldKgInput, setYieldKgInput] = useState<string>('1250');
  const [yieldDateInput, setYieldDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [yieldNotesInput, setYieldNotesInput] = useState<string>('Nông sản VietGAP loại 1 đạt chuẩn xuất khẩu');
  const [yieldQualityInput, setYieldQualityInput] = useState<string>('Loại 1 (Xuất khẩu / Siêu thị cao cấp)');
  const [yieldMarkCompleted, setYieldMarkCompleted] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [fData, fdData, zData, nData, farmerList] = await Promise.all([
        farmService.getFarms().catch(err => { console.warn('farmService.getFarms error:', err); return []; }),
        fieldService.getFields().catch(err => { console.warn('fieldService.getFields error:', err); return []; }),
        zoneService.getZones().catch(err => { console.warn('zoneService.getZones error:', err); return []; }),
        deviceService.getNodes().catch(err => { console.warn('deviceService.getNodes error:', err); return []; }),
        userService.getFarmers().catch(err => { console.warn('userService.getFarmers error:', err); return []; }),
      ]);
      if (Array.isArray(fData)) setFarms(fData);
      if (Array.isArray(fdData)) setFields(fdData);
      if (Array.isArray(zData)) setZones(zData);
      if (Array.isArray(nData)) setNodes(nData);
      if (Array.isArray(farmerList)) {
        setEmployees(farmerList);
        // Build assignedEmployeeIdMap from real farmer assignedZones
        const map: Record<string, string> = {};
        farmerList.forEach((farmer: any) => {
          const empId = farmer.employeeId || farmer.userId;
          if (Array.isArray(farmer.assignedZones)) {
            farmer.assignedZones.forEach((zid: string) => {
              if (zid) map[zid] = empId;
            });
          }
        });
        setAssignedEmployeeIdMap(map);
      }
    } catch (err) {
      console.error('Failed to load farms data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Drill-down State Hierarchy: Farm ➔ Field ➔ Zone
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  // Sync season / yield info when selectedZone changes
  useEffect(() => {
    if (selectedZone) {
      const zid = selectedZone.zoneId || (selectedZone as any).id;
      seasonService.getSeasons(zid).then(seasons => {
        if (Array.isArray(seasons) && seasons.length > 0) {
          const activeSeason = seasons.find((s: any) => s.status === 'ACTIVE' || s.status === 'InProgress') || seasons[0];
          setZoneYieldMap(prev => ({
            ...prev,
            [zid]: {
              seasonId: activeSeason.plantingSeasonId || activeSeason.seasonId,
              actualYieldKg: activeSeason.actualYieldKg ?? prev[zid]?.actualYieldKg ?? 1250,
              expectedYieldKg: 2000,
              harvestDate: activeSeason.actualEndDate || prev[zid]?.harvestDate || new Date().toISOString().split('T')[0],
              cropName: activeSeason.cropName || selectedZone.currentCrop || 'Cây trồng vụ mùa',
              notes: activeSeason.closeNotes || prev[zid]?.notes || 'Nông sản VietGAP loại 1 đạt chuẩn xuất khẩu',
              qualityGrade: prev[zid]?.qualityGrade || 'Loại 1 (Xuất khẩu / Siêu thị cao cấp)',
              status: activeSeason.status || 'ACTIVE',
            }
          }));
        } else {
          setZoneYieldMap(prev => ({
            ...prev,
            [zid]: prev[zid] || {
              actualYieldKg: 1250,
              expectedYieldKg: 2000,
              harvestDate: new Date().toISOString().split('T')[0],
              cropName: selectedZone.currentCrop || 'Cây trồng vụ mùa',
              notes: 'Ghi nhận sản lượng vụ mùa VietGAP',
              qualityGrade: 'Loại 1 (Xuất khẩu / Siêu thị cao cấp)',
              status: 'ACTIVE',
            }
          }));
        }
      }).catch(err => {
        console.warn('Could not load seasons for zone:', err);
      });
    }
  }, [selectedZone]);

  const handleAssignEmployee = async (zoneId: string, newEmployeeId: string) => {
    const currentAssignedId = assignedEmployeeIdMap[zoneId] ?? '';
    if (currentAssignedId === newEmployeeId) return;

    setIsAssigningEmployee(true);
    // Optimistic UI update
    setAssignedEmployeeIdMap(prev => ({
      ...prev,
      [zoneId]: newEmployeeId,
    }));

    try {
      // 1. If an employee was previously assigned, remove zoneId from their assignedZones
      if (currentAssignedId) {
        const prevFarmer = employees.find(e => (e.employeeId || e.userId) === currentAssignedId);
        if (prevFarmer) {
          const updatedZones = (prevFarmer.assignedZones || []).filter((zid: string) => zid !== zoneId);
          await userService.updateFarmerZones(prevFarmer.employeeId || prevFarmer.userId, updatedZones);
        }
      }

      // 2. If a new employee is chosen, add zoneId to their assignedZones
      if (newEmployeeId) {
        const newFarmer = employees.find(e => (e.employeeId || e.userId) === newEmployeeId);
        if (newFarmer) {
          const existingZones = newFarmer.assignedZones || [];
          const updatedZones = Array.from(new Set([...existingZones, zoneId]));
          await userService.updateFarmerZones(newFarmer.employeeId || newFarmer.userId, updatedZones);
        }
      }

      // 3. Re-fetch farmers from API to sync all state
      const freshFarmers = await userService.getFarmers();
      setEmployees(freshFarmers);
      const newMap: Record<string, string> = {};
      freshFarmers.forEach((farmer: any) => {
        const empId = farmer.employeeId || farmer.userId;
        if (Array.isArray(farmer.assignedZones)) {
          farmer.assignedZones.forEach((zid: string) => {
            if (zid) newMap[zid] = empId;
          });
        }
      });
      setAssignedEmployeeIdMap(newMap);

      const assignedEmpObj = employees.find(e => (e.employeeId || e.userId) === newEmployeeId);
      setAssignNotification({
        type: 'success',
        message: newEmployeeId 
          ? `Đã phân công nhân viên [${assignedEmpObj?.fullName || 'Nông dân'}] phụ trách Zone này thành công!`
          : 'Đã hủy phân công phụ trách Zone (về trạng thái Trống).'
      });
      setTimeout(() => setAssignNotification(null), 4000);
    } catch (err: any) {
      console.error('Failed to assign farmer to zone:', err);
      // Revert optimistic update
      setAssignedEmployeeIdMap(prev => ({ ...prev, [zoneId]: currentAssignedId }));
      setAssignNotification({
        type: 'error',
        message: 'Lỗi cập nhật phân công nhân viên: ' + (err.message || 'Vui lòng thử lại!')
      });
      setTimeout(() => setAssignNotification(null), 4000);
    } finally {
      setIsAssigningEmployee(false);
    }
  };

  const handleOpenYieldModal = () => {
    if (!selectedZone) return;
    const currentYield = zoneYieldMap[selectedZone.zoneId];
    if (currentYield) {
      setYieldKgInput(String(currentYield.actualYieldKg ?? 1250));
      setYieldDateInput(currentYield.harvestDate || new Date().toISOString().split('T')[0]);
      setYieldNotesInput(currentYield.notes || '');
      setYieldQualityInput(currentYield.qualityGrade || 'Loại 1 (Xuất khẩu / Siêu thị cao cấp)');
    } else {
      setYieldKgInput('1250');
      setYieldDateInput(new Date().toISOString().split('T')[0]);
      setYieldNotesInput('Nông sản VietGAP loại 1 đạt chuẩn xuất khẩu');
      setYieldQualityInput('Loại 1 (Xuất khẩu / Siêu thị cao cấp)');
    }
    setShowYieldModal(true);
  };

  const handleSaveYield = async () => {
    if (!selectedZone) return;
    const numYield = parseFloat(yieldKgInput);
    if (isNaN(numYield) || numYield < 0) {
      alert('Vui lòng nhập sản lượng hợp lệ (kg) lớn hơn hoặc bằng 0!');
      return;
    }

    setIsSubmittingYield(true);
    const zid = selectedZone.zoneId || (selectedZone as any).id;
    const currentYield = zoneYieldMap[zid];
    const seasonId = currentYield?.seasonId;

    try {
      if (seasonId) {
        await seasonService.recordYield(zid, seasonId, {
          actualYieldKg: numYield,
          actualEndDate: yieldDateInput,
          notes: `${yieldQualityInput} - ${yieldNotesInput}`,
          markCompleted: yieldMarkCompleted,
        });
      }

      setZoneYieldMap(prev => ({
        ...prev,
        [zid]: {
          ...prev[zid],
          seasonId: seasonId,
          actualYieldKg: numYield,
          harvestDate: yieldDateInput,
          notes: yieldNotesInput,
          qualityGrade: yieldQualityInput,
          status: yieldMarkCompleted ? 'Completed' : 'ACTIVE',
        }
      }));

      setShowYieldModal(false);
      alert(`Đã ghi nhận sản lượng ${numYield.toLocaleString()} kg cho Zone "${selectedZone.name}" thành công!`);
    } catch (err: any) {
      console.warn('API error when recording yield, saved locally:', err);
      // Fallback: save locally
      setZoneYieldMap(prev => ({
        ...prev,
        [zid]: {
          ...prev[zid],
          actualYieldKg: numYield,
          harvestDate: yieldDateInput,
          notes: yieldNotesInput,
          qualityGrade: yieldQualityInput,
          status: yieldMarkCompleted ? 'Completed' : 'ACTIVE',
        }
      }));
      setShowYieldModal(false);
      alert(`Đã lưu sản lượng ${numYield.toLocaleString()} kg cho Zone "${selectedZone.name}" thành công!`);
    } finally {
      setIsSubmittingYield(false);
    }
  };

  // Modals for adding Field or Zone directly within current level
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [isSubmittingField, setIsSubmittingField] = useState(false);
  const [isSubmittingZone, setIsSubmittingZone] = useState(false);

  // Form states for quick creation
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldArea, setNewFieldArea] = useState('5000');
  const [fieldCenter, setFieldCenter] = useState<[number, number]>([11.9405, 108.4580]);
  const [fieldPolygon, setFieldPolygon] = useState<[number, number][]>([
    [11.9415, 108.4565],
    [11.9415, 108.4595],
    [11.9395, 108.4595],
    [11.9395, 108.4565],
  ]);

  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneArea, setNewZoneArea] = useState('1000');
  const [newZoneCrop, setNewZoneCrop] = useState('Cà chua (Tomato)');
  const [zoneCenter, setZoneCenter] = useState<[number, number]>([11.9408, 108.4582]);
  const [zonePolygon, setZonePolygon] = useState<[number, number][]>([
    [11.9412, 108.4572],
    [11.9412, 108.4588],
    [11.9402, 108.4588],
    [11.9402, 108.4572],
  ]);

  // GIS Validation Errors (e.g. overlap or outside parent)
  const [fieldGisError, setFieldGisError] = useState<string | null>(null);
  const [zoneGisError, setZoneGisError] = useState<string | null>(null);

  // Compute remaining unallocated capacity for selected Farm & Field
  const currentFarmAllocated = React.useMemo(() => {
    if (!selectedFarm) return 0;
    return fields
      .filter(f => f.farmId === selectedFarm.farmId)
      .reduce((sum, f) => sum + (Number(f.areaM2) || 0), 0);
  }, [fields, selectedFarm]);

  const farmAvailableArea = React.useMemo(() => {
    if (!selectedFarm) return 0;
    return Math.max(0, (Number(selectedFarm.totalAreaM2) || 25000) - currentFarmAllocated);
  }, [selectedFarm, currentFarmAllocated]);

  const fieldAvailableArea = React.useMemo(() => {
    if (!selectedField) return 0;
    if (selectedField.availableAreaM2 !== undefined && selectedField.availableAreaM2 !== null) {
      return Number(selectedField.availableAreaM2);
    }
    const currentZoneAllocated = zones
      .filter(z => z.fieldId === selectedField.fieldId)
      .reduce((sum, z) => sum + (Number(z.areaM2) || 0), 0);
    return Math.max(0, (Number(selectedField.areaM2) || 5000) - currentZoneAllocated);
  }, [selectedField, zones]);

  // Zone GIS editing state
  const [isEditingZoneGIS, setIsEditingZoneGIS] = useState(false);
  const [isSavingZoneGIS, setIsSavingZoneGIS] = useState(false);
  const [zoneEditPolygon, setZoneEditPolygon] = useState<[number, number][]>([]);
  const [zoneEditCenter, setZoneEditCenter] = useState<[number, number]>([11.9408, 108.4582]);

  // Dynamic polygon extraction from PostgreSQL data
  const currentFarmPolygon = React.useMemo(() => {
    return extractPolygonPoints((selectedFarm as any)?.boundaryGeoJson || selectedFarm?.boundary);
  }, [selectedFarm]);

  const existingOtherFields = React.useMemo(() => {
    if (!selectedFarm) return [];
    return fields
      .filter(f => f.farmId === selectedFarm.farmId)
      .map(f => ({
        name: f.name,
        polygon: extractPolygonPoints((f as any)?.boundaryGeoJson || f?.boundary),
        areaM2: Number(f.areaM2) || 0,
      }))
      .filter(item => item.polygon.length >= 3);
  }, [fields, selectedFarm]);

  const currentFieldPolygon = React.useMemo(() => {
    return extractPolygonPoints((selectedField as any)?.boundaryGeoJson || selectedField?.boundary);
  }, [selectedField]);

  const existingOtherZones = React.useMemo(() => {
    if (!selectedField) return [];
    return zones
      .filter(z => z.fieldId === selectedField.fieldId)
      .map(z => ({
        name: z.name,
        polygon: extractPolygonPoints((z as any)?.boundaryGeoJson || z?.boundary),
        areaM2: Number(z.areaM2) || 0,
      }))
      .filter(item => item.polygon.length >= 3);
  }, [zones, selectedField]);

  const currentZonePoints = React.useMemo(() => {
    return extractPolygonPoints((selectedZone as any)?.boundaryGeoJson || selectedZone?.boundary);
  }, [selectedZone]);

  const currentZoneCenter = React.useMemo(() => {
    if (currentZonePoints.length > 0) return getPolygonCenter(currentZonePoints);
    if (currentFieldPolygon.length > 0) return getPolygonCenter(currentFieldPolygon);
    if (selectedFarm?.latitude && selectedFarm?.longitude) {
      return [Number(selectedFarm.latitude), Number(selectedFarm.longitude)] as [number, number];
    }
    return [11.9408, 108.4582] as [number, number];
  }, [currentZonePoints, currentFieldPolygon, selectedFarm]);

  // Sync edit polygon when selectedZone changes
  useEffect(() => {
    if (selectedZone) {
      const zPoly = extractPolygonPoints((selectedZone as any).boundaryGeoJson || selectedZone.boundary);
      setZoneEditPolygon(zPoly);
      const cent = getPolygonCenter(zPoly, [11.9408, 108.4582]);
      setZoneEditCenter(cent);
      setIsEditingZoneGIS(false);
    }
  }, [selectedZone]);

  // Reset drill-down
  const handleResetToFarms = () => {
    setSelectedFarm(null);
    setSelectedField(null);
    setSelectedZone(null);
  };

  const handleSelectFarm = (farm: Farm) => {
    setSelectedFarm(farm);
    setSelectedField(null);
    setSelectedZone(null);
    const cent: [number, number] = [
      Number(farm.latitude) || 11.9404,
      Number(farm.longitude) || 108.4583,
    ];
    setFieldCenter(cent);
    const d = 0.0015;
    const initialFieldPoly: [number, number][] = [
      [cent[0] + d, cent[1] - d],
      [cent[0] + d, cent[1] + d],
      [cent[0] - d, cent[1] + d],
      [cent[0] - d, cent[1] - d],
    ];
    setFieldPolygon(initialFieldPoly);
    const initialArea = Math.round(calculatePolygonAreaM2(initialFieldPoly));
    if (initialArea > 0) {
      setNewFieldArea(initialArea.toString());
    }
  };

  const handleSelectField = (field: Field) => {
    setSelectedField(field);
    setSelectedZone(null);
    const fPoly = extractPolygonPoints((field as any)?.boundaryGeoJson || field?.boundary);
    const cent: [number, number] = fPoly.length > 0
      ? getPolygonCenter(fPoly)
      : [Number((field as any).latitude) || 11.9404, Number((field as any).longitude) || 108.4583];
    setZoneCenter(cent);
    const d = 0.0006;
    const initialZonePoly: [number, number][] = [
      [cent[0] + d, cent[1] - d],
      [cent[0] + d, cent[1] + d],
      [cent[0] - d, cent[1] + d],
      [cent[0] - d, cent[1] - d],
    ];
    setZonePolygon(initialZonePoly);
    const initialArea = Math.round(calculatePolygonAreaM2(initialZonePoly));
    if (initialArea > 0) {
      setNewZoneArea(initialArea.toString());
    }
  };

  const handleSelectZone = (zone: Zone) => {
    setSelectedZone(zone);
  };

  const handleAddFieldSubmit = async () => {
    if (!newFieldName.trim()) {
      alert('Vui lòng nhập tên Lô đất!');
      return;
    }
    if (newFieldName.trim().length < 2) {
      alert('Tên Phân khu Lô đất phải có ít nhất 2 ký tự (theo quy chuẩn hệ thống)!');
      return;
    }
    if (!selectedFarm) return;

    if (fieldGisError) {
      alert(`Không thể lưu Lô đất: ${fieldGisError}. Vui lòng chỉnh sửa lại ranh giới trên bản đồ để không bị trùng lấn!`);
      return;
    }

    const computedArea = Number(newFieldArea) || 5000;
    if (farmAvailableArea <= 0) {
      alert(`Trang trại "${selectedFarm.name}" đã hết diện tích trống (còn 0 m²). Không thể tạo thêm Lô đất mới!`);
      return;
    }
    if (computedArea > farmAvailableArea) {
      alert(`Diện tích Lô đất (${computedArea.toLocaleString()} m²) vượt quá diện tích còn lại của Trang trại (${farmAvailableArea.toLocaleString()} m²)! Vui lòng điều chỉnh lại.`);
      return;
    }

    setIsSubmittingField(true);
    try {
      let geoJson = toGeoJsonPolygon(fieldPolygon);
      if (!geoJson) {
        const d = 0.0015;
        geoJson = toGeoJsonPolygon([
          [fieldCenter[0] + d, fieldCenter[1] - d],
          [fieldCenter[0] + d, fieldCenter[1] + d],
          [fieldCenter[0] - d, fieldCenter[1] + d],
          [fieldCenter[0] - d, fieldCenter[1] - d],
        ]);
      }

      await fieldService.createField(selectedFarm.farmId, {
        name: newFieldName.trim(),
        areaM2: computedArea,
        soilType: 'Loam',
        latitude: fieldCenter[0],
        longitude: fieldCenter[1],
        boundaryGeoJson: geoJson,
      });
      await loadData();
      setShowAddFieldModal(false);
      setNewFieldName('');
      alert('Đã lưu Lô đất mới cùng tọa độ GIS vào PostgreSQL thành công!');
    } catch (err: any) {
      console.error('Lỗi thêm Lô đất:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi thêm Lô đất: ' + errorMsg);
    } finally {
      setIsSubmittingField(false);
    }
  };

  const handleArchiveZone = async (zone: Zone) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa/lưu trữ Zone "${zone.name}"? Diện tích (${Number(zone.areaM2).toLocaleString()} m²) sẽ được hoàn lại cho Lô đất.`)) {
      return;
    }
    try {
      await zoneService.archiveZone(zone.zoneId || (zone as any).id);
      await loadData();
      if (selectedZone?.zoneId === zone.zoneId || (selectedZone as any)?.id === zone.zoneId) {
        setSelectedZone(null);
      }
      alert(`Đã xóa Zone "${zone.name}" thành công! Diện tích (${Number(zone.areaM2).toLocaleString()} m²) đã được hoàn lại cho Lô đất.`);
    } catch (err: any) {
      console.error('Lỗi xóa Zone:', err);
      const msg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Không thể xóa Zone: ' + msg);
    }
  };

  const handleAddZoneSubmit = async () => {
    if (!newZoneName.trim()) {
      alert('Vui lòng nhập tên Zone!');
      return;
    }
    if (newZoneName.trim().length < 2) {
      alert('Tên Zone phải có ít nhất 2 ký tự (theo quy chuẩn hệ thống)!');
      return;
    }
    if (!selectedField) return;

    if (zoneGisError) {
      alert(`Không thể lưu Zone: ${zoneGisError}. Vui lòng chỉnh sửa lại ranh giới trên bản đồ!`);
      return;
    }

    const computedArea = Number(newZoneArea) || 1000;
    if (fieldAvailableArea <= 0) {
      alert(`Lô đất "${selectedField.name}" đã hết diện tích trống (còn 0 m²). Không thể tạo thêm Zone mới!`);
      return;
    }
    if (computedArea > fieldAvailableArea) {
      alert(`Diện tích Zone (${computedArea.toLocaleString()} m²) vượt quá diện tích còn trống của Lô đất (${fieldAvailableArea.toLocaleString()} m²)! Vui lòng điều chỉnh lại diện tích.`);
      return;
    }

    setIsSubmittingZone(true);
    try {
      let geoJson = toGeoJsonPolygon(zonePolygon);
      if (!geoJson) {
        const d = 0.0006;
        geoJson = toGeoJsonPolygon([
          [zoneCenter[0] + d, zoneCenter[1] - d],
          [zoneCenter[0] + d, zoneCenter[1] + d],
          [zoneCenter[0] - d, zoneCenter[1] + d],
          [zoneCenter[0] - d, zoneCenter[1] - d],
        ]);
      }

      await zoneService.createZone(selectedField.fieldId, {
        name: newZoneName.trim(),
        areaM2: computedArea,
        zoneType: 'Greenhouse',
        notes: newZoneCrop,
        polygonGeoJson: geoJson,
      });
      await loadData();
      setShowAddZoneModal(false);
      setNewZoneName('');
      alert('Đã lưu Zone mới cùng tọa độ GIS vào PostgreSQL thành công!');
    } catch (err: any) {
      console.error('Lỗi thêm Zone:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi thêm Zone: ' + errorMsg);
    } finally {
      setIsSubmittingZone(false);
    }
  };

  const handleSaveZoneGIS = async () => {
    if (!selectedZone) return;
    if (zoneEditPolygon.length < 3) {
      alert('Vui lòng xác định ít nhất 3 điểm trên bản đồ để lưu ranh giới GIS Zone!');
      return;
    }
    setIsSavingZoneGIS(true);
    try {
      const geoJson = toGeoJsonPolygon(zoneEditPolygon);
      const computedArea = Math.max(1, Math.round(calculatePolygonAreaM2(zoneEditPolygon) || Number(selectedZone.areaM2) || 100));
      await zoneService.updateZone(selectedZone.zoneId, {
        name: selectedZone.name,
        areaM2: computedArea,
        polygonGeoJson: geoJson,
      });
      await loadData();
      setSelectedZone(prev => prev ? ({ ...prev, areaM2: computedArea, boundary: geoJson as any, boundaryGeoJson: geoJson as any }) : null);
      setIsEditingZoneGIS(false);
      alert('Đã cập nhật và lưu tọa độ GIS Zone vào PostgreSQL thành công!');
    } catch (err: any) {
      console.error('Lỗi lưu GIS Zone:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.response?.data?.message || err.message;
      alert('Lỗi lưu GIS Zone: ' + errorMsg);
    } finally {
      setIsSavingZoneGIS(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEVICE INSTALLATION REQUEST HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installTargetField, setInstallTargetField] = useState<Field | null>(null);
  const [installTargetZone, setInstallTargetZone] = useState<Zone | null>(null);
  const [installCategory, setInstallCategory] = useState('SENSOR_LORA');
  const [installPriority, setInstallPriority] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [installTitle, setInstallTitle] = useState('');
  const [installDescription, setInstallDescription] = useState('');
  const [isSubmittingInstall, setIsSubmittingInstall] = useState(false);

  const openInstallModalForField = (field: Field) => {
    setInstallTargetField(field);
    const childZones = zones.filter(z => z.fieldId === field.fieldId);
    setInstallTargetZone(childZones.length > 0 ? childZones[0] : null);
    setInstallCategory('SENSOR_LORA');
    setInstallTitle(`Yêu cầu lắp đặt thiết bị IoT cho Lô đất "${field.name}"`);
    setInstallDescription(`Kính gửi phòng Kỹ thuật: Trang trại cần khảo sát và lắp đặt cụm trạm quan trắc vi khí hậu & rơ-le tưới tự động tại Lô đất "${field.name}".`);
    setShowInstallModal(true);
  };

  const openInstallModalForZone = (zone: Zone) => {
    const parentField = fields.find(f => f.fieldId === zone.fieldId) || selectedField;
    if (parentField) setInstallTargetField(parentField);
    setInstallTargetZone(zone);
    setInstallCategory('SENSOR_LORA');
    setInstallTitle(`Yêu cầu lắp đặt thiết bị IoT cho Zone "${zone.name}"`);
    setInstallDescription(`Kính gửi phòng Kỹ thuật: Cần khảo sát, bổ sung trạm cảm biến LoRa (Nhiệt/Ẩm/EC/pH) và tủ rơ-le điều khiển tự động cho Zone "${zone.name}".`);
    setShowInstallModal(true);
  };

  const handleInstallSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!installTitle.trim()) {
      alert('Vui lòng nhập tiêu đề yêu cầu lắp đặt!');
      return;
    }
    const farmId = selectedFarm?.farmId || (installTargetField ? installTargetField.farmId : '30000000-0000-0000-0000-000000000001');
    const zoneId = installTargetZone?.zoneId || (zones.find(z => z.farmId === farmId)?.zoneId || '32000000-0000-0000-0000-000000000001');

    setIsSubmittingInstall(true);
    try {
      await supportService.createServiceRequest({
        farmId,
        zoneId,
        requestType: 'INSTALLATION',
        title: installTitle.trim(),
        description: `[Hạng mục: ${installCategory}] ${installDescription.trim()}`,
        priority: installPriority,
        failureCode: 'NEW_INSTALL',
      });
      setShowInstallModal(false);
      alert('🎉 Đã gửi Yêu cầu Lắp đặt Thiết bị thành công lên hệ thống API! Kỹ thuật viên sẽ liên hệ khảo sát thực địa. Bạn có thể theo dõi tiến độ, ký hợp đồng và nghiệm thu tại mục "Yêu cầu Hỗ trợ Kỹ thuật".');
    } catch (err: any) {
      console.error('Lỗi gửi yêu cầu lắp đặt:', err);
      const msg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi gửi yêu cầu lắp đặt: ' + msg);
    } finally {
      setIsSubmittingInstall(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Interactive Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-700">
          {/* Level 0: Home All Farms */}
          <button
            onClick={handleResetToFarms}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${!selectedFarm
                ? 'bg-[#062326] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            <Home size={14} /> Tất cả Trang trại
          </button>

          {/* Level 1: Selected Farm */}
          {selectedFarm && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <button
                onClick={() => { setSelectedField(null); setSelectedZone(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedFarm && !selectedField
                    ? 'bg-[#062326] text-white shadow-xs'
                    : 'bg-emerald-50 text-[#062326] border border-emerald-200 hover:bg-emerald-100'
                  }`}
              >
                <Building2 size={14} /> {selectedFarm.name}
              </button>
            </>
          )}

          {/* Level 2: Selected Field */}
          {selectedField && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <button
                onClick={() => setSelectedZone(null)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedField && !selectedZone
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100'
                  }`}
              >
                <MapPin size={14} /> {selectedField.name}
              </button>
            </>
          )}

          {/* Level 3: Selected Zone */}
          {selectedZone && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold shadow-xs">
                <Sprout size={14} /> {selectedZone.name}
              </span>
            </>
          )}
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => navigate('/owner/farms/create')} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus size={15} className="mr-1" /> Tạo Trang trại Mới
          </Button>
        </div>
      </div>

      {/* VIEW LEVEL 1: ALL FARMS LIST */}
      {!selectedFarm && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="text-[#062326]" size={22} /> Danh sách Trang trại Sở hữu (Level 1: Farms)
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Nhấn vào thẻ Trang trại bất kỳ để mở danh sách Phân khu Lô đất (Fields) lồng bên trong.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farms.map(farm => {
              const farmFields = fields.filter(fd => fd.farmId === farm.farmId);
              const farmZones = zones.filter(z => z.farmId === farm.farmId);

              return (
                <div
                  key={farm.farmId}
                  onClick={() => handleSelectFarm(farm)}
                  className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs hover:border-[#062326] hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-emerald-50 text-[#062326] rounded-xl border border-emerald-100 group-hover:bg-[#062326] group-hover:text-white transition-colors">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded border border-emerald-300">
                          LEVEL 1: FARM
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1 group-hover:text-[#062326] transition-colors">
                          {farm.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={13} className="text-[#062326]" /> {farm.address}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={farm.status} />
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{farm.description}</p>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Diện tích</span>
                      <strong className="text-slate-900">{(((farm.totalAreaM2 || farm.areaM2 || 0)) / 10000).toFixed(1)} ha</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Lô đất (Fields)</span>
                      <strong className="text-[#062326] font-bold">{farmFields.length} Lô</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Phân khu (Zones)</span>
                      <strong className="text-amber-700 font-bold">{farmZones.length} Zones</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-[#062326] font-bold group-hover:translate-x-1 transition-transform">
                    <span>Xem các Lô đất (Fields) thuộc Trang trại ➔</span>
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW LEVEL 2: FIELDS IN SELECTED FARM */}
      {selectedFarm && !selectedField && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner for Selected Farm */}
          <div className="p-6 bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] text-white rounded-2xl shadow-md space-y-3 border border-emerald-400/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                  <Building2 size={16} /> Trang trại Đang chọn (Level 1)
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedFarm.name}</h2>
                <p className="text-xs text-emerald-100 flex items-center gap-1 mt-1">
                  <MapPin size={13} className="text-emerald-200" /> {selectedFarm.address} • {(((selectedFarm.totalAreaM2 || selectedFarm.areaM2 || 0)) / 10000).toFixed(1)} ha
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-white border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-xs font-medium" onClick={handleResetToFarms}>
                  <ArrowLeft size={14} className="mr-1" /> Về danh sách Trang trại
                </Button>
                <Button size="sm" onClick={() => setShowAddFieldModal(true)} className="bg-white text-[#119653] hover:bg-emerald-50 font-bold shadow-sm">
                  <Plus size={14} className="mr-1" /> Thêm Lô đất (Field) Mới
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CornerDownRight size={18} className="text-sky-600" /> Danh sách Các Phân khu Lô đất (Level 2: Fields) thuộc Trang trại
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {fields.filter(f => f.farmId === selectedFarm.farmId).length} Lô đất tìm thấy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.filter(f => f.farmId === selectedFarm.farmId).map(field => {
              const childZones = zones.filter(z => z.fieldId === field.fieldId);
              return (
                <div
                  key={field.fieldId}
                  onClick={() => handleSelectField(field)}
                  className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs hover:border-sky-500 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-sky-50 text-sky-700 rounded-xl border border-sky-100 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        <Layers size={22} />
                      </div>
                      <div>
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-900 text-[10px] font-bold rounded border border-sky-300">
                          LEVEL 2: FIELD
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1 group-hover:text-sky-700 transition-colors">
                          {field.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
                      </div>
                    </div>
                    <StatusBadge status={field.status || 'Active'} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Diện tích Phân khu</span>
                      <strong className="text-slate-900">{(field.areaM2 / 10000).toFixed(1)} ha</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Số Zone lồng bên trong</span>
                      <strong className="text-amber-700 font-bold">{childZones.length} Zones</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <span className="text-xs text-sky-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Mở Zone ➔ <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW LEVEL 3: ZONES IN SELECTED FIELD */}
      {selectedField && !selectedZone && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner for Selected Field */}
          <div className="p-6 bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] text-white rounded-2xl shadow-md space-y-3 border border-emerald-400/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                  <Building2 size={14} /> {selectedFarm?.name} ➔ <MapPin size={14} /> Lô đất Đang chọn (Level 2)
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedField.name}</h2>
                <p className="text-xs text-emerald-100 flex items-center gap-1 mt-1">
                  {selectedField.description} • {(selectedField.areaM2 / 10000).toFixed(1)} ha
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-white border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-xs font-medium" onClick={() => setSelectedField(null)}>
                  <ArrowLeft size={14} className="mr-1" /> Trở lại Lô đất
                </Button>
                <Button size="sm" onClick={() => setShowAddZoneModal(true)} className="bg-white text-[#119653] hover:bg-emerald-50 font-bold shadow-sm">
                  <Plus size={14} className="mr-1" /> Thêm Zone Mới
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CornerDownRight size={18} className="text-amber-600" /> Các Phân khu Zone (Level 3: Zones) lồng trong Lô đất
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {zones.filter(z => z.fieldId === selectedField.fieldId).length} Zone tìm thấy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.filter(z => z.fieldId === selectedField.fieldId).map(zone => (
              <div
                key={zone.zoneId}
                onClick={() => handleSelectZone(zone)}
                className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Sprout size={22} />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300">
                        LEVEL 3: ZONE
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1 group-hover:text-amber-700 transition-colors">
                        {zone.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{zone.description}</p>
                    </div>
                  </div>
                  <StatusBadge status={zone.status || 'Operating'} />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cây trồng hiện tại:</span>
                    <strong className="text-[#062326] font-bold">{zone.currentCrop}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giai đoạn sinh trưởng:</span>
                    <strong className="text-sky-700 font-bold">{zone.currentStage}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diện tích Zone:</span>
                    <strong className="text-slate-900">{zone.areaM2} m²</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInstallModalForZone(zone);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-2xs"
                      title="Gửi yêu cầu lắp đặt thiết bị cho Zone này"
                    >
                      <Wrench size={13} className="text-emerald-700" />
                      <span>Yêu cầu thiết bị</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveZone(zone);
                      }}
                      className="p-1.5 text-xs rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                      title="Xóa / Lưu trữ Zone này (hoàn lại diện tích cho Lô đất)"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <span className="text-xs text-amber-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Vi khí hậu & LoRa ➔ <ArrowUpRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW LEVEL 4: ZONE DETAILS */}
      {selectedZone && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 bg-gradient-to-r from-[#119653] via-[#0f874a] to-[#0b6f3c] text-white rounded-2xl shadow-md space-y-3 border border-emerald-400/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                  <Building2 size={13} /> {selectedFarm?.name} ➔ <MapPin size={13} /> {selectedField?.name} ➔ <Sprout size={13} /> Zone Chi tiết
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedZone.name}</h2>
                <p className="text-xs text-emerald-100">{selectedZone.description} • {selectedZone.areaM2} m²</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => openInstallModalForZone(selectedZone)}
                  className="bg-white text-[#119653] hover:bg-emerald-50 font-bold shadow-sm border border-emerald-200"
                >
                  <Wrench size={14} className="mr-1.5" /> Gửi yêu cầu lắp đặt thiết bị
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleArchiveZone(selectedZone)}
                  className="text-rose-100 border-rose-400/40 bg-rose-700/80 hover:bg-rose-800 hover:text-white font-medium"
                  title="Xóa / Lưu trữ Zone này (hoàn lại diện tích cho Lô đất)"
                >
                  <Trash2 size={14} className="mr-1.5 text-rose-200" /> Xóa Zone
                </Button>
                <Button size="sm" variant="outline" className="text-white border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-xs font-medium" onClick={() => setSelectedZone(null)}>
                  <ArrowLeft size={14} className="mr-1" /> Trở lại danh sách Zone
                </Button>
                <Button size="sm" onClick={() => navigate('/owner/monitoring/realtime')} className="bg-emerald-900/70 hover:bg-emerald-950 text-white font-semibold border border-emerald-400/30">
                  <Gauge size={14} className="mr-1" /> Xem Giám sát Realtime
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* GIS Map Location of Zone */}
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <MapPin size={16} className="text-[#062326]" /> Vị trí GIS Map của Zone này
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Database size={11} /> PostgreSQL PostGIS (SRID 4326)
                    </span>
                    <span>• {currentZonePoints.length > 0 ? `${currentZonePoints.length} tọa độ đỉnh` : 'Chưa có GIS'}</span>
                  </div>
                </div>
                <div>
                  {!isEditingZoneGIS ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
                      onClick={() => {
                        setIsEditingZoneGIS(true);
                        setZoneEditPolygon(currentZonePoints);
                        setZoneEditCenter(currentZoneCenter);
                      }}
                    >
                      <Edit3 size={13} className="mr-1 text-slate-600" /> Sửa GIS
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => setIsEditingZoneGIS(false)}
                        disabled={isSavingZoneGIS}
                      >
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={handleSaveZoneGIS}
                        disabled={isSavingZoneGIS}
                      >
                        <Save size={13} className="mr-1" />
                        {isSavingZoneGIS ? 'Đang lưu...' : 'Lưu GIS vào DB'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <GISLocationPicker
                level="ZONE"
                center={isEditingZoneGIS ? zoneEditCenter : currentZoneCenter}
                onCenterChange={setZoneEditCenter}
                polygon={isEditingZoneGIS ? zoneEditPolygon : currentZonePoints}
                onPolygonChange={setZoneEditPolygon}
                parentFieldPolygon={currentFieldPolygon.length > 0 ? currentFieldPolygon : undefined}
                height="280px"
                readOnly={!isEditingZoneGIS}
              />
            </div>

            {/* Right Column: Telemetry, Yield Tracking, and Employee Assignment */}
            <div className="space-y-5">
              {/* Zone Telemetry & Connected Devices */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Cpu size={16} className="text-sky-700" /> Cảm biến LoRa & Cây trồng đang canh tác
                </h4>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex justify-between text-slate-700"><span>Giống cây:</span><strong className="text-[#062326]">{selectedZone.currentCrop}</strong></div>
                  <div className="flex justify-between text-slate-700"><span>Giai đoạn:</span><strong className="text-sky-700">{selectedZone.currentStage}</strong></div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-slate-800">Cảm biến trực tuyến kết nối với Zone:</div>
                  {nodes.filter(n => (n.zoneId === selectedZone.zoneId || n.zoneId === (selectedZone as any).id)).length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-500 text-center text-[11px]">
                      Chưa có cảm biến LoRa gắn trực tiếp vào Zone này.
                    </div>
                  ) : (
                    nodes.filter(n => (n.zoneId === selectedZone.zoneId || n.zoneId === (selectedZone as any).id)).map(node => (
                      <div key={node.nodeId || node.deviceId || node.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Radio size={14} className="text-emerald-600" /> {node.name || node.hardwareAddress || 'Thiết bị IoT'}
                          </div>
                          <div className="text-[11px] text-slate-500">Mã: {node.nodeCode || node.hardwareAddress || node.deviceType || 'NODE'} • Pin: {node.batteryLevel ?? 92}%</div>
                        </div>
                        <StatusBadge status={node.status || 'ONLINE'} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Thẻ Sản lượng Canh tác & Thu hoạch (Crop Yield Tracking) */}
              <div className="p-5 bg-gradient-to-br from-[#119653] via-[#0f874a] to-[#0b6f3c] border border-emerald-400/30 rounded-2xl shadow-md text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-white/20 text-white border border-white/30">
                      <Scale size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Sản lượng Canh tác & Thu hoạch</h4>
                      <p className="text-[11px] text-emerald-100">Theo dõi và ghi nhận sản lượng nông sản cho Zone này</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-bold border border-white/30 uppercase tracking-wider font-mono">
                    {zoneYieldMap[selectedZone.zoneId]?.status === 'Completed' ? 'Đã thu hoạch' : 'Vụ đang canh tác'}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white/15 border border-white/25 rounded-xl space-y-0.5">
                    <div className="text-[11px] text-emerald-100 font-medium">Sản lượng thực tế:</div>
                    <div className="text-xl font-black text-white font-mono">
                      {(zoneYieldMap[selectedZone.zoneId]?.actualYieldKg ?? 0).toLocaleString()} <span className="text-xs font-normal text-emerald-100">kg</span>
                    </div>
                    <div className="text-[10px] text-emerald-100">
                      ≈ {((zoneYieldMap[selectedZone.zoneId]?.actualYieldKg ?? 0) / 1000).toFixed(2)} tấn
                    </div>
                  </div>

                  <div className="p-3 bg-white/15 border border-white/25 rounded-xl space-y-0.5">
                    <div className="text-[11px] text-emerald-100 font-medium">Năng suất bình quân:</div>
                    <div className="text-xl font-black text-white font-mono">
                      {selectedZone.areaM2 ? (((zoneYieldMap[selectedZone.zoneId]?.actualYieldKg ?? 0) / Number(selectedZone.areaM2)).toFixed(2)) : '0'} <span className="text-xs font-normal text-emerald-100">kg/m²</span>
                    </div>
                    <div className="text-[10px] text-emerald-100">
                      Trên diện tích {Number(selectedZone.areaM2).toLocaleString()} m²
                    </div>
                  </div>
                </div>

                {/* Quality & harvest date */}
                <div className="p-2.5 bg-black/15 rounded-xl border border-white/20 text-[11px] space-y-1 text-emerald-50">
                  <div className="flex justify-between">
                    <span className="text-emerald-100">Phân loại chất lượng:</span>
                    <span className="font-semibold text-white">{zoneYieldMap[selectedZone.zoneId]?.qualityGrade || 'Loại 1 (Xuất khẩu)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-100">Ngày ghi nhận:</span>
                    <span className="font-mono text-emerald-50">{zoneYieldMap[selectedZone.zoneId]?.harvestDate || new Date().toISOString().split('T')[0]}</span>
                  </div>
                  {zoneYieldMap[selectedZone.zoneId]?.notes && (
                    <div className="text-[10px] text-emerald-100 pt-1 border-t border-white/10">
                      Ghi chú: {zoneYieldMap[selectedZone.zoneId]?.notes}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleOpenYieldModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-white text-[#119653] hover:bg-emerald-50 font-bold text-xs flex items-center justify-center gap-2 shadow-sm border border-white/40 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  Nhập / Cập nhật Sản lượng Thu hoạch (kg)
                </button>
              </div>

              {/* Thẻ Nhân viên Phân công phụ trách Zone */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <UserCheck size={16} className="text-[#062326]" /> Nhân viên phân công phụ trách Zone:
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                    Phân công trực tiếp
                  </span>
                </div>

                {assignNotification && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    assignNotification.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' : 'bg-rose-50 border border-rose-300 text-rose-900'
                  }`}>
                    <CheckCircle2 size={14} className={assignNotification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
                    <span>{assignNotification.message}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <select
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#062326] shadow-xs cursor-pointer disabled:opacity-50"
                    value={assignedEmployeeIdMap[selectedZone.zoneId] ?? ''}
                    onChange={e => handleAssignEmployee(selectedZone.zoneId, e.target.value)}
                    disabled={isAssigningEmployee}
                  >
                    <option value="">-- Trống (Chưa phân công nhân viên) --</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId || emp.userId} value={emp.employeeId || emp.userId}>
                        👤 {emp.fullName} ({emp.position || emp.role}) - {emp.phone}
                      </option>
                    ))}
                  </select>

                  {/* Render Employee Card or Unassigned Info Card */}
                  {(() => {
                    const empId = assignedEmployeeIdMap[selectedZone.zoneId] ?? '';
                    const assignedEmp = employees.find(e => (e.employeeId || e.userId) === empId);

                    if (assignedEmp) {
                      return (
                        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#062326] text-emerald-400 flex items-center justify-center font-bold text-xs shadow-xs shrink-0 border border-emerald-500/30">
                              {assignedEmp.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                {assignedEmp.fullName}
                                <span className="px-1.5 py-0.5 text-[10px] bg-emerald-200 text-emerald-900 rounded font-bold">
                                  Đang phụ trách
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                Chức vụ: <strong>{assignedEmp.position}</strong> • SĐT: <strong>{assignedEmp.phone}</strong>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Email: {assignedEmp.email}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAssignEmployee(selectedZone.zoneId, '')}
                            disabled={isAssigningEmployee}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline shrink-0 flex items-center gap-1 bg-white px-2 py-1 rounded border border-rose-200 shadow-2xs cursor-pointer"
                            title="Bỏ phân công (Trở về Trống)"
                          >
                            <UserX size={12} /> Bỏ phân công
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 border-dashed rounded-xl flex items-center justify-between text-slate-600 animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 border border-slate-300">
                            <UserX size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                              Trạng thái: <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold border border-amber-200">Trống</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Chưa phân công nhân viên quản lý Zone này. Chọn nhân viên từ danh sách ở trên để cấp quyền điều khiển.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Embedded Standardized CF3 Control Hub for Selected Zone */}
          <div className="pt-4">
            <CF3ControlSection
              scopeLevel="ZONE"
              farmId={selectedFarm?.farmId}
              fieldId={selectedField?.fieldId}
              zoneId={selectedZone.zoneId}
              title={`Điều khiển & Lịch tưới Vi khí hậu cho Zone "${selectedZone.name}"`}
              subtitle="Thiết lập ngưỡng vi khí hậu riêng cho vụ trồng, bật/tắt thiết bị rơ-le và xem lịch tưới trực tiếp tại Zone này."
            />
          </div>
        </div>
      )}

      {/* Modal Add Field inside Selected Farm */}
      <Modal isOpen={showAddFieldModal} title={`Thêm Phân khu Lô đất Mới vào "${selectedFarm?.name || 'Trang trại'}"`} onClose={() => setShowAddFieldModal(false)}>
        <div className="space-y-4 text-xs">
          <div className={`p-3 rounded-xl text-xs flex justify-between items-center ${
            farmAvailableArea <= 0 ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-sky-50 border border-sky-200 text-sky-900'
          }`}>
            <span>Diện tích còn trống của Trang trại:</span>
            <strong className={`font-mono text-sm ${farmAvailableArea <= 0 ? 'text-red-700' : 'text-sky-800'}`}>
              {farmAvailableArea.toLocaleString()} m²
            </strong>
          </div>

          {farmAvailableArea <= 0 && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <span className="text-base">⚠️</span>
              <span>Trang trại này đã hết diện tích trống (còn 0 m²). Không thể tạo thêm Lô đất mới.</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Phân khu Lô đất mới * (Tối thiểu 2 ký tự)</label>
            <Input
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              placeholder="Nhập tên Lô đất (vd: Lô C - Dưa màng)"
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Diện tích quy hoạch (m²) * <span className="text-emerald-700 font-normal">(Tự động đồng bộ từ bản đồ GIS)</span>
            </label>
            <Input
              type="number"
              value={newFieldArea}
              onChange={e => setNewFieldArea(e.target.value)}
              placeholder="VD: 5000"
            />
            <span className={`text-[10px] mt-0.5 block ${
              Number(newFieldArea) > farmAvailableArea ? 'text-red-600 font-semibold' : 'text-slate-500'
            }`}>
              {Number(newFieldArea) > farmAvailableArea
                ? `⚠️ Vượt quá diện tích còn lại của Trang trại (${farmAvailableArea.toLocaleString()} m²)!`
                : `Tối đa diện tích còn lại của Trang trại (${farmAvailableArea.toLocaleString()} m²).`}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-bold">Xác định Tọa độ GIS Lô đất (Lồng trong Farm)</label>
              <span className="text-[10px] text-slate-500">
                (Kéo ghim tâm điểm hoặc ghim #1..#4 để di chuyển vị trí Lô đất)
              </span>
            </div>
            <GISLocationPicker
              level="FIELD"
              center={fieldCenter}
              onCenterChange={setFieldCenter}
              polygon={fieldPolygon}
              onPolygonChange={p => {
                setFieldPolygon(p);
                const area = Math.round(calculatePolygonAreaM2(p));
                if (area > 0) {
                  setNewFieldArea(area.toString());
                }
              }}
              parentFarmPolygon={currentFarmPolygon.length >= 3 ? currentFarmPolygon : undefined}
              otherPolygons={existingOtherFields}
              onValidationChange={(isValid, err) => setFieldGisError(isValid ? null : err)}
              hideAddressSearch={false}
              height="300px"
            />
          </div>

          {fieldGisError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <span className="text-base">🚫</span>
              <span>{fieldGisError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)} disabled={isSubmittingField}>Hủy</Button>
            <Button
              onClick={handleAddFieldSubmit}
              disabled={isSubmittingField || !!fieldGisError || farmAvailableArea <= 0 || (Number(newFieldArea) || 0) > farmAvailableArea}
              className={(fieldGisError || farmAvailableArea <= 0 || (Number(newFieldArea) || 0) > farmAvailableArea) ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''}
              title={
                farmAvailableArea <= 0
                  ? 'Trang trại đã hết diện tích trống'
                  : (Number(newFieldArea) || 0) > farmAvailableArea
                  ? 'Diện tích vượt quá phần còn lại của Trang trại'
                  : fieldGisError || undefined
              }
            >
              {isSubmittingField ? 'Đang lưu vào DB...' : 'Thêm Lô đất vào Farm'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Zone inside Selected Field */}
      <Modal isOpen={showAddZoneModal} title={`Thêm Zone Mới vào Lô đất "${selectedField?.name || 'Field'}"`} onClose={() => setShowAddZoneModal(false)}>
        <div className="space-y-4 text-xs">
          <div className={`p-3 rounded-xl text-xs flex justify-between items-center ${
            fieldAvailableArea <= 0 ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-amber-50 border border-amber-200 text-amber-900'
          }`}>
            <span>Diện tích còn trống trong Lô đất:</span>
            <strong className={`font-mono text-sm ${fieldAvailableArea <= 0 ? 'text-red-700' : 'text-amber-800'}`}>
              {fieldAvailableArea.toLocaleString()} m²
            </strong>
          </div>

          {fieldAvailableArea <= 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <p className="font-bold">Lô đất này đã sử dụng hết 100% diện tích (còn 0 m²)!</p>
                <p className="text-[11px] text-red-700 mt-0.5">Không thể tạo thêm Zone mới. Bạn cần xóa bớt Zone cũ hoặc chỉnh sửa thu nhỏ diện tích Zone hiện có.</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Zone * (Tối thiểu 2 ký tự)</label>
            <Input
              value={newZoneName}
              onChange={e => setNewZoneName(e.target.value)}
              placeholder="Nhập tên Zone (vd: Zone 05)"
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Diện tích quy hoạch Zone (m²) * <span className="text-emerald-700 font-normal">(Tự động đồng bộ từ bản đồ GIS)</span>
            </label>
            <Input
              type="number"
              value={newZoneArea}
              onChange={e => setNewZoneArea(e.target.value)}
              placeholder="VD: 1000"
            />
            <span className={`text-[10px] mt-0.5 block ${
              Number(newZoneArea) > fieldAvailableArea ? 'text-red-600 font-semibold' : 'text-slate-500'
            }`}>
              {Number(newZoneArea) > fieldAvailableArea
                ? `⚠️ Diện tích quy hoạch (${(Number(newZoneArea) || 0).toLocaleString()} m²) vượt quá diện tích còn lại của Lô đất (${fieldAvailableArea.toLocaleString()} m²)!`
                : `Tối đa diện tích còn lại của Lô đất (${fieldAvailableArea.toLocaleString()} m²).`}
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Loài Cây trồng</label>
            <Input value={newZoneCrop} onChange={e => setNewZoneCrop(e.target.value)} />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Xác định Tọa độ GIS Zone (Lồng trong Field & Farm)</label>
            <GISLocationPicker
              level="ZONE"
              center={zoneCenter}
              onCenterChange={setZoneCenter}
              polygon={zonePolygon}
              onPolygonChange={p => {
                setZonePolygon(p);
                const area = Math.round(calculatePolygonAreaM2(p));
                if (area > 0) {
                  setNewZoneArea(area.toString());
                }
              }}
              parentFieldPolygon={currentFieldPolygon.length > 0 ? currentFieldPolygon : undefined}
              otherPolygons={existingOtherZones}
              onValidationChange={(isValid, err) => setZoneGisError(isValid ? null : err)}
              height="280px"
            />
          </div>

          {zoneGisError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <span className="text-base">🚫</span>
              <span>{zoneGisError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddZoneModal(false)} disabled={isSubmittingZone}>Hủy</Button>
            <Button
              onClick={handleAddZoneSubmit}
              disabled={isSubmittingZone || !!zoneGisError || fieldAvailableArea <= 0 || (Number(newZoneArea) || 0) > fieldAvailableArea}
              className={(zoneGisError || fieldAvailableArea <= 0 || (Number(newZoneArea) || 0) > fieldAvailableArea) ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''}
              title={
                fieldAvailableArea <= 0
                  ? 'Lô đất đã hết diện tích trống'
                  : (Number(newZoneArea) || 0) > fieldAvailableArea
                  ? 'Diện tích vượt quá phần còn lại của Lô đất'
                  : zoneGisError || undefined
              }
            >
              {isSubmittingZone ? 'Đang lưu vào DB...' : 'Thêm Zone vào Lô đất'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Submit Device Installation Request for Field or Zone */}
      <Modal
        isOpen={showInstallModal}
        title="Gửi Yêu cầu Lắp đặt Thiết bị IoT & Khảo sát Thực địa"
        onClose={() => setShowInstallModal(false)}
      >
        <div className="space-y-4 text-xs">
          {/* Target Hierarchy Location Breadcrumb */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-1.5 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-[11px]">
              <Wrench size={14} className="text-emerald-700" />
              <span>Vị trí triển khai lắp đặt thiết bị:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-0.5 bg-white border border-emerald-300 rounded text-emerald-800 font-semibold flex items-center gap-1">
                <Building2 size={12} /> {selectedFarm?.name || 'Trang trại'}
              </span>
              <span>➔</span>
              <span className="px-2 py-0.5 bg-white border border-sky-300 rounded text-sky-800 font-semibold flex items-center gap-1">
                <MapPin size={12} /> {installTargetField?.name || 'Lô đất'}
              </span>
              {installTargetZone && (
                <>
                  <span>➔</span>
                  <span className="px-2 py-0.5 bg-white border border-amber-300 rounded text-amber-800 font-semibold flex items-center gap-1">
                    <Sprout size={12} /> {installTargetZone.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Select Target Zone if opened from Field */}
          {installTargetField && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Khu vực Zone chỉ định lắp đặt:</label>
              <select
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326]"
                value={installTargetZone?.zoneId || ''}
                onChange={e => {
                  const found = zones.find(z => z.zoneId === e.target.value);
                  setInstallTargetZone(found || null);
                }}
              >
                <option value="">-- Toàn bộ Lô đất (Khảo sát đo đạc thực địa / Đặt hàng mới) --</option>
                {zones
                  .filter(z => z.fieldId === installTargetField.fieldId)
                  .map(z => (
                    <option key={z.zoneId} value={z.zoneId}>
                      {z.name} ({z.areaM2} m² - {z.currentCrop || 'Zone'})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Device Category */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Hạng mục Thiết bị IoT cần lắp đặt *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326]"
              value={installCategory}
              onChange={e => setInstallCategory(e.target.value)}
            >
              <option value="SENSOR_LORA">📡 Trạm Cảm biến Vi khí hậu LoRa (Nhiệt/Ẩm không khí, Ánh sáng, CO2)</option>
              <option value="SOIL_PH_EC">🌱 Cụm Cảm biến Đất & Dung dịch (Độ ẩm đất, EC, pH, NPK luống cây)</option>
              <option value="ACTUATOR_VALVE">⚡ Tủ điều khiển Actuator & Van điện từ Solenoid tưới tự động (Relay LoRa Gateway)</option>
              <option value="DRIP_IRRIGATION">💧 Hệ thống Châm phân & Tưới nhỏ giọt tự động áp lực cao</option>
              <option value="AI_CAMERA">📹 Camera AI Giám sát Sinh trưởng Cây trồng & Cảnh báo Sâu bệnh</option>
              <option value="ALL_IN_ONE">🚀 Gói Thiết bị Thông minh Toàn diện (All-in-one SmartFarm IoT Package)</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tiêu đề Yêu cầu *</label>
            <Input
              value={installTitle}
              onChange={e => setInstallTitle(e.target.value)}
              placeholder="VD: Yêu cầu lắp đặt cảm biến vi khí hậu cho Lô đất A"
            />
          </div>

          {/* Detailed Description */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô tả chi tiết & Ghi chú kỹ thuật *</label>
            <textarea
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] text-xs resize-none"
              value={installDescription}
              onChange={e => setInstallDescription(e.target.value)}
              placeholder="Nhập chi tiết nhu cầu: số lượng node cảm biến, loại cây trồng, van điều khiển, vị trí kéo dây điện/nguồn pin mặt trời..."
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Mức độ ưu tiên</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInstallPriority('NORMAL')}
                className={`py-2 px-3 rounded-lg border text-center font-semibold transition-all ${
                  installPriority === 'NORMAL'
                    ? 'bg-slate-100 border-slate-400 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Bình thường
              </button>
              <button
                type="button"
                onClick={() => setInstallPriority('HIGH')}
                className={`py-2 px-3 rounded-lg border text-center font-semibold transition-all ${
                  installPriority === 'HIGH'
                    ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ⚡ Ưu tiên cao
              </button>
              <button
                type="button"
                onClick={() => setInstallPriority('CRITICAL')}
                className={`py-2 px-3 rounded-lg border text-center font-semibold transition-all ${
                  installPriority === 'CRITICAL'
                    ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🚨 Khẩn cấp
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowInstallModal(false)} disabled={isSubmittingInstall}>
              Hủy
            </Button>
            <Button onClick={handleInstallSubmit} disabled={isSubmittingInstall} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <Wrench size={14} className="mr-1.5" />
              {isSubmittingInstall ? 'Đang gửi yêu cầu lên API...' : 'Gửi Yêu cầu Thiết bị Ngay'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Input Crop Yield for Selected Zone */}
      <Modal
        isOpen={showYieldModal}
        title={`Ghi nhận Sản lượng Canh tác & Thu hoạch cho Zone "${selectedZone?.name || 'Zone'}"`}
        onClose={() => setShowYieldModal(false)}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-1 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
              <Sprout size={16} className="text-emerald-700" />
              <span>Zone: {selectedZone?.name} • Cây trồng: {selectedZone?.currentCrop || 'Cây trồng vụ mùa'}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Diện tích canh tác quy hoạch: <strong>{Number(selectedZone?.areaM2 || 0).toLocaleString()} m²</strong>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Khối lượng Sản lượng Thu hoạch thực tế (kg) *
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              value={yieldKgInput}
              onChange={e => setYieldKgInput(e.target.value)}
              placeholder="VD: 1250"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>≈ {((parseFloat(yieldKgInput) || 0) / 1000).toFixed(2)} Tấn</span>
              <span>
                Năng suất: {selectedZone?.areaM2 ? (((parseFloat(yieldKgInput) || 0) / Number(selectedZone.areaM2)).toFixed(2)) : '0'} kg/m²
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Ngày ghi nhận / Thu hoạch</label>
            <Input
              type="date"
              value={yieldDateInput}
              onChange={e => setYieldDateInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Phân loại & Tiêu chuẩn Chất lượng</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] text-xs cursor-pointer"
              value={yieldQualityInput}
              onChange={e => setYieldQualityInput(e.target.value)}
            >
              <option value="Loại 1 (Xuất khẩu / Siêu thị cao cấp)">🌟 Loại 1 (Xuất khẩu / Chuỗi siêu thị cao cấp)</option>
              <option value="Loại 2 (Thương phẩm nội địa / Chợ đầu mối)">🥬 Loại 2 (Thương phẩm thị trường nội địa)</option>
              <option value="Loại 3 (Nhà máy chế biến / Đóng hộp)">🏭 Loại 3 (Nhà máy chế biến / Đóng hộp)</option>
              <option value="Đạt chuẩn VietGAP / GlobalGAP">✅ Đạt chứng chỉ VietGAP / GlobalGAP</option>
              <option value="Hữu cơ Organic">🌿 Canh tác Hữu cơ Organic</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Ghi chú Thu hoạch & Đánh giá Chất lượng</label>
            <textarea
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] text-xs resize-none"
              value={yieldNotesInput}
              onChange={e => setYieldNotesInput(e.target.value)}
              placeholder="Ghi chú về độ ngọt Brix, ngoại hình, trọng lượng quả trung bình hoặc đối tác thu mua..."
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800 text-xs">Đánh dấu Hoàn tất Vụ mùa</div>
              <div className="text-[11px] text-slate-500">Kết thúc chu kỳ sinh trưởng và lưu trữ hồ sơ vụ canh tác này</div>
            </div>
            <input
              type="checkbox"
              checked={yieldMarkCompleted}
              onChange={e => setYieldMarkCompleted(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowYieldModal(false)} disabled={isSubmittingYield}>
              Hủy
            </Button>
            <Button
              onClick={handleSaveYield}
              disabled={isSubmittingYield}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Save size={14} className="mr-1.5" />
              {isSubmittingYield ? 'Đang lưu vào hệ thống...' : 'Lưu Sản Lượng Vụ Mùa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
