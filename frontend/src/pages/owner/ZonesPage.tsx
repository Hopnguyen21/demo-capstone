import React, { useState, useEffect } from 'react';
import { Zone, Field, Farm, ZoneContract } from '../../types';
import { zoneService, fieldService, farmService, zoneContractService, extractApiError } from '../../services';
import { StatusBadge, Button, Modal, Input } from '../../components/ui/BaseUI';
import { Sprout, Plus, ArrowUpRight, Gauge, Building2, MapPin, Layers, Wrench, CheckCircle2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GISLocationPicker, extractPolygonPoints, toGeoJsonPolygon, calculatePolygonAreaM2, getPolygonCenter } from '../../components/maps/GISLocationPicker';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';
import { ZoneContractRenewModal } from '../../components/contracts/ZoneContractRenewModal';

export const ZonesPage: React.FC = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [contracts, setContracts] = useState<ZoneContract[]>([]);
  const [selectedContractForRenew, setSelectedContractForRenew] = useState<ZoneContract | null>(null);
  const [showRenewModal, setShowRenewModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState('31000000-0000-0000-0000-000000000001');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('32000000-0000-0000-0000-000000000001');
  const [activeTabMode, setActiveTabMode] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | null>(null);
  const [createdZoneSuccessData, setCreatedZoneSuccessData] = useState<{
    zoneName: string;
    areaM2: number;
    crop: string;
    fieldName: string;
    farmName: string;
    pointCount: number;
    zoneId?: string;
  } | null>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [zData, fdData, fData, contractsData] = await Promise.all([
        zoneService.getZones().catch(() => []),
        fieldService.getFields().catch(() => []),
        farmService.getFarms().catch(() => []),
        zoneContractService.getAllContracts().catch(() => []),
      ]);
      if (Array.isArray(zData)) {
        setZones(zData);
        if (zData.length > 0 && !selectedZoneId) setSelectedZoneId(zData[0].zoneId);
      }
      if (Array.isArray(fdData)) {
        setFields(fdData);
        if (fdData.length > 0 && !selectedFieldId) setSelectedFieldId(fdData[0].fieldId);
      }
      if (Array.isArray(fData)) setFarms(fData);
      if (Array.isArray(contractsData)) setContracts(contractsData);
    } catch (err) {
      console.error('Failed to load zones data:', err);
    }
  };

  const getZoneActiveContract = (zoneId: string): ZoneContract | undefined => {
    const list = contracts.filter(c => c.zoneId === zoneId);
    return list.find(c => c.status === 'Active' || c.status === 'ExpiringSoon' || (typeof c.status === 'number' && (c.status === 0 || c.status === 1)))
      || list[0];
  };

  const handleCreateZone = async () => {
    if (!zoneName.trim()) {
      alert('Vui lòng nhập tên Zone!');
      return;
    }
    if (zoneName.trim().length < 2) {
      alert('Tên Zone phải có ít nhất 2 ký tự (theo quy chuẩn hệ thống)!');
      return;
    }
    const fieldId = selectedFieldId || (fields.length > 0 ? fields[0].fieldId : '');
    if (!fieldId) {
      alert('Vui lòng chọn Lô đất (Field) Mẹ!');
      return;
    }
    const targetField = fields.find(f => f.fieldId === fieldId);
    const computedArea = calculatePolygonAreaM2(polygon) || 2000;
    if (targetField && targetField.availableAreaM2 !== undefined && targetField.availableAreaM2 !== null) {
      const avail = Number(targetField.availableAreaM2);
      if (avail <= 0) {
        alert(`Lô đất "${targetField.name}" đã hết diện tích trống (còn 0 m²). Không thể tạo thêm Zone mới!`);
        return;
      }
      if (computedArea > avail) {
        alert(`Diện tích Zone (${computedArea.toLocaleString()} m²) vượt quá diện tích còn trống của Lô đất (${avail.toLocaleString()} m²)!`);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const geoJson = toGeoJsonPolygon(polygon);
      const createdRes = await zoneService.createZone(fieldId, {
        name: zoneName.trim(),
        areaM2: computedArea,
        zoneType: 'Greenhouse',
        notes: `${crop || 'Rau màu'}${description ? ` - ${description}` : ''}`,
        polygonGeoJson: geoJson,
      });
      await loadData();
      setShowCreateModal(false);
      setCreatedZoneSuccessData({
        zoneName: zoneName.trim(),
        areaM2: computedArea,
        crop: crop || 'Rau màu VietGAP',
        fieldName: targetField?.name || 'Phân khu Lô đất',
        farmName: farms.find(f => f.farmId === targetField?.farmId)?.name || 'Trang trại',
        pointCount: polygon.length,
        zoneId: createdRes?.zoneId,
      });
      setZoneName('');
      setDescription('');
    } catch (err: any) {
      console.error('Lỗi tạo Zone:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi tạo Zone: ' + errorMsg);
    } finally {
      setIsSubmitting(false);
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
            <Sprout className="text-[#119653]" size={22} /> Quản lý & Cảnh báo Khu vực Canh tác (Level 3: Zones)
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
                    <span className="flex items-center gap-1"><Building2 size={12} className="text-[#119653]" /> {parentFarm?.name}</span>
                    <span>➔</span>
                    <span className="flex items-center gap-1 font-semibold text-sky-800"><MapPin size={12} /> {parentField?.name}</span>
                  </div>
                </div>
                <StatusBadge status={z.status} />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Cây trồng hiện tại:</span>
                  <strong className="text-[#119653]">
                    {z.currentCrop || (z.name?.toLowerCase().includes('dua leo') ? 'Dưa leo Baby (Cucumber)' : z.name?.toLowerCase().includes('xa lach') ? 'Xà lách cuộn (Batavia)' : z.name?.toLowerCase().includes('dau tay') ? 'Dâu tây Hana' : 'Dưa leo Baby VietGAP')}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Giai đoạn sinh trưởng:</span>
                  <strong className="text-sky-700">
                    {z.currentStage || (z.name?.toLowerCase().includes('xa lach') ? 'Phát triển búp cuộn' : 'Nuôi trái & Thu hoạch')}
                  </strong>
                </div>
                <div className="flex justify-between"><span>Diện tích Zone:</span><strong className="text-slate-900">{z.areaM2} m²</strong></div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs gap-2 flex-wrap">
                {(() => {
                  const zContract = getZoneActiveContract(z.zoneId);
                  if (zContract) {
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContractForRenew(zContract);
                          setShowRenewModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
                        title={`Zone đã có Hợp đồng #${zContract.contractNumber} - Nhấn để Tái kí hợp đồng`}
                      >
                        <RefreshCw size={13} className="text-indigo-700" />
                        <span>Tái kí hợp đồng</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/owner/support');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                      title="Gửi yêu cầu lắp đặt thiết bị cho Zone này"
                    >
                      <Wrench size={13} className="text-emerald-700" />
                      <span>Yêu cầu lắp đặt</span>
                    </button>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedZoneId(z.zoneId);
                      setActiveTabMode('ALERTS');
                    }}
                    className="text-rose-700 font-bold hover:underline"
                  >
                    🚨 Cảnh báo Zone
                  </button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate('/owner/monitoring/realtime'); }}>
                    Realtime <ArrowUpRight size={13} className="ml-1" />
                  </Button>
                </div>
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
          title={`Trung tâm Cảnh báo & Điều khiển Vi khí hậu cho [${zones.find((z: any) => z.zoneId === selectedZoneId)?.name || 'Zone'}]`}
          subtitle="Tích hợp cảnh báo an toàn thời gian thực, dải tham số vi khí hậu, kích hoạt rơ-le và lịch tưới tự động."
        />
      </div>

      {/* Modal create Zone with GIS map picker */}
      <Modal isOpen={showCreateModal} title="Khởi tạo Khu vực Canh tác Mới (Level 3 Zone) bằng GIS Map" onClose={() => setShowCreateModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Chọn Lô đất Mẹ sở hữu (Level 2 Field) *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500"
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
            <label className="block text-slate-700 font-bold mb-1">Tên Zone *</label>
            <Input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Ví dụ: Zone 05 - Dưa lưới Nhật Bản" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Loại Cây trồng</label>
              <Input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Cà chua, Ớt ngọt, Dưa leo..." />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Mô tả Zone</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ví dụ: Zone khép kín 3000 m²" />
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
              parentFieldPolygon={(() => {
                const currentField = fields.find(f => f.fieldId === selectedFieldId);
                return extractPolygonPoints(currentField?.boundary || (currentField as any)?.boundaryGeoJson);
              })()}
              height="320px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>Hủy</Button>
            <Button onClick={handleCreateZone} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu vào DB...' : 'Tạo Zone & Lưu GIS'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Giao diện Hoàn thành Tạo Zone (Thay thế Alert) */}
      <Modal
        isOpen={!!createdZoneSuccessData}
        onClose={() => setCreatedZoneSuccessData(null)}
        title="Thông Báo Hoàn Tất Thiết Lập"
      >
        {createdZoneSuccessData && (
          <div className="text-center py-2 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Success Icon with glowing badge */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 size={44} strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Khởi tạo thành công
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                Đã Lưu Phân Khu (Zone) Vào Hệ Thống!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Zone mới đã được lưu thành công cùng dữ liệu tọa độ GIS vào cơ sở dữ liệu PostgreSQL.
              </p>
            </div>

            {/* Zone summary card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Sprout size={15} className="text-emerald-600" /> Tên Phân khu (Zone):
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {createdZoneSuccessData.zoneName}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building2 size={15} className="text-sky-600" /> Thuộc Lô đất:
                </span>
                <span className="font-semibold text-sky-800">
                  {createdZoneSuccessData.fieldName} ({createdZoneSuccessData.farmName})
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Layers size={15} className="text-amber-600" /> Diện tích quy hoạch:
                </span>
                <span className="font-bold font-mono text-emerald-700">
                  {createdZoneSuccessData.areaM2.toLocaleString()} m² ({(createdZoneSuccessData.areaM2 / 10000).toFixed(2)} ha)
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1.5">
                  🌱 Cây trồng canh tác:
                </span>
                <span className="font-semibold text-slate-800">
                  {createdZoneSuccessData.crop}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <MapPin size={15} className="text-teal-600" /> Tọa độ GIS:
                </span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                  ✓ Đã đồng bộ Polygon GIS ({createdZoneSuccessData.pointCount} đỉnh)
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreatedZoneSuccessData(null)}
                className="w-full sm:w-auto font-medium"
              >
                Đóng
              </Button>
              <Button
                onClick={() => {
                  if (createdZoneSuccessData.zoneId) {
                    setSelectedZoneId(createdZoneSuccessData.zoneId);
                  }
                  setCreatedZoneSuccessData(null);
                }}
                className="w-full sm:w-auto bg-[#119653] hover:bg-[#0e8046] text-white font-bold shadow-md shadow-emerald-500/20"
              >
                <span>Xem Chi Tiết Zone Vừa Tạo ➔</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Tái kí Hợp đồng cho Zone */}
      <ZoneContractRenewModal
        isOpen={showRenewModal}
        onClose={() => {
          setShowRenewModal(false);
          setSelectedContractForRenew(null);
        }}
        contract={selectedContractForRenew}
        onSuccess={(updated) => {
          setContracts(prev => prev.map(c => c.id === updated.id ? updated : c));
          setShowRenewModal(false);
          setSelectedContractForRenew(null);
          alert(`🎉 Đã gia hạn / tái ký hợp đồng #${updated.contractNumber} thành công! Thời hạn mới: ${updated.endDate}`);
        }}
      />
    </div>
  );
};
