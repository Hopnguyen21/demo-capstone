import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui/BaseUI';
import { ServiceRequest } from '../../types';
import {
  FlaskConical, MapPin, Cpu, Radio, Zap, CheckCircle2,
  FileText, ShieldCheck, Info, Check, Plus, AlertCircle
} from 'lucide-react';

export interface HardwareItem {
  id: string;
  code: string;
  name: string;
  category: 'GATEWAY' | 'SOIL_SENSOR' | 'AIR_SENSOR' | 'VALVE' | 'PUMP' | 'EC_PH';
  serialNumber: string;
  mac: string;
  status: 'READY' | 'DEPLOYED';
  specification: string;
  isSelected: boolean;
}

interface ExperimentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ServiceRequest;
  onProceedToMapper: (selectedDevices: HardwareItem[], experimentTitle: string, notes: string) => void;
}

export const ExperimentReportModal: React.FC<ExperimentReportModalProps> = ({
  isOpen,
  onClose,
  request,
  onProceedToMapper,
}) => {
  const [experimentTitle, setExperimentTitle] = useState(
    `Thực nghiệm Lắp đặt IoT Phân khu ${request.zoneName || 'Nhà màng 01'}`
  );
  const [experimentNotes, setExperimentNotes] = useState(
    `Đợt thử nghiệm lắp đặt trạm Gateway ESP32, trạm cảm biến vi khí hậu và van solenoid tự động cho mô hình canh tác thực nghiệm.`
  );

  const [hardwareList, setHardwareList] = useState<HardwareItem[]>([
    {
      id: 'hw-gw-01',
      code: 'GW-ESP32-DL01',
      name: 'Trạm Central Gateway ESP32-LoRa Dual Antenna',
      category: 'GATEWAY',
      serialNumber: 'SN-GW-2026-0089',
      mac: '24:DC:C3:98:A1:04',
      status: 'READY',
      specification: 'LoRa 915MHz, Chống nước IP67, Nguồn Solar 12V',
      isSelected: true,
    },
    {
      id: 'hw-soil-01',
      code: 'SN-SOIL-01',
      name: 'Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe',
      category: 'SOIL_SENSOR',
      serialNumber: 'SN-2026-SL-01',
      mac: '24:DC:C3:98:SL-01',
      status: 'READY',
      specification: 'Cảm biến 3-in-1 (Nhiệt, Ẩm, EC Đất), Pin sạc 18650',
      isSelected: true,
    },
    {
      id: 'hw-air-02',
      code: 'SN-AIR-02',
      name: 'Node Cảm biến Vi khí hậu Không khí SHT30',
      category: 'AIR_SENSOR',
      serialNumber: 'SN-2026-AIR-02',
      mac: '24:DC:C3:98:AR-02',
      status: 'READY',
      specification: 'Cảm biến Sensirion SHT30, Đo Nhiệt độ, Độ ẩm & CO2',
      isSelected: true,
    },
    {
      id: 'hw-valve-01',
      code: 'ACT-VALVE-01',
      name: 'Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng',
      category: 'VALVE',
      serialNumber: 'ACT-2026-VAL-01',
      mac: '24:DC:C3:98:VL-01',
      status: 'READY',
      specification: '4 Relay 12V/24V, Hỗ trợ phản hồi trạng thái công tắc',
      isSelected: true,
    },
    {
      id: 'hw-pump-02',
      code: 'ACT-PUMP-02',
      name: 'Node Điều khiển Bơm Phân Dinh dưỡng Châm tự động',
      category: 'PUMP',
      serialNumber: 'ACT-2026-PMP-02',
      mac: '24:DC:C3:98:PM-02',
      status: 'READY',
      specification: 'Điều chế xung PWM châm dung dịch dinh dưỡng A/B',
      isSelected: false,
    },
    {
      id: 'hw-ecph-03',
      code: 'SN-EC-PH-03',
      name: 'Node Cảm biến Nồng độ Dinh dưỡng EC & pH Nước tưới',
      category: 'EC_PH',
      serialNumber: 'SN-2026-ECPH-03',
      mac: '24:DC:C3:98:EP-03',
      status: 'READY',
      specification: 'Đo EC 0-20mS/cm, pH 0-14, Hiệu chuẩn công nghiệp',
      isSelected: false,
    },
  ]);

  const toggleSelect = (id: string) => {
    setHardwareList(prev =>
      prev.map(item => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const selectedCount = hardwareList.filter(i => i.isSelected).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCount === 0) {
      alert('⚠️ Vui lòng chọn ít nhất 1 thiết bị trong danh sách để tiến hành chấm vị trí trên GIS Map!');
      return;
    }
    const selectedDevices = hardwareList.filter(i => i.isSelected);
    onProceedToMapper(selectedDevices, experimentTitle, experimentNotes);
  };

  const getCategoryBadge = (category: HardwareItem['category']) => {
    switch (category) {
      case 'GATEWAY':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">📡 Gateway ESP32</span>;
      case 'SOIL_SENSOR':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">🌱 Cảm biến Đất</span>;
      case 'AIR_SENSOR':
        return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px]">☁️ Vi khí hậu</span>;
      case 'VALVE':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">💧 Van Solenoid</span>;
      case 'PUMP':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">⚡ Bơm Dinh dưỡng</span>;
      case 'EC_PH':
        return <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold text-[10px]">🧪 Đo EC / pH</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">IoT Node</span>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧪 Báo cáo Thực nghiệm & Chọn Thiết bị Lắp đặt IoT">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Header Info Banner */}
        <div className="p-3.5 bg-gradient-to-r from-[#062326] via-slate-900 to-emerald-950 text-white rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <FlaskConical size={16} /> Hồ sơ Thực nghiệm Lắp đặt Thực địa
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              Yêu cầu #{request.serviceRequestId}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            <strong>Trang trại:</strong> {request.farmName} &bull; <strong>Phân khu:</strong> {request.zoneName}
          </p>
        </div>

        {/* Experiment Setup Details */}
        <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="block font-bold text-slate-800 mb-1">Tên Đợt Thực nghiệm / Kiểm thử *</label>
            <Input
              value={experimentTitle}
              onChange={e => setExperimentTitle(e.target.value)}
              placeholder="Nhập tên đợt thực nghiệm..."
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-800 mb-1">Ghi chú Điểm kiểm thử & Điều kiện Thực nghiệm</label>
            <textarea
              rows={2}
              value={experimentNotes}
              onChange={e => setExperimentNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs focus:outline-none focus:border-[#062326]"
              placeholder="Mô tả các yêu cầu kiểm thử và ghi chú kỹ thuật..."
            />
          </div>
        </div>

        {/* Device Selection Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Cpu size={15} className="text-[#062326]" /> Chọn các Thiết bị từ Kho sẽ dùng để Chấm Node ({selectedCount}/{hardwareList.length})
            </h4>
            <button
              type="button"
              onClick={() => setHardwareList(prev => prev.map(item => ({ ...item, isSelected: true })))}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
            >
              Chọn tất cả
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {hardwareList.map(item => (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  item.isSelected
                    ? 'bg-emerald-50/70 border-emerald-400 shadow-xs ring-1 ring-emerald-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                      item.isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {item.isSelected && <Check size={13} strokeWidth={3} />}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-900 font-bold font-mono text-xs">{item.code}</strong>
                      {getCategoryBadge(item.category)}
                    </div>
                    <div className="font-medium text-slate-800 text-xs">{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      MAC: {item.mac} &bull; S/N: {item.serialNumber}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold block">
                    Trong Kho OK
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[140px]">
                    {item.specification}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Đã chọn <strong className="text-emerald-700 font-bold text-xs">{selectedCount}</strong> thiết bị để chấm vị trí GIS.
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              className="bg-[#062326] hover:bg-[#062326]/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md px-4 py-2"
            >
              <MapPin size={15} className="text-emerald-400" />
              <span>Vào Zone Chấm Node (Node Mapper)</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
