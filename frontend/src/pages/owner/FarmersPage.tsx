import React, { useState } from 'react';
import { mockEmployees, mockZones } from '../../mocks/mockData';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Users, Plus, ShieldCheck, CheckSquare } from 'lucide-react';
import { userService } from '../../services';

export const FarmersPage: React.FC = () => {
  const [employees, setEmployees] = useState(mockEmployees);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ fullName: '', phone: '', email: '', position: 'Công nhân thực địa', assignedZones: ['zone-01'] });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await userService.createFarmer(newFarmer);
    setEmployees([...mockEmployees]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-[#062326]" size={22} /> Quản lý Công nhân & Phân quyền Khu vực (Farmers Scope)
          </h1>
          <p className="text-xs text-slate-600 mt-1">Danh sách nhân sự thực địa thuộc Tenant và gán quyền truy cập Nhà màng/Zone.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Tạo Tài khoản Công nhân Mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map(emp => (
          <div key={emp.employeeId} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#062326] border border-slate-200">
                  {emp.employeeCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{emp.fullName}</h3>
                <p className="text-xs text-slate-500">{emp.position}</p>
              </div>
              <StatusBadge status={emp.status} />
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>SĐT: <strong className="text-slate-800">{emp.phone}</strong></div>
              <div>Email: <strong className="text-slate-800">{emp.email}</strong></div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
              <span className="text-slate-500 block font-semibold text-[10px] uppercase">Khu vực được phân quyền (Zone Scope):</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {emp.assignedZones.map(zId => {
                  const z = mockZones.find(x => x.zoneId === zId);
                  return (
                    <span key={zId} className="px-2 py-0.5 rounded bg-emerald-50 text-[#062326] border border-emerald-200 text-[11px] font-semibold">
                      {z?.name || zId}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm Công nhân & Phân quyền Zone">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Họ và tên Công nhân</label>
            <Input required value={newFarmer.fullName} onChange={e => setNewFarmer({ ...newFarmer, fullName: e.target.value })} placeholder="Trần Văn C" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Số điện thoại</label>
              <Input required value={newFarmer.phone} onChange={e => setNewFarmer({ ...newFarmer, phone: e.target.value })} placeholder="0909 123 456" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Email</label>
              <Input type="email" required value={newFarmer.email} onChange={e => setNewFarmer({ ...newFarmer, email: e.target.value })} placeholder="worker@smartfarm.vn" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Phân quyền Khu vực Nhà màng (Zone Scope Checkboxes):</label>
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              {mockZones.map(z => (
                <label key={z.zoneId} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input type="checkbox" defaultChecked={z.zoneId === 'zone-01'} className="rounded bg-white border-slate-300 text-[#062326]" />
                  <span>{z.name} ({z.currentCrop})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="submit">Lưu Công nhân & Phân quyền</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
