import React, { useState } from 'react';
import { FileText, Search, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react';
import { StatusBadge } from '../ui/BaseUI';
import { ControlExecutionLog } from '../../types';

interface ControlHistoryLogsTableProps {
  logs: ControlExecutionLog[];
}

export const ControlHistoryLogsTable: React.FC<ControlHistoryLogsTableProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.actuatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.zoneName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.gatewayCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = selectedSource === 'ALL' || log.triggerSource === selectedSource;
    return matchesSearch && matchesSource;
  });

  const getSourceBadge = (source: ControlExecutionLog['triggerSource']) => {
    switch (source) {
      case 'MANUAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800">LỆNH TAY (MANUAL)</span>;
      case 'SCHEDULE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">LỊCH CRON</span>;
      case 'AUTO_RULE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">RULE ENGINE</span>;
      case 'AI_APPROVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">AI APPROVED</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 font-mono">
              STEP 10 OF CF3
            </span>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-[#062326]" size={18} />
              Nhật ký Lịch sử Điều khiển & Vận hành (Control History Audit Log)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Bảng nhật ký append-only ghi nhận chi tiết thời gian phát lệnh, nguồn kích hoạt, Gateway MAC và kết quả thực thi theo chuẩn VietGAP.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Tìm thiết bị / zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 w-44"
            />
          </div>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Tất cả Nguồn</option>
            <option value="MANUAL">Thủ công (Manual)</option>
            <option value="SCHEDULE">Lịch Cron</option>
            <option value="AUTO_RULE">Auto Rule Engine</option>
            <option value="AI_APPROVED">AI Khuyên dùng</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Thiết bị Chấp hành</th>
              <th className="py-3 px-4">Zone / Trạm</th>
              <th className="py-3 px-4">Hành động</th>
              <th className="py-3 px-4">Nguồn Kích hoạt</th>
              <th className="py-3 px-4">LoRa Gateway / Node</th>
              <th className="py-3 px-4">Trạng thái Thực thi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <tr key={log.logId} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                  {new Date(log.executedAt).toLocaleTimeString()} ({new Date(log.executedAt).toLocaleDateString()})
                </td>
                <td className="py-3 px-4 font-bold text-slate-900">
                  {log.actuatorName}
                </td>
                <td className="py-3 px-4 text-slate-600">
                  {log.zoneName}
                </td>
                <td className="py-3 px-4 font-bold">
                  <span className={log.action === 'TURN_ON' ? 'text-emerald-700' : 'text-slate-600'}>
                    {log.action === 'TURN_ON' ? `BẬT (${log.durationMinutes || 15} phút)` : 'TẮT'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {getSourceBadge(log.triggerSource)}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                  {log.gatewayCode} &rarr; {log.nodeCode}
                </td>
                <td className="py-3 px-4">
                  {log.executionStatus === 'SUCCESS' ? (
                    <StatusBadge status="COMPLETED" label="THÀNH CÔNG" />
                  ) : log.executionStatus === 'INTERLOCK_BLOCKED' ? (
                    <StatusBadge status="WARNING" label="INTERLOCK CHẶN" />
                  ) : log.executionStatus === 'EMERGENCY_STOP' ? (
                    <StatusBadge status="DANGER" label="HỦY KHẨN CẤP" />
                  ) : (
                    <StatusBadge status="ERROR" label="THẤT BẠI" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
