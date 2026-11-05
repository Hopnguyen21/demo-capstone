import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout, CheckCircle2, ArrowRight, ArrowLeft, MapPin, Layers, Cpu, Building2,
  GitBranch, Check, Plus, Trash2, ArrowDown, ChevronRight, CornerDownRight,
  UserCheck, Wrench, ShieldCheck, Calendar, Info, Send, Compass, Loader2,
  Radio, Zap, ChevronDown, TrendingUp, AlertTriangle, Wifi, Package, ClipboardCheck, RefreshCw
} from 'lucide-react';
import { Button, Input } from '../../components/ui/BaseUI';
import { GISLocationPicker, calculatePolygonAreaM2, toGeoJsonPolygon } from '../../components/maps/GISLocationPicker';
import { farmService, cropService, gisProxyService } from '../../services';
import { HoneycombEstimator } from '../../components/estimation/HoneycombEstimator';

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
      // 0. Thử Backend Proxy trước (bảo vệ quyền riêng tư & cache server-side)
      let found = false;
      try {
        const proxyResults = await gisProxyService.searchLocation(q);
        if (proxyResults && proxyResults.length > 0) {
          const first = proxyResults[0];
          const lat = typeof first.latitude === 'number' ? first.latitude : parseFloat(first.latitude);
          const lon = typeof first.longitude === 'number' ? first.longitude : parseFloat(first.longitude);
          if (!isNaN(lat) && !isNaN(lon)) {
            const newCoords: [number, number] = [parseFloat(lat.toFixed(6)), parseFloat(lon.toFixed(6))];
            setFarmData(prev => ({ ...prev, center: newCoords }));
            setSearchNotice(`Đã định vị địa chỉ thành công qua proxy!`);
            setTimeout(() => setSearchNotice(null), 3500);
            found = true;
          }
        }
      } catch (proxyErr) {
        console.warn('Backend search location proxy failed, fallback to direct search:', proxyErr);
      }

      if (!found) {
        setSearchNotice('Không tìm thấy vị trí qua hệ thống. Bạn có thể chọn các vùng gợi ý hoặc bấm chọn trực tiếp trên bản đồ.');
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
    { id: 'REVIEW', label: wizardSuccessData ? '5. Đã hoàn tất' : '5. Xem lại & Gửi IoT', sub: wizardSuccessData ? 'Đã bàn giao Kỹ thuật viên thành công' : 'Xác nhận & gửi Kỹ thuật viên', icon: wizardSuccessData ? CheckCircle2 : ClipboardCheck },
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

          const currentCrop = serverCrops.find(c => c.cropId === selectedCropId);
          const currentProfile = serverProfiles.find(p => (p.profileId || p.id) === selectedProfileId) || serverProfiles[0];
          const stages = (currentProfile?.stages || []) as any[];

          const totalDays = stages.reduce((acc: number, s: any) => acc + (Number(s.durationDays) || 0), 0) || currentCrop?.growthCycleDays || 90;

          const allReqs = stages.flatMap((s: any) => s.requirements || []);
          const tempReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('temp') || r.parameterCode === 0);
          const humAirReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('airhum') || r.parameterCode === 1);
          const humSoilReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('soilmoist') || r.parameterCode === 2);
          const luxReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('light') || r.parameterCode === 3);
          const phReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('ph') || r.parameterCode === 4);
          const ecReq = allReqs.find((r: any) => String(r.parameterCode).toLowerCase().includes('ec') || r.parameterCode === 5);

          const tempStr = tempReq
            ? `${tempReq.minValue}°C - ${tempReq.maxValue}°C (Mục tiêu: ${tempReq.targetValue}°C)`
            : (currentCrop?.optimalTemperatureMin !== null && currentCrop?.optimalTemperatureMin !== undefined && currentCrop?.optimalTemperatureMax
              ? `${currentCrop.optimalTemperatureMin}°C - ${currentCrop.optimalTemperatureMax}°C`
              : '20°C - 28°C');

          const humStr = humAirReq
            ? `${humAirReq.minValue}% - ${humAirReq.maxValue}%`
            : (humSoilReq
              ? `${humSoilReq.minValue}% - ${humSoilReq.maxValue}% (Đất)`
              : (currentCrop?.optimalSoilMoistureMin
                ? `${currentCrop.optimalSoilMoistureMin}% - ${currentCrop.optimalSoilMoistureMax}%`
                : '60% - 75%'));

          const nutritionStr = (ecReq || phReq)
            ? `${phReq ? `pH: ${phReq.minValue} - ${phReq.maxValue}` : ''}${phReq && ecReq ? ' | ' : ''}${ecReq ? `EC: ${ecReq.minValue} - ${ecReq.maxValue} mS/cm` : ''}`
            : (currentCrop?.optimalPhMin
              ? `pH: ${currentCrop.optimalPhMin} - ${currentCrop.optimalPhMax} | EC: ${currentCrop.optimalEcMin || 1.2} - ${currentCrop.optimalEcMax || 2.0} mS/cm`
              : 'N-P-K theo từng giai đoạn phát triển');

          const lightStr = luxReq
            ? `${luxReq.minValue.toLocaleString()} - ${luxReq.maxValue.toLocaleString()} ${luxReq.unit || 'Lux'}`
            : (currentCrop?.optimalLux
              ? `${currentCrop.optimalLux.toLocaleString()} Lux`
              : '10 - 14 giờ/ngày');

          const stagesStr = stages.length > 0
            ? stages.map((s: any) => s.name).join(' ➔ ')
            : 'Mầm ➔ Sinh trưởng ➔ Ra hoa ➔ Thu hoạch';

          const durationStr = `~${totalDays} ngày (${stages.length > 0 ? `${stages.length} giai đoạn` : 'Chu kỳ chuẩn'})`;
          const cropNote = currentCrop?.description || currentProfile?.description || `Quy trình canh tác chuẩn từ cơ sở dữ liệu cho ${currentCrop?.name || cropData.crop}.`;

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
                          const cleanName = c.name.split('(')[0].trim();
                          setCropData(prev => ({
                            ...prev,
                            crop: `${c.name}${c.scientificName ? ` (${c.scientificName})` : ''}`,
                            seasonName: `Vụ ${cleanName} Đông Xuân 2026-2027`,
                          }));
                          loadVarietiesAndProfiles(newCropId);
                        }
                      }}
                    >
                      {serverCrops.length > 0 ? (
                        serverCrops.map(c => (
                          <option key={c.cropId} value={c.cropId}>
                            {c.name} {c.scientificName ? `(${c.scientificName})` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="">Đang tải danh mục cây trồng...</option>
                      )}
                    </select>
                    {/* Dynamic Crop note badge from DB */}
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-900">
                      <Info size={13} className="shrink-0 text-emerald-700" />
                      <span>{cropNote}</span>
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
                        <option value="">Chưa có giống thương mại riêng</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Hồ sơ Sinh trưởng / Growth Profile (Từ Database) *</label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-[#119653] shadow-xs"
                      value={selectedProfileId}
                      onChange={e => {
                        const newProfileId = e.target.value;
                        setSelectedProfileId(newProfileId);
                        const prof = serverProfiles.find(p => (p.profileId || p.id) === newProfileId);
                        if (prof) {
                          const pStages = prof.stages || [];
                          const cycleDays = pStages.reduce((s: number, cur: any) => s + (Number(cur.durationDays) || 0), 0) || 90;
                          if (cropData.startDate) {
                            const d = new Date(cropData.startDate);
                            if (!isNaN(d.getTime())) {
                              d.setDate(d.getDate() + cycleDays);
                              setCropData(prev => ({ ...prev, expectedHarvestDate: d.toISOString().split('T')[0] }));
                            }
                          }
                        }
                      }}
                    >
                      {serverProfiles.length > 0 ? (
                        serverProfiles.map(p => (
                          <option key={p.profileId || p.id} value={p.profileId || p.id}>
                            {p.name} {p.isDefault ? '— [Mặc định]' : ''} ({p.stages?.length || 0} giai đoạn)
                          </option>
                        ))
                      ) : (
                        <option value="">Chưa có hồ sơ sinh trưởng cho giống này</option>
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
                      <Input
                        type="date"
                        value={cropData.startDate}
                        onChange={e => {
                          const newStart = e.target.value;
                          let newEnd = cropData.expectedHarvestDate;
                          if (newStart && totalDays > 0) {
                            const d = new Date(newStart);
                            if (!isNaN(d.getTime())) {
                              d.setDate(d.getDate() + totalDays);
                              newEnd = d.toISOString().split('T')[0];
                            }
                          }
                          setCropData(prev => ({ ...prev, startDate: newStart, expectedHarvestDate: newEnd }));
                        }}
                      />
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

                  {/* Crop Template info from DB */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2 text-[11px] text-slate-600 mt-3 shadow-2xs">
                    <div className="font-bold text-emerald-800 border-b border-emerald-100 pb-1.5 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sprout size={14} className="text-[#119653]" /> Chu kỳ sinh trưởng & Điều kiện ({currentProfile?.name || 'Hồ sơ DB'})
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        Dữ liệu DB / Backend
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-16 shrink-0 font-medium text-slate-500">Chu kỳ:</span>
                      <span className="text-slate-800 font-medium">{stagesStr}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-16 shrink-0 font-medium text-slate-500">Dinh dưỡng:</span>
                      <span className="text-slate-800">{nutritionStr}</span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Nhiệt độ:</span>
                        <span className="text-slate-800 font-medium">{tempStr}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Độ ẩm:</span>
                        <span className="text-slate-800 font-medium">{humStr}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Ánh sáng:</span>
                        <span className="text-slate-800">{lightStr}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-slate-500">Thời vụ:</span>
                        <span className="text-emerald-800 font-bold">{durationStr}</span>
                      </div>
                    </div>

                    {/* Detailed stages from DB */}
                    {stages.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="text-[10px] font-semibold text-slate-500">Các giai đoạn sinh trưởng chi tiết (DB):</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {stages.map((st: any, idx: number) => (
                            <div key={st.stageId || idx} className="flex items-center gap-1 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                              <span className="font-bold">{idx + 1}. {st.name}</span>
                              <span className="text-emerald-700 font-mono">({st.durationDays} ngày)</span>
                              {idx < stages.length - 1 && <span className="text-slate-400 font-bold">➔</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── THUẬT TOÁN TỔ ONG: ƯỚC TÍNH THIẾT BỊ IOT & CHI PHÍ LẮP ĐẶT ── */}
              <HoneycombEstimator
                areaM2={areaM2}
                cropName={cropData.crop}
                zoneName={zoneData.name}
              />
            </div>
          );
        })()}


        {/* STEP 5: REVIEW & SUBMIT SETUP (BEFORE SUBMISSION) */}
        {activeTab === 'REVIEW' && !wizardSuccessData && (() => {
          const selectedProf = serverProfiles.find(p => (p.profileId || p.id) === selectedProfileId);
          const reviewTotalDays = (selectedProf?.stages || []).reduce((acc: number, s: any) => acc + (Number(s.durationDays) || 0), 0) || 90;

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardCheck size={20} className="text-[#119653]" /> Bước 5: Xem lại & Xác nhận Cấu trúc Nông trang (Review & Confirm)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Vui lòng kiểm tra kỹ toàn bộ cấu trúc phân cấp trước khi gửi yêu cầu khởi tạo và cấp phát thiết bị IoT.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                  Bước 5 / 5
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Trang trại */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="font-bold text-emerald-950 flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                    <span className="flex items-center gap-1.5 text-sm">
                      <Building2 size={16} className="text-[#119653]" /> 1. Trang trại (Farm Level)
                    </span>
                    <button onClick={() => setActiveTab('FARM')} className="text-[11px] text-[#119653] hover:underline font-semibold">Sửa</button>
                  </div>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tên trang trại:</span>
                      <strong className="text-slate-900">{farmData.name || 'Trang trại mới'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tổng diện tích:</span>
                      <strong className="text-emerald-800">{Number(farmData.areaM2).toLocaleString('vi-VN')} m²</strong>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500 shrink-0">Địa chỉ:</span>
                      <span className="text-slate-800 text-right font-medium">{farmData.address || 'Đà Lạt, Lâm Đồng'}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px] pt-1 border-t border-emerald-100">
                      <span className="text-slate-500">Tọa độ GIS:</span>
                      <span className="text-slate-700">[{farmData.center[0].toFixed(5)}, {farmData.center[1].toFixed(5)}]</span>
                    </div>
                  </div>
                </div>

                {/* 2. Lô đất & Nhà màng */}
                <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2.5">
                  <div className="font-bold text-sky-950 flex items-center justify-between pb-1.5 border-b border-sky-200/60">
                    <span className="flex items-center gap-1.5 text-sm">
                      <MapPin size={16} className="text-sky-700" /> 2 & 3. Lô đất & Nhà màng (Field & Zone)
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTab('FIELD')} className="text-[11px] text-sky-700 hover:underline font-semibold">Sửa Lô</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => setActiveTab('ZONE')} className="text-[11px] text-sky-700 hover:underline font-semibold">Sửa Zone</button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lô đất mẹ:</span>
                      <strong className="text-slate-900">{fieldData.name} ({Number(fieldData.areaM2).toLocaleString('vi-VN')} m²)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Thổ nhưỡng Lô:</span>
                      <span className="text-slate-800 font-medium">Đất đỏ Bazan / Đất thịt (Loam)</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-sky-100">
                      <span className="text-slate-500">Nhà màng (Zone):</span>
                      <strong className="text-sky-900">{zoneData.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Diện tích Nhà màng:</span>
                      <strong className="text-emerald-800">{Number(zoneData.areaM2).toLocaleString('vi-VN')} m²</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mô hình:</span>
                      <span className="text-slate-800">Nhà kính công nghệ cao (Greenhouse)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Cây trồng & Vụ mùa */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5 md:col-span-2">
                  <div className="font-bold text-amber-950 flex items-center justify-between pb-1.5 border-b border-amber-200/60">
                    <span className="flex items-center gap-1.5 text-sm">
                      <Sprout size={16} className="text-amber-700" /> 4. Cây trồng, Giống & Kế hoạch Vụ mùa (Crop & Season)
                    </span>
                    <button onClick={() => setActiveTab('CROP_SEASON')} className="text-[11px] text-amber-700 hover:underline font-semibold">Sửa Vụ mùa</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                    <div>
                      <span className="text-slate-500 block">Cây trồng & Giống:</span>
                      <strong className="text-slate-900">{cropData.crop}</strong>
                      <div className="text-[11px] text-slate-600">Giống: {cropData.variety || 'Chuẩn'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tên Vụ mùa khởi tạo:</span>
                      <strong className="text-amber-900">{cropData.seasonName}</strong>
                      <div className="text-[11px] text-slate-600">Hồ sơ: {selectedProf?.name || 'Hồ sơ DB'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Lịch thời vụ:</span>
                      <div className="text-slate-900 font-semibold">{cropData.startDate} ➔ {cropData.expectedHarvestDate}</div>
                      <div className="text-[11px] text-emerald-700 font-bold">Dự kiến thu hoạch sau ~{reviewTotalDays} ngày</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice before submit */}
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5">
                <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-950 leading-relaxed">
                  <strong>Xác nhận gửi yêu cầu:</strong> Sau khi nhấn <strong>"Gửi Yêu cầu Cấu hình IoT cho Kỹ thuật viên"</strong>, hệ thống sẽ tự động lưu cấu trúc phân cấp (Trang trại ➔ Lô đất ➔ Nhà màng ➔ Vụ mùa) vào Database và chuyển tiếp Phiếu Yêu cầu sang bộ phận Kỹ thuật viên Platform (Platform Technician) để cấp phát thiết bị.
                </div>
              </div>
            </div>
          );
        })()}

        {/* STEP 5: SUCCESS & HAND-OFF SCREEN (ONLY AFTER SUCCESSFUL SUBMISSION) */}
        {activeTab === 'REVIEW' && wizardSuccessData && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center space-y-2 py-3">
              <div className="w-14 h-14 bg-emerald-100 text-[#119653] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Khởi tạo Cấu trúc Nông trang & Gửi Yêu cầu Kỹ thuật Thành công!
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Bàn giao thông tin Nông trang vừa thiết lập cho <strong>Kỹ thuật viên Platform (Platform Technician)</strong> để cấp phát Whitelist LoRa Gateway & Nodes.
              </p>
            </div>

            {/* System Generated IDs Card */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2.5">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={15} className="text-emerald-700" />
                Mã định danh Hệ thống đã khởi tạo (System Entity References):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-3 rounded-lg border border-emerald-200 text-slate-700">
                <div>Trang trại (Farm ID): <strong className="text-slate-900">{wizardSuccessData.farmId}</strong></div>
                <div>Lô đất (Field ID): <strong className="text-slate-900">{wizardSuccessData.fieldId || 'N/A'}</strong></div>
                <div>Nhà màng (Zone ID): <strong className="text-slate-900">{wizardSuccessData.zoneId || 'N/A'}</strong></div>
                <div>Vụ mùa (Season ID): <strong className="text-slate-900">{wizardSuccessData.seasonId || 'N/A'}</strong></div>
                <div className="sm:col-span-2 text-emerald-800 pt-1 border-t border-slate-100 font-bold">
                  📡 Phiếu Yêu cầu Cấp phát IoT ID: <span className="text-emerald-950 font-mono">{wizardSuccessData.deploymentRequestId || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Warning out of bounds */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="block mb-0.5">Chính sách Cảnh báo Vùng địa lý:</strong>
                Hệ thống sẽ <strong>phát cảnh báo trên web</strong> ngay lập tức khi phát hiện thiết bị (Gateway/Node) bị di chuyển hoặc đi ra ngoài ranh giới <strong>Khu trang trại / Khu nhà màng</strong> đã được đánh dấu GIS.
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

            {/* Action buttons after success */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => {
                  setWizardSuccessData(null);
                  setActiveTab('FARM');
                }}
                className="text-slate-700 text-xs w-full sm:w-auto"
              >
                <RefreshCw size={14} className="mr-1.5" /> Tạo thêm Trang trại khác
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={() => navigate('/owner/support')}
                  className="border-sky-300 text-sky-800 hover:bg-sky-50 text-xs"
                >
                  <Wrench size={14} className="mr-1.5" /> Xem Phiếu Yêu cầu Kỹ thuật
                </Button>
                <Button
                  onClick={() => navigate('/owner/farms')}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                >
                  Quản lý Trang trại & Phân khu <ArrowRight size={14} className="ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Wizard Footer Controls (Only show before successful submission) */}
        {!wizardSuccessData && (
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
        )}
      </div>
    </div>
  );
};
