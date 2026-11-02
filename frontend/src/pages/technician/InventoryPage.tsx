import React, { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui/BaseUI';
import { supportService, adminService } from '../../services';

export const TechnicianInventoryPage: React.FC = () => {
  const [parts, setParts] = useState<any[]>([]);
  const [selectedPart, setSelectedPart] = useState<any | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [warehouseParts, setWarehouseParts] = useState<any[]>([]);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseCategory, setWarehouseCategory] = useState('ALL');
  const [warehouseStatus, setWarehouseStatus] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<Record<string, number>>({});

  useEffect(() => {
    supportService.getTechnicianSpareParts().then((items: any[]) => {
      if (Array.isArray(items)) {
        setParts(items.map((i: any) => ({
          id: i.id,
          name: i.name,
          code: i.code,
          stock: i.quantityInStock || 0,
          unit: 'Cái'
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { adminService.getHardwareItems().then((items: any[]) => setWarehouseParts((items || []).filter(i => !i.assignedTechnicianId))).catch(() => {}); }, []);

  const replenishInventory = async () => {
    const entries = Object.entries(selectedWarehouse).filter(([, quantity]) => quantity > 0);
    if (!entries.length) { alert('⚠️ Vui lòng chọn ít nhất một linh kiện.'); return; }
    try {
      await Promise.all(entries.map(([id, qty]) => adminService.assignHardwareItem(id, '', qty)));
      setNotice('Đã chuyển linh kiện từ kho trung tâm vào kho kỹ thuật viên.');
      setSelectedWarehouse({});
      const refreshed = await supportService.getTechnicianSpareParts();
      if (Array.isArray(refreshed)) setParts(refreshed.map((i: any) => ({ id: i.id, name: i.name, code: i.code, stock: i.quantityInStock || 0, unit: 'Cái' })));
    } catch { alert('❌ Không thể bổ sung linh kiện từ kho trung tâm.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-[#119653]" size={22} /> Kho Vật tư & Linh kiện Dự phòng (Spare Parts Inventory)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Quản lý linh kiện phần cứng IoT phục vụ lắp đặt mới và bảo trì sự cố.</p>
        </div>
        <Button onClick={() => setIsAdjustModalOpen(true)} className="bg-[#119653] hover:bg-emerald-700 text-white font-bold"><Plus size={16} className="mr-1.5" /> Bổ sung thiết bị</Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-semibold">
              <th className="p-4">Tên linh kiện</th>
              <th className="p-4">Mã linh kiện</th>
              <th className="p-4">Tồn kho hiện tại</th>
              <th className="p-4">Đơn vị tính</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {parts.map(sp => (
              <tr key={sp.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 font-semibold text-slate-900">{sp.name}</td>
                <td className="p-4 font-mono text-sky-700 font-semibold">{sp.code}</td>
                <td className="p-4 font-bold text-emerald-800">{sp.stock}</td>
                <td className="p-4 text-slate-500">{sp.unit}</td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => { setSelectedPart(sp); setQuantity(1); setIsAdjustModalOpen(true); }} className="text-emerald-700 font-semibold hover:underline">Chỉnh sửa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="Bổ sung thiết bị">
        {!selectedPart ? <div className="space-y-4 text-xs">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">Chọn linh kiện từ kho trung tâm để bổ sung vào kho kỹ thuật viên. Không cần chọn tên kỹ thuật viên.</div>
          <Input value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)} placeholder="Tìm linh kiện theo mã hoặc tên" />
          <div className="grid grid-cols-2 gap-2">
            <select value={warehouseCategory} onChange={e => setWarehouseCategory(e.target.value)} className="w-full border rounded-lg p-2.5"><option value="ALL">Tất cả danh mục</option><option value="GATEWAY">Gateway</option><option value="NODE_MODULE">Mô-đun nút</option><option value="SENSOR">Cảm biến</option><option value="PERIPHERAL">Thiết bị ngoại vi</option></select>
            <select value={warehouseStatus} onChange={e => setWarehouseStatus(e.target.value)} className="w-full border rounded-lg p-2.5"><option value="ALL">Tất cả trạng thái</option><option value="AVAILABLE">Có sẵn</option><option value="ISSUED">Đã cấp phát</option><option value="FIELD_INSTALLED">Đã lắp đặt</option><option value="MAINTENANCE">Đang bảo trì</option></select>
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">{warehouseParts.filter(p => (warehouseCategory === 'ALL' || String(p.category).toUpperCase() === warehouseCategory) && (warehouseStatus === 'ALL' || String(p.status || 'AVAILABLE').toUpperCase() === warehouseStatus) && `${p.code} ${p.name} ${p.serialNumber || ''} ${p.macAddress || ''}`.toLowerCase().includes(warehouseSearch.toLowerCase())).map(p => <div key={p.id} className="flex items-center justify-between gap-2 p-2"><span><strong>{p.code}</strong> - {p.name}<small className="block text-slate-500">Kho trung tâm: {p.quantityInStock} | Trạng thái: {p.status || 'Có sẵn'}</small></span><Input type="number" min={0} max={p.quantityInStock} value={selectedWarehouse[p.id] || 0} onChange={e => setSelectedWarehouse(prev => ({ ...prev, [p.id]: Math.min(p.quantityInStock, Math.max(0, Number(e.target.value) || 0)) }))} className="w-20" /></div>)}</div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="font-bold text-emerald-900 mb-2">Thiết bị đã chọn</div>
            {Object.entries(selectedWarehouse).filter(([, qty]) => qty > 0).length === 0 ? <p className="text-slate-600">Chưa chọn thiết bị nào.</p> : <ul className="space-y-1">{Object.entries(selectedWarehouse).filter(([, qty]) => qty > 0).map(([id, qty]) => { const item = warehouseParts.find(p => p.id === id); return <li key={id} className="flex justify-between"><span>{item?.code} - {item?.name}</span><strong>{qty} cái</strong></li>; })}</ul>}
          </div>
          <Button type="button" className="w-full bg-[#119653] text-white" onClick={replenishInventory}>Xác nhận bổ sung</Button>
        </div> : <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1">Linh kiện từ kho chính</label>
            <select value={selectedPart.id} onChange={e => { const part = parts.find(p => p.id === e.target.value); if (part) setSelectedPart(part); }} className="w-full border border-slate-300 rounded-lg p-2.5">
              {parts.map(part => <option key={part.id} value={part.id}>{part.code} - {part.name}</option>)}
            </select>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
            <div className="font-bold text-slate-900">{selectedPart.name}</div>
            <div className="font-mono text-sky-700">Mã linh kiện: {selectedPart.code}</div>
            <div>Tồn kho hiện tại: <strong>{selectedPart.stock} {selectedPart.unit}</strong></div>
            <div>Người thực hiện: Kỹ thuật viên hiện tại</div>
          </div>
          <div>
            <label className="block font-semibold text-slate-800 mb-1">Số lượng điều chỉnh</label>
            <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => { setNotice('Đã ghi nhận báo cáo lỗi cho ' + selectedPart.code); setIsAdjustModalOpen(false); }}>Báo cáo lỗi</Button>
            <Button type="button" variant="outline" onClick={async () => { try { await adminService.returnHardwareItem(selectedPart.id); setParts(prev => prev.filter(p => p.id !== selectedPart.id)); setNotice(`Đã trả ${quantity} ${selectedPart.unit} về kho trung tâm.`); setIsAdjustModalOpen(false); } catch { alert('❌ Không thể trả linh kiện về kho.'); } }}>Trả về kho</Button>
            <Button type="button" className="bg-[#119653] text-white" onClick={() => { setParts(prev => prev.map(p => p.id === selectedPart.id ? { ...p, stock: Math.max(0, p.stock - quantity) } : p)); setNotice(`Đã điều chỉnh ${quantity} ${selectedPart.unit} khỏi kho chính.`); setIsAdjustModalOpen(false); }}>Lưu điều chỉnh</Button>
          </div>
        </div>}
      </Modal>
      {notice && <div className="fixed bottom-5 right-5 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-xs font-semibold">{notice}</div>}
    </div>
  );
};
