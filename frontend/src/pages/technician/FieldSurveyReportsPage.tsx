import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Calendar,
  Building,
  User,
  Eye,
  Edit3,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { fieldSurveyReportService, farmService } from '../../services';
import type { FieldSurveyReport, Farm } from '../../types';
import { FieldSurveyReportModal } from '../../components/reports/FieldSurveyReportModal';

export const FieldSurveyReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<FieldSurveyReport[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedFarmId, setSelectedFarmId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load Farms & Reports
  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fieldSurveyReportService.getReports({
        farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: searchTerm || undefined,
      });
      setReports(data);
    } catch (err: any) {
      console.error('Failed to load survey reports:', err);
      setError(err?.response?.data?.message || err.message || 'Không thể tải danh sách phiếu khảo sát');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadFarms = async () => {
      try {
        const farmList = await farmService.getFarms();
        setFarms(farmList);
      } catch (err) {
        console.error('Failed to load farms:', err);
      }
    };
    loadFarms();
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedFarmId, selectedStatus, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReports();
  };

  const handleOpenCreate = () => {
    setSelectedReportId(null);
    setModalReadOnly(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (report: FieldSurveyReport) => {
    setSelectedReportId(report.id);
    setModalReadOnly(false);
    setIsModalOpen(true);
  };

  const handleOpenView = (report: FieldSurveyReport) => {
    setSelectedReportId(report.id);
    setModalReadOnly(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (report: FieldSurveyReport) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu khảo sát "${report.title}"? Dữ liệu đã xóa sẽ không thể phục hồi.`)) {
      return;
    }

    setDeletingId(report.id);
    try {
      await fieldSurveyReportService.deleteReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err: any) {
      alert(`Xóa thất bại: ${err?.response?.data?.message || err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const isStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_TECHNICIAN';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Phiếu Báo Cáo Khảo Sát Thực Địa
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Ghi nhận hiện trạng trang trại, vi khí hậu, thiết bị IoT và đề xuất kỹ thuật trước khi ký kết hợp đồng.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReports()}
            disabled={loading}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isStaff && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Lập phiếu khảo sát mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, địa điểm, người khảo sát, đại diện trang trại..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Farm filter */}
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả trang trại</option>
              {farms.map((f) => (
                <option key={f.farmId} value={f.farmId}>
                  {f.name}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Draft">Bản nháp (Draft)</option>
              <option value="Submitted">Đã nộp (Submitted)</option>
              <option value="Approved">Đã duyệt (Approved)</option>
            </select>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="Khảo sát từ ngày"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="Đến ngày"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              />
            </div>

            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Lọc</span>
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Table / Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium">Đang tải danh sách phiếu khảo sát...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-3">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Chưa có phiếu khảo sát thực địa nào</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1">
            Kỹ thuật viên có thể tạo phiếu khảo sát mới hoặc tạo từ danh sách yêu cầu dịch vụ (Service Request) trước khi làm báo giá và hợp đồng.
          </p>
          {isStaff && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Lập phiếu khảo sát ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Tiêu đề Báo cáo</th>
                  <th className="py-3 px-4">Trang trại & Khu vực</th>
                  <th className="py-3 px-4">Ngày khảo sát</th>
                  <th className="py-3 px-4">Kỹ thuật viên</th>
                  <th className="py-3 px-4">Đại diện trang trại</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 line-clamp-1">{report.title}</span>
                        {report.serviceRequestTitle && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Req: {report.serviceRequestTitle}
                          </span>
                        )}
                        {report.location && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{report.location}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{report.farmName}</span>
                        {report.zoneName && (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                            {report.zoneName}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(report.surveyDate).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{report.surveyorName || 'Kỹ thuật viên'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <span>{report.representativeName || '—'}</span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${
                          report.status === 'Approved'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : report.status === 'Submitted'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {report.status === 'Approved' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>Đã duyệt</span>
                          </>
                        ) : report.status === 'Submitted' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>Đã nộp</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Bản nháp</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenView(report)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Xem chi tiết báo cáo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isStaff && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(report)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Chỉnh sửa báo cáo"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(report)}
                              disabled={deletingId === report.id}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Xóa báo cáo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Survey Modal */}
      {isModalOpen && (
        <FieldSurveyReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          reportId={selectedReportId}
          readOnly={modalReadOnly}
          onSaved={() => {
            loadReports();
          }}
        />
      )}

    </div>
  );
};
