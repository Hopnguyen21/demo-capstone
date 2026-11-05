import React from 'react';
import { MetricCard, StatusBadge, Button } from '../../components/ui/BaseUI';
import { mockGateways, mockNodes, mockServiceRequests } from '../../mocks/mockData';
import { Wrench, Radio, Cpu, Battery, Wifi, ShieldAlert, CpuIcon, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TechnicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const lowBatteryNodes = mockNodes.filter(n => n.batteryLevel < 30);
  const weakSignalNodes = mockNodes.filter(n => n.rssi < -90);

  return (
    <div className="space-y-6">
      {/* Top Technician Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-sky-50 via-white to-slate-50 border border-sky-200 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs font-mono font-semibold text-sky-700 uppercase tracking-wider">Hạ tầng IoT & Bảo trì Field-Service</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Trung tâm Kỹ thuật & Cấp phát Thiết bị</h1>
          <p className="text-xs text-slate-600 mt-1">Cấp phát Whitelist MAC Gateway, chẩn đoán LoRa 433MHz và xử lý thay thế Hot-swap 1-đổi-1.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/technician/provisioning')}>
            <CpuIcon size={16} className="mr-1.5" /> Quét QR Cấp phát Mới
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Yêu cầu Cấp phát Đang chờ"
          value="2 Request"
          unit="Dự án"
          subtext="Trang trại Đà Lạt & Đức Trọng"
          icon={<Wrench size={20} />}
          status="warning"
        />
        <MetricCard
          title="Gateway LoRa Trực tuyến"
          value={`${mockGateways.filter(g => g.status === 'ONLINE').length} / ${mockGateways.length}`}
          unit="Gateways"
          subtext="RSSI trung bình -78 dBm"
          icon={<Radio size={20} />}
          status="normal"
        />
        <MetricCard
          title="Node Pin Yếu (< 30%)"
          value={lowBatteryNodes.length}
          unit="Nodes"
          subtext="Cần thay pin Solar"
          icon={<Battery size={20} />}
          status={lowBatteryNodes.length > 0 ? 'critical' : 'normal'}
        />
        <MetricCard
          title="Sóng LoRa Yếu (< -90dBm)"
          value={weakSignalNodes.length}
          unit="Nodes"
          subtext="Cần điều chỉnh Anten"
          icon={<Wifi size={20} />}
          status="warning"
        />
      </div>

      {/* Assigned Service Requests */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wrench size={16} className="text-[#062326]" /> Phiếu yêu cầu Bảo trì & Thay thế được Phân công
          </h3>
          <span className="text-xs text-slate-500">{mockServiceRequests.length} phiếu đang xử lý</span>
        </div>

        <div className="space-y-3">
          {mockServiceRequests.map(sr => (
            <div key={sr.serviceRequestId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-sky-700 font-mono">#{sr.serviceRequestId}</span>
                  <StatusBadge status={sr.status} />
                  <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
                    {sr.priority}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{sr.title}</h4>
                <p className="text-xs text-slate-600">{sr.description}</p>
                <div className="text-[11px] text-slate-500 pt-1">
                  Nông trang: <strong className="text-slate-800">{sr.farmName}</strong> | Thiết bị: <strong className="text-[#062326]">{sr.deviceName}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={() => navigate('/technician/maintenance')}>
                  Chẩn đoán & Hot-Swap <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
