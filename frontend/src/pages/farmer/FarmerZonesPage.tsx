import React, { useState } from 'react';
import { mockZones, mockAlerts } from '../../mocks/mockData';
import { Sprout, ShieldAlert, CheckCircle2, Power, Activity } from 'lucide-react';
import { CF3ControlSection } from '../../components/control/CF3ControlSection';
import { Button } from '../../components/ui/BaseUI';

export const FarmerZonesPage: React.FC = () => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(mockZones[0]?.zoneId || 'zone-01');
  const [activeControlTab, setActiveControlTab] = useState<'ALERTS' | 'ACTUATORS' | 'SCHEDULES' | 'ENV_PARAMS' | 'SAFETY' | 'LOGS'>('ALERTS');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
              FARMER ZONE CONTROL HUB
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="text-[#062326]" size={22} /> Điều khiển & Cảnh báo Nhà màng được Phân công
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">Danh sách khu vực nhà màng thuộc phạm vi phụ trách kỹ thuật & tích hợp Trung tâm Cảnh báo Nông nghiệp.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setActiveControlTab('ALERTS')}
            className={`font-semibold ${activeControlTab === 'ALERTS' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}
          >
            <ShieldAlert size={14} className="mr-1.5" /> Xem Cảnh báo Zone
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockZones.slice(0, 2).map(z => {
          const isSelected = selectedZoneId === z.zoneId;
          const zoneAlertsCount = mockAlerts.filter(a => a.zoneId === z.zoneId && a.status === 'OPEN').length;

          return (
            <div
              key={z.zoneId}
              onClick={() => setSelectedZoneId(z.zoneId)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                isSelected
                  ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-200">
                      ASSIGNED ZONE
                    </span>
                    {zoneAlertsCount > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-300 flex items-center gap-1 animate-pulse">
                        <Activity size={10} /> {zoneAlertsCount} Cảnh báo mở
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        ✓ An toàn
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-1">{z.name}</h3>
                  <p className="text-xs text-slate-500">{z.description}</p>
                </div>
                {isSelected && <CheckCircle2 className="text-emerald-600" size={20} />}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100 font-mono">
                <div className="flex justify-between"><span>Cây trồng:</span><strong className="text-[#062326]">{z.currentCrop}</strong></div>
                <div className="flex justify-between"><span>Giai đoạn:</span><strong className="text-emerald-700">{z.currentStage}</strong></div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(z.zoneId);
                    setActiveControlTab('ALERTS');
                  }}
                  className="text-rose-700 font-bold hover:underline flex items-center gap-1"
                >
                  <ShieldAlert size={13} /> Mở Cảnh báo Zone ➔
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(z.zoneId);
                    setActiveControlTab('ACTUATORS');
                  }}
                  className="text-emerald-800 font-bold hover:underline flex items-center gap-1"
                >
                  <Power size={13} /> Điều khiển Rơ-le ➔
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Embedded CF3 Control Section for the selected assigned zone */}
      <CF3ControlSection
        key={`${selectedZoneId}-${activeControlTab}`}
        scopeLevel="ZONE"
        zoneId={selectedZoneId}
        defaultTab={activeControlTab}
        title={`Trung tâm Cảnh báo & Điều khiển cho Nhà màng [${mockZones.find(z => z.zoneId === selectedZoneId)?.name}]`}
        subtitle="Theo dõi cảnh báo vi phạm vi khí hậu thời gian thực, quản lý luật cảnh báo, kích hoạt rơ-le và theo dõi lịch tưới."
      />
    </div>
  );
};
