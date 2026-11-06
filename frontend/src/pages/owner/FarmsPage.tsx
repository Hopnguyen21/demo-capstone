import React, { useState, useEffect } from 'react';
import { Farm, Field, Zone } from '../../types';
import { farmService, fieldService, zoneService, deviceService, supportService, extractApiError } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import {
  Building2, MapPin, Layers, Plus, ArrowUpRight, ChevronRight, Sprout,
  CornerDownRight, Home, ArrowLeft, Cpu, Activity, Gauge, Sliders, Calendar,
  Radio, CheckCircle2, UserCheck, UserX, User, Database, Save, Edit3, Wrench
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

  const loadData = async () => {
    try {
      const [fData, fdData, zData, nData] = await Promise.all([
        farmService.getFarms().catch(err => { console.warn('farmService.getFarms error:', err); return []; }),
        fieldService.getFields().catch(err => { console.warn('fieldService.getFields error:', err); return []; }),
        zoneService.getZones().catch(err => { console.warn('zoneService.getZones error:', err); return []; }),
        deviceService.getNodes().catch(err => { console.warn('deviceService.getNodes error:', err); return []; }),
      ]);
      if (Array.isArray(fData)) setFarms(fData);
      if (Array.isArray(fdData)) setFields(fdData);
      if (Array.isArray(zData)) setZones(zData);
      if (Array.isArray(nData)) setNodes(nData);
      const members = await farmService.getFarmMembers().catch(() => []);
      if (Array.isArray(members)) setEmployees(members);
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

  // Assigned Employee mapping per Zone
  const [assignedEmployeeIdMap, setAssignedEmployeeIdMap] = useState<Record<string, string>>({
    'zone-01': 'emp-01',
    'zone-02': 'emp-01',
    'zone-03': 'emp-02',
    'zone-04': '', // Default Trống (Empty) option
  });

  const handleAssignEmployee = (zoneId: string, employeeId: string) => {
    setAssignedEmployeeIdMap(prev => ({
      ...prev,
      [zoneId]: employeeId,
    }));
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

  const currentFieldPolygon = React.useMemo(() => {
    return extractPolygonPoints((selectedField as any)?.boundaryGeoJson || selectedField?.boundary);
  }, [selectedField]);

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
    setFieldPolygon([
      [cent[0] + d, cent[1] - d],
      [cent[0] + d, cent[1] + d],
      [cent[0] - d, cent[1] + d],
      [cent[0] - d, cent[1] - d],
    ]);
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
    setZonePolygon([
      [cent[0] + d, cent[1] - d],
      [cent[0] + d, cent[1] + d],
      [cent[0] - d, cent[1] + d],
      [cent[0] - d, cent[1] - d],
    ]);
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
    const computedArea = Number(newFieldArea) || 5000;
    if (farmAvailableArea > 0 && computedArea > farmAvailableArea) {
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

  const handleAddZoneSubmit = async () => {
    if (!newZoneName.trim()) {
      alert('Vui lòng nhập tên Nhà màng / Zone!');
      return;
    }
    if (newZoneName.trim().length < 2) {
      alert('Tên Nhà màng / Zone phải có ít nhất 2 ký tự (theo quy chuẩn hệ thống)!');
      return;
    }
    if (!selectedField) return;

    const computedArea = Number(newZoneArea) || 1000;
    if (fieldAvailableArea > 0 && computedArea > fieldAvailableArea) {
      alert(`Diện tích Nhà màng (${computedArea.toLocaleString()} m²) vượt quá diện tích còn trống của Lô đất (${fieldAvailableArea.toLocaleString()} m²)! Vui lòng điều chỉnh lại diện tích.`);
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
      alert('Đã lưu Nhà màng mới cùng tọa độ GIS vào PostgreSQL thành công!');
    } catch (err: any) {
      console.error('Lỗi thêm Nhà màng:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi thêm Nhà màng: ' + errorMsg);
    } finally {
      setIsSubmittingZone(false);
    }
  };

  const handleSaveZoneGIS = async () => {
    if (!selectedZone) return;
    if (zoneEditPolygon.length < 3) {
      alert('Vui lòng xác định ít nhất 3 điểm trên bản đồ để lưu ranh giới GIS Nhà màng!');
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
      alert('Đã cập nhật và lưu tọa độ GIS Nhà màng vào PostgreSQL thành công!');
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
    setInstallTitle(`Yêu cầu lắp đặt thiết bị IoT cho Nhà màng "${zone.name}"`);
    setInstallDescription(`Kính gửi phòng Kỹ thuật: Cần khảo sát, bổ sung trạm cảm biến LoRa (Nhiệt/Ẩm/EC/pH) và tủ rơ-le điều khiển tự động cho Nhà màng "${zone.name}".`);
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
                      <span className="text-slate-500 block text-[10px]">Nhà màng (Zones)</span>
                      <strong className="text-amber-700 font-bold">{farmZones.length} Khu</strong>
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
          <div className="p-6 bg-gradient-to-r from-slate-900 to-[#062326] text-white rounded-2xl shadow-md space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Building2 size={16} /> Trang trại Đang chọn (Level 1)
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedFarm.name}</h2>
                <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                  <MapPin size={13} className="text-emerald-400" /> {selectedFarm.address} • {(((selectedFarm.totalAreaM2 || selectedFarm.areaM2 || 0)) / 10000).toFixed(1)} ha
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800/80 hover:bg-slate-700" onClick={handleResetToFarms}>
                  <ArrowLeft size={14} className="mr-1" /> Về danh sách Trang trại
                </Button>
                <Button size="sm" onClick={() => setShowAddFieldModal(true)} className="bg-sky-600 hover:bg-sky-700 text-white">
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
                        <MapPin size={22} />
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
                      <span className="text-slate-500 block text-[10px]">Số Nhà màng lồng bên trong</span>
                      <strong className="text-amber-700 font-bold">{childZones.length} Zones</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInstallModalForField(field);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-2xs"
                      title="Gửi yêu cầu lắp đặt thiết bị cho Lô đất này"
                    >
                      <Wrench size={13} className="text-emerald-700" />
                      <span>Gửi yêu cầu thiết bị</span>
                    </button>
                    <span className="text-xs text-sky-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Mở Nhà màng ➔ <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Embedded Standardized CF3 Control Hub for Selected Farm */}
          <div className="pt-4">
            <CF3ControlSection
              scopeLevel="FARM"
              farmId={selectedFarm.farmId}
              title={`Điều khiển & Lịch tưới Vi khí hậu cho Trang trại "${selectedFarm.name}"`}
              subtitle="Cấu hình tham số, kích hoạt rơ-le chấp hành và lập lịch tưới định kỳ được gom nhóm theo toàn bộ Trang trại."
            />
          </div>
        </div>
      )}

      {/* VIEW LEVEL 3: ZONES IN SELECTED FIELD */}
      {selectedField && !selectedZone && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner for Selected Field */}
          <div className="p-6 bg-gradient-to-r from-sky-950 to-slate-900 text-white rounded-2xl shadow-md space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold">
                  <Building2 size={14} /> {selectedFarm?.name} ➔ <MapPin size={14} /> Lô đất Đang chọn (Level 2)
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedField.name}</h2>
                <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                  {selectedField.description} • {(selectedField.areaM2 / 10000).toFixed(1)} ha
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => openInstallModalForField(selectedField)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  <Wrench size={14} className="mr-1.5" /> Gửi yêu cầu lắp đặt thiết bị
                </Button>
                <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800/80 hover:bg-slate-700" onClick={() => setSelectedField(null)}>
                  <ArrowLeft size={14} className="mr-1" /> Trở lại Lô đất
                </Button>
                <Button size="sm" onClick={() => setShowAddZoneModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Plus size={14} className="mr-1" /> Thêm Nhà màng (Zone) Mới
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CornerDownRight size={18} className="text-amber-600" /> Các Khu vực Nhà màng (Level 3: Zones) lồng trong Lô đất
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {zones.filter(z => z.fieldId === selectedField.fieldId).length} Nhà màng tìm thấy
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
                    <span className="text-slate-500">Diện tích nhà màng:</span>
                    <strong className="text-slate-900">{zone.areaM2} m²</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInstallModalForZone(zone);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-2xs"
                    title="Gửi yêu cầu lắp đặt thiết bị cho Nhà màng này"
                  >
                    <Wrench size={13} className="text-emerald-700" />
                    <span>Gửi yêu cầu thiết bị</span>
                  </button>
                  <span className="text-xs text-amber-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Vi khí hậu & LoRa ➔ <ArrowUpRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Embedded Standardized CF3 Control Hub for Selected Field */}
          <div className="pt-4">
            <CF3ControlSection
              scopeLevel="FIELD"
              farmId={selectedFarm?.farmId}
              fieldId={selectedField.fieldId}
              title={`Điều khiển & Lịch tưới Vi khí hậu cho Lô đất "${selectedField.name}"`}
              subtitle="Cấu hình tham số, kích hoạt rơ-le chấp hành và lập lịch tưới định kỳ gom nhóm cho Phân khu Lô đất này."
            />
          </div>
        </div>
      )}

      {/* VIEW LEVEL 4: ZONE DETAILS */}
      {selectedZone && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 bg-gradient-to-r from-amber-950 via-slate-900 to-[#062326] text-white rounded-2xl shadow-md space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                  <Building2 size={13} /> {selectedFarm?.name} ➔ <MapPin size={13} /> {selectedField?.name} ➔ <Sprout size={13} /> Zone Chi tiết
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedZone.name}</h2>
                <p className="text-xs text-slate-300">{selectedZone.description} • {selectedZone.areaM2} m²</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => openInstallModalForZone(selectedZone)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  <Wrench size={14} className="mr-1.5" /> Gửi yêu cầu lắp đặt thiết bị
                </Button>
                <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800/80 hover:bg-slate-700" onClick={() => setSelectedZone(null)}>
                  <ArrowLeft size={14} className="mr-1" /> Trở lại danh sách Nhà màng
                </Button>
                <Button size="sm" onClick={() => navigate('/owner/monitoring/realtime')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                    <MapPin size={16} className="text-[#062326]" /> Vị trí GIS Map của Nhà màng này
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
                {nodes.filter(n => (n.zoneId === selectedZone.zoneId || n.zoneId === (selectedZone as any).id)).map(node => (
                  <div key={node.nodeId || node.deviceId || node.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Radio size={14} className="text-emerald-600" /> {node.name || node.hardwareAddress || 'Thiết bị IoT'}
                      </div>
                      <div className="text-[11px] text-slate-500">Mã: {node.nodeCode || node.hardwareAddress || node.deviceType || 'NODE'} • Pin: {node.batteryLevel ?? 92}%</div>
                    </div>
                    <StatusBadge status={node.status || 'ONLINE'} />
                  </div>
                ))}
              </div>

              {/* Thẻ Nhân viên Phân công phụ trách Zone */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <UserCheck size={16} className="text-[#062326]" /> Nhân viên phân công phụ trách Zone:
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                    Phân công trực tiếp
                  </span>
                </div>

                <div className="space-y-2">
                  <select
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#062326] shadow-xs cursor-pointer"
                    value={assignedEmployeeIdMap[selectedZone.zoneId] ?? ''}
                    onChange={e => handleAssignEmployee(selectedZone.zoneId, e.target.value)}
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
                                  Đã phân công
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
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline shrink-0 flex items-center gap-1 bg-white px-2 py-1 rounded border border-rose-200 shadow-2xs"
                            title="Bỏ phân công (Trở về Trống)"
                          >
                            <UserX size={12} /> Trống (Hủy)
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
                              Chưa phân công nhân viên quản lý Zone này. Chọn nhân viên từ danh sách ở trên.
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
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs flex justify-between items-center">
            <span>Diện tích còn trống của Trang trại:</span>
            <strong className="font-mono text-sm text-sky-800">{farmAvailableArea.toLocaleString()} m²</strong>
          </div>

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
            <label className="block text-slate-700 font-bold mb-1">Diện tích quy hoạch (m²) *</label>
            <Input
              type="number"
              value={newFieldArea}
              onChange={e => setNewFieldArea(e.target.value)}
              placeholder="VD: 5000"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Tối đa diện tích còn lại của Trang trại ({farmAvailableArea.toLocaleString()} m²).</span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Xác định Tọa độ GIS Lô đất (Lồng trong Farm)</label>
            <GISLocationPicker
              level="FIELD"
              center={fieldCenter}
              onCenterChange={setFieldCenter}
              polygon={fieldPolygon}
              onPolygonChange={setFieldPolygon}
              height="280px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)} disabled={isSubmittingField}>Hủy</Button>
            <Button onClick={handleAddFieldSubmit} disabled={isSubmittingField}>
              {isSubmittingField ? 'Đang lưu vào DB...' : 'Thêm Lô đất vào Farm'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Zone inside Selected Field */}
      <Modal isOpen={showAddZoneModal} title={`Thêm Nhà màng Mới vào Lô đất "${selectedField?.name || 'Field'}"`} onClose={() => setShowAddZoneModal(false)}>
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex justify-between items-center">
            <span>Diện tích còn trống trong Lô đất:</span>
            <strong className="font-mono text-sm text-amber-800">{fieldAvailableArea.toLocaleString()} m²</strong>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Nhà màng / Zone * (Tối thiểu 2 ký tự)</label>
            <Input
              value={newZoneName}
              onChange={e => setNewZoneName(e.target.value)}
              placeholder="Nhập tên Zone (vd: Nhà màng 05)"
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Diện tích quy hoạch Nhà màng (m²) *</label>
            <Input
              type="number"
              value={newZoneArea}
              onChange={e => setNewZoneArea(e.target.value)}
              placeholder="VD: 1000"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Tối đa diện tích còn lại của Lô đất ({fieldAvailableArea.toLocaleString()} m²).</span>
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
              onPolygonChange={setZonePolygon}
              parentFieldPolygon={currentFieldPolygon.length > 0 ? currentFieldPolygon : undefined}
              height="280px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddZoneModal(false)} disabled={isSubmittingZone}>Hủy</Button>
            <Button onClick={handleAddZoneSubmit} disabled={isSubmittingZone}>
              {isSubmittingZone ? 'Đang lưu vào DB...' : 'Thêm Zone vào Field'}
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
              <label className="block text-slate-700 font-bold mb-1">Khu vực Nhà màng (Zone) chỉ định lắp đặt:</label>
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
              <option value="SENSOR_LORA">📡 Trạm Cảm biến Vi khí hậu LoRaWAN (Nhiệt/Ẩm không khí, Ánh sáng, CO2)</option>
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
    </div>
  );
};
