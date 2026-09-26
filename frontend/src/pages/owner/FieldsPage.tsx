import React, { useState } from 'react';
import { mockFields, mockFarms, mockZones } from '../../mocks/mockData';
import { MapPin, Plus, Building2, Sprout, ArrowUpRight, Layers } from 'lucide-react';
import { Button, StatusBadge, Modal, Input } from '../../components/ui/BaseUI';
import { GISLocationPicker } from '../../components/maps/GISLocationPicker';
import { useNavigate } from 'react-router-dom';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';

export const FieldsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState('farm-01');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-[#062326]" size={22} /> Phân khu Đất canh tác (Level 2: Fields)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Các phân khu lô đất lớn được quy hoạch lồng bên trong <strong>Trang trại Mẹ (Level 1: Farm)</strong> và chứa các <strong>Nhà màng (Level 3: Zone)</strong>.
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
        {mockFields.map(field => {
          const farm = mockFarms.find(f => f.farmId === field.farmId);
          const childZones = mockZones.filter(z => z.fieldId === field.fieldId);

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
                  <span className="text-slate-500 block text-[10px]">Số Nhà màng con</span>
                  <strong className="text-amber-700 font-bold">{childZones.length} Zones</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1"><Sprout size={13} className="text-amber-600" /> Cấp 3: {childZones.map(z => z.name).join(', ')}</span>
                <Button size="sm" variant="ghost" onClick={() => navigate('/owner/zones')}>
                  Xem Zones <ArrowUpRight size={13} className="ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Standardized CF3 Control Hub for Fields */}
      <div className="pt-4">
        <CF3ControlSection
          scopeLevel="FIELD"
          title="Điều khiển & Lịch tưới Vi khí hậu cho Phân khu Lô đất (Field Control)"
          subtitle="Quản lý dải chỉ số môi trường, cài đặt lịch tưới Cron và kích hoạt thiết bị rơ-le cho các Lô đất."
        />
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
              {mockFarms.map(f => (
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
              parentFarmPolygon={mockFarms[0].boundary?.coordinates[0].map(c => [c[1], c[0]]) as [number, number][]}
              height="320px"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
            <Button onClick={() => {
              alert('Tạo Lô đất thành công!');
              setShowCreateModal(false);
            }}>Tạo Field & Lưu GIS</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
