import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Search, Filter, CheckCircle2, Clock, XCircle,
  FileText, ArrowDownRight, AlertCircle, Building2, Eye, Trash2
} from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { useAuth } from '@/app/providers/AuthContext';
import { farmService, supportService, stockOutService, zoneService, extractApiError } from '../../services';
import { Farm, Zone, StockOut, StockOutStatus } from '../../types';

export const StockOutsPage: React.FC = () => {
  const { role } = useAuth();
  const isManager = role === 'PLATFORM_ADMIN' || role === 'PLATFORM_TECHNICIAN';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [stockOuts, setStockOuts] = useState<StockOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStockOut, setSelectedStockOut] = useState<StockOut | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [itemRows, setItemRows] = useState<{ inventoryItemId: string; quantity: number; notes: string }[]>([
    { inventoryItemId: '', quantity: 1, notes: '' }
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

  // Load zones & inventory & stock-outs when selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) return;
    setLoading(true);

    Promise.all([
      zoneService.getZones().catch(() => []),
      supportService.getInventory(selectedFarmId).catch(() => []),
      stockOutService.getList(selectedFarmId).catch(() => [])
    ]).then(([zRes, invRes, soRes]) => {
      const allZones = Array.isArray(zRes) ? zRes : [];
      setZones(allZones.filter((z: any) => !z.farmId || z.farmId === selectedFarmId));
      setInventoryItems(Array.isArray(invRes) ? invRes : []);
      setStockOuts(Array.isArray(soRes) ? soRes : []);
    }).finally(() => setLoading(false));
  }, [selectedFarmId]);

  const refreshList = async () => {
    if (!selectedFarmId) return;
    try {
      const res = await stockOutService.getList(selectedFarmId);
      setStockOuts(Array.isArray(res) ? res : []);
      if (selectedStockOut) {
        const updated = await stockOutService.getById(selectedFarmId, selectedStockOut.id);
        setSelectedStockOut(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  // Filtered List
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

  const renderStatusBadge = (status: StockOutStatus) => {
    const s = typeof status === 'number'
      ? ['Draft', 'Pending', 'Approved', 'Completed', 'Cancelled'][status]
      : status;

    switch (s) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={13} /> Hoàn thành xuất kho</span>;
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
            <Package className="text-[#119653]" size={24} /> {isManager ? 'Quản lý Phiếu Xuất Kho (Stock Out)' : 'Lịch sử Phiếu Xuất Kho (Stock Out History)'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {isManager
              ? 'Theo dõi, phê duyệt và khấu trừ vật tư phân bón, thuốc BVTV, thiết bị phục vụ canh tác từng Zone.'
              : 'Xem lịch sử các phiếu xuất kho vật tư, phân bón, hạt giống và thiết bị phục vụ canh tác của trang trại.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {farms.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs">
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

          {isManager && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Plus size={16} /> Tạo Phiếu Xuất Kho
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã phiếu, Zone, ghi chú..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#119653]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'Pending', 'Approved', 'Completed', 'Draft', 'Cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#119653] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'ALL' ? 'Tất cả' : st === 'Pending' ? 'Chờ duyệt' : st === 'Approved' ? 'Đã duyệt' : st === 'Completed' ? 'Hoàn thành' : st === 'Draft' ? 'Nháp' : 'Đã hủy'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách phiếu xuất kho...</div>
        ) : filteredStockOuts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Package size={36} className="mx-auto text-slate-300 mb-2" />
            Không có phiếu xuất kho nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                  <th className="p-3.5">Mã phiếu</th>
                  <th className="p-3.5">Zone nhận</th>
                  <th className="p-3.5">Số loại vật tư</th>
                  <th className="p-3.5">Người tạo</th>
                  <th className="p-3.5">Ngày tạo</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredStockOuts.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{item.stockOutCode}</td>
                    <td className="p-3.5 font-medium text-slate-900">{item.zoneName || 'Toàn farm / Không gắn Zone'}</td>
                    <td className="p-3.5 font-medium text-slate-700">
                      {item.details.length} mặt hàng ({item.details.reduce((sum, d) => sum + d.quantity, 0)})
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

      {/* Modal Tạo Phiếu Xuất Kho */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Phiếu Xuất Kho (Stock Out Note)"
      >
        <form onSubmit={handleCreateStockOut} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Zone nhận vật tư (Tùy chọn)</label>
            <select
              value={selectedZoneId}
              onChange={e => setSelectedZoneId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            >
              <option value="">-- Xuất dùng chung cho toàn Farm / Không chỉ định Zone --</option>
              {zones.map(z => {
                const zid = z.zoneId || (z as any).id;
                return <option key={zid} value={zid}>{z.name}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ghi chú / Mục đích xuất kho</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Xuất phân NPK bón thúc giai đoạn sinh trưởng zone A..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-800 font-bold">Danh sách vật tư xuất kho</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[#119653] font-bold hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Thêm vật tư
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {itemRows.map((row, idx) => {
                const selectedInv = inventoryItems.find(i => i.id === row.inventoryItemId);
                return (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={row.inventoryItemId}
                        onChange={e => handleItemChange(idx, 'inventoryItemId', e.target.value)}
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:border-[#119653]"
                        required
                      >
                        <option value="">-- Chọn vật tư trong kho --</option>
                        {inventoryItems.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (Tồn: {inv.quantityOnHand} {inv.unit})
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="SL"
                          value={row.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
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

                    {selectedInv && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>Đơn vị: <strong>{selectedInv.unit}</strong></span>
                        <span className={row.quantity > selectedInv.quantityOnHand ? 'text-rose-600 font-bold' : 'text-emerald-700 font-medium'}>
                          {row.quantity > selectedInv.quantityOnHand
                            ? `⚠️ Vượt quá tồn kho (${selectedInv.quantityOnHand})`
                            : `Tồn kho sau xuất: ${(selectedInv.quantityOnHand - row.quantity).toFixed(2)}`}
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
              {actionLoading ? 'Đang tạo...' : 'Lưu Phiếu Xuất'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi Tiết Phiếu Xuất Kho */}
      {selectedStockOut && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Chi tiết Phiếu Xuất Kho #${selectedStockOut.stockOutCode}`}
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
                <p className="text-[11px] text-slate-500">Khu vực nhận:</p>
                <p className="font-semibold text-slate-800">{selectedStockOut.zoneName || 'Toàn farm'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Người tạo:</p>
                <p className="font-semibold text-slate-800">{selectedStockOut.createdByName}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Thời gian tạo:</p>
                <p className="text-slate-700">{new Date(selectedStockOut.createdAtUtc).toLocaleString('vi-VN')}</p>
              </div>
              {selectedStockOut.completedAtUtc && (
                <div>
                  <p className="text-[11px] text-slate-500">Hoàn thành lúc:</p>
                  <p className="text-emerald-700 font-semibold">{new Date(selectedStockOut.completedAtUtc).toLocaleString('vi-VN')}</p>
                </div>
              )}
            </div>

            {selectedStockOut.notes && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <span className="font-bold">Lý do / Ghi chú: </span>
                {selectedStockOut.notes}
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Danh mục vật tư xuất kho:</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tên vật tư</th>
                      <th className="p-2.5 text-right">Số lượng xuất</th>
                      <th className="p-2.5 text-center">Đơn vị</th>
                      <th className="p-2.5 text-right">Tồn kho hiện tại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
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
                      className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium"
                    >
                      Từ chối / Hủy
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Approved')}
                      disabled={actionLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Duyệt phiếu (Approve)
                    </Button>
                  </>
                )}

                {isManager && (selectedStockOut.status === 'Approved' || selectedStockOut.status === 2) && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Cancelled', true)}
                      disabled={actionLoading}
                      className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium"
                    >
                      Hủy phiếu
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(selectedStockOut.id, 'Completed')}
                      disabled={actionLoading}
                      className="bg-[#119653] hover:bg-emerald-700 text-white font-bold shadow-sm"
                    >
                      Xác nhận Xuất Kho (Trừ tồn kho)
                    </Button>
                  </>
                )}

                <Button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
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
