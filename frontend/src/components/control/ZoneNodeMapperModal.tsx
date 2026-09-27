import React, { useState } from 'react';
import { ServiceRequest, SensorNode } from '../../types';
import { mockNodes, mockGateways } from '../../mocks/mockData';
import { Modal, Button, StatusBadge } from '../ui/BaseUI';
import { MapPin, Cpu, Radio, Zap, CheckCircle2, Plus, Info, Layers, RefreshCw } from 'lucide-react';

interface ZoneNodeMapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onSaveMapping?: (mappedCount: number) => void;
}

interface UnassignedDevice {
  deviceId: string;
  code: string;
  name: string;
  type: 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP';
  mac: string;
}

export const ZoneNodeMapperModal: React.FC<ZoneNodeMapperModalProps> = ({
  isOpen,
  onClose,
  request,
  onSaveMapping,
}) => {
  // Existing nodes in this zone / request
  const [nodes, setNodes] = useState<SensorNode[]>([
    {
      nodeId: 'mapped-node-1',
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01 - Cà chua',
      name: 'Node Cảm biến Độ ẩm Đất - Hàng A1',
      nodeCode: 'SN-[#062326]-SOIL-01',
      serialNumber: 'SN-2026-SL-01',
      latitude: 35, // map grid X%
      longitude: 40, // map grid Y%
      status: 'ONLINE',
      firmwareVersion: 'v2.4.1',
      batteryLevel: 98,
      rssi: -72,
      lastSeenAt: 'Vừa xong',
      sensorsCount: 2,
      actuatorsCount: 0,
    },
    {
      nodeId: 'mapped-node-2',
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01 - Cà chua',
      name: 'Node Cảm biến Vi khí hậu AirTemp',
      nodeCode: 'SN-[#062326]-AIR-02',
      serialNumber: 'SN-2026-AIR-02',
      latitude: 70,
      longitude: 65,
      status: 'ONLINE',
      firmwareVersion: 'v2.4.1',
      batteryLevel: 92,
      rssi: -68,
      lastSeenAt: 'Vừa xong',
      sensorsCount: 2,
      actuatorsCount: 1,
    }
  ]);

  // Unassigned devices ready to be pinned as nodes
  const [unassignedDevices, setUnassignedDevices] = useState<UnassignedDevice[]>([
    { deviceId: 'dev-01', code: 'GW-ESP32-NEW', name: 'Gateway LoRa Central ESP32-S3', type: 'GATEWAY', mac: '24:DC:C3:88:99:A1' },
    { deviceId: 'dev-02', code: 'SN-NPK-EC-03', name: 'Node Cảm biến NPK & Độ dẫn điện EC', type: 'SOIL_SENSOR', mac: '24:DC:C3:11:22:33' },
    { deviceId: 'dev-03', code: 'ACT-VALVE-V2', name: 'Node Cụm Van Điện từ Phun sương V2', type: 'VALVE', mac: '24:DC:C3:44:55:66' },
  ]);

  const [selectedDevice, setSelectedDevice] = useState<UnassignedDevice | null>(unassignedDevices[0] || null);
  const [activePinNode, setActivePinNode] = useState<SensorNode | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Handle clicking on map grid to pin/chấm node
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedDevice) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const newNode: SensorNode = {
      nodeId: `mapped-node-${Date.now()}`,
      farmId: request.farmId || 'farm-01',
      zoneId: request.zoneId || 'zone-01',
      zoneName: request.zoneName || 'Nhà màng 01',
      name: selectedDevice.name,
      nodeCode: selectedDevice.code,
      serialNumber: selectedDevice.mac,
      latitude: x,
      longitude: y,
      status: 'ONLINE',
      firmwareVersion: 'v3.0.0-PROV',
      batteryLevel: 100,
      rssi: -65,
      lastSeenAt: 'Vừa chấm vị trí',
      sensorsCount: selectedDevice.type.includes('SENSOR') ? 2 : 0,
      actuatorsCount: selectedDevice.type === 'VALVE' || selectedDevice.type === 'PUMP' ? 1 : 0,
    };

    setNodes(prev => [...prev, newNode]);
    setUnassignedDevices(prev => prev.filter(d => d.deviceId !== selectedDevice.deviceId));
    setSelectedDevice(null);
    setSuccessToast(`Đã chấm Node thành công: [${newNode.name}] tại tọa độ sơ đồ (${x}%, ${y}%)!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleSave = () => {
    if (onSaveMapping) {
      onSaveMapping(nodes.length);
    }
    onClose();
  };

  if (!isOpen) return null;

  const isMaintenance = request.requestType === 'MAINTENANCE' || request.requestType === 'REPAIR' || request.requestType === 'REPLACEMENT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-[#062326] to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <MapPin size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isMaintenance ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isMaintenance ? 'BẢO TRÌ & THAY THẾ NODE' : 'LẮP ĐẶT MỚI & CHẤM NODE'}
                </span>
                <span className="text-xs text-slate-300 font-mono">Request #{request.serviceRequestId}</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5">
                Chấm Node & Định vị Thiết bị tại Zone: <span className="text-emerald-300">{request.zoneName || 'Nhà màng Z01'}</span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            ✕
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} /> {successToast}
          </div>
        )}

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-4 flex-1 overflow-hidden">
          {/* Left Panel: Unassigned Equipment List */}
          <div className="lg:col-span-1 p-4 bg-slate-50 border-r border-slate-200 overflow-y-auto space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Cpu size={14} className="text-[#062326]" /> Thiết bị Chờ Chấm Node ({unassignedDevices.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Chọn thiết bị bên dưới, sau đó nhấp vào vị trí bất kỳ trên sơ đồ Phân khu để biến thành Node active.
              </p>
            </div>

            {unassignedDevices.length === 0 ? (
              <div className="p-4 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
                <span className="font-bold">Đã chấm hết thiết bị!</span>
                <p className="text-[11px] text-emerald-700 mt-1">Tất cả vật tư đã được chuyển đổi thành các Node định vị trên sơ đồ.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedDevices.map(dev => {
                  const isSelected = selectedDevice?.deviceId === dev.deviceId;
                  return (
                    <div
                      key={dev.deviceId}
                      onClick={() => setSelectedDevice(dev)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#062326] text-white border-[#062326] shadow-md ring-2 ring-emerald-400'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {dev.code}
                        </span>
                        {isSelected && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold">ĐANG CHỌN</span>}
                      </div>
                      <h4 className="font-bold text-xs mt-1.5">{dev.name}</h4>
                      <p className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        MAC: {dev.mac}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instruction Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
              <strong className="flex items-center gap-1 text-amber-800">
                <Info size={13} /> Quy trình Kỹ thuật:
              </strong>
              <p className="text-amber-800/90 leading-relaxed">
                1. Chọn thiết bị vật tư.<br />
                2. Bấm vị trí trên sơ đồ nhà màng.<br />
                3. Bấm "Lưu Sơ đồ Node".<br />
                4. Chủ trang trại sẽ nghiệm thu.
              </p>
            </div>
          </div>

          {/* Center Main: Interactive Zone Map Canvas */}
          <div className="lg:col-span-3 p-4 bg-slate-100 flex flex-col justify-between overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Layers size={15} className="text-[#062326]" /> Sơ đồ Phân khu 2D (Interactive Zone Canvas Grid)
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold border border-emerald-300">
                  {nodes.length} Node Đã Định Vị
                </span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                {selectedDevice ? `👉 Đang chọn [${selectedDevice.code}]. Hãy nhấp lên ô sơ đồ để chấm Node!` : 'Nhấp vào bất kỳ Node nào để xem chi tiết thông số'}
              </span>
            </div>

            {/* Canvas Interactive Container */}
            <div
              onClick={handleGridClick}
              className={`relative w-full h-[380px] bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-2xl border-2 border-emerald-500/40 shadow-inner overflow-hidden select-none cursor-${selectedDevice ? 'crosshair' : 'default'}`}
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.15) 1px, transparent 0)`,
                backgroundSize: '24px 24px'
              }}
            >
              {/* Zone Boundary Header Overlay */}
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {request.zoneName || 'Nhà màng Z01'} • Sơ đồ Lưới Realtime
              </div>

              {/* Crop Rows Simulation Graphics */}
              <div className="absolute inset-x-10 top-16 bottom-10 grid grid-cols-4 gap-4 opacity-20 pointer-events-none">
                <div className="border-x border-dashed border-emerald-400 bg-emerald-500/5 rounded text-center text-[10px] text-emerald-400 font-mono pt-2">Hàng Cây A</div>
                <div className="border-x border-dashed border-emerald-400 bg-emerald-500/5 rounded text-center text-[10px] text-emerald-400 font-mono pt-2">Hàng Cây B</div>
                <div className="border-x border-dashed border-emerald-400 bg-emerald-500/5 rounded text-center text-[10px] text-emerald-400 font-mono pt-2">Hàng Cây C</div>
                <div className="border-x border-dashed border-emerald-400 bg-emerald-500/5 rounded text-center text-[10px] text-emerald-400 font-mono pt-2">Hàng Cây D</div>
              </div>

              {/* Placed Pins on Map */}
              {nodes.map((node, index) => {
                const isSelected = activePinNode?.nodeId === node.nodeId;
                return (
                  <div
                    key={node.nodeId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinNode(node);
                    }}
                    style={{ left: `${node.latitude}%`, top: `${node.longitude}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform duration-200 z-20 hover:scale-125 ${
                      isSelected ? 'scale-125 z-30' : ''
                    }`}
                  >
                    {/* Pulsing ring */}
                    <span className="absolute -inset-2 rounded-full bg-emerald-400/40 animate-ping" />
                    
                    {/* Node Pin Icon */}
                    <div className={`p-2 rounded-xl border flex items-center justify-center shadow-lg transition-all ${
                      node.nodeCode.includes('GW') 
                        ? 'bg-amber-500 text-slate-950 border-amber-300' 
                        : isSelected 
                        ? 'bg-emerald-400 text-slate-950 border-white ring-4 ring-emerald-500/50'
                        : 'bg-emerald-600 text-white border-emerald-300'
                    }`}>
                      {node.nodeCode.includes('GW') ? <Radio size={16} /> : <MapPin size={16} />}
                    </div>

                    {/* Label Badge */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-slate-900/90 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-mono whitespace-nowrap font-bold shadow-md">
                      #{index + 1} {node.nodeCode}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Node Details Bar */}
            {activePinNode && (
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{activePinNode.name}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                      {activePinNode.nodeCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Serial: {activePinNode.serialNumber} • Vị trí: ({activePinNode.latitude}%, {activePinNode.longitude}%) • Pin: {activePinNode.batteryLevel}% • RSSI: {activePinNode.rssi}dBm
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActivePinNode(null)}>
                  Đóng Chi tiết
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300">
            Tổng số Node đã chấm trong Zone: <strong className="text-emerald-400 font-mono text-sm">{nodes.length} Nodes</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
              Hủy
            </Button>
            <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
              <CheckCircle2 size={16} className="mr-1.5" /> Lưu Sơ đồ & Cập nhật Trạng thái Node
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
