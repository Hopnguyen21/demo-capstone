import React from 'react';
import { mockGateways, mockNodes } from '../../mocks/mockData';
import { StatusBadge } from '../../components/ui/BaseUI';
import { Cpu, Radio, Activity, Wifi, Battery } from 'lucide-react';

export const DevicesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="text-[#062326]" size={22} /> Danh mục & Tổng quan Thiết bị IoT Toàn sàn
        </h1>
        <p className="text-xs text-slate-600 mt-1">Giám sát trạng thái hoạt động của LoRa Gateways, Node Cảm biến và Đầu ra Chấp hành.</p>
      </div>

      {/* Gateways Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Radio size={16} className="text-sky-600" /> Danh sách Gateway Trạm trung tâm (ESP32 LoRa)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockGateways.map(gw => (
            <div key={gw.gatewayId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-700 font-mono">{gw.deviceCode}</span>
                <StatusBadge status={gw.status} />
              </div>
              <h4 className="text-sm font-bold text-slate-900">{gw.name}</h4>
              <div className="text-xs text-slate-600 flex items-center justify-between pt-2 border-t border-slate-200">
                <span>MAC: <strong className="text-slate-800 font-mono">{gw.macAddress}</strong></span>
                <span>RSSI: <strong className="text-[#062326] font-semibold">{gw.rssi} dBm</strong></span>
                <span>Nodes: <strong className="text-sky-700 font-semibold">{gw.connectedNodesCount}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensor Nodes Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity size={16} className="text-[#062326]" /> Danh sách Node Cảm biến & Chấp hành (LoRa Nodes)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockNodes.map(node => (
            <div key={node.nodeId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#062326] font-mono">{node.nodeCode}</span>
                <StatusBadge status={node.status} />
              </div>
              <h4 className="text-xs font-bold text-slate-900">{node.name}</h4>
              <p className="text-[11px] text-slate-500">{node.zoneName}</p>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1">
                  <Battery size={13} className={node.batteryLevel < 30 ? 'text-amber-600' : 'text-emerald-600'} />
                  <span>Pin: {node.batteryLevel}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wifi size={13} className="text-sky-600" />
                  <span>Signal: {node.rssi} dBm</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
