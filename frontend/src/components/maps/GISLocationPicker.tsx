import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Layers, RefreshCw, Square, Check, Trash2, Crosshair } from 'lucide-react';
import { Button } from '../ui/BaseUI';

// Custom Map Pins
const centerPinIcon = L.divIcon({
  className: 'custom-center-pin',
  html: `<div style="background-color: #062326; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="width:6px; height:6px; background:#10b981; border-radius:50%;"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const vertexPinIcon = L.divIcon({
  className: 'custom-vertex-pin',
  html: `<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface GISLocationPickerProps {
  level: 'FARM' | 'FIELD' | 'ZONE';
  center: [number, number];
  onCenterChange: (center: [number, number]) => void;
  polygon: [number, number][];
  onPolygonChange: (polygon: [number, number][]) => void;
  parentFarmPolygon?: [number, number][];
  parentFieldPolygon?: [number, number][];
  height?: string;
  readOnly?: boolean;
}

// Map Event Listener for Click to Add Polygon Vertices
const MapEventsHandler: React.FC<{
  readOnly?: boolean;
  onMapClick: (lat: number, lng: number) => void;
}> = ({ readOnly, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (!readOnly) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const GISLocationPicker: React.FC<GISLocationPickerProps> = ({
  level,
  center,
  onCenterChange,
  polygon,
  onPolygonChange,
  parentFarmPolygon,
  parentFieldPolygon,
  height = '420px',
  readOnly = false,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);

  useEffect(() => {
    setMapCenter(center);
  }, [center]);

  const handleMapClick = (lat: number, lng: number) => {
    const newPoint: [number, number] = [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];
    const newPolygon = [...polygon, newPoint];
    onPolygonChange(newPolygon);

    // Auto calculate center if 1st point
    if (polygon.length === 0) {
      onCenterChange(newPoint);
    }
  };

  const handleClearPoints = () => {
    onPolygonChange([]);
  };

  const handleUndoPoint = () => {
    if (polygon.length > 0) {
      onPolygonChange(polygon.slice(0, -1));
    }
  };

  const handleQuickBox = () => {
    const [lat, lng] = mapCenter;
    const deltaLat = level === 'FARM' ? 0.003 : level === 'FIELD' ? 0.0015 : 0.0008;
    const deltaLng = level === 'FARM' ? 0.004 : level === 'FIELD' ? 0.0020 : 0.0010;

    const quickPoly: [number, number][] = [
      [parseFloat((lat + deltaLat).toFixed(6)), parseFloat((lng - deltaLng).toFixed(6))],
      [parseFloat((lat + deltaLat).toFixed(6)), parseFloat((lng + deltaLng).toFixed(6))],
      [parseFloat((lat - deltaLat).toFixed(6)), parseFloat((lng + deltaLng).toFixed(6))],
      [parseFloat((lat - deltaLat).toFixed(6)), parseFloat((lng - deltaLng).toFixed(6))],
    ];
    onPolygonChange(quickPoly);
  };

  // Calculate approximate area in m²
  const calculateAreaM2 = (coords: [number, number][]) => {
    if (coords.length < 3) return 0;
    // Simple planar polygon area approximation converted to meters
    let area = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const p1 = coords[i];
      const p2 = coords[j];
      area += (p1[1] * 111320 * Math.cos((p1[0] * Math.PI) / 180)) * (p2[0] * 110540) -
        (p2[1] * 111320 * Math.cos((p2[0] * Math.PI) / 180)) * (p1[0] * 110540);
    }
    return Math.abs(Math.round(area / 2));
  };

  const areaM2 = calculateAreaM2(polygon);
  const areaHa = (areaM2 / 10000).toFixed(2);

  const getLevelColor = () => {
    if (level === 'FARM') return { stroke: '#062326', fill: '#062326', label: 'Ranh giới Trang trại (Farm)' };
    if (level === 'FIELD') return { stroke: '#0284c7', fill: '#0284c7', label: 'Phân khu Lô đất (Field)' };
    return { stroke: '#10b981', fill: '#10b981', label: 'Nhà màng / Khu vực (Zone)' };
  };

  const levelStyle = getLevelColor();

  return (
    <div className="space-y-3">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-xl shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-200">GIS Coordinates Picker</span>
            <span className="text-slate-400 ml-2">[{levelStyle.label}]</span>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700 py-1 text-[11px]" onClick={handleQuickBox}>
              <Square size={13} className="mr-1 text-emerald-400" /> Tạo khung nhanh
            </Button>
            <Button size="sm" variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700 py-1 text-[11px]" onClick={handleUndoPoint} disabled={polygon.length === 0}>
              <RefreshCw size={13} className="mr-1 text-amber-400" /> Hoàn tác điểm
            </Button>
            <Button size="sm" variant="ghost" className="text-rose-300 hover:bg-rose-950/50 py-1 text-[11px]" onClick={handleClearPoints} disabled={polygon.length === 0}>
              <Trash2 size={13} className="mr-1" /> Xóa tất cả
            </Button>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative w-full rounded-xl border border-slate-300 overflow-hidden shadow-md" style={{ height }}>
        {/* Realtime Info Badge */}
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 shadow-md space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <Crosshair size={14} className="text-[#062326]" />
            <span>Tọa độ trung tâm: <strong className="font-mono text-slate-900">{center[0].toFixed(4)}, {center[1].toFixed(4)}</strong></span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1">
            <span>Số điểm ranh giới: <strong className="text-emerald-700">{polygon.length} điểm</strong></span>
            <span className="ml-3">Diện tính tính toán: <strong className="text-[#062326] font-bold">{areaM2.toLocaleString()} m² ({areaHa} ha)</strong></span>
          </div>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-lg border border-slate-200 text-[10px] text-slate-700 shadow-xs flex items-center gap-3">
          {parentFarmPolygon && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#062326]/20 border border-[#062326] border-dashed" /> Trang trại mẹ (Farm)
            </div>
          )}
          {parentFieldPolygon && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-500/20 border border-sky-600 border-dashed" /> Phân khu mẹ (Field)
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: levelStyle.stroke }} /> Đối tượng hiện tại ({level})
          </div>
        </div>

        <MapContainer center={mapCenter} zoom={level === 'FARM' ? 15 : level === 'FIELD' ? 16 : 17} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEventsHandler readOnly={readOnly} onMapClick={handleMapClick} />

          {/* Center Point Marker */}
          <Marker position={center} icon={centerPinIcon}>
            <Popup>
              <div className="text-xs font-semibold text-slate-900">Vị trí Trung tâm {level}</div>
            </Popup>
          </Marker>

          {/* Parent Farm Polygon (if present for Field or Zone creation) */}
          {parentFarmPolygon && parentFarmPolygon.length >= 3 && (
            <Polygon
              positions={parentFarmPolygon}
              pathOptions={{ color: '#062326', fillColor: '#062326', fillOpacity: 0.08, weight: 2, dashArray: '6, 6' }}
            />
          )}

          {/* Parent Field Polygon (if present for Zone creation) */}
          {parentFieldPolygon && parentFieldPolygon.length >= 3 && (
            <Polygon
              positions={parentFieldPolygon}
              pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.12, weight: 2, dashArray: '4, 4' }}
            />
          )}

          {/* Current Polygon */}
          {polygon.length >= 3 && (
            <Polygon
              positions={polygon}
              pathOptions={{ color: levelStyle.stroke, fillColor: levelStyle.fill, fillOpacity: 0.35, weight: 3 }}
            />
          )}

          {/* Polygon Vertices Pins */}
          {polygon.map((pt, idx) => (
            <Marker key={idx} position={pt} icon={vertexPinIcon}>
              <Popup>
                <div className="text-xs">Điểm ranh giới #{idx + 1}: [{pt[0]}, {pt[1]}]</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
        <MapPin size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Hướng dẫn GIS Map:</strong> Nhấn trực tiếp lên bản đồ để chấm từng tọa độ ranh giới polygon ({level === 'FARM' ? 'Trang trại' : level === 'FIELD' ? 'Lô đất' : 'Nhà màng'}). Nhấn <em>"Tạo khung nhanh"</em> để tự động tạo hình chữ nhật mẫu quanh tâm điểm.
        </div>
      </div>
    </div>
  );
};
