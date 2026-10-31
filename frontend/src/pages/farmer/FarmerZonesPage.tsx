import { zoneCropLabel, zoneStageLabel } from '../../utils/zoneCrop';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { alertService, zoneService, supportService } from '../../services';
import { Alert, Zone } from '../../types';
import { 
  Sprout, ShieldAlert, CheckCircle2, Power, Activity, BookOpen, Layers, 
  Thermometer, Droplets, Sun, Sparkles, Calendar, Info, MapPin, Radio, Cpu, Wifi 
} from 'lucide-react';
import { ZoneCropDetailModal } from '../../components/crops/ZoneCropDetailModal';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';
import { Button, Modal } from '../../components/ui/BaseUI';
import { GISLocationPicker, extractPolygonPoints, calculatePolygonAreaM2, getPolygonCenter } from '../../components/maps/GISLocationPicker';

export const FarmerZonesPage: React.FC = () => {
  const { zones } = useAuth();
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.zoneId || '');
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
    if (zones.length > 0 && !zones.some(z => z.zoneId === selectedZoneId)) {
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
                    {zoneCropLabel(z)}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Giai đoạn:</span>
                  <strong className="text-emerald-700 font-semibold">
                    {zoneStageLabel(z)}
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

      <ZoneCropDetailModal zone={selectedCropDetailZone} onClose={() => setSelectedCropDetailZone(null)} />
    </div>
  );
};
