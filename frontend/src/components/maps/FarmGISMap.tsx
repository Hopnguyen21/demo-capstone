import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../app/providers/AuthContext';
import { deviceService } from '../../services';
import { SensorNode, Gateway } from '../../types';
import { Radio, Cpu, Battery, Wifi, Maximize2, Move } from 'lucide-react';

// Custom Map Pins
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color}; cursor: grab;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const gatewayIcon = L.divIcon({
  className: 'custom-gateway-pin',
  html: `<div style="background-color: #0284c7; width: 22px; height: 22px; border-radius: 6px; border: 2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 12px #0284c7; cursor: grab;"><div style="width:7px; height:7px; background:white; border-radius:50%;"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Fit Bounds Controller Helper
const MapFitter: React.FC<{ coords: [number, number][]; center: [number, number]; fitKey: number }> = ({ coords, center, fitKey }) => {
  const map = useMap();

  useEffect(() => {
    if (fitKey === 0) return;
    if (coords && coords.length >= 3) {
      const bounds = L.latLngBounds(coords.map(pt => [pt[0], pt[1]]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView(center, 15);
    }
  }, [fitKey]);

  return null;
};

export const FarmGISMap: React.FC<{
  height?: string;
  selectedZoneId?: string;
  onSelectZone?: (id: string) => void;
  allowDragNodes?: boolean;
}> = ({ height = '450px', selectedZoneId, onSelectZone, allowDragNodes = true }) => {
  const { farms } = useAuth();
  const [mapType, setMapType] = useState<'osm' | 'street' | 'satellite'>('osm');
  const [fitKey, setFitKey] = useState(0);
  const [nodesList, setNodesList] = useState<SensorNode[]>([]);
  const [gatewaysList, setGatewaysList] = useState<Gateway[]>([]);

  useEffect(() => {
    deviceService.getGateways().then(res => {
      if (res && res.length > 0) setGatewaysList(res);
    }).catch(() => {});

    deviceService.getNodes().then(res => {
      if (res && res.length > 0) setNodesList(res);
    }).catch(() => {});
  }, []);

  const farm = farms[0];
  const center: [number, number] = farm?.center || [11.9404, 108.4583];

  // Map boundary polygon coordinates
  const polygonCoords: [number, number][] = [
    [11.942, 108.456],
    [11.942, 108.460],
    [11.938, 108.460],
    [11.938, 108.456],
  ];

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

  const handleNodeDragEnd = (nodeId: string, newLat: number, newLng: number) => {
    setNodesList(prev =>
      prev.map(n => (n.nodeId === nodeId ? { ...n, latitude: newLat, longitude: newLng } : n))
    );
  };

  const handleGatewayDragEnd = (gwId: string, newLat: number, newLng: number) => {
    setGatewaysList(prev =>
      prev.map(g => (g.gatewayId === gwId ? { ...g, latitude: newLat, longitude: newLng } : g))
    );
  };

  return (
    <div className="relative w-full rounded-xl border border-slate-200 overflow-hidden shadow-lg" style={{ height }}>
      {/* Overlay Control Bar: Map Switcher & Legend */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-wrap items-center gap-2">
        {/* Fit Bounds Button */}
        <button
          onClick={() => setFitKey(k => k + 1)}
          title="Căn vừa ranh giới (Fit Zoom)"
          className="bg-white/95 hover:bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 shadow-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
        >
          <Maximize2 size={13} className="text-emerald-600" />
          <span>Căn Zoom</span>
        </button>

        {/* Map Type Switcher */}
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

        {/* Legend */}
        <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center gap-3 shadow-md">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow-green" /> Node Online</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-glow-amber" /> Cảnh báo</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-500 rounded-sm" /> Gateway</div>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={15}
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

        <MapFitter coords={polygonCoords} center={center} fitKey={fitKey} />

        {/* Farm Boundary Polygon */}
        <Polygon
          positions={polygonCoords}
          pathOptions={{ color: '#062326', fillColor: '#062326', fillOpacity: 0.12, weight: 2, dashArray: '4, 4' }}
        />

        {/* Gateway Markers (Draggable) */}
        {gatewaysList.filter(gw => typeof gw.latitude === 'number' && typeof gw.longitude === 'number').map((gw: Gateway) => (
          <Marker
            key={gw.gatewayId}
            position={[gw.latitude, gw.longitude]}
            icon={gatewayIcon}
            draggable={allowDragNodes}
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                handleGatewayDragEnd(gw.gatewayId, parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
              }
            }}
          >
            <Popup>
              <div className="p-1 space-y-1 text-slate-800">
                <div className="flex items-center gap-2 font-bold text-[#062326]">
                  <Radio size={14} /> {gw.name}
                </div>
                <div className="text-xs text-slate-500 font-mono">MAC: {gw.macAddress}</div>
                <div className="text-xs text-slate-700 flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <span>Trạng thái: <span className="text-emerald-700 font-semibold">{gw.status}</span></span>
                  <span>RSSI: {gw.rssi} dBm</span>
                </div>
                {allowDragNodes && (
                  <div className="text-[10px] text-amber-700 italic pt-1 flex items-center gap-1 border-t border-slate-100 mt-1">
                    <Move size={10} /> Giữ chuột kéo thả Gateway
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Node Markers (Draggable) */}
        {nodesList.filter(n => typeof n.latitude === 'number' && typeof n.longitude === 'number').map((node: SensorNode) => {
          const color = node.status === 'ONLINE' ? '#16a34a' : node.status === 'WARNING' ? '#eab308' : '#e11d48';
          return (
            <Marker
              key={node.nodeId}
              position={[node.latitude, node.longitude]}
              icon={createCustomIcon(color)}
              draggable={allowDragNodes}
              eventHandlers={{
                click: () => onSelectZone && node.zoneId && onSelectZone(node.zoneId),
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  handleNodeDragEnd(node.nodeId, parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
                }
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-slate-800 min-w-[200px]">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="font-bold text-[#062326] text-xs flex items-center gap-1">
                      <Cpu size={12} /> {node.nodeCode}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                      {node.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 pt-1">{node.name}</div>
                  <div className="text-xs text-slate-500">{node.zoneName}</div>
                  <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                    [{node.latitude.toFixed(6)}, {node.longitude.toFixed(6)}]
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-1 text-slate-700">
                      <Battery size={12} className={node.batteryLevel < 30 ? 'text-amber-600' : 'text-emerald-600'} />
                      <span>{node.batteryLevel}% Pin</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-700">
                      <Wifi size={12} className="text-sky-600" />
                      <span>{node.rssi} dBm</span>
                    </div>
                  </div>

                  {allowDragNodes && (
                    <div className="text-[10px] text-amber-700 italic pt-1 flex items-center gap-1 border-t border-slate-100 mt-1">
                      <Move size={10} /> Giữ chuột kéo thả Node
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
