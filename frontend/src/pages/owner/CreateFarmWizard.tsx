import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Layers, Cpu, Building2,
  GitBranch, Check, Plus, Trash2, ArrowDown, ChevronRight, CornerDownRight,
  UserCheck, Wrench, ShieldCheck, Calendar, Info, Send, Compass, Loader2,
  Radio, Zap, ChevronDown, TrendingUp, AlertTriangle, Wifi, Package
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { GISLocationPicker, calculatePolygonAreaM2, toGeoJsonPolygon } from '../../components/maps/GISLocationPicker';
import { farmService, cropService } from '../../services';

export const CreateFarmWizard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'FARM' | 'FIELD' | 'ZONE' | 'CROP_SEASON' | 'REVIEW'>('FARM');

  // Form State for Farm Level (Level 1)
  const [farmData, setFarmData] = useState({
    name: 'Trang trại Nông nghiệp Công nghệ cao Đà Lạt 02',
    address: 'Phường 12, TP. Đà Lạt, Lâm Đồng',
    landmark: 'Khu Suối Vàng',
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

  // Dynamic backend crops & varieties
  const [serverCrops, setServerCrops] = useState<any[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>('10000000-0000-0000-0000-000000000001');
  const [serverVarieties, setServerVarieties] = useState<any[]>([]);
  const [selectedVarietyId, setSelectedVarietyId] = useState<string>('');
  const [serverProfiles, setServerProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wizardSuccessData, setWizardSuccessData] = useState<{
    farmId: string;
    fieldId?: string;
    zoneId?: string;
    seasonId?: string;
    deploymentRequestId?: string;
  } | null>(null);

  const loadVarietiesAndProfiles = async (cropId: string) => {
    try {
      const [vars, profs] = await Promise.all([
        cropService.getVarieties(cropId).catch(() => []),
        cropService.getGrowthProfiles(cropId).catch(() => []),
      ]);
      if (Array.isArray(vars) && vars.length > 0) {
        setServerVarieties(vars);
        setSelectedVarietyId(vars[0].varietyId);
        setCropData(prev => ({ ...prev, variety: vars[0].name }));
      } else {
        setServerVarieties([]);
        setSelectedVarietyId('');
      }
      if (Array.isArray(profs) && profs.length > 0) {
        setServerProfiles(profs);
        setSelectedProfileId(profs[0].profileId || profs[0].id || '');
      } else {
        setServerProfiles([]);
        setSelectedProfileId('');
      }
    } catch (err) {
      console.warn('Failed to load crop varieties/profiles', err);
    }
  };

  useEffect(() => {
    const fetchCrops = async () => {
      try {
        const crops = await cropService.getCrops();
        if (Array.isArray(crops) && crops.length > 0) {
          setServerCrops(crops);
          const initial = crops[0];
          setSelectedCropId(initial.cropId);
          setCropData(prev => ({
            ...prev,
            crop: `${initial.name} (${initial.scientificName || 'Thương phẩm'})`,
            seasonName: `Vụ ${initial.name.split('(')[0].trim()} Đông Xuân 2026-2027`,
          }));
          loadVarietiesAndProfiles(initial.cropId);
        }
      } catch (err) {
        console.warn('Failed to load server crops', err);
      }
    };
    fetchCrops();
  }, []);

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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-1 border border-emerald-200">
              <UserCheck size={14} className="text-[#119653]" /> Vai trò: Chủ Trang trại (Farm Owner / Tenant)
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
                  ? 'bg-[#119653] text-white border-[#119653] shadow-md ring-2 ring-[#119653]/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon size={18} className={isActive ? 'text-white' : 'text-[#119653]'} />
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
                  <Building2 size={20} className="text-[#119653]" /> Bước 1: Thông tin & GIS Map Ranh giới Trang trại (Farm)
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
                  <label className="block text-slate-700 font-bold mb-1">Địa chỉ hành chính *</label>
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
                      className="bg-[#119653] hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-3 shrink-0 flex items-center gap-1.5 shadow-xs"
                    >
                      {isSearchingAddress ? <Loader2 size={13} className="animate-spin text-emerald-200" /> : <Compass size={14} className="text-white" />}
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
                  <label className="block text-slate-700 font-bold mb-1">Tên địa danh / Khu vực (Tùy chọn)</label>
                  <Input value={farmData.landmark} onChange={e => setFarmData({ ...farmData, landmark: e.target.value })} placeholder="Tên thường gọi, địa chỉ cũ (nếu có)..." />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mô tả Trang trại</label>
                  <textarea
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653] text-xs shadow-xs"
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
                  <MapPin size={20} className="text-[#119653]" /> Bước 2: Phân khu Lô đất (Field) lồng trong Trang trại
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Lô đất thuộc về Trang trại mẹ <strong className="text-emerald-800">"{farmData.name}"</strong>. Vẽ ranh giới Lô đất nằm bên trong Trang trại.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-800 rounded-full border border-sky-200">
                Bước 2 / 5
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-slate-500 block text-[11px]">Trang trại Mẹ sở hữu:</span>
                  <strong className="text-emerald-900 font-bold text-sm flex items-center gap-1.5 mt-0.5">
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
                  onPolygonChange={p => setFieldData(prev => ({ ...prev, polygon: p, areaM2: calculatePolygonAreaM2(p).toString() }))}
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
                  <Sprout size={20} className="text-[#119653]" /> Bước 3: Khu vực Nhà màng (Zone) lồng trong Lô đất
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nhà màng / Khu vực tưới thuộc Lô đất <strong className="text-emerald-800">"{fieldData.name}"</strong> thuộc Trang trại <strong className="text-emerald-800">"{farmData.name}"</strong>.
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
                    <strong className="text-emerald-800">{fieldData.name}</strong>
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
                  onPolygonChange={p => setZoneData(prev => ({ ...prev, polygon: p, areaM2: calculatePolygonAreaM2(p).toString() }))}
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
            template: { growthStage: string, nutrition: string, light: string, temp: string, humidity: string, duration: string };
          }> = {
            'Cà chua (Solanum lycopersicum)': {
              icon: '🍅', color: 'emerald',
              sensorsPer500m2: 1, actuatorsPer500m2: 1.2, gatewayPer3000m2: 1,
              varieties: ['Beefsteak Đà Lạt F1', 'Cherry Vàng F1', 'Bi đỏ VN888', 'Pink Lady F1'],
              note: 'Cà chua cần theo dõi độ ẩm đất & nhiệt độ chặt chẽ',
              template: { growthStage: 'Mầm ➔ Sinh trưởng ➔ Ra hoa ➔ Tạo quả', nutrition: 'N-P-K (5-10-5 mầm, 5-10-10 hoa)', light: '12-14 giờ/ngày', temp: 'Ngày: 21-29°C, Đêm: 15-20°C', humidity: '60-70%', duration: '90-120 ngày' }
            },
            'Ớt ngọt (Capsicum annuum)': {
              icon: '🫑', color: 'red',
              sensorsPer500m2: 0.8, actuatorsPer500m2: 1, gatewayPer3000m2: 1,
              varieties: ['Ớt Đà Lạt F1', 'California Wonder', 'Chuông Đỏ Hà Lan', 'Sweet Baby'],
              note: 'Ớt cần cảm biến ánh sáng và kiểm soát tưới chính xác',
              template: { growthStage: 'Mầm ➔ Phát triển cành ➔ Ra hoa ➔ Kết trái', nutrition: 'N-P-K (Tăng Kali khi kết trái)', light: '10-12 giờ/ngày', temp: 'Ngày: 25-28°C, Đêm: 18-20°C', humidity: '55-65%', duration: '100-150 ngày' }
            },
            'Dưa leo (Cucumis sativus)': {
              icon: '🥒', color: 'green',
              sensorsPer500m2: 0.8, actuatorsPer500m2: 0.8, gatewayPer3000m2: 1,
              varieties: ['Dưa Nhật TN-088', 'Dưa baby VN', 'Cucumber F1 Hà Lan', 'Mini Cuke'],
              note: 'Dưa leo phát triển nhanh, cần theo dõi độ ẩm không khí',
              template: { growthStage: 'Mầm ➔ Leo giàn ➔ Ra hoa cái ➔ Trái non', nutrition: 'Tăng Đạm giai đoạn đầu, Lân giai đoạn hoa', light: '10-14 giờ/ngày', temp: 'Ngày: 24-30°C, Đêm: 18-22°C', humidity: '70-85%', duration: '60-80 ngày' }
            },
            'Xà lách Thủy canh (Lactuca sativa)': {
              icon: '🥬', color: 'lime',
              sensorsPer500m2: 1.2, actuatorsPer500m2: 1.5, gatewayPer3000m2: 1,
              varieties: ['Butterhead F1', 'Romaine Viet', 'Oakleaf xanh', 'Lollo Rossa'],
              note: 'Thủy canh cần giám sát EC/pH + van bơm dinh dưỡng liên tục',
              template: { growthStage: 'Ươm hạt ➔ Lên giàn ➔ Phát triển lá ➔ Thu hoạch', nutrition: 'EC: 1.2 - 1.8 mS/cm, pH: 5.8 - 6.2', light: '14-16 giờ/ngày', temp: 'Ngày: 18-24°C, Đêm: 15-18°C', humidity: '50-70%', duration: '40-50 ngày' }
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
                    <Calendar size={20} className="text-[#119653]" /> Bước 4: Thiết lập Cây trồng & Vụ mùa đầu tiên
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">Chọn giống cây canh tác và thiết lập lịch vụ mùa cho Nhà màng <strong className="text-emerald-800">"{zoneData.name}"</strong>.</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  Bước 4 / 5
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* LEFT: Crop & Season Config */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-4">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                    <Sprout size={16} className="text-[#119653]" /> Chọn Cây trồng & Giống cây (Configure Crop)
                  </h4>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Loài Cây trồng (Backend Crop Catalog) *</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653] shadow-xs"
                      value={selectedCropId}
                      onChange={e => {
                        const newCropId = e.target.value;
                        setSelectedCropId(newCropId);
                        const c = serverCrops.find(x => x.cropId === newCropId);
                        if (c) {
                          setCropData(prev => ({
                            ...prev,
                            crop: `${c.name} (${c.scientificName || ''})`,
                            seasonName: `Vụ ${c.name.split('(')[0].trim()} Đông Xuân 2026-2027`,
                          }));
                          loadVarietiesAndProfiles(newCropId);
                        }
                      }}
                    >
                      {serverCrops.length > 0 ? (
                        serverCrops.map(c => (
                          <option key={c.cropId} value={c.cropId}>
                            🌱 {c.name} {c.scientificName ? `(${c.scientificName})` : ''}
                          </option>
                        ))
                      ) : (
                        Object.entries(CROP_PROFILES).map(([key, val]) => (
                          <option key={key} value={key}>{val.icon} {key}</option>
                        ))
                      )}
                    </select>
                    {/* Crop note badge */}
                    <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${badgeColor}`}>
                      <Info size={12} className="shrink-0" />
                      <span>{profile.note}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Giống thương mại / Variety (Backend Catalog) *</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653] shadow-xs"
                      value={selectedVarietyId}
                      onChange={e => {
                        setSelectedVarietyId(e.target.value);
                        const v = serverVarieties.find(x => x.varietyId === e.target.value);
                        if (v) setCropData(prev => ({ ...prev, variety: v.name }));
                      }}
                    >
                      {serverVarieties.length > 0 ? (
                        serverVarieties.map(v => (
                          <option key={v.varietyId} value={v.varietyId}>
                            {v.name} {v.description ? `— ${v.description}` : ''}
                          </option>
                        ))
                      ) : (
                        profile.varieties.map(v => <option key={v} value={v}>{v}</option>)
                      )}
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
                      <span>Diện tích Zone:</span><strong className="text-emerald-800">{Number(zoneData.areaM2).toLocaleString('vi-VN')} m²</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Lô đất mẹ:</span><strong className="text-slate-800">{fieldData.name}</strong>
                    </div>
                  </div>

                  {/* Crop Template info */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2 text-[11px] text-slate-600 mt-3">
                    <div className="font-bold text-emerald-800 border-b border-emerald-100 pb-1 mb-1">
                      Chu kỳ sinh trưởng & Điều kiện (Template)
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-16 shrink-0 font-medium text-slate-500">Chu kỳ:</span>
                      <span className="text-slate-800">{profile.template.growthStage}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-16 shrink-0 font-medium text-slate-500">Dinh dưỡng:</span>
                      <span className="text-slate-800">{profile.template.nutrition}</span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Nhiệt độ:</span>
                        <span className="text-slate-800">{profile.template.temp}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Độ ẩm:</span>
                        <span className="text-slate-800">{profile.template.humidity}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Ánh sáng:</span>
                        <span className="text-slate-800">{profile.template.light}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Thời vụ:</span>
                        <span className="text-slate-800">{profile.template.duration}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── IoT DEVICE & COST ESTIMATION CARD ── */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#119653] via-emerald-600 to-emerald-500 text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
                      <Cpu size={15} className="text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        Ước tính Thiết bị IoT & Chi phí Lắp đặt
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white border border-white/30 font-normal">
                          {profile.icon} {cropData.crop.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-100 mt-0.5">Bố trí theo mô hình mạng tổ ong (Lục giác) trên diện tích {Number(areaM2).toLocaleString('vi-VN')} m²</div>
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
                      <div className="flex justify-between items-center px-4 py-3 bg-emerald-50/70 border-t border-emerald-200 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-emerald-900">
                          <TrendingUp size={14} /> Tổng ước tính
                        </span>
                        <div className="text-right">
                          <div className="text-base font-bold text-emerald-800 font-mono">{formatVND(totalDeviceCost)}</div>
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
                        Chi phí trên chỉ mang tính <strong>tham khảo</strong> dựa trên mật độ thiết bị tiêu chuẩn. Đơn giá thực tế sẽ do <strong>Kỹ thuật viên Platform</strong> xác nhận sau khi khảo sát hiện trường, thương lượng hợp đồng và kiểm tra khả năng tích hợp LoRa của khu vực.
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
              <div className="w-14 h-14 bg-emerald-100 text-[#119653] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xem lại Cấu trúc Nông trang & Gửi Yêu cầu Kỹ thuật (Review & Submit)</h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Bàn giao thông tin Nông trang vừa thiết lập cho <strong>Kỹ thuật viên Platform (Platform Technician)</strong> để cấp phát Whitelist LoRa Gateway & Nodes.
              </p>
            </div>

            {/* Warning out of bounds */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="block mb-0.5">Chính sách Cảnh báo Vùng địa lý:</strong>
                Hệ thống sẽ <strong>phát cảnh báo trên web</strong> ngay lập tức khi phát hiện thiết bị (Gateway/Node) bị di chuyển hoặc đi ra ngoài ranh giới <strong>Khu trang trại / Khu nhà màng</strong> đã được đánh dấu GIS.
              </div>
            </div>

            {/* Tree Structure Summary Card */}
            <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-4 shadow-lg font-mono text-xs">
              <div className="text-emerald-400 font-bold text-sm flex items-center justify-between border-b border-slate-800 pb-2">
                <span>Tổng hợp Phân cấp GIS Nông trang</span>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">Sẵn sàng Bàn giao</span>
              </div>

              <div className="space-y-3 pl-2">
                {/* Level 1: Farm */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-emerald-300 text-sm">{farmData.name}</div>
                    <div className="text-slate-400 text-[11px]">{farmData.address} {farmData.landmark ? `(${farmData.landmark})` : ''} • {Number(farmData.areaM2).toLocaleString('vi-VN')} m² ({farmData.polygon.length} điểm GIS)</div>
                  </div>
                </div>

                {/* Level 2: Field */}
                <div className="flex items-start gap-3 pl-6 border-l-2 border-slate-700">
                  <CornerDownRight size={16} className="text-sky-400 shrink-0 mt-1" />
                  <div>
                    <div className="font-bold text-sky-300 text-xs">{fieldData.name}</div>
                    <div className="text-slate-400 text-[11px]">{fieldData.description} • {Number(fieldData.areaM2).toLocaleString('vi-VN')} m²</div>
                  </div>
                </div>

                {/* Level 3: Zone */}
                <div className="flex items-start gap-3 pl-12 border-l-2 border-slate-700">
                  <CornerDownRight size={16} className="text-amber-400 shrink-0 mt-1" />
                  <div>
                    <div className="font-bold text-amber-300 text-xs">{zoneData.name}</div>
                    <div className="text-slate-400 text-[11px]">Cây trồng: {cropData.crop} ({cropData.variety}) • {Number(zoneData.areaM2).toLocaleString('vi-VN')} m²</div>
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
                <li>Ánh xạ Node vào <strong>"{zoneData.name}"</strong> và kiểm tra kết nối MQTT/LoRa.</li>
              </ul>
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {wizardSuccessData && (
          <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs space-y-3 text-emerald-950 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
              <CheckCircle2 size={20} className="text-emerald-600" />
              Khởi tạo Phân cấp Nông trang & Cấp phát IoT thành công!
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-3 rounded-xl border border-emerald-200">
              <div>🏢 Farm ID: <strong className="text-slate-900">{wizardSuccessData.farmId}</strong></div>
              <div>📍 Field ID: <strong className="text-slate-900">{wizardSuccessData.fieldId || 'N/A'}</strong></div>
              <div>🌱 Zone ID: <strong className="text-slate-900">{wizardSuccessData.zoneId || 'N/A'}</strong></div>
              <div>📅 Season ID: <strong className="text-slate-900">{wizardSuccessData.seasonId || 'N/A'}</strong></div>
              <div className="sm:col-span-2 text-emerald-800">📡 Phiếu Yêu cầu IoT ID: <strong>{wizardSuccessData.deploymentRequestId || 'N/A'}</strong></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => navigate('/owner/farms')} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs">
                Xem Trang trại trong Quản lý Nông trang <ArrowRight size={14} className="ml-1" />
              </Button>
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
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                setSubmitError(null);
                try {
                  const res = await farmService.wizardSetup({
                    farm: {
                      name: farmData.name.trim() || 'Trang trại mới',
                      locationText: farmData.address.trim() || 'Đà Lạt, Lâm Đồng',
                      latitude: farmData.center[0],
                      longitude: farmData.center[1],
                      totalAreaM2: Number(farmData.areaM2) || 10000,
                      timeZone: 'Asia/Ho_Chi_Minh',
                    },
                    field: {
                      name: fieldData.name.trim() || 'Lô đất A1',
                      areaM2: Number(fieldData.areaM2) || 5000,
                      soilType: 'Loam',
                      boundaryGeoJson: JSON.stringify(toGeoJsonPolygon(fieldData.polygon)),
                    },
                    zone: {
                      name: zoneData.name.trim() || 'Nhà màng Z01',
                      areaM2: Number(zoneData.areaM2) || 2000,
                      zoneType: 'Greenhouse',
                      boundaryGeoJson: JSON.stringify(toGeoJsonPolygon(zoneData.polygon)),
                    },
                    season: {
                      name: cropData.seasonName.trim() || 'Vụ mùa mới',
                      cropId: selectedCropId || '10000000-0000-0000-0000-000000000001',
                      varietyId: selectedVarietyId || undefined,
                      growthProfileId: selectedProfileId || undefined,
                      startDate: cropData.startDate ? `${cropData.startDate}T00:00:00Z` : new Date().toISOString(),
                      expectedEndDate: cropData.expectedHarvestDate ? `${cropData.expectedHarvestDate}T00:00:00Z` : undefined,
                    },
                    initialDeploymentRequest: {
                      requiredParameters: ['SoilMoisture', 'Temperature', 'AirHumidity'],
                      ownerNotes: `Cần ${cropData.gatewaysNeeded || 1} Gateway LoRa và ${cropData.nodesNeeded || 4} Sensor Node.`,
                    },
                  });

                  setWizardSuccessData(res);
                } catch (err: any) {
                  console.error('Wizard setup error:', err);
                  const msg = err.response?.data?.detail || err.response?.data?.title || err.message || 'Lỗi khi gửi yêu cầu khởi tạo phân cấp';
                  setSubmitError(`Lỗi thiết lập: ${msg}`);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" /> Đang thiết lập qua API...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-1.5" /> Gửi Yêu cầu Cấu hình IoT cho Kỹ thuật viên
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
