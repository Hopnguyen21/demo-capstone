import React, { useState } from 'react';
import { mockEmployees, mockZones } from '../../mocks/mockData';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Users, Plus, ShieldCheck, CheckSquare, Edit, Save, CheckCircle2 } from 'lucide-react';
import { userService } from '../../services';
import { Employee } from '../../types';

export const FarmersPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [selectedZonesForEdit, setSelectedZonesForEdit] = useState<string[]>([]);
  const [newFarmer, setNewFarmer] = useState({ fullName: '', phone: '', email: '', position: 'Công nhân thực địa', assignedZones: ['zone-01'] });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await userService.createFarmer(newFarmer);
    setEmployees([...mockEmployees]);
    setIsAddModalOpen(false);
    setSuccessMsg('Đã tạo tài khoản công nhân và cấp quyền zone thành công!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenEditPermission = (emp: Employee) => {
    setEditEmployee(emp);
    setSelectedZonesForEdit([...emp.assignedZones]);
  };

  const handleSavePermission = async () => {
    if (!editEmployee) return;
    await userService.updateFarmerZones(editEmployee.employeeId, selectedZonesForEdit);
    setEmployees([...mockEmployees]);
    setEditEmployee(null);
    setSuccessMsg(`Đã cập nhật phân quyền Zone cho công nhân [${editEmployee.fullName}]!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleZonePermission = (zoneId: string) => {
    if (selectedZonesForEdit.includes(zoneId)) {
      setSelectedZonesForEdit(selectedZonesForEdit.filter(id => id !== zoneId));
    } else {
      setSelectedZonesForEdit([...selectedZonesForEdit, zoneId]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#062326] text-emerald-400 font-mono">
              FARM OWNER MANAGEMENT
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-[#062326]" size={22} /> Phân công & Phân quyền Khu vực Nông dân (Zone Scope)
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Chủ trang trại (Farm Owner) phân công Nông dân phụ trách từng Zone/Phân khu. Nông dân chỉ được phép bật/tắt thiết bị tại các Zone được phân quyền.
          </p>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)} className="font-bold">
          <Plus size={16} className="mr-1.5" /> Tạo Tài khoản Công nhân Mới
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map(emp => (
          <div key={emp.employeeId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#062326] border border-slate-200">
                  {emp.employeeCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{emp.fullName}</h3>
                <p className="text-xs text-slate-500">{emp.position}</p>
              </div>
              <StatusBadge status={emp.status} />
            </div>

            <div className="text-xs text-slate-600 space-y-1 font-mono">
              <div>SĐT: <strong className="text-slate-800">{emp.phone}</strong></div>
              <div>Email: <strong className="text-slate-800">{emp.email}</strong></div>
              <div>Ngày gia nhập: <strong className="text-slate-800">{emp.joinedAt}</strong></div>
            </div>

            {/* Assigned Zones Badge List */}
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-600" /> Phạm vi Phân quyền (Assigned Zones):
                </span>
                <span className="text-[10px] font-mono text-slate-500">{emp.assignedZones.length} Zone được gán</span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {emp.assignedZones.map(zId => {
                  const z = mockZones.find(x => x.zoneId === zId);
                  return (
                    <span key={zId} className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#062326] border border-emerald-300 text-[11px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      {z?.name || zId}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Action button */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => handleOpenEditPermission(emp)}>
                <Edit size={13} className="mr-1.5" /> Phân công / Sửa Phân quyền Zone
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add New Farmer */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Thêm Tài khoản Công nhân Thực địa Mới">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Họ và tên Công nhân *</label>
            <Input required value={newFarmer.fullName} onChange={e => setNewFarmer({ ...newFarmer, fullName: e.target.value })} placeholder="Nguyễn Văn A" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Số điện thoại *</label>
              <Input required value={newFarmer.phone} onChange={e => setNewFarmer({ ...newFarmer, phone: e.target.value })} placeholder="0909 123 456" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Email *</label>
              <Input type="email" required value={newFarmer.email} onChange={e => setNewFarmer({ ...newFarmer, email: e.target.value })} placeholder="worker@smartfarm.vn" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-2">Phân quyền Khu vực phụ trách (Zone Scope):</label>
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
              {mockZones.map(z => (
                <label key={z.zoneId} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={z.zoneId === 'zone-01'}
                    className="rounded bg-white border-slate-300 text-[#062326]"
                  />
                  <span className="font-semibold text-slate-900">{z.name}</span>
                  <span className="text-slate-400">({z.currentCrop})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>Hủy</Button>
            <Button type="submit">Khởi tạo Tài khoản & Gán Quyền</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Farmer Permissions */}
      <Modal isOpen={Boolean(editEmployee)} onClose={() => setEditEmployee(null)} title={`Phân công Phân quyền Zone cho [${editEmployee?.fullName}]`}>
        {editEmployee && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">{editEmployee.fullName} ({editEmployee.employeeCode})</div>
              <div className="text-slate-500">{editEmployee.position} • {editEmployee.phone}</div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-2">
                Đánh dấu các Khu vực Nhà màng mà công nhân được phép điều khiển:
              </label>

              <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl">
                {mockZones.map(z => {
                  const isChecked = selectedZonesForEdit.includes(z.zoneId);

                  return (
                    <label key={z.zoneId} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isChecked ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleZonePermission(z.zoneId)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-slate-900">{z.name}</span>
                          <span className="text-[11px] text-slate-500 block">{z.description}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{z.currentCrop}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditEmployee(null)}>Hủy</Button>
              <Button variant="primary" onClick={handleSavePermission}>
                <Save size={14} className="mr-1.5" /> Lưu Cấu Hình Phân Quyền
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
