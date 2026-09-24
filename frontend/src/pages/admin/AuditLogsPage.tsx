import React from 'react';
import { mockAuditLogs } from '../../mocks/mockData';
import { ShieldAlert, Search, Filter } from 'lucide-react';
import { Input } from '../../components/ui/BaseUI';

export const AuditLogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert className="text-rose-600" size={22} /> Nhật ký Kiểm toán Toàn sàn (Platform Audit Logs)
        </h1>
        <p className="text-xs text-slate-600 mt-1">Truy vết toàn bộ thao tác tác động hệ thống, thay đổi cấu hình, tạo mới Tenant và tác động Relay.</p>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm kiếm audit log theo người dùng, IP, hành động..." className="pl-9" />
        </div>
        <span className="text-xs text-slate-500">Hiển thị {mockAuditLogs.length} bản ghi</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <th className="p-4">Thời gian</th>
              <th className="p-4">Người thực hiện</th>
              <th className="p-4">Hành động (Action)</th>
              <th className="p-4">Thực thể (Entity)</th>
              <th className="p-4">Địa chỉ IP</th>
              <th className="p-4">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs text-slate-700 font-mono">
            {mockAuditLogs.map(log => (
              <tr key={log.auditLogId} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 text-slate-500 font-sans">{log.createdAt}</td>
                <td className="p-4 font-sans font-semibold text-slate-900">{log.userName} ({log.userRole})</td>
                <td className="p-4 text-[#062326] font-bold">{log.action}</td>
                <td className="p-4 text-slate-700">{log.entityName} #{log.entityId}</td>
                <td className="p-4 text-slate-500">{log.ipAddress}</td>
                <td className="p-4 text-slate-700 font-sans">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
