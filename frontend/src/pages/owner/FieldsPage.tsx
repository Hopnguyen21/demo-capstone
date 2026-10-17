import React, { useState, useEffect } from 'react';
import { Field, Farm, Zone } from '../../types';
import { fieldService, farmService, zoneService, extractApiError } from '../../services';
import { MapPin, Plus, Building2, Sprout, ArrowUpRight, Layers } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { GISLocationPicker, extractPolygonPoints, toGeoJsonPolygon, calculatePolygonAreaM2, getPolygonCenter } from '../../components/maps/GISLocationPicker';
import { useNavigate } from 'react-router-dom';

export const FieldsPage: React.FC = () => {
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState('30000000-0000-0000-0000-000000000001');
  const [fieldName, setFieldName] = useState('');
  const [description, setDescription] = useState('');
  const [areaM2, setAreaM2] = useState('20000');
  const [center, setCenter] = useState<[number, number]>([11.9404, 108.4583]);
  const [polygon, setPolygon] = useState<[number, number][]>([
    [11.9415, 108.4565],
    [11.9415, 108.4595],
    [11.9395, 108.4595],
    [11.9395, 108.4565],
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [fdData, fData, zData] = await Promise.all([
        fieldService.getFields(),
        farmService.getFarms(),
        zoneService.getZones(),
      ]);
      if (Array.isArray(fdData)) setFields(fdData);
      if (Array.isArray(fData)) {
        setFarms(fData);
        if (fData.length > 0 && !selectedFarmId) setSelectedFarmId(fData[0].farmId);
      }
      if (Array.isArray(zData)) setZones(zData);
    } catch (err) {
      console.error('Failed to load fields data:', err);
    }
  };

  const handleCreateField = async () => {
    if (!fieldName.trim()) {
      alert('Vui lòng nhập tên Lô đất!');
      return;
    }
    if (fieldName.trim().length < 2) {
      alert('Tên Phân khu Lô đất phải có ít nhất 2 ký tự (theo quy chuẩn hệ thống)!');
      return;
    }
    const farmId = selectedFarmId || (farms.length > 0 ? farms[0].farmId : '');
    if (!farmId) {
      alert('Vui lòng chọn Trang trại Mẹ!');
      return;
    }
    const targetFarm = farms.find(f => f.farmId === farmId);
    const computedArea = Number(areaM2) || calculatePolygonAreaM2(polygon) || 5000;
    if (targetFarm) {
      const currentAllocated = fields
        .filter(f => f.farmId === farmId)
        .reduce((sum, f) => sum + (Number(f.areaM2) || 0), 0);
      const farmAvail = Math.max(0, (Number(targetFarm.totalAreaM2) || 25000) - currentAllocated);
      if (farmAvail <= 0) {
        alert(`Trang trại "${targetFarm.name}" đã hết diện tích trống (còn 0 m²). Không thể tạo thêm Lô đất mới!`);
        return;
      }
      if (computedArea > farmAvail) {
        alert(`Diện tích Lô đất (${computedArea.toLocaleString()} m²) vượt quá diện tích còn lại của Trang trại (${farmAvail.toLocaleString()} m²)!`);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const geoJson = toGeoJsonPolygon(polygon);
      await fieldService.createField(farmId, {
        name: fieldName.trim(),
        areaM2: computedArea,
        soilType: 'Loam',
        latitude: center[0],
        longitude: center[1],
        boundaryGeoJson: geoJson,
      });
      await loadData();
      setShowCreateModal(false);
      setFieldName('');
      setDescription('');
      alert('Đã lưu Lô đất mới cùng tọa độ GIS vào PostgreSQL thành công!');
    } catch (err: any) {
      console.error('Lỗi tạo Field:', err);
      const errorMsg = extractApiError(err) || err.response?.data?.detail || err.message;
      alert('Lỗi tạo Field: ' + errorMsg);
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
            <MapPin className="text-[#062326]" size={22} /> Phân khu Đất canh tác (Level 2: Fields)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Các phân khu lô đất lớn được quy hoạch lồng bên trong <strong>Trang trại Mẹ (Level 1: Farm)</strong> và chứa các <strong>Zone (Level 3: Zone)</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/owner/farms/create')}>
            <Layers size={16} className="mr-1.5" /> Luồng CF1 Toàn diện
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-1.5" /> Tạo Field Mới (GIS Map)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(field => {
          const farm = farms.find(f => f.farmId === field.farmId);
          const childZones = zones.filter(z => z.fieldId === field.fieldId);

          return (
            <div key={field.fieldId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4 hover:border-sky-500/40 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded border border-sky-200">LEVEL 2 FIELD</span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{field.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Building2 size={13} className="text-[#062326]" /> Thuộc: <strong className="text-slate-800">{farm?.name || 'Trang trại Đà Lạt'}</strong>
                  </p>
                </div>
                <StatusBadge status={field.status} />
              </div>

              <p className="text-xs text-slate-600 line-clamp-2">{field.description}</p>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Diện tích Phân khu</span>
                  <strong className="text-[#062326]">{(field.areaM2/10000).toFixed(1)} ha ({field.areaM2.toLocaleString()} m²)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Số Zone con</span>
                  <strong className="text-amber-700 font-bold">{childZones.length} Zones</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-xs gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigate('/owner/zones')}>
                  Xem Zones <ArrowUpRight size={13} className="ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal create Field with GIS Location Picker */}
      <Modal isOpen={showCreateModal} title="Khởi tạo Phân khu Lô đất Mới (Level 2 Field) bằng GIS Map" onClose={() => setShowCreateModal(false)}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Trang trại Mẹ sở hữu (Level 1 Farm) *</label>
            <select
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326]"
              value={selectedFarmId}
              onChange={e => setSelectedFarmId(e.target.value)}
            >
              {farms.map(f => (
                <option key={f.farmId} value={f.farmId}>{f.name} ({f.address})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Tên Phân khu / Lô đất *</label>
            <Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="Nhập tên Lô đất (vd: Lô C - Khu Dưa màng)" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mô tả đặc điểm Phân khu</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Nhập mô tả..." />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Xác định Tọa độ & Ranh giới GIS Lô đất</label>
            <GISLocationPicker
              level="FIELD"
              center={center}
              onCenterChange={setCenter}
              polygon={polygon}
              onPolygonChange={setPolygon}
              height="320px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>Hủy</Button>
            <Button onClick={handleCreateField} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu vào DB...' : 'Tạo Field & Lưu GIS'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
