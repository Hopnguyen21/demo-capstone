import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { UserRole, Alert } from '../../types';
import { alertService, supportService, notificationService, NotificationItem, isAuthenticated, zoneContractService } from '../../services';
import {
  Sprout, Bell, UserCheck, LogOut,
  ChevronDown, CheckCircle2, Check, ExternalLink, Clock
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const { user, role, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationMenu(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotificationMenu(false);
        setShowRoleMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchNotifications = async () => {
    if (!isAuthenticated()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [list, count, expContracts] = await Promise.all([
        notificationService.getNotifications(undefined, 1, 15).catch(() => []),
        notificationService.getUnreadCount().catch(() => 0),
        zoneContractService.getExpiringContracts(undefined, 30).catch(() => []),
      ]);

      // Deduplicate contracts by contractNumber and only show actively expiring ones (0 to 30 days)
      const validContracts = Array.from(
        new Map(
          (expContracts || [])
            .filter((c: any) => c.daysRemaining >= 0 && c.daysRemaining <= 30)
            .map((c: any) => [c.contractNumber || c.contractId, c])
        ).values()
      );

      const contractNotifs: NotificationItem[] = validContracts.map((c: any) => ({
        notificationId: `contract-${c.contractId}`,
        userId: user?.userId || '',
        title: `⚠️ Hợp đồng [${c.contractNumber}] sắp hết hạn`,
        message: `Phân khu: ${c.zoneName} (${c.farmName}). Hạn kết thúc: ${c.endDate} (còn ${c.daysRemaining} ngày). Nhấn để gia hạn ngay.`,
        type: 'Alert' as const,
        severity: c.daysRemaining <= 7 ? 'Critical' : 'Warning',
        isRead: false,
        createdAtUtc: new Date().toISOString(),
        targetUrl: '/owner/farms',
      }));

      const combined = [...contractNotifs, ...(list || [])];
      setNotifications(combined);
      setUnreadCount(count + contractNotifs.length);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    const handleRefresh = () => fetchNotifications();
    window.addEventListener('notification-refresh', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-refresh', handleRefresh);
    };
  }, [user]);

  useEffect(() => {
    alertService.getAlerts().then(res => {
      if (res) setAlerts(res);
    }).catch(() => {});
  }, []);

  const handleRoleSwitch = (targetRole: UserRole) => {
    switchRole(targetRole);
    setShowRoleMenu(false);
    switch (targetRole) {
      case 'PLATFORM_ADMIN':
        navigate('/admin/dashboard');
        break;
      case 'PLATFORM_TECHNICIAN':
        navigate('/technician/dashboard');
        break;
      case 'FARM_OWNER':
        navigate('/owner/dashboard');
        break;
      case 'FARMER':
        navigate('/farmer/home');
        break;
      default:
        navigate('/owner/dashboard');
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'OPEN');

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    PLATFORM_ADMIN: { label: 'Platform Admin', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    PLATFORM_TECHNICIAN: { label: 'Technician', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    FARM_OWNER: { label: 'Farm Owner', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    FARMER: { label: 'Farm Worker', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[#119653] text-white border-b border-[#0e8046] px-4 flex items-center justify-between shadow-md">
      {/* Left section: Logo & Farm Selector */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/20 border border-white/30 text-white shadow-xs">
            <Sprout size={22} />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              SmartFarm <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#0e8046] text-white border border-white/30">AI Cloud</span>
            </span>
            <p className="text-[10px] text-emerald-100/90 hidden sm:block">Nền tảng Nông nghiệp Thông minh</p>
          </div>
        </div>


      </div>

      {/* Right section: Weather, Notifications, Dev Role Switcher, Profile */}
      <div className="flex items-center gap-3">


        {/* Notifications Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            className="relative p-2 rounded-lg bg-[#0e8046] border border-[#14a85e] text-white hover:bg-[#0c733f] transition-colors"
            title="Thông báo"
          >
            <Bell size={17} />
            {(unreadCount > 0 || activeAlerts.length > 0) && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 0 ? unreadCount : activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationMenu && (
            <div className="absolute right-0 mt-2 w-[420px] sm:w-[460px] max-w-[92vw] bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-4 z-50 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-emerald-50 text-[#119653]">
                    <Bell size={16} />
                  </div>
                  Thông báo & Cảnh báo
                  {unreadCount > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                      {unreadCount} mới
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      await notificationService.markAllAsRead();
                      fetchNotifications();
                    }}
                    className="text-xs text-[#119653] font-semibold hover:underline flex items-center gap-1 hover:text-[#0c733f] transition-colors"
                  >
                    <Check size={13} /> Đã đọc tất cả
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {/* Real Notifications from Backend */}
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.notificationId}
                      onClick={async () => {
                        if (!n.isRead && !n.notificationId.startsWith('contract-')) {
                          await notificationService.markAsRead(n.notificationId).catch(() => null);
                        }
                        setShowNotificationMenu(false);
                        if (n.targetUrl) navigate(n.targetUrl);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-sm ${
                        n.isRead
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-80'
                          : 'bg-emerald-50/40 border-emerald-200/90 font-medium'
                      } hover:bg-emerald-50/80`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-900 text-[13px] leading-snug">{n.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 uppercase tracking-wider ${
                            n.severity === 'Critical'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : n.severity === 'Warning'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {n.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{n.message}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-1 border-t border-slate-100/80">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(n.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(n.createdAtUtc).toLocaleDateString()}
                        </span>
                        {n.targetUrl ? (
                          <span className="text-[#119653] font-bold text-[10px] flex items-center gap-1 hover:underline">
                            Mở đối tượng <ExternalLink size={10} />
                          </span>
                        ) : !n.isRead ? (
                          <span className="text-[#119653] font-bold text-[10px] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#119653]"></span>Mới</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback to system alerts if notifications table has no items yet */
                  alerts.length > 0 ? (
                    alerts.map((a) => (
                      <div key={a.alertId} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between font-semibold text-rose-600">
                          <span>{a.title}</span>
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-medium">{a.severity}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{a.message}</p>
                        <span className="text-[9px] text-slate-400 block mt-1">{a.triggeredAt}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">Không có thông báo nào</div>
                  )
                )}
              </div>

              {/* Footer: View All Alerts */}
              <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Hiển thị {notifications.length} cảnh báo gần nhất</span>
                <button
                  onClick={() => {
                    setShowNotificationMenu(false);
                    navigate(role === 'FARMER' ? '/farmer/alerts' : '/owner/alerts');
                  }}
                  className="text-xs font-semibold text-[#119653] hover:underline flex items-center gap-1 hover:text-[#0c733f] transition-colors"
                >
                  Xem tất cả cảnh báo <ExternalLink size={11} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dev Quick Role Switcher */}
        <div className="relative" ref={roleMenuRef}>
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-all ${roleLabels[role].color}`}
          >
            <UserCheck size={14} />
            <span className="hidden md:inline">{roleLabels[role].label}</span>
            <ChevronDown size={12} />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-slate-800">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 mb-1">
                Chuyển nhanh vai trò (Dev Role Switcher)
              </div>
              <button
                onClick={() => handleRoleSwitch('PLATFORM_ADMIN')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-rose-50 text-rose-700 flex items-center justify-between"
              >
                <span>1. Platform Admin</span>
                {role === 'PLATFORM_ADMIN' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => handleRoleSwitch('PLATFORM_TECHNICIAN')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-sky-50 text-sky-700 flex items-center justify-between"
              >
                <span>2. Platform Technician</span>
                {role === 'PLATFORM_TECHNICIAN' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => handleRoleSwitch('FARM_OWNER')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-50 text-emerald-700 flex items-center justify-between"
              >
                <span>3. Farm Owner (Tenant Root)</span>
                {role === 'FARM_OWNER' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => handleRoleSwitch('FARMER')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-50 text-amber-700 flex items-center justify-between"
              >
                <span>4. Farmer / Farm Worker</span>
                {role === 'FARMER' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
            </div>
          )}
        </div>

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-white/20">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-semibold leading-tight text-white max-w-[140px] truncate">{user?.fullName || 'Người dùng'}</span>
            <span className="text-[10px] text-emerald-100/80 leading-tight max-w-[140px] truncate">{user?.email || ''}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <button
            onClick={handleLogout}
            title="Đăng xuất khỏi hệ thống"
            className="p-1.5 text-emerald-100 hover:text-white rounded-lg hover:bg-[#0e8046] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
