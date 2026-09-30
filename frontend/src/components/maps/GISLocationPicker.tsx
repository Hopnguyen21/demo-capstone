import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Layers, RefreshCw, Square, Trash2, Crosshair, Maximize2, Minimize2, Move, Search, Compass, Loader2, Plus, Edit3, Clipboard, FileText, Check, AlertCircle, X, List, Info, AlertTriangle } from 'lucide-react';
import { Button, Modal } from '../ui/BaseUI';

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

const createVertexPinIcon = (index: number, isOutside?: boolean) =>
  L.divIcon({
    className: 'custom-vertex-pin-wrapper',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: grab;">
        <div style="
          background-color: ${isOutside ? '#ef4444' : '#10b981'};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
        <div style="
          position: absolute;
          top: -20px;
          background: ${isOutside ? '#dc2626' : '#062326'};
          color: ${isOutside ? '#fecaca' : '#34d399'};
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid ${isOutside ? 'rgba(239,68,68,0.6)' : 'rgba(52, 211, 153, 0.4)'};
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">#${index + 1}${isOutside ? ' ⚠️' : ''}</div>
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
  /** Called when center drag completes with reverse-geocoded address (Farm only) */
  onAddressChange?: (address: string) => void;
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

// ─── Point-in-Polygon (Ray Casting) ───────────────────────────────────────────
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (polygon.length < 3) return true; // no boundary = always inside
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function allPointsInsidePolygon(points: [number, number][], boundary: [number, number][]): boolean {
  if (boundary.length < 3) return true;
  return points.every(pt => pointInPolygon(pt, boundary));
}

// ─── Map Controller ───────────────────────────────────────────────────────────
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

// ─── Draggable Vertex Marker ──────────────────────────────────────────────────
const DraggableVertexMarker: React.FC<{
  position: [number, number];
  index: number;
  readOnly?: boolean;
  isOutside?: boolean;
  onDragEnd: (index: number, newLat: number, newLng: number) => void;
  onDelete: (index: number) => void;
}> = ({ position, index, readOnly, isOutside, onDragEnd, onDelete }) => {
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
      icon={createVertexPinIcon(index, isOutside)}
      draggable={!readOnly}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="p-1 space-y-1.5 text-slate-800 text-xs">
          <div className="font-bold text-[#062326] flex items-center justify-between gap-3">
            <span>Đỉnh ranh giới #{index + 1}</span>
            {isOutside ? (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">
                ⚠️ Ngoài Lô đất!
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                Kéo thả OK
              </span>
            )}
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

// ─── Main Component ───────────────────────────────────────────────────────────
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
  onAddressChange,
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

  // Reverse geocoding state (Farm only)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Manual Coordinate Input State
  const [showCoordModal, setShowCoordModal] = useState(false);
  const [coordInputs, setCoordInputs] = useState<{ lat: string; lng: string }[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [coordModeTab, setCoordModeTab] = useState<'rows' | 'bulk'>('rows');
  const [coordError, setCoordError] = useState<string | null>(null);
  // Live preview polygon from modal inputs
  const [previewPolygon, setPreviewPolygon] = useState<[number, number][] | null>(null);

  // Zone boundary violation state
  const [zoneViolations, setZoneViolations] = useState<boolean[]>([]);
  const [zoneOutsideWarning, setZoneOutsideWarning] = useState(false);

  // Stable refs to avoid stale closures in event handlers
  const onAddressChangeRef = React.useRef(onAddressChange);
  useEffect(() => { onAddressChangeRef.current = onAddressChange; }, [onAddressChange]);

  // ── Reverse Geocode (Farm center drag/click) ──────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (level !== 'FARM') return;
    const cb = onAddressChangeRef.current;
    if (!cb) return;
    setIsReverseGeocoding(true);

    // Helper: find nearest preset by Haversine
    const nearestPreset = () => {
      let best = LOCATION_PRESETS[0];
      let bestDist = Infinity;
      for (const p of LOCATION_PRESETS) {
        const dLat = (p.coords[0] - lat) * 110540;
        const dLng = (p.coords[1] - lng) * 111320 * Math.cos(lat * Math.PI / 180);
        const d = Math.sqrt(dLat * dLat + dLng * dLng);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      return { name: best.name, dist: bestDist };
    };

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'vi',
            'User-Agent': 'SmartFarmApp/1.0 (demo)',
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const parts: string[] = [];
        const street = addr.road || addr.pedestrian || addr.footway || addr.path || addr.neighbourhood;
        if (street) parts.push(street);
        const ward = addr.suburb || addr.quarter || addr.hamlet;
        if (ward) parts.push(ward);
        const district = addr.city_district || addr.district || addr.county;
        if (district) parts.push(district);
        const city = addr.city || addr.town || addr.village || addr.municipality;
        if (city) parts.push(city);
        const province = addr.state || addr.region;
        if (province) parts.push(province);

        if (parts.length >= 2) {
          cb(parts.join(', '));
        } else {
          // Fallback: use first 3 parts of display_name
          const fallback = data.display_name.split(',').slice(0, 3).map((s: string) => s.trim()).join(', ');
          cb(fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      } else {
        // No result — use nearest preset name + coords
        const { name } = nearestPreset();
        cb(`Gần ${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
      // Fallback: nearest preset + coordinates
      const { name, dist } = nearestPreset();
      if (dist < 50000) {
        cb(`Gần ${name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } else {
        cb(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [level]); // level is stable within a component instance

  // ── Zone boundary check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (level === 'ZONE' && parentFieldPolygon && parentFieldPolygon.length >= 3 && polygon.length > 0) {
      const violations = polygon.map(pt => !pointInPolygon(pt, parentFieldPolygon));
      setZoneViolations(violations);
      setZoneOutsideWarning(violations.some(Boolean));
    } else {
      setZoneViolations([]);
      setZoneOutsideWarning(false);
    }
  }, [level, polygon, parentFieldPolygon]);

  const handleOpenCoordModal = () => {
    if (polygon && polygon.length > 0) {
      const pts = polygon.map(pt => ({ lat: pt[0].toFixed(6), lng: pt[1].toFixed(6) }));
      setCoordInputs(pts);
      setBulkText(pts.map(p => `${p.lat}, ${p.lng}`).join('\n'));
    } else {
      const [lat, lng] = mapCenter;
      const defaultPts = [
        { lat: (lat + 0.0012).toFixed(6), lng: (lng - 0.0015).toFixed(6) },
        { lat: (lat + 0.0012).toFixed(6), lng: (lng + 0.0015).toFixed(6) },
        { lat: (lat - 0.0012).toFixed(6), lng: (lng + 0.0015).toFixed(6) },
      ];
      setCoordInputs(defaultPts);
      setBulkText(defaultPts.map(p => `${p.lat}, ${p.lng}`).join('\n'));
    }
    setPreviewPolygon(null);
    setCoordError(null);
    setShowCoordModal(true);
  };

  const handleAddCoordRow = () => {
    const lastPt = coordInputs[coordInputs.length - 1];
    const baseLat = lastPt ? parseFloat(lastPt.lat) : mapCenter[0];
    const baseLng = lastPt ? parseFloat(lastPt.lng) : mapCenter[1];
    const newLat = (baseLat - 0.0008).toFixed(6);
    const newLng = (baseLng - 0.0008).toFixed(6);
    setCoordInputs(prev => [...prev, { lat: newLat, lng: newLng }]);
  };

  const handleRemoveCoordRow = (index: number) => {
    setCoordInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCoordInputChange = (index: number, field: 'lat' | 'lng', val: string) => {
    setCoordInputs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const parseValidPoints = (): [number, number][] => {
    if (coordModeTab === 'bulk') {
      const lines = bulkText.split('\n');
      const valid: [number, number][] = [];
      for (const line of lines) {
        const parts = line.trim().split(/[\s,;]+/);
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            valid.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
          }
        }
      }
      return valid;
    } else {
      const valid: [number, number][] = [];
      for (const item of coordInputs) {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          valid.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
        }
      }
      return valid;
    }
  };

  // Live preview: update previewPolygon whenever inputs change inside modal
  useEffect(() => {
    if (!showCoordModal) return;
    const pts = parseValidPoints();
    setPreviewPolygon(pts.length >= 3 ? pts : null);
  }, [coordInputs, bulkText, coordModeTab, showCoordModal]);

  // Zone-inside-field check for modal preview
  const previewViolations = useMemo(() => {
    if (level !== 'ZONE' || !parentFieldPolygon || parentFieldPolygon.length < 3 || !previewPolygon) return [];
    return previewPolygon.map(pt => !pointInPolygon(pt, parentFieldPolygon));
  }, [previewPolygon, parentFieldPolygon, level]);
  const previewHasViolation = previewViolations.some(Boolean);

  const handleApplyCoordinates = () => {
    const validPoints = parseValidPoints();
    if (validPoints.length < 3) {
      setCoordError(`⚠️ Không thể tạo ranh giới! Yêu cầu nhập tối thiểu 3 điểm tọa độ hợp lệ. (Hiện tại chỉ có ${validPoints.length} điểm).`);
      return;
    }

    // Zone boundary check
    if (level === 'ZONE' && parentFieldPolygon && parentFieldPolygon.length >= 3) {
      const outside = validPoints.filter(pt => !pointInPolygon(pt, parentFieldPolygon));
      if (outside.length > 0) {
        setCoordError(`⚠️ ${outside.length} điểm tọa độ nằm NGOÀI ranh giới Lô đất (Field)! Hãy điều chỉnh lại tọa độ để Zone nằm bên trong Lô đất.`);
        return;
      }
    }

    let sumLat = 0;
    let sumLng = 0;
    validPoints.forEach(pt => {
      sumLat += pt[0];
      sumLng += pt[1];
    });
    const avgLat = parseFloat((sumLat / validPoints.length).toFixed(6));
    const avgLng = parseFloat((sumLng / validPoints.length).toFixed(6));

    onPolygonChange(validPoints);
    onCenterChange([avgLat, avgLng]);
    setMapCenter([avgLat, avgLng]);
    setIsCenterOnly(false);
    setPreviewPolygon(null);
    setShowCoordModal(false);
    setTimeout(() => setFitKey(k => k + 1), 150);
  };

  // Keyboard shortcut Esc to exit fullscreen
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

  const handleExecuteAddressSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchInput).trim();
    if (!q) return;

    setIsSearching(true);
    setSearchStatus('Đang tìm kiếm vị trí GIS...');

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
      // Trigger reverse geocoding for FARM level when user clicks map
      if (level === 'FARM' && onAddressChange) {
        reverseGeocode(newPoint[0], newPoint[1]);
      }
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

  // Center pin drag handler — with reverse geocoding for FARM
  const reverseGeocodeRef = React.useRef(reverseGeocode);
  useEffect(() => { reverseGeocodeRef.current = reverseGeocode; }, [reverseGeocode]);

  const centerEventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const pos = marker.getLatLng();
          const newCenter: [number, number] = [parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6))];
          onCenterChange(newCenter);
          setMapCenter(newCenter);
          // Trigger reverse geocoding for FARM level via stable ref
          if (level === 'FARM') {
            reverseGeocodeRef.current(newCenter[0], newCenter[1]);
          }
        }
      },
    }),
    [onCenterChange, level]
  );

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

      {/* Zone outside Field warning banner */}
      {level === 'ZONE' && zoneOutsideWarning && (
        <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <span>
            <strong>⚠️ Cảnh báo:</strong> Một số đỉnh của Zone đang nằm <strong>ngoài ranh giới Lô đất (Field)</strong>!
            Hãy kéo ghim đỏ vào bên trong Lô đất hoặc dùng "📍 Nhập Tọa độ" để chỉnh lại.
          </span>
        </div>
      )}

      {/* Reverse geocoding indicator */}
      {level === 'FARM' && isReverseGeocoding && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 animate-in fade-in">
          <Loader2 size={12} className="animate-spin" />
          <span>Đang lấy địa chỉ từ vị trí ghim...</span>
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
            {level === 'FARM' && isReverseGeocoding && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 border-t border-slate-100 pt-1">
                <Loader2 size={10} className="animate-spin" /> Đang cập nhật địa chỉ...
              </div>
            )}
          </div>

          {/* Map Layer & Zoom & Expand Controls Overlay */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 flex-wrap justify-end">
            {/* Manual Coordinate Input Button */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleOpenCoordModal}
                title="Nhập điểm ranh giới bằng Tọa độ (Lat, Lng) - Tối thiểu 3 điểm"
                className="bg-[#062326] hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg border border-emerald-500/50 shadow-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <MapPin size={13} className="text-emerald-400" />
                <span>📍 Nhập Tọa độ (Lat/Lng)</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1 py-0.5 rounded font-mono">Min 3 điểm</span>
              </button>
            )}

            {/* Expand / Shrink Fullscreen Toggle */}
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
            {level === 'ZONE' && zoneOutsideWarning && (
              <div className="flex items-center gap-1.5 text-red-700 font-bold">
                <span className="w-3 h-3 rounded bg-red-400" /> Ngoài Lô đất!
              </div>
            )}
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
                  {!readOnly && <p className="text-[10px] text-emerald-700 font-normal mt-1">
                    Kéo ghim để chọn vị trí{level === 'FARM' ? ' — Địa chỉ sẽ tự động cập nhật' : ''}
                  </p>}
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
                pathOptions={{
                  color: zoneOutsideWarning ? '#ef4444' : levelStyle.stroke,
                  fillColor: zoneOutsideWarning ? '#ef4444' : levelStyle.fill,
                  fillOpacity: 0.35,
                  weight: zoneOutsideWarning ? 3 : 3,
                  dashArray: zoneOutsideWarning ? '5, 5' : undefined,
                }}
              />
            )}

            {/* Polygon Vertices Pins */}
            {!isCenterOnly && polygon.map((pt, idx) => (
              <DraggableVertexMarker
                key={`${idx}-${pt[0]}-${pt[1]}`}
                position={pt}
                index={idx}
                readOnly={readOnly}
                isOutside={level === 'ZONE' ? zoneViolations[idx] : false}
                onDragEnd={handleDragVertex}
                onDelete={handleDeleteVertex}
              />
            ))}

            {/* Live Preview Polygon from modal inputs */}
            {showCoordModal && previewPolygon && previewPolygon.length >= 3 && (
              <Polygon
                positions={previewPolygon}
                pathOptions={{
                  color: previewHasViolation ? '#f97316' : '#8b5cf6',
                  fillColor: previewHasViolation ? '#f97316' : '#8b5cf6',
                  fillOpacity: 0.25,
                  weight: 2,
                  dashArray: '8, 4',
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
        <Move size={16} className="text-emerald-700 shrink-0 mt-0.5" />
        <div>
          {isCenterOnly ? (
            <>
              <strong>Vị trí tâm điểm GIS:</strong> Nhấp trực tiếp trên bản đồ hoặc kéo ghim tâm điểm để tinh chỉnh vị trí nhanh chóng.
              {level === 'FARM' && <> Địa chỉ sẽ <strong>tự động cập nhật</strong> khi kéo ghim.</>}
            </>
          ) : (
            <>
              <strong>Vẽ ranh giới GIS:</strong> Bạn có thể <strong>kéo thả trực tiếp (Drag & Drop)</strong> các ghim ranh giới <span className="font-mono font-bold text-emerald-800">#1, #2, #3...</span> và <strong>tâm điểm</strong> trên bản đồ để tinh chỉnh vị trí cực kỳ dễ dàng.
              {level === 'FARM' && <> Địa chỉ sẽ <strong>tự động cập nhật</strong> khi kéo ghim.</>}
              {level === 'ZONE' && <> <strong className="text-red-700">Lưu ý:</strong> Các điểm của Zone phải nằm trong ranh giới Lô đất.</>}
            </>
          )}
        </div>
      </div>

      {/* Modal Nhập điểm bằng Tọa độ */}
      <Modal
        isOpen={showCoordModal}
        title="📍 Nhập Ranh giới GIS bằng Tọa độ (Lat, Lng) - Tối thiểu 3 điểm"
        onClose={() => { setShowCoordModal(false); setPreviewPolygon(null); }}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Info size={15} className="text-sky-600" /> Quy định nhập điểm Tọa độ GIS:
            </div>
            <p className="text-slate-700">
              Nhập danh sách tọa độ (Latitude: Vĩ độ, Longitude: Kinh độ). <strong>Phải nhập tối thiểu 3 điểm hợp lệ</strong> thì mới được phép cập nhật ranh giới Polygon lên bản đồ.
              {level === 'ZONE' && parentFieldPolygon && parentFieldPolygon.length >= 3 && (
                <> <strong className="text-red-700">Zone phải nằm hoàn toàn bên trong Lô đất (Field).</strong></>
              )}
            </p>
            {/* Live preview note */}
            <p className="text-[11px] text-purple-700 flex items-center gap-1 font-semibold">
              <span>🟣</span> Đường nét đứt màu tím trên bản đồ là <strong>xem trước</strong> vị trí ranh giới theo tọa độ đang nhập.
            </p>
          </div>

          {/* Tab Selection Mode */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setCoordModeTab('rows')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
                coordModeTab === 'rows'
                  ? 'bg-[#062326] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <List size={14} /> Nhập từng dòng (Row Inputs)
            </button>
            <button
              type="button"
              onClick={() => setCoordModeTab('bulk')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors ${
                coordModeTab === 'bulk'
                  ? 'bg-[#062326] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText size={14} /> Dán văn bản hàng loạt (Bulk Paste)
            </button>
          </div>

          {/* Validation Status Banner */}
          {(() => {
            const validCount = parseValidPoints().length;
            const isValid = validCount >= 3;
            const hasViolation = level === 'ZONE' && previewHasViolation;
            return (
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                hasViolation
                  ? 'bg-red-50 text-red-900 border-red-300'
                  : isValid
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  {hasViolation
                    ? <AlertTriangle size={16} className="text-red-600 shrink-0" />
                    : isValid
                      ? <Check size={16} className="text-emerald-600 shrink-0" />
                      : <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  }
                  <span>
                    {hasViolation
                      ? `⚠️ ${previewViolations.filter(Boolean).length} điểm nằm ngoài ranh giới Lô đất!`
                      : <>Số điểm hợp lệ nhận diện được: <strong className="font-mono text-sm">{validCount}</strong> / 3 điểm tối thiểu.</>
                    }
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  hasViolation
                    ? 'bg-red-200 text-red-900'
                    : isValid
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-amber-200 text-amber-900'
                }`}>
                  {hasViolation ? '❌ Ngoài Field!' : isValid ? '✅ Đủ điều kiện (>=3 điểm)' : '⚠️ Cần thêm điểm (< 3)'}
                </span>
              </div>
            );
          })()}

          {coordError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{coordError}</span>
            </div>
          )}

          {/* Row Inputs Mode */}
          {coordModeTab === 'rows' && (
            <div className="space-y-3">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {coordInputs.map((row, idx) => {
                  const lat = parseFloat(row.lat);
                  const lng = parseFloat(row.lng);
                  const isValidPoint = !isNaN(lat) && !isNaN(lng);
                  const isViolating = level === 'ZONE' && parentFieldPolygon && parentFieldPolygon.length >= 3
                    && isValidPoint && !pointInPolygon([lat, lng], parentFieldPolygon);

                  return (
                    <div key={idx} className={`flex items-center gap-2 p-2 border rounded-lg ${
                      isViolating ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <span className={`font-mono font-bold w-12 shrink-0 ${isViolating ? 'text-red-600' : 'text-slate-500'}`}>
                        #{idx + 1} {isViolating ? '⚠️' : ''}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Vĩ độ (Lat)</label>
                          <input
                            type="text"
                            value={row.lat}
                            onChange={e => handleCoordInputChange(idx, 'lat', e.target.value)}
                            placeholder="vd: 11.9419"
                            className={`w-full bg-white border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#062326] ${
                              isViolating ? 'border-red-400' : 'border-slate-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Kinh độ (Lng)</label>
                          <input
                            type="text"
                            value={row.lng}
                            onChange={e => handleCoordInputChange(idx, 'lng', e.target.value)}
                            placeholder="vd: 108.4563"
                            className={`w-full bg-white border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#062326] ${
                              isViolating ? 'border-red-400' : 'border-slate-300'
                            }`}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoordRow(idx)}
                        disabled={coordInputs.length <= 1}
                        className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 hover:bg-rose-50 rounded shrink-0 mt-3"
                        title="Xóa điểm này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCoordRow}
                  className="text-xs"
                >
                  <Plus size={14} className="mr-1 text-emerald-600" /> Thêm dòng tọa độ mới
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    const [lat, lng] = mapCenter;
                    setCoordInputs([
                      { lat: (lat + 0.0015).toFixed(6), lng: (lng - 0.0018).toFixed(6) },
                      { lat: (lat + 0.0015).toFixed(6), lng: (lng + 0.0018).toFixed(6) },
                      { lat: (lat - 0.0015).toFixed(6), lng: (lng + 0.0018).toFixed(6) },
                      { lat: (lat - 0.0015).toFixed(6), lng: (lng - 0.0018).toFixed(6) },
                    ]);
                  }}
                  className="text-[11px] text-sky-700 hover:underline font-semibold"
                >
                  ⚡ Nạp 4 tọa độ mẫu chuẩn
                </button>
              </div>
            </div>
          )}

          {/* Bulk Paste Mode */}
          {coordModeTab === 'bulk' && (
            <div className="space-y-2">
              <label className="block text-slate-700 font-semibold">
                Dán danh sách Tọa độ (mỗi dòng một cặp "Latitude, Longitude"):
              </label>
              <textarea
                rows={6}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={`11.9419, 108.4563\n11.9419, 108.4603\n11.9389, 108.4603\n11.9389, 108.4563`}
                className="w-full bg-slate-900 text-emerald-300 font-mono text-xs p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-400"
              />
              <p className="text-[10px] text-slate-500">
                Định dạng hỗ trợ: "11.9419, 108.4563" hoặc "11.9419 108.4563" hoặc "11.9419; 108.4563".
              </p>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => { setShowCoordModal(false); setPreviewPolygon(null); }}>
              Hủy
            </Button>
            <Button
              onClick={handleApplyCoordinates}
              disabled={parseValidPoints().length < 3 || (level === 'ZONE' && previewHasViolation)}
              className={`${
                parseValidPoints().length >= 3 && !(level === 'ZONE' && previewHasViolation)
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              } font-bold text-xs py-2 px-4 shadow-md transition-all`}
            >
              {level === 'ZONE' && previewHasViolation
                ? '⚠️ Điểm ngoài Lô đất — Không thể áp dụng'
                : `Áp dụng Ranh giới từ Tọa độ (${parseValidPoints().length}/3 điểm)`
              }
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
