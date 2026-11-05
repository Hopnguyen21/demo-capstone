import React from 'react';
import { mockInventory } from '../../mocks/mockData';
import { Package, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';

export const OwnerInventoryPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-[#062326]" size={22} /> Kho Vật tư Nông nghiệp (Farm Material Stock)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Quản lý tồn kho phân bón, hạt giống, thuốc sinh học và cảnh báo dưới định mức.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Nhập thêm Vật tư</Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-semibold">
              <th className="p-4">Tên vật tư</th>
              <th className="p-4">Mã số</th>
              <th className="p-4">Phân loại</th>
              <th className="p-4">Tồn kho hiện tại</th>
              <th className="p-4">Vị trí lưu kho</th>
              <th className="p-4 text-right">Trạng thái Tồn kho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {mockInventory.map(inv => {
              const isLow = inv.quantity < inv.minimumStock;
              return (
                <tr key={inv.inventoryId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-semibold text-slate-900">{inv.materialName}</td>
                  <td className="p-4 font-mono text-[#062326] font-semibold">{inv.code}</td>
                  <td className="p-4 font-mono text-slate-600">{inv.category}</td>
                  <td className="p-4 font-bold text-slate-900">{inv.quantity} {inv.unit}</td>
                  <td className="p-4 text-slate-500">{inv.storageLocation}</td>
                  <td className="p-4 text-right">
                    {isLow ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle size={12} className="mr-1" /> Sắp hết hàng
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-[#062326] border border-emerald-200">
                        Đủ định mức
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
