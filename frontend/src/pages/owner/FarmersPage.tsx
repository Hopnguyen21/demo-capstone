import React, { useState, useEffect, useCallback } from 'react';
import { StatusBadge, Button, Input, Modal } from '../../components/ui/BaseUI';
import { Users, UserPlus, ShieldCheck, Edit, Save, CheckCircle2, AlertTriangle, Mail, RefreshCw, XCircle, Clock } from 'lucide-react';
import { userService, farmInvitationService } from '../../services';
import { extractApiError } from '../../services/api';
import { useAuth } from '@/app/providers/AuthContext';
import { Employee, FarmInvitation, FarmInvitationStatus } from '../../types';

const INVITATION_LABEL: Record<FarmInvitationStatus, { text: string; style: string }> = {
  Pending: { text: 'Đang chờ phản hồi', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  Accepted: { text: 'Đã chấp nhận', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Declined: { text: 'Đã từ chối', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  Cancelled: { text: 'Đã hủy', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  Expired: { text: 'Đã hết hạn', style: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const formatDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—');

type ZoneAccessDraft = Record<string, { access: boolean; canControl: boolean }>;

export const FarmersPage: React.FC = () => {
  const { zones: allZones, selectedFarmId, setSelectedFarmId, farms } = useAuth();
  const selectedFarm = (farms as any[]).find((x: any) => x.farmId === selectedFarmId);
  // Chỉ Zone của Farm đang chọn: API chỉ cho cấp quyền Zone trong đúng Farm của Farmer.
  const zones = (allZones as any[]).filter((z: any) => z.farmId === selectedFarmId);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invitations, setInvitations] = useState<FarmInvitation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneAccessDraft>({});
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [isSavingZones, setIsSavingZones] = useState(false);

  const flash = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const load = useCallback(async () => {
    if (!selectedFarmId) return;
    try {
      const [members, invites] = await Promise.all([userService.getFarmers(), farmInvitationService.listForFarm(selectedFarmId)]);
      // Chỉ nhân công thuộc Farm đang chọn.
      setEmployees(Array.isArray(members) ? members.filter((m: any) => (m.assignedFarms ?? []).includes(selectedFarmId)) : []);
      setInvitations(Array.isArray(invites) ? invites : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(extractApiError(err));
    }
  }, [selectedFarmId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      await farmInvitationService.invite(selectedFarmId, inviteEmail.trim());
      setIsInviteOpen(false);
      setInviteEmail('');
      await load();
      window.dispatchEvent(new Event('notification-refresh'));
      flash('Đã gửi lời mời bằng thông báo trong ứng dụng. Farmer sẽ xuất hiện trong danh sách nhân công sau khi chấp nhận.');
    } catch (err) {
      // Giữ nguyên form để chủ trang trại sửa email; hiện đúng lý do backend trả về.
      setInviteError(extractApiError(err));
    } finally {
      setIsInviting(false);
    }
  };

  const runInvitationAction = async (invitationId: string, action: 'resend' | 'cancel') => {
    setBusyInvitationId(invitationId);
    try {
      if (action === 'resend') await farmInvitationService.resend(invitationId);
      else await farmInvitationService.cancel(invitationId);
      await load();
      flash(action === 'resend' ? 'Đã gửi lại lời mời.' : 'Đã hủy lời mời.');
    } catch (err) {
      setLoadError(extractApiError(err));
    } finally {
      setBusyInvitationId(null);
    }
  };

  const openZoneEditor = (emp: Employee) => {
    const draft: ZoneAccessDraft = {};
    zones.forEach((z: any) => {
      const existing = emp.zoneAccess?.find(a => a.zoneId === z.zoneId);
      draft[z.zoneId] = { access: Boolean(existing), canControl: Boolean(existing?.canControl) };
    });
    setZoneDraft(draft);
    setZoneError(null);
    setEditEmployee(emp);
  };

  const saveZones = async () => {
    if (!editEmployee) return;
    setIsSavingZones(true);
    setZoneError(null);
    try {
      const access = Object.entries(zoneDraft).filter(([, v]) => v.access).map(([zoneId, v]) => ({ zoneId, canControl: v.canControl }));
      await userService.updateFarmerZones(editEmployee.employeeId, access);
      await load();
      setEditEmployee(null);
      flash(`Đã cập nhật quyền Zone cho [${editEmployee.fullName}].`);
    } catch (err) {
      setZoneError(extractApiError(err));
    } finally {
      setIsSavingZones(false);
    }
  };

  const pending = invitations.filter(i => i.status === 'Pending');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-[#119653]" size={22} /> Quản lý Nhân công
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Mời Farmer đã đăng ký tài khoản vào trang trại bằng email. Farmer phải chấp nhận lời mời mới trở thành nhân công. Quyền truy cập và quyền điều khiển Zone được cấp riêng.
          </p>
        </div>
        <Button onClick={() => { setInviteError(null); setIsInviteOpen(true); }} className="font-bold" disabled={!selectedFarmId}>
          <UserPlus size={16} className="mr-1.5" /> Thêm nhân công vào {selectedFarm?.name ? `“${selectedFarm.name}”` : 'nông trại'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs">
        <label className="font-bold text-slate-700">Nông trại:</label>
        <select
          value={selectedFarmId}
          onChange={e => setSelectedFarmId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        >
          <option value="">-- Chọn nông trại --</option>
          {(farms as any[]).map((x: any) => <option key={x.farmId} value={x.farmId}>{x.name}</option>)}
        </select>
        {selectedFarm && <span className="text-slate-500">{employees.length} nhân công • {zones.length} Zone</span>}
      </div>

      {!selectedFarmId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">Hãy chọn một nông trại để quản lý nhân công.</div>
      )}
      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" /> <span>{loadError}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> <span>{successMsg}</span>
        </div>
      )}

      {/* Lời mời */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Mail size={16} className="text-[#119653]" /> Lời mời tham gia ({pending.length} đang chờ)
        </h2>
        {invitations.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có lời mời nào. Bấm "Mời Farmer bằng email" để bắt đầu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 text-[10px] uppercase border-b border-slate-100">
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Trạng thái</th>
                  <th className="pb-2">Gửi lúc</th>
                  <th className="pb-2">Hết hạn</th>
                  <th className="pb-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map(inv => (
                  <tr key={inv.id}>
                    <td className="py-2 font-semibold text-slate-800">{inv.email}</td>
                    <td className="py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${INVITATION_LABEL[inv.status].style}`}>{INVITATION_LABEL[inv.status].text}</span>
                    </td>
                    <td className="py-2 text-slate-600">{formatDateTime(inv.lastSentAtUtc)} <span className="text-slate-400">({inv.sendCount} lần)</span></td>
                    <td className="py-2 text-slate-600"><Clock size={11} className="inline mr-1 text-slate-400" />{formatDateTime(inv.expiresAtUtc)}</td>
                    <td className="py-2 text-right space-x-1.5">
                      {inv.status === 'Pending' && (
                        <>
                          <Button size="sm" variant="outline" disabled={busyInvitationId === inv.id} onClick={() => runInvitationAction(inv.id, 'resend')}>
                            <RefreshCw size={12} className="mr-1" /> Gửi lại
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busyInvitationId === inv.id} onClick={() => runInvitationAction(inv.id, 'cancel')}>
                            <XCircle size={12} className="mr-1" /> Hủy
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nhân công đã tham gia */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Nhân công đã tham gia ({employees.length})</h2>
        {employees.length === 0 ? (
          <div className="p-5 bg-white border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
            Chưa có nhân công nào. Mời Farmer bằng email; họ sẽ xuất hiện ở đây sau khi chấp nhận lời mời.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employees.map(emp => {
              // Chỉ quyền Zone thuộc Farm đang chọn (quyền cũ ngoài Farm không hiển thị).
              const access = (emp.zoneAccess ?? []).filter(a => zones.some((x: any) => x.zoneId === a.zoneId));
              return (
                <div key={emp.employeeId} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{emp.fullName}</h3>
                      <p className="text-xs text-slate-500">{emp.email}{emp.phone ? ` · ${emp.phone}` : ''}</p>
                      {selectedFarm && <p className="text-[11px] text-emerald-700 font-semibold">Nông trại: {selectedFarm.name}</p>}
                    </div>
                    <StatusBadge status={emp.status} />
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-600" /> Quyền theo Zone
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{access.length} Zone</span>
                    </div>
                    {access.length === 0 ? (
                      <p className="text-[11px] text-amber-700">Chưa có quyền Zone nào, nên chưa thể được giao việc ở bất kỳ Zone nào.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {access.map(a => {
                          const z = zones.find((x: any) => x.zoneId === a.zoneId);
                          return (
                            <span key={a.zoneId} className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${a.canControl ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                              {z?.name || a.zoneId.substring(0, 8)} · {a.canControl ? 'điều khiển' : 'xem & nhận việc'}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => openZoneEditor(emp)}>
                      <Edit size={13} className="mr-1.5" /> Sửa quyền Zone
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mời bằng email */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title={`Mời Farmer vào ${selectedFarm?.name ?? 'trang trại'}`}>
        <form onSubmit={handleInvite} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Nhập email của tài khoản Farmer đã đăng ký. Hệ thống gửi lời mời bằng thông báo trong ứng dụng; Farmer chấp nhận thì mới trở thành nhân công. Chấp nhận lời mời không tự cấp quyền Zone.
          </p>
          <div>
            <label className="block text-slate-700 font-bold mb-1">Email của Farmer *</label>
            <Input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="farmer@example.com" />
          </div>
          {inviteError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{inviteError}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsInviteOpen(false)}>Hủy</Button>
            <Button type="submit" disabled={isInviting}>{isInviting ? 'Đang gửi…' : 'Gửi lời mời'}</Button>
          </div>
        </form>
      </Modal>

      {/* Quyền Zone */}
      <Modal isOpen={Boolean(editEmployee)} onClose={() => setEditEmployee(null)} title={`Quyền Zone của [${editEmployee?.fullName}]`}>
        {editEmployee && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              "Xem & nhận việc" cho phép Farmer thấy Zone và được giao việc tại Zone. "Điều khiển thiết bị" là quyền riêng, chỉ bật khi thật cần.
            </p>
            <div className="space-y-2 p-3 bg-white border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
              {zones.map((z: any) => {
                const draft = zoneDraft[z.zoneId] ?? { access: false, canControl: false };
                return (
                  <div key={z.zoneId} className={`p-2.5 rounded-lg border ${draft.access ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="font-bold text-slate-900">{z.name}</div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
                      <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.access}
                          onChange={e => setZoneDraft(prev => ({ ...prev, [z.zoneId]: { access: e.target.checked, canControl: e.target.checked ? prev[z.zoneId]?.canControl ?? false : false } }))}
                        />
                        Xem & nhận việc
                      </label>
                      <label className={`flex items-center gap-1.5 ${draft.access ? 'text-amber-900 cursor-pointer' : 'text-slate-400'}`}>
                        <input
                          type="checkbox"
                          disabled={!draft.access}
                          checked={draft.canControl}
                          onChange={e => setZoneDraft(prev => ({ ...prev, [z.zoneId]: { access: true, canControl: e.target.checked } }))}
                        />
                        Điều khiển thiết bị
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {zoneError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{zoneError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditEmployee(null)}>Hủy</Button>
              <Button variant="primary" onClick={saveZones} disabled={isSavingZones}>
                <Save size={14} className="mr-1.5" /> {isSavingZones ? 'Đang lưu…' : 'Lưu quyền Zone'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
