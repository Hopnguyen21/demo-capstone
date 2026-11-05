import React from 'react';
import { mockSchedules, mockAutomationRules } from '../../mocks/mockData';
import { Calendar, Sliders, Plus, Clock, Cpu } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';

export const SchedulesAutomationPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-[#062326]" size={22} /> Lập lịch Định kỳ & Luật Tự động hóa (Schedules & Auto-Rules)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Cấu hình lịch tưới Cron và thiết lập bộ luật tự động WHEN-IF-THEN thích ứng theo cây trồng.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Tạo Luật / Lịch Mới</Button>
      </div>

      {/* Schedules Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock size={16} className="text-[#062326]" /> Lịch Tưới Định kỳ (Cron Schedules)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockSchedules.map(sch => (
            <div key={sch.scheduleId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#062326]">{sch.name}</span>
                <StatusBadge status={sch.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <div className="text-xs text-slate-600">{sch.zoneName} - {sch.actuatorName}</div>
              <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200 font-mono">
                <span>Thời gian: <strong className="text-slate-900">{sch.startTime} ({sch.durationMinutes} phút)</strong></span>
                <span>Lặp lại: <strong className="text-sky-700">{sch.daysOfWeek.join(', ')}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual WHEN-IF-THEN Automation Rules Section */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders size={16} className="text-sky-700" /> Bộ luật Tự động hóa Vi khí hậu (Rule Engine)
        </h3>

        <div className="space-y-3">
          {mockAutomationRules.map(rule => (
            <div key={rule.ruleId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{rule.name}</h4>
                  <StatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <div className="text-xs text-slate-600 mt-1 font-mono">
                  KHI <span className="text-[#062326] font-bold">{rule.parameterCode}</span> {rule.operator} <span className="text-amber-700 font-bold">{rule.thresholdValue}</span> THÌ KÍCH HOẠT <span className="text-sky-700 font-bold">{rule.actuatorName} ({rule.actionType})</span> TRONG {rule.actionDurationMinutes} PHÚT
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">Chỉnh sửa Rule</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
