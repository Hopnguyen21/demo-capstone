import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Layers, Cpu, Building2,
  GitBranch, Check, Plus, Trash2, ArrowDown, ChevronRight, CornerDownRight,
  UserCheck, Wrench, ShieldCheck, Calendar, Info, Send
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { GISLocationPicker } from '../../components/maps/GISLocationPicker';

export const CreateFarmWizard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'FARM' | 'FIELD' | 'ZONE' | 'CROP_SEASON' | 'REVIEW'>('FARM');

  // Form State for Farm Level (Level 1)
  const [farmData, setFarmData] = useState({
    name: 'Trang trại Nông nghiệp Công nghệ cao Đà Lạt 02',
    address: 'Phường 12, TP. Đà Lạt, Lâm Đồng',
    areaM2: '35000',
    description: 'Nông trang trồng thực nghiệm rau củ quả theo tiêu chuẩn GlobalGAP tích hợp LoRa IoT.',
    center: [11.9404, 108.4583] as [number, number],
    polygon: [
      [11.942, 108.456],
      [11.942, 108.460],
      [11.938, 108.460],
      [11.938, 108.456],
    ] as [number, number][],
  });

  // Form State for Field Level (Level 2)
  const [fieldData, setFieldData] = useState({
    name: 'Lô đất A1 - Phân khu Cà chua & Dưa',
    description: 'Phân khu A1 trang bị nhà kính mái đôi thông minh',
    areaM2: '18000',
    center: [11.9405, 108.4580] as [number, number],
    polygon: [
      [11.9415, 108.4565],
      [11.9415, 108.4595],
      [11.9395, 108.4595],
      [11.9395, 108.4565],
    ] as [number, number][],
  });

  // Form State for Zone Level (Level 3)
  const [zoneData, setZoneData] = useState({
    name: 'Nhà màng Z01 - Cà chua Beefsteak',
    description: 'Nhà màng khép kín điều hòa vi khí hậu bằng quạt thông gió & tưới nhỏ giọt',
    areaM2: '4500',
    center: [11.9408, 108.4582] as [number, number],
    polygon: [
      [11.9412, 108.4572],
      [11.9412, 108.4588],
      [11.9402, 108.4588],
      [11.9402, 108.4572],
    ] as [number, number][],
  });

  // Crop & Planting Season Data (Level 4)
  const [cropData, setCropData] = useState({
    crop: 'Cà chua (Solanum lycopersicum)',
    variety: 'Beefsteak Đà Lạt F1',
    seasonName: 'Vụ Cà chua Đông Xuân 2026-2027',
    startDate: '2026-10-01',
    expectedHarvestDate: '2027-01-15',
    gatewaysNeeded: 1,
    nodesNeeded: 4,
    actuatorsNeeded: 4,
  });

  const levelTabs = [
    { id: 'FARM', label: '1. Tạo Trang trại', sub: 'Tên, địa chỉ & ranh giới GIS Trang trại', icon: Building2 },
    { id: 'FIELD', label: '2. Phân khu Lô đất', sub: 'Tạo Lô đất lồng trong Trang trại', icon: MapPin },
    { id: 'ZONE', label: '3. Khu vực Nhà màng', sub: 'Tạo Nhà màng lồng trong Lô đất', icon: Sprout },
    { id: 'CROP_SEASON', label: '4. Cây trồng & Vụ mùa', sub: 'Chọn giống & thiết lập vụ mùa', icon: Calendar },
    { id: 'REVIEW', label: '5. Hoàn tất & Gửi IoT', sub: 'Xác nhận & chuyển Kỹ thuật viên', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Visual Workflow Layer Indicator (Flowchart Header aligned with Diagram CF1) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-[#062326] text-xs font-semibold mb-1 border border-emerald-200">
              <UserCheck size={14} className="text-emerald-700" /> Vai trò: Chủ Trang trại (Farm Owner / Tenant)
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Quy trình Khởi tạo Phân cấp Nông trang
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Thiết lập cấu trúc GIS Nông trang theo luồng chuẩn: Trang trại ➔ Lô đất ➔ Nhà màng ➔ Cây trồng ➔ Gửi yêu cầu Cấp phát Thiết bị IoT.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold">
              Farm
            </span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 font-semibold">
              Field
            </span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
              Zone
            </span>
          </div>
        </div>

        {/* Workflow Progression Diagram Bar (3 Actors: Owner -> Tech -> System) */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg flex items-center gap-2.5 text-emerald-950">
            <div className="p-2 bg-emerald-700 text-white rounded-lg shrink-0">
              <UserCheck size={16} />
            </div>
            <div>
              <div className="font-bold text-[11px] uppercase text-emerald-800">1. Farm Owner (Bạn)</div>
              <div className="text-[10px] text-emerald-900">Khởi tạo Trang trại, Lô đất, Nhà màng & Vụ mùa</div>
            </div>
          </div>

          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg flex items-center gap-2.5 text-sky-950 opacity-80">
            <div className="p-2 bg-sky-700 text-white rounded-lg shrink-0">
              <Wrench size={16} />
            </div>
            <div>
              <div className="font-bold text-[11px] uppercase text-sky-800">2. Kỹ thuật viên IoT</div>
              <div className="text-[10px] text-sky-900">Cấp phát Gateway, Node, Cảm biến & Ánh xạ Zone</div>
            </div>
          </div>

          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2.5 text-slate-800 opacity-80">
            <div className="p-2 bg-slate-700 text-white rounded-lg shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="font-bold text-[11px] uppercase text-slate-700">3. Hệ thống Platform</div>
              <div className="text-[10px] text-slate-600">Lưu cấu hình & Kích hoạt Giám sát Vi khí hậu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {levelTabs.map((tb, idx) => {
          const Icon = tb.icon;
          const isActive = activeTab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setActiveTab(tb.id as any)}
              className={`p-3 text-left rounded-xl border transition-all ${isActive
                  ? 'bg-[#062326] text-white border-[#062326] shadow-md ring-2 ring-[#062326]/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-[#062326]'} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  Bước {idx + 1}
                </span>
              </div>
              <div className="font-bold text-xs truncate">{tb.label}</div>
              <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>{tb.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        {/* STEP 1: FARM LEVEL */}
        {activeTab === 'FARM' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={20} className="text-[#062326]" /> Bước 1: Thông tin & GIS Map Ranh giới Trang trại (Farm)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">Xác định tên, địa chỉ và vẽ ranh giới quy hoạch tổng thể của Trang trại lớn.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                Bước 1 / 5
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên Trang trại *</label>
                  <Input value={farmData.name} onChange={e => setFarmData({ ...farmData, name: e.target.value })} placeholder="Nhập tên trang trại..." />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Địa chỉ chi tiết *</label>
                  <Input value={farmData.address} onChange={e => setFarmData({ ...farmData, address: e.target.value })} placeholder="Tỉnh/Thành, Quận/Huyện, Xã/Phường..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Tọa độ Vĩ độ (Lat)</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={farmData.center[0]}
                      onChange={e => setFarmData({ ...farmData, center: [parseFloat(e.target.value) || 0, farmData.center[1]] })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Tọa độ Kinh độ (Lng)</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={farmData.center[1]}
                      onChange={e => setFarmData({ ...farmData, center: [farmData.center[0], parseFloat(e.target.value) || 0] })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Diện tích quy hoạch ước tính (m²)</label>
                  <Input value={farmData.areaM2} onChange={e => setFarmData({ ...farmData, areaM2: e.target.value })} />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mô tả Trang trại</label>
                  <textarea
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] text-xs shadow-xs"
                    value={farmData.description}
                    onChange={e => setFarmData({ ...farmData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* GIS Map Picker for Farm */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">Bản đồ GIS Ranh giới Trang trại (Vẽ ranh giới lớn nhất)</label>
                <GISLocationPicker
                  level="FARM"
                  center={farmData.center}
                  onCenterChange={c => setFarmData({ ...farmData, center: c })}
                  polygon={farmData.polygon}
                  onPolygonChange={p => setFarmData({ ...farmData, polygon: p })}
                  height="360px"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FIELD LEVEL */}
        {activeTab === 'FIELD' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin size={20} className="text-[#062326]" /> Bước 2: Phân khu Lô đất (Field) lồng trong Trang trại
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Lô đất thuộc về Trang trại mẹ <strong className="text-[#062326]">"{farmData.name}"</strong>. Vẽ ranh giới Lô đất nằm bên trong Trang trại.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-800 rounded-full border border-sky-200">
                Bước 2 / 5
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-[#062326]/5 border border-[#062326]/20 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">Trang trại Mẹ sở hữu:</span>
                  <strong className="text-[#062326] font-bold text-sm flex items-center gap-1.5 mt-0.5">
                    <Building2 size={15} /> {farmData.name}
                  </strong>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên Phân khu / Lô đất *</label>
                  <Input value={fieldData.name} onChange={e => setFieldData({ ...fieldData, name: e.target.value })} placeholder="Ví dụ: Lô A1 - Phân khu Cà chua" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mô tả đặc điểm Lô đất</label>
                  <Input value={fieldData.description} onChange={e => setFieldData({ ...fieldData, description: e.target.value })} placeholder="Ví dụ: Phân khu trồng rau ăn quả..." />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Diện tích Lô đất (m²)</label>
                  <Input value={fieldData.areaM2} onChange={e => setFieldData({ ...fieldData, areaM2: e.target.value })} />
                </div>

                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs flex items-start gap-2">
                  <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Hướng dẫn GIS:</strong> Ranh giới Trang trại Mẹ hiển thị đường nét đứt màu đen trên bản đồ. Hãy vẽ ranh giới Lô đất nằm gọn bên trong Trang trại.
                  </div>
                </div>
              </div>

              {/* GIS Map Picker for Field (Parent Farm Polygon shown in background) */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">GIS Map Ranh giới Lô đất (Lồng trong Ranh giới Trang trại)</label>
                <GISLocationPicker
                  level="FIELD"
                  center={fieldData.center}
                  onCenterChange={c => setFieldData({ ...fieldData, center: c })}
                  polygon={fieldData.polygon}
                  onPolygonChange={p => setFieldData({ ...fieldData, polygon: p })}
                  parentFarmPolygon={farmData.polygon}
                  height="360px"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ZONE LEVEL */}
        {activeTab === 'ZONE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sprout size={20} className="text-[#062326]" /> Bước 3: Khu vực Nhà màng (Zone) lồng trong Lô đất
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nhà màng / Khu vực tưới thuộc Lô đất <strong className="text-[#062326]">"{fieldData.name}"</strong> thuộc Trang trại <strong className="text-[#062326]">"{farmData.name}"</strong>.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                Bước 3 / 5
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Trang trại Mẹ:</span>
                    <strong className="text-slate-900">{farmData.name}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 border-t border-slate-200 pt-1">
                    <span>Lô đất Mẹ:</span>
                    <strong className="text-[#062326]">{fieldData.name}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên Nhà màng / Khu vực Canh tác *</label>
                  <Input value={zoneData.name} onChange={e => setZoneData({ ...zoneData, name: e.target.value })} placeholder="Ví dụ: Nhà màng Z01" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mô tả Đặc tính Nhà màng</label>
                  <Input value={zoneData.description} onChange={e => setZoneData({ ...zoneData, description: e.target.value })} placeholder="Ví dụ: Nhà màng khép kín trang bị tưới nhỏ giọt" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Diện tích Nhà màng (m²)</label>
                  <Input value={zoneData.areaM2} onChange={e => setZoneData({ ...zoneData, areaM2: e.target.value })} />
                </div>
              </div>

              {/* GIS Map Picker for Zone (Parent Farm & Parent Field shown) */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">GIS Map Vị trí Nhà màng (Lồng trong Lô đất & Trang trại)</label>
                <GISLocationPicker
                  level="ZONE"
                  center={zoneData.center}
                  onCenterChange={c => setZoneData({ ...zoneData, center: c })}
                  polygon={zoneData.polygon}
                  onPolygonChange={p => setZoneData({ ...zoneData, polygon: p })}
                  parentFarmPolygon={farmData.polygon}
                  parentFieldPolygon={fieldData.polygon}
                  height="360px"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CROP & SEASON LEVEL */}
        {activeTab === 'CROP_SEASON' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={20} className="text-[#062326]" /> Bước 4: Thiết lập Cây trồng & Vụ mùa đầu tiên
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">Chọn giống cây canh tác và thiết lập lịch vụ mùa cho Nhà màng <strong className="text-[#062326]">"{zoneData.name}"</strong>.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                Bước 4 / 5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-4">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                  <Sprout size={16} className="text-[#062326]" /> Chọn Cây trồng & Giống cây (Configure Crop)
                </h4>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Loài Cây trồng *</label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs"
                    value={cropData.crop}
                    onChange={e => setCropData({ ...cropData, crop: e.target.value })}
                  >
                    <option>Cà chua (Solanum lycopersicum)</option>
                    <option>Ớt ngọt (Capsicum annuum)</option>
                    <option>Dưa leo (Cucumis sativus)</option>
                    <option>Xà lách Thủy canh (Lactuca sativa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Giống thương mại / Variety *</label>
                  <Input value={cropData.variety} onChange={e => setCropData({ ...cropData, variety: e.target.value })} placeholder="Ví dụ: Beefsteak Đà Lạt F1" />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tên Vụ mùa khởi tạo *</label>
                  <Input value={cropData.seasonName} onChange={e => setCropData({ ...cropData, seasonName: e.target.value })} placeholder="Ví dụ: Vụ Cà chua Đông Xuân 2026-2027" />
                </div>
              </div>

              <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-4">
                <h4 className="font-bold text-sky-950 flex items-center gap-1.5 text-sm">
                  <Calendar size={16} className="text-sky-700" /> Thiết lập Lịch Vụ mùa (Configure Planting Season)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Ngày bắt đầu xuống giống</label>
                    <Input type="date" value={cropData.startDate} onChange={e => setCropData({ ...cropData, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Dự kiến thu hoạch</label>
                    <Input type="date" value={cropData.expectedHarvestDate} onChange={e => setCropData({ ...cropData, expectedHarvestDate: e.target.value })} />
                  </div>
                </div>

                <div className="pt-3 border-t border-sky-200/60 space-y-2">
                  <div className="font-bold text-sky-900">Ước tính Nhu cầu Phần cứng IoT cho Zone này:</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-sky-200">
                      <span className="text-slate-500 block">Gateway</span>
                      <strong className="text-sky-800 font-bold">{cropData.gatewaysNeeded} trạm</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-sky-200">
                      <span className="text-slate-500 block">Sensor Nodes</span>
                      <strong className="text-emerald-800 font-bold">{cropData.nodesNeeded} nodes</strong>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-sky-200">
                      <span className="text-slate-500 block">Actuators/Relay</span>
                      <strong className="text-amber-800 font-bold">{cropData.actuatorsNeeded} van/bơm</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & SUBMIT SETUP */}
        {activeTab === 'REVIEW' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 py-3">
              <div className="w-14 h-14 bg-emerald-100 text-[#062326] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xem lại Cấu trúc Nông trang & Gửi Yêu cầu Kỹ thuật (Review & Submit)</h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Bàn giao thông tin Nông trang vừa thiết lập cho <strong>Kỹ thuật viên Platform (Platform Technician)</strong> để cấp phát Whitelist LoRa Gateway & Nodes.
              </p>
            </div>

            {/* Tree Structure Summary Card */}
            <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-4 shadow-lg font-mono text-xs">
              <div className="text-emerald-400 font-bold text-sm flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Tổng hợp Phân cấp GIS Nông trang</span>
                <span className="text-[11px] font-normal bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">Sẵn sàng Bàn giao</span>
              </div>

              <div className="space-y-3 pl-2">
                {/* Level 1: Farm */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-emerald-300 text-sm">{farmData.name}</div>
                    <div className="text-slate-400 text-[11px]">{farmData.address} • {farmData.areaM2} m² ({farmData.polygon.length} điểm GIS)</div>
                  </div>
                </div>

                {/* Level 2: Field */}
                <div className="flex items-start gap-3 pl-6 border-l-2 border-slate-700">
                  <CornerDownRight size={16} className="text-sky-400 shrink-0 mt-1" />
                  <div>
                    <div className="font-bold text-sky-300 text-xs">{fieldData.name}</div>
                    <div className="text-slate-400 text-[11px]">{fieldData.description} • {fieldData.areaM2} m²</div>
                  </div>
                </div>

                {/* Level 3: Zone */}
                <div className="flex items-start gap-3 pl-12 border-l-2 border-slate-700">
                  <CornerDownRight size={16} className="text-amber-400 shrink-0 mt-1" />
                  <div>
                    <div className="font-bold text-amber-300 text-xs">{zoneData.name}</div>
                    <div className="text-slate-400 text-[11px]">Cây trồng: {cropData.crop} ({cropData.variety}) • {zoneData.areaM2} m²</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Hand-off Step Info Box (Platform Tech Layer) */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-2 text-sky-900">
              <div className="font-bold flex items-center gap-1.5 text-sky-950">
                <Wrench size={16} className="text-sky-700" /> Bàn giao phần việc tiếp theo cho Kỹ thuật viên (Platform Technician):
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                <li>Kỹ thuật viên sẽ nạp Whitelist MAC Address trạm LoRa Gateway <strong>ESP32</strong>.</li>
                <li>Cấu hình các Sensor Node cảm biến Độ ẩm đất, Nhiệt độ, Độ ẩm không khí & Ánh sáng.</li>
                <li>Ánh xạ Node vào <strong>"{zoneData.name}"</strong> và kiểm tra kết nối MQTT/LoRaWAN.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={() => {
              if (activeTab === 'FIELD') setActiveTab('FARM');
              else if (activeTab === 'ZONE') setActiveTab('FIELD');
              else if (activeTab === 'CROP_SEASON') setActiveTab('ZONE');
              else if (activeTab === 'REVIEW') setActiveTab('CROP_SEASON');
            }}
            disabled={activeTab === 'FARM'}
          >
            <ArrowLeft size={16} className="mr-1" /> Quay lại bước trước
          </Button>

          {activeTab !== 'REVIEW' ? (
            <Button
              onClick={() => {
                if (activeTab === 'FARM') setActiveTab('FIELD');
                else if (activeTab === 'FIELD') setActiveTab('ZONE');
                else if (activeTab === 'ZONE') setActiveTab('CROP_SEASON');
                else if (activeTab === 'CROP_SEASON') setActiveTab('REVIEW');
              }}
            >
              Tiếp tục bước tiếp theo <ArrowRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                alert('Khởi tạo Trang trại & gửi yêu cầu cấp phát IoT cho Kỹ thuật viên thành công!');
                navigate('/owner/farms');
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send size={16} className="mr-1.5" /> Gửi Yêu cầu Cấu hình IoT cho Kỹ thuật viên
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
