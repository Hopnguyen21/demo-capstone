import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, Plus, Search, Filter, DollarSign, CheckCircle2, Clock,
  AlertTriangle, XCircle, CreditCard, Calendar, Eye, Trash2, ArrowUpRight
} from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { useAuth } from '@/app/providers/AuthContext';
import { billService, zoneContractService, extractApiError } from '../../services';
import { Bill, BillStatus, ZoneContract } from '../../types';

export const BillsPage: React.FC = () => {
  const { role } = useAuth();
  const isManager = role === 'PLATFORM_ADMIN' || role === 'PLATFORM_TECHNICIAN';

  const [bills, setBills] = useState<Bill[]>([]);
  const [contracts, setContracts] = useState<ZoneContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedContractFilter, setSelectedContractFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Form State
  const [targetContractId, setTargetContractId] = useState('');
  const [billAmount, setBillAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('Chuyển khoản Ngân hàng (Bank Transfer)');
  const [billNotes, setBillNotes] = useState('');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethodSelected, setPaymentMethodSelected] = useState('Chuyển khoản Ngân hàng');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [billsData, contractsData] = await Promise.all([
        billService.getAll().catch(() => []),
        zoneContractService.getAllContracts().catch(() => [])
      ]);
      setBills(Array.isArray(billsData) ? billsData : []);
      setContracts(Array.isArray(contractsData) ? contractsData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When picking contract in Create Modal, autofill amount and default dueDate
  const handleSelectContract = (contractId: string) => {
    setTargetContractId(contractId);
    const found = contracts.find(c => c.id === contractId);
    if (found) {
      setBillAmount(found.totalContractValueVnd || 0);
      const today = new Date();
      today.setDate(today.getDate() + 30);
      setDueDate(today.toISOString().split('T')[0]);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetContractId) {
      alert('Vui lòng chọn Hợp đồng.');
      return;
    }
    if (billAmount <= 0) {
      alert('Số tiền hóa đơn phải lớn hơn 0.');
      return;
    }

    setActionLoading(true);
    try {
      await billService.createFromContract({
        contractId: targetContractId,
        amount: billAmount,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        paymentMethod,
        notes: billNotes.trim() || undefined
      });
      setIsCreateModalOpen(false);
      setTargetContractId('');
      setBillAmount(0);
      setBillNotes('');
      await loadData();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể tạo hóa đơn.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPayment = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.remainingAmount);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (paymentAmount <= 0) {
      alert('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }

    setActionLoading(true);
    try {
      await billService.recordPayment(selectedBill.id, {
        paymentAmount,
        paymentMethod: paymentMethodSelected,
        notes: paymentNotes.trim() || undefined
      });
      setIsPaymentModalOpen(false);
      setSelectedBill(null);
      await loadData();
    } catch (err) {
      alert(extractApiError(err) || 'Ghi nhận thanh toán thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBill = async (billId: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy hóa đơn này?')) return;
    setActionLoading(true);
    try {
      await billService.updateStatus(billId, 'Cancelled', 'Hủy bởi người quản lý');
      await loadData();
      if (selectedBill?.id === billId) {
        setIsDetailModalOpen(false);
      }
    } catch (err) {
      alert(extractApiError(err) || 'Không thể hủy hóa đơn.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa vĩnh viễn hóa đơn này? Thao tác không thể hoàn tác.')) return;
    setActionLoading(true);
    try {
      await billService.delete(billId);
      setIsDetailModalOpen(false);
      setSelectedBill(null);
      await loadData();
    } catch (err) {
      alert(extractApiError(err) || 'Không thể xóa hóa đơn.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchesSearch = b.billCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.lesseeName.toLowerCase().includes(searchQuery.toLowerCase());

      const statusStr = typeof b.status === 'number'
        ? ['Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'][b.status] || ''
        : b.status;

      const matchesStatus = statusFilter === 'ALL' || statusStr.toLowerCase() === statusFilter.toLowerCase();
      const matchesContract = selectedContractFilter === 'ALL' || b.contractId === selectedContractFilter;

      return matchesSearch && matchesStatus && matchesContract;
    });
  }, [bills, searchQuery, statusFilter, selectedContractFilter]);

  const renderStatusBadge = (status: BillStatus) => {
    const s = typeof status === 'number'
      ? ['Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'][status]
      : status;

    switch (s) {
      case 'Paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={13} /> Đã thanh toán</span>;
      case 'PartiallyPaid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><Clock size={13} /> Thanh toán 1 phần</span>;
      case 'Issued':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300"><CreditCard size={13} /> Chờ thanh toán</span>;
      case 'Overdue':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><AlertTriangle size={13} /> Quá hạn</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300"><XCircle size={13} /> Đã hủy</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Bản nháp</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="text-[#119653]" size={24} /> {isManager ? 'Quản lý Hóa đơn & Thu phí (Bill Management)' : 'Lịch sử Giao dịch & Hóa đơn Thu phí (Transaction History)'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {isManager
              ? 'Module hóa đơn độc lập liên kết Hợp đồng Zone: theo dõi các đợt thanh toán, công nợ và lịch sử thu tiền.'
              : 'Xem lịch sử các đợt phát hành hóa đơn, số tiền đã thanh toán và biên nhận giao dịch theo hợp đồng canh tác.'}
          </p>
        </div>

        {isManager && (
          <Button
            onClick={() => {
              setIsCreateModalOpen(true);
              if (contracts.length > 0) handleSelectContract(contracts[0].id);
            }}
            className="bg-[#119653] hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-sm self-start md:self-auto"
          >
            <Plus size={16} /> Tạo Hóa Đơn từ Hợp Đồng
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã hóa đơn, mã hợp đồng, khách hàng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          {contracts.length > 0 && (
            <div className="w-full md:w-auto flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold whitespace-nowrap">Hợp đồng:</span>
              <select
                value={selectedContractFilter}
                onChange={e => setSelectedContractFilter(e.target.value)}
                className="w-full md:w-60 p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-[#119653]"
              >
                <option value="ALL">-- Tất cả hợp đồng --</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.contractNumber} ({c.lesseeName})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#119653] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'ALL' ? 'Tất cả' : st === 'Issued' ? 'Chờ thanh toán' : st === 'PartiallyPaid' ? 'Thanh toán 1 phần' : st === 'Paid' ? 'Đã thanh toán' : st === 'Overdue' ? 'Quá hạn' : 'Đã hủy'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Đang tải danh sách hóa đơn...</div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
            Không có hóa đơn nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                  <th className="p-3.5">Mã Hóa đơn</th>
                  <th className="p-3.5">Hợp đồng liên kết</th>
                  <th className="p-3.5">Khách hàng</th>
                  <th className="p-3.5 text-right">Tổng tiền</th>
                  <th className="p-3.5 text-right">Đã thanh toán</th>
                  <th className="p-3.5 text-right">Còn lại</th>
                  <th className="p-3.5">Hạn thanh toán</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredBills.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{b.billCode}</td>
                    <td className="p-3.5 font-mono font-semibold text-slate-800">{b.contractNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{b.lesseeName}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">{b.amount.toLocaleString('vi-VN')} đ</td>
                    <td className="p-3.5 text-right font-semibold text-emerald-700">{b.paidAmount.toLocaleString('vi-VN')} đ</td>
                    <td className="p-3.5 text-right font-bold text-amber-600">
                      {b.remainingAmount > 0 ? `${b.remainingAmount.toLocaleString('vi-VN')} đ` : '0 đ'}
                    </td>
                    <td className="p-3.5 text-slate-500">{new Date(b.dueDate).toLocaleDateString('vi-VN')}</td>
                    <td className="p-3.5">{renderStatusBadge(b.status)}</td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {isManager && b.remainingAmount > 0 && b.status !== 'Cancelled' && b.status !== 5 && (
                        <button
                          onClick={() => handleOpenPayment(b)}
                          className="px-2 py-1 bg-emerald-50 text-[#119653] hover:bg-emerald-100 rounded font-bold border border-emerald-200 inline-flex items-center gap-1"
                        >
                          <CreditCard size={13} /> Thu tiền
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedBill(b); setIsDetailModalOpen(true); }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold inline-flex items-center gap-1"
                      >
                        <Eye size={13} /> Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tạo Hóa Đơn Từ Hợp Đồng */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo Hóa Đơn Mới từ Hợp Đồng"
      >
        <form onSubmit={handleCreateBill} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Chọn Hợp đồng (*)</label>
            <select
              value={targetContractId}
              onChange={e => handleSelectContract(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-medium"
              required
            >
              <option value="">-- Chọn hợp đồng đang có --</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  #{c.contractNumber} - {c.lesseeName} ({c.zoneName || 'Zone'}) - Giá trị: {c.totalContractValueVnd.toLocaleString('vi-VN')} đ
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Số tiền hóa đơn (VND) (*)</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={billAmount}
                onChange={e => setBillAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-bold text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hạn thanh toán (Due Date) (*)</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Hình thức thanh toán dự kiến</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            >
              <option value="Chuyển khoản Ngân hàng (Bank Transfer)">Chuyển khoản Ngân hàng (Bank Transfer)</option>
              <option value="Tiền mặt (Cash)">Tiền mặt (Cash)</option>
              <option value="Cổng thanh toán VNPAY">Cổng thanh toán VNPAY</option>
              <option value="Ví điện tử MoMo">Ví điện tử MoMo</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ghi chú / Diễn giải hóa đơn</label>
            <textarea
              value={billNotes}
              onChange={e => setBillNotes(e.target.value)}
              rows={2}
              placeholder="Ví dụ: Đợt 1 tiền thuê Zone 6 tháng đầu vụ..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" onClick={() => setIsCreateModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
              Đóng
            </Button>
            <Button type="submit" disabled={actionLoading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
              {actionLoading ? 'Đang tạo...' : 'Phát Hành Hóa Đơn'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Thu Tiền / Ghi Nhận Thanh Toán */}
      {selectedBill && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`Ghi Nhận Thanh Toán Hóa Đơn #${selectedBill.billCode}`}
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Hợp đồng:</span>
                <span className="font-mono font-bold text-slate-800">{selectedBill.contractNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-semibold text-slate-900">{selectedBill.lesseeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng hóa đơn:</span>
                <span className="font-bold text-slate-900">{selectedBill.amount.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Đã thanh toán trước đó:</span>
                <span className="font-semibold text-emerald-700">{selectedBill.paidAmount.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="font-bold text-amber-700">Còn lại phải thu:</span>
                <span className="font-black text-amber-700">{selectedBill.remainingAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-semibold">Số tiền thanh toán đợt này (VND) (*)</label>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(selectedBill.remainingAmount)}
                  className="text-[11px] text-[#119653] font-bold hover:underline"
                >
                  Trả hết toàn bộ ({selectedBill.remainingAmount.toLocaleString('vi-VN')} đ)
                </button>
              </div>
              <input
                type="number"
                min="1000"
                step="1000"
                max={selectedBill.remainingAmount}
                value={paymentAmount}
                onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653] font-black text-base text-emerald-700"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Phương thức thanh toán</label>
              <select
                value={paymentMethodSelected}
                onChange={e => setPaymentMethodSelected(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
              >
                <option value="Chuyển khoản Ngân hàng (Bank Transfer)">Chuyển khoản Ngân hàng</option>
                <option value="Tiền mặt (Cash)">Tiền mặt (Cash)</option>
                <option value="VNPAY">Cổng VNPAY</option>
                <option value="MoMo">Ví MoMo</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Mã tham chiếu / Ghi chú thanh toán</label>
              <input
                type="text"
                placeholder="Ví dụ: Mã GD ngân hàng FT2611..., Ủy nhiệm chi..."
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#119653]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button type="button" onClick={() => setIsPaymentModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                Đóng
              </Button>
              <Button type="submit" disabled={actionLoading} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold">
                {actionLoading ? 'Đang lưu...' : 'Xác Nhận Đã Thu Tiền'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Chi Tiết Hóa Đơn */}
      {selectedBill && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Hóa Đơn Thu Tiền #${selectedBill.billCode}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-emerald-800 uppercase">Hóa Đơn Hợp Đồng Canh Tác</p>
                  <p className="font-mono text-lg font-black text-slate-900 mt-0.5">{selectedBill.billCode}</p>
                </div>
                <div>{renderStatusBadge(selectedBill.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-emerald-200 text-xs">
                <div>
                  <span className="text-slate-500">Hợp đồng: </span>
                  <span className="font-mono font-bold text-slate-900">{selectedBill.contractNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">Khách hàng: </span>
                  <span className="font-bold text-slate-900">{selectedBill.lesseeName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ngày phát hành: </span>
                  <span className="font-semibold text-slate-800">{new Date(selectedBill.issueDate).toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Hạn thanh toán: </span>
                  <span className="font-semibold text-slate-800">{new Date(selectedBill.dueDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <p className="text-[11px] text-slate-500">Tổng hóa đơn</p>
                <p className="text-sm font-black text-slate-900 mt-1">{selectedBill.amount.toLocaleString('vi-VN')} đ</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                <p className="text-[11px] text-emerald-700">Đã thanh toán</p>
                <p className="text-sm font-black text-emerald-800 mt-1">{selectedBill.paidAmount.toLocaleString('vi-VN')} đ</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <p className="text-[11px] text-amber-700">Còn lại</p>
                <p className="text-sm font-black text-amber-800 mt-1">{selectedBill.remainingAmount.toLocaleString('vi-VN')} đ</p>
              </div>
            </div>

            {selectedBill.notes && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                <p className="font-bold text-slate-900 mb-1">Nhật ký & Ghi chú thanh toán:</p>
                <p className="whitespace-pre-wrap">{selectedBill.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="space-x-2">
                {isManager && (selectedBill.status === 'Draft' || selectedBill.status === 'Cancelled' || selectedBill.status === 5) && (
                  <Button
                    onClick={() => handleDeleteBill(selectedBill.id)}
                    disabled={actionLoading}
                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold"
                  >
                    <Trash2 size={14} className="mr-1" /> Xóa hóa đơn
                  </Button>
                )}
                {isManager && selectedBill.status !== 'Cancelled' && selectedBill.status !== 'Paid' && selectedBill.status !== 3 && selectedBill.status !== 5 && (
                  <Button
                    onClick={() => handleCancelBill(selectedBill.id)}
                    disabled={actionLoading}
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                  >
                    Hủy hóa đơn
                  </Button>
                )}
              </div>

              <div className="space-x-2">
                {isManager && selectedBill.remainingAmount > 0 && selectedBill.status !== 'Cancelled' && selectedBill.status !== 5 && (
                  <Button
                    onClick={() => { setIsDetailModalOpen(false); handleOpenPayment(selectedBill); }}
                    className="bg-[#119653] hover:bg-emerald-700 text-white font-bold"
                  >
                    <CreditCard size={14} className="mr-1" /> Thu Tiền Ngay
                  </Button>
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

