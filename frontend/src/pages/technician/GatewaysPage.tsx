import React from 'react';
import { mockGateways } from '../../mocks/mockData';
import { StatusBadge, Button } from '../../components/ui/BaseUI';
import { Radio, Activity, RefreshCw, Terminal } from 'lucide-react';

export const GatewaysPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Radio className="text-[#062326]" size={22} /> Chẩn đoán Trạm Gateway ESP32 LoRa
        </h1>
        <p className="text-xs text-slate-600 mt-1">Giám sát dải tần 433MHz, công suất RSSI/SNR và luồng gói tin MQTT từ Gateway về Cloud.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockGateways.map(gw => (
          <div key={gw.gatewayId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-sky-700">{gw.deviceCode}</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{gw.name}</h3>
              </div>
              <StatusBadge status={gw.status} />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono space-y-1 text-slate-700">
              <div className="flex justify-between"><span>MAC:</span><span className="text-slate-900">{gw.macAddress}</span></div>
              <div className="flex justify-between"><span>Firmware:</span><span className="text-[#062326] font-semibold">{gw.firmwareVersion}</span></div>
              <div className="flex justify-between"><span>Sóng RSSI:</span><span className="text-[#062326] font-bold">{gw.rssi} dBm</span></div>
              <div className="flex justify-between"><span>Nodes kết nối:</span><span className="text-sky-700 font-bold">{gw.connectedNodesCount} Nodes</span></div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline"><Terminal size={14} className="mr-1" /> Raw Payload Logs</Button>
              <Button size="sm" variant="secondary"><RefreshCw size={14} className="mr-1" /> Flash Firmware OTA</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
