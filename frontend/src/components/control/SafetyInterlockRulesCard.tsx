import React from 'react';
import { ShieldCheck, Zap, CloudRain, Clock, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Button } from '../ui/BaseUI';

interface SafetyInterlockRulesCardProps {
  onEmergencyStopAll?: () => void;
  isEmergencyStopActive?: boolean;
}

export const SafetyInterlockRulesCard: React.FC<SafetyInterlockRulesCardProps> = ({
  onEmergencyStopAll,
  isEmergencyStopActive = false
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={20} />
            <h3 className="text-base font-bold text-slate-900">
              Quy tắc An toàn & Khóa liên động (CF3 Business Safety Rules)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Hệ thống tự động thực thi 5 quy tắc bảo vệ phần cứng và hoãn lịch tưới khi thời tiết bất lợi.
          </p>
        </div>

        {/* Emergency Stop All Button (BR-CANCEL-01) */}
        <div>
          <Button
            variant="danger"
            size="md"
            className="font-bold shadow-md animate-pulse"
            onClick={onEmergencyStopAll}
          >
            <AlertOctagon size={16} className="mr-1.5" />
            HỦY LỆNH KHẨN CẤP (STOP ALL)
          </Button>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* BR-INTERLOCK-01 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-200">
              BR-INTERLOCK-01
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Zap size={14} className="text-amber-600" /> Khóa liên động Công suất
          </h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Cấm kích hoạt đồng thời &ge; 2 bơm công suất lớn (&ge; 500W) trong cùng farm để tránh quá tải lưới điện.
          </p>
        </div>

        {/* BR-SAFE-01 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded border border-emerald-200">
              BR-SAFE-01
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-600" /> Failsafe Hardware Timer
          </h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Timer phần cứng bắt buộc tối đa 30 phút/lần. Tự ngắt rơ-le an toàn ngay cả khi mất kết nối Internet.
          </p>
        </div>

        {/* BR-WEATHER-01 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-100 text-sky-900 rounded border border-sky-200">
              BR-WEATHER-01
            </span>
            <span className="w-2 h-2 rounded-full bg-sky-500" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <CloudRain size={14} className="text-sky-600" /> Rain Delay Hoãn Lịch
          </h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Tự động hoãn các lịch tưới định kỳ nếu dự báo thời tiết có xác suất mưa &ge; 70% trong 3 giờ tới.
          </p>
        </div>

        {/* BR-PREEMPTION-01 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-purple-100 text-purple-900 rounded border border-purple-200">
              BR-PREEMPTION-01
            </span>
            <span className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-purple-600" /> Ưu tiên Lệnh Thủ công
          </h4>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Lệnh điều khiển bằng tay từ Farm Owner (Priority = 1) có quyền ghi đè toàn bộ lịch tưới và tự động hóa.
          </p>
        </div>
      </div>
    </div>
  );
};
