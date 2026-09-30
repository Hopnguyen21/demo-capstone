import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Layers, Cpu, Building2,
  GitBranch, Check, Plus, Trash2, ArrowDown, ChevronRight, CornerDownRight,
  UserCheck, Wrench, ShieldCheck, Calendar, Info, Send, Compass, Loader2,
  Radio, Zap, ChevronDown, TrendingUp, AlertTriangle, Wifi, Package
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
    polygon: [] as [number, number][],
  });

  // Form State for Field Level (Level 2)
  const [fieldData, setFieldData] = useState({
    name: 'Lô đất A1 - Phân khu Cà chua & Dưa',
    description: 'Phân khu A1 trang bị nhà kính mái đôi thông minh',
    areaM2: '18000',
    center: [11.9404, 108.4583] as [number, number],
    polygon: [
      [11.9419, 108.4563],
      [11.9419, 108.4603],
      [11.9389, 108.4603],
      [11.9389, 108.4563],
    ] as [number, number][],
  });

  // Form State for Zone Level (Level 3)
  const [zoneData, setZoneData] = useState({
    name: 'Nhà màng Z01 - Cà chua Beefsteak',
    description: 'Nhà màng khép kín điều hòa vi khí hậu bằng quạt thông gió & tưới nhỏ giọt',
    areaM2: '4500',
    center: [11.9404, 108.4583] as [number, number],
    polygon: [
      [11.9410, 108.4575],
      [11.9410, 108.4591],
      [11.9398, 108.4591],
      [11.9398, 108.4575],
    ] as [number, number][],
  });

  // Automatically sync farm center location to child fields & zones
  useEffect(() => {
    const [lat, lng] = farmData.center;
    if (lat && lng) {
      setFieldData(prev => ({
        ...prev,
        center: farmData.center,
        polygon: [
          [parseFloat((lat + 0.0015).toFixed(6)), parseFloat((lng - 0.0020).toFixed(6))],
          [parseFloat((lat + 0.0015).toFixed(6)), parseFloat((lng + 0.0020).toFixed(6))],
          [parseFloat((lat - 0.0015).toFixed(6)), parseFloat((lng + 0.0020).toFixed(6))],
          [parseFloat((lat - 0.0015).toFixed(6)), parseFloat((lng - 0.0020).toFixed(6))],
        ],
      }));
      setZoneData(prev => ({
        ...prev,
        center: farmData.center,
        polygon: [
          [parseFloat((lat + 0.0006).toFixed(6)), parseFloat((lng - 0.0008).toFixed(6))],
          [parseFloat((lat + 0.0006).toFixed(6)), parseFloat((lng + 0.0008).toFixed(6))],
          [parseFloat((lat - 0.0006).toFixed(6)), parseFloat((lng + 0.0008).toFixed(6))],
          [parseFloat((lat - 0.0006).toFixed(6)), parseFloat((lng - 0.0008).toFixed(6))],
        ],
      }));
    }
  }, [farmData.center[0], farmData.center[1]]);

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

  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  const handleSearchAddress = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : farmData.address).trim();
    if (!q) return;

    setIsSearchingAddress(true);
    setSearchNotice('Đang định vị vị trí GIS...');

    const LOCATION_PRESETS: Record<string, [number, number]> = {
      'đà lạt': [11.9404, 108.4583],
      'đức trọng': [11.7256, 108.3752],
      'đơn dương': [11.8364, 108.5721],
      'củ chi': [11.0067, 106.5139],
      'mộc châu': [20.8437, 104.6853],
      'buôn ma thuột': [12.6667, 108.0383],
      'đắk lắk': [12.6667, 108.0383],
    };

    const lower = q.toLowerCase();
    for (const [key, coords] of Object.entries(LOCATION_PRESETS)) {
      if (lower.includes(key)) {
        setFarmData(prev => ({ ...prev, center: coords }));
        setSearchNotice(`Đã định vị thành công: ${key.toUpperCase()}`);
        setIsSearchingAddress(false);
        setTimeout(() => setSearchNotice(null), 3500);
        return;
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=vn&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const newCoords: [number, number] = [parseFloat(lat.toFixed(6)), parseFloat(lon.toFixed(6))];
          setFarmData(prev => ({ ...prev, center: newCoords }));
          setSearchNotice(`Đã định vị địa chỉ thành công!`);
          setTimeout(() => setSearchNotice(null), 3500);
        }
      } else {
        setSearchNotice('Không tìm thấy vị trí. Thử các vùng nông nghiệp gợi ý bên dưới.');
      }
    } catch (err) {
      console.warn('Geocoding search failed', err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

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
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={farmData.address}
                        onChange={e => setFarmData({ ...farmData, address: e.target.value })}
                        placeholder="Tỉnh/Thành, Quận/Huyện, Xã/Phường..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchAddress();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleSearchAddress()}
                      disabled={isSearchingAddress}
                      className="bg-[#062326] hover:bg-[#062326]/90 text-white font-semibold text-xs py-2 px-3 shrink-0 flex items-center gap-1.5 shadow-xs"
                    >
                      {isSearchingAddress ? <Loader2 size={13} className="animate-spin text-emerald-400" /> : <Compass size={14} className="text-emerald-400" />}
                      <span>Định vị trên GIS Map</span>
                    </Button>
                  </div>

                  {/* Preset Location Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 mt-1.5">
                    <span className="text-slate-400">Gợi ý nhanh:</span>
                    {['Đà Lạt', 'Đức Trọng', 'Đơn Dương', 'Củ Chi', 'Mộc Châu', 'Buôn Ma Thuột'].map(city => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          const fullAddr = `${city}, Việt Nam`;
                          setFarmData(prev => ({ ...prev, address: fullAddr }));
                          handleSearchAddress(city);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 rounded transition-colors text-[10px]"
                      >
                        📍 {city}
                      </button>
                    ))}
                  </div>

                  {searchNotice && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-1 animate-in fade-in">
                      ✨ {searchNotice}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mô tả Trang trại</label>
                  <textarea
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] text-xs shadow-xs"
                    value={farmData.description}
                    onChange={e => setFarmData({ ...farmData, description: e.target.value })}
                    placeholder="Mô tả quy mô và nông sản chính của trang trại..."
                  />
                </div>
              </div>

              {/* GIS Map Picker for Farm */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">Bản đồ GIS Vị trí Tâm điểm Trang trại (Định vị nhanh)</label>
                <GISLocationPicker
                  level="FARM"
                  center={farmData.center}
                  onCenterChange={c => setFarmData(prev => ({ ...prev, center: c }))}
                  polygon={farmData.polygon}
                  onPolygonChange={p => setFarmData(prev => ({ ...prev, polygon: p }))}
                  hidePolygon={true}
                  hideAddressSearch={true}
                  addressSearchQuery={farmData.address}
                  height="360px"
                  onAddressChange={addr => setFarmData(prev => ({ ...prev, address: addr }))}
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
                    <strong>Hướng dẫn GIS Lô đất:</strong> Bạn có thể <strong>vẽ trực tiếp trên Map</strong> hoặc bấm vào nút <strong className="text-emerald-700 font-bold">"📍 Nhập Tọa độ (Lat/Lng)"</strong> trên thanh công cụ bản đồ bên phải để nhập danh sách điểm tọa độ (yêu cầu <strong>tối thiểu 3 điểm</strong>).
                  </div>
                </div>
              </div>

              {/* GIS Map Picker for Field (Parent Farm Polygon shown in background) */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">GIS Map Ranh giới Lô đất (Lồng trong Ranh giới Trang trại)</label>
                <GISLocationPicker
                  level="FIELD"
                  center={fieldData.center}
                  onCenterChange={c => setFieldData(prev => ({ ...prev, center: c }))}
                  polygon={fieldData.polygon}
                  onPolygonChange={p => setFieldData(prev => ({ ...prev, polygon: p }))}
                  parentFarmPolygon={farmData.polygon}
                  hideAddressSearch={true}
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

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Hướng dẫn GIS Nhà màng:</strong> Sử dụng công cụ vẽ trên Map hoặc nhấn <strong className="text-emerald-800 font-bold">"📍 Nhập Tọa độ (Lat/Lng)"</strong> trên bản đồ để nhập thủ công bảng tọa độ (yêu cầu <strong>tối thiểu 3 điểm</strong>).
                  </div>
                </div>
              </div>

              {/* GIS Map Picker for Zone (Parent Farm & Parent Field shown) */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">GIS Map Vị trí Nhà màng (Lồng trong Lô đất & Trang trại)</label>
                <GISLocationPicker
                  level="ZONE"
                  center={zoneData.center}
                  onCenterChange={c => setZoneData(prev => ({ ...prev, center: c }))}
                  polygon={zoneData.polygon}
                  onPolygonChange={p => setZoneData(prev => ({ ...prev, polygon: p }))}
                  parentFarmPolygon={farmData.polygon}
                  parentFieldPolygon={fieldData.polygon}
                  hideAddressSearch={true}
                  height="360px"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CROP & SEASON LEVEL */}
        {activeTab === 'CROP_SEASON' && (() => {
          // ── IoT Device estimation logic based on crop & zone area ──
          const areaM2 = parseFloat(zoneData.areaM2) || 4500;

          // Crop profiles: sensor density, actuator density, gateway need
          const CROP_PROFILES: Record<string, {
            icon: string;
            color: string;
            sensorsPer500m2: number;
            actuatorsPer500m2: number;
            gatewayPer3000m2: number;
            varieties: string[];
            note: string;
          }> = {
            'Cà chua (Solanum lycopersicum)': {
              icon: '🍅', color: 'emerald',
              sensorsPer500m2: 1, actuatorsPer500m2: 1.2, gatewayPer3000m2: 1,
              varieties: ['Beefsteak Đà Lạt F1', 'Cherry Vàng F1', 'Bi đỏ VN888', 'Pink Lady F1'],
              note: 'Cà chua cần theo dõi độ ẩm đất & nhiệt độ chặt chẽ',
            },
            'Ớt ngọt (Capsicum annuum)': {
              icon: '🫑', color: 'red',
              sensorsPer500m2: 0.8, actuatorsPer500m2: 1, gatewayPer3000m2: 1,
              varieties: ['Ớt Đà Lạt F1', 'California Wonder', 'Chuông Đỏ Hà Lan', 'Sweet Baby'],
              note: 'Ớt cần cảm biến ánh sáng và kiểm soát tưới chính xác',
            },
            'Dưa leo (Cucumis sativus)': {
              icon: '🥒', color: 'green',
              sensorsPer500m2: 0.8, actuatorsPer500m2: 0.8, gatewayPer3000m2: 1,
              varieties: ['Dưa Nhật TN-088', 'Dưa baby VN', 'Cucumber F1 Hà Lan', 'Mini Cuke'],
              note: 'Dưa leo phát triển nhanh, cần theo dõi độ ẩm không khí',
            },
            'Xà lách Thủy canh (Lactuca sativa)': {
              icon: '🥬', color: 'lime',
              sensorsPer500m2: 1.2, actuatorsPer500m2: 1.5, gatewayPer3000m2: 1,
              varieties: ['Butterhead F1', 'Romaine Viet', 'Oakleaf xanh', 'Lollo Rossa'],
              note: 'Thủy canh cần giám sát EC/pH + van bơm dinh dưỡng liên tục',
            },
          };

          // Unit prices (VNĐ)
          const UNIT_PRICES = {
            gateway: 3_500_000,
            sensor: 850_000,
            actuator: 650_000,
            installation: 500_000, // per zone flat fee
          };

          const profile = CROP_PROFILES[cropData.crop] || CROP_PROFILES['Cà chua (Solanum lycopersicum)'];
          const gateways = Math.max(1, Math.ceil(areaM2 / 3000 * profile.gatewayPer3000m2));
          const sensors = Math.max(2, Math.ceil(areaM2 / 500 * profile.sensorsPer500m2));
          const actuators = Math.max(1, Math.ceil(areaM2 / 500 * profile.actuatorsPer500m2));

          const totalDeviceCost = gateways * UNIT_PRICES.gateway + sensors * UNIT_PRICES.sensor + actuators * UNIT_PRICES.actuator + UNIT_PRICES.installation;
          const minCost = Math.round(totalDeviceCost * 0.85);
          const maxCost = Math.round(totalDeviceCost * 1.25);

          const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

          const colorMap: Record<string, string> = {
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            red: 'bg-red-50 border-red-200 text-red-900',
            green: 'bg-green-50 border-green-200 text-green-900',
            lime: 'bg-lime-50 border-lime-200 text-lime-900',
          };
          const badgeColor = colorMap[profile.color] || colorMap.emerald;

          return (
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
                {/* LEFT: Crop & Season Config */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-4">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                    <Sprout size={16} className="text-[#062326]" /> Chọn Cây trồng & Giống cây (Configure Crop)
                  </h4>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Loài Cây trồng *</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs"
                      value={cropData.crop}
                      onChange={e => setCropData({ ...cropData, crop: e.target.value, variety: CROP_PROFILES[e.target.value]?.varieties[0] || '' })}
                    >
                      {Object.entries(CROP_PROFILES).map(([key, val]) => (
                        <option key={key} value={key}>{val.icon} {key}</option>
                      ))}
                    </select>
                    {/* Crop note badge */}
                    <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${badgeColor}`}>
                      <Info size={12} className="shrink-0" />
                      <span>{profile.note}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Giống thương mại / Variety *</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs"
                      value={cropData.variety}
                      onChange={e => setCropData({ ...cropData, variety: e.target.value })}
                    >
                      {profile.varieties.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Tên Vụ mùa khởi tạo *</label>
                    <Input value={cropData.seasonName} onChange={e => setCropData({ ...cropData, seasonName: e.target.value })} placeholder="Ví dụ: Vụ Cà chua Đông Xuân 2026-2027" />
                  </div>
                </div>

                {/* RIGHT: Season dates */}
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

                  {/* Zone info summary */}
                  <div className="p-3 bg-white border border-sky-200 rounded-lg space-y-1 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>Nhà màng:</span><strong className="text-slate-800">{zoneData.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Diện tích Zone:</span><strong className="text-[#062326]">{Number(zoneData.areaM2).toLocaleString()} m²</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Lô đất mẹ:</span><strong className="text-slate-800">{fieldData.name}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── IoT DEVICE & COST ESTIMATION CARD ── */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#062326] to-[#0a3d41] text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                      <Cpu size={15} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        Ước tính Thiết bị IoT & Chi phí Lắp đặt
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-normal">
                          {profile.icon} {cropData.crop.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Tính toán tự động dựa trên loại cây & diện tích {areaM2.toLocaleString()} m²</div>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-slate-400" />
                </div>

                <div className="p-5 bg-slate-50 space-y-4 text-xs">
                  {/* Device count grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Gateway */}
                    <div className="bg-white border border-sky-200 rounded-xl p-3 text-center space-y-1.5 shadow-xs">
                      <div className="w-9 h-9 mx-auto rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center">
                        <Wifi size={18} className="text-sky-700" />
                      </div>
                      <div className="font-bold text-xl text-sky-800">{gateways}</div>
                      <div className="text-slate-500 text-[11px]">LoRa Gateway</div>
                      <div className="text-[10px] text-sky-700 font-semibold border-t border-sky-100 pt-1">
                        {formatVND(gateways * UNIT_PRICES.gateway)}
                      </div>
                    </div>

                    {/* Sensor Nodes */}
                    <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center space-y-1.5 shadow-xs">
                      <div className="w-9 h-9 mx-auto rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                        <Radio size={18} className="text-emerald-700" />
                      </div>
                      <div className="font-bold text-xl text-emerald-800">{sensors}</div>
                      <div className="text-slate-500 text-[11px]">Sensor Node</div>
                      <div className="text-[10px] text-emerald-700 font-semibold border-t border-emerald-100 pt-1">
                        {formatVND(sensors * UNIT_PRICES.sensor)}
                      </div>
                    </div>

                    {/* Actuators */}
                    <div className="bg-white border border-amber-200 rounded-xl p-3 text-center space-y-1.5 shadow-xs">
                      <div className="w-9 h-9 mx-auto rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <Zap size={18} className="text-amber-700" />
                      </div>
                      <div className="font-bold text-xl text-amber-800">{actuators}</div>
                      <div className="text-slate-500 text-[11px]">Van / Bơm</div>
                      <div className="text-[10px] text-amber-700 font-semibold border-t border-amber-100 pt-1">
                        {formatVND(actuators * UNIT_PRICES.actuator)}
                      </div>
                    </div>
                  </div>

                  {/* Cost breakdown */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-1.5">
                      <Package size={13} /> Chi tiết Báo giá Phần cứng (Tham khảo)
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between items-center px-4 py-2 text-slate-600">
                        <span className="flex items-center gap-1.5"><Wifi size={12} className="text-sky-600" /> LoRa Gateway × {gateways}</span>
                        <span className="font-mono font-semibold">{formatVND(gateways * UNIT_PRICES.gateway)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 text-slate-600">
                        <span className="flex items-center gap-1.5"><Radio size={12} className="text-emerald-600" /> Sensor Node × {sensors}</span>
                        <span className="font-mono font-semibold">{formatVND(sensors * UNIT_PRICES.sensor)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 text-slate-600">
                        <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-600" /> Van/Bơm Actuator × {actuators}</span>
                        <span className="font-mono font-semibold">{formatVND(actuators * UNIT_PRICES.actuator)}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2 text-slate-600">
                        <span className="flex items-center gap-1.5"><Wrench size={12} className="text-slate-500" /> Phí lắp đặt & cấu hình (flat)</span>
                        <span className="font-mono font-semibold">{formatVND(UNIT_PRICES.installation)}</span>
                      </div>
                      {/* Total row */}
                      <div className="flex justify-between items-center px-4 py-3 bg-[#062326]/5 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-[#062326]">
                          <TrendingUp size={14} /> Tổng ước tính
                        </span>
                        <div className="text-right">
                          <div className="text-base font-bold text-[#062326] font-mono">{formatVND(totalDeviceCost)}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            Dao động: {formatVND(minCost)} – {formatVND(maxCost)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer note */}
                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-[11px]">⚠️ Lưu ý: Ước tính giá có thể lệch với đơn giá của Kỹ thuật viên</div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Chi phí trên chỉ mang tính <strong>tham khảo</strong> dựa trên mật độ thiết bị tiêu chuẩn. Đơn giá thực tế sẽ do <strong>Kỹ thuật viên Platform</strong> xác nhận sau khi khảo sát hiện trường, thương lượng hợp đồng và kiểm tra khả năng tích hợp LoRaWAN của khu vực.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}


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
