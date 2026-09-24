import React, { useState } from 'react';
import { mockAlerts } from '../../mocks/mockData';
import { StatusBadge, Button } from '../../components/ui/BaseUI';
import { ShieldAlert, CheckCircle2, Bot, Plus } from 'lucide-react';
import { alertService } from '../../services';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState(mockAlerts);

  const handleAck = async (id: string) => {
    await alertService.acknowledgeAlert(id);
    setAlerts([...mockAlerts]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-rose-600" size={22} /> Trung tâm Cảnh báo Nông nghiệp (Alert Management)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách các vi phạm dải vi khí hậu an toàn và thông báo sự cố phần cứng.</p>
        </div>
        <Button variant="outline"><Plus size={16} className="mr-1.5" /> Cấu hình Luật Cảnh báo</Button>
      </div>

      <div className="space-y-3">
        {alerts.map(a => (
          <div key={a.alertId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-600 font-mono">#{a.alertId}</span>
                <StatusBadge status={a.status} />
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  {a.severity}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
              <p className="text-xs text-slate-600">{a.message}</p>
              <div className="text-[11px] text-slate-500 pt-1">
                Khu vực: <strong className="text-slate-800">{a.zoneName}</strong> | Giá trị vượt ngưỡng: <strong className="text-rose-600">{a.triggeredValue}</strong> (Mục tiêu: {a.targetRange})
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline"><Bot size={14} className="mr-1" /> Hỏi AI</Button>
              {a.status === 'OPEN' && (
                <Button size="sm" onClick={() => handleAck(a.alertId)}>
                  <CheckCircle2 size={14} className="mr-1" /> Xác nhận
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
