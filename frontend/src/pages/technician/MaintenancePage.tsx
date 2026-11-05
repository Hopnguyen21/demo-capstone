import React, { useState } from 'react';
import { mockServiceRequests, mockNodes } from '../../mocks/mockData';
import { StatusBadge, Button, Modal } from '../../components/ui/BaseUI';
import { Wrench, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const [requests, setRequests] = useState(mockServiceRequests);
  const [isHotSwapOpen, setIsHotSwapOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="text-[#062326]" size={22} /> Quy trình Thay thế 1-đổi-1 (Hardware Hot-Swap)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Thay thế phần cứng hỏng hóc ngoài đồng và duy trì liên tục chuỗi số liệu thời gian thực.</p>
        </div>
        <Button onClick={() => setIsHotSwapOpen(true)}>
          <RefreshCw size={16} className="mr-1.5" /> Thực hiện Hot-Swap 1-đổi-1
        </Button>
      </div>

      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Bản ghi Thay thế & Bảo trì Gần đây</h3>
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.serviceRequestId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-700 font-mono">#{r.serviceRequestId}</span>
                <StatusBadge status={r.status} />
              </div>
              <h4 className="text-sm font-bold text-slate-900">{r.title}</h4>
              <p className="text-xs text-slate-600">{r.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hot swap wizard modal */}
      <Modal isOpen={isHotSwapOpen} onClose={() => setIsHotSwapOpen(false)} title="Quy trình Hot-Swap 1-đổi-1">
        <div className="space-y-4 text-xs">
          <p className="text-slate-700">Chọn Node bị hỏng và gán Serial Number Node mới để duy trì lịch sử telemetry của Zone:</p>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Node cần thay thế (Old Node)</label>
            <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-[#062326] shadow-xs">
              {mockNodes.map(n => (
                <option key={n.nodeId} value={n.nodeId}>{n.name} ({n.nodeCode}) - Pin {n.batteryLevel}%</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Mã Serial Number Node mới (Replacement Node)</label>
            <input className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono focus:outline-none focus:border-[#062326] shadow-xs" placeholder="SN-NODE-2026-NEW-99" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsHotSwapOpen(false)}>Hủy</Button>
            <Button onClick={() => setIsHotSwapOpen(false)}><CheckCircle2 size={15} className="mr-1" /> Xác nhận Hot-Swap</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
