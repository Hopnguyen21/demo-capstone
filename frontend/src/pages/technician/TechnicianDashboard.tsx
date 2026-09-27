import React from 'react';
import { MetricCard, StatusBadge, Button } from '../../components/ui/BaseUI';
import { mockGateways, mockNodes, mockServiceRequests } from '../../mocks/mockData';
import { Wrench, Radio, Cpu, Battery, Wifi, ShieldAlert, CpuIcon, ArrowUpRight, CheckCircle2, Layers, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TechnicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const lowBatteryNodes = mockNodes.filter(n => n.batteryLevel < 30);
  const weakSignalNodes = mockNodes.filter(n => n.rssi < -90);

  const installationRequests = mockServiceRequests.filter(r => r.requestType === 'INSTALLATION' || r.requestType === 'INITIAL_SETUP');
  const maintenanceRequests = mockServiceRequests.filter(r => r.requestType === 'MAINTENANCE' || r.requestType === 'REPAIR' || r.requestType === 'REPLACEMENT');

  const acceptedByOwnerCount = mockServiceRequests.filter(r => r.isAcceptedByOwner).length;

  return (
    <div className="space-y-6">
      {/* Top Technician Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white rounded-2xl shadow-md">
        <div>
          <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">Field Service & Node Placement Center</span>
          <h1 className="text-2xl font-bold text-white mt-1">Trung tâm Điều hành Kỹ thuật IoT</h1>
          <p className="text-xs text-slate-300 mt-1">
            Vào Zone để **chấm vị trí Node**, nhận tín hiệu **Owner Nghiệm thu**, và **Xác nhận hoàn thành** công trình.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/technician/provisioning')} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
            <Layers size={16} className="mr-1.5" /> Yêu cầu Lắp đặt Mới ({installationRequests.length})
          </Button>
          <Button onClick={() => navigate('/technician/maintenance')} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Wrench size={16} className="mr-1.5" /> Yêu cầu Bảo trì ({maintenanceRequests.length})
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Owner Đã Nghiệm Thu"
          value={`${acceptedByOwnerCount} Request`}
          unit="Sẵn sàng Hoàn tất"
          subtext="Sẵn sàng bấm Xác nhận Hoàn thành"
          icon={<CheckSquare size={20} />}
          status="normal"
        />
        <MetricCard
          title="Yêu cầu Lắp đặt Mới"
          value={`${installationRequests.length} Request`}
          unit="Cần Chấm Node"
          subtext="Cấp phát Whitelist & Đặt Node"
          icon={<CpuIcon size={20} />}
          status="warning"
        />
        <MetricCard
          title="Yêu cầu Bảo trì / Repair"
          value={`${maintenanceRequests.length} Request`}
          unit="Cần xử lý"
          subtext="Sửa chữa & Hot-Swap phần cứng"
          icon={<Wrench size={20} />}
          status="warning"
        />
        <MetricCard
          title="Gateway LoRa Trực tuyến"
          value={`${mockGateways.filter(g => g.status === 'ONLINE').length} / ${mockGateways.length}`}
          unit="Gateways"
          subtext="Sóng trung bình -78 dBm"
          icon={<Radio size={20} />}
          status="normal"
        />
      </div>

      {/* Requests Overview Table */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers size={18} className="text-[#062326]" /> Tất cả Yêu cầu Thực địa (Lắp đặt & Bảo trì)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Kỹ thuật viên chọn mục tương ứng để vào Chấm Node</span>
        </div>

        <div className="space-y-3">
          {mockServiceRequests.map(sr => {
            const isInst = sr.requestType === 'INSTALLATION' || sr.requestType === 'INITIAL_SETUP';

            return (
              <div key={sr.serviceRequestId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isInst ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {isInst ? '⚡ LẮP ĐẶT MỚI' : '🛠️ BẢO TRÌ'}
                    </span>
                    <StatusBadge status={sr.status} />
                    {sr.isAcceptedByOwner ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1">
                        <CheckSquare size={11} /> OWNER ĐÃ NGHIỆM THU
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-medium">
                        Chờ Owner Nghiệm Thu
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{sr.title}</h4>
                  <p className="text-xs text-slate-600">{sr.description}</p>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Nông trang: <strong className="text-slate-800">{sr.farmName} ({sr.zoneName})</strong> | Tiến độ: <strong className="text-emerald-700 font-bold">{sr.mappedNodesCount || 0} Nodes đã chấm</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => navigate(isInst ? '/technician/provisioning' : '/technician/maintenance')}
                    className={isInst ? 'bg-sky-600 hover:bg-sky-500 text-white font-bold' : 'bg-amber-600 hover:bg-amber-500 text-white font-bold'}
                  >
                    Xử lý & Chấm Node <ArrowUpRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
