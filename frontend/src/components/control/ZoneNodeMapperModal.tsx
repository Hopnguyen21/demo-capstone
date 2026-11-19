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
import { GatewayConfigModal } from './GatewayConfigModal';

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
  hardwareItemId?: string;
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
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onConfigureSensors(node)} className="w-full rounded bg-slate-100 hover:bg-slate-200 text-slate-800 px-2 py-1 font-bold text-[11px]">Cấu hình cảm biến</button>
            <div className="w-full rounded bg-slate-100 text-slate-500 px-2 py-1 font-bold text-[11px] text-center">Kiểm tra tại Hardware Preparation</div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

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

const normalizeSensorKey = (value: any) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

// The node configuration is the source of truth for which telemetry fields are
// shown. A gateway may return extra metrics, but those must not appear as if
// they were sensors installed on this node.
const mergeConfiguredTelemetry = (configured: any[] = [], live: any[] = []) => {
  const readings = Array.isArray(live) ? live : [];
  return (Array.isArray(configured) ? configured : []).map((sensor: any) => {
    const configuredKey = normalizeSensorKey(sensor.code || sensor.sensorType || sensor.name);
    const match = readings.find((metric: any) => {
      const liveKey = normalizeSensorKey(metric.parameterCode || metric.code || metric.sensorType || metric.name);
      return liveKey === configuredKey || liveKey.includes(configuredKey) || configuredKey.includes(liveKey);
    });
    return match
      ? { ...sensor, value: match.value ?? match.reading ?? sensor.value, unit: match.unit || sensor.unit }
      : sensor;
  });
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
  const items = Array.isArray(rawItems) ? rawItems : [];
  const list: UnassignedDevice[] = [];

  items.forEach((item: any, itemIdx: number) => {
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
    const baseCode = item.code || item.hardwareItemCode || `DEV-${itemIdx + 1}`;
    const baseName = item.name || item.hardwareItemName || 'Thiết bị Hợp đồng';
    const type = determineDeviceType(baseCode, item.category, baseName);

    for (let q = 1; q <= qty; q++) {
      const code = qty > 1 ? `${baseCode} #${q}` : baseCode;
      const name = qty > 1 ? `${baseName} (#${q})` : baseName;
      const mac = item.mac || item.macAddress || '';
      const devId = item.id ? `${item.id}-${q}` : '';

      list.push({
        deviceId: devId,
        code,
        name,
        type,
        mac,
        hardwareItemId: item.hardwareItemId || item.id,
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
  const [contractRequirements, setContractRequirements] = useState<{ code: string; name: string; quantity: number; installed: number; available: number; hardwareItemId?: string }[]>([]);
  const [inventoryShortage, setInventoryShortage] = useState<string[]>([]);
  const [contractSensorRequirements, setContractSensorRequirements] = useState<any[]>([]);
  const [contractDisplayDevices, setContractDisplayDevices] = useState<UnassignedDevice[]>([]);
  const [technicianSensorStock, setTechnicianSensorStock] = useState<any[]>([]);
  const [technicianComponentStock, setTechnicianComponentStock] = useState<any[]>([]);
  const [sensorConfigNode, setSensorConfigNode] = useState<SensorNode | null>(null);
  const [selectedSensorCodes, setSelectedSensorCodes] = useState<string[]>([]);
  const [componentConfigTab, setComponentConfigTab] = useState<'SENSORS' | 'COMPONENTS'>('SENSORS');
  const [selectedComponentQuantities, setSelectedComponentQuantities] = useState<Record<string, number>>({});
  const [gateways, setGateways] = useState<any[]>([]);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [gatewayInterval, setGatewayInterval] = useState(30);
  const [gatewayLocation, setGatewayLocation] = useState('');
  const [gatewaySamples, setGatewaySamples] = useState(1);
  const [selectedGatewayNodeIds, setSelectedGatewayNodeIds] = useState<string[]>([]);
  const [gatewayConfigNodes, setGatewayConfigNodes] = useState<any[]>([]);
  const [readyGatewayNodes, setReadyGatewayNodes] = useState<any[]>([]);
  const [configuredGatewayHardwareAddresses, setConfiguredGatewayHardwareAddresses] = useState<string[] | null>(null);
  const [deploymentRequestId, setDeploymentRequestId] = useState('');
  const [isCheckingGateway, setIsCheckingGateway] = useState(false);
  const [isManualCoordinateOpen, setIsManualCoordinateOpen] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [selectedGatewayForConfig, setSelectedGatewayForConfig] = useState<any | null>(null);
  const [isGatewayConfigOpen, setIsGatewayConfigOpen] = useState(false);
  const [gisReloadToken, setGisReloadToken] = useState(0);

  // Fetch real Zone, Parent Field, and Mapped Nodes
  useEffect(() => {
    if (!isOpen) return;
    const fetchZoneGISData = async () => {
      try {
        setIsLoading(true);
        if (!request.zoneId) throw new Error('Deployment request chưa có Zone hợp lệ.');
        const zoneId = request.zoneId;

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
        setContractDisplayDevices(expandContractDevices(contractItems || []));
        const requirementMap = new Map<string, { code: string; name: string; quantity: number; installed: number; available: number; hardwareItemId?: string }>();
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
          requirementMap.set(code, { code, name: item.name || item.hardwareItemName || code, quantity: (previous?.quantity || 0) + (Number(item.quantity) || 1), installed: 0, available: 0, hardwareItemId: previous?.hardwareItemId || item.hardwareItemId || item.id });
        });
        setContractRequirements(Array.from(requirementMap.values()));
        const spareParts = await supportService.getTechnicianSpareParts().catch(() => []);
        const sensorStockByCode = new Map<string, any>();
        (spareParts || []).filter((part: any) => {
          const text = `${part.category || ''} ${part.type || ''} ${part.code || ''} ${part.name || ''}`.toUpperCase();
          // Keep zero-stock Technician rows visible so the operator can see
          // that the sensor was already consumed, but they remain disabled in
          // the configuration picker below. Central-warehouse rows are still
          // excluded by the API and must go through allocation approval.
          return /SENSOR|CẢM BIẾN|DHT|SHT|CO2|RS485|NHIỆT|ẨM|VI KHÍ HẬU/.test(text);
        }).forEach((part: any) => {
          const code = String(part.code || part.serialNumber || part.name || '').trim().toUpperCase();
          if (!code) return;
          const previous = sensorStockByCode.get(code);
          if (previous) previous.quantityInStock = Number(previous.quantityInStock || 0) + Number(part.quantityInStock ?? part.quantity ?? 0);
          else sensorStockByCode.set(code, { ...part, code, quantityInStock: Number(part.quantityInStock ?? part.quantity ?? 0) });
        });
        setTechnicianSensorStock(Array.from(sensorStockByCode.values()));
        const componentStockByCode = new Map<string, any>();
        (spareParts || []).filter((part: any) => {
          const text = `${part.category || ''} ${part.type || ''} ${part.code || ''} ${part.name || ''}`.toUpperCase();
          // Components are consumables/support materials only. Actuators stay in DeviceActuators.
          // NODE_MODULE is also used by the inventory for LoRa/support modules,
          // so do not reject that category by itself. Reject only actual node
          // identities and gateway/actuator identities.
          const isNodeOrGateway = /SIM[-_ ]?NODE|\bNODE\b|GATEWAY|ESP32|ACTUATOR|VALVE|PUMP|RELAY/.test(text);
          return !isNodeOrGateway && !/SENSOR|CẢM BIẾN|DHT|SHT|CO2|RS485|NHIỆT|ẨM|VI KHÍ HẬU/.test(text)
            && /LORA|WIRE|DÂY|RESISTOR|ĐIỆN TRỞ|CONNECTOR|ĐẦU NỐI|MODULE|MẠCH|ANTEN|CABLE/.test(text);
        }).forEach((part: any) => {
          const code = String(part.code || part.serialNumber || part.name || '').trim().toUpperCase();
          if (!code) return;
          const previous = componentStockByCode.get(code);
          if (previous) previous.quantityInStock = Number(previous.quantityInStock || 0) + Number(part.quantityInStock ?? part.quantity ?? 0);
          else componentStockByCode.set(code, { ...part, code, quantityInStock: Number(part.quantityInStock ?? part.quantity ?? 0) });
        });
        setTechnicianComponentStock(Array.from(componentStockByCode.values()));
        const inventoryByCode = new Map<string, number>();
        (spareParts || []).forEach((part: any) => {
          const code = String(part.code || '').trim().toUpperCase();
          if (code) inventoryByCode.set(code, (inventoryByCode.get(code) || 0) + Number(part.quantityInStock || 0));
        });
        const inventoryNodeModules = (spareParts || []).filter((part: any) => isNodeModuleItem(part));
        const requiredNodeCount = nodeContractItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);

        const generateDeterministicGuid = (seed: string): string => {
          let hash = 0;
          for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
          }
          const hex = Math.abs(hash).toString(16).padStart(8, '0');
          return `52000000-0000-4000-8000-${hex.padEnd(12, '0')}`;
        };

        // When contract devices exist, always make them available with valid deterministic GUIDs
        // so the technician can directly place all contract nodes on the GIS map even before gateway pairing.
        let expanded = allContractDevices.map((device, idx) => {
          let devId = device.deviceId;
          const isGuid = typeof devId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(devId);
          if (!isGuid) {
            devId = generateDeterministicGuid(`${request.farmId || 'farm'}-${zoneId || 'zone'}-${device.code || idx}`);
          }
          return {
            ...device,
            deviceId: devId,
            mac: device.mac || `NODE-${String(device.code || idx).replace(/[^A-Z0-9]/gi, '') || '01'}`
          };
        });
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
        requestIdsForThisService.add(String(request.deploymentRequestId || ''));
        const realNodeDevices = (Array.isArray(realDevices) ? realDevices : []).filter((d: any) =>
          requestIdsForThisService.has(String(d.deploymentRequestId || d.requestId || d.deployment?.id || '')) &&
          ['SensorNode', 'ActuatorNode'].includes(String(d.deviceType || ''))
        );
        const realUnassigned = realNodeDevices.map((d: any) => ({
          deviceId: d.deviceId || d.id,
          code: d.nodeCode || d.hardwareAddress || 'NODE',
          name: d.name || d.hardwareAddress || 'Node thật',
          type: determineDeviceType(d.nodeCode || d.hardwareAddress, d.deviceType, d.name),
          mac: d.hardwareAddress || d.macAddress || '',
          hardwareItemId: d.hardwareItemId || d.hardwareItem?.id,
        } as UnassignedDevice));
        const visibleRealUnassigned = (!configuredGatewayHardwareAddresses || configuredGatewayHardwareAddresses.length === 0)
          ? realUnassigned
          : realUnassigned.filter(d => configuredGatewayHardwareAddresses.includes(String(d.mac).toUpperCase()));

        // 4. Fetch nodes already pinned in this Zone. The API intentionally
        // returns only devices with real persisted coordinates.
        let [locs, liveTelemetry] = await Promise.all([
          supportService.getMappedNodes(zoneId).catch(() => []),
          telemetryService.getLatestByDevice(zoneId).catch(() => null),
        ]);
        // Fallback to the persisted Device GPS when the map-locations view is
        // temporarily stale or unavailable. The database Device row remains
        // the source of truth, so a saved partial GIS mapping must not vanish
        // from the UI.
        if ((!Array.isArray(locs) || locs.length === 0) && Array.isArray(realDevices)) {
          locs = realDevices
            .filter((device: any) => String(device.zoneId) === String(zoneId) && Number.isFinite(Number(device.gpsLatitude)) && Number.isFinite(Number(device.gpsLongitude)))
            .map((device: any) => ({
              deviceId: device.deviceId || device.id,
              hardwareAddress: device.hardwareAddress || device.macAddress,
              deviceName: device.name || device.hardwareAddress,
              deviceType: device.deviceType,
              latitude: Number(device.gpsLatitude),
              longitude: Number(device.gpsLongitude),
              status: device.status,
            }));
        }
        const liveDevices = Array.isArray(liveTelemetry?.devices) ? liveTelemetry.devices : [];
        let loadedNodes: SensorNode[] = [];

        if (Array.isArray(locs) && locs.length > 0) {
          loadedNodes = locs.map((loc: any, idx: number) => {
            const latitude = Number(loc.latitude);
            const longitude = Number(loc.longitude);
            const hasLat = Number.isFinite(latitude);
            const hasLng = Number.isFinite(longitude);
            if (!hasLat || !hasLng || !loc.deviceId) return null;

            const matchedDevice = (Array.isArray(realDevices) ? realDevices : []).find((device: any) =>
              String(device.deviceId || device.id || device.nodeId || '') === String(loc.deviceId || loc.id || '') ||
              String(device.hardwareAddress || '').toUpperCase() === String(loc.hardwareAddress || '').toUpperCase()
            );
            const matchedContract = expanded.find((contractDevice: any) => {
              const contractHardwareId = String(contractDevice.hardwareItemId || '').toUpperCase();
              const deviceHardwareId = String(matchedDevice?.hardwareItemId || matchedDevice?.hardwareItem?.id || '').toUpperCase();
              if (contractHardwareId && deviceHardwareId && contractHardwareId === deviceHardwareId) return true;
              const contractCode = String(contractDevice.code || '').split(' #')[0].trim().toUpperCase();
              const deviceCode = String(matchedDevice?.nodeCode || loc.hardwareAddress || '').split(' #')[0].trim().toUpperCase();
              return Boolean(contractCode && deviceCode && (contractCode === deviceCode || deviceCode.includes(contractCode) || contractCode.includes(deviceCode)));
            }) || expanded[idx] || null;
            const liveDevice = liveDevices.find((device: any) =>
              String(device.deviceId || '') === String(loc.deviceId || loc.id || '') ||
              String(device.hardwareAddress || '').toUpperCase() === String(loc.hardwareAddress || '').toUpperCase()
            );
            const liveStatus = liveDevice ? normalizeNodeStatus(liveDevice.status) : 'OFFLINE';
            const nodeCode = matchedContract?.code || loc.hardwareAddress || 'NODE';
            const name = matchedContract?.name || loc.deviceName || 'Node thiết bị';
            const serialNumber = loc.hardwareAddress || matchedContract?.mac || '—';

            return {
              nodeId: loc.deviceId,
              hardwareItemId: matchedDevice?.hardwareItemId || matchedDevice?.hardwareItem?.id,
              contractCode: matchedContract?.code,
              farmId: request.farmId,
              zoneId: zoneId,
              zoneName: request.zoneName || currentZoneData?.name || '—',
              name: name,
              nodeCode: nodeCode,
              serialNumber: serialNumber,
              latitude,
              longitude,
              status: liveStatus as any,
              firmwareVersion: loc.firmwareVersion || 'Chưa có dữ liệu',
              batteryLevel: liveDevice?.batteryLevel ?? loc.batteryLevel ?? null,
              rssi: loc.rssi ?? 0,
              lastSeenAt: loc.lastSeenAt || 'Chưa nhận dữ liệu',
              sensorsCount: (loc.sensors || loc.sensorParameters || matchedDevice?.sensors || matchedDevice?.sensorParameters || []).length,
              actuatorsCount: (loc.deviceType === 'ActuatorNode' || nodeCode.includes('VALVE') || nodeCode.includes('ACT')) ? 1 : 0,
              sensorParameters: mergeConfiguredTelemetry(
                (loc.sensors || loc.sensorParameters || matchedDevice?.sensors || matchedDevice?.sensorParameters || []).map((sensor: any) => typeof sensor === 'string' ? ({ code: sensor, name: sensor, value: '—' }) : sensor),
                liveDevice?.metrics || []
              ),
            };
          }).filter(Boolean) as SensorNode[];
          // A device can arrive from both the persisted GIS location and the
          // farm-device fallback. Keep one physical node only.
          const uniqueLoadedNodes = Array.from(new Map(loadedNodes.map(node => [
            String(node.nodeId || node.serialNumber || node.nodeCode).toUpperCase(),
            node,
          ])).values());
          loadedNodes = uniqueLoadedNodes;
          setNodes(uniqueLoadedNodes);
        } else {
          setNodes([]);
        }

        // INTELLIGENT UNASSIGNED LIST:
        // Use real provisioned nodes if available; otherwise fallback to contract devices (expanded)
        // so the technician can always place the contract nodes on the GIS map even before gateway pairing.
        const mappedIds = new Set(loadedNodes.map(node => node.nodeId));
        const mappedHardware = new Set(loadedNodes.map(node => String(node.serialNumber || '').toUpperCase()));
        const sourceDevices = (visibleRealUnassigned.length > 0 || realUnassigned.length > 0)
          ? (visibleRealUnassigned.length > 0 ? visibleRealUnassigned : realUnassigned)
          : expanded;

        const waitingRealNodes = Array.from(new Map(sourceDevices
          .filter(d => !mappedIds.has(d.deviceId) && !mappedHardware.has(String(d.mac || '').toUpperCase()))
          .map(device => [String(device.deviceId || device.mac || device.code).toUpperCase(), device]))
          .values());
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
  }, [isOpen, request.zoneId, request.serviceRequestId, selectedHardwareItems, gisReloadToken]);

  useEffect(() => {
    if (!isOpen || !request.zoneId) return;
    const refreshLiveNodeState = async () => {
      const liveResponse = await telemetryService.getLatestByDevice(request.zoneId!).catch(() => null);
      const live = Array.isArray(liveResponse?.devices) ? liveResponse.devices : [];
      if (live.length === 0) {
        setNodes(previous => previous.map(node => ({ ...node, status: 'OFFLINE' })));
        return;
      }
      setNodes(previous => previous.map(node => {
        const source = live.find((item: any) => (item.deviceId || item.nodeId) === node.nodeId || item.hardwareAddress === node.serialNumber);
        if (!source) return { ...node, status: 'OFFLINE' };
        return { ...node, status: normalizeNodeStatus(source.status) as any, batteryLevel: source.batteryLevel ?? node.batteryLevel, rssi: source.rssi ?? node.rssi, sensorParameters: mergeConfiguredTelemetry(node.sensorParameters, source.metrics || []) };
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

      // GIS chỉ nhận Gateway đã hoàn tất Hardware Preparation và sẵn sàng triển khai.
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
        const isReady = !gateway.inventorySource && Boolean(gateway.gatewayId || gateway.id) && ['READYFORDEPLOYMENT', 'PROVISIONED', 'ONLINE'].includes(String(gateway.readinessStatus || gateway.status || '').replace(/[_\s-]/g, '').toUpperCase());
        return isReady && belongsToFarm && belongsToZone && belongsToRequest && contractRequiresGateway;
      });
      const byId = new Map<string, any>();
      registeredGateways.forEach((gateway: any) => {
        const id = gateway.gatewayId || gateway.id;
        if (id) byId.set(id, gateway);
      });
      const gatewayList = Array.from(byId.values());
      setGateways(gatewayList);
      const initialGatewayId = String(gatewayList[0]?.gatewayId || gatewayList[0]?.id || '');
      if (initialGatewayId) {
        const persisted = await deviceService.getGatewayFirmwareConfig(initialGatewayId).catch(() => null);
        const persistedNodes = Array.isArray(persisted?.nodes) ? persisted.nodes : [];
        if (persistedNodes.length > 0) {
          setConfiguredGatewayHardwareAddresses(persistedNodes.map((node: any) => String(node.hardwareAddress || '').toUpperCase()).filter(Boolean));
        } else {
          setConfiguredGatewayHardwareAddresses(null);
        }
        setGisReloadToken(previous => previous + 1);
      } else {
        setConfiguredGatewayHardwareAddresses(null);
        setGisReloadToken(previous => previous + 1);
      }
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

  const openGatewayConfiguration = async () => {
    const gateway = gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId);
    let preparations: any[] = [];
    let farmDevices: any[] = [];
    try {
      [preparations, farmDevices] = await Promise.all([
        deviceService.listHardwarePreparations().catch(() => []),
        deviceService.getFarmDevices(request.farmId).catch(() => []),
      ]);
    } catch (error: any) {
      alert(`Không tải được danh sách Node sẵn sàng: ${error?.response?.data?.detail || error?.message || 'Lỗi backend'}`);
      return;
    }
    const preparedNodes = (Array.isArray(preparations) ? preparations : [])
      .filter((item: any) => String(item.status || '').toLowerCase() === 'readyfordeployment' && item.nodeId && item.hardwareItemId)
      .map((item: any) => ({
        deviceId: item.id,
        hardwareAddress: String(item.nodeId).trim().toUpperCase(),
        deviceType: item.deviceType === 'ActuatorNode' ? 'ActuatorNode' : 'SensorNode',
        hardwareItemId: item.hardwareItemId,
        readyForDeployment: true,
      }));
    // GIS assignment changes a node from ReadyForDeployment to Assigned. The
    // Gateway popup must still show that node; otherwise chấm GIS makes it
    // disappear from the Gateway configuration dialog.
    const assignedNodes = (Array.isArray(farmDevices) ? farmDevices : [])
      .filter((item: any) => ['SensorNode', 'ActuatorNode'].includes(String(item.deviceType || ''))
        && !['Decommissioned', 'Retired'].includes(String(item.status || ''))
        && (item.hardwareAddress || item.nodeCode))
      .map((item: any) => ({
        deviceId: item.deviceId || item.id,
        hardwareAddress: String(item.hardwareAddress || item.nodeCode).trim().toUpperCase(),
        deviceType: item.deviceType === 'ActuatorNode' ? 'ActuatorNode' : 'SensorNode',
        hardwareItemId: item.hardwareItemId || item.hardwareItem?.id,
        readyForDeployment: ['ReadyForDeployment', 'Assigned', 'Online', 'SensorsConfigured', 'ActuatorsConfigured'].includes(String(item.status || '')),
      }))
      .filter((item: any) => item.deviceId && item.hardwareItemId);
    const readyNodes = Array.from(new Map([...preparedNodes, ...assignedNodes].map(node => [node.hardwareAddress, node])).values());
    // Resolve the persisted Device IDs so the checkbox reflects the Gateway
    // configuration stored in DB, not a default React selection.
    let persistedNodes: any[] = [];
    try {
      const persistedConfig = await deviceService.getGatewayFirmwareConfig(selectedGatewayId);
      persistedNodes = Array.isArray(persistedConfig?.nodes) ? persistedConfig.nodes : [];
    } catch {
      // There may be no provisioned nodes yet; the Ready list remains usable.
    }
    const persistedByAddress = new Map(persistedNodes.map((node: any) => [String(node.hardwareAddress || '').toUpperCase(), node]));
    const displayReadyNodes = readyNodes.map(node => ({
      ...node,
      provisionedDeviceId: persistedByAddress.get(String(node.hardwareAddress).toUpperCase())?.deviceId,
    }));
    setReadyGatewayNodes(displayReadyNodes);
    setGatewayConfigNodes(displayReadyNodes);
    setGatewayInterval(Number(gateway?.telemetryIntervalSec || 60));
    setGatewaySamples(Number(gateway?.samplesPerInterval || 1));
    setGatewayLocation(gateway?.installationLocation || '');
    const configuredIds = new Set(Array.isArray(gateway?.configuredNodeIds) ? gateway.configuredNodeIds.map(String) : []);
    // An empty configuredNodeIds is meaningful after the user explicitly
    // cleared the Gateway selection. Do not interpret it as "select all".
    const hasPersistedConfiguration = gateway?.configuredAtUtc != null || Array.isArray(gateway?.configuredNodeIds);
    setSelectedGatewayNodeIds(displayReadyNodes
      .filter((node: any) => !hasPersistedConfiguration || (node.provisionedDeviceId && configuredIds.has(String(node.provisionedDeviceId))))
      .map((node: any) => node.deviceId));
    setConfiguredGatewayHardwareAddresses(hasPersistedConfiguration
      ? displayReadyNodes.filter((node: any) => node.provisionedDeviceId && configuredIds.has(String(node.provisionedDeviceId))).map((node: any) => String(node.hardwareAddress).toUpperCase())
      : null);
    // The GIS list is loaded separately from the Gateway popup. Force it to
    // reload after resolving the persisted Gateway membership so an unchecked
    // node cannot remain visible outside the popup.
    setGisReloadToken(previous => previous + 1);
    setIsGatewayModalOpen(true);
  };

  const saveGatewayConfiguration = async () => {
    if (!selectedGatewayId) return;
    try {
      const selectedReadyNodes = readyGatewayNodes.filter(node => selectedGatewayNodeIds.includes(node.deviceId));
      setConfiguredGatewayHardwareAddresses(selectedReadyNodes.map(node => String(node.hardwareAddress).toUpperCase()));
      const deploymentId = request.deploymentRequestId || deploymentRequestId;
      if (selectedReadyNodes.length > 0 && deploymentId && request.farmId) {
        await deviceService.provisionNodes({
          deploymentRequestId: deploymentId,
          gatewayId: selectedGatewayId,
          farmId: request.farmId,
          nodes: selectedReadyNodes.map(node => ({
            hardwareAddress: node.hardwareAddress,
            deviceType: node.deviceType,
            hardwareItemId: node.hardwareItemId,
          })),
        });
      }
      const firmwareConfig = await deviceService.getGatewayFirmwareConfig(selectedGatewayId);
      const provisionedNodes = Array.isArray(firmwareConfig?.nodes) ? firmwareConfig.nodes : [];
      const selectedAddresses = new Set(selectedReadyNodes.map(node => String(node.hardwareAddress).toUpperCase()));
      const nodeIds = provisionedNodes
        .filter((node: any) => selectedAddresses.has(String(node.hardwareAddress || '').toUpperCase()))
        .map((node: any) => node.deviceId);
      const updated = await deviceService.configureGateway(selectedGatewayId, {
        nodeIds,
        telemetryIntervalSec: gatewayInterval,
        samplesPerInterval: gatewaySamples,
        installationLocation: gatewayLocation || undefined,
      });
      setGateways(previous => previous.map(item => (item.gatewayId || item.id) === selectedGatewayId ? { ...item, ...updated } : item));
      // Reload from the backend after provisioning/configuration. Do not leave
      // the GIS list backed by the pre-save React state.
      setIsGatewayModalOpen(false);
      setGisReloadToken(previous => previous + 1);
      setSuccessToast('Đã lưu cấu hình Gateway và danh sách Node phục vụ.');
      window.setTimeout(() => setSuccessToast(null), 3000);
    } catch (error: any) {
      alert(`Không thể lưu cấu hình Gateway: ${error?.response?.data?.message || error?.message || 'Vui lòng thử lại.'}`);
    }
  };

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

    if (!selectedDevice.deviceId || !request.farmId || !request.zoneId) {
      alert('Thiếu định danh thiết bị, Farm hoặc Zone thật; không thể chấm Node giả.');
      return;
    }
    const newNode: SensorNode = {
      nodeId: selectedDevice.deviceId,
      hardwareItemId: selectedDevice.hardwareItemId,
      contractCode: (selectedDevice as any).contractCode,
      farmId: request.farmId,
      zoneId: request.zoneId,
      zoneName: request.zoneName || currentZoneData?.name || '—',
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
      sensorsCount: selectedDevice.type.includes('SENSOR') ? contractSensorRequirements.length : 0,
      sensorParameters: selectedDevice.type.includes('SENSOR')
        ? contractSensorRequirements.map(sensor => ({ code: sensor.code, name: sensor.name, value: 'Chưa có dữ liệu' }))
        : [],
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
    setComponentConfigTab('SENSORS');
    setSelectedSensorCodes((node.sensorParameters || []).map((sensor: any) => sensor.code));
    setSelectedComponentQuantities({});
    deviceService.getComponents(node.nodeId).then((rows: any[]) => {
      const quantities: Record<string, number> = {};
      (rows || []).forEach(row => { quantities[row.hardwareItemId] = Number(row.quantity) || 1; });
      setSelectedComponentQuantities(quantities);
    }).catch(() => undefined);
  };

  const saveComponentConfiguration = async () => {
    if (!sensorConfigNode) return;
    const components = Object.entries(selectedComponentQuantities).filter(([, quantity]) => quantity > 0).map(([hardwareItemId, quantity]) => {
      const item = technicianComponentStock.find(stock => String(stock.id || stock.hardwareItemId) === hardwareItemId);
      return { hardwareItemId, componentType: String(item?.category || item?.type || 'SUPPORT_COMPONENT').toUpperCase(), quantity, unit: item?.unit || 'Cái' };
    });
    try {
      await deviceService.configureComponents(sensorConfigNode.nodeId, components);
      setSensorConfigNode(null);
      setSuccessToast(`Đã lưu ${components.length} loại vật tư phụ cho Node [${sensorConfigNode.nodeCode}].`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'Không thể lưu vật tư phụ. Kho Technician chưa bị thay đổi.');
    }
  };

  const saveSensorConfiguration = async () => {
    if (!sensorConfigNode) return;
    const node = sensorConfigNode;
    if (selectedSensorCodes.length === 0) {
      alert('Vui lòng chọn ít nhất một cảm biến đã gán cho Node.');
      return;
    }
    const parameters = selectedSensorCodes.map(code => {
      const requirement = contractSensorRequirements.find(sensor => sensor.code === code);
      const stockItem = technicianSensorStock.find((sensor: any) => String(sensor.code || sensor.serialNumber || sensor.name).toUpperCase() === String(code).toUpperCase());
      return { code, name: stockItem?.name || requirement?.name || code, value: 'Chưa có dữ liệu' };
    });
    if (!node.nodeId) return;
    try {
      await deviceService.configureSensors(node.nodeId, parameters.map((sensor: any) => ({
        sensorType: sensor.code,
        unit: technicianSensorStock.find((stock: any) => (stock.code || stock.serialNumber || stock.name) === sensor.code)?.unit
          || contractSensorRequirements.find(requirement => requirement.code === sensor.code)?.unit
          || '',
        model: technicianSensorStock.find((stock: any) => (stock.code || stock.serialNumber || stock.name) === sensor.code)?.model,
        interface: technicianSensorStock.find((stock: any) => (stock.code || stock.serialNumber || stock.name) === sensor.code)?.interface,
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

  const handleUnmapNode = async (targetNode: SensorNode) => {
    const remainingNodes = nodes.filter(n => n.nodeId !== targetNode.nodeId);
    const previousUnassigned = unassignedDevices;
    const restoredDevice: UnassignedDevice = {
      deviceId: targetNode.nodeId,
      code: targetNode.nodeCode,
      name: targetNode.name,
      type: determineDeviceType(targetNode.nodeCode, undefined, targetNode.name),
      mac: targetNode.serialNumber,
    };
    // Optimistic UI update: the pin disappears immediately. If persistence
    // fails, restore the exact previous state below.
    setNodes(remainingNodes);
    setUnassignedDevices(prev => [...prev, restoredDevice]);
    setSelectedDevice(restoredDevice);
    try {
      const zoneId = request.zoneId || currentZoneData?.id || currentZoneData?.zoneId;
      if (!zoneId) throw new Error('Deployment request chưa có Zone hợp lệ.');
      await supportService.updateMappedNodes(zoneId, remainingNodes, request.serviceRequestId, request.deploymentRequestId);
    } catch (error: any) {
      setNodes(nodes);
      setUnassignedDevices(previousUnassigned);
      setSelectedDevice(null);
      alert(`Không thể gỡ Node khỏi GIS: ${error?.response?.data?.detail || error?.message || 'Lỗi backend'}`);
      return;
    }
    if (activePinNode?.nodeId === targetNode.nodeId) {
      setActivePinNode(null);
    }
    setSuccessToast(`Đã gỡ Node [${targetNode.nodeCode}] khỏi sơ đồ.`);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const zoneId = request.zoneId || currentZoneData?.id || currentZoneData?.zoneId;
      if (!zoneId) throw new Error('Deployment request chưa có Zone hợp lệ.');

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
        await supportService.updateMappedNodes(zoneId, nodes, request.serviceRequestId, request.deploymentRequestId);
      }

      // 3. Callback if provided
      if (onSaveMapping) {
        try {
          await onSaveMapping(nodes, nodes.length);
        } catch (cbErr) {
          console.warn('onSaveMapping callback error:', cbErr);
        }
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
                <div className="font-bold text-slate-800 pt-1">Danh sách thiết bị</div>
                {Array.from(new Map([...contractDisplayDevices, ...nodes.map(node => ({ name: node.name } as UnassignedDevice)), ...unassignedDevices].map(device => [String(device.name || device.code).trim().toUpperCase(), device.name || device.code])).values()).map(name => <div key={name} className="border-t border-sky-100 pt-1">{name}</div>)}
                {contractDisplayDevices.length === 0 && nodes.length === 0 && unassignedDevices.length === 0 && <div className="text-slate-500">Chưa có thiết bị trong yêu cầu.</div>}
              </div>

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
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2">
                  <h4 className="font-bold text-emerald-950 text-xs">Không còn Node nào cần chấm thêm</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">Tất cả thiết bị theo hợp đồng đã được định vị hoặc không có thêm thiết bị cần chấm.</p>
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
                          {typeof n.batteryLevel === 'number' && n.batteryLevel > 0 ? `${n.batteryLevel}%` : 'Pin: —'}
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
            ) : unassignedDevices.length > 0 ? (
              <span className="text-[11px] text-emerald-400 font-medium">({unassignedDevices.length} Node chưa chấm vị trí)</span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">(Đã định vị xong)</span>
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

      <Modal isOpen={Boolean(sensorConfigNode)} onClose={() => setSensorConfigNode(null)} title={`Cấu hình thiết bị cho Node ${sensorConfigNode?.nodeCode || ''}`}>
        <div className="space-y-4 text-xs">
          <div className="flex gap-2 border-b"><Button type="button" variant={componentConfigTab === 'SENSORS' ? 'primary' : 'outline'} onClick={() => setComponentConfigTab('SENSORS')}>Cảm biến</Button><Button type="button" variant={componentConfigTab === 'COMPONENTS' ? 'primary' : 'outline'} onClick={() => setComponentConfigTab('COMPONENTS')}>Vật tư phụ</Button></div>
          {componentConfigTab === 'SENSORS' ? <><p className="text-slate-600">Chọn cảm biến từ kho Technician để gán vào đúng Node.</p><div className="border rounded-lg divide-y">{technicianSensorStock.length === 0 ? <div className="p-3 text-slate-500">Kho Technician chưa có cảm biến.</div> : technicianSensorStock.map((sensor: any) => { const code = sensor.code || sensor.serialNumber || sensor.name; const quantity = Number(sensor.quantityInStock ?? sensor.quantity ?? 0); const exhausted = quantity < 1 && !selectedSensorCodes.includes(code); return <label key={code} className={`flex items-center gap-2 p-3 ${exhausted ? 'bg-slate-50 opacity-60' : 'hover:bg-emerald-50'}`}><input type="checkbox" checked={selectedSensorCodes.includes(code)} disabled={exhausted} onChange={event => setSelectedSensorCodes(previous => event.target.checked ? [...previous, code] : previous.filter(value => value !== code))} /><span><strong>{sensor.name || code}</strong><small className="block text-slate-500">Mã: {code} · Tồn kho: {quantity}{exhausted ? ' · Hết tồn' : ''}</small></span></label>; })}</div><div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setSensorConfigNode(null)}>Hủy</Button><Button type="button" className="bg-emerald-600 text-white" onClick={saveSensorConfiguration}>Lưu cấu hình cảm biến</Button></div></> : <><p className="text-slate-600">Chọn LoRa, dây, điện trở, đầu nối hoặc module tiêu hao. Relay/van/bơm cấu hình ở nhóm actuator.</p><div className="border rounded-lg divide-y">{technicianComponentStock.length === 0 ? <div className="p-3 text-slate-500">Kho Technician chưa có vật tư phụ phù hợp.</div> : technicianComponentStock.map((item: any) => { const id = String(item.id || item.hardwareItemId); const quantity = Number(item.quantityInStock ?? item.quantity ?? 0); const selected = Number(selectedComponentQuantities[id] || 0); return <div key={id} className="flex items-center gap-3 p-3"><input type="checkbox" checked={selected > 0} disabled={quantity < 1 && selected === 0} onChange={event => setSelectedComponentQuantities(previous => ({ ...previous, [id]: event.target.checked ? 1 : 0 }))} /><span className="flex-1"><strong>{item.name || item.code}</strong><small className="block text-slate-500">Mã: {item.code} · Tồn kho: {quantity}</small></span>{selected > 0 && <input className="w-20 border rounded p-1" type="number" min={1} max={quantity + selected} value={selected} onChange={event => setSelectedComponentQuantities(previous => ({ ...previous, [id]: Math.max(1, Number(event.target.value) || 1) }))} />}</div>; })}</div><div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setSensorConfigNode(null)}>Hủy</Button><Button type="button" className="bg-emerald-600 text-white" onClick={saveComponentConfiguration}>Lưu vật tư phụ</Button></div></>}
        </div>
      </Modal>

      <Modal isOpen={isGatewayModalOpen} onClose={() => setIsGatewayModalOpen(false)} title="Cấu hình Gateway và các Node phục vụ">
        <div className="space-y-4 text-xs">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
            Gateway đặt ngoài Zone. Popup này chỉ cấu hình danh sách Node mà Gateway phục vụ và lịch gửi dữ liệu; không tạo marker Gateway trên bản đồ.
          </div>
          <select value={selectedGatewayId} onChange={e => { setSelectedGatewayId(e.target.value); setGatewayConnected(false); }} className="w-full border border-slate-300 bg-white rounded-lg p-2.5">
            <option value="">-- Chọn Gateway đã provision của Farm --</option>
            {gateways.map(gateway => <option key={gateway.gatewayId || gateway.id} value={gateway.gatewayId || gateway.id}>{gateway.gatewaySerial || gateway.serialNumber || gateway.name || gateway.gatewayId || gateway.id} · {gateway.inventorySource ? 'Đang ở kho - chưa provision' : (gateway.status || 'Chưa rõ')}</option>)}
          </select>
          {selectedGatewayId && (() => { const selected = gateways.find(gateway => (gateway.gatewayId || gateway.id) === selectedGatewayId); return <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px]"><span className="col-span-2">Gateway ID: <strong className="font-mono">{selected?.gatewayId || selected?.id || '—'}</strong></span><span>Serial: <strong>{selected?.gatewaySerial || selected?.serialNumber || '—'}</strong></span><span>MAC: <strong>{selected?.macAddress || '—'}</strong></span><span>Vị trí: <strong>Ngoài Zone</strong></span><span>Last seen: <strong>{selected?.lastSeenAtUtc || selected?.lastSeenAt || '—'}</strong></span></div>; })()}
          {false && selectedGatewayId && gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId)?.inventorySource && (() => { const selected = gateways.find(item => (item.gatewayId || item.id) === selectedGatewayId); return <div />; })()}
          <div className="grid grid-cols-1 gap-2"><Button type="button" onClick={verifyGatewayConnection} disabled={isCheckingGateway || !selectedGatewayId} className="w-full bg-amber-600 text-white">{isCheckingGateway ? 'Đang kiểm tra MQTT...' : gatewayConnected ? 'MQTT đã kết nối' : 'Kiểm tra kết nối thật'}</Button></div>
          {selectedGatewayId && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">Gateway phải được enrollment và hoàn tất Hardware Preparation trước khi xuất hiện trên GIS.</div>}
          {!gatewayConnected && <div className="rounded-lg bg-slate-100 p-3 text-slate-600">Chưa xác nhận MQTT online. Bạn vẫn có thể lưu cấu hình trước; Gateway sẽ tự lấy cấu hình sau khi kết nối Wi‑Fi. Nút kiểm tra MQTT chỉ dùng để xác nhận trạng thái.</div>}
          <>
          <div>
            <label className="block font-bold text-slate-800 mb-1">Các Node sẵn sàng triển khai vào Gateway</label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y">
              {gatewayConfigNodes.length === 0 ? <div className="p-3 text-slate-500">Chưa có Node provision — vẫn có thể lưu cấu hình Gateway.</div> : gatewayConfigNodes.map((node: any) => <label key={node.deviceId} className={`flex items-center gap-2 p-2.5 hover:bg-slate-50 ${selectedGatewayNodeIds.includes(node.deviceId) ? 'bg-emerald-50' : ''}`}><input type="checkbox" checked={selectedGatewayNodeIds.includes(node.deviceId)} onChange={event => setSelectedGatewayNodeIds(previous => event.target.checked ? [...new Set([...previous, node.deviceId])] : previous.filter(id => id !== node.deviceId))} /><span><strong>{node.hardwareAddress}</strong><small className="block text-slate-500">{node.deviceType} · GIS {node.zoneId ? 'đã có Zone' : 'chưa chấm'} · {selectedGatewayNodeIds.includes(node.deviceId) ? 'đang giữ tạm' : 'sẵn sàng'}</small></span></label>)}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Đã chọn tạm {selectedGatewayNodeIds.length}/{gatewayConfigNodes.length} Node Ready for Deployment. Số lượng chỉ trừ chính thức sau khi bấm lưu cấu hình.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-bold text-slate-800 mb-1">Chu kỳ gửi (giây)</label><input type="number" min={10} max={86400} value={gatewayInterval} onChange={e => setGatewayInterval(Math.min(86400, Math.max(10, Number(e.target.value) || 10)))} className="w-full border border-slate-300 rounded-lg p-2.5" /><small className="text-slate-500">Khoảng cách giữa hai lần gửi.</small></div>
            <div><label className="block font-bold text-slate-800 mb-1">Số lần gửi trong chu kỳ</label><input type="number" min={1} max={60} value={gatewaySamples} onChange={e => setGatewaySamples(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className="w-full border border-slate-300 rounded-lg p-2.5" /><small className="text-slate-500">Số sample Node gửi mỗi chu kỳ.</small></div>
          </div>
          <div><label className="block font-bold text-slate-800 mb-1">Vị trí lắp Gateway ngoài Zone</label><input value={gatewayLocation} onChange={e => setGatewayLocation(e.target.value)} placeholder="Ví dụ: Nhà kho phía Tây Farm, anten cao 6m" className="w-full border border-slate-300 rounded-lg p-2.5" /></div>
          <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => setIsGatewayModalOpen(false)}>Hủy</Button><Button type="button" className="bg-amber-600 text-white" onClick={saveGatewayConfiguration}>Lưu cấu hình Gateway</Button></div>
          </>
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

      {/* Gateway Configuration Modal */}
      {selectedGatewayForConfig && (
        <GatewayConfigModal
          isOpen={isGatewayConfigOpen}
          onClose={() => {
            setIsGatewayConfigOpen(false);
            setSelectedGatewayForConfig(null);
          }}
          gateway={selectedGatewayForConfig}
          onSuccess={() => {
            // refresh data
          }}
        />
      )}
    </div>
  );
};
