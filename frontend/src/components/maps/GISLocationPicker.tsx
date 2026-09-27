import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Layers, RefreshCw, Square, Trash2, Crosshair, Maximize2, Minimize2, Move, Search, Compass, Loader2 } from 'lucide-react';
import { Button } from '../ui/BaseUI';

// Custom Map Pins
const createCenterPinIcon = () =>
  L.divIcon({
    className: 'custom-center-pin-wrapper',
    html: `
      <div style="
        background-color: #062326;
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
        <div style="width:8px; height:8px; background:#10b981; border-radius:50%;"></div>
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
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
        <div style="
          position: absolute;
          top: -20px;
          background: #062326;
          color: #34d399;
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
  hidePolygon?: boolean;
  addressSearchQuery?: string;
  hideAddressSearch?: boolean;
}

// Preset Coordinates for Instant Vietnam Ag Hubs
const LOCATION_PRESETS: { name: string; coords: [number, number] }[] = [
  { name: 'Đà Lạt', coords: [11.9404, 108.4583] },
  { name: 'Đức Trọng', coords: [11.7256, 108.3752] },
  { name: 'Đơn Dương', coords: [11.8364, 108.5721] },
  { name: 'Củ Chi (TP.HCM)', coords: [11.0067, 106.5139] },
  { name: 'Mộc Châu (Sơn La)', coords: [20.8437, 104.6853] },
  { name: 'Buôn Ma Thuột', coords: [12.6667, 108.0383] },
];

// Map Controller Component for Click Handling, Smooth FlyTo, and Auto Fit Zoom
const MapEventsAndFitter: React.FC<{
  readOnly?: boolean;
  onMapClick: (lat: number, lng: number) => void;
  fitKey: number;
  polygon: [number, number][];
  center: [number, number];
  isCenterOnly: boolean;
}> = ({ readOnly, onMapClick, fitKey, polygon, center, isCenterOnly }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (!readOnly) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  // Smooth FlyTo whenever center location changes via search or selection
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 1.2 });
    }
  }, [center[0], center[1]]);

  useEffect(() => {
    if (fitKey === 0) return;
    if (!isCenterOnly && polygon && polygon.length >= 3) {
      const bounds = L.latLngBounds(polygon.map(pt => [pt[0], pt[1]]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView(center, 16);
    }
  }, [fitKey]);

  return null;
};

// Single Draggable Vertex Pin Component
const DraggableVertexMarker: React.FC<{
  position: [number, number];
  index: number;
  readOnly?: boolean;
  onDragEnd: (index: number, newLat: number, newLng: number) => void;
  onDelete: (index: number) => void;
}> = ({ position, index, readOnly, onDragEnd, onDelete }) => {
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
      draggable={!readOnly}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="p-1 space-y-1.5 text-slate-800 text-xs">
          <div className="font-bold text-[#062326] flex items-center justify-between gap-3">
            <span>Đỉnh ranh giới #{index + 1}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
              Kéo thả OK
            </span>
          </div>
          <div className="font-mono text-slate-600 text-[11px]">
            [{position[0].toFixed(6)}, {position[1].toFixed(6)}]
          </div>
          {!readOnly && (
            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-amber-700 italic flex items-center gap-0.5">
                <Move size={10} /> Kéo ghim để chỉnh
              </span>
              <button
                onClick={() => onDelete(index)}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-0.5"
              >
                <Trash2 size={11} /> Xóa điểm
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
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
  hidePolygon = false,
  addressSearchQuery = '',
  hideAddressSearch = true,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);
  const [mapType, setMapType] = useState<'osm' | 'street' | 'satellite'>('osm');
  const [fitKey, setFitKey] = useState(0);
  const [isCenterOnly, setIsCenterOnly] = useState<boolean>(hidePolygon);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Address Search State
  const [searchInput, setSearchInput] = useState(addressSearchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Keyboard shortcut Esc to exit fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => setFitKey(k => k + 1), 150);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      setFitKey(k => k + 1);
    }, 150);
  };

  useEffect(() => {
    setMapCenter(center);
  }, [center]);

  // Sync addressSearchQuery prop if provided
  useEffect(() => {
    if (addressSearchQuery) {
      setSearchInput(addressSearchQuery);
    }
  }, [addressSearchQuery]);

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

  // Address Geocoding Search Function
  const handleExecuteAddressSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchInput).trim();
    if (!q) return;

    setIsSearching(true);
    setSearchStatus('Đang tìm kiếm vị trí GIS...');

    // 1. Check presets for instant response
    const lower = q.toLowerCase();
    const preset = LOCATION_PRESETS.find(p => lower.includes(p.name.toLowerCase()));
    if (preset) {
      onCenterChange(preset.coords);
      setMapCenter(preset.coords);
      setIsSearching(false);
      setSearchStatus(`Đã định vị đến: [${preset.name}]`);
      setTimeout(() => setSearchStatus(null), 3500);
      return;
    }

    // 2. Query Nominatim OpenStreetMap Geocoding API
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=vn&limit=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const newCoords: [number, number] = [parseFloat(lat.toFixed(6)), parseFloat(lon.toFixed(6))];
          onCenterChange(newCoords);
          setMapCenter(newCoords);
          setSearchStatus(`Đã định vị thành công địa chỉ: "${data[0].display_name.split(',')[0]}"!`);
          setTimeout(() => setSearchStatus(null), 4000);
        } else {
          setSearchStatus('Không tìm thấy tọa độ cho địa chỉ này.');
        }
      } else {
        setSearchStatus('Không tìm thấy vị trí. Thử từ khóa ngắn hơn (vd: Đà Lạt, Củ Chi).');
      }
    } catch (err) {
      console.warn('Address geocoding failed', err);
      setSearchStatus('Lỗi tìm kiếm. Hãy thử chọn các vùng nông nghiệp gợi ý.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    const newPoint: [number, number] = [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))];

    if (isCenterOnly) {
      onCenterChange(newPoint);
      setMapCenter(newPoint);
    } else {
      const newPolygon = [...polygon, newPoint];
      onPolygonChange(newPolygon);
      if (polygon.length === 0) {
        onCenterChange(newPoint);
      }
    }
  };

  const handleDragVertex = (idx: number, newLat: number, newLng: number) => {
    const updatedPoly = [...polygon];
    updatedPoly[idx] = [newLat, newLng];
    onPolygonChange(updatedPoly);
  };

  const handleDeleteVertex = (idx: number) => {
    const updatedPoly = polygon.filter((_, i) => i !== idx);
    onPolygonChange(updatedPoly);
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
    setIsCenterOnly(false);
  };

  // Center pin drag handler
  const centerEventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const pos = marker.getLatLng();
          const newCenter: [number, number] = [parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6))];
          onCenterChange(newCenter);
          setMapCenter(newCenter);
        }
      },
    }),
    [onCenterChange]
  );

  // Calculate approximate area in m²
  const calculateAreaM2 = (coords: [number, number][]) => {
    if (coords.length < 3) return 0;
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
    if (level === 'FARM') return { stroke: '#062326', fill: '#062326', label: 'Vị trí Trang trại (Farm)' };
    if (level === 'FIELD') return { stroke: '#0284c7', fill: '#0284c7', label: 'Phân khu Lô đất (Field)' };
    return { stroke: '#10b981', fill: '#10b981', label: 'Nhà màng / Khu vực (Zone)' };
  };

  const levelStyle = getLevelColor();

  return (
    <div className="space-y-3">
      {/* Address Search & Quick Preset Location Bar */}
      {!readOnly && !hideAddressSearch && (
        <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="🔍 Nhập địa chỉ tìm vị trí (vd: Phường 12, Đà Lạt)..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteAddressSearch();
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 text-xs"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => handleExecuteAddressSearch()}
              disabled={isSearching}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Compass size={14} />}
              <span>Tìm vị trí GIS</span>
            </button>
          </div>

          {/* Preset Location Chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-300">
            <span className="text-slate-400">Vùng nông nghiệp:</span>
            {LOCATION_PRESETS.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setSearchInput(item.name);
                  handleExecuteAddressSearch(item.name);
                }}
                className="px-2 py-0.5 bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 rounded transition-colors text-[10px]"
              >
                📍 {item.name}
              </button>
            ))}
          </div>

          {searchStatus && (
            <div className="text-[11px] text-emerald-400 font-medium animate-in fade-in flex items-center gap-1 pt-0.5">
              <span>{searchStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* Map Canvas */}
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md p-3 sm:p-5 flex flex-col space-y-3 animate-in fade-in"
            : "relative w-full flex flex-col rounded-xl border border-slate-300 overflow-hidden shadow-md"
        }
        style={isFullscreen ? { height: '100vh', width: '100vw' } : { height }}
      >
        {/* Fullscreen Header Bar */}
        {isFullscreen && (
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl text-white shadow-xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <Maximize2 size={16} />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                  Bản đồ GIS Ranh giới {level === 'FARM' ? 'Trang trại' : level === 'FIELD' ? 'Lô đất' : 'Nhà màng'}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">Đang Mở rộng Toàn màn hình</span>
                </h4>
                <p className="text-[11px] text-slate-400 hidden sm:block">Nhấp chuột hoặc kéo thả ghim ranh giới để tinh chỉnh vị trí dễ dàng nhất</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg hover:scale-105"
            >
              <Minimize2 size={14} />
              <span>Thu nhỏ lại như ban đầu (Esc)</span>
            </button>
          </div>
        )}

        <div className="relative w-full h-full flex-1 rounded-xl overflow-hidden shadow-inner">
          {/* Realtime Info Badge */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 shadow-md space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Crosshair size={14} className="text-[#062326]" />
              <span>Tọa độ tâm: <strong className="font-mono text-slate-900">{center[0].toFixed(4)}, {center[1].toFixed(4)}</strong></span>
            </div>
            {!isCenterOnly && polygon.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1 gap-3">
                <span>Ranh giới: <strong className="text-emerald-700">{polygon.length} đỉnh</strong></span>
                <span>Diện tích: <strong className="text-[#062326] font-bold">{areaM2.toLocaleString()} m² ({areaHa} ha)</strong></span>
              </div>
            )}
          </div>

          {/* Map Layer & Zoom & Expand Controls Overlay */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            {/* Expand / Shrink Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ lại như ban đầu (Esc)" : "Mở rộng bản đồ toàn màn hình"}
              className="bg-[#062326] hover:bg-[#062326]/90 text-white px-2.5 py-1 rounded-lg border border-slate-700 shadow-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={13} className="text-amber-400" />
                  <span>Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} className="text-emerald-400" />
                  <span>Mở rộng Map</span>
                </>
              )}
            </button>

            {/* Fit Zoom Button */}
            <button
              type="button"
              onClick={() => setFitKey(k => k + 1)}
              title="Căn vừa vị trí (Fit Zoom)"
              className="bg-white/95 hover:bg-slate-100 text-slate-800 px-2 py-1 rounded-lg border border-slate-200 shadow-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Maximize2 size={13} className="text-emerald-600" />
              <span>Căn Zoom</span>
            </button>

            {/* Layer Selector */}
            <div className="bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-200 text-xs flex items-center gap-1 shadow-md">
              <button
                type="button"
                onClick={() => setMapType('osm')}
                className={`px-2 py-1 rounded transition-colors ${mapType === 'osm' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                OSM
              </button>
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={`px-2 py-1 rounded transition-colors ${mapType === 'street' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                Đường phố
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2 py-1 rounded transition-colors ${mapType === 'satellite' ? 'bg-[#062326] text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                Vệ tinh
              </button>
            </div>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-lg border border-slate-200 text-[10px] text-slate-700 shadow-xs flex items-center gap-3">
            {parentFarmPolygon && parentFarmPolygon.length >= 3 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#062326]/20 border border-[#062326] border-dashed" /> Trang trại mẹ
              </div>
            )}
            {parentFieldPolygon && parentFieldPolygon.length >= 3 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-500/20 border border-sky-600 border-dashed" /> Phân khu mẹ
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: levelStyle.stroke }} /> Hiện tại ({level})
            </div>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={level === 'FARM' ? 15 : level === 'FIELD' ? 16 : 17}
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
              readOnly={readOnly}
              onMapClick={handleMapClick}
              fitKey={fitKey}
              polygon={polygon}
              center={center}
              isCenterOnly={isCenterOnly}
            />

            {/* Center Point Marker (Draggable) */}
            <Marker
              position={center}
              icon={createCenterPinIcon()}
              draggable={!readOnly}
              eventHandlers={centerEventHandlers}
            >
              <Popup>
                <div className="text-xs font-semibold text-slate-900">
                  Tâm điểm {level}
                  {!readOnly && <p className="text-[10px] text-emerald-700 font-normal mt-1">Kéo ghim hoặc nhấp bản đồ để chọn tâm điểm</p>}
                </div>
              </Popup>
            </Marker>

            {/* Parent Farm Polygon */}
            {parentFarmPolygon && parentFarmPolygon.length >= 3 && (
              <Polygon
                positions={parentFarmPolygon}
                pathOptions={{ color: '#062326', fillColor: '#062326', fillOpacity: 0.08, weight: 2, dashArray: '6, 6' }}
              />
            )}

            {/* Parent Field Polygon */}
            {parentFieldPolygon && parentFieldPolygon.length >= 3 && (
              <Polygon
                positions={parentFieldPolygon}
                pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.12, weight: 2, dashArray: '4, 4' }}
              />
            )}

            {/* Current Polygon */}
            {!isCenterOnly && polygon.length >= 3 && (
              <Polygon
                positions={polygon}
                pathOptions={{ color: levelStyle.stroke, fillColor: levelStyle.fill, fillOpacity: 0.35, weight: 3 }}
              />
            )}

            {/* Polygon Vertices Pins */}
            {!isCenterOnly && polygon.map((pt, idx) => (
              <DraggableVertexMarker
                key={`${idx}-${pt[0]}-${pt[1]}`}
                position={pt}
                index={idx}
                readOnly={readOnly}
                onDragEnd={handleDragVertex}
                onDelete={handleDeleteVertex}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
        <Move size={16} className="text-emerald-700 shrink-0 mt-0.5" />
        <div>
          {isCenterOnly ? (
            <>
              <strong>Vị trí tâm điểm GIS:</strong> Nhấp trực tiếp trên bản đồ hoặc kéo ghim tâm điểm để tinh chỉnh vị trí nhanh chóng. Tọa độ được tự động cập nhật.
            </>
          ) : (
            <>
              <strong>Vẽ ranh giới GIS:</strong> Bạn có thể <strong>kéo thả trực tiếp (Drag & Drop)</strong> các ghim ranh giới <span className="font-mono font-bold text-emerald-800">#1, #2, #3...</span> và <strong>tâm điểm</strong> trên bản đồ để tinh chỉnh vị trí cực kỳ dễ dàng.
            </>
          )}
        </div>
      </div>
    </div>
  );
};
