import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { mockFarms, mockNodes, mockGateways } from '../../mocks/mockData';
import { SensorNode, Gateway } from '../../types';
import { Activity, Radio, Cpu, Battery, Wifi } from 'lucide-react';

// Custom Map Pins
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const gatewayIcon = L.divIcon({
  className: 'custom-gateway-pin',
  html: `<div style="background-color: #0284c7; width: 20px; height: 20px; border-radius: 4px; border: 2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 12px #0284c7;"><div style="width:6px; height:6px; background:white; border-radius:50%;"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export const FarmGISMap: React.FC<{
  height?: string;
  selectedZoneId?: string;
  onSelectZone?: (id: string) => void;
}> = ({ height = '450px', selectedZoneId, onSelectZone }) => {
  const farm = mockFarms[0];
  const center: [number, number] = farm.center || [11.9404, 108.4583];

  // Map boundary polygon coordinates
  const polygonCoords: [number, number][] = [
    [11.942, 108.456],
    [11.942, 108.460],
    [11.938, 108.460],
    [11.938, 108.456],
  ];

  return (
    <div className="relative w-full rounded-xl border border-slate-200 overflow-hidden shadow-lg">
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center gap-4 shadow-md">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow-green" /> LoRa Node Online</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-glow-amber" /> Warning / Low Battery</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-500 rounded-sm" /> LoRa Gateway</div>
      </div>

      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Farm Boundary Polygon */}
        <Polygon
          positions={polygonCoords}
          pathOptions={{ color: '#062326', fillColor: '#062326', fillOpacity: 0.12, weight: 2, dashArray: '4, 4' }}
        />

        {/* Gateway Markers */}
        {mockGateways.map((gw: Gateway) => (
          <Marker key={gw.gatewayId} position={[gw.latitude, gw.longitude]} icon={gatewayIcon}>
            <Popup>
              <div className="p-1 space-y-1 text-slate-800">
                <div className="flex items-center gap-2 font-bold text-[#062326]">
                  <Radio size={14} /> {gw.name}
                </div>
                <div className="text-xs text-slate-500">MAC: {gw.macAddress}</div>
                <div className="text-xs text-slate-700 flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <span>Trạng thái: <span className="text-emerald-700 font-semibold">{gw.status}</span></span>
                  <span>RSSI: {gw.rssi} dBm</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Node Markers */}
        {mockNodes.map((node: SensorNode) => {
          const color = node.status === 'ONLINE' ? '#16a34a' : node.status === 'WARNING' ? '#eab308' : '#e11d48';
          return (
            <Marker
              key={node.nodeId}
              position={[node.latitude, node.longitude]}
              icon={createCustomIcon(color)}
              eventHandlers={{
                click: () => onSelectZone && node.zoneId && onSelectZone(node.zoneId),
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
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
