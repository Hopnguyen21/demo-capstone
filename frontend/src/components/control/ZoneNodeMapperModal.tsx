import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ServiceRequest, SensorNode } from '../../types';
import { 
  MapPin, Cpu, Radio, Zap, CheckCircle2, Plus, Info, Layers, 
  RefreshCw, Maximize2, Minimize2, Move, Trash2, Crosshair, Database, 
  Sparkles, Check, Droplets, BatteryCharging, Wifi
} from 'lucide-react';
import { Button } from '../ui/BaseUI';
import { supportService, zoneService, fieldService } from '../../services';
import { extractPolygonPoints, calculatePolygonAreaM2 } from '../maps/GISLocationPicker';

interface ZoneNodeMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onSaveMapping?: (nodes: SensorNode[], mappedCount: number) => Promise<void> | void;
  selectedHardwareItems?: any[];
}

interface UnassignedDevice {
  deviceId: string;
  code: string;
  name: string;
  type: 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP';
  mac: string;
}

// ─── Custom Leaflet Pins ────────────────────────────────────────────────────────

const createCenterPinIcon = () =>
  L.divIcon({
    className: 'custom-center-pin-wrapper',
    html: `
      <div style="
        background-color: #119653;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
      ">
        <div style="color: white; font-size: 11px; font-weight: 800; font-family: monospace;">C</div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const createVertexPinIcon = (index: number) =>
  L.divIcon({
    className: 'custom-vertex-pin-wrapper',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
        <div style="
          background-color: #10b981;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
        <div style="
          position: absolute;
          top: -20px;
          background: #119653;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid rgba(52, 211, 153, 0.4);
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">#${index + 1}</div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const createNodePinIcon = (code: string, isSelected: boolean) => {
  const isGw = code.includes('GW');
  const isActuator = code.includes('VALVE') || code.includes('ACT') || code.includes('PUMP');
  const bg = isGw ? '#f59e0b' : isActuator ? '#0284c7' : isSelected ? '#10b981' : '#059669';

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
          box-shadow: 0 4px 12px rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
        ">
          ${isGw ? '📻' : isActuator ? '⚡' : '📡'}
        </div>
        <div style="
          position: absolute;
          top: -22px;
          background: #0f172a;
          color: #34d399;
          font-size: 9px;
          font-weight: 700;
          font-family: monospace;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(52, 211, 153, 0.4);
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
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
  polygon: [number, number][];
  center: [number, number];
}> = ({ onMapClick, fitKey, polygon, center }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
    },
  });

  useEffect(() => {
    if (fitKey === 0) return;
    if (polygon && polygon.length >= 3) {
      const bounds = L.latLngBounds(polygon);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, 17);
    }
  }, [fitKey]);

  return null;
};

// Vertex Marker component
const DraggableVertexMarker: React.FC<{
  position: [number, number];
  index: number;
  onDragEnd: (index: number, newLat: number, newLng: number) => void;
}> = ({ position, index, onDragEnd }) => {
  const eventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const pos = marker.getLatLng();
          onDragEnd(index, parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
        }
      },
    }),
    [index, onDragEnd]
  );

  return (
    <Marker
      position={position}
      icon={createVertexPinIcon(index)}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="text-xs font-semibold p-1">
          <span className="text-[#119653] font-bold block">Đỉnh ranh giới #{index + 1} của Zone</span>
          <span className="font-mono text-[10px] text-slate-500">[{position[0]}, {position[1]}]</span>
        </div>
      </Popup>
    </Marker>
  );
};

// Node Marker on GIS map
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
        <div className="p-2 space-y-2 text-slate-800 text-xs min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <span className="font-bold text-[#119653] flex items-center gap-1 font-mono">
              <Cpu size={14} /> #{index + 1} {node.nodeCode}
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              {node.status}
            </span>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-xs">{node.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">MAC: {node.serialNumber}</div>
            <div className="text-[11px] text-slate-600 font-mono">
              Tọa độ GIS: [{node.latitude.toFixed(6)}, {node.longitude.toFixed(6)}]
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-amber-700 italic flex items-center gap-0.5">
              <Move size={10} /> Kéo ghim để dời vị trí
            </span>
            <button
              type="button"
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

// Default Contract Items (7 items matching official quotation)
const DEFAULT_CONTRACT_ITEMS = [
  {
    id: 'item-valve-01',
    code: 'ACT-VALVE-01',
    name: 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng',
    unit: 'Bộ',
    unitPrice: 2150000,
    vatPercent: 8,
    quantity: 2,
    totalAmount: 4644000,
    notes: '4 Relay 12V/24V, Hỗ trợ phản hồi trạng thái công tắc',
    isSelected: true,
  },
  {
    id: 'item-gw-01',
    code: 'GW-ESP32-DL01',
    name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
    unit: 'Trạm',
    unitPrice: 3800000,
    vatPercent: 8,
    quantity: 1,
    totalAmount: 4104000,
    notes: 'LoRa 915MHz, Chống nước IP67, Bảo hành 24 tháng',
    isSelected: true,
  },
  {
    id: 'item-air-02',
    code: 'SN-AIR-02',
    name: 'Node Cảm biến Vi khí hậu Không khí SHT30',
    unit: 'Node',
    unitPrice: 950000,
    vatPercent: 8,
    quantity: 2,
    totalAmount: 2052000,
    notes: 'Sensirion SHT30, Đo Nhiệt độ, Độ ẩm & CO2',
    isSelected: true,
  },
  {
    id: 'item-soil-01',
    code: 'SN-SOIL-01',
    name: 'Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe',
    unit: 'Node',
    unitPrice: 1250000,
    vatPercent: 8,
    quantity: 2,
    totalAmount: 2700000,
    notes: 'Đầu đo 3-in-1 (Nhiệt, Ẩm, EC Đất), Giảm 5%',
    isSelected: true,
  },
];

const determineDeviceType = (code?: string, category?: string, name?: string): 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP' => {
  const upper = `${code || ''} ${category || ''} ${name || ''}`.toUpperCase();
  if (upper.includes('GW') || upper.includes('GATEWAY') || upper.includes('TRẠM CENTRAL')) return 'GATEWAY';
  if (upper.includes('VALVE') || upper.includes('VAN') || upper.includes('SOLENOID')) return 'VALVE';
  if (upper.includes('PUMP') || upper.includes('BƠM')) return 'PUMP';
  if (upper.includes('AIR') || upper.includes('KHÔNG KHÍ') || upper.includes('SHT30')) return 'AIR_SENSOR';
  if (upper.includes('SOIL') || upper.includes('ĐẤT') || upper.includes('RS485')) return 'SOIL_SENSOR';
  return 'SOIL_SENSOR';
};

const generateMacAddress = (code: string, index: number = 1): string => {
  const upper = (code || '').toUpperCase();
  if (upper.includes('GW')) return `24:DC:C3:88:00:${String(index).padStart(2, '0')}`;
  if (upper.includes('VALVE')) return `24:DC:C3:44:01:${String(index).padStart(2, '0')}`;
  if (upper.includes('AIR')) return `24:DC:C3:77:02:${String(index).padStart(2, '0')}`;
  if (upper.includes('SOIL')) return `24:DC:C3:66:01:${String(index).padStart(2, '0')}`;
  return `24:DC:C3:11:00:${String(index).padStart(2, '0')}`;
};

const expandContractDevices = (rawItems: any[]): UnassignedDevice[] => {
  const items = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : DEFAULT_CONTRACT_ITEMS;
  const list: UnassignedDevice[] = [];

  items.forEach((item: any, itemIdx: number) => {
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
    const baseCode = item.code || item.hardwareItemCode || `DEV-${itemIdx + 1}`;
    const baseName = item.name || item.hardwareItemName || 'Thiết bị Hợp đồng';
    const type = determineDeviceType(baseCode, item.category, baseName);

    for (let q = 1; q <= qty; q++) {
      const code = qty > 1 ? `${baseCode} #${q}` : baseCode;
      const name = qty > 1 ? `${baseName} (#${q})` : baseName;
      const mac = item.mac || item.macAddress || generateMacAddress(baseCode, q);
      const devId = `contract-node-${item.id || baseCode}-${q}`;

      list.push({
        deviceId: devId,
        code,
        name,
        type,
        mac,
      });
    }
  });

  return list;
};

export const ZoneNodeMapperModal: React.FC<ZoneNodeMapperModalProps> = ({
  isOpen,
  onClose,
  request,
  onSaveMapping,
  selectedHardwareItems,
}) => {
  // Center of Zone
  const [center, setCenter] = useState<[number, number]>([11.9404, 108.4583]);
  const [mapType, setMapType] = useState<'osm' | 'street' | 'satellite'>('osm');
  const [fitKey, setFitKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentZoneData, setCurrentZoneData] = useState<any>(null);

  // Exact PostGIS Polygon Coordinates for Zone (as shown in Image 2)
  const [zonePolygon, setZonePolygon] = useState<[number, number][]>([
    [11.9416, 108.4578],
    [11.9416, 108.4595],
    [11.9395, 108.4595],
    [11.9395, 108.4578],
  ]);

  // Parent Field Polygon (dashed blue outline enclosing Zone)
  const [parentFieldPolygon, setParentFieldPolygon] = useState<[number, number][]>([
    [11.9425, 108.4565],
    [11.9425, 108.4608],
    [11.9385, 108.4608],
    [11.9385, 108.4565],
  ]);

  // Existing nodes in this zone (with real GIS coordinates)
  const [nodes, setNodes] = useState<SensorNode[]>([]);

  // Unassigned devices waiting to be pinned inside Zone
  const [unassignedDevices, setUnassignedDevices] = useState<UnassignedDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<UnassignedDevice | null>(null);
  const [activePinNode, setActivePinNode] = useState<SensorNode | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch real Zone, Parent Field, and Mapped Nodes
  useEffect(() => {
    if (!isOpen) return;
    const fetchZoneGISData = async () => {
      try {
        setIsLoading(true);
        const zoneId = request.zoneId || '32000000-0000-0000-0000-000000000001';

        // 1. Fetch Zone details from backend
        let loadedZonePts: [number, number][] = [];
        try {
          const z = await zoneService.getZoneById(zoneId).catch(() => null);
          if (z) {
            setCurrentZoneData(z);
            const rawBoundary = z.boundaryGeoJson || (z as any).polygonGeoJson || (z as any).boundary;
            const pts = extractPolygonPoints(rawBoundary);
            if (pts && pts.length >= 3) {
              loadedZonePts = pts;
              setZonePolygon(pts);
              const avgLat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
              const avgLng = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
              const newCenter: [number, number] = [parseFloat(avgLat.toFixed(6)), parseFloat(avgLng.toFixed(6))];
              setCenter(newCenter);

              // Auto construct parent field boundary enclosing the zone if not explicitly loaded
              setParentFieldPolygon([
                [parseFloat((avgLat + 0.0016).toFixed(6)), parseFloat((avgLng - 0.0022).toFixed(6))],
                [parseFloat((avgLat + 0.0016).toFixed(6)), parseFloat((avgLng + 0.0022).toFixed(6))],
                [parseFloat((avgLat - 0.0016).toFixed(6)), parseFloat((avgLng + 0.0022).toFixed(6))],
                [parseFloat((avgLat - 0.0016).toFixed(6)), parseFloat((avgLng - 0.0022).toFixed(6))],
              ]);
            }

            // If fieldId exists, fetch parent Field polygon
            if (z.fieldId) {
              const field = await fieldService.getFieldById(z.fieldId).catch(() => null);
              if (field) {
                const fPts = extractPolygonPoints(field.boundaryGeoJson || (field as any).boundary);
                if (fPts && fPts.length >= 3) {
                  setParentFieldPolygon(fPts);
                }
              }
            }
          }
        } catch (zoneErr) {
          console.warn('Could not fetch zone GIS boundary:', zoneErr);
        }

        // 2. Expand contract hardware items
        let contractItems = (selectedHardwareItems && selectedHardwareItems.length > 0)
          ? selectedHardwareItems
          : (request.contractDetails?.items && request.contractDetails.items.length > 0)
            ? request.contractDetails.items
            : null;

        if (!contractItems && request.serviceRequestId) {
          const qRes = await supportService.getQuotation(request.serviceRequestId).catch(() => null);
          if (qRes && Array.isArray(qRes.items) && qRes.items.length > 0) {
            contractItems = qRes.items;
          }
        }

        const expanded = expandContractDevices(contractItems || DEFAULT_CONTRACT_ITEMS);

        // 3. Fetch nodes mapped in this Zone from backend
        const locs = await supportService.getMappedNodes(zoneId).catch(() => []);
        let loadedNodes: SensorNode[] = [];

        if (Array.isArray(locs) && locs.length > 0) {
          loadedNodes = locs.map((loc: any, idx: number) => {
            const hasLat = typeof loc.latitude === 'number' && loc.latitude > 0;
            const hasLng = typeof loc.longitude === 'number' && loc.longitude > 0;

            const matchedContract = expanded[idx] || null;
            const nodeCode = matchedContract?.code || loc.hardwareAddress || `NODE-0${idx + 1}`;
            const name = matchedContract?.name || loc.deviceName || `Node Thiết bị #${idx + 1}`;
            const serialNumber = loc.hardwareAddress || matchedContract?.mac || `24:DC:C3:00:00:${String(idx + 1).padStart(2, '0')}`;

            return {
              nodeId: loc.deviceId || `loaded-node-${idx}-${Date.now()}`,
              farmId: request.farmId || '30000000-0000-0000-0000-000000000001',
              zoneId: zoneId,
              zoneName: request.zoneName || currentZoneData?.name || 'Nhà màng Z01',
              name: name,
              nodeCode: nodeCode,
              serialNumber: serialNumber,
              latitude: hasLat ? loc.latitude : center[0] + ((idx % 4) - 1.5) * 0.0003,
              longitude: hasLng ? loc.longitude : center[1] + (Math.floor(idx / 4) - 0.5) * 0.0004,
              status: (loc.status?.toUpperCase() || 'ONLINE') as any,
              firmwareVersion: 'v2.4.1',
              batteryLevel: loc.batteryLevel ?? 95,
              rssi: loc.rssi ?? -70,
              lastSeenAt: 'Trực tuyến',
              sensorsCount: (loc.deviceType === 'SensorNode' || nodeCode.includes('SN')) ? 2 : 0,
              actuatorsCount: (loc.deviceType === 'ActuatorNode' || nodeCode.includes('VALVE') || nodeCode.includes('ACT')) ? 1 : 0,
            };
          });
          setNodes(loadedNodes);
        } else {
          setNodes([]);
        }

        // INTELLIGENT UNASSIGNED LIST:
        // If loadedNodes already has 8 nodes (matching expanded), 0 remain to be pinned!
        if (loadedNodes.length >= expanded.length) {
          setUnassignedDevices([]);
          setSelectedDevice(null);
        } else if (loadedNodes.length > 0) {
          const remaining = expanded.slice(loadedNodes.length);
          setUnassignedDevices(remaining);
          setSelectedDevice(remaining[0] || null);
        } else {
          setUnassignedDevices(expanded);
          setSelectedDevice(expanded[0] || null);
        }

        setFitKey(k => k + 1);
      } catch (err) {
        console.error('Error fetching zone GIS data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchZoneGISData();
  }, [isOpen, request.zoneId, request.serviceRequestId, selectedHardwareItems]);

  const getTileConfig = () => {
    switch (mapType) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; High-Resolution Farm Satellite',
        };
      case 'street':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri World Street Map',
        };
      case 'osm':
      default:
        return {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
        };
    }
  };

  const currentTile = getTileConfig();

  // Area calculation
  const areaM2 = calculatePolygonAreaM2(zonePolygon);
  const areaHa = (areaM2 / 10000).toFixed(2);

  // Center pin drag handler
  const centerEventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const pos = marker.getLatLng();
          const newCenter: [number, number] = [parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6))];
          if (zonePolygon.length > 0) {
            const deltaLat = newCenter[0] - center[0];
            const deltaLng = newCenter[1] - center[1];
            setZonePolygon(prev =>
              prev.map(p => [
                parseFloat((p[0] + deltaLat).toFixed(6)),
                parseFloat((p[1] + deltaLng).toFixed(6)),
              ])
            );
          }
          setCenter(newCenter);
        }
      },
    }),
    [center, zonePolygon]
  );

  // Dragging vertex points #1, #2, #3, #4 of Zone
  const handleDragVertex = (idx: number, newLat: number, newLng: number) => {
    setZonePolygon(prev => {
      const next = [...prev];
      next[idx] = [newLat, newLng];
      return next;
    });
  };

  // Click on map to place selected Node into Zone
  const handleMapClick = (lat: number, lng: number) => {
    if (!selectedDevice) {
      if (unassignedDevices.length > 0) {
        setSelectedDevice(unassignedDevices[0]);
      } else {
        alert('Tất cả thiết bị theo hợp đồng đã được định vị xong. Bạn có thể kéo thả ghim Node trên bản đồ để chỉnh vị trí.');
      }
      return;
    }

    const newNode: SensorNode = {
      nodeId: selectedDevice.deviceId || `mapped-node-${Date.now()}`,
      farmId: request.farmId || '30000000-0000-0000-0000-000000000001',
      zoneId: request.zoneId || '32000000-0000-0000-0000-000000000001',
      zoneName: request.zoneName || currentZoneData?.name || 'Nhà màng Z01',
      name: selectedDevice.name,
      nodeCode: selectedDevice.code,
      serialNumber: selectedDevice.mac,
      latitude: lat,
      longitude: lng,
      status: 'ONLINE',
      firmwareVersion: 'v3.0.0-PROV',
      batteryLevel: 100,
      rssi: -65,
      lastSeenAt: 'Vừa chấm vị trí',
      sensorsCount: selectedDevice.type.includes('SENSOR') ? 2 : 0,
      actuatorsCount: selectedDevice.type === 'VALVE' || selectedDevice.type === 'PUMP' ? 1 : 0,
    };

    setNodes(prev => [...prev, newNode]);
    const updatedUnassigned = unassignedDevices.filter(d => d.deviceId !== selectedDevice.deviceId);
    setUnassignedDevices(updatedUnassigned);
    setSelectedDevice(updatedUnassigned[0] || null);

    setSuccessToast(`Đã chấm Node [${newNode.name}] vào Phân khu (Zone) tại tọa độ (${lat}, ${lng})!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleDragNodeEnd = (nodeId: string, newLat: number, newLng: number) => {
    setNodes(prev =>
      prev.map(n => (n.nodeId === nodeId ? { ...n, latitude: newLat, longitude: newLng } : n))
    );
    if (activePinNode && activePinNode.nodeId === nodeId) {
      setActivePinNode(prev => prev ? { ...prev, latitude: newLat, longitude: newLng } : null);
    }
    setSuccessToast(`Đã di chuyển Node đến tọa độ mới: (${newLat}, ${newLng})`);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleUnmapNode = (targetNode: SensorNode) => {
    setNodes(prev => prev.filter(n => n.nodeId !== targetNode.nodeId));
    setUnassignedDevices(prev => [
      ...prev,
      {
        deviceId: targetNode.nodeId,
        code: targetNode.nodeCode,
        name: targetNode.name,
        type: determineDeviceType(targetNode.nodeCode, undefined, targetNode.name),
        mac: targetNode.serialNumber,
      },
    ]);
    if (activePinNode?.nodeId === targetNode.nodeId) {
      setActivePinNode(null);
    }
    setSuccessToast(`Đã gỡ Node [${targetNode.nodeCode}] khỏi sơ đồ.`);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (onSaveMapping) {
        await onSaveMapping(nodes, nodes.length);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving mapping:', err);
      alert('Lỗi lưu sơ đồ GIS: ' + (err?.response?.data?.message || err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isMaintenance = request.requestType === 'MAINTENANCE' || request.requestType === 'REPAIR' || request.requestType === 'REPLACEMENT';
  const zoneDisplayName = request.zoneName || currentZoneData?.name || 'Nhà màng Z01';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 ${isFullscreen ? 'p-0' : ''}`}>
      <div className={`w-full ${isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-6xl rounded-2xl max-h-[95vh]'} bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#119653] via-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 border-b border-emerald-400/40 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-800/40 border border-emerald-300/40 rounded-xl text-white shadow-inner">
              <MapPin size={22} className="text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                  isMaintenance ? 'bg-amber-400/30 text-amber-100 border border-amber-300/40' : 'bg-emerald-800/40 text-emerald-100 border border-emerald-300/40'
                }`}>
                  {isMaintenance ? 'BẢO TRÌ & THAY THẾ NODE' : 'LẮP ĐẶT MỚI & CHẤM VỊ TRÍ GIS'}
                </span>
                <span className="text-xs text-emerald-100/90 font-mono">Request #{request.serviceRequestId}</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 flex items-center gap-2 flex-wrap">
                <span>🚀 Thực địa Chấm Node Phân khu (Zone):</span>
                <span className="text-emerald-200 underline underline-offset-4 font-extrabold">{zoneDisplayName}</span>
              </h2>
              <p className="text-[11px] text-emerald-100/90 mt-0.5">
                Nông trại: <strong>{request.farmName}</strong> • Ranh giới GIS Phân khu (Zone) màu xanh lá. Chấm thiết bị vào đúng ranh giới của Zone.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-emerald-800/50 transition-colors">
            ✕
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="p-2.5 bg-emerald-600 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-in slide-in-from-top-2 shrink-0">
            <CheckCircle2 size={16} /> {successToast}
          </div>
        )}

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-4 flex-1 overflow-hidden">
          {/* Left Panel: Unassigned Devices / Equipment List */}
          <div className="lg:col-span-1 p-4 bg-slate-50 border-r border-slate-200 overflow-y-auto space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Cpu size={14} className="text-[#119653]" /> 
                  {unassignedDevices.length === 0 ? 'Tất cả Node Đã Chấm' : `Thiết bị Chờ Chấm (${unassignedDevices.length})`}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  unassignedDevices.length === 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {nodes.length} / {nodes.length + unassignedDevices.length} Đã Xong
                </span>
              </div>

              {/* Status Banner when all nodes are mapped */}
              {unassignedDevices.length === 0 ? (
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-xs text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <h4 className="font-bold text-emerald-950 text-xs">🎉 Đã chấm hết tất cả {nodes.length} Node!</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Tất cả vật tư theo Hợp đồng đã được định vị chính xác bên trong ranh giới Phân khu (Zone). Bạn có thể kéo thả ghim Node để tinh chỉnh tọa độ GPS.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Chọn thiết bị bên dưới, sau đó nhấp vào vị trí bất kỳ bên trong Zone (đa giác xanh) trên bản đồ để định vị Node.
                  </p>
                  {unassignedDevices.map(dev => {
                    const isSelected = selectedDevice?.deviceId === dev.deviceId;
                    return (
                      <div
                        key={dev.deviceId}
                        onClick={() => setSelectedDevice(dev)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-emerald-800 text-emerald-100 border border-emerald-600' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {dev.code}
                          </span>
                          {isSelected && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold animate-pulse">ĐANG CHỌN</span>}
                        </div>
                        <h4 className="font-bold text-xs mt-1.5 leading-snug">{dev.name}</h4>
                        <p className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>
                          MAC: {dev.mac}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* List of currently placed nodes in Zone */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Node Đã Định Vị ({nodes.length})
                  </span>
                  {nodes.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <Check size={11} /> Đã ghim trên Map
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {nodes.map((n, i) => (
                    <div
                      key={n.nodeId}
                      onClick={() => setActivePinNode(n)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${
                        activePinNode?.nodeId === n.nodeId
                          ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-bold text-slate-900 truncate font-mono text-[11px]">{n.nodeCode}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{n.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnmapNode(n);
                        }}
                        title="Gỡ Node này ra khỏi sơ đồ để chấm lại"
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Instruction Tip */}
            <div className="mt-4 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 space-y-1">
              <strong className="flex items-center gap-1 text-emerald-800">
                <Info size={13} /> Thao tác trên Bản đồ Zone:
              </strong>
              <p className="text-emerald-900/90 leading-relaxed text-[10.5px]">
                • <strong>Chấm Node:</strong> Chọn thiết bị bên trái rồi nhấp vào vị trí bất kỳ bên trong Zone (đa giác xanh lá).<br />
                • <strong>Kéo ghim:</strong> Kéo trực tiếp ghim Node hoặc ghim ranh giới (#1, #2...) để căn chỉnh.
              </p>
            </div>
          </div>

          {/* Center Main: GIS MAP CARD (Matching Image 2 exactly) */}
          <div className="lg:col-span-3 p-4 bg-slate-100 flex flex-col justify-between overflow-y-auto space-y-3">
            {/* GIS Map Card matching Image 2 */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <MapPin size={16} className="text-[#119653]" /> Vị trí GIS Map của Zone này
                  </h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Database size={11} /> PostgreSQL PostGIS (SRID 4326)
                    </span>
                    <span>• {zonePolygon.length} tọa độ đỉnh</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono">
                  Phân khu: <strong className="text-slate-800">{zoneDisplayName}</strong>
                </div>
              </div>

              {/* Map Interactive Frame */}
              <div className="relative w-full h-[360px] rounded-xl border border-slate-300 overflow-hidden shadow-inner select-none">
                {/* In-Map Top-Left Realtime Badge (as in Image 2) */}
                <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 shadow-md space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Crosshair size={14} className="text-[#119653]" />
                    <span>Tọa độ tâm: <strong className="font-mono text-slate-900">{center[0].toFixed(4)}, {center[1].toFixed(4)}</strong></span>
                  </div>
                  {zonePolygon.length > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1 gap-3">
                      <span>Ranh giới: <strong className="text-emerald-700">{zonePolygon.length} đỉnh</strong></span>
                      <span>Diện tích: <strong className="text-[#119653] font-bold">{areaM2.toLocaleString()} m² ({areaHa} ha)</strong></span>
                    </div>
                  )}
                </div>

                {/* In-Map Top-Right Controls Overlay (as in Image 2) */}
                <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="bg-[#119653] hover:bg-[#0e8046] text-white px-2.5 py-1 rounded-lg border border-emerald-400 shadow-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isFullscreen ? 'Thu nhỏ' : 'Mở rộng Map'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitKey(k => k + 1)}
                    className="bg-white/95 hover:bg-slate-100 text-slate-800 px-2 py-1 rounded-lg border border-slate-200 shadow-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Maximize2 size={13} className="text-emerald-600" />
                    <span>Căn Zoom</span>
                  </button>

                  <div className="bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 text-xs flex items-center gap-1 shadow-md">
                    <button
                      type="button"
                      onClick={() => setMapType('osm')}
                      className={`px-2 py-1 rounded transition-colors ${mapType === 'osm' ? 'bg-[#119653] text-white font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      OSM
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapType('street')}
                      className={`px-2 py-1 rounded transition-colors ${mapType === 'street' ? 'bg-[#119653] text-white font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Đường phố
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapType('satellite')}
                      className={`px-2 py-1 rounded transition-colors ${mapType === 'satellite' ? 'bg-[#119653] text-white font-bold' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      Vệ tinh
                    </button>
                  </div>
                </div>

                {/* In-Map Bottom-Left Legend Overlay (as in Image 2) */}
                <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 shadow-md flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded border border-dashed border-[#0284c7] bg-[#0284c7]/20" /> Phân khu mẹ (Lô đất)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#10b981]/50 border border-[#10b981]" /> Hiện tại (ZONE)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Node Đã Định Vị ({nodes.length})
                  </div>
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
                    polygon={zonePolygon}
                    center={center}
                  />

                  {/* Center Marker C */}
                  <Marker
                    position={center}
                    icon={createCenterPinIcon()}
                    draggable={true}
                    eventHandlers={centerEventHandlers}
                  >
                    <Popup>
                      <div className="text-xs font-semibold text-slate-900">
                        Tâm điểm Phân khu (Zone)
                        <p className="text-[10px] text-emerald-700 font-normal mt-1">Kéo ghim để di chuyển toàn bộ Zone</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Parent Field Polygon (Dashed Blue Border as in Image 2) */}
                  {parentFieldPolygon && parentFieldPolygon.length >= 3 && (
                    <Polygon
                      positions={parentFieldPolygon}
                      pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.1, weight: 2, dashArray: '4, 4' }}
                    />
                  )}

                  {/* Current Zone Polygon (Solid Green as in Image 2) */}
                  {zonePolygon && zonePolygon.length >= 3 && (
                    <Polygon
                      positions={zonePolygon}
                      pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.35, weight: 3 }}
                    />
                  )}

                  {/* Numbered Vertices Pins (#1, #2, #3, #4) as in Image 2 */}
                  {zonePolygon.map((pt, idx) => (
                    <DraggableVertexMarker
                      key={`vertex-${idx}-${pt[0]}-${pt[1]}`}
                      position={pt}
                      index={idx}
                      onDragEnd={handleDragVertex}
                    />
                  ))}

                  {/* Placed Nodes Markers */}
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

              {/* Notice below map matching Image 2 */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 flex items-start gap-2">
                <Move size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Vẽ ranh giới GIS & Chấm Node:</strong> Bạn có thể kéo thả trực tiếp (Drag & Drop) các ghim ranh giới <strong>#1, #2, #3...</strong> và tâm điểm <strong>C</strong> trên bản đồ để tinh chỉnh vị trí Phân khu. Nhấp chuột vào trong Zone để chấm Node vào thực địa.
                </div>
              </div>
            </div>

            {/* Card 2: Connected Nodes & Telemetry list (Matching Image 2 directly below GIS Map) */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Cpu size={16} className="text-[#119653]" /> Thông tin Node Cảm biến & Vi khí hậu Trả về (Live Telemetry)
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  {nodes.length} Node kết nối
                </span>
              </div>

              {nodes.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                  Chưa có Node nào được chấm trong Zone này. Chọn thiết bị bên trái rồi nhấp vào bản đồ để chấm.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {nodes.map(n => (
                    <div
                      key={n.nodeId}
                      onClick={() => setActivePinNode(n)}
                      className="p-2.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-bold text-slate-900 font-mono text-[11px] truncate">{n.nodeCode}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">MAC: {n.serialNumber}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold font-mono">
                          {n.batteryLevel}%
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                          ONLINE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span>Tổng số Node định vị trong Phân khu:</span>
            <strong className="text-emerald-400 font-mono text-sm bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {nodes.length} Nodes
            </strong>
            {unassignedDevices.length === 0 ? (
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> (Đã định vị đủ 100% thiết bị Hợp đồng)
              </span>
            ) : (
              <span className="text-[11px] text-amber-400 font-medium">
                (Còn {unassignedDevices.length} thiết bị chờ chấm)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
              Hủy
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md px-5"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={16} className="mr-1.5 animate-spin" /> Đang lưu sơ đồ GIS...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="mr-1.5" /> Lưu Sơ đồ GIS & Đồng bộ Backend
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
