import React, { useState, useEffect } from 'react';
import { 
  Sliders, Power, ShieldAlert, CheckCircle2, RefreshCw, 
  Activity, Radio, FileText, Cpu, AlertOctagon, Sparkles 
} from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui/BaseUI';
import { controlService } from '../../services';
import { CF3FlowVisualizer } from '../../components/control/CF3FlowVisualizer';
import { EnvironmentalParametersPanel } from '../../components/control/EnvironmentalParametersPanel';
import { ActuatorControlGrid } from '../../components/control/ActuatorControlGrid';
import { SafetyInterlockRulesCard } from '../../components/control/SafetyInterlockRulesCard';
import { ControlHistoryLogsTable } from '../../components/control/ControlHistoryLogsTable';
import { Actuator, ControlExecutionLog, EnvironmentalTargetConfig } from '../../types';

export const ControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'VISUALIZER' | 'ACTUATORS' | 'SAFETY' | 'LOGS'>('VISUALIZER');
  const [actuators, setActuators] = useState<Actuator[]>([]);
  const [configs, setConfigs] = useState<EnvironmentalTargetConfig[]>([]);
  const [logs, setLogs] = useState<ControlExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [actData, cfgData, logData] = await Promise.all([
        controlService.getActuators ? controlService.getActuators() : Promise.resolve([]),
        controlService.getEnvironmentalConfigs(),
        controlService.getControlLogs()
      ]);
      setActuators(actData);
      setConfigs(cfgData);
      setLogs(logData);
    } catch (err) {
      console.error('Failed to load control data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActuator = async (actuatorId: string, targetState: 'ON' | 'OFF', durationMinutes?: number) => {
    try {
      const updated = await controlService.toggleActuator(actuatorId, targetState);
      setNotification({
        type: 'success',
        message: `Đã phát lệnh ${targetState === 'ON' ? 'BẬT' : 'TẮT'} rơ-le thiết bị [${updated?.name}] qua LoRa Gateway!`
      });
      loadData();
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi phát lệnh điều khiển. Vui lòng kiểm tra kết nối Gateway!'
      });
    }
  };

  const handleEmergencyStop = async () => {
    const res = await controlService.emergencyStopAll();
    setNotification({
      type: 'error',
      message: `ĐÃ PHÁT LỆNH HỦY KHẨN CẤP (BR-CANCEL-01): Tắt toàn bộ ${res.stoppedCount} rơ-le đang chạy!`
    });
    loadData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#062326] to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono tracking-wide">
              LUỒNG CF3: SMART ENVIRONMENTAL CONTROL
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LoRa GW-ESP32 ONLINE (915 MHz)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sliders className="text-emerald-400" size={26} />
            Điều khiển Vi khí hậu & Chấp hành Thực địa
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Hệ thống tự động và điều khiển thủ công cho Bơm tưới, Van solenoid, Quạt đối lưu và Đèn quang hợp theo quy trình 10 bước chuẩn VietGAP / GlobalGAP.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleEmergencyStop}
            className="font-bold shadow-lg animate-pulse"
          >
            <AlertOctagon size={16} className="mr-1.5" />
            HỦY LỆNH KHẨN CẤP
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          'bg-sky-50 border-sky-200 text-sky-900'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <ShieldAlert size={18} className="text-rose-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1 font-medium text-xs">
        <button
          onClick={() => setActiveTab('VISUALIZER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'VISUALIZER'
              ? 'bg-[#062326] text-white shadow-sm font-bold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sparkles size={16} className={activeTab === 'VISUALIZER' ? 'text-emerald-400' : 'text-slate-500'} />
          Mô phỏng Trực quan Luồng 10 Bước CF3
        </button>

        <button
          onClick={() => setActiveTab('ACTUATORS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'ACTUATORS'
              ? 'bg-[#062326] text-white shadow-sm font-bold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Power size={16} className={activeTab === 'ACTUATORS' ? 'text-emerald-400' : 'text-slate-500'} />
          Điều khiển Rơ-le & Cấu hình Ngưỡng (Steps 1-9)
        </button>

        <button
          onClick={() => setActiveTab('SAFETY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'SAFETY'
              ? 'bg-[#062326] text-white shadow-sm font-bold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShieldAlert size={16} className={activeTab === 'SAFETY' ? 'text-emerald-400' : 'text-slate-500'} />
          Quy tắc An toàn Interlock (Business Rules)
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeTab === 'LOGS'
              ? 'bg-[#062326] text-white shadow-sm font-bold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText size={16} className={activeTab === 'LOGS' ? 'text-emerald-400' : 'text-slate-500'} />
          Nhật ký Lịch sử Điều khiển (Step 10)
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'VISUALIZER' && (
        <CF3FlowVisualizer
          actuators={actuators}
          onActuatorExecuted={handleToggleActuator}
        />
      )}

      {activeTab === 'ACTUATORS' && (
        <div className="space-y-6">
          <EnvironmentalParametersPanel
            configs={configs}
            onUpdateConfig={(cfg) => {
              setNotification({ type: 'success', message: `Đã lưu cấu hình dải vi khí hậu cho ${cfg.zoneName}` });
            }}
          />

          <ActuatorControlGrid
            actuators={actuators}
            onToggleActuator={handleToggleActuator}
          />
        </div>
      )}

      {activeTab === 'SAFETY' && (
        <SafetyInterlockRulesCard
          onEmergencyStopAll={handleEmergencyStop}
        />
      )}

      {activeTab === 'LOGS' && (
        <ControlHistoryLogsTable
          logs={logs}
        />
      )}
    </div>
  );
};
