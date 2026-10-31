import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { farmInvitationService } from '../../services';
import { extractApiError, refreshSessionToken } from '../../services/api';
import { Button } from '../../components/ui/BaseUI';
import { Mail, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { FarmInvitation } from '../../types';

/** Farmer xem và phản hồi lời mời tham gia nhân công của Farm. Chấp nhận lời mời không tự cấp quyền Zone. */
export const FarmerInvitationsPage: React.FC = () => {
  const { refreshFarmsAndZones } = useAuth();
  const [invitations, setInvitations] = useState<FarmInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await farmInvitationService.mine();
      setInvitations(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invitation: FarmInvitation, accept: boolean) => {
    setBusyId(invitation.id);
    setError(null);
    try {
      if (accept) {
        await farmInvitationService.accept(invitation.id);
        // Token cũ chưa có thông tin trang trại: làm mới phiên rồi nạp lại trang trại/Zone.
        await refreshSessionToken();
        await refreshFarmsAndZones();
        setMessage(`Bạn đã tham gia ${invitation.farmName}. Hãy chờ chủ trang trại cấp quyền Zone trước khi được giao việc.`);
      } else {
        await farmInvitationService.decline(invitation.id);
        setMessage('Đã từ chối lời mời.');
      }
      window.dispatchEvent(new Event('notification-refresh'));
      await load();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Mail className="text-[#119653]" size={22} /> Lời mời tham gia Farm
        </h1>
        <p className="text-xs text-slate-500 mt-1">Lời mời gửi tới email tài khoản của bạn. Chỉ khi bạn chấp nhận mới trở thành nhân công của trang trại.</p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" /> <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" /> <span>{error}</span>
        </div>
      )}
      {loading && invitations.length === 0 && <p className="text-xs text-slate-500">Đang tải…</p>}
      {!loading && invitations.length === 0 && !error && (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">Bạn không có lời mời nào đang chờ.</div>
      )}

      <div className="space-y-3">
        {invitations.map(inv => (
          <div key={inv.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{inv.farmName || 'Trang trại'}</h3>
              <p className="text-slate-500 mt-0.5 flex items-center gap-1"><Clock size={12} /> Hết hạn lúc {new Date(inv.expiresAtUtc).toLocaleString('vi-VN')}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="ghost" disabled={busyId === inv.id} onClick={() => respond(inv, false)}>Từ chối</Button>
              <Button size="sm" disabled={busyId === inv.id} onClick={() => respond(inv, true)}>Chấp nhận</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
