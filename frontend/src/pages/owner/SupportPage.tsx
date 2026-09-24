import React from 'react';
import { mockServiceRequests } from '../../mocks/mockData';
import { Headphones, Plus } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const SupportPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Headphones className="text-sky-700" size={22} /> Yêu cầu Hỗ trợ Kỹ thuật IoT (Service Tickets)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Gửi phiếu yêu cầu chẩn đoán, bảo trì phần cứng và theo dõi kỹ thuật viên xử lý.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Gửi Yêu cầu Hỗ trợ</Button>
      </div>

      <div className="space-y-3">
        {mockServiceRequests.map(sr => (
          <div key={sr.serviceRequestId} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-700 font-mono">#{sr.serviceRequestId}</span>
              <StatusBadge status={sr.status} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{sr.title}</h3>
            <p className="text-xs text-slate-600">{sr.description}</p>
            <div className="text-[11px] text-slate-500 pt-1">
              Kỹ thuật viên phụ trách: <strong className="text-[#062326]">{sr.assignedTechnicianName}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
