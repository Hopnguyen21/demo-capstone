import React, { useState, useEffect } from 'react';
import {
  Database, Download, RotateCcw, Plus, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock, FileArchive, Search, RefreshCw, HardDrive,
  CheckCircle, XCircle, Info, ShieldAlert, Layers
} from 'lucide-react';
import { Button, Input, Modal } from '../../components/ui/BaseUI';
import { backupService, extractApiError } from '../../services';
import type { BackupMetadataView, RestoreBackupResult, VerifyBackupResult, BackupSystemStatusView } from '../../services';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoStr;
  }
};

export const BackupRestorePage: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadataView[]>([]);
  const [status, setStatus] = useState<BackupSystemStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verify Modal State
  const [verifyTarget, setVerifyTarget] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyBackupResult | null>(null);

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<BackupMetadataView | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listData, statusData] = await Promise.all([
        backupService.list(),
        backupService.getStatus().catch(() => null)
      ]);
      setBackups(listData);
      if (statusData) setStatus(statusData);
    } catch (err) {
      setError(`Không thể tải thông tin sao lưu: ${extractApiError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccessMsg(null);
      const res = await backupService.create();
      setSuccessMsg(`Tạo bản sao lưu thành công: ${res.fileName} (${res.totalRecords} bản ghi, ${formatBytes(res.sizeBytes)})`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      setError(`Lỗi tạo bản sao lưu: ${extractApiError(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (fileName: string) => {
    try {
      setVerifyTarget(fileName);
      setVerifying(true);
      setVerifyResult(null);
      setError(null);
      const res = await backupService.verify(fileName);
      setVerifyResult(res);
    } catch (err) {
      setError(`Lỗi kiểm tra toàn vẹn bản sao lưu: ${extractApiError(err)}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      await backupService.download(fileName);
    } catch (err) {
      setError(`Lỗi tải xuống bản sao lưu: ${extractApiError(err)}`);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget || confirmInput !== 'CONFIRM_RESTORE') return;
    try {
      setRestoring(true);
      setError(null);
      const res = await backupService.restore(restoreTarget.fileName, true, 'CONFIRM_RESTORE');
      setRestoreResult(res);
      setSuccessMsg(`Thao tác khôi phục hoàn tất: ${res.message}`);
      await loadData();
    } catch (err) {
      setError(`Lỗi khi khôi phục dữ liệu: ${extractApiError(err)}`);
    } finally {
      setRestoring(false);
    }
  };

  const filteredBackups = backups.filter(b => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      b.fileName.toLowerCase().includes(q) ||
      b.checksumSha256.toLowerCase().includes(q) ||
      b.createdByEmail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-[#119653] rounded-xl border border-emerald-100">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sao Lưu &amp; Khôi Phục Dữ Liệu Toàn Hệ Thống</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo bản sao lưu nén (.sfbackup) chuẩn định dạng 2 tệp (manifest + data), kiểm tra toàn vẹn SHA-256 độc lập và khôi phục an toàn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </Button>
          <Button
            onClick={handleCreateBackup}
            disabled={creating}
            className="bg-[#107c41] hover:bg-[#0b5c30] text-white flex items-center gap-2 shadow-xs text-xs font-semibold"
          >
            <Plus size={15} />
            <span>{creating ? 'Đang tạo sao lưu...' : 'Tạo Bản Sao Lưu Mới'}</span>
          </Button>
        </div>
      </div>

      {/* System Status Banner */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className={status.allowLiveRestore ? 'text-amber-500' : 'text-emerald-500'} />
              <span>Chế độ Live Restore</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${status.allowLiveRestore ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {status.allowLiveRestore ? 'BẬT (Ghi đè Database)' : 'TẮT (Diễn tập / Safe Dry-run)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {status.allowLiveRestore
                ? 'Cho phép khôi phục thực tế và ghi đè vào PostgreSQL có giao dịch.'
                : 'Mặc định an toàn: chỉ xác thực cấu trúc và kiểm tra tệp, không can thiệp DB.'}
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <span>Chính sách lưu trữ</span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {status.retentionDays} ngày / Tối đa {status.maxBackups} tệp
            </div>
            <p className="text-[10px] text-slate-500">
              Tự động giữ các bản sao lưu hợp lệ và loại bỏ các bản quá thời hạn.
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive size={14} className="text-slate-400" />
              <span>Giới hạn dung lượng</span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {formatBytes(status.maxBackupFileSizeBytes)} (Nén)
            </div>
            <p className="text-[10px] text-slate-500">
              Giới hạn giải nén bảo vệ chống Zip-bomb: {formatBytes(status.maxUncompressedSizeBytes)}.
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileArchive size={14} className="text-emerald-600" />
              <span>Kho lưu trữ khả dụng</span>
            </div>
            <div className="text-sm font-bold text-emerald-800">
              {status.totalBackupsAvailable} tệp .sfbackup
            </div>
            <p className="text-[10px] text-slate-500 truncate" title={status.storageDirectory}>
              Đường dẫn: {status.storageDirectory}
            </p>
          </div>
        </div>
      )}

      {/* Security Info Banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5 text-slate-700">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Nguyên tắc An toàn &amp; Bảo vệ Dữ liệu Hệ thống (OperationalDomainSnapshot)</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          • <strong>Phạm vi sao lưu:</strong> Bao quát toàn bộ 63 thực thể miền nghiệp vụ vận hành (Nông trại, Khu vực, Cây trồng, Vụ mùa, Thiết bị IoT, Lệnh điều khiển, Vật tư, Nhiệm vụ, AI, Tài chính, RAG).
          <br />
          • <strong>Bảng loại trừ:</strong> <code>TelemetryReadings</code> (chuỗi thời gian số đo cảm biến dung lượng lớn) và <code>RefreshTokens</code> (phiên làm việc tạm thời) không đưa vào bản sao lưu miền vận hành.
          <br />
          • <strong>Bảo mật mật khẩu:</strong> Password hash và thông tin xác thực <strong>được loại trừ hoàn toàn</strong> khỏi tệp sao lưu. Người dùng cần đặt lại mật khẩu sau khi khôi phục dữ liệu sang môi trường mới.
          <br />
          • <strong>Ngăn mất dữ liệu:</strong> Trước khi khôi phục vào database, hệ thống <strong>bắt buộc tạo bản sao lưu an toàn (Pre-Restore)</strong> thành công. Nếu tạo bản sao lưu an toàn thất bại, hệ thống tự động hủy khôi phục để bảo vệ dữ liệu hiện tại.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo tên file, email tạo hoặc mã SHA-256..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <HardDrive size={14} />
          <span>{filteredBackups.length} / {backups.length} tệp sao lưu</span>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className="p-4">Tên Bản Sao Lưu</th>
              <th className="p-4">Thời Gian Tạo</th>
              <th className="p-4">Số Bản Ghi</th>
              <th className="p-4">Dung Lượng</th>
              <th className="p-4">Mã Checksum SHA-256</th>
              <th className="p-4">Người Thực Hiện</th>
              <th className="p-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBackups.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  <FileArchive className="mx-auto mb-2 text-slate-300" size={32} />
                  {loading ? 'Đang tải danh sách bản sao lưu...' : 'Chưa có bản sao lưu nào. Nhấn "Tạo Bản Sao Lưu Mới" để bắt đầu.'}
                </td>
              </tr>
            ) : (
              filteredBackups.map(b => (
                <tr key={b.fileName} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-4 font-mono font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileArchive size={15} className="text-emerald-700 shrink-0" />
                      <span>{b.fileName}</span>
                    </div>
                    {b.formatVersion && (
                      <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                        Phiên bản: {b.formatVersion} • {b.supportedScope || 'OperationalDomainSnapshot'}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span>{formatDate(b.createdAtUtc)}</span>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-emerald-800">
                    {b.totalRecords.toLocaleString('vi-VN')} bản ghi
                  </td>
                  <td className="p-4 font-mono text-slate-600">
                    {formatBytes(b.sizeBytes)}
                  </td>
                  <td className="p-4 font-mono text-[10px] text-slate-500" title={b.checksumSha256}>
                    {b.checksumSha256 ? `${b.checksumSha256.slice(0, 12)}...` : 'N/A'}
                  </td>
                  <td className="p-4 text-slate-600">
                    {b.createdByEmail}
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerify(b.fileName)}
                        disabled={verifying && verifyTarget === b.fileName}
                        className="text-xs flex items-center gap-1 text-blue-700 hover:bg-blue-50 border-blue-200"
                        title="Kiểm tra tính toàn vẹn và mã SHA-256 độc lập"
                      >
                        <ShieldCheck size={12} className={verifying && verifyTarget === b.fileName ? 'animate-spin' : ''} />
                        <span>Kiểm tra</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(b.fileName)}
                        className="text-xs flex items-center gap-1 text-slate-700 hover:text-emerald-700"
                        title="Tải tệp .sfbackup về máy"
                      >
                        <Download size={12} />
                        <span>Tải về</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRestoreTarget(b);
                          setConfirmInput('');
                          setRestoreResult(null);
                        }}
                        className="text-xs flex items-center gap-1 text-rose-600 hover:bg-rose-50 border-rose-200"
                        title="Khôi phục trạng thái hệ thống từ bản sao lưu này"
                      >
                        <RotateCcw size={12} />
                        <span>Khôi phục</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Verify Result Modal */}
      {verifyTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!verifying) {
              setVerifyTarget(null);
              setVerifyResult(null);
            }
          }}
          title="Kiểm Tra Toàn Vẹn Tệp Sao Lưu"
        >
          <div className="space-y-4 text-xs">
            {verifying ? (
              <div className="py-8 text-center text-slate-500 space-y-3">
                <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto" />
                <p className="font-semibold text-slate-700">Đang kiểm tra tệp {verifyTarget}...</p>
                <p className="text-[11px] text-slate-500">
                  Đọc manifest, tính lại hash SHA-256 trên nội dung dữ liệu và kiểm tra cấu trúc JSON.
                </p>
              </div>
            ) : verifyResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${verifyResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                  {verifyResult.isValid ? (
                    <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                  ) : (
                    <XCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold text-sm">
                      {verifyResult.isValid ? 'Bản sao lưu hợp lệ và toàn vẹn' : 'Bản sao lưu không hợp lệ / bị lỗi'}
                    </div>
                    <p className="text-xs leading-relaxed">{verifyResult.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Xác minh SHA-256:</span>
                    <div className="flex items-center gap-1.5 font-bold">
                      {verifyResult.checksumVerified ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Khớp chính xác
                        </span>
                      ) : (
                        <span className="text-rose-700 flex items-center gap-1">
                          <XCircle size={13} /> Sai lệch mã hash (Có dấu hiệu can thiệp)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Phiên bản định dạng:</span>
                    <div className="font-bold text-slate-800">
                      v{verifyResult.formatVersion}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Tổng số bản ghi:</span>
                    <div className="font-bold text-slate-800">
                      {verifyResult.totalRecords.toLocaleString('vi-VN')} bản ghi
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-medium">Thời điểm xác thực:</span>
                    <div className="font-bold text-slate-800">
                      {formatDate(verifyResult.verifiedAtUtc)}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">Phiên bản: {verifyResult.formatVersion}</div>
                  </div>
                </div>

                {verifyResult.warnings && verifyResult.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle size={14} /> Cảnh báo phát hiện:
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                      {verifyResult.warnings.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {verifyResult.tableRecordCounts && Object.keys(verifyResult.tableRecordCounts).length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Layers size={14} className="text-slate-500" />
                      <span>Số lượng bản ghi theo bảng ({Object.keys(verifyResult.tableRecordCounts).length} bảng):</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 p-2 text-[11px]">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(verifyResult.tableRecordCounts).map(([table, count]) => (
                          <div key={table} className="flex justify-between py-0.5">
                            <span className="font-mono text-slate-600">{table}:</span>
                            <span className="font-bold text-slate-800">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setVerifyTarget(null);
                      setVerifyResult(null);
                    }}
                    className="bg-slate-700 hover:bg-slate-800 text-white"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
      )}

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!restoring) {
              setRestoreTarget(null);
              setRestoreResult(null);
            }
          }}
          title="Xác Nhận Khôi Phục Dữ Liệu Hệ Thống"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
              <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                <AlertTriangle size={18} className="text-rose-600" />
                <span>CẢNH BÁO QUAN TRỌNG VỀ KHÔI PHỤC</span>
              </div>
              <p className="leading-relaxed">
                Bạn đang chuẩn bị thực hiện khôi phục dữ liệu từ bản sao lưu:
                <br />
                <strong className="font-mono">{restoreTarget.fileName}</strong> ({restoreTarget.totalRecords.toLocaleString('vi-VN')} bản ghi, tạo lúc {formatDate(restoreTarget.createdAtUtc)}).
              </p>
              <div className="p-2.5 bg-white/70 rounded-lg border border-rose-200 text-[11px] space-y-1 text-slate-700">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info size={13} className="text-blue-600" />
                  <span>Trạng thái cấu hình hiện tại:</span>
                </div>
                {status?.allowLiveRestore ? (
                  <p className="text-amber-800 font-medium">
                    ⚠️ <strong>Live Restore đang BẬT:</strong> Hệ thống sẽ tự động tạo một snapshot an toàn trước khi khôi phục, sau đó cập nhật dữ liệu database trong một giao dịch cơ sở dữ liệu.
                  </p>
                ) : (
                  <p className="text-blue-800 font-medium">
                    ℹ️ <strong>Live Restore đang TẮT:</strong> Thao tác này sẽ chạy ở chế độ <strong>Diễn tập an toàn (Dry-Run)</strong>. Toàn bộ tính hợp lệ và cấu trúc bảng sẽ được kiểm chứng mà không ghi đè dữ liệu cơ sở dữ liệu.
                  </p>
                )}
              </div>
            </div>

            {restoreResult ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-950">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>{restoreResult.isDryRunOnly ? 'Hoàn Tất Kiểm Tra Diễn Tập (Dry-Run)' : 'Khôi Phục Dữ Liệu Thành Công!'}</span>
                </div>
                <p className="leading-relaxed text-xs">{restoreResult.message}</p>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div>Thời điểm: {formatDate(restoreResult.restoredAtUtc)} • Số bản ghi: {restoreResult.restoredRecords.toLocaleString('vi-VN')}</div>
                  {restoreResult.preRestoreBackupFileName && (
                    <div className="font-mono text-emerald-800">
                      Bản sao lưu an toàn tự động: {restoreResult.preRestoreBackupFileName}
                    </div>
                  )}
                  {restoreResult.isDryRunOnly && (
                    <div className="italic text-slate-500">
                      (Lưu ý: Do AllowLiveRestore đang tắt trong cấu hình máy chủ, dữ liệu thực tế không bị thay đổi).
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setRestoreTarget(null);
                      setRestoreResult(null);
                    }}
                    className="bg-[#119653] text-white"
                  >
                    Hoàn tất &amp; Đóng
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nhập đúng chuỗi <strong className="text-rose-600 font-mono">CONFIRM_RESTORE</strong> để xác nhận:
                  </label>
                  <Input
                    placeholder="CONFIRM_RESTORE"
                    value={confirmInput}
                    onChange={e => setConfirmInput(e.target.value)}
                    className="font-mono text-center tracking-wider text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={() => setRestoreTarget(null)}
                    disabled={restoring}
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    onClick={handleConfirmRestore}
                    disabled={confirmInput !== 'CONFIRM_RESTORE' || restoring}
                    className="bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                  >
                    <RotateCcw size={14} className={restoring ? 'animate-spin mr-1' : 'mr-1'} />
                    <span>{restoring ? 'Đang thực hiện...' : (status?.allowLiveRestore ? 'Khôi Phục Database Thật' : 'Chạy Diễn Tập Khôi Phục')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
