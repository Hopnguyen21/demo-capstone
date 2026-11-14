import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Search, Filter, CheckCircle2, Clock, XCircle,
  FileText, ArrowDownRight, ArrowUpRight, ArrowDownLeft, AlertCircle,
  Building2, Eye, Trash2, Cpu, DollarSign, Truck
} from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { useAuth } from '@/app/providers/AuthContext';
import {
  farmService, adminService, supportService,
  stockOutService, stockInService, zoneService, extractApiError
} from '../../services';
import {
  Farm, Zone, StockOut, StockOutStatus,
  StockIn, StockInStatus
} from '../../types';

export const StockOutsPage: React.FC = () => {
  const { role } = useAuth();
  const isManager = role === 'PLATFORM_ADMIN' || role === 'PLATFORM_TECHNICIAN';

  // Navigation tab: 'STOCK_IN' (Phiếu Nhập Kho) or 'STOCK_OUT' (Phiếu Xuất Kho)
  const [activeTab, setActiveTab] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [hardwareItems, setHardwareItems] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [stockOuts, setStockOuts] = useState<StockOut[]>([]);
  const [stockIns, setStockIns] = useState<StockIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Stock Out
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStockOut, setSelectedStockOut] = useState<StockOut | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Modals for Stock In
  const [isCreateInModalOpen, setIsCreateInModalOpen] = useState(false);
  const [selectedStockIn, setSelectedStockIn] = useState<StockIn | null>(null);
  const [isDetailInModalOpen, setIsDetailInModalOpen] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  // Form State: Stock Out
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [itemRows, setItemRows] = useState<{ inventoryItemId: string; quantity: number; notes: string }[]>([
    { inventoryItemId: '', quantity: 1, notes: '' }
  ]);

  // Form State: Stock In
  const [supplierName, setSupplierName] = useState<string>('');
  const [inNotes, setInNotes] = useState<string>('');
  const [inItemRows, setInItemRows] = useState<{ inventoryItemId: string; quantity: number; unitPrice: number; notes: string }[]>([
    { inventoryItemId: '', quantity: 1, unitPrice: 0, notes: '' }
  ]);

  // Load farms
  useEffect(() => {
    farmService.getFarms().then((res: Farm[]) => {
      if (Array.isArray(res) && res.length > 0) {
        setFarms(res);
        const firstId = res[0].farmId || (res[0] as any).id;
        setSelectedFarmId(firstId);
      }
    }).catch(err => console.error(err));
  }, []);

  // Load data when selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) return;
    setLoading(true);

    Promise.all([
      zoneService.getZones().catch(() => []),
      adminService.getHardwareItems().catch(() => []),
      supportService.getInventory(selectedFarmId).catch(() => []),
      stockOutService.getList(selectedFarmId).catch(() => []),
      stockInService.getList(selectedFarmId).catch(() => [])
    ]).then(([zRes, hwRes, invRes, soRes, siRes]) => {
      const allZones = Array.isArray(zRes) ? zRes : [];
      setZones(allZones.filter((z: any) => !z.farmId || z.farmId === selectedFarmId));
      setHardwareItems(Array.isArray(hwRes) ? hwRes : []);
      setInventoryItems(Array.isArray(invRes) ? invRes : []);
      setStockOuts(Array.isArray(soRes) ? soRes : []);
      setStockIns(Array.isArray(siRes) ? siRes : []);
    }).finally(() => setLoading(false));
  }, [selectedFarmId]);

  const availableDevices = useMemo(() => {
    if (hardwareItems.length > 0) {
      return hardwareItems.map(h => ({
        id: h.id,
        name: `[${h.code}] ${h.name}${h.model ? ` - ${h.model}` : ''}`,
        rawName: h.name,
        code: h.code,
        unit: 'Cái',
        unitPrice: h.unitPrice || 0,
        quantityOnHand: h.quantityInStock,
        category: h.category
      }));
    }
    return inventoryItems.map(inv => ({
      id: inv.id,
      name: inv.name,
      rawName: inv.name,
      code: '',
      unit: inv.unit || 'Cái',
      unitPrice: 0,
      quantityOnHand: inv.quantityOnHand,
      category: ''
    }));
  }, [hardwareItems, inventoryItems]);

  const refreshList = async () => {
    if (!selectedFarmId) return;
    try {
      const [soRes, siRes, hwRes] = await Promise.all([
        stockOutService.getList(selectedFarmId).catch(() => []),
        stockInService.getList(selectedFarmId).catch(() => []),
        adminService.getHardwareItems().catch(() => [])
      ]);
      setStockOuts(Array.isArray(soRes) ? soRes : []);
      setStockIns(Array.isArray(siRes) ? siRes : []);
      setHardwareItems(Array.isArray(hwRes) ? hwRes : []);

      if (selectedStockOut) {
        const updated = await stockOutService.getById(selectedFarmId, selectedStockOut.id);
        setSelectedStockOut(updated);
      }
      if (selectedStockIn) {
        const updatedIn = await stockInService.getById(selectedFarmId, selectedStockIn.id);
        setSelectedStockIn(updatedIn);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Stock Out Handlers ───────────────────────────────────────────────────
  const handleAddItemRow = () => {
    setItemRows(prev => [...prev, { inventoryItemId: '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length <= 1) return;
    setItemRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItemRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCreateStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return;

    const validDetails = itemRows.filter(r => r.inventoryItemId && r.quantity > 0);
    if (validDetails.length === 0) {
      alert('Vui lòng chọn ít nhất một vật tư với số lượng lớn hơn 0.');
      return;
    }

    setActionLoading(true);
    try {
      await stockOutService.create(selectedFarmId, {
        zoneId: selectedZoneId || undefined,
        notes: notes.trim() || undefined,
        details: validDetails
      });
      setIsCreateModalOpen(false);
      setSelectedZoneId('');
      setNotes('');
      setItemRows([{ inventoryItemId: '', quantity: 1, notes: '' }]);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể tạo phiếu xuất kho.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (stockOutId: string, newStatus: string, reasonPrompt = false) => {
    if (!selectedFarmId) return;
    let noteText = '';
    if (reasonPrompt) {
      const input = window.prompt('Nhập ghi chú / lý do (không bắt buộc):');
      if (input === null) return;
      noteText = input;
    }

    setActionLoading(true);
    try {
      await stockOutService.updateStatus(selectedFarmId, stockOutId, newStatus, noteText);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Cập nhật trạng thái thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (stockOutId: string) => {
    if (!selectedFarmId) return;
    if (!window.confirm('Bạn có chắc muốn xóa phiếu xuất kho này? Thao tác không thể hoàn tác.')) return;

    setActionLoading(true);
    try {
      await stockOutService.delete(selectedFarmId, stockOutId);
      setIsDetailModalOpen(false);
      setSelectedStockOut(null);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể xóa phiếu xuất kho.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Stock In Handlers ────────────────────────────────────────────────────
  const handleAddInItemRow = () => {
    setInItemRows(prev => [...prev, { inventoryItemId: '', quantity: 1, unitPrice: 0, notes: '' }]);
  };

  const handleRemoveInItemRow = (index: number) => {
    if (inItemRows.length <= 1) return;
    setInItemRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleInItemChange = (index: number, field: string, value: any) => {
    setInItemRows(prev => {
      const next = [...prev];
      if (field === 'inventoryItemId') {
        const found = availableDevices.find(d => d.id === value);
        next[index] = {
          ...next[index],
          inventoryItemId: value,
          unitPrice: found?.unitPrice || 0
        };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleCreateStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return;

    const validDetails = inItemRows.filter(r => r.inventoryItemId && r.quantity > 0);
    if (validDetails.length === 0) {
      alert('Vui lòng chọn ít nhất một thiết bị với số lượng lớn hơn 0.');
      return;
    }

    setActionLoading(true);
    try {
      await stockInService.create(selectedFarmId, {
        supplierName: supplierName.trim() || undefined,
        notes: inNotes.trim() || undefined,
        details: validDetails
      });
      setIsCreateInModalOpen(false);
      setSupplierName('');
      setInNotes('');
      setInItemRows([{ inventoryItemId: '', quantity: 1, unitPrice: 0, notes: '' }]);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể tạo phiếu nhập kho.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateInStatus = async (stockInId: string, newStatus: string, reasonPrompt = false) => {
    if (!selectedFarmId) return;
    let noteText = '';
    if (reasonPrompt) {
      const input = window.prompt('Nhập ghi chú / lý do (không bắt buộc):');
      if (input === null) return;
      noteText = input;
    }

    setActionLoading(true);
    try {
      await stockInService.updateStatus(selectedFarmId, stockInId, newStatus, noteText);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Cập nhật trạng thái nhập kho thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteIn = async (stockInId: string) => {
    if (!selectedFarmId) return;
    if (!window.confirm('Bạn có chắc muốn xóa phiếu nhập kho này? Thao tác không thể hoàn tác.')) return;

    setActionLoading(true);
    try {
      await stockInService.delete(selectedFarmId, stockInId);
      setIsDetailInModalOpen(false);
      setSelectedStockIn(null);
      await refreshList();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể xóa phiếu nhập kho.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Filtered Data ────────────────────────────────────────────────────────
  const filteredStockOuts = useMemo(() => {
    return stockOuts.filter(s => {
      const matchesSearch = s.stockOutCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.zoneName && s.zoneName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const statusStr = typeof s.status === 'number'
        ? ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'][s.status] || ''
        : s.status;

      const matchesStatus = statusFilter === 'ALL' || statusStr.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [stockOuts, searchQuery, statusFilter]);

  const filteredStockIns = useMemo(() => {
    return stockIns.filter(s => {
      const matchesSearch = s.stockInCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.supplierName && s.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const statusStr = typeof s.status === 'number'
        ? ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'][s.status] || ''
        : s.status;

      const matchesStatus = statusFilter === 'ALL' || statusStr.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [stockIns, searchQuery, statusFilter]);

  const renderStatusBadge = (status: StockOutStatus | StockInStatus) => {
    const s = typeof status === 'number'
      ? ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'][status]
      : status;

    switch (s) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={13} /> Hoàn thành</span>;
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300"><CheckCircle2 size={13} /> Đã duyệt</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><Clock size={13} /> Chờ duyệt</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><XCircle size={13} /> Đã hủy</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300"><FileText size={13} /> Bản nháp</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="text-[#119653]" size={24} /> Quản lý Nhập & Xuất Kho Thiết Bị IoT (Hardware Stock)
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Lập, phê duyệt và quản lý phiếu nhập kho & xuất kho thiết bị phần cứng (Gateway, Node cảm biến, Tủ rơ-le, Phụ kiện IoT...) phục vụ thi công lắp đặt và bảo trì.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {farms.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-xs">
              <Building2 size={16} className="text-[#119653]" />
              <select
                value={selectedFarmId}
                onChange={e => setSelectedFarmId(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {farms.map(f => {
                  const fid = f.farmId || (f as any).id;
                  return <option key={fid} value={fid}>{f.name}</option>;
                })}
              </select>
            </div>
          )}

          {activeTab === 'STOCK_IN' ? (
            <Button
              onClick={() => setIsCreateInModalOpen(true)}
              className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={16} /> Tạo Phiếu Nhập Kho
            </Button>
          ) : (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={16} /> Tạo Phiếu Xuất Kho
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-3">
        <button
          onClick={() => setActiveTab('STOCK_IN')}
          className={`pb-3 px-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'STOCK_IN'
              ? 'border-[#119653] text-[#119653]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownLeft size={16} className={activeTab === 'STOCK_IN' ? 'text-[#119653]' : 'text-slate-400'} />
          <span>Phiếu Nhập Kho (Stock-In)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
            {stockIns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('STOCK_OUT')}
          className={`pb-3 px-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'STOCK_OUT'
              ? 'border-[#119653] text-[#119653]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowUpRight size={16} className={activeTab === 'STOCK_OUT' ? 'text-[#119653]' : 'text-slate-400'} />
          <span>Phiếu Xuất Kho (Stock-Out)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-800 font-semibold">
            {stockOuts.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'STOCK_IN' ? "Tìm mã phiếu, nhà cung cấp, ghi chú..." : "Tìm mã phiếu, zone, ghi chú..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#119653]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Completed">Đã hoàn thành</option>
            <option value="Approved">Đã duyệt</option>
            <option value="Pending">Chờ duyệt</option>
            <option value="Draft">Bản nháp</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* ─── TAB 1: PHIẾU NHẬP KHO (STOCK IN) ─────────────────────────────── */}
      {activeTab === 'STOCK_IN' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Đang tải danh sách phiếu nhập kho...</div>
          ) : filteredStockIns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Package size={36} className="mx-auto mb-2 text-slate-300" />
              Chưa có phiếu nhập kho nào phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                    <th className="p-3.5">Mã phiếu</th>
                    <th className="p-3.5">Nhà cung cấp / Đơn vị giao</th>
                    <th className="p-3.5">Thiết bị nhập</th>
                    <th className="p-3.5 text-right">Tổng giá trị</th>
                    <th className="p-3.5">Người lập</th>
                    <th className="p-3.5">Ngày lập</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredStockIns.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-emerald-800">{item.stockInCode}</td>
                      <td className="p-3.5 font-semibold text-slate-900 flex items-center gap-1.5">
                        <Truck size={14} className="text-slate-400 shrink-0" />
                        <span>{item.supplierName || 'Nhà cung ứng nội bộ'}</span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {item.details.length} loại ({item.totalItems || item.details.reduce((sum, d) => sum + d.quantity, 0)} cái)
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-700">
                        {item.totalAmount ? item.totalAmount.toLocaleString('vi-VN') + ' đ' : '0 đ'}
                      </td>
                      <td className="p-3.5 text-slate-600">{item.createdByName}</td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(item.createdAtUtc).toLocaleDateString('vi-VN')} {new Date(item.createdAtUtc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5">{renderStatusBadge(item.status)}</td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => { setSelectedStockIn(item); setIsDetailInModalOpen(true); }}
                          className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: PHIẾU XUẤT KHO (STOCK OUT) ────────────────────────────── */}
      {activeTab === 'STOCK_OUT' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Đang tải danh sách phiếu xuất kho...</div>
          ) : filteredStockOuts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Package size={36} className="mx-auto mb-2 text-slate-300" />
              Không có phiếu xuất kho thiết bị nào phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                    <th className="p-3.5">Mã phiếu</th>
                    <th className="p-3.5">Zone nhận thiết bị</th>
                    <th className="p-3.5">Số loại thiết bị</th>
                    <th className="p-3.5">Người lập</th>
                    <th className="p-3.5">Ngày lập</th>
                    <th className="p-3.5">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredStockOuts.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-sky-700">{item.stockOutCode}</td>
                      <td className="p-3.5 font-medium text-slate-900">{item.zoneName || 'Toàn trang trại / Kỹ thuật viên'}</td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {item.details.length} loại thiết bị ({item.details.reduce((sum, d) => sum + d.quantity, 0)} cái)
                      </td>
                      <td className="p-3.5 text-slate-600">{item.createdByName}</td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(item.createdAtUtc).toLocaleDateString('vi-VN')} {new Date(item.createdAtUtc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5">{renderStatusBadge(item.status)}</td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => { setSelectedStockOut(item); setIsDetailModalOpen(true); }}
                          className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL TẠO PHIẾU NHẬP KHO (STOCK IN) ─────────────────────────── */}
      <Modal
        isOpen={isCreateInModalOpen}
        onClose={() => setIsCreateInModalOpen(false)}
        title="Tạo Phiếu Nhập Kho Thiết Bị IoT (Hardware Stock In)"
      >
        <form onSubmit={handleCreateStockIn} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nhà cung cấp / Đơn vị giao thiết bị *</label>
            <input
              type="text"
              required
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="Ví dụ: Công ty TNHH Thiết bị IoT SmartAgri, TechFarm Đà Lạt..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ghi chú / Chứng từ nhập kho</label>
            <textarea
              value={inNotes}
              onChange={e => setInNotes(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Nhập theo hợp đồng cung ứng thiết bị #HĐ-NCC-0421, Hóa đơn VAT #0045812..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-800 font-bold">Danh sách thiết bị & phụ kiện nhập kho</label>
              <button
                type="button"
                onClick={handleAddInItemRow}
                className="text-[#119653] font-bold hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Thêm thiết bị
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {inItemRows.map((row, idx) => {
                const selectedDev = availableDevices.find(i => i.id === row.inventoryItemId);
                return (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={row.inventoryItemId}
                        onChange={e => handleInItemChange(idx, 'inventoryItemId', e.target.value)}
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-[#119653]"
                        required
                      >
                        <option value="">-- Chọn thiết bị nhập kho --</option>
                        {availableDevices.map(dev => (
                          <option key={dev.id} value={dev.id}>
                            {dev.name} (Tồn hiện tại: {dev.quantityOnHand} {dev.unit})
                          </option>
                        ))}
                      </select>

                      <div className="w-20">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="SL"
                          value={row.quantity}
                          onChange={e => handleInItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-right focus:outline-none focus:border-[#119653]"
                          required
                        />
                      </div>

                      <div className="w-32">
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          placeholder="Đơn giá (đ)"
                          value={row.unitPrice}
                          onChange={e => handleInItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-right focus:outline-none focus:border-[#119653]"
                        />
                      </div>

                      {inItemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInItemRow(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {selectedDev && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>Đơn vị: <strong>{selectedDev.unit}</strong> | Thành tiền: <strong className="text-emerald-700">{(row.quantity * row.unitPrice).toLocaleString('vi-VN')} đ</strong></span>
                        <span className="text-emerald-700 font-semibold">
                          Tồn kho sau nhập: {(selectedDev.quantityOnHand + row.quantity)} {selectedDev.unit}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs">
              <span className="font-semibold text-emerald-900">Tổng giá trị tạm tính:</span>
              <span className="font-bold text-sm text-emerald-700">
                {inItemRows.reduce((sum, r) => sum + (r.quantity * r.unitPrice), 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" onClick={() => setIsCreateInModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
              Đóng
            </Button>
            <Button type="submit" disabled={actionLoading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
              {actionLoading ? 'Đang tạo...' : 'Lưu Phiếu Nhập Kho'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL CHI TIẾT PHIẾU NHẬP KHO (STOCK IN) ────────────────────── */}
      {selectedStockIn && (
        <Modal
          isOpen={isDetailInModalOpen}
          onClose={() => setIsDetailInModalOpen(false)}
          title={`Chi tiết Phiếu Nhập Kho #${selectedStockIn.stockInCode}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <p className="text-[11px] text-slate-500">Mã phiếu nhập:</p>
                <p className="font-mono font-bold text-emerald-800">{selectedStockIn.stockInCode}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Trạng thái:</p>
                <div>{renderStatusBadge(selectedStockIn.status)}</div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Nhà cung cấp / Đơn vị:</p>
                <p className="font-semibold text-slate-800">{selectedStockIn.supplierName || 'Nội bộ'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Tổng giá trị lô hàng:</p>
                <p className="font-bold text-emerald-700">{selectedStockIn.totalAmount ? selectedStockIn.totalAmount.toLocaleString('vi-VN') + ' đ' : '0 đ'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Người lập phiếu:</p>
                <p className="font-semibold text-slate-800">{selectedStockIn.createdByName}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Thời gian tạo:</p>
                <p className="text-slate-700">{new Date(selectedStockIn.createdAtUtc).toLocaleString('vi-VN')}</p>
              </div>
              {selectedStockIn.completedAtUtc && (
                <div className="col-span-2">
                  <p className="text-[11px] text-slate-500">Đã nhập kho thực tế lúc:</p>
                  <p className="text-emerald-700 font-semibold">{new Date(selectedStockIn.completedAtUtc).toLocaleString('vi-VN')}</p>
                </div>
              )}
            </div>

            {selectedStockIn.notes && (
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                <span className="font-bold">Ghi chú chứng từ: </span>
                {selectedStockIn.notes}
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Danh mục thiết bị & linh kiện nhập kho:</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Thiết bị / Linh kiện</th>
                      <th className="p-2.5 text-right">Số lượng</th>
                      <th className="p-2.5 text-center">ĐVT</th>
                      <th className="p-2.5 text-right">Đơn giá</th>
                      <th className="p-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedStockIn.details.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-800">{d.itemName}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">{d.quantity}</td>
                        <td className="p-2.5 text-center text-slate-500">{d.unit}</td>
                        <td className="p-2.5 text-right text-slate-600">{d.unitPrice?.toLocaleString('vi-VN')} đ</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{d.totalAmount?.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {isManager && (selectedStockIn.status === 'Draft' || selectedStockIn.status === 0 || selectedStockIn.status === 'Cancelled' || selectedStockIn.status === 4) && (
                  <Button
                    onClick={() => handleDeleteIn(selectedStockIn.id)}
                    disabled={actionLoading}
                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                  >
                    <Trash2 size={14} className="mr-1" /> Xóa phiếu
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isManager && (selectedStockIn.status === 'Draft' || selectedStockIn.status === 0) && (
                  <>
                    <Button
                      onClick={() => handleUpdateInStatus(selectedStockIn.id, 'Pending')}
                      disabled={actionLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                      Gửi duyệt (Pending)
                    </Button>
                    <Button
                      onClick={() => handleUpdateInStatus(selectedStockIn.id, 'Approved')}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Duyệt ngay (Approve)
                    </Button>
                  </>
                )}

                {isManager && (selectedStockIn.status === 'Pending' || selectedStockIn.status === 1) && (
                  <>
                    <Button
                      onClick={() => handleUpdateInStatus(selectedStockIn.id, 'Cancelled', true)}
                      disabled={actionLoading}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      Từ chối / Hủy
                    </Button>
                    <Button
                      onClick={() => handleUpdateInStatus(selectedStockIn.id, 'Approved')}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Phê duyệt phiếu
                    </Button>
                  </>
                )}

                {isManager && (selectedStockIn.status === 'Approved' || selectedStockIn.status === 2) && (
                  <Button
                    onClick={() => handleUpdateInStatus(selectedStockIn.id, 'Completed')}
                    disabled={actionLoading}
                    className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={16} /> Xác nhận hoàn tất nhập kho
                  </Button>
                )}

                <Button
                  onClick={() => setIsDetailInModalOpen(false)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL TẠO PHIẾU XUẤT KHO (STOCK OUT) ─────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Phiếu Xuất Kho Thiết Bị IoT (Hardware Stock Out)"
      >
        <form onSubmit={handleCreateStockOut} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Zone nhận thiết bị lắp đặt / bảo trì (Tùy chọn)</label>
            <select
              value={selectedZoneId}
              onChange={e => setSelectedZoneId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            >
              <option value="">-- Xuất trang bị cho toàn Trang trại / Kỹ thuật viên thi công --</option>
              {zones.map(z => {
                const zid = z.zoneId || (z as any).id;
                return <option key={zid} value={zid}>{z.name}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ghi chú / Mục đích xuất kho thiết bị</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Xuất 1 Gateway LoRa và 2 Node cảm biến đất phục vụ thi công lắp đặt theo yêu cầu dịch vụ..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-800 font-bold">Danh sách thiết bị & linh kiện xuất kho</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[#119653] font-bold hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Thêm thiết bị
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {itemRows.map((row, idx) => {
                const selectedDev = availableDevices.find(i => i.id === row.inventoryItemId);
                return (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={row.inventoryItemId}
                        onChange={e => handleItemChange(idx, 'inventoryItemId', e.target.value)}
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-[#119653]"
                        required
                      >
                        <option value="">-- Chọn thiết bị trong kho Platform --</option>
                        {availableDevices.map(dev => (
                          <option key={dev.id} value={dev.id}>
                            {dev.name} (Tồn kho: {dev.quantityOnHand} {dev.unit})
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="SL"
                          value={row.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-right focus:outline-none focus:border-[#119653]"
                          required
                        />
                      </div>

                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {selectedDev && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>Đơn vị tính: <strong>{selectedDev.unit}</strong></span>
                        <span className={row.quantity > selectedDev.quantityOnHand ? 'text-rose-600 font-bold' : 'text-emerald-700 font-medium'}>
                          {row.quantity > selectedDev.quantityOnHand
                            ? `⚠️ Vượt quá tồn kho hiện có (${selectedDev.quantityOnHand})`
                            : `Tồn kho sau xuất: ${(selectedDev.quantityOnHand - row.quantity)} ${selectedDev.unit}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" onClick={() => setIsCreateModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
              Đóng
            </Button>
            <Button type="submit" disabled={actionLoading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
              {actionLoading ? 'Đang tạo...' : 'Lưu Phiếu Xuất Thiết Bị'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL CHI TIẾT PHIẾU XUẤT KHO (STOCK OUT) ────────────────────── */}
      {selectedStockOut && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Chi tiết Phiếu Xuất Kho Thiết Bị #${selectedStockOut.stockOutCode}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <p className="text-[11px] text-slate-500">Mã phiếu:</p>
                <p className="font-mono font-bold text-sky-700">{selectedStockOut.stockOutCode}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Trạng thái:</p>
                <div>{renderStatusBadge(selectedStockOut.status)}</div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Khu vực / Zone nhận:</p>
                <p className="font-semibold text-slate-800">{selectedStockOut.zoneName || 'Toàn trang trại'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Người lập phiếu:</p>
                <p className="font-semibold text-slate-800">{selectedStockOut.createdByName}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Thời gian tạo:</p>
                <p className="text-slate-700">{new Date(selectedStockOut.createdAtUtc).toLocaleString('vi-VN')}</p>
              </div>
              {selectedStockOut.completedAtUtc && (
                <div>
                  <p className="text-[11px] text-slate-500">Hoàn tất xuất kho lúc:</p>
                  <p className="text-emerald-700 font-semibold">{new Date(selectedStockOut.completedAtUtc).toLocaleString('vi-VN')}</p>
                </div>
              )}
            </div>

            {selectedStockOut.notes && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <span className="font-bold">Mục đích / Ghi chú: </span>
                {selectedStockOut.notes}
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Danh mục thiết bị & linh kiện IoT xuất kho:</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tên thiết bị / linh kiện</th>
                      <th className="p-2.5 text-right">Số lượng xuất</th>
                      <th className="p-2.5 text-center">Đơn vị</th>
                      <th className="p-2.5 text-right">Tồn kho hiện tại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-slate-200">
                    {selectedStockOut.details.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-800">{d.itemName}</td>
                        <td className="p-2.5 text-right font-bold text-sky-700">{d.quantity}</td>
                        <td className="p-2.5 text-center text-slate-500">{d.unit}</td>
                        <td className="p-2.5 text-right font-semibold text-emerald-700">{d.currentStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {isManager && (selectedStockOut.status === 'Draft' || selectedStockOut.status === 0 || selectedStockOut.status === 'Cancelled' || selectedStockOut.status === 4) && (
                  <Button
                    onClick={() => handleDelete(selectedStockOut.id)}
                    disabled={actionLoading}
                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                  >
                    <Trash2 size={14} className="mr-1" /> Xóa phiếu
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isManager && (selectedStockOut.status === 'Draft' || selectedStockOut.status === 0) && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Pending')}
                      disabled={actionLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                      Gửi duyệt (Pending)
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Approved')}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Duyệt ngay (Approve)
                    </Button>
                  </>
                )}

                {isManager && (selectedStockOut.status === 'Pending' || selectedStockOut.status === 1) && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Cancelled', true)}
                      disabled={actionLoading}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      Từ chối / Hủy
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Approved')}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Phê duyệt phiếu
                    </Button>
                  </>
                )}

                {isManager && (selectedStockOut.status === 'Approved' || selectedStockOut.status === 2) && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedStockOut.id, 'Completed')}
                    disabled={actionLoading}
                    className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={16} /> Xác nhận hoàn tất xuất kho
                  </Button>
                )}

                <Button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
