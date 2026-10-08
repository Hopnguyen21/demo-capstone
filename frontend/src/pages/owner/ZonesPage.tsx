import React, { useState, useEffect } from 'react';
import { Zone, Field, Farm } from '../../types';
import { zoneService, fieldService, farmService } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { Sprout, Plus, ArrowUpRight, Gauge, Building2, MapPin, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GISLocationPicker } from '../../components/maps/GISLocationPicker';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const ZonesPage: React.FC = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState('31000000-0000-0000-0000-000000000001');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('32000000-0000-0000-0000-000000000001');
  const [activeTabMode, setActiveTabMode] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | 'SAFETY' | 'LOGS'>('ALERTS');
  const [zoneName, setZoneName] = useState('');
  const [description, setDescription] = useState('');
  const [crop, setCrop] = useState('Cà chua (Tomato)');
  const [center, setCenter] = useState<[number, number]>([11.9408, 108.4582]);
  const [polygon, setPolygon] = useState<[number, number][]>([
    [11.9412, 108.4572],
    [11.9412, 108.4588],
    [11.9402, 108.4588],
    [11.9402, 108.4572],
  ]);

  const loadData = async () => {
    try {
      const [zData, fdData, fData] = await Promise.all([
        zoneService.getZones(),
        fieldService.getFields(),
        farmService.getFarms(),
      ]);
      if (Array.isArray(zData)) {
        setZones(zData);
        if (zData.length > 0) setSelectedZoneId(zData[0].zoneId);
      }
      if (Array.isArray(fdData)) {
        setFields(fdData);
        if (fdData.length > 0) setSelectedFieldId(fdData[0].fieldId);
      }
      if (Array.isArray(fData)) setFarms(fData);
    } catch (err) {
      console.error('Failed to load zones data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="text-[#062326]" size={22} /> Quản lý & Cảnh báo Nhà màng / Khu vực Canh tác (Level 3: Zones)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Các Zone khép kín lồng bên trong <strong>Phân khu Lô đất (Level 2: Field)</strong> thuộc <strong>Trang trại (Level 1: Farm)</strong> được tích hợp Trung tâm Cảnh báo Nông nghiệp thời gian thực.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/owner/farms/create')}>
            <Layers size={16} className="mr-1.5" /> Luồng CF1 Wizard
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-1.5" /> Tạo Zone Mới (GIS Map)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.map(z => {
          const parentField = fields.find(f => f.fieldId === z.fieldId);
          const parentFarm = farms.find(f => f.farmId === z.farmId);
          const isSelected = selectedZoneId === z.zoneId;

          return (
            <div
              key={z.zoneId}
              onClick={() => setSelectedZoneId(z.zoneId)}
              className={`p-5 bg-white border rounded-2xl space-y-4 shadow-xs transition-all cursor-pointer ${
                isSelected ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-200">LEVEL 3 ZONE</span>
                    {z.zoneId === 'zone-01' ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-300 animate-pulse">
                        ⚠️ 1 Cảnh báo Mở
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        ✓ An toàn
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{z.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Building2 size={12} className="text-[#062326]" /> {parentFarm?.name}</span>
                    <span>➔</span>
                    <span className="flex items-center gap-1 font-semibold text-sky-800"><MapPin size={12} /> {parentField?.name}</span>
                  </div>
                </div>
                <StatusBadge status={z.status} />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1 text-slate-700">
                <div className="flex justify-between"><span>Cây trồng hiện tại:</span><strong className="text-[#062326]">{z.currentCrop}</strong></div>
                <div className="flex justify-between"><span>Giai đoạn sinh trưởng:</span><strong className="text-sky-700">{z.currentStage}</strong></div>
                <div className="flex justify-between"><span>Diện tích Nhà màng:</span><strong className="text-slate-900">{z.areaM2} m²</strong></div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(z.zoneId);
                    setActiveTabMode('ALERTS');
                  }}
                  className="text-rose-700 font-bold hover:underline"
                >
                  🚨 Trung tâm Cảnh báo Zone ➔
                </button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate('/owner/monitoring/realtime'); }}>
                  Vi khí hậu Realtime <ArrowUpRight size={13} className="ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Standardized CF3 Control Hub for Zones with Alert Center */}
      <div className="pt-4">
        <CF3ControlSection
          key={`${selectedZoneId}-${activeTabMode}`}
          scopeLevel="ZONE"
          zoneId={selectedZoneId}
          defaultTab={activeTabMode}
          title={`Trung tâm Cảnh báo & Điều khiển Vi khí hậu cho [${zones.find((z: any) => z.zoneId === selectedZoneId)?.name || 'Nhà màng'}]`}
          subtitle="Tích hợp cảnh báo an toàn thời gian thực, dải tham số vi khí hậu, kích hoạt rơ-le và lịch tưới tự động."
        />
      </div>

      {/* Modal create Zone with GIS map picker */}
      <Modal isOpen={showCreateModal} title="Khởi tạo Khu vực Nhà màng Mới (Level 3 Zone) bằng GIS Map" onClose={() => setShowCreateModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Lô đất Mẹ sở hữu (Level 2 Field) *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326]"
              value={selectedFieldId}
              onChange={e => setSelectedFieldId(e.target.value)}
            >
              {fields.map(fd => {
                const farm = farms.find(fm => fm.farmId === fd.farmId);
                return (
                  <option key={fd.fieldId} value={fd.fieldId}>
                    [{farm?.name}] ➔ {fd.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Nhà màng / Zone *</label>
            <Input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Ví dụ: Nhà màng 05 - Dưa lưới Nhật Bản" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Loại Cây trồng</label>
              <Input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Cà chua, Ớt ngọt, Dưa leo..." />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Mô tả Nhà màng</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ví dụ: Nhà màng khép kín 3000 m²" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">GIS Map Vị trí & Ranh giới Zone (Lồng trong Field & Farm)</label>
            <GISLocationPicker
              level="ZONE"
              center={center}
              onCenterChange={setCenter}
              polygon={polygon}
              onPolygonChange={setPolygon}
              parentFarmPolygon={farms[0]?.boundary?.coordinates[0]?.map(c => [c[1], c[0]]) as [number, number][]}
              parentFieldPolygon={[
                [11.9415, 108.4565],
                [11.9415, 108.4595],
                [11.9395, 108.4595],
                [11.9395, 108.4565],
              ]}
              height="320px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
            <Button onClick={() => {
              alert('Tạo Zone nhà màng thành công!');
              setShowCreateModal(false);
            }}>Tạo Zone & Lưu GIS</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
