import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  Save,
  Printer,
  X,
  AlertCircle,
  Building,
  Leaf,
  Cpu,
  Layers,
  HelpCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronDown,
  ArrowUp
} from 'lucide-react';
import type { FieldSurveyReport, CreateFieldSurveyReportPayload, UpdateFieldSurveyReportPayload, Farm } from '../../types';
import { fieldSurveyReportService, farmService } from '../../services';
import { useAuth } from '@/app/providers/AuthContext';

interface FieldSurveyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string | null;
  serviceRequest?: {
    id: string;
    requestCode?: string;
    farmId: string;
    farmName?: string;
    zoneId?: string;
    zoneName?: string;
    title?: string;
    status?: string;
  } | null;
  initialFarmId?: string;
  initialFarmName?: string;
  readOnly?: boolean;
  onSaved?: (report: FieldSurveyReport) => void;
}

const SECTION_NAV = [
  { id: 'sec-1', label: '1. Thông tin chung', shortLabel: '1. Thông tin', icon: Calendar },
  { id: 'sec-2', label: '2. Tổng quan trang trại', shortLabel: '2. Tổng quan', icon: Building },
  { id: 'sec-3', label: '3. Cây trồng & Mùa vụ', shortLabel: '3. Cây trồng', icon: Leaf },
  { id: 'sec-4', label: '4. Quy trình canh tác', shortLabel: '4. Quy trình', icon: Layers },
  { id: 'sec-5', label: '5. Theo dõi môi trường', shortLabel: '5. Môi trường', icon: Sparkles },
  { id: 'sec-6', label: '6. Nhu cầu ngưỡng', shortLabel: '6. Ngưỡng', icon: Clock },
  { id: 'sec-7', label: '7. Thiết bị & Dữ liệu IoT', shortLabel: '7. Thiết bị', icon: Cpu },
  { id: 'sec-8', label: '8. Quản lý & Phân quyền', shortLabel: '8. Phân quyền', icon: ShieldCheck },
  { id: 'sec-9', label: '9. Khó khăn & Nhu cầu', shortLabel: '9. Khó khăn', icon: HelpCircle },
  { id: 'sec-10', label: '10. Đề xuất của nhóm', shortLabel: '10. Đề xuất', icon: CheckCircle },
];

export const FieldSurveyReportModal: React.FC<FieldSurveyReportModalProps> = ({
  isOpen,
  onClose,
  reportId,
  serviceRequest,
  initialFarmId,
  initialFarmName,
  readOnly = false,
  onSaved,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Farms list for dropdown if creating new without preselected farm
  const [availableFarms, setAvailableFarms] = useState<Farm[]>([]);

  // Loaded report data if editing/viewing
  const [existingReport, setExistingReport] = useState<FieldSurveyReport | null>(null);

  // Form Fields
  const [farmId, setFarmId] = useState<string>('');
  const [farmName, setFarmName] = useState<string>('');
  const [serviceRequestId, setServiceRequestId] = useState<string | undefined>(undefined);
  const [zoneId, setZoneId] = useState<string | undefined>(undefined);
  const [zoneName, setZoneName] = useState<string>('');
  const [title, setTitle] = useState('');
  const [surveyDate, setSurveyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');

  // 9 Detailed Survey Sections
  const [farmOverview, setFarmOverview] = useState('');
  const [cropAndSeasonStatus, setCropAndSeasonStatus] = useState('');
  const [cultivationProcess, setCultivationProcess] = useState('');
  const [environmentalMonitoring, setEnvironmentalMonitoring] = useState('');
  const [environmentalThresholdNeeds, setEnvironmentalThresholdNeeds] = useState('');
  const [equipmentAndDataCollection, setEquipmentAndDataCollection] = useState('');
  const [managementAndPermissions, setManagementAndPermissions] = useState('');
  const [difficultiesAndNeeds, setDifficultiesAndNeeds] = useState('');
  const [teamAssessment, setTeamAssessment] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Submitted' | 'Approved'>('Submitted');

  // Load Farms list
  useEffect(() => {
    if (!isOpen) return;
    farmService.getFarms()
      .then(list => setAvailableFarms(Array.isArray(list) ? list : []))
      .catch(err => console.warn('Could not load farms list:', err));
  }, [isOpen]);

  // Load Report data
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessMsg(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        let foundReport: FieldSurveyReport | null = null;

        if (reportId) {
          foundReport = await fieldSurveyReportService.getReportById(reportId);
        } else if (serviceRequest?.id) {
          foundReport = await fieldSurveyReportService.getReportByServiceRequest(serviceRequest.id);
        }

        if (foundReport) {
          setExistingReport(foundReport);
          setFarmId(foundReport.farmId);
          setFarmName(foundReport.farmName);
          setServiceRequestId(foundReport.serviceRequestId || undefined);
          setZoneId(foundReport.zoneId || undefined);
          setZoneName(foundReport.zoneName || '');
          setTitle(foundReport.title || '');
          setSurveyDate(foundReport.surveyDate ? foundReport.surveyDate.split('T')[0] : new Date().toISOString().split('T')[0]);
          setLocation(foundReport.location || '');
          setSurveyorName(foundReport.surveyorName || '');
          setRepresentativeName(foundReport.representativeName || '');
          setFarmOverview(foundReport.farmOverview || '');
          setCropAndSeasonStatus(foundReport.cropAndSeasonStatus || '');
          setCultivationProcess(foundReport.cultivationProcess || '');
          setEnvironmentalMonitoring(foundReport.environmentalMonitoring || '');
          setEnvironmentalThresholdNeeds(foundReport.environmentalThresholdNeeds || '');
          setEquipmentAndDataCollection(foundReport.equipmentAndDataCollection || '');
          setManagementAndPermissions(foundReport.managementAndPermissions || '');
          setDifficultiesAndNeeds(foundReport.difficultiesAndNeeds || '');
          setTeamAssessment(foundReport.teamAssessment || '');
          setStatus((foundReport.status as any) || 'Submitted');
        } else {
          // Initialize for new report
          setExistingReport(null);
          const fId = serviceRequest?.farmId || initialFarmId || '';
          const fName = serviceRequest?.farmName || initialFarmName || '';
          setFarmId(fId);
          setFarmName(fName);
          setServiceRequestId(serviceRequest?.id || undefined);
          setZoneId(serviceRequest?.zoneId || undefined);
          setZoneName(serviceRequest?.zoneName || '');
          setTitle(
            serviceRequest?.requestCode
              ? `Báo cáo khảo sát thực địa [${serviceRequest.requestCode}] - ${fName || 'Trang trại'}`
              : `Báo cáo khảo sát thực địa - ${fName || 'Trang trại'}`
          );
          setSurveyDate(new Date().toISOString().split('T')[0]);
          setLocation('');
          setSurveyorName(user?.fullName || 'Kỹ thuật viên SmartFarm');
          setRepresentativeName('');
          setFarmOverview('');
          setCropAndSeasonStatus('');
          setCultivationProcess('');
          setEnvironmentalMonitoring('');
          setEnvironmentalThresholdNeeds('');
          setEquipmentAndDataCollection('');
          setManagementAndPermissions('');
          setDifficultiesAndNeeds('');
          setTeamAssessment('');
          setStatus('Submitted');
        }
      } catch (err: any) {
        console.error('Error loading field survey report:', err);
        setError(err.message || 'Không thể tải thông tin phiếu khảo sát');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, reportId, serviceRequest, initialFarmId, initialFarmName, user]);

  if (!isOpen) return null;

  const isUserReadOnly = readOnly || (user?.role === 'FARM_OWNER' || user?.role === 'FARMER');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSave = async (targetStatus: 'Draft' | 'Submitted') => {
    if (!title.trim()) {
      setError('Vui lòng nhập tên tiêu đề phiếu khảo sát');
      scrollToSection('sec-1');
      return;
    }
    if (!farmId) {
      setError('Vui lòng chọn trang trại được khảo sát');
      scrollToSection('sec-1');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let saved: FieldSurveyReport;
      if (existingReport) {
        const payload: UpdateFieldSurveyReportPayload = {
          title: title.trim(),
          surveyDate: new Date(surveyDate).toISOString(),
          location: location.trim(),
          surveyorName: surveyorName.trim(),
          representativeName: representativeName.trim(),
          farmOverview: farmOverview.trim(),
          cropAndSeasonStatus: cropAndSeasonStatus.trim(),
          cultivationProcess: cultivationProcess.trim(),
          environmentalMonitoring: environmentalMonitoring.trim(),
          environmentalThresholdNeeds: environmentalThresholdNeeds.trim(),
          equipmentAndDataCollection: equipmentAndDataCollection.trim(),
          managementAndPermissions: managementAndPermissions.trim(),
          difficultiesAndNeeds: difficultiesAndNeeds.trim(),
          teamAssessment: teamAssessment.trim(),
          status: targetStatus,
        };
        saved = await fieldSurveyReportService.updateReport(existingReport.id, payload);
      } else {
        const payload: CreateFieldSurveyReportPayload = {
          farmId,
          serviceRequestId,
          zoneId,
          title: title.trim(),
          surveyDate: new Date(surveyDate).toISOString(),
          location: location.trim(),
          surveyorName: surveyorName.trim(),
          representativeName: representativeName.trim(),
          farmOverview: farmOverview.trim(),
          cropAndSeasonStatus: cropAndSeasonStatus.trim(),
          cultivationProcess: cultivationProcess.trim(),
          environmentalMonitoring: environmentalMonitoring.trim(),
          environmentalThresholdNeeds: environmentalThresholdNeeds.trim(),
          equipmentAndDataCollection: equipmentAndDataCollection.trim(),
          managementAndPermissions: managementAndPermissions.trim(),
          difficultiesAndNeeds: difficultiesAndNeeds.trim(),
          teamAssessment: teamAssessment.trim(),
          status: targetStatus,
        };
        saved = await fieldSurveyReportService.createReport(payload);
      }

      setExistingReport(saved);
      setStatus(saved.status as any);
      setSuccessMsg(targetStatus === 'Draft' ? 'Đã lưu bản nháp thành công!' : 'Đã lưu và cập nhật phiếu khảo sát vào Database!');
      if (onSaved) onSaved(saved);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to save survey report:', err);
      setError(err?.response?.data?.message || err.message || 'Lỗi khi lưu phiếu khảo sát');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white flex items-center justify-between shadow-md shrink-0 print:bg-none print:text-slate-900 print:border-b print:border-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl ring-1 ring-white/20 print:hidden">
              <FileText className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">
                  {existingReport ? 'Phiếu Báo Cáo Khảo Sát Thực Địa' : 'Lập Phiếu Báo Cáo Khảo Sát Thực Địa'}
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                    status === 'Approved'
                      ? 'bg-blue-500/30 text-blue-100 border border-blue-400/40'
                      : status === 'Submitted'
                      ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                      : 'bg-amber-500/30 text-amber-100 border border-amber-400/40'
                  }`}
                >
                  {status === 'Approved' ? 'Đã duyệt' : status === 'Submitted' ? 'Đã nộp' : 'Bản nháp'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Trang trại: <strong>{farmName || 'Chọn trang trại bên dưới'}</strong></span>
                {serviceRequest?.requestCode && (
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-mono">
                    Yêu cầu: #{serviceRequest.requestCode}
                  </span>
                )}
                {zoneName && <span>• Phân khu: <strong>{zoneName}</strong></span>}
                <span className="bg-emerald-900/40 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-200">
                  Hiển thị toàn bộ 10 mục trên 1 trang
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="In hoặc xuất PDF phiếu khảo sát"
            >
              <Printer className="w-4 h-4" />
              <span>In / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Floating Quick Anchor Pills Bar */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center gap-1.5 overflow-x-auto print:hidden shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Mục lục:</span>
          </span>
          {SECTION_NAV.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className="px-2.5 py-1 text-xs rounded-lg font-medium text-slate-600 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 whitespace-nowrap transition-all shadow-2xs"
            >
              {sec.shortLabel}
            </button>
          ))}
        </div>

        {/* Global Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 shrink-0 print:hidden animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shrink-0 print:hidden animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Modal Body / Scrollable Content (Single Continuous Page) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium">Đang tải dữ liệu phiếu khảo sát thực địa...</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* SECTION 1: General Info */}
              <section id="sec-1" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 1</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Thông tin Buổi khảo sát thực tế</span>
                    </h3>
                  </div>
                  {existingReport?.createdAtUtc && (
                    <span className="text-xs text-slate-400">
                      Tạo lúc: {new Date(existingReport.createdAtUtc).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên / Tiêu đề phiếu báo cáo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={isUserReadOnly}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ví dụ: Báo cáo khảo sát thực địa Nhà màng Z01 - Cà chua Beef..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-75 transition-all font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Trang trại được khảo sát <span className="text-red-500">*</span>
                    </label>
                    {serviceRequest?.farmId || initialFarmId ? (
                      <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-500" />
                        <span>{farmName || 'Trang trại'}</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          disabled={isUserReadOnly}
                          value={farmId}
                          onChange={(e) => {
                            setFarmId(e.target.value);
                            const found = availableFarms.find(f => f.farmId === e.target.value || (f as any).id === e.target.value);
                            if (found) setFarmName(found.name);
                          }}
                          className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 font-medium appearance-none"
                        >
                          <option value="">-- Chọn trang trại khảo sát --</option>
                          {availableFarms.map((f: any) => {
                            const fid = f.farmId || f.id;
                            return (
                              <option key={fid} value={fid}>
                                {f.name} {f.address ? `(${f.address})` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày tiến hành khảo sát <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        disabled={isUserReadOnly}
                        value={surveyDate}
                        onChange={(e) => setSurveyDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 font-medium"
                      />
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Địa điểm khảo sát thực tế
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isUserReadOnly}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ví dụ: Thôn 3, Xã Đạ Sar, Huyện Lạc Dương, Lâm Đồng"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                      />
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Người thực hiện khảo sát (Kỹ thuật viên SmartFarm)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isUserReadOnly}
                        value={surveyorName}
                        onChange={(e) => setSurveyorName(e.target.value)}
                        placeholder="Họ tên kỹ thuật viên"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Người đại diện trang trại tiếp đoàn khảo sát
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isUserReadOnly}
                        value={representativeName}
                        onChange={(e) => setRepresentativeName(e.target.value)}
                        placeholder="Họ tên chủ trại / người quản lý trang trại tiếp đoàn"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: Farm Overview */}
              <section id="sec-2" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 2</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-emerald-600" />
                      <span>Tổng quan Trang trại</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Ghi nhận quy mô diện tích, số lượng khu vực/nhà màng, địa hình, nguồn cấp nước và loại hình canh tác.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={farmOverview}
                    onChange={(e) => setFarmOverview(e.target.value)}
                    placeholder="Mô tả chi tiết:
- Quy mô tổng thể: ... ha, gồm ... nhà màng và ... khu vực canh tác ngoài trời.
- Nguồn cấp nước: Giếng khoan / Hồ chứa nước mưa, công suất bơm ... m³/h.
- Nguồn điện: Điện 3 pha lưới quốc gia / Máy phát dự phòng.
- Loại hình canh tác: Nhà kính màng PE kết hợp lưới chắn côn trùng 50 mesh, hệ thống khung thép..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed font-sans disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 3: Crop and Season Status */}
              <section id="sec-3" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 3</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Leaf className="w-4 h-4 text-emerald-600" />
                      <span>Hiện trạng Cây trồng & Mùa vụ</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Ghi nhận loại cây, giống cây thương mại, thời gian gieo trồng, thời gian thu hoạch dự kiến, mật độ trồng.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={cropAndSeasonStatus}
                    onChange={(e) => setCropAndSeasonStatus(e.target.value)}
                    placeholder="Ghi chú hiện trạng cây trồng:
- Loại cây: Cà chua Beef / Dưa lưới Huỳnh Long / Ớt chuông ngọt...
- Giống cây cụ thể: F1 nhập khẩu Enza Zaden, độ thuần cao.
- Mùa vụ: Vụ Đông Xuân 2026-2027, thời gian xuống giống: .../..., dự kiến thu hoạch: .../...
- Mật độ: 2.8 cây/m², khoảng cách hàng cách hàng 1.2m, cây cách cây 35cm..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 4: Cultivation Process */}
              <section id="sec-4" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 4</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Quy trình Canh tác thực tế của Trang trại</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Mô tả các giai đoạn sinh trưởng, thời gian mỗi giai đoạn và các hoạt động tưới tiêu, bón phân, tỉa cành thực tế.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={cultivationProcess}
                    onChange={(e) => setCultivationProcess(e.target.value)}
                    placeholder="Quy trình chăm sóc từng giai đoạn:
1. Giai đoạn Cây con (Seedling - 20 ngày): Duy trì độ ẩm giá thể 70-75%, tưới EC 1.2, pH 6.0.
2. Giai đoạn Sinh trưởng phát triển (Vegetative - 30 ngày): Tỉa chồi nách, quấn dây định hướng thân, tăng EC lên 1.8 - 2.0.
3. Giai đoạn Ra hoa đậu quả (Flowering - 25 ngày): Rung hoa thụ phấn nhân tạo, theo dõi chênh lệch nhiệt độ ngày đêm.
4. Giai đoạn Thu hoạch (Harvest - 30 ngày): Giảm lượng nước tưới, duy trì độ Brix quả ngọt..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 5: Environmental Monitoring */}
              <section id="sec-5" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 5</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Hiện trạng Theo dõi Môi trường</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Những chỉ số vi khí hậu và môi trường đất/nước mà trang trại đang quan tâm và cần giám sát.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={environmentalMonitoring}
                    onChange={(e) => setEnvironmentalMonitoring(e.target.value)}
                    placeholder="- Các chỉ số bắt buộc: Nhiệt độ không khí (°C), Độ ẩm không khí (%RH).
- Chỉ số đất/giá thể: Độ ẩm đất (%VWC), Độ dẫn điện EC đất (mS/cm), Độ chua pH.
- Chỉ số khác: Cường độ bức xạ ánh sáng mặt trời (Lux / Solar Radiation), Mức CO2 trong nhà kính..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 6: Environmental Threshold Needs */}
              <section id="sec-6" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 6</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>Nhu cầu Thiết lập Ngưỡng Môi trường</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cách trang trại xác định ngưỡng an toàn (Min/Max) và nhu cầu cấu hình cảnh báo tự động.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={environmentalThresholdNeeds}
                    onChange={(e) => setEnvironmentalThresholdNeeds(e.target.value)}
                    placeholder="- Ngưỡng nhiệt độ mong muốn: Ban ngày 24°C - 28°C (cảnh báo quá nhiệt > 32°C), ban đêm 16°C - 19°C.
- Ngưỡng độ ẩm không khí: 65% - 75% (độ ẩm > 85% có nguy cơ nấm mốc botrytis).
- Nhu cầu thông báo: Muốn nhận cảnh báo qua Telegram/Zalo và Web Dashboard khi vượt ngưỡng quá 15 phút liên tục..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 7: Equipment & Data Collection */}
              <section id="sec-7" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 7</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                      <span>Hiện trạng Thiết bị & Thu thập Dữ liệu</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cảm biến, hệ thống tưới tự động/bán tự động, thiết bị điều khiển, hạ tầng mạng LoRa/Wifi/4G.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={equipmentAndDataCollection}
                    onChange={(e) => setEquipmentAndDataCollection(e.target.value)}
                    placeholder="- Hiện trạng hạ tầng: Đã có đường ống tưới nhỏ giọt dẫn đến từng bầu cây, van tổng cơ học.
- Thiết bị đo hiện có: Đo thủ công bằng bút đo cầm tay Hanna (mỗi ngày đo 1 lần vào 8h sáng).
- Tình trạng sóng: Wifi khu vực nhà kho tốt, khu nhà màng sóng 4G Viettel 3 vạch ổn định, rất phù hợp triển khai LoRa Gateway..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 8: Management & Permissions */}
              <section id="sec-8" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 8</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Cơ cấu Quản lý & Phân quyền Trang trại</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Số lượng người quản lý, kỹ thuật viên phụ trách, công nhân vận hành và nhu cầu phân quyền trên phần mềm.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={managementAndPermissions}
                    onChange={(e) => setManagementAndPermissions(e.target.value)}
                    placeholder="- Ban quản lý: 01 Chủ trang trại (Owner - toàn quyền duyệt chi, cấu hình hợp đồng).
- Kỹ thuật nông nghiệp: 01 Kỹ sư phụ trách dinh dưỡng và phòng trừ sâu bệnh.
- Công nhân: 03 công nhân thường trực (chỉ cần xem lịch tưới và xác nhận hoàn thành công việc trên ứng dụng)..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 9: Difficulties & Real Needs */}
              <section id="sec-9" className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">MỤC 9</span>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      <span>Khó khăn & Nhu cầu Thực tế của Trang trại</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Các vấn đề thực địa đang làm giảm năng suất, tốn chi phí nhân công hoặc gây rủi ro thất thoát.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={4}
                    disabled={isUserReadOnly}
                    value={difficultiesAndNeeds}
                    onChange={(e) => setDifficultiesAndNeeds(e.target.value)}
                    placeholder="Các khó khăn trang trại đang đối mặt:
1. Thiếu dữ liệu vi khí hậu liên tục: Ban đêm sương muối hoặc độ ẩm tăng cao không phát hiện kịp thời dẫn đến nấm lá.
2. Tưới tiêu phụ thuộc kinh nghiệm công nhân: Công nhân tưới quá liều lượng hoặc quên bật/tắt van gây ngập úng rễ.
3. Thất thoát phân bón dinh dưỡng: Chưa đo đạc được độ dẫn điện EC và pH giá thể tự động sau mỗi cữ tưới.
4. Mong muốn của chủ trại: Tự động hóa van tưới theo lịch trình hoặc theo cảm biến ẩm độ đất..."
                    className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed disabled:opacity-75"
                  />
                </div>
              </section>

              {/* SECTION 10: Technical Team Assessment & Recommendations */}
              <section id="sec-10" className="p-5 bg-emerald-50/50 border-2 border-emerald-500/40 rounded-2xl shadow-sm space-y-3">
                <div className="border-b border-emerald-200 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold">MỤC 10</span>
                    <h3 className="text-sm font-bold text-emerald-950 tracking-tight flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Đánh giá & Đề xuất của Nhóm Kỹ thuật SmartFarm</span>
                    </h3>
                  </div>
                  <p className="text-xs text-emerald-800/80 mt-1">
                    Đánh giá tính khả thi, đề xuất cấu hình phần cứng IoT, gói hợp đồng và giải pháp tự động hóa trước khi lập Báo giá/Hợp đồng.
                  </p>
                </div>
                <div>
                  <textarea
                    rows={5}
                    disabled={isUserReadOnly}
                    value={teamAssessment}
                    onChange={(e) => setTeamAssessment(e.target.value)}
                    placeholder="Đề xuất giải pháp kỹ thuật:
- Tính khả thi: Trang trại có cơ sở hạ tầng nhà màng rất tốt, nguồn điện và mạng 4G sẵn sàng, đánh giá ĐẠT tiêu chuẩn triển khai SmartFarm 100%.
- Cấu hình đề xuất cho Nhà màng Z01:
  + 01 Trạm Central Gateway ESP32-LoRa Outdoor (phủ sóng toàn bộ 2.5ha).
  + 02 Node Cảm biến Vi khí hậu Không khí SHT30 (đo nhiệt độ, độ ẩm không khí chuẩn công nghiệp).
  + 02 Node Cảm biến Độ ẩm & Nhiệt độ Đất RS485 Probe (cắm trực tiếp giá thể bầu cà chua).
  + 01 Node Điều khiển Van Solenoid Tưới nhỏ giọt 4 Cổng (tự động hóa 4 van phân khu).
- Gói dịch vụ đề xuất: Gói duy trì dịch vụ giám sát & bảo trì IoT 12 tháng đồng hành theo thời hạn hợp đồng."
                    className="w-full p-3.5 text-sm bg-white border border-emerald-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed font-medium text-slate-900 disabled:opacity-75 shadow-xs"
                  />
                </div>
              </section>

              {/* Scroll to Top helper link */}
              <div className="pt-2 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => scrollToSection('sec-1')}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Về đầu phiếu</span>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer (Sticky Bottom Action Bar) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {existingReport ? (
              <span>Người tạo: <strong>{existingReport.createdByUserName || surveyorName}</strong></span>
            ) : (
              <span>Toàn bộ 10 mục khảo sát sẽ được lưu trực tiếp vào PostgreSQL</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              Đóng
            </button>

            {!isUserReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => handleSave('Draft')}
                  disabled={saving || loading}
                  className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu bản nháp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave('Submitted')}
                  disabled={saving || loading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{existingReport ? 'Cập nhật & Lưu Báo cáo' : 'Hoàn thành & Lưu Database'}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
