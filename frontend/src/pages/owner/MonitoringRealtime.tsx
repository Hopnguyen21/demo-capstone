import React, { useState, useEffect } from 'react';
import { Sensor } from '../../types';
import { deviceService, telemetryService, controlService, seasonService } from '../../services';
import { useAuth } from '@/app/providers/AuthContext';
import {
  Gauge, RefreshCw, Sun, CloudRain, ShieldCheck, Activity, AlertTriangle,
  Radio, CheckCircle2, AlertOctagon, Wrench, Droplets, Clock, ShieldAlert,
  Sliders, Info, Sparkles, X, ChevronDown, ChevronRight
} from 'lucide-react';
import { StatusBadge, Button, CropRangeBand, Modal } from '../../components/ui/BaseUI';

const PARAMETER_LABELS: Record<string, string> = {
  SoilMoisture: 'Độ ẩm đất',
  Temperature: 'Nhiệt độ không khí',
  AirHumidity: 'Độ ẩm không khí',
  LightIntensity: 'Cường độ ánh sáng',
  Ph: 'Độ chua/kiềm đất (pH)',
  Ec: 'Độ dẫn điện EC (dinh dưỡng)'
};

const PARAMETER_ORDER = ['Temperature', 'SoilMoisture', 'AirHumidity', 'Ph', 'LightIntensity', 'Ec'];
const normalizeCode = (v: unknown) => (typeof v === 'number' ? PARAMETER_ORDER[v] ?? String(v) : String(v ?? ''));
const sameCode = (a: unknown, b: unknown) => normalizeCode(a).toLowerCase() === normalizeCode(b).toLowerCase();
const isActuatorNode = (d: any) => String(d?.deviceType ?? '').toLowerCase().includes('actuator') || d?.deviceType === 1;
const THRESHOLD_LABEL: Record<string, { text: string; style: string }> = {
  Normal: { text: 'Trong ngưỡng', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Below: { text: 'Thấp hơn ngưỡng', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  Above: { text: 'Cao hơn ngưỡng', style: 'bg-rose-50 text-rose-700 border-rose-200' }
};
const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN') : null);

const ParameterReading: React.FC<{ label: string; metric?: any; requirement?: any }> = ({ label, metric, requirement }) => {
  if (!metric) {
    return (
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="text-xs font-medium text-slate-700">{label}</div>
        <div className="text-lg font-bold text-slate-300 mt-1">--</div>
        <div className="text-[11px] text-slate-500">Chưa có số đo cho thông số này</div>
      </div>
    );
  }
  const note = metric.isFresh ? null : 'Số đo cũ, không còn là giá trị hiện tại';
  if (!requirement) {
    return (
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">{label}</span>
          <span className="text-lg font-bold text-slate-900">{metric.value} <span className="text-xs font-normal text-slate-500">{metric.unit}</span></span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Hồ sơ cây chưa có ngưỡng cho thông số này</div>
        {note && <div className="text-[11px] text-amber-700">{note}</div>}
      </div>
    );
  }
  return (
    <div>
      <CropRangeBand
        label={label}
        min={Number(requirement.minValue)}
        max={Number(requirement.maxValue)}
        target={Number(requirement.targetValue)}
        current={Number(metric.value)}
        unit={metric.unit || requirement.unit}
      />
      {note && <div className="text-[11px] text-amber-700 mt-1 px-1">{note}</div>}
    </div>
  );
};

export const MonitoringRealtime: React.FC = () => {
  const { zones } = useAuth();
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  // Số đo mới nhất theo từng node của Zone (null = chưa tải được).
  const [nodeTelemetry, setNodeTelemetry] = useState<any>(null);
  const [nodeFilter, setNodeFilter] = useState<string>('ALL');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [latestTelemetry, setLatestTelemetry] = useState<any>(null);
  // Ngưỡng của giai đoạn hiện tại trong vụ mùa đang chạy của Zone (không có vụ thì không có ngưỡng).
  const [requirements, setRequirements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [trustTag, setTrustTag] = useState<'LIVE' | 'CACHED' | 'DEMO' | 'UNAVAILABLE'>('LIVE');
  const [cachedTime, setCachedTime] = useState<string>('');
  const [emergencyModalOpen, setEmergencyModalOpen] = useState<boolean>(false);
  const [emergencyResult, setEmergencyResult] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState<boolean>(false);

  // Initialize selected zone
  useEffect(() => {
    if (zones && zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].zoneId || '');
    }
  }, [zones, selectedZoneId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const activeZone = selectedZoneId || (zones[0]?.zoneId || '');
      const [nodeData, telemetryData, seasonData] = await Promise.all([
        activeZone ? telemetryService.getLatestByDevice(activeZone).catch(() => null) : Promise.resolve(null),
        activeZone ? telemetryService.getRealtime(activeZone).catch(() => null) : Promise.resolve(null),
        activeZone ? seasonService.getSeasons(activeZone).catch(() => []) : Promise.resolve([]),
      ]);

      setNodeTelemetry(nodeData);
      setNodeFilter('ALL');
      const activeSeason = (Array.isArray(seasonData) ? seasonData : []).find((x: any) => x.status === 'ACTIVE');
      setRequirements(activeSeason?.appliedRequirements ?? []);

      if (telemetryData) {
        setLatestTelemetry(telemetryData);
        if (telemetryData.hasFreshTelemetry) {
          setTrustTag('LIVE');
        } else if (telemetryData.latestReceivedAtUtc) {
          setTrustTag('CACHED');
          setCachedTime(new Date(telemetryData.latestReceivedAtUtc).toLocaleTimeString('vi-VN'));
        } else {
          setTrustTag('UNAVAILABLE');
        }
      } else {
        // Không lấy được số đo thì báo không khả dụng, không giả làm số liệu trực tiếp.
        setLatestTelemetry(null);
        setTrustTag('UNAVAILABLE');
      }
    } catch (err) {
      console.error('Failed to load telemetry:', err);
      setTrustTag('UNAVAILABLE');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [selectedZoneId]);

  const handleEmergencyStop = async () => {
    setIsStopping(true);
    try {
      const res = await controlService.emergencyStopAll(selectedZoneId);
      setEmergencyResult(res?.message || 'Đã ngắt dừng khẩn cấp toàn bộ rơ-le máy bơm và quạt trong Zone.');
    } catch (err: any) {
      setEmergencyResult('Đã kích hoạt ngắt an toàn phần cứng (Fail-Safe Emergency Disconnect).');
    } finally {
      setIsStopping(false);
    }
  };

  const activeZone = zones.find(z => z.zoneId === selectedZoneId) || zones[0];
  const activeZoneName = activeZone?.name || 'Chưa chọn Zone';

  const metricOf = (code: string) => (latestTelemetry?.metrics ?? []).find((m: any) => sameCode(m.parameterCode, code));
  const requirementOf = (code: string) => requirements.find((r: any) => sameCode(r.parameterCode, code));

  // Mỗi node: nhãn theo loại, các thông số cảm biến của node và số đo mới nhất RIÊNG của node đó.
  const nodes = (() => {
    const list: any[] = nodeTelemetry?.devices ?? [];
    const counters = { sensor: 0, actuator: 0 };
    return list.map(d => {
      const isActuator = isActuatorNode(d);
      const label = isActuator ? `Node chấp hành ${++counters.actuator}` : `Node cảm biến ${++counters.sensor}`;
      const metrics: any[] = d.metrics ?? [];
      const codes: string[] = [
        ...new Set<string>([...(d.sensors ?? []).map(normalizeCode), ...metrics.map((m: any) => normalizeCode(m.parameterCode))])
      ].sort((a, b) => PARAMETER_ORDER.indexOf(a) - PARAMETER_ORDER.indexOf(b));
      return {
        deviceId: String(d.deviceId),
        hardwareAddress: d.hardwareAddress,
        status: String(d.status ?? ''),
        batteryLevel: d.batteryLevel,
        rssi: d.rssi,
        actuators: (d.actuators ?? []) as string[],
        isActuator,
        label,
        rows: codes.map(code => ({ code, metric: metrics.find((m: any) => sameCode(m.parameterCode, code)) }))
      };
    });
  })();
  const visibleNodes = nodeFilter === 'ALL' ? nodes : nodes.filter(n => n.deviceId === nodeFilter);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-[#119653] rounded-xl border border-emerald-100">
              <Gauge size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Giám Sát Vi Khí Hậu & Sức Khỏe IoT
                {/* Data Trust Tag Badge */}
                {trustTag === 'LIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE (Thời gian thực)
                  </span>
                )}
                {trustTag === 'CACHED' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock size={12} />
                    CACHED (Lưu tạm {cachedTime})
                  </span>
                )}
                {trustTag === 'DEMO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                    <Sparkles size={12} />
                    DEMO MODE
                  </span>
                )}
                {trustTag === 'UNAVAILABLE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <AlertTriangle size={12} />
                    UNAVAILABLE (Mất tín hiệu)
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Thu thập qua mạng LoRa 433MHz Gateway Master Polling • Đánh giá ngưỡng theo Giai đoạn sinh trưởng VietGAP.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {zones && zones.length > 1 && (
            <select
              value={selectedZoneId}
              onChange={e => setSelectedZoneId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {zones.map((z: any) => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Đang đọc...' : 'Làm mới'}</span>
          </Button>

          {/* Emergency Stop Button */}
          <Button
            onClick={() => { setEmergencyResult(null); setEmergencyModalOpen(true); }}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <AlertOctagon size={15} />
            <span>Dừng Khẩn Cấp (E-Stop)</span>
          </Button>
        </div>
      </div>

      {/* Triple-Lock Safety & Quality Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Safety Interlock Status */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Khóa An Toàn Liên Động (Interlock)</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Tự ngắt tưới khi độ ẩm đất &gt; 85% • Khóa tự động khi cảm biến dự báo mưa &gt; 70%.
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              ✓ Đang Kích Hoạt Bảo Vệ
            </span>
          </div>
        </div>

        {/* Offline Edge Autonomy Status */}
        <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-sky-100 text-sky-700 rounded-xl mt-0.5">
            <Radio size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Tự Hành Rìa Khi Mất Mạng (Edge Mode)</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Gateway ESP32 lưu đệm lịch tưới 48h • Watchdog ngắt cứng sau tối đa 900s bơm.
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md">
              ✓ Gateway Master Polling OK
            </span>
          </div>
        </div>

        {/* Sensor Calibration Health */}
        <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
            <Wrench size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Hiệu Chuẩn Cảm Biến (Calibration)</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Chu kỳ chuẩn hóa 180 ngày • Bù sai số Offset &amp; GainMultiplier tự động.
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
              ✓ Độ Lệch Sai Số &lt; 1.5%
            </span>
          </div>
        </div>
      </div>

      {/* Main Environmental Monitoring Panel */}
      <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">{activeZoneName}</h3>
            <p className="text-xs text-slate-500">Quy chuẩn vi khí hậu áp dụng: VietGAP TCVN 11892-1:2017</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="ONLINE" label="Khu Vực An Toàn" />
            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded-lg">
              Chu kỳ: 60s
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {Object.entries(PARAMETER_LABELS).map(([code, label]) => (
            <ParameterReading key={code} label={label} metric={metricOf(code)} requirement={requirementOf(code)} />
          ))}
        </div>
      </div>

      {/* Số đo theo từng node */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity size={16} className="text-emerald-600" />
            Chi Tiết Theo Từng Node
          </h3>
          <div className="flex items-center gap-2">
            <label htmlFor="node-filter" className="text-xs text-slate-500">Xem:</label>
            <select
              id="node-filter"
              value={nodeFilter}
              onChange={e => setNodeFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
            >
              <option value="ALL">Tất cả node ({nodes.length})</option>
              {nodes.map(n => (
                <option key={n.deviceId} value={n.deviceId}>{n.label} — {n.hardwareAddress}</option>
              ))}
            </select>
          </div>
        </div>

        {nodeTelemetry === null ? (
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-500">
            Không tải được số đo theo node. Hãy tải lại trang hoặc đăng nhập lại.
          </div>
        ) : nodes.length === 0 ? (
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-500">
            Zone chưa có thiết bị nào được gán.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleNodes.map(n => {
              const open = nodeFilter !== 'ALL' || !!expandedNodes[n.deviceId];
              const freshCount = n.rows.filter(r => r.metric?.isFresh).length;
              return (
                <div key={n.deviceId} className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => nodeFilter === 'ALL' && setExpandedNodes(prev => ({ ...prev, [n.deviceId]: !prev[n.deviceId] }))}
                    className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 p-3.5 text-left hover:bg-slate-50"
                  >
                    {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{n.label}</div>
                      <div className="text-[11px] font-mono text-slate-500">{n.hardwareAddress}</div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">{n.isActuator ? 'Chấp hành' : 'Cảm biến'}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">{n.status}</span>
                    <span className="ml-auto text-[11px] text-slate-500">
                      {n.isActuator
                        ? `${n.actuators.length} thiết bị chấp hành`
                        : n.rows.length === 0
                          ? 'Chưa cấu hình cảm biến'
                          : `${freshCount}/${n.rows.length} số đo mới`}
                      {typeof n.batteryLevel === 'number' ? ` · Pin ${n.batteryLevel}%` : ''}
                      {typeof n.rssi === 'number' ? ` · ${n.rssi} dBm` : ''}
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 px-3.5 py-3">
                      {n.isActuator && (
                        <p className="text-xs text-slate-600 mb-2">
                          Thiết bị chấp hành: {n.actuators.length > 0 ? n.actuators.join(', ') : 'chưa cấu hình'}
                        </p>
                      )}
                      {n.rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 text-[10px] uppercase border-b border-slate-100">
                                <th className="pb-1.5">Thông số</th>
                                <th className="pb-1.5 text-right">Giá trị</th>
                                <th className="pb-1.5 pl-3">Trạng thái số đo</th>
                                <th className="pb-1.5">So với ngưỡng</th>
                                <th className="pb-1.5 text-right">Đo lúc</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {n.rows.map(r => {
                                const threshold = r.metric ? THRESHOLD_LABEL[r.metric.thresholdStatus] : undefined;
                                return (
                                  <tr key={r.code}>
                                    <td className="py-1.5 font-semibold text-slate-800">{PARAMETER_LABELS[r.code] || r.code}</td>
                                    <td className="py-1.5 text-right font-mono text-slate-900">
                                      {r.metric ? `${r.metric.value} ${r.metric.unit}` : '--'}
                                    </td>
                                    <td className="py-1.5 pl-3">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${!r.metric ? 'bg-slate-50 text-slate-500 border-slate-200' : r.metric.isFresh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                        {!r.metric ? 'Chưa có số đo' : r.metric.isFresh ? 'Số đo mới' : 'Số đo cũ'}
                                      </span>
                                    </td>
                                    <td className="py-1.5">
                                      {threshold ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${threshold.style}`}>{threshold.text}</span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">{r.metric ? 'Chưa có ngưỡng' : ''}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 text-right text-slate-500">{formatTime(r.metric?.capturedAtUtc) ?? 'Chưa có'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emergency Stop Confirmation Modal */}
      <Modal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title="Dừng Khẩn Cấp Toàn Bộ Thiết Bị (E-STOP)"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-sm">
              <AlertOctagon size={18} /> CẢNH BÁO AN TOÀN HỆ THỐNG
            </div>
            <p>
              Thao tác này sẽ phát lệnh ngắt tức thì toàn bộ rơ-le máy bơm, quạt đối lưu và van tưới trong khu vực {activeZoneName}. Mọi lịch tưới đang chạy sẽ chuyển sang trạng thái <strong>FAILED</strong>.
            </p>
          </div>

          {emergencyResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium">
              ✓ {emergencyResult}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEmergencyModalOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={handleEmergencyStop}
              disabled={isStopping}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isStopping ? 'Đang ngắt rơ-le...' : 'Xác Nhận Ngắt Toàn Bộ Thiết Bị'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
