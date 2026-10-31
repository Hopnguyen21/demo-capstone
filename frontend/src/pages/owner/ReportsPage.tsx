import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Droplets, Zap, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useAuth } from '../../app/providers/AuthContext';
import { reportService, extractApiError } from '../../services';
import type { FarmOverviewReport, ResourceUsageReport, TaskReport } from '../../services';

type TimeRange = '30d' | '90d' | '12m';

const RANGE_DAYS: Record<TimeRange, number> = { '30d': 30, '90d': 90, '12m': 365 };
const RANGE_LABEL: Record<TimeRange, string> = { '30d': '30 ngày qua', '90d': '90 ngày qua', '12m': '12 tháng qua' };

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  fontSize: '12px'
};

const monthKey = (year: number, month: number) => `${String(month).padStart(2, '0')}/${year}`;

/** Gộp các bucket (Zone × tháng) thành tổng theo tháng, giữ thứ tự thời gian. */
const sumByMonth = (report: ResourceUsageReport | null) => {
  const map = new Map<string, { label: string; order: number; value: number }>();
  for (const b of report?.buckets ?? []) {
    const key = monthKey(b.year, b.month);
    const entry = map.get(key) ?? { label: key, order: b.year * 12 + b.month, value: 0 };
    entry.value += b.value;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
};

/** Gộp các bucket thành tổng theo Zone. */
const sumByZone = (report: ResourceUsageReport | null) => {
  const map = new Map<string, number>();
  for (const b of report?.buckets ?? []) map.set(b.zoneName, (map.get(b.zoneName) ?? 0) + b.value);
  return map;
};

const fmt = (value: number, digits = 0) => value.toLocaleString('vi-VN', { maximumFractionDigits: digits });

export const ReportsPage: React.FC = () => {
  const { selectedFarmId } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<FarmOverviewReport | null>(null);
  const [water, setWater] = useState<ResourceUsageReport | null>(null);
  const [power, setPower] = useState<ResourceUsageReport | null>(null);
  const [tasks, setTasks] = useState<TaskReport | null>(null);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    const toUtc = new Date();
    const fromUtc = new Date(toUtc.getTime() - RANGE_DAYS[timeRange] * 24 * 3600 * 1000);
    const range = { fromUtc: fromUtc.toISOString(), toUtc: toUtc.toISOString() };
    setLoading(true);
    setError(null);
    Promise.all([
      reportService.getOverview(selectedFarmId),
      reportService.getWater(selectedFarmId, range),
      reportService.getElectricity(selectedFarmId, range),
      reportService.getTasks(selectedFarmId, range)
    ])
      .then(([o, w, p, t]) => {
        if (cancelled) return;
        setOverview(o);
        setWater(w);
        setPower(p);
        setTasks(t);
      })
      .catch(err => {
        if (cancelled) return;
        setError(extractApiError(err));
        setOverview(null);
        setWater(null);
        setPower(null);
        setTasks(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFarmId, timeRange]);

  const waterByMonth = useMemo(() => sumByMonth(water), [water]);
  const powerByMonth = useMemo(() => sumByMonth(power), [power]);
  const zoneRows = useMemo(() => {
    const w = sumByZone(water);
    const p = sumByZone(power);
    const names = [...new Set([...w.keys(), ...p.keys()])];
    const waterTotal = [...w.values()].reduce((a, b) => a + b, 0);
    return names
      .map(name => ({ name, water: w.get(name) ?? 0, power: p.get(name) ?? 0, waterShare: waterTotal > 0 ? ((w.get(name) ?? 0) / waterTotal) * 100 : 0 }))
      .sort((a, b) => b.water - a.water);
  }, [water, power]);

  const unmeasured = (water?.unmeasuredCommandCount ?? 0) + (power?.unmeasuredCommandCount ?? 0);

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      window.print();
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-50 text-[#119653] rounded-xl border border-emerald-100">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Báo Cáo Tài Nguyên & Năng Suất</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Lượng nước tưới và điện năng tính từ các lệnh điều khiển đã được thiết bị xác nhận, cùng tình hình công việc và cảnh báo của nông trại.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(Object.keys(RANGE_LABEL) as TimeRange[]).map(key => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {RANGE_LABEL[key]}
              </button>
            ))}
          </div>
          <Button onClick={handleExportPdf} className="bg-[#119653] hover:bg-[#0e8046] text-white flex items-center gap-2">
            <Download size={15} />
            <span>{isExporting ? 'Đang xuất PDF...' : 'Xuất Báo Cáo PDF'}</span>
          </Button>
        </div>
      </div>

      {!selectedFarmId && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 text-sm text-slate-500">Chưa chọn nông trại để xem báo cáo.</div>
      )}
      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-700">Không tải được báo cáo: {error}</div>
      )}
      {loading && <div className="text-xs text-slate-500">Đang tải báo cáo…</div>}

      {selectedFarmId && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tổng Nước Tưới</span>
                <div className="p-2 bg-sky-50 text-sky-600 rounded-lg"><Droplets size={18} /></div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  {fmt(water?.total ?? 0)} <span className="text-sm font-normal text-slate-500">Lít</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{RANGE_LABEL[timeRange]} · {water?.countedCommandCount ?? 0} lệnh được tính</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Điện Năng Tiêu Thụ</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Zap size={18} /></div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  {fmt(power?.total ?? 0, 1)} <span className="text-sm font-normal text-slate-500">kWh</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{RANGE_LABEL[timeRange]} · {power?.countedCommandCount ?? 0} lệnh được tính</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Công Việc Hoàn Thành</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={18} /></div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  {tasks && tasks.total > 0 ? `${fmt(tasks.completionRatePercent, 1)}%` : '—'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {tasks && tasks.total > 0
                    ? `${tasks.approved}/${tasks.total} đã duyệt · ${tasks.overdue} quá hạn · ${tasks.failed} thất bại`
                    : 'Chưa có công việc trong kỳ'}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Cảnh Báo</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle size={18} /></div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  {overview?.openAlertCount ?? 0} <span className="text-sm font-normal text-slate-500">chưa xử lý</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{overview?.alertsLast7Days ?? 0} cảnh báo trong 7 ngày qua</div>
              </div>
            </div>
          </div>

          {unmeasured > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                {unmeasured} lệnh chưa được tính vì thiết bị chưa khai báo lưu lượng (L/phút) hoặc công suất định mức (W).
                Bổ sung thông số này ở thiết bị chấp hành để báo cáo đầy đủ hơn.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Tiêu Thụ Nước Tưới Theo Tháng</h2>
                  <p className="text-xs text-slate-500">Tính từ thời lượng lệnh tưới × lưu lượng định mức của van</p>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                  Tổng: {fmt(water?.total ?? 0)} L
                </span>
              </div>
              <div className="h-64 pt-2">
                {waterByMonth.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có lệnh tưới nào được tính trong kỳ này.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [`${fmt(val)} Lít`, 'Lượng nước']} />
                      <Bar dataKey="value" fill="#0284c7" radius={[6, 6, 0, 0]} name="Lượng nước (Lít)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Điện Năng Tiêu Thụ Theo Tháng</h2>
                  <p className="text-xs text-slate-500">Tính từ thời lượng lệnh × công suất định mức của thiết bị chấp hành</p>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                  Tổng: {fmt(power?.total ?? 0, 1)} kWh
                </span>
              </div>
              <div className="h-64 pt-2">
                {powerByMonth.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Chưa có lệnh điều khiển nào được tính trong kỳ này.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={powerByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [`${fmt(val, 2)} kWh`, 'Điện năng']} />
                      <Area type="monotone" dataKey="value" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#powerGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Tài Nguyên Theo Khu Vực Canh Tác</h2>
            {zoneRows.length === 0 ? (
              <div className="text-xs text-slate-400">Chưa có dữ liệu tiêu thụ theo khu vực trong kỳ này.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase">
                      <th className="pb-3">Khu vực</th>
                      <th className="pb-3">Tỷ trọng nước tưới</th>
                      <th className="pb-3 text-right">Nước (Lít)</th>
                      <th className="pb-3 text-right">Điện (kWh)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {zoneRows.map(row => (
                      <tr key={row.name} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#119653] h-full rounded-full" style={{ width: `${Math.min(100, row.waterShare)}%` }} />
                            </div>
                            <span className="font-medium text-slate-600">{fmt(row.waterShare, 1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-medium text-slate-700">{fmt(row.water)}</td>
                        <td className="py-3 text-right font-medium text-slate-700">{fmt(row.power, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
