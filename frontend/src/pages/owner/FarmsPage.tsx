import React, { useState } from 'react';
import { mockFarms, mockFields, mockZones, mockNodes, mockSensors } from '../../mocks/mockData';
import { Farm, Field, Zone } from '../../types';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import {
  Building2, MapPin, Layers, Plus, ArrowUpRight, ChevronRight, Sprout,
  CornerDownRight, Home, ArrowLeft, Cpu, Activity, Gauge, Sliders, Calendar,
  Radio, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GISLocationPicker } from '../../components/maps/GISLocationPicker';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FarmsPage: React.FC = () => {
  const navigate = useNavigate();

  // Drill-down State Hierarchy: Farm ➔ Field ➔ Zone
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  // Modals for adding Field or Zone directly within current level
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);

  // Form states for quick creation
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldArea, setNewFieldArea] = useState('15000');
  const [fieldCenter, setFieldCenter] = useState<[number, number]>([11.9405, 108.4580]);
  const [fieldPolygon, setFieldPolygon] = useState<[number, number][]>([
    [11.9415, 108.4565],
    [11.9415, 108.4595],
    [11.9395, 108.4595],
    [11.9395, 108.4565],
  ]);

  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCrop, setNewZoneCrop] = useState('Cà chua (Tomato)');
  const [zoneCenter, setZoneCenter] = useState<[number, number]>([11.9408, 108.4582]);
  const [zonePolygon, setZonePolygon] = useState<[number, number][]>([
    [11.9412, 108.4572],
    [11.9412, 108.4588],
    [11.9402, 108.4588],
    [11.9402, 108.4572],
  ]);

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
  };

  const handleSelectField = (field: Field) => {
    setSelectedField(field);
    setSelectedZone(null);
  };

  const handleSelectZone = (zone: Zone) => {
    setSelectedZone(zone);
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
            {mockFarms.map(farm => {
              const farmFields = mockFields.filter(fd => fd.farmId === farm.farmId);
              const farmZones = mockZones.filter(z => z.farmId === farm.farmId);

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
                      <strong className="text-slate-900">{(farm.areaM2 / 10000).toFixed(1)} ha</strong>
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
                  <MapPin size={13} className="text-emerald-400" /> {selectedFarm.address} • {(selectedFarm.areaM2 / 10000).toFixed(1)} ha
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
              {mockFields.filter(f => f.farmId === selectedFarm.farmId).length} Lô đất tìm thấy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockFields.filter(f => f.farmId === selectedFarm.farmId).map(field => {
              const childZones = mockZones.filter(z => z.fieldId === field.fieldId);

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
                    <StatusBadge status={field.status} />
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

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-sky-700 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Mở danh sách Nhà màng (Zones) trong Lô đất này ➔</span>
                    <ArrowUpRight size={16} />
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

              <div className="flex items-center gap-2">
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
              {mockZones.filter(z => z.fieldId === selectedField.fieldId).length} Nhà màng tìm thấy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockZones.filter(z => z.fieldId === selectedField.fieldId).map(zone => (
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
                  <StatusBadge status={zone.status} />
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

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-amber-700 font-bold group-hover:translate-x-1 transition-transform">
                  <span>Chi tiết Vi khí hậu & Cảm biến LoRa ➔</span>
                  <ArrowUpRight size={16} />
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

              <div className="flex items-center gap-2">
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
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <MapPin size={16} className="text-[#062326]" /> Vị trí GIS Map của Nhà màng này
              </h4>
              <GISLocationPicker
                level="ZONE"
                center={[11.9408, 108.4582]}
                onCenterChange={() => { }}
                polygon={[
                  [11.9412, 108.4572],
                  [11.9412, 108.4588],
                  [11.9402, 108.4588],
                  [11.9402, 108.4572],
                ]}
                onPolygonChange={() => { }}
                parentFarmPolygon={selectedFarm?.boundary?.coordinates[0].map(c => [c[1], c[0]]) as [number, number][]}
                height="280px"
                readOnly={true}
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
                {mockNodes.filter(n => n.zoneId === selectedZone.zoneId).map(node => (
                  <div key={node.nodeId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Radio size={14} className="text-emerald-600" /> {node.name}
                      </div>
                      <div className="text-[11px] text-slate-500">Mã Node: {node.nodeCode} • Pin: {node.batteryLevel}%</div>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>
                ))}
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
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Phân khu Lô đất mới *</label>
            <Input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Nhập tên Lô đất (vd: Lô C - Dưa màng)" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Diện tính quy hoạch (m²)</label>
            <Input value={newFieldArea} onChange={e => setNewFieldArea(e.target.value)} />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Xác định Tọa độ GIS Lô đất (Lồng trong Farm)</label>
            <GISLocationPicker
              level="FIELD"
              center={fieldCenter}
              onCenterChange={setFieldCenter}
              polygon={fieldPolygon}
              onPolygonChange={setFieldPolygon}
              parentFarmPolygon={selectedFarm?.boundary?.coordinates[0].map(c => [c[1], c[0]]) as [number, number][]}
              height="280px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)}>Hủy</Button>
            <Button onClick={() => {
              alert('Thêm Lô đất mới thành công!');
              setShowAddFieldModal(false);
            }}>Thêm Lô đất vào Farm</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Add Zone inside Selected Field */}
      <Modal isOpen={showAddZoneModal} title={`Thêm Nhà màng Mới vào Lô đất "${selectedField?.name || 'Field'}"`} onClose={() => setShowAddZoneModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Nhà màng / Zone *</label>
            <Input value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Nhập tên Zone (vd: Nhà màng 05)" />
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
              parentFarmPolygon={selectedFarm?.boundary?.coordinates[0].map(c => [c[1], c[0]]) as [number, number][]}
              parentFieldPolygon={fieldPolygon}
              height="280px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowAddZoneModal(false)}>Hủy</Button>
            <Button onClick={() => {
              alert('Thêm Nhà màng mới thành công!');
              setShowAddZoneModal(false);
            }}>Thêm Zone vào Field</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
