import React, { useEffect, useState } from 'react';
import { Radio, RefreshCw, ShieldCheck, Wifi, Settings2 } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';
import { deviceService } from '../../services';

/** Read-only Gateway operations after Hardware Preparation. */
export const GatewaysPage: React.FC = () => {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true); setError('');
    try {
      const requests = await deviceService.getTechnicianDeploymentRequests().catch(() => []);
      const farmIds = [...new Set((Array.isArray(requests) ? requests : []).map((x: any) => x.farmId).filter(Boolean))] as string[];
      const result = (await Promise.all(farmIds.map(id => deviceService.getGateways(id).catch(() => [])))).flat();
      setGateways(result.filter((x: any, i: number, a: any[]) => a.findIndex((y: any) => (y.gatewayId || y.id) === (x.gatewayId || x.id)) === i));
    } catch (e: any) { setError(e?.response?.data?.detail || e?.message || 'Không tải được danh sách Gateway.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const inspect = async (gateway: any) => {
    const id = gateway.gatewayId || gateway.id;
    if (!id) return;
    void load();
    const [mqtt, config] = await Promise.all([deviceService.getGatewayMqttStatus(id).catch(() => null), deviceService.getGatewayFirmwareConfig(id).catch(() => null)]);
    setDetails(prev => ({ ...prev, [id]: { mqtt, config } }));
  };

  const hasHeartbeat = (gateway: any) => {
    if (!gateway?.lastSeenAtUtc) return false;
    const lastSeen = Date.parse(gateway.lastSeenAtUtc);
    if (!Number.isFinite(lastSeen)) return false;
    const intervalMs = Math.max(15, Number(gateway.heartbeatIntervalSeconds || 15)) * 1000;
    return Date.now() - lastSeen <= intervalMs;
  };

  return <div className="space-y-6 max-w-7xl mx-auto pb-10">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900"><Radio className="inline text-emerald-600 mr-2" />Gateway ESP32</h1><p className="text-xs text-slate-600 mt-1">Theo dõi Gateway đã enrollment. Chuẩn bị firmware thực hiện tại Hardware Preparation; GIS chỉ gán thiết bị ở bước triển khai.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className="mr-1" />Làm mới</Button></div>
    {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Đã enrollment</div><div className="text-2xl font-bold">{gateways.length}</div></div><div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">MQTT heartbeat thật</div><div className="text-2xl font-bold text-emerald-700">{gateways.filter(hasHeartbeat).length}</div></div><div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Provisioned</div><div className="text-2xl font-bold text-blue-700">{gateways.filter(x => String(x.status).toLowerCase() === 'provisioned').length}</div></div><div className="bg-white border rounded-xl p-4"><div className="text-xs text-slate-500">Có cấu hình</div><div className="text-2xl font-bold text-purple-700">{gateways.filter(x => x.configVersion > 0 || x.configuredAtUtc).length}</div></div></div>
    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm"><div className="p-4 border-b flex items-center justify-between"><h2 className="font-bold">Gateway đã đăng ký</h2><span className="text-xs text-slate-500">Provisioning không thực hiện tại đây</span></div>{gateways.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Chưa có Gateway đã enrollment.</div> : <div className="divide-y">{gateways.map((gateway: any) => { const id = gateway.gatewayId || gateway.id; const d = details[id]; const online = hasHeartbeat(gateway); return <div key={id} className="p-4 space-y-3"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="font-bold text-slate-900">{gateway.gatewaySerial || gateway.serialNumber || 'Gateway'}</div><div className="text-xs text-slate-500 font-mono">MAC: {gateway.macAddress || '—'} · ID: {id}</div><div className="text-xs text-slate-500">Firmware: {gateway.firmwareVersion || '—'} · Config v{gateway.configVersion || 0}</div><div className={`text-xs mt-1 ${online ? 'text-emerald-700' : 'text-amber-700'}`}>{online ? `MQTT heartbeat: ${new Date(gateway.lastSeenAtUtc).toLocaleString()}` : 'Chưa nhận MQTT heartbeat thật'}</div></div><div className="flex items-center gap-3"><StatusBadge status={online ? 'Online' : 'Provisioned'} /><Button size="sm" variant="outline" onClick={() => void inspect(gateway)}><Settings2 size={14} className="mr-1" />Kiểm tra trạng thái</Button></div></div>{d && <div className="grid md:grid-cols-2 gap-3 text-xs"><div className="p-3 rounded-lg bg-slate-50"><div className="font-bold mb-1"><Wifi size={14} className="inline mr-1" />MQTT</div><div>{d.mqtt ? JSON.stringify(d.mqtt) : 'Chưa có dữ liệu MQTT'}</div></div><div className="p-3 rounded-lg bg-emerald-50"><div className="font-bold mb-1 text-emerald-800"><ShieldCheck size={14} className="inline mr-1" />Runtime configuration</div><div>Node registry: {d.config?.nodes?.length ?? 0} node · Identity lấy từ enrollment.</div></div></div>}</div>; })}</div>}</div>
  </div>;
};
