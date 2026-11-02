import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ServiceRequest, SensorNode } from '../../types';
import { 
  MapPin, Cpu, Radio, Zap, CheckCircle2, Plus, Info, Layers, 
  RefreshCw, Maximize2, Minimize2, Move, Trash2, Crosshair, Database, 
  Sparkles, Check, Droplets, BatteryCharging, Wifi
} from 'lucide-react';
import { Button, Modal } from '../ui/BaseUI';
import { supportService, zoneService, fieldService, deviceService, telemetryService } from '../../services';
import { extractPolygonPoints, calculatePolygonAreaM2, toGeoJsonPolygon } from '../maps/GISLocationPicker';

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

const createNodePinIcon = (code: string, isSelected: boolean, status?: string) => {
  const isGw = code.includes('GW');
  const isActuator = code.includes('VALVE') || code.includes('ACT') || code.includes('PUMP');
  const isOffline = ['OFFLINE', 'CRITICAL', 'WARNING'].includes(String(status || '').toUpperCase());
  const bg = isOffline ? '#dc2626' : isGw ? '#f59e0b' : isActuator ? '#0284c7' : isSelected ? '#10b981' : '#059669';

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
const normalizeNodeStatus = (value: any) => value === 4 || String(value).toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

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
  onConfigureSensors: (node: SensorNode) => void;
}> = ({ node, index, isSelected, onSelect, onDragEnd, onUnmap, onConfigureSensors }) => {
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
      icon={createNodePinIcon(node.nodeCode, isSelected, node.status)}
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
            {node.sensorParameters && node.sensorParameters.length > 0 && <div className="pt-1 border-t border-slate-100"><strong>Cảm biến gắn trên Node:</strong>{node.sensorParameters.map((sensor: any) => <div key={sensor.code || sensor.name}>{formatSensorReading(sensor)}</div>)}</div>}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[10px] text-amber-700 italic flex items-center gap-0.5">
              <Move size={10} /> Kéo ghim để dời vị trí
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onConfigureSensors(node)} className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline">Cấu hình cảm biến</button>
              <button
                type="button"
                onClick={() => onUnmap(node)}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-0.5"
              >
                <Trash2 size={11} /> Gỡ Node
              </button>
            </div>
          </div>
          <button type="button" onClick={() => onConfigureSensors(node)} className="w-full rounded bg-emerald-600 text-white px-2 py-1 font-bold">Cấu hình cảm biến</button>
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

const isNodeModuleItem = (item: any) => {
  const text = `${item?.code || ''} ${item?.category || ''} ${item?.name || item?.hardwareItemName || ''}`.toUpperCase();
  return text.includes('NODE') || text.includes('NODE_MODULE') || text.includes('MÔ-ĐUN NÚT');
};

const formatSensorReading = (sensor: any) => {
  const text = `${sensor?.code || ''} ${sensor?.name || ''}`.toUpperCase();
  const label = text.includes('TEMP') || text.includes('NHIỆT') ? 'T' : text.includes('HUM') || text.includes('ẨM') ? 'H' : text.includes('SOIL') || text.includes('ĐẤT') ? 'Đ' : text.includes('PH') ? 'pH' : text.includes('EC') ? 'EC' : String(sensor?.code || sensor?.name || 'S').slice(0, 2).toUpperCase();
  return `${label}: ${sensor?.value ?? '—'}${sensor?.unit ? ` ${sensor.unit}` : ''}`;
};

const generateMacAddress = (code: string, index: number = 1): string => {
  const upper = (code || '').toUpperCase();
  if (upper.includes('GW')) return `24:DC:C3:88:00:${String(index).padStart(2, '0')}`;
  if (upper.includes('VALVE')) return `24:DC:C3:44:01:${String(index).padStart(2, '0')}`;
  if (upper.includes('AIR')) return `24:DC:C3:77:02:${String(index).padStart(2, '0')}`;
  if (upper.includes('SOIL')) return `24:DC:C3:66:01:${String(index).padStart(2, '0')}`;
  return `24:DC:C3:11:00:${String(index).padStart(2, '0')}`;
};

const normalizeMacAddress = (value: any): string => {
  const hex = String(value || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  return hex.length === 12 ? hex.match(/.{2}/g)!.join(':') : String(value || '').trim().toUpperCase();
};

const generateGatewayFingerprint = async (gateway: any, deploymentRequestId: string, farmId: string) => {
  const source = `${gateway?.gatewaySerial || gateway?.serialNumber || gateway?.code || ''}|${gateway?.macAddress || ''}|${deploymentRequestId}|${farmId}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
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
  const [contractRequirements, setContractRequirements] = useState<{ code: string; name: string; quantity: number; installed: number; available: number }[]>([]);
  const [inventoryShortage, setInventoryShortage] = useState<string[]>([]);
  const [contractSensorRequirements, setContractSensorRequirements] = useState<any[]>([]);
  const [technicianSensorStock, setTechnicianSensorStock] = useState<any[]>([]);
  const [sensorConfigNode, setSensorConfigNode] = useState<SensorNode | null>(null);
  const [selectedSensorCodes, setSelectedSensorCodes] = useState<string[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [gatewayInterval, setGatewayInterval] = useState(30);
  const [gatewayLocation, setGatewayLocation] = useState('');
  const [gatewaySamples, setGatewaySamples] = useState(1);
  const [selectedGatewayNodeIds, setSelectedGatewayNodeIds] = useState<string[]>([]);
  const [gatewayConfigNodes, setGatewayConfigNodes] = useState<any[]>([]);
  const [provisioningGateway, setProvisioningGateway] = useState<any | null>(null);
  const [deploymentRequestId, setDeploymentRequestId] = useState('');
  const [provisionForm, setProvisionForm] = useState({ frequencyBand: '915MHz', firmwareVersion: '1.0.0', mqttClientId: '', certificateFingerprint: '' });
  const [isCheckingGateway, setIsCheckingGateway] = useState(false);
  const [isManualCoordinateOpen, setIsManualCoordinateOpen] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');

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

        const nodeContractItems = (contractItems || []).filter((item: any) => isNodeModuleItem(item));
        // GIS placement is only for node modules. Gateways, loose sensors, relays
        // and pumps are handled by their own workflows.
        const allContractDevices = expandContractDevices(nodeContractItems);
        const requirementMap = new Map<string, { code: string; name: string; quantity: number; installed: number; available: number }>();
        setContractSensorRequirements([]);
        (contractItems || []).forEach((item: any) => {
          const code = item.code || item.hardwareItemCode || item.name || 'THIET-BI';
          const type = determineDeviceType(code, item.category, item.name || item.hardwareItemName);
          const nestedSensors = item.sensors || item.sensorRequirements || item.sensorItems || [];
          if (Array.isArray(nestedSensors)) nestedSensors.forEach((sensor: any) => {
            const sensorCode = sensor.code || sensor.sensorCode || sensor.hardwareItemCode || sensor.name;
            if (sensorCode) setContractSensorRequirements(prev => [...prev, { code: sensorCode, name: sensor.name || sensor.sensorName || sensorCode, quantity: Number(sensor.quantity || sensor.requiredQuantity || 1) }]);
          });
          if (!isNodeModuleItem(item) || type === 'GATEWAY' || type === 'VALVE' || type === 'PUMP') {
            if (String(item.category || '').toUpperCase().includes('SENSOR') || String(item.name || '').toUpperCase().includes('CẢM BIẾN')) setContractSensorRequirements(prev => [...prev, { code, name: item.name || item.hardwareItemName || code, quantity: Number(item.quantity) || 1 }]);
            return;
          }
          const previous = requirementMap.get(code);
          requirementMap.set(code, { code, name: item.name || item.hardwareItemName || code, quantity: (previous?.quantity || 0) + (Number(item.quantity) || 1), installed: 0, available: 0 });
        });
        setContractRequirements(Array.from(requirementMap.values()));
        const spareParts = await supportService.getTechnicianSpareParts().catch(() => []);
        setTechnicianSensorStock((spareParts || []).filter((part: any) => {
          const text = `${part.category || ''} ${part.type || ''} ${part.code || ''} ${part.name || ''}`.toUpperCase();
          return /SENSOR|CẢM BIẾN|DHT|SHT|CO2|RS485|NHIỆT|ẨM|VI KHÍ HẬU/.test(text) && Number(part.quantityInStock || part.quantity || 0) > 0;
        }));
        const inventoryByCode = new Map<string, number>();
        (spareParts || []).forEach((part: any) => {
          const code = String(part.code || '').trim().toUpperCase();
          if (code) inventoryByCode.set(code, (inventoryByCode.get(code) || 0) + Number(part.quantityInStock || 0));
        });
        const inventoryNodeModules = (spareParts || []).filter((part: any) => isNodeModuleItem(part));
        const requiredNodeCount = nodeContractItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
        const placedOrAvailableCount = new Map<string, number>();
        let expanded = allContractDevices.filter(device => {
          const baseCode = device.code.split(' #')[0].trim().toUpperCase();
          const alreadyIncluded = placedOrAvailableCount.get(baseCode) || 0;
          const available = inventoryByCode.get(baseCode) || 0;
          if (alreadyIncluded >= available) return false;
          placedOrAvailableCount.set(baseCode, alreadyIncluded + 1);
          return true;
        });
        // Contract codes and technician-inventory codes can differ (for example,
        // a contract may name “R3/Nano” while inventory stores the board code).
        // In that case, use only matching node-module inventory records while
        // retaining the contract quantity as the hard upper bound.
        if (expanded.length === 0 && requiredNodeCount > 0 && inventoryNodeModules.length > 0) {
          expanded = inventoryNodeModules.flatMap((part: any, partIndex: number) => {
            const quantity = Math.min(Number(part.quantityInStock) || 0, requiredNodeCount);
            const contractItem = nodeContractItems[partIndex] || nodeContractItems[0];
            return Array.from({ length: quantity }, (_, index) => ({
              deviceId: `inventory-node-${part.id}-${index + 1}`,
              code: quantity > 1 ? `${part.code} #${index + 1}` : part.code,
              name: part.name || contractItem?.name || 'Mô-đun nút',
              type: determineDeviceType(part.code, part.category, part.name),
              mac: part.macAddress || part.serialNumber || '',
            } as UnassignedDevice));
          }).slice(0, requiredNodeCount);
        }
        const shortage = Array.from(requirementMap.values()).filter(req => {
          const available = inventoryByCode.get(req.code.toUpperCase()) || 0;
          req.available = available;
          return available < req.quantity;
        }).map(req => `${req.name}: cần ${req.quantity}, hiện có ${req.available}`);
        const totalInventoryNodeCount = inventoryNodeModules.reduce((sum: number, part: any) => sum + (Number(part.quantityInStock) || 0), 0);
        setInventoryShortage(shortage.length > 0 || totalInventoryNodeCount < requiredNodeCount
          ? [`Mô-đun nút: cần ${requiredNodeCount}, hiện có ${totalInventoryNodeCount}. Vui lòng bổ sung thiết bị.`]
          : []);

        // 3. Fetch only real provisioned nodes for this deployment request.
        // Contract/inventory rows are requirements, not physical GIS nodes.
        const [realDevices, deploymentRequests] = await Promise.all([
          deviceService.getFarmDevices(request.farmId).catch(() => []),
          deviceService.getTechnicianDeploymentRequests().catch(() => []),
        ]);
        const requestIdsForThisService = new Set(
          (Array.isArray(deploymentRequests) ? deploymentRequests : [])
            .filter((item: any) => String(item.serviceRequestId || item.serviceRequest?.id || '') === String(request.serviceRequestId || ''))
            .map((item: any) => item.requestId || item.deploymentRequestId || item.id)
            .filter(Boolean)
            .map(String)
        );
        if (requestIdsForThisService.size === 0) {
          (Array.isArray(deploymentRequests) ? deploymentRequests : [])
            .filter((item: any) => String(item.farmId || '') === String(request.farmId || '') && String(item.zoneId || '') === String(request.zoneId || ''))
            .map((item: any) => item.requestId || item.deploymentRequestId || item.id)
            .filter(Boolean)
            .forEach((id: any) => requestIdsForThisService.add(String(id)));
        }
        // Some API versions expose the deployment request itself as the
        // serviceRequestId prop. Keep both shapes compatible.
        requestIdsForThisService.add(String(request.serviceRequestId || ''));
        const realNodeDevices = (Array.isArray(realDevices) ? realDevices : []).filter((d: any) =>
          !String(d.hardwareAddress || d.macAddress || '').toUpperCase().startsWith('SIM-') &&
          requestIdsForThisService.has(String(d.deploymentRequestId || d.requestId || d.deployment?.id || '')) &&
          ['SensorNode', 'ActuatorNode'].includes(String(d.deviceType || ''))
        );
        const realUnassigned = realNodeDevices.map((d: any) => ({
          deviceId: d.deviceId || d.id,
          code: d.nodeCode || d.hardwareAddress || 'NODE',
          name: d.name || d.hardwareAddress || 'Node thật',
          type: determineDeviceType(d.nodeCode || d.hardwareAddress, d.deviceType, d.name),
          mac: d.hardwareAddress || d.macAddress || '',
        } as UnassignedDevice));

        // 4. Fetch nodes already pinned in this Zone. The API intentionally
        // returns only devices with real persisted coordinates.
        const [locs, liveTelemetry] = await Promise.all([
          supportService.getMappedNodes(zoneId).catch(() => []),
          telemetryService.getLatestByDevice(zoneId).catch(() => null),
        ]);
        const liveDevices = Array.isArray(liveTelemetry?.devices) ? liveTelemetry.devices : [];
        let loadedNodes: SensorNode[] = [];

        if (Array.isArray(locs) && locs.length > 0) {
          loadedNodes = locs.map((loc: any, idx: number) => {
            const hasLat = typeof loc.latitude === 'number' && Number.isFinite(loc.latitude);
            const hasLng = typeof loc.longitude === 'number' && Number.isFinite(loc.longitude);
            if (!hasLat || !hasLng) return null;

            const matchedContract = expanded[idx] || null;
            const matchedDevice = (Array.isArray(realDevices) ? realDevices : []).find((device: any) =>
              String(device.deviceId || device.id || device.nodeId || '') === String(loc.deviceId || loc.id || '') ||
              String(device.hardwareAddress || '').toUpperCase() === String(loc.hardwareAddress || '').toUpperCase()
            );
            const liveDevice = liveDevices.find((device: any) =>
              String(device.deviceId || '') === String(loc.deviceId || loc.id || '') ||
              String(device.hardwareAddress || '').toUpperCase() === String(loc.hardwareAddress || '').toUpperCase()
            );
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
              latitude: loc.latitude,
              longitude: loc.longitude,
              status: normalizeNodeStatus(liveDevice?.status ?? loc.status) as any,
              firmwareVersion: loc.firmwareVersion || 'Chưa có dữ liệu',
              batteryLevel: loc.batteryLevel ?? 0,
              rssi: loc.rssi ?? 0,
              lastSeenAt: loc.lastSeenAt || 'Chưa nhận dữ liệu',
              sensorsCount: (loc.sensors || loc.sensorParameters || matchedDevice?.sensors || matchedDevice?.sensorParameters || []).length,
              actuatorsCount: (loc.deviceType === 'ActuatorNode' || nodeCode.includes('VALVE') || nodeCode.includes('ACT')) ? 1 : 0,
              sensorParameters: liveDevice?.metrics?.length
                ? liveDevice.metrics.map((metric: any) => ({ code: metric.parameterCode, name: metric.parameterCode, value: metric.value, unit: metric.unit }))
                : (liveDevice?.sensors?.length ? liveDevice.sensors.map((sensor: any) => ({ code: sensor, name: sensor, value: '—' })) : (loc.sensors || loc.sensorParameters || matchedDevice?.sensors || matchedDevice?.sensorParameters || [])),
            };
          }).filter(Boolean) as SensorNode[];
          setNodes(loadedNodes);
          setContractRequirements(prev => prev.map(req => ({ ...req, installed: loadedNodes.filter(node => node.nodeCode.startsWith(req.code)).length })));
        } else {
          setNodes([]);
        }

        // INTELLIGENT UNASSIGNED LIST:
        // If loadedNodes already has 8 nodes (matching expanded), 0 remain to be pinned!
        const mappedIds = new Set(loadedNodes.map(node => node.nodeId));
        const mappedHardware = new Set(loadedNodes.map(node => String(node.serialNumber || '').toUpperCase()));
        const waitingRealNodes = realUnassigned.filter(d => !mappedIds.has(d.deviceId) && !mappedHardware.has(String(d.mac || '').toUpperCase()));
        if (waitingRealNodes.length > 0) {
          setUnassignedDevices(waitingRealNodes);
          setSelectedDevice(waitingRealNodes[0] || null);
        } else {
          setUnassignedDevices([]);
          setSelectedDevice(null);
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

  useEffect(() => {
    if (!isOpen || !request.zoneId) return;
    const refreshLiveNodeState = async () => {
      const liveResponse = await telemetryService.getLatestByDevice(request.zoneId!).catch(() => null);
      const live = Array.isArray(liveResponse?.devices) ? liveResponse.devices : [];
      if (live.length === 0) return;
      setNodes(previous => previous.map(node => {
        const source = live.find((item: any) => (item.deviceId || item.nodeId) === node.nodeId || item.hardwareAddress === node.serialNumber);
        if (!source) return { ...node, status: 'OFFLINE' };
        return { ...node, status: normalizeNodeStatus(source.status) as any, batteryLevel: source.batteryLevel ?? node.batteryLevel, rssi: source.rssi ?? node.rssi, sensorParameters: source.metrics?.length ? source.metrics.map((metric: any) => ({ code: metric.parameterCode, name: metric.parameterCode, value: metric.value, unit: metric.unit })) : (source.sensors?.length ? source.sensors.map((sensor: any) => ({ code: sensor, name: sensor, value: '—' })) : node.sensorParameters) };
      }));
    };
    refreshLiveNodeState();
    const timer = window.setInterval(refreshLiveNodeState, 15000);
    return () => window.clearInterval(timer);
  }, [isOpen, request.zoneId]);

  useEffect(() => {
    if (!isOpen) return;
    const loadGateways = async () => {
      const [registered, deploymentRequests] = await Promise.all([
        deviceService.getGateways(request.farmId).catch(() => []),
        deviceService.getTechnicianDeploymentRequests().catch(() => [])
      ]);
      const validDeploymentRequests = (Array.isArray(deploymentRequests) ? deploymentRequests : []).filter((item: any) => String(item.farmId) === String(request.farmId) && String(item.zoneId) === String(request.zoneId) && !['Draft', 'Completed', 'MaintenanceRequired'].includes(String(item.status)));
      const validRequestIds = new Set(validDeploymentRequests.map((item: any) => item.requestId || item.deploymentRequestId).filter(Boolean).map(String));
      const matchedRequest = validDeploymentRequests[0];
      const matchedRequestId = matchedRequest?.requestId || matchedRequest?.deploymentRequestId || '';
      setDeploymentRequestId(matchedRequestId);

      // Chỉ Gateway đã provision mới được dùng để kết nối. Hàng trong kho
      // không phải là Gateway của Farm và không được đưa vào select này.
      const contractItems = selectedHardwareItems?.length
        ? selectedHardwareItems
        : (request.contractDetails?.items || []);
      const contractRequiresGateway = contractItems.length === 0 || contractItems.some((item: any) =>
        determineDeviceType(item.code || item.hardwareItemCode, item.category, item.name || item.hardwareItemName) === 'GATEWAY' ||
        /gateway|trạm central/i.test(`${item.code || ''} ${item.name || item.hardwareItemName || ''}`)
      );
      const registeredGateways = (Array.isArray(registered) ? registered : []).filter((gateway: any) => {
        const gatewayFarmId = gateway.farmId || gateway.farm?.farmId;
        const gatewayZoneId = gateway.zoneId || gateway.zone?.zoneId;
        const gatewayRequestId = gateway.deploymentRequestId || gateway.requestId;
        const belongsToFarm = String(gatewayFarmId || request.farmId) === String(request.farmId);
        const belongsToZone = !gatewayZoneId || String(gatewayZoneId) === String(request.zoneId);
        const belongsToRequest = Boolean(gatewayRequestId) && validRequestIds.has(String(gatewayRequestId));
        const isProvisioned = !gateway.inventorySource && Boolean(gateway.gatewayId || gateway.id);
        return isProvisioned && belongsToFarm && belongsToZone && belongsToRequest && contractRequiresGateway;
      });
      const byId = new Map<string, any>();
      registeredGateways.forEach((gateway: any) => {
        const id = gateway.gatewayId || gateway.id;
        if (id) byId.set(id, gateway);
      });
      const gatewayList = Array.from(byId.values());
      setGateways(gatewayList);
      // Keep the selected Gateway after GIS data is reloaded. Previously the
      // modal only kept this in memory, so a save/reload made a connected
      // Gateway appear as "CHƯA KẾT NỐI" again.
      setSelectedGatewayId(previous => {
        const stillExists = gatewayList.some(item => String(item.gatewayId || item.id) === String(previous));
        return stillExists ? previous : String(gatewayList[0]?.gatewayId || gatewayList[0]?.id || '');
      });
    };
    loadGateways();
  }, [isOpen, request.farmId, request.zoneId, request.serviceRequestId, selectedHardwareItems]);

  useEffect(() => {
    if (!isOpen || !selectedGatewayId) return;
    const gateway = gateways.find(item => String(item.gatewayId || item.id) === String(selectedGatewayId));
    if (!gateway || gateway.inventorySource) return;
    let cancelled = false;
    deviceService.getGatewayMqttStatus(selectedGatewayId)
      .then(status => { if (!cancelled) setGatewayConnected(status?.mqttConnected === true); })
      .catch(() => { if (!cancelled) setGatewayConnected(false); });
    return () => { cancelled = true; };
  }, [isOpen, selectedGatewayId, gateways]);

  const verifyGatewayConnection = async () => {
    if (!selectedGatewayId) { alert('⚠️ Vui lòng chọn Gateway.'); return; }
    const selected = gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId);
    if (selected?.inventorySource) {
      alert('Gateway này mới đang ở kho Technician, chưa được provision vào SmartFarm. Hãy provision Gateway cho Deployment Request trước, sau đó quay lại kết nối.');
      return;
    }
    setIsCheckingGateway(true);
    try {
      let connected = false;
      for (let attempt = 0; attempt < 5 && !connected; attempt += 1) {
        const gateway = await deviceService.getGatewayById(selectedGatewayId);
        if (String(gateway?.farmId || '') !== String(request.farmId)) {
          throw new Error('Gateway không thuộc đúng phân khu/trang trại của yêu cầu triển khai.');
        }
        const mqttStatus = await deviceService.getGatewayMqttStatus(selectedGatewayId);
        connected = mqttStatus?.mqttConnected === true;
        setGatewayConnected(connected);
        if (!connected && attempt < 4) await new Promise(resolve => window.setTimeout(resolve, 1000));
      }
      if (connected) setSuccessToast('Gateway đã xác nhận kết nối MQTT thật. Bạn có thể cấu hình Gateway.');
      else alert('❌ Gateway chỉ đang Online trên Backend, chưa xác nhận MQTT thật. Hãy nạp WiFi + JSON firmware và kiểm tra ESP báo MQTT_CONNECTED.');
    } catch {
      setGatewayConnected(false);
      alert('❌ Không thể xác minh kết nối MQTT với Gateway.');
    } finally { setIsCheckingGateway(false); }
  };

  const simulateGatewayConnection = async () => {
    if (!selectedGatewayId) { alert('⚠️ Vui lòng chọn Gateway.'); return; }
    try {
      const updated = await deviceService.simulateGatewayConnection(selectedGatewayId);
      setGateways(previous => previous.map(item => (item.gatewayId || item.id) === selectedGatewayId ? { ...item, ...updated } : item));
      setGatewayConnected(true);
      setSuccessToast('Đã mô phỏng Gateway Online. Đây không phải kết nối MQTT thật.');
      window.setTimeout(() => setSuccessToast(null), 3500);
    } catch (error: any) {
      alert(`Mô phỏng Gateway thất bại: ${error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Vui lòng thử lại.'}`);
    }
  };

  const downloadGatewayFirmwareConfig = async () => {
    if (!selectedGatewayId) { alert('⚠️ Vui lòng chọn Gateway.'); return; }
    try {
      const config = await deviceService.getGatewayFirmwareConfig(selectedGatewayId);
      const firmwareConfig = {
        gatewayId: config.gatewayId,
        gatewaySerial: config.gatewaySerial,
        farmId: config.farmId,
        zoneId: config.zoneId,
        mqtt: {
          host: config.mqttHost || config.mqtt?.host || 'MQTT_BROKER_IP_REQUIRED',
          port: config.mqttPort || config.mqtt?.port || 1883,
          clientId: config.mqttClientId,
          fingerprint: config.clientCertificateFingerprint,
        },
        nodes: (config.nodes || []).filter((node: any) => !String(node.hardwareAddress || '').toUpperCase().startsWith('SIM-')),
      };
      const blob = new Blob([JSON.stringify(firmwareConfig)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `firmware-config-${config.gatewaySerial || selectedGatewayId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Không thể tải cấu hình firmware: ${error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Vui lòng thử lại.'}`);
    }
  };

  const openProvisionGateway = async (gateway: any) => {
    setProvisioningGateway(gateway);
    const mqttClientId = `smartfarm-gateway-${gateway.gatewayId || gateway.id || gateway.serialNumber || gateway.code || gateway.macAddress}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 150);
    setProvisionForm({
      frequencyBand: gateway.frequencyBand || '915MHz',
      firmwareVersion: gateway.firmwareVersion || gateway.model || '1.0.0',
      mqttClientId,
      certificateFingerprint: '',
    });
    try {
      const certificateFingerprint = await generateGatewayFingerprint(gateway, deploymentRequestId, request.farmId);
      setProvisionForm(previous => ({ ...previous, certificateFingerprint }));
    } catch {
      setProvisionForm(previous => ({ ...previous, certificateFingerprint: 'A'.repeat(64) }));
    }
  };

  const provisionSelectedGateway = async () => {
    if (!provisioningGateway || !deploymentRequestId) { alert('Chưa tìm thấy Deployment Request đang Installing cho Zone này.'); return; }
    if (!provisionForm.certificateFingerprint || provisionForm.certificateFingerprint.replace(/:/g, '').length !== 64) { alert('Certificate fingerprint phải là SHA-256 gồm 64 ký tự hex.'); return; }
    try {
      const gateway = await deviceService.provisionGateway({
        deploymentRequestId,
        farmId: request.farmId,
        macAddress: normalizeMacAddress(provisioningGateway.macAddress),
        gatewaySerial: provisioningGateway.gatewaySerial || provisioningGateway.serialNumber || provisioningGateway.code,
        frequencyBand: provisionForm.frequencyBand,
        firmwareVersion: provisionForm.firmwareVersion,
        mqttClientId: provisionForm.mqttClientId,
        clientCertificateFingerprint: provisionForm.certificateFingerprint,
      });
      setGateways(previous => [...previous.filter(item => !item.inventorySource || item.macAddress?.toUpperCase() !== provisioningGateway.macAddress?.toUpperCase()), gateway]);
      setSelectedGatewayId(gateway.gatewayId || gateway.id);
      setProvisioningGateway(null);
      setSuccessToast('Đã provision Gateway. Gateway đã chuyển sang danh sách có thể kết nối.');
      window.setTimeout(() => setSuccessToast(null), 3500);
    } catch (error: any) {
      alert(`Provision Gateway thất bại: ${error?.response?.data?.message || error?.message || 'Vui lòng kiểm tra MAC, serial và certificate.'}`);
    }
  };

  const openGatewayConfiguration = async () => {
    const gateway = gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId);
    let firmwareConfig: any;
    try {
      firmwareConfig = await deviceService.getGatewayFirmwareConfig(selectedGatewayId);
    } catch (error: any) {
      alert(`Không tải được danh sách Node đã provision: ${error?.response?.data?.detail || error?.message || 'Lỗi backend'}`);
      return;
    }
    const provisionedNodes = Array.isArray(firmwareConfig?.nodes) ? firmwareConfig.nodes : [];
    setGatewayConfigNodes(provisionedNodes);
    setGatewayInterval(Number(gateway?.telemetryIntervalSec || 60));
    setGatewaySamples(Number(gateway?.samplesPerInterval || 1));
    setGatewayLocation(gateway?.installationLocation || '');
    const availableNodeIds = new Set(provisionedNodes.map((node: any) => node.deviceId));
    setSelectedGatewayNodeIds(Array.isArray(gateway?.configuredNodeIds) ? gateway.configuredNodeIds.filter((id: string) => availableNodeIds.has(id)) : provisionedNodes.map((node: any) => node.deviceId));
    setIsGatewayModalOpen(true);
  };

  const saveGatewayConfiguration = async () => {
    if (!selectedGatewayId) return;
    const availableNodeIds = new Set(gatewayConfigNodes.map((node: any) => node.deviceId));
    const nodeIds = selectedGatewayNodeIds.filter(id => availableNodeIds.has(id));
    try {
      const updated = await deviceService.configureGateway(selectedGatewayId, {
        nodeIds,
        telemetryIntervalSec: gatewayInterval,
        samplesPerInterval: gatewaySamples,
        installationLocation: gatewayLocation || undefined,
      });
      setGateways(previous => previous.map(item => (item.gatewayId || item.id) === selectedGatewayId ? { ...item, ...updated } : item));
      setSuccessToast('Đã lưu cấu hình Gateway và danh sách Node phục vụ.');
      setIsGatewayModalOpen(false);
      window.setTimeout(() => setSuccessToast(null), 3000);
    } catch (error: any) {
      alert(`Không thể lưu cấu hình Gateway: ${error?.response?.data?.message || error?.message || 'Vui lòng thử lại.'}`);
    }
  };

  // The Gateway popup can be opened before or after MQTT verification.
  // Always refresh the provisioned-node list when both states are ready.
  useEffect(() => {
    if (isGatewayModalOpen && gatewayConnected && selectedGatewayId) {
      void openGatewayConfiguration();
    }
  }, [isGatewayModalOpen, gatewayConnected, selectedGatewayId]);

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
      status: 'OFFLINE',
      firmwareVersion: 'Chưa nhận dữ liệu',
      batteryLevel: 0,
      rssi: 0,
      lastSeenAt: 'Chưa nhận dữ liệu từ Gateway',
      sensorsCount: selectedDevice.type.includes('SENSOR') ? 2 : 0,
      sensorParameters: contractSensorRequirements.slice(0, 2).map(sensor => ({ code: sensor.code, name: sensor.name, value: 'Chưa có dữ liệu' })),
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

  const handleManualCoordinateSubmit = () => {
    const lat = Number(manualLatitude);
    const lng = Number(manualLongitude);
    if (!selectedDevice) { alert('⚠️ Vui lòng chọn Node cần định vị.'); return; }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) { alert('⚠️ Vui lòng nhập tọa độ hợp lệ: vĩ độ từ -90 đến 90, kinh độ từ -180 đến 180.'); return; }
    handleMapClick(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    setIsManualCoordinateOpen(false);
    setManualLatitude(''); setManualLongitude('');
  };

  const openSensorConfiguration = (node: SensorNode) => {
    setSensorConfigNode(node);
    setSelectedSensorCodes((node.sensorParameters || []).map((sensor: any) => sensor.code));
  };

  const saveSensorConfiguration = async () => {
    if (!sensorConfigNode) return;
    const node = sensorConfigNode;
    const parameters = selectedSensorCodes.map(code => {
      const requirement = contractSensorRequirements.find(sensor => sensor.code === code);
      const stockItem = technicianSensorStock.find((sensor: any) => (sensor.code || sensor.serialNumber || sensor.name) === code);
      return { code, name: stockItem?.name || requirement?.name || code, value: 'Chưa có dữ liệu' };
    });
    if (!node.nodeId) return;
    try {
      await deviceService.configureSensors(node.nodeId, parameters.map((sensor: any) => ({
        sensorType: sensor.code,
        unit: /DHT|SHT|TEMP|NHIỆT|ẨM/i.test(`${sensor.code} ${sensor.name}`) ? '°C/%RH' : 'raw',
        samplingIntervalSec: 60,
      })));
      setNodes(previous => previous.map(item => item.nodeId === node.nodeId ? { ...item, sensorParameters: parameters, sensorsCount: parameters.length } : item));
      setSensorConfigNode(null);
      setSuccessToast(`Đã lưu ${parameters.length} cảm biến và trừ kho Technician cho Node [${node.nodeCode}].`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Không thể lưu cấu hình cảm biến. Kho Technician chưa bị thay đổi.');
    }
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
      const zoneId = request.zoneId || currentZoneData?.id || currentZoneData?.zoneId || '32000000-0000-0000-0000-000000000001';

      // 1. If polygon was adjusted, save updated boundary to Zone entity
      if (zonePolygon.length >= 3 && zoneId && currentZoneData) {
        try {
          const geoJson = toGeoJsonPolygon(zonePolygon);
          const computedArea = Math.max(1, Math.round(calculatePolygonAreaM2(zonePolygon) || Number(currentZoneData.areaM2) || 100));
          await zoneService.updateZone(zoneId, {
            name: currentZoneData.name,
            areaM2: computedArea,
            polygonGeoJson: geoJson,
          });
        } catch (zErr) {
          console.warn('Could not update zone GIS boundary:', zErr);
        }
      }

      // 2. Persist mapped nodes to database
      if (zoneId) {
        await supportService.updateMappedNodes(zoneId, nodes, request.serviceRequestId);
      }

      // 3. Callback if provided
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
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-emerald-800/50 transition-colors">✕</button>
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-amber-950 flex items-center gap-1.5"><Wifi size={14} /> Gateway hạ tầng ngoài Zone</div>
                    <div className="text-amber-900/80 mt-0.5">Gateway đặt tại nhà kho/cột anten, không chấm lên bản đồ Zone.</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full font-bold ${gatewayConnected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>{gatewayConnected ? 'MQTT ONLINE' : 'CHƯA KẾT NỐI'}</span>
                </div>
                <Button type="button" onClick={() => setIsGatewayModalOpen(true)} className="w-full bg-amber-600 text-white">Chọn Gateway & kết nối</Button>
                {gatewayConnected && <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-800">Gateway đã online. Vị trí Gateway vẫn quản lý bằng mô tả hạ tầng, không đưa lên GIS.</div>}
              </div>
              <button type="button" disabled={!selectedDevice} onClick={() => setIsManualCoordinateOpen(true)} className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">Nhập tọa độ thủ công</button>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-1 text-[11px]">
                <div className="font-bold text-sky-900">Thiết bị trong hợp đồng</div>
                <div className="font-bold text-slate-800 pt-1">Mô-đun nút ({contractRequirements.reduce((sum, req) => sum + req.quantity, 0)})</div>
                {contractRequirements.length === 0 ? <div className="text-slate-500">Không có mô-đun nút.</div> : contractRequirements.map(req => <div key={req.code} className="flex justify-between gap-2"><span className="truncate">{req.name}</span><strong>{req.installed}/{req.quantity}</strong></div>)}
                <div className="font-bold text-slate-800 pt-2">Cảm biến ({contractSensorRequirements.reduce((sum, sensor) => sum + sensor.quantity, 0)}) · Đã gán: {nodes.reduce((sum, node) => sum + (node.sensorParameters?.length || 0), 0)}</div>
                {contractSensorRequirements.length === 0 ? <div className="text-slate-500">Không có cảm biến riêng.</div> : contractSensorRequirements.map(sensor => <div key={sensor.code} className="flex justify-between gap-2"><span className="truncate">{sensor.name}</span><strong>{sensor.quantity} cần dùng</strong></div>)}
              </div>
              {inventoryShortage.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-950"><strong className="block mb-1">Thiếu thiết bị cần bổ sung</strong>{inventoryShortage.map(item => <div key={item}>{item}</div>)}</div>}

              {/* Status Banner when all nodes are mapped */}
              {unassignedDevices.length === 0 && nodes.length > 0 ? (
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-xs text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <h4 className="font-bold text-emerald-950 text-xs">🎉 Đã chấm hết tất cả {nodes.length} Node!</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Tất cả vật tư theo Hợp đồng đã được định vị chính xác bên trong ranh giới Phân khu (Zone). Bạn có thể kéo thả ghim Node để tinh chỉnh tọa độ GPS.
                  </p>
                </div>
              ) : unassignedDevices.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-center space-y-2">
                  <h4 className="font-bold text-amber-950 text-xs">Chưa có Node thật để chấm</h4>
                  <p className="text-[11px] text-amber-900 leading-relaxed">Gateway đã kết nối, nhưng chưa có SensorNode/ActuatorNode được provision trong đúng yêu cầu triển khai. Hãy provision Node thật rồi tải lại màn hình.</p>
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
                        {isSelected && <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setIsManualCoordinateOpen(true); }}
                          className="mt-2 w-full rounded-md border border-emerald-300 bg-white/15 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-white/25"
                        >
                          Nhập tọa độ cho Node
                        </button>}
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSensorConfiguration(n);
                          }}
                          title="Cấu hình cảm biến cho Node này"
                          className="text-emerald-600 hover:text-emerald-800 p-1 rounded text-[10px] font-bold"
                        >
                          Cấu hình
                        </button>
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
                      onConfigureSensors={openSensorConfiguration}
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
                          <span className={`w-2 h-2 rounded-full shrink-0 ${n.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="font-bold text-slate-900 font-mono text-[11px] truncate">{n.nodeCode}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">MAC: {n.serialNumber}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{(n.sensorParameters || []).map((sensor: any) => <span key={sensor.code || sensor.name} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{formatSensorReading(sensor)}</span>)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold font-mono">
                          {typeof n.batteryLevel === 'number' ? `${n.batteryLevel}%` : 'Pin: —'}
                        </span>
                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${n.status === 'ONLINE' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {n.status === 'ONLINE' ? 'TRỰC TUYẾN' : 'MẤT KẾT NỐI'}
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
            {nodes.length > 0 && unassignedDevices.length === 0 ? (
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> (Đã định vị đủ 100% thiết bị Hợp đồng)
              </span>
            ) : unassignedDevices.length > 0 ? (
              <span className="text-[11px] text-amber-400 font-medium">
                (Còn {unassignedDevices.length} thiết bị chờ chấm)
              </span>
            ) : (
              <span className="text-[11px] text-amber-400 font-medium">(Chưa có Node thật để chấm)</span>
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

      <Modal isOpen={Boolean(sensorConfigNode)} onClose={() => setSensorConfigNode(null)} title={`Cấu hình cảm biến cho Node ${sensorConfigNode?.nodeCode || ''}`}>
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">Chọn cảm biến từ kho Technician để gán vào đúng Node. Không cần provision cảm biến riêng.</p>
          <div className="border rounded-lg divide-y">
            {technicianSensorStock.length === 0 ? <div className="p-3 text-slate-500">Kho Technician chưa có cảm biến.</div> : technicianSensorStock.map((sensor: any) => { const code = sensor.code || sensor.serialNumber || sensor.name; return <label key={code} className="flex items-center gap-2 p-3"><input type="checkbox" checked={selectedSensorCodes.includes(code)} onChange={event => setSelectedSensorCodes(previous => event.target.checked ? [...previous, code] : previous.filter(value => value !== code))} /><span><strong>{sensor.name || code}</strong><small className="block text-slate-500">Mã: {code} · Tồn kho: {sensor.quantityInStock || sensor.quantity || 0}</small></span></label>; })}
          </div>
          <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setSensorConfigNode(null)}>Hủy</Button><Button type="button" className="bg-emerald-600 text-white" onClick={saveSensorConfiguration}>Lưu cấu hình cảm biến</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isGatewayModalOpen} onClose={() => setIsGatewayModalOpen(false)} title="Cấu hình Gateway và các Node phục vụ">
        <div className="space-y-4 text-xs">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
            Gateway đặt ngoài Zone. Popup này chỉ cấu hình danh sách Node mà Gateway phục vụ và lịch gửi dữ liệu; không tạo marker Gateway trên bản đồ.
          </div>
          <select value={selectedGatewayId} onChange={e => { const value = e.target.value; const selected = gateways.find(item => (item.gatewayId || item.id) === value); setSelectedGatewayId(value); setGatewayConnected(false); setProvisioningGateway(selected?.inventorySource ? selected : null); if (selected?.inventorySource) setProvisionForm(previous => ({ ...previous, frequencyBand: selected.frequencyBand || '915MHz', firmwareVersion: selected.firmwareVersion || selected.model || '1.0.0', mqttClientId: selected.mqttClientId || `smartfarm-gateway-${String(selected.gatewaySerial || selected.serialNumber || selected.id).replace(/[^A-Za-z0-9_-]/g, '').slice(-24)}` })); }} className="w-full border border-slate-300 bg-white rounded-lg p-2.5">
            <option value="">-- Chọn Gateway đã provision của Farm --</option>
            {gateways.map(gateway => <option key={gateway.gatewayId || gateway.id} value={gateway.gatewayId || gateway.id}>{gateway.gatewaySerial || gateway.serialNumber || gateway.name || gateway.gatewayId || gateway.id} · {gateway.inventorySource ? 'Đang ở kho - chưa provision' : (gateway.status || 'Chưa rõ')}</option>)}
          </select>
          {selectedGatewayId && (() => { const selected = gateways.find(gateway => (gateway.gatewayId || gateway.id) === selectedGatewayId); return <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px]"><span className="col-span-2">Gateway ID: <strong className="font-mono">{selected?.gatewayId || selected?.id || '—'}</strong></span><span>Serial: <strong>{selected?.gatewaySerial || selected?.serialNumber || '—'}</strong></span><span>MAC: <strong>{selected?.macAddress || '—'}</strong></span><span>Vị trí: <strong>Ngoài Zone</strong></span><span>Last seen: <strong>{selected?.lastSeenAtUtc || selected?.lastSeenAt || '—'}</strong></span></div>; })()}
          {selectedGatewayId && gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource && (() => { const selected = gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId); return <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2 text-[11px]"><strong className="block text-amber-950">Gateway đang ở kho — Provision trước khi kết nối</strong><input value={provisionForm.frequencyBand} onChange={e => setProvisionForm(previous => ({ ...previous, frequencyBand: e.target.value }))} placeholder="Frequency band, ví dụ 915MHz" className="w-full border border-amber-300 rounded-lg p-2" /><input value={provisionForm.firmwareVersion} onChange={e => setProvisionForm(previous => ({ ...previous, firmwareVersion: e.target.value }))} placeholder="Firmware version" className="w-full border border-amber-300 rounded-lg p-2" /><input value={provisionForm.mqttClientId} onChange={e => setProvisionForm(previous => ({ ...previous, mqttClientId: e.target.value }))} placeholder="MQTT Client ID" className="w-full border border-amber-300 rounded-lg p-2" /><input value={provisionForm.certificateFingerprint} onChange={e => setProvisionForm(previous => ({ ...previous, certificateFingerprint: e.target.value }))} placeholder="SHA-256 certificate fingerprint (64 hex)" className="w-full border border-amber-300 rounded-lg p-2 font-mono" /><Button type="button" onClick={() => provisionSelectedGateway()} className="w-full bg-amber-600 text-white">Provision Gateway vào Deployment</Button><div className="text-[10px] text-amber-800">Deployment đang dùng: {deploymentRequestId || 'chưa tìm thấy'}</div></div>; })()}
          <div className="grid grid-cols-2 gap-2"><Button type="button" onClick={verifyGatewayConnection} disabled={isCheckingGateway || !selectedGatewayId || gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource} className="w-full bg-amber-600 text-white">{isCheckingGateway ? 'Đang kiểm tra MQTT...' : gatewayConnected ? 'MQTT đã kết nối' : 'Kết nối thật'}</Button><Button type="button" onClick={simulateGatewayConnection} disabled={!selectedGatewayId || gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource} className="w-full bg-slate-700 text-white">Mô phỏng</Button></div><Button type="button" onClick={downloadGatewayFirmwareConfig} disabled={!selectedGatewayId || gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource} className="w-full bg-blue-700 text-white">Tải cấu hình firmware</Button>
          {selectedGatewayId && gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">Gateway này đã có trong kho Technician nhưng chưa có bản ghi Gateway/credential MQTT cho Farm. Cần provision trước khi kết nối.</div>}
          {!gatewayConnected && <div className="rounded-lg bg-slate-100 p-3 text-slate-600">Hãy chọn Gateway và kết nối thành công trước khi cấu hình các Node.</div>}
          {gatewayConnected && <>
          <div>
            <label className="block font-bold text-slate-800 mb-1">Các Node đã provision mà Gateway phục vụ (GIS có thể chấm sau)</label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {gatewayConfigNodes.length === 0 ? <div className="p-3 text-slate-500">Chưa có Node provision — vẫn có thể lưu cấu hình Gateway.</div> : gatewayConfigNodes.map((node: any) => <label key={node.deviceId} className="flex items-center gap-2 p-2.5 hover:bg-slate-50"><input type="checkbox" checked={selectedGatewayNodeIds.includes(node.deviceId)} onChange={event => setSelectedGatewayNodeIds(previous => event.target.checked ? [...new Set([...previous, node.deviceId])] : previous.filter(id => id !== node.deviceId))} /><span><strong>{node.hardwareAddress}</strong><small className="block text-slate-500">{node.deviceType} · GIS {node.zoneId ? 'đã có Zone' : 'chưa chấm'}</small></span></label>)}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Đã chọn {selectedGatewayNodeIds.length}/{gatewayConfigNodes.length} Node provision. Không cần chấm GIS để lưu.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-bold text-slate-800 mb-1">Chu kỳ gửi (giây)</label><input type="number" min={10} max={86400} value={gatewayInterval} onChange={e => setGatewayInterval(Math.min(86400, Math.max(10, Number(e.target.value) || 10)))} className="w-full border border-slate-300 rounded-lg p-2.5" /><small className="text-slate-500">Khoảng cách giữa hai lần gửi.</small></div>
            <div><label className="block font-bold text-slate-800 mb-1">Số lần gửi trong chu kỳ</label><input type="number" min={1} max={60} value={gatewaySamples} onChange={e => setGatewaySamples(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className="w-full border border-slate-300 rounded-lg p-2.5" /><small className="text-slate-500">Số sample Node gửi mỗi chu kỳ.</small></div>
          </div>
          <div><label className="block font-bold text-slate-800 mb-1">Vị trí lắp Gateway ngoài Zone</label><input value={gatewayLocation} onChange={e => setGatewayLocation(e.target.value)} placeholder="Ví dụ: Nhà kho phía Tây Farm, anten cao 6m" className="w-full border border-slate-300 rounded-lg p-2.5" /></div>
          <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setIsGatewayModalOpen(false)}>Hủy</Button><Button type="button" className="bg-amber-600 text-white" onClick={saveGatewayConfiguration}>Lưu cấu hình Gateway</Button></div>
          </>}
        </div>
      </Modal>

      <Modal isOpen={isManualCoordinateOpen} onClose={() => setIsManualCoordinateOpen(false)} title="Nhập tọa độ Node thủ công">
        <div className="space-y-4 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3"><strong>Node đang chọn:</strong> {selectedDevice?.code || 'Chưa chọn Node'}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-bold text-slate-800 mb-1">Vĩ độ</label><input type="number" step="0.000001" value={manualLatitude} onChange={e => setManualLatitude(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="11.006700" /></div>
            <div><label className="block font-bold text-slate-800 mb-1">Kinh độ</label><input type="number" step="0.000001" value={manualLongitude} onChange={e => setManualLongitude(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="106.513900" /></div>
          </div>
          <p className="text-[10px] text-slate-500">Tọa độ phải nằm trong ranh giới GIS của Zone.</p>
          <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setIsManualCoordinateOpen(false)}>Hủy</Button><Button type="button" className="bg-emerald-600 text-white" onClick={handleManualCoordinateSubmit}>Đặt Node tại tọa độ</Button></div>
        </div>
      </Modal>
    </div>
  );
};
