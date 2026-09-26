import React, { useState, useEffect } from 'react';
import { 
  Sliders, Send, Cpu, Radio, Zap, 
  RotateCw, Activity, CheckCircle2, FileText, Play, Pause, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import { Button, StatusBadge } from '../ui/BaseUI';
import { CF3StepNumber, Actuator } from '../../types';

interface StepDefinition {
  step: CF3StepNumber;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  icon: React.ReactNode;
}

const STEPS: StepDefinition[] = [
  {
    step: 1,
    title: 'Set / Confirm Control Parameters',
    subtitle: 'Cấu hình Ngưỡng Vi khí hậu',
    description: 'Thiết lập hoặc xác nhận các thông số điều khiển (Độ ẩm đất, Nhiệt độ, Độ ẩm không khí, Ánh sáng) theo vụ cây trồng.',
    color: 'emerald',
    badgeBg: 'bg-emerald-600',
    badgeBorder: 'border-emerald-700',
    icon: <Sliders className="w-5 h-5 text-white" />
  },
  {
    step: 2,
    title: 'Submit Control Request',
    subtitle: 'Gửi Yêu cầu Điều khiển',
    description: 'Gửi yêu cầu kích hoạt thủ công (Manual Priority = 1) hoặc trigger từ lịch tưới Cron / Luật tự động.',
    color: 'sky',
    badgeBg: 'bg-sky-600',
    badgeBorder: 'border-sky-700',
    icon: <Send className="w-5 h-5 text-white" />
  },
  {
    step: 3,
    title: 'Generate Control Command',
    subtitle: 'Sinh Lệnh qua Rule Engine',
    description: 'Hệ thống kiểm tra các luật an toàn (BR-INTERLOCK-01 cấm 2 bơm lớn, BR-WEATHER-01 hoãn khi mưa, BR-SAFE-01 max 30 phút) & sinh lệnh MQTT.',
    color: 'indigo',
    badgeBg: 'bg-indigo-600',
    badgeBorder: 'border-indigo-700',
    icon: <Cpu className="w-5 h-5 text-white" />
  },
  {
    step: 4,
    title: 'LoRa Gateway receives command',
    subtitle: 'Gateway LoRa Nhận Lệnh',
    description: 'LoRa Gateway (GW-ESP32-DL01) nhận Downlink Payload từ MQTT Broker và xếp vào hàng đợi phát sóng RF 915MHz.',
    color: 'amber',
    badgeBg: 'bg-amber-600',
    badgeBorder: 'border-amber-700',
    icon: <Radio className="w-5 h-5 text-white" />
  },
  {
    step: 5,
    title: 'Receive command at device node',
    subtitle: 'Node Trạm Nhận Lệnh',
    description: 'IoT Node chấp hành (SN-LORA-001) giải mã gói tin mã hóa AES-128 và xác minh địa chỉ MAC whitelist.',
    color: 'purple',
    badgeBg: 'bg-purple-600',
    badgeBorder: 'border-purple-700',
    icon: <Zap className="w-5 h-5 text-white" />
  },
  {
    step: 6,
    title: 'Execute Control Action',
    subtitle: 'Thiết bị Chấp hành Vận hành',
    description: 'Rơ-le kích hoạt Bơm tưới / Van Solenoid / Quạt đối lưu / Đèn GrowLight theo đúng thời lượng đã thiết lập.',
    color: 'purple',
    badgeBg: 'bg-purple-600',
    badgeBorder: 'border-purple-700',
    icon: <RotateCw className="w-5 h-5 text-white" />
  },
  {
    step: 7,
    title: 'Send Status Feedback to System',
    subtitle: 'Gửi Phản hồi Trạng thái',
    description: 'Node chấp hành gửi Uplink ACK kèm dòng điện/trạng thái chân rơ-le qua LoRa về Gateway -> System.',
    color: 'sky',
    badgeBg: 'bg-sky-600',
    badgeBorder: 'border-sky-700',
    icon: <Activity className="w-5 h-5 text-white" />
  },
  {
    step: 8,
    title: 'View Updated Device / Zone Status',
    subtitle: 'Cập nhật Trạng thái Zone',
    description: 'Hệ thống cập nhật tức thời trạng thái thiết bị và dữ liệu cảm biến (Độ ẩm đất tăng, Nhiệt độ giảm) lên giao diện.',
    color: 'emerald',
    badgeBg: 'bg-emerald-600',
    badgeBorder: 'border-emerald-700',
    icon: <Activity className="w-5 h-5 text-white" />
  },
  {
    step: 9,
    title: 'Control Executed Successfully',
    subtitle: 'Xác nhận Thành công',
    description: 'Hệ thống hiển thị trạng thái Vận hành thành công và hẹn giờ tự ngắt Failsafe Hardware Timer.',
    color: 'emerald',
    badgeBg: 'bg-emerald-600',
    badgeBorder: 'border-emerald-700',
    icon: <CheckCircle2 className="w-5 h-5 text-white" />
  },
  {
    step: 10,
    title: 'View Control History (Optional)',
    subtitle: 'Ghi Nhật ký Điều khiển',
    description: 'Toàn bộ tiến trình được append-only vào Audit Log & TimescaleDB để phục vụ truy xuất VietGAP/GlobalGAP.',
    color: 'sky',
    badgeBg: 'bg-sky-600',
    badgeBorder: 'border-sky-700',
    icon: <FileText className="w-5 h-5 text-white" />
  }
];

interface CF3FlowVisualizerProps {
  actuators: Actuator[];
  onActuatorExecuted?: (actuatorId: string, newState: 'ON' | 'OFF') => void;
}

export const CF3FlowVisualizer: React.FC<CF3FlowVisualizerProps> = ({ actuators, onActuatorExecuted }) => {
  const [selectedActuatorId, setSelectedActuatorId] = useState<string>(actuators[0]?.actuatorId || 'act-01');
  const [targetAction, setTargetAction] = useState<'ON' | 'OFF'>('ON');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [currentActiveStep, setCurrentActiveStep] = useState<CF3StepNumber | null>(null);
  const [selectedInspectStep, setSelectedInspectStep] = useState<CF3StepNumber>(1);
  const [stepLogs, setStepLogs] = useState<Record<number, string>>({});

  const selectedActuator = actuators.find(a => a.actuatorId === selectedActuatorId) || actuators[0];

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setStepLogs({});
    setCurrentActiveStep(1);
    setSelectedInspectStep(1);

    const stepInterval = setInterval(() => {
      setCurrentActiveStep((prevStep) => {
        if (!prevStep) return 1;
        if (prevStep >= 10) {
          clearInterval(stepInterval);
          setIsSimulating(false);
          if (onActuatorExecuted && selectedActuator) {
            onActuatorExecuted(selectedActuator.actuatorId, targetAction);
          }
          return 10;
        }
        const next = (prevStep + 1) as CF3StepNumber;
        setSelectedInspectStep(next);
        return next;
      });
    }, 1200);
  };

  const getStepTechnicalDetails = (stepNum: CF3StepNumber) => {
    const actName = selectedActuator?.name || 'Bơm Tưới Nhỏ Giọt';
    const zoneName = selectedActuator?.zoneName || 'Nhà màng 01';
    
    switch (stepNum) {
      case 1:
        return {
          code: JSON.stringify({
            zoneId: selectedActuator?.zoneId || 'zone-01',
            cropStage: 'Ra hoa (Flowering)',
            soilMoistureTarget: 70,
            currentMoisture: 58.4,
            humidityTarget: 70,
            maxTemperatureLimit: 28.0,
            interlockSafetyCheck: 'PASSED'
          }, null, 2),
          note: 'Thiết lập các chỉ số ngưỡng vi khí hậu phù hợp cho vụ trồng.'
        };
      case 2:
        return {
          code: JSON.stringify({
            requestId: `REQ-${Date.now()}`,
            actuatorId: selectedActuator?.actuatorId,
            requestedAction: targetAction,
            durationMinutes: durationMinutes,
            priority: 1,
            requestedBy: 'FARM_OWNER (Lê Văn An)',
            timestamp: new Date().toISOString()
          }, null, 2),
          note: 'Yêu cầu điều khiển có độ ưu tiên cao nhất (Manual Priority = 1).'
        };
      case 3:
        return {
          code: JSON.stringify({
            commandId: `CMD-${Math.floor(Math.random()*10000)}`,
            mqttTopic: `smartfarm/v1/tenant-01/farm-01/gw-01/downlink`,
            ruleEvaluated: {
              interlockCheck: 'PASSED (Không có bơm lớn nào khác đang chạy)',
              failsafeTimer: `BR-SAFE-01 enforced (${durationMinutes} mins <= 30 mins max)`,
              rainDelayCheck: 'PASSED (Dự báo mưa 15% < 70%)'
            },
            payloadHex: 'A5 01 02 0F 89 FE CRC16'
          }, null, 2),
          note: 'Hệ thống đã xác minh luật an toàn & biên dịch sang MQTT Downlink.'
        };
      case 4:
        return {
          code: JSON.stringify({
            gatewayId: 'gw-01',
            macAddress: '24:DC:C3:98:A1:04',
            status: 'RECEIVED',
            queuePosition: 1,
            radioFrequency: '915.0 MHz SF7 BW125',
            rssi: -78,
            snr: 8.5
          }, null, 2),
          note: 'LoRa Gateway trung tâm đã nhận lệnh từ Cloud Broker.'
        };
      case 5:
        return {
          code: JSON.stringify({
            nodeCode: selectedActuator?.nodeId || 'SN-LORA-001',
            receivedStatus: 'ACK',
            decryptionStatus: 'AES-128 OK',
            macWhitelistVerified: true,
            batteryVoltage: '3.85V (Good)'
          }, null, 2),
          note: 'Node cảm biến & chấp hành thực địa nhận tín hiệu LoRa.'
        };
      case 6:
        return {
          code: JSON.stringify({
            actuatorCode: selectedActuator?.actuatorCode,
            relayPinState: targetAction === 'ON' ? 'HIGH (5V)' : 'LOW (0V)',
            currentDrawnAmps: targetAction === 'ON' ? '4.2A' : '0.0A',
            hardwareTimerSeconds: durationMinutes * 60,
            status: targetAction === 'ON' ? 'RUNNING' : 'STOPPED'
          }, null, 2),
          note: 'Rơ-le chấp hành đã bật/tắt thiết bị thành công.'
        };
      case 7:
        return {
          code: JSON.stringify({
            uplinkPayload: {
              event: 'ACTUATOR_STATUS_FEEDBACK',
              actuatorId: selectedActuator?.actuatorId,
              state: targetAction,
              feedbackSensors: { currentAmps: 4.2, pressureBar: 2.1 }
            },
            timestamp: new Date().toISOString()
          }, null, 2),
          note: 'Trạm thực địa gửi phản hồi Uplink khẳng định thiết bị đang hoạt động.'
        };
      case 8:
        return {
          code: JSON.stringify({
            zoneId: selectedActuator?.zoneId,
            zoneName: zoneName,
            updatedActuatorStatus: targetAction,
            soilMoistureTrend: targetAction === 'ON' ? 'RISING (+0.5%/min)' : 'STABLE',
            realtimeBadge: 'ACTIVE'
          }, null, 2),
          note: 'Cập nhật tức thời trạng thái zone và diễn biến độ ẩm/nhiệt độ.'
        };
      case 9:
        return {
          code: JSON.stringify({
            executionResult: 'SUCCESS',
            confirmedAt: new Date().toISOString(),
            autoOffScheduledAt: new Date(Date.now() + durationMinutes * 60000).toLocaleTimeString(),
            message: 'Kích hoạt thành công rơ-le chấp hành.'
          }, null, 2),
          note: 'Hoàn tất chu trình điều khiển an toàn.'
        };
      case 10:
        return {
          code: JSON.stringify({
            auditLogId: `AUDIT-CF3-${Date.now()}`,
            action: `CF3_ACTUATE_${targetAction}`,
            entity: actName,
            userRole: 'FARM_OWNER',
            timescaleDBStatus: 'INSERTED_APPEND_ONLY',
            vietGapCompliance: 'VERIFIED'
          }, null, 2),
          note: 'Lưu trữ vết điều khiển append-only phục vụ báo cáo VietGAP/GlobalGAP.'
        };
      default:
        return { code: '{}', note: '' };
    }
  };

  const inspectDetails = getStepTechnicalDetails(selectedInspectStep);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
      {/* Header & Interactive Control Simulation Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#062326] text-emerald-400 font-mono">
              LUỒNG QUY TRÌNH CF3
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Smart Environmental Control & Actuation Flow
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Mô phỏng và trực quan hóa 10 bước khép kín từ cài đặt thông số vi khí hậu đến phát lệnh LoRa, kích hoạt Rơ-le và lưu nhật ký.
          </p>
        </div>

        {/* Simulation trigger controls */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-slate-500">Chọn Thiết bị</label>
            <select
              value={selectedActuatorId}
              onChange={(e) => setSelectedActuatorId(e.target.value)}
              disabled={isSimulating}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
            >
              {actuators.map(a => (
                <option key={a.actuatorId} value={a.actuatorId}>
                  {a.name} ({a.zoneName})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-slate-500">Hành động</label>
            <select
              value={targetAction}
              onChange={(e) => setTargetAction(e.target.value as 'ON' | 'OFF')}
              disabled={isSimulating}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ON">BẬT thiết bị</option>
              <option value="OFF">TẮT thiết bị</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-slate-500">Thời lượng (Phút)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              disabled={isSimulating}
              className="w-16 text-xs font-semibold bg-white border border-slate-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="self-end">
            <Button
              variant={isSimulating ? 'secondary' : 'primary'}
              size="sm"
              onClick={runSimulation}
              disabled={isSimulating}
            >
              {isSimulating ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#062326]" />
                  Đang chạy Bước {currentActiveStep}/10...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Mô phỏng 10 Bước
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 10-Step Interactive Stepper Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {STEPS.map((s) => {
          const isActive = currentActiveStep === s.step;
          const isCompleted = currentActiveStep !== null && currentActiveStep > s.step;
          const isInspected = selectedInspectStep === s.step;

          return (
            <div
              key={s.step}
              onClick={() => setSelectedInspectStep(s.step)}
              className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500 ring-offset-1 shadow-md scale-[1.02]'
                  : isCompleted
                  ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400'
                  : isInspected
                  ? 'border-slate-400 bg-slate-50 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* Top Step Number Badge & Icon */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ${s.badgeBg}`}>
                    {s.step}
                  </span>
                  <div className={`p-1.5 rounded-lg ${s.badgeBg} opacity-90`}>
                    {s.icon}
                  </div>
                </div>
                {isActive && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                )}
                {isCompleted && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
              </div>

              {/* Step Title & Subtitle */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                  {s.title}
                </h4>
                <p className="text-[11px] font-medium text-slate-600">
                  {s.subtitle}
                </p>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                  {s.description}
                </p>
              </div>

              {/* Bottom inspect indicator */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                <span className={isInspected ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                  {isInspected ? '▶ Đang xem chi tiết' : 'Click xem log'}
                </span>
                <span className="text-slate-400">Step 0{s.step}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Step Technical Payload & Safety Inspector */}
      <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              {selectedInspectStep}
            </span>
            <span className="font-bold text-emerald-400">
              Chi tiết Kỹ thuật Step {selectedInspectStep}: {STEPS[selectedInspectStep - 1].title}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {STEPS[selectedInspectStep - 1].subtitle}
          </span>
        </div>

        <p className="text-slate-300 font-sans text-xs">
          💡 {inspectDetails.note}
        </p>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto">
          <pre>{inspectDetails.code}</pre>
        </div>
      </div>
    </div>
  );
};
