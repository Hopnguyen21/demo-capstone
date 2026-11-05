import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Button } from '../../components/ui/BaseUI';

export const TechnicianInventoryPage: React.FC = () => {
  const spareParts = [
    { id: '1', name: 'Mạch Gateway ESP32 SX1278 433MHz', code: 'SP-GW-01', stock: 12, unit: 'Bộ' },
    { id: '2', name: 'Node LoRa Cảm biến Đất & Khi hậu', code: 'SP-NODE-01', stock: 25, unit: 'Cái' },
    { id: '3', name: 'Cảm biến Độ ẩm đất RS485 Chống ăn mòn', code: 'SP-SEN-SM', stock: 40, unit: 'Cái' },
    { id: '4', name: 'Mạch Relay 4 Kênh Cách ly Quang', code: 'SP-RELAY-4CH', stock: 18, unit: 'Cái' },
    { id: '5', name: 'Pin Lithium 3.7V 5000mAh Solar Grade', code: 'SP-BAT-37V', stock: 30, unit: 'Viên' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-[#062326]" size={22} /> Kho Vật tư & Linh kiện Dự phòng (Spare Parts Inventory)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Quản lý linh kiện phần cứng IoT phục vụ lắp đặt mới và bảo trì sự cố.</p>
        </div>
        <Button><Plus size={16} className="mr-1.5" /> Nhập thêm Linh kiện</Button>
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
            {spareParts.map(sp => (
              <tr key={sp.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 font-semibold text-slate-900">{sp.name}</td>
                <td className="p-4 font-mono text-sky-700 font-semibold">{sp.code}</td>
                <td className="p-4 font-bold text-[#062326]">{sp.stock}</td>
                <td className="p-4 text-slate-500">{sp.unit}</td>
                <td className="p-4 text-right space-x-2">
                  <button className="text-[#062326] font-semibold hover:underline">Xuất kho</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
