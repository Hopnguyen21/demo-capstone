import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ServiceRequest, SensorNode } from '../../types';
import { MapPin, Cpu, Radio, Zap, CheckCircle2, Plus, Info, Layers, RefreshCw, Maximize2, Move, Trash2, Crosshair } from 'lucide-react';
import { Button } from '../ui/BaseUI';

interface ZoneNodeMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onSaveMapping?: (mappedCount: number) => void;
  selectedHardwareItems?: any[];
}

interface UnassignedDevice {
  deviceId: string;
  code: string;
  name: string;
  type: 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP';
  mac: string;
}

// Custom Marker Pin for Nodes on Leaflet GIS Map
const createNodePinIcon = (code: string, isSelected: boolean) => {
  const isGw = code.includes('GW');
  const bg = isGw ? '#f59e0b' : isSelected ? '#10b981' : '#0284c7';
  return L.divIcon({
    className: 'custom-node-pin-wrapper',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
        <div style="
          background-color: ${bg};
          width: 24px;
          height: 24px;
          border-radius: ${isGw ? '6px' : '50%'};
          border: 2.5px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width:6px; height:6px; background:white; border-radius:50%;"></div>
        </div>
        <div style="
          position: absolute;
          top: -22px;
          background: #062326;
          color: #34d399;
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(52, 211, 153, 0.4);
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${code}</div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Map Controller for click events and auto fit zoom
const MapEventsAndFitter: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
  fitKey: number;
  nodes: SensorNode[];
  center: [number, number];
}> = ({ onMapClick, fitKey, nodes, center }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
    },
  });

  useEffect(() => {
    if (fitKey === 0) return;
    if (nodes && nodes.length > 0) {
      const bounds = L.latLngBounds(nodes.map(n => [n.latitude, n.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, 17);
    }
  }, [fitKey]);

  return null;
};

// Single Draggable Node Pin Component on Leaflet GIS Map
const DraggableNodeMarker: React.FC<{
  node: SensorNode;
  index: number;
  isSelected: boolean;
  onSelect: (node: SensorNode) => void;
  onDragEnd: (nodeId: string, newLat: number, newLng: number) => void;
  onUnmap: (node: SensorNode) => void;
}> = ({ node, index, isSelected, onSelect, onDragEnd, onUnmap }) => {
  const position: [number, number] = [node.latitude, node.longitude];

  const eventHandlers = useMemo(
    () => ({
      click() {
        onSelect(node);
      },
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const pos = marker.getLatLng();
          onDragEnd(node.nodeId, parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
        }
      },
    }),
    [node, onSelect, onDragEnd]
  );

  return (
    <Marker
      position={position}
      icon={createNodePinIcon(node.nodeCode, isSelected)}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="p-1.5 space-y-2 text-slate-800 text-xs min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-bold text-[#062326] flex items-center gap-1 font-mono">
              <Cpu size={13} /> #{index + 1} {node.nodeCode}
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
              {node.status}
            </span>
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">{node.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">MAC: {node.serialNumber}</div>
            <div className="text-[11px] text-slate-600 font-mono mt-1">
              GIS: [{node.latitude.toFixed(6)}, {node.longitude.toFixed(6)}]
            </div>
          </div>
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-amber-700 italic flex items-center gap-0.5">
              <Move size={10} /> Kéo thả ghim để di chuyển
            </span>
            <button
              onClick={() => onUnmap(node)}
              className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-0.5"
            >
              <Trash2 size={11} /> Gỡ Node
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

export const ZoneNodeMapperModal: React.FC<ZoneNodeMapperModalProps> = ({
  isOpen,
  onClose,
  request,
  onSaveMapping,
  selectedHardwareItems,
}) => {
  const center: [number, number] = [11.9404, 108.4583];
  const [mapType, setMapType] = useState<'osm' | 'street' | 'satellite'>('osm');
  const [fitKey, setFitKey] = useState(0);

  // Zone Boundary Polygon Coordinates (Da Lat Greenhouse 01)
  const zonePolygonCoords: [number, number][] = [
    [11.9408, 108.4578],
    [11.9408, 108.4590],
    [11.9400, 108.4590],
    [11.9400, 108.4578],
  ];

  // Existing nodes in this zone / request (with real GIS coordinates)
  const [nodes, setNodes] = useState<SensorNode[]>([
    {
      nodeId: 'mapped-node-1',
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01 - Cà chua',
      name: 'Node Cảm biến Độ ẩm Đất - Hàng A1',
      nodeCode: 'SN-SOIL-01',
      serialNumber: 'SN-2026-SL-01',
      latitude: 11.9405,
      longitude: 108.4581,
      status: 'ONLINE',
      firmwareVersion: 'v2.4.1',
      batteryLevel: 98,
      rssi: -72,
      lastSeenAt: 'Vừa xong',
      sensorsCount: 2,
      actuatorsCount: 0,
    },
    {
      nodeId: 'mapped-node-2',
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01 - Cà chua',
      name: 'Node Cảm biến Vi khí hậu AirTemp',
      nodeCode: 'SN-AIR-02',
      serialNumber: 'SN-2026-AIR-02',
      latitude: 11.9402,
      longitude: 108.4587,
      status: 'ONLINE',
      firmwareVersion: 'v2.4.1',
      batteryLevel: 92,
      rssi: -68,
      lastSeenAt: 'Vừa xong',
      sensorsCount: 2,
      actuatorsCount: 1,
    }
  ]);

  // Unassigned devices ready to be pinned on GIS Map
  const [unassignedDevices, setUnassignedDevices] = useState<UnassignedDevice[]>([
    { deviceId: 'dev-01', code: 'GW-ESP32-NEW', name: 'Gateway LoRa Central ESP32-S3', type: 'GATEWAY', mac: '24:DC:C3:88:99:A1' },
    { deviceId: 'dev-02', code: 'SN-NPK-EC-03', name: 'Node Cảm biến NPK & Độ dẫn điện EC', type: 'SOIL_SENSOR', mac: '24:DC:C3:11:22:33' },
    { deviceId: 'dev-03', code: 'ACT-VALVE-V2', name: 'Node Cụm Van Điện từ Phun sương V2', type: 'VALVE', mac: '24:DC:C3:44:55:66' },
  ]);

  useEffect(() => {
    if (selectedHardwareItems && selectedHardwareItems.length > 0) {
      const convertedUnassigned: UnassignedDevice[] = selectedHardwareItems.map((item, idx) => ({
        deviceId: item.id || `dev-${idx}`,
        code: item.code,
        name: item.name,
        type: (item.category === 'VALVE' || item.category === 'PUMP' ? 'VALVE' : item.category === 'GATEWAY' ? 'GATEWAY' : 'SOIL_SENSOR'),
        mac: item.mac || item.serialNumber,
      }));
      setUnassignedDevices(convertedUnassigned);
      setSelectedDevice(convertedUnassigned[0] || null);
    }
  }, [selectedHardwareItems]);

  const [selectedDevice, setSelectedDevice] = useState<UnassignedDevice | null>(unassignedDevices[0] || null);
  const [activePinNode, setActivePinNode] = useState<SensorNode | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const getTileConfig = () => {
    switch (mapType) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        };
      case 'street':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China, TomTom',
        };
      case 'osm':
      default:
        return {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        };
    }
  };

  const currentTile = getTileConfig();

  // Handle clicking on GIS map to pin node
  const handleMapClick = (lat: number, lng: number) => {
    if (!selectedDevice) return;

    const newNode: SensorNode = {
      nodeId: `mapped-node-${Date.now()}`,
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01',
      name: selectedDevice.name,
      nodeCode: selectedDevice.code,
      serialNumber: selectedDevice.mac,
      latitude: lat,
      longitude: lng,
      status: 'ONLINE',
      firmwareVersion: 'v3.0.0-PROV',
      batteryLevel: 100,
      rssi: -65,
      lastSeenAt: 'Vừa chấm vị trí GIS',
      sensorsCount: selectedDevice.type.includes('SENSOR') ? 2 : 0,
      actuatorsCount: selectedDevice.type === 'VALVE' || selectedDevice.type === 'PUMP' ? 1 : 0,
    };

    setNodes(prev => [...prev, newNode]);
    const updatedUnassigned = unassignedDevices.filter(d => d.deviceId !== selectedDevice.deviceId);
    setUnassignedDevices(updatedUnassigned);
    setSelectedDevice(updatedUnassigned[0] || null);

    setSuccessToast(`Đã chấm Node GIS thành công: [${newNode.name}] tại tọa độ (${lat}, ${lng})!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleDragNodeEnd = (nodeId: string, newLat: number, newLng: number) => {
    setNodes(prev =>
      prev.map(n => (n.nodeId === nodeId ? { ...n, latitude: newLat, longitude: newLng } : n))
    );
  };

  const handleUnmapNode = (targetNode: SensorNode) => {
    setNodes(prev => prev.filter(n => n.nodeId !== targetNode.nodeId));
    setUnassignedDevices(prev => [
      ...prev,
      {
        deviceId: targetNode.nodeId,
        code: targetNode.nodeCode,
        name: targetNode.name,
        type: targetNode.nodeCode.includes('GW') ? 'GATEWAY' : 'SOIL_SENSOR',
        mac: targetNode.serialNumber,
      },
    ]);
    if (activePinNode?.nodeId === targetNode.nodeId) {
      setActivePinNode(null);
    }
  };

  const handleSave = () => {
    if (onSaveMapping) {
      onSaveMapping(nodes.length);
    }
    onClose();
  };

  if (!isOpen) return null;

  const isMaintenance = request.requestType === 'MAINTENANCE' || request.requestType === 'REPAIR' || request.requestType === 'REPLACEMENT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <MapPin size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isMaintenance ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isMaintenance ? 'BẢO TRÌ & THAY THẾ NODE' : 'LẮP ĐẶT MỚI & CHẤM NODE GIS'}
                </span>
                <span className="text-xs text-slate-300 font-mono">Request #{request.serviceRequestId}</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Chấm Node & Định vị Thiết bị tại Zone: <span className="text-emerald-300">{request.zoneName || 'Nhà màng Z01'}</span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            ✕
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 size={16} /> {successToast}
          </div>
        )}

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-4 flex-1 overflow-hidden">
          {/* Left Panel: Unassigned Equipment List */}
          <div className="lg:col-span-1 p-4 bg-slate-50 border-r border-slate-200 overflow-y-auto space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Cpu size={14} className="text-[#062326]" /> Thiết bị Chờ Chấm Node ({unassignedDevices.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Chọn thiết bị bên dưới, sau đó nhấp vào vị trí bất kỳ trên bản đồ GIS Phân khu để biến thành Node active.
              </p>
            </div>

            {unassignedDevices.length === 0 ? (
              <div className="p-4 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
                <span className="font-bold">Đã chấm hết thiết bị!</span>
                <p className="text-[11px] text-emerald-700 mt-1">Tất cả vật tư đã được chuyển đổi thành các Node định vị trên bản đồ GIS.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedDevices.map(dev => {
                  const isSelected = selectedDevice?.deviceId === dev.deviceId;
                  return (
                    <div
                      key={dev.deviceId}
                      onClick={() => setSelectedDevice(dev)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#062326] text-white border-[#062326] shadow-md ring-2 ring-emerald-400'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {dev.code}
                        </span>
                        {isSelected && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold">ĐANG CHỌN</span>}
                      </div>
                      <h4 className="font-bold text-xs mt-1.5">{dev.name}</h4>
                      <p className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        MAC: {dev.mac}
                      </p>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Simulate getting GPS from phone
                            const simLat = 11.9400 + Math.random() * 0.0008;
                            const simLng = 108.4578 + Math.random() * 0.0012;
                            handleMapClick(parseFloat(simLat.toFixed(6)), parseFloat(simLng.toFixed(6)));
                          }}
                          className="mt-2 w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <Crosshair size={12} /> Lấy GPS điện thoại để chấm Node
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instruction Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <strong className="flex items-center gap-1 text-emerald-800">
                <Info size={13} /> Quy trình Chấm Node GIS:
              </strong>
              <p className="text-emerald-800/90 leading-relaxed">
                1. Chọn thiết bị vật tư bên trái.<br />
                2. Nhấp trực tiếp lên bản đồ GIS hoặc <strong>bấm "Lấy GPS điện thoại"</strong> khi đang đứng tại hiện trường.<br />
                3. Giữ chuột kéo ghim để di chuyển.<br />
                4. Bấm "Lưu Sơ đồ Node".
              </p>
            </div>
          </div>

          {/* Center Main: Interactive Leaflet GIS Map Canvas */}
          <div className="lg:col-span-3 p-4 bg-slate-100 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Layers size={15} className="text-[#062326]" /> Bản đồ GIS Định vị Phân khu (Interactive GIS Map)
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold border border-emerald-300">
                  {nodes.length} Node Đã Định Vị
                </span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                {selectedDevice ? `👉 Đang chọn [${selectedDevice.code}]. Nhấp lên bản đồ GIS để chấm Node!` : 'Kéo ghim hoặc nhấp vào Node để xem chi tiết'}
              </span>
            </div>

            {/* Canvas Interactive Container */}
            <div className="relative w-full h-[400px] rounded-2xl border border-slate-300 overflow-hidden shadow-inner select-none">
              {/* Map Controls Overlay */}
              <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
                <button
                  onClick={() => setFitKey(k => k + 1)}
                  title="Căn vừa ranh giới Node (Fit Zoom)"
                  className="bg-white/95 hover:bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 shadow-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Maximize2 size={13} className="text-emerald-600" />
                  <span>Căn Zoom</span>
                </button>

                <div className="bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 text-xs flex items-center gap-1 shadow-md">
                  <button
                    onClick={() => setMapType('osm')}
                    className={`px-2 py-1 rounded transition-colors ${mapType === 'osm' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    OSM
                  </button>
                  <button
                    onClick={() => setMapType('street')}
                    className={`px-2 py-1 rounded transition-colors ${mapType === 'street' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    Đường phố
                  </button>
                  <button
                    onClick={() => setMapType('satellite')}
                    className={`px-2 py-1 rounded transition-colors ${mapType === 'satellite' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    Vệ tinh
                  </button>
                </div>
              </div>

              {/* Legend Overlay */}
              <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 shadow-xs flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Node Cảm biến</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Gateway</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-500/30 border border-sky-600 border-dashed" /> Ranh giới Nhà màng</div>
              </div>

              {/* Leaflet GIS Map */}
              <MapContainer
                center={center}
                zoom={17}
                scrollWheelZoom={true}
                zoomControl={true}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  key={mapType}
                  attribution={currentTile.attribution}
                  url={currentTile.url}
                  maxZoom={19}
                />

                <MapEventsAndFitter
                  onMapClick={handleMapClick}
                  fitKey={fitKey}
                  nodes={nodes}
                  center={center}
                />

                {/* Zone Boundary Polygon */}
                <Polygon
                  positions={zonePolygonCoords}
                  pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.15, weight: 2, dashArray: '4, 4' }}
                />

                {/* Placed Nodes Markers (Draggable) */}
                {nodes.map((node, index) => (
                  <DraggableNodeMarker
                    key={node.nodeId}
                    node={node}
                    index={index}
                    isSelected={activePinNode?.nodeId === node.nodeId}
                    onSelect={setActivePinNode}
                    onDragEnd={handleDragNodeEnd}
                    onUnmap={handleUnmapNode}
                  />
                ))}
              </MapContainer>
            </div>

            {/* Selected Node Details Bar */}
            {activePinNode && (
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{activePinNode.name}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                      {activePinNode.nodeCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    MAC: {activePinNode.serialNumber} • GIS: [{activePinNode.latitude.toFixed(6)}, {activePinNode.longitude.toFixed(6)}] • Pin: {activePinNode.batteryLevel}% • RSSI: {activePinNode.rssi}dBm
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUnmapNode(activePinNode)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline px-2 py-1"
                  >
                    Gỡ Node khỏi GIS
                  </button>
                  <Button size="sm" variant="outline" onClick={() => setActivePinNode(null)}>
                    Đóng
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300">
            Tổng số Node đã chấm trong Zone: <strong className="text-emerald-400 font-mono text-sm">{nodes.length} Nodes</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
              Hủy
            </Button>
            <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
              <CheckCircle2 size={16} className="mr-1.5" /> Lưu Sơ đồ & Cập nhật Trạng thái Node
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
