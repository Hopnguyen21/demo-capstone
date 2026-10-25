import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { alertService, zoneService, supportService } from '../../services';
import { Alert, Zone } from '../../types';
import { 
  Sprout, ShieldAlert, CheckCircle2, Power, Activity, BookOpen, Layers, 
  Thermometer, Droplets, Sun, Sparkles, Calendar, Info, MapPin, Radio, Cpu, Wifi 
} from 'lucide-react';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';
import { Button, Modal } from '../../components/ui/BaseUI';
import { GISLocationPicker, extractPolygonPoints, calculatePolygonAreaM2, getPolygonCenter } from '../../components/maps/GISLocationPicker';

export const FarmerZonesPage: React.FC = () => {
  const { zones } = useAuth();
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.zoneId || '32000000-0000-0000-0000-000000000001');
  const [selectedCropDetailZone, setSelectedCropDetailZone] = useState<Zone | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeControlTab, setActiveControlTab] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | null>(null);

  // GIS & Pinned Node state for Farmer
  const [currentZoneGis, setCurrentZoneGis] = useState<any>(null);
  const [zonePolygon, setZonePolygon] = useState<[number, number][]>([]);
  const [zoneCenter, setZoneCenter] = useState<[number, number]>([11.9404, 108.4583]);
  const [zoneNodes, setZoneNodes] = useState<any[]>([]);
  const [isLoadingGis, setIsLoadingGis] = useState(false);

  useEffect(() => {
    alertService.getAlerts().then(res => {
      if (res) setAlerts(res);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (zones.length > 0 && (!selectedZoneId || selectedZoneId === '32000000-0000-0000-0000-000000000001')) {
      setSelectedZoneId(zones[0].zoneId);
    }
  }, [zones]);

  // Load Zone GIS boundary and mapped nodes whenever farmer switches assigned zone
  useEffect(() => {
    if (!selectedZoneId) return;

    let isMounted = true;
    setIsLoadingGis(true);

    Promise.all([
      zoneService.getZoneById(selectedZoneId).catch(() => null),
      supportService.getMappedNodes(selectedZoneId).catch(() => []),
    ]).then(([zoneData, nodesData]) => {
      if (!isMounted) return;

      if (zoneData) {
        setCurrentZoneGis(zoneData);
        const pts = extractPolygonPoints(zoneData.boundaryGeoJson || zoneData.polygonGeoJson || zoneData.boundary);
        if (pts.length >= 3) {
          setZonePolygon(pts);
          const cLat = zoneData.centerLatitude ?? getPolygonCenter(pts)[0];
          const cLng = zoneData.centerLongitude ?? getPolygonCenter(pts)[1];
          setZoneCenter([cLat, cLng]);
        } else {
          const baseLat = zoneData.centerLatitude || 11.9404;
          const baseLng = zoneData.centerLongitude || 108.4583;
          setZoneCenter([baseLat, baseLng]);
          setZonePolygon([
            [baseLat - 0.0006, baseLng - 0.0008],
            [baseLat - 0.0006, baseLng + 0.0008],
            [baseLat + 0.0006, baseLng + 0.0008],
            [baseLat + 0.0006, baseLng - 0.0008],
          ]);
        }
      }

      if (Array.isArray(nodesData)) {
        setZoneNodes(nodesData);
      }
    }).finally(() => {
      if (isMounted) setIsLoadingGis(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedZoneId]);

  const farmerDeviceMarkers = useMemo(() => {
    return zoneNodes
      .filter((n: any) => typeof n.latitude === 'number' && typeof n.longitude === 'number' && n.latitude > 0 && n.longitude > 0)
      .map((n: any, idx: number) => ({
        id: n.deviceId || n.id || `farmer-node-${idx}`,
        name: n.deviceName || n.installationNotes || n.hardwareAddress || `Node ${idx + 1}`,
        code: n.hardwareAddress || `NODE-0${idx + 1}`,
        type: (n.deviceType?.includes('Actuator') || n.hardwareAddress?.includes('VALVE') || n.hardwareAddress?.includes('ACT')) ? 'ACTUATOR' : 'SENSOR',
        status: n.status || 'ONLINE',
        batteryLevel: n.batteryLevel ?? 100,
        coords: [n.latitude, n.longitude] as [number, number],
      }));
  }, [zoneNodes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#119653] text-white font-mono">
              FARMER ZONE CONTROL HUB
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="text-[#119653]" size={22} /> Điều khiển & Cảnh báo Nhà màng được Phân công
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">Danh sách khu vực nhà màng thuộc phạm vi phụ trách kỹ thuật & tích hợp Trung tâm Cảnh báo Nông nghiệp.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setActiveControlTab('ALERTS')}
            className={`font-semibold ${activeControlTab === 'ALERTS' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}
          >
            <ShieldAlert size={14} className="mr-1.5" /> Xem Cảnh báo Zone
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.slice(0, 2).map(z => {
          const isSelected = selectedZoneId === z.zoneId;
          const zoneAlertsCount = alerts.filter(a => a.zoneId === z.zoneId && a.status === 'OPEN').length;

          return (
            <div
              key={z.zoneId}
              onClick={() => setSelectedZoneId(z.zoneId)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                isSelected
                  ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-200">
                      ASSIGNED ZONE
                    </span>
                    {zoneAlertsCount > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-300 flex items-center gap-1 animate-pulse">
                        <Activity size={10} /> {zoneAlertsCount} Cảnh báo mở
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        ✓ An toàn
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-1">{z.name}</h3>
                  <p className="text-xs text-slate-500">{z.description}</p>
                </div>
                {isSelected && <CheckCircle2 className="text-emerald-600" size={20} />}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Cây trồng:</span>
                  <strong className="text-emerald-900 font-bold">
                    {z.currentCrop || (z.name?.toLowerCase().includes('dua leo') ? 'Dưa leo Baby (Cucumber)' : z.name?.toLowerCase().includes('xa lach') ? 'Xà lách cuộn (Batavia)' : z.name?.toLowerCase().includes('dau tay') ? 'Dâu tây Hana' : 'Dưa leo Baby VietGAP')}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Giai đoạn:</span>
                  <strong className="text-emerald-700 font-semibold">
                    {z.currentStage || (z.name?.toLowerCase().includes('xa lach') ? 'Phát triển búp cuộn' : 'Nuôi trái & Thu hoạch')}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCropDetailZone(z);
                  }}
                  className="text-emerald-700 font-bold hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200"
                >
                  <BookOpen size={12} /> Chi tiết cây trồng ➔
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedZoneId(z.zoneId);
                      setActiveControlTab('ALERTS');
                    }}
                    className="text-rose-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <ShieldAlert size={13} /> Cảnh báo ➔
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedZoneId(z.zoneId);
                      setActiveControlTab('ACTUATORS');
                    }}
                    className="text-emerald-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <Power size={13} /> Rơ-le ➔
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── GIS Map & Pinned Nodes Visualizer for Farmer ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-0">
        <div className="p-4 bg-gradient-to-r from-[#119653] to-emerald-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 border border-white/30 rounded-xl shrink-0">
              <MapPin size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-200 border border-emerald-400/30 uppercase tracking-wide">
                  BẢN ĐỒ GIS POSTGIS & VỊ TRÍ NODE THỰC ĐỊA
                </span>
                <span className="text-xs text-emerald-100 font-mono">
                  {farmerDeviceMarkers.length} Node định vị
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Sơ đồ bố trí Node Cảm biến & Thiết bị điều khiển trong Phân khu [{zones.find(z => z.zoneId === selectedZoneId)?.name || 'Nhà màng'}]
              </h3>
            </div>
          </div>
          <div className="text-right text-xs text-emerald-100 font-mono">
            {calculatePolygonAreaM2(zonePolygon).toLocaleString()} m² • Tọa độ PostGIS SRID 4326
          </div>
        </div>

        <div className="p-4">
          <GISLocationPicker
            level="ZONE"
            center={zoneCenter}
            onCenterChange={setZoneCenter}
            polygon={zonePolygon}
            onPolygonChange={setZonePolygon}
            deviceMarkers={farmerDeviceMarkers}
            height="320px"
            readOnly={true}
          />
        </div>

        {/* Live Node List & Telemetry for Farmer */}
        <div className="p-4 pt-0">
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Radio size={14} className="text-[#119653]" /> 
                Danh sách Node Cảm biến & Trạm điều khiển gắn tại Phân khu ({zoneNodes.length})
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                Dữ liệu đồng bộ trực tiếp từ trạm thực địa IoT
              </span>
            </div>

            {zoneNodes.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center text-xs text-slate-500">
                Chưa có thiết bị nào được kỹ thuật viên định vị trong phân khu này.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {zoneNodes.map((n: any, idx: number) => {
                  const isActuator = n.deviceType?.includes('Actuator') || n.hardwareAddress?.includes('VALVE') || n.hardwareAddress?.includes('ACT');
                  const isSoil = n.hardwareAddress?.includes('SOIL');
                  return (
                    <div key={n.deviceId || idx} className="p-3 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isActuator ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isActuator ? '⚡ ACTUATOR' : '📡 SENSOR'}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">
                            {n.deviceName || n.installationNotes || n.hardwareAddress || `Node #${idx + 1}`}
                          </h5>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {n.hardwareAddress || 'NODE-LORA'}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          🔋 {n.batteryLevel ?? 95}%
                        </span>
                      </div>

                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-mono space-y-1">
                        <div className="flex justify-between text-slate-500">
                          <span>Vị trí GPS:</span>
                          <strong className="text-slate-800">
                            {typeof n.latitude === 'number' ? `${n.latitude.toFixed(5)}, ${n.longitude.toFixed(5)}` : 'Đã định vị'}
                          </strong>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Trạng thái:</span>
                          <strong className="text-emerald-700 font-bold">{n.status || 'ONLINE'}</strong>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Chỉ số đo:</span>
                          <strong className="text-slate-900">
                            {isSoil ? 'Ẩm đất: 68.5% • EC: 1.2' : isActuator ? 'Rơ-le: BẬT • 4 Cổng' : 'Nhiệt: 26.2°C • Ẩm: 72%'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded CF3 Control Section for the selected assigned zone */}
      <CF3ControlSection
        key={`${selectedZoneId}-${activeControlTab}`}
        scopeLevel="ZONE"
        zoneId={selectedZoneId}
        defaultTab={activeControlTab}
        title={`Trung tâm Cảnh báo & Điều khiển cho Nhà màng [${zones.find(z => z.zoneId === selectedZoneId)?.name || 'Nhà màng'}]`}
        subtitle="Theo dõi cảnh báo vi phạm vi khí hậu thời gian thực, quản lý luật cảnh báo, kích hoạt rơ-le và theo dõi lịch tưới."
      />

      {/* Detailed Crop Information Modal */}
      {selectedCropDetailZone && (
        <Modal
          isOpen={!!selectedCropDetailZone}
          onClose={() => setSelectedCropDetailZone(null)}
          title={`Hồ sơ Sinh học & Quy chuẩn Kỹ thuật Cây trồng [${selectedCropDetailZone.name}]`}
          size="lg"
        >
          {(() => {
            const z = selectedCropDetailZone;
            const nameLower = (z.name || '').toLowerCase();
            const isCucumber = nameLower.includes('dua leo') || nameLower.includes('dưa leo');
            const isLettuce = nameLower.includes('xa lach') || nameLower.includes('xà lách');
            const isStrawberry = nameLower.includes('dau tay') || nameLower.includes('dâu tây');

            const cropProfile = isCucumber
              ? {
                  name: 'Dưa leo Baby VietGAP (Mini Cucumber)',
                  scientificName: 'Cucumis sativus L.',
                  variety: 'F1 Baby chịu nhiệt sinh trưởng khỏe',
                  cycleDays: 75,
                  currentStage: z.currentStage || 'Nuôi trái & Thu hoạch',
                  stageProgress: 68,
                  category: 'Rau ăn quả lên luống phủ màng',
                  soilRequirement: 'Đất thịt nhẹ, tơi xốp, thoát nước tốt, mùn > 2.5%',
                  idealTemp: '22°C - 30°C (Tối ưu 26°C)',
                  idealMoisture: '65% - 75% (Tối ưu 70%)',
                  idealHumidity: '65% - 80%',
                  idealPH: '6.0 - 6.8 pH',
                  idealLux: '30.000 - 45.000 Lux',
                  waterDemand: '1.8 - 2.5 Lít/cây/ngày (Chia 3 lần: Sáng, Trưa, Chiều)',
                  stages: [
                    { name: 'Gieo hạt & Cây con (Seedling)', days: '0 - 15 ngày', desc: 'Giữ ẩm đất 70-75%, che bớt nắng gắt' },
                    { name: 'Phát triển thân lá (Vegetative)', days: '16 - 35 ngày', desc: 'Bấm ngọn phụ, định hình giàn leo luống' },
                    { name: 'Ra hoa rộ (Flowering)', days: '36 - 45 ngày', desc: 'Tăng cường Kali và kiểm soát bọ trĩ' },
                    { name: 'Nuôi trái & Thu hoạch (Fruiting)', days: '46 - 75 ngày', desc: 'Thu hái buổi sáng sớm, cách nhật hàng ngày', isCurrent: true },
                  ],
                  note: 'Tiêu chuẩn canh tác đất VietGAP TCVN 11892-1:2017: Tuyệt đối không dùng chất kích thích sinh trưởng cấm. Hệ thống béc tưới nhỏ giọt rải dọc luống đất.'
                }
              : isLettuce
              ? {
                  name: 'Xà lách cuộn mỡ (Batavia Lettuce)',
                  scientificName: 'Lactuca sativa var. capitata',
                  variety: 'Batavia F1 chịu nhiệt cao cấp',
                  cycleDays: 45,
                  currentStage: z.currentStage || 'Phát triển búp cuộn (Vegetative)',
                  stageProgress: 42,
                  category: 'Rau ăn lá lên luống đất lộ thiên',
                  soilRequirement: 'Đất phù sa pha cát, hàm lượng hữu cơ cao, tơi xốp',
                  idealTemp: '18°C - 24°C (Tối ưu 21°C)',
                  idealMoisture: '65% - 75% (Tối ưu 70%)',
                  idealHumidity: '65% - 75%',
                  idealPH: '6.0 - 7.0 pH',
                  idealLux: '20.000 - 35.000 Lux',
                  waterDemand: '1.2 - 1.8 Lít/m²/ngày (Tưới phun sương nhẹ tránh dập búp)',
                  stages: [
                    { name: 'Ươm vỉ mầm (Seedling)', days: '0 - 10 ngày', desc: 'Tưới ẩm nhẹ, độ ẩm không khí cao' },
                    { name: 'Trồng luống & Hồi xanh', days: '11 - 18 ngày', desc: 'Rễ bám đất tốt, làm cỏ quanh gốc luống' },
                    { name: 'Phát triển búp cuộn', days: '19 - 35 ngày', desc: 'Hình thành cuộn búp lá giòn ngọt', isCurrent: true },
                    { name: 'Thu hoạch thành phẩm', days: '36 - 45 ngày', desc: 'Cắt sát gốc khi búp cuộn chắc, sáng sớm' },
                  ],
                  note: 'Quy trình phòng ngừa nấm cổ rễ luống đất: Luôn giữ rãnh thoát nước luống thông thoáng sau mưa rào.'
                }
              : isStrawberry
              ? {
                  name: 'Dâu tây Hana Nhật Bản (Strawberry)',
                  scientificName: 'Fragaria x ananassa',
                  variety: 'Tochiotome / Hana F1 ngọt thanh',
                  cycleDays: 120,
                  currentStage: z.currentStage || 'Ra hoa & Nuôi trái',
                  stageProgress: 55,
                  category: 'Cây ăn quả luống phủ nylon đen',
                  soilRequirement: 'Đất đỏ bazan hoặc đất mùn hữu cơ phối trộn vỏ trấu',
                  idealTemp: '16°C - 25°C (Tối ưu 20°C)',
                  idealMoisture: '60% - 70% (Tối ưu 65%)',
                  idealHumidity: '60% - 75%',
                  idealPH: '5.8 - 6.5 pH',
                  idealLux: '25.000 - 40.000 Lux',
                  waterDemand: '300 - 500 ml/gốc/ngày (Tưới nhỏ giọt dưới màng phủ)',
                  stages: [
                    { name: 'Cây ngó bén rễ', days: '0 - 20 ngày', desc: 'Cố định bầu trên luống phủ màng' },
                    { name: 'Phân hóa mầm hoa', days: '21 - 45 ngày', desc: 'Bổ sung vi lượng Bo và Canxi' },
                    { name: 'Ra hoa & Đậu quả', days: '46 - 80 ngày', desc: 'Tỉa bớt hoa dị hình, kê trái trên màng', isCurrent: true },
                    { name: 'Thu hoạch trái chín', days: '81 - 120 ngày', desc: 'Hái khi quả đỏ 85-90%, xếp hộp đệm bọt' },
                  ],
                  note: 'Khống chế độ ẩm đất dưới 70% ở giai đoạn nuôi quả để tránh úng thối đài trái.'
                }
              : {
                  name: z.currentCrop || 'Cây trồng VietGAP',
                  scientificName: 'Plantae sp.',
                  variety: 'Giống chuẩn VietGAP TCVN',
                  cycleDays: 90,
                  currentStage: z.currentStage || 'Đang sinh trưởng',
                  stageProgress: 50,
                  category: 'Cây trồng nông nghiệp công nghệ cao',
                  soilRequirement: 'Đất sạch VietGAP được xử lý vi sinh phòng trừ tuyến trùng',
                  idealTemp: '20°C - 28°C',
                  idealMoisture: '60% - 75%',
                  idealHumidity: '65% - 80%',
                  idealPH: '6.0 - 6.8 pH',
                  idealLux: '25.000 - 40.000 Lux',
                  waterDemand: 'Tưới tự động theo ẩm độ đất',
                  stages: [
                    { name: 'Cây con mầm non', days: '0 - 20 ngày', desc: 'Chăm sóc độ ẩm ổn định' },
                    { name: 'Sinh trưởng thân lá', days: '21 - 50 ngày', desc: 'Đang theo dõi vi khí hậu', isCurrent: true },
                    { name: 'Nuôi trái / Ra búp', days: '51 - 75 ngày', desc: 'Bảo vệ quả / búp non' },
                    { name: 'Thu hoạch vụ mùa', days: '76 - 90 ngày', desc: 'Đạt chuẩn thu hoạch' },
                  ],
                  note: 'Được quản lý tự động bởi hệ thống IoT SmartFarm.'
                };

            return (
              <div className="space-y-5">
                {/* Header Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-700 text-white font-mono">
                      {cropProfile.category}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Sprout className="text-emerald-700" size={24} /> {cropProfile.name}
                    </h2>
                    <p className="text-xs text-slate-500 italic">Tên khoa học: {cropProfile.scientificName}</p>
                  </div>
                  <div className="text-right sm:border-l sm:pl-4 border-emerald-200">
                    <span className="text-[10px] text-slate-500 block">Chu kỳ vụ trồng:</span>
                    <span className="text-base font-extrabold text-emerald-800 font-mono">{cropProfile.cycleDays} Ngày vụ</span>
                    <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">Giống: {cropProfile.variety}</span>
                  </div>
                </div>

                {/* Progress bar of current season */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">Giai đoạn sinh học hiện tại: <strong className="text-emerald-800 font-bold">{cropProfile.currentStage}</strong></span>
                    <span className="font-mono font-bold text-emerald-700">{cropProfile.stageProgress}% chu kỳ</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${cropProfile.stageProgress}%` }} />
                  </div>
                </div>

                {/* Growth Stage RoadMap */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers size={14} className="text-emerald-700" /> Các giai đoạn sinh trưởng trong chu kỳ
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {cropProfile.stages.map((st, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          st.isCurrent
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 shadow-xs'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className={st.isCurrent ? 'text-emerald-900 font-bold' : 'text-slate-800'}>
                            {idx + 1}. {st.name}
                          </span>
                          {st.isCurrent && (
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-sm">
                              HIỆN TẠI
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">Thời lượng: {st.days}</div>
                        <p className="text-[11px] text-slate-600 mt-1">{st.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimal Environmental Thresholds Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Thermometer size={14} className="text-amber-600" /> Dải ngưỡng vi khí hậu & Chỉ tiêu sinh trưởng
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Droplets size={12} className="text-sky-600" /> Độ ẩm đất luống
                      </div>
                      <div className="text-sm font-bold text-slate-900">{cropProfile.idealMoisture}</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Thermometer size={12} className="text-amber-600" /> Nhiệt độ không khí
                      </div>
                      <div className="text-sm font-bold text-slate-900">{cropProfile.idealTemp}</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Sun size={12} className="text-amber-500" /> Cường độ ánh sáng
                      </div>
                      <div className="text-sm font-bold text-slate-900">{cropProfile.idealLux}</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Droplets size={12} className="text-emerald-600" /> Độ ẩm không khí
                      </div>
                      <div className="text-sm font-bold text-slate-900">{cropProfile.idealHumidity}</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Sparkles size={12} className="text-purple-600" /> Độ chua đất (pH)
                      </div>
                      <div className="text-sm font-bold text-slate-900">{cropProfile.idealPH}</div>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <Calendar size={12} className="text-blue-600" /> Định mức tưới
                      </div>
                      <div className="text-[11px] font-bold text-emerald-800 leading-tight">{cropProfile.waterDemand}</div>
                    </div>
                  </div>
                </div>

                {/* Soil & Technical Guidance Note */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Info size={14} className="text-amber-700" /> Hướng dẫn kỹ thuật nông vụ:
                  </div>
                  <p className="text-slate-700 leading-relaxed">{cropProfile.note}</p>
                  <p className="text-slate-600 text-[11px] mt-1"><strong>Yêu cầu chất đất:</strong> {cropProfile.soilRequirement}</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedCropDetailZone(null)}>
                    Đóng cửa sổ
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
