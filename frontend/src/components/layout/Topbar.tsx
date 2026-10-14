import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import { UserRole, Alert } from '../../types';
import { alertService, supportService, notificationService, NotificationItem } from '../../services';
import { mockWeather } from '../../mocks/mockData';
import {
  Sprout, Search, Bell, Sun, CloudRain, UserCheck, LogOut,
  ChevronDown, ShieldAlert, CheckCircle2, Layers, Check, ExternalLink, Clock
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const { user, role, switchRole, selectedFarmId, setSelectedFarmId, selectedZoneId, setSelectedZoneId, logout, farms, zones } = useAuth();
  const navigate = useNavigate();
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchNotifications = async () => {
    try {
      const [list, count] = await Promise.all([
        notificationService.getNotifications(undefined, 1, 15),
        notificationService.getUnreadCount()
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    alertService.getAlerts().then(res => {
      if (res) setAlerts(res);
    }).catch(() => {});

    if (selectedFarmId) {
      supportService.getWeather(selectedFarmId).then((wData: any) => {
        if (wData && wData.temperature !== undefined) {
          const rainProb = wData.precipitationProbability ?? 
                           wData.dailyForecast?.[0]?.precipitationProbability ?? 
                           prevRainProb(wData);
          setWeather(prev => ({
            ...prev,
            temperature: Number(wData.temperature),
            humidity: wData.humidity ? Number(wData.humidity) : prev.humidity,
            condition: wData.weatherDescription ?? prev.condition,
            rainProbability: rainProb !== null && rainProb !== undefined ? Number(rainProb) : prev.rainProbability,
          }));
        }
      }).catch(() => {});
    }
  }, [selectedFarmId]);

  const prevRainProb = (w: any) => {
    if (w.weatherDescription?.toLowerCase().includes('mưa')) return 100;
    return 0;
  };

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

  const [weather, setWeather] = useState(mockWeather);
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

        {/* Farm & Zone Context Selector */}
        {(role === 'FARM_OWNER' || role === 'FARMER') && (
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/20">
            <div className="flex items-center gap-1.5 text-xs text-emerald-100">
              <Layers size={14} className="text-white" />
              <span>Nông trang:</span>
            </div>
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="bg-[#0e8046] border border-[#14a85e] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white cursor-pointer"
            >
              {farms.map(f => (
                <option key={f.farmId} value={f.farmId} className="bg-[#119653] text-white">{f.name}</option>
              ))}
            </select>

            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="bg-[#0e8046] border border-[#14a85e] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white cursor-pointer"
            >
              {zones.map(z => (
                <option key={z.zoneId} value={z.zoneId} className="bg-[#119653] text-white">{z.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-100/80" />
          <input
            type="text"
            placeholder="Tìm kiếm khu vực, thiết bị, loại cây, cảnh báo..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#0e8046] border border-[#14a85e] rounded-lg text-xs text-white placeholder-emerald-100/70 focus:outline-none focus:border-white transition-colors"
          />
        </div>
      </div>

      {/* Right section: Weather, Notifications, Dev Role Switcher, Profile */}
      <div className="flex items-center gap-3">
        {/* Live Weather Widget */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[#0e8046] border border-[#14a85e] rounded-lg text-xs">
          <Sun size={15} className="text-amber-300" />
          <div className="flex flex-col">
            <span className="font-semibold text-white">{weather.temperature}°C Đà Lạt</span>
            <span className="text-[10px] text-emerald-100/90 flex items-center gap-1">
              <CloudRain size={10} className="text-sky-200" /> Mưa: {weather.rainProbability}%
            </span>
          </div>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
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
            <div className="absolute right-0 mt-2 w-88 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-50 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Bell size={14} className="text-[#119653]" /> Thông báo & Cảnh báo
                  {unreadCount > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.2 rounded-full font-semibold">
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
                    className="text-[10px] text-[#119653] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Check size={11} /> Đã đọc tất cả
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {/* Real Notifications from Backend */}
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.notificationId}
                      onClick={async () => {
                        if (!n.isRead) {
                          await notificationService.markAsRead(n.notificationId);
                          fetchNotifications();
                        }
                        if (n.targetUrl) navigate(n.targetUrl);
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        n.isRead
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-80'
                          : 'bg-emerald-50/50 border-emerald-200 font-medium'
                      } hover:bg-emerald-50`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 line-clamp-1">{n.title}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            n.severity === 'Critical'
                              ? 'bg-rose-100 text-rose-700'
                              : n.severity === 'Warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {n.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug line-clamp-2">{n.message}</p>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(n.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(n.createdAtUtc).toLocaleDateString()}
                        </span>
                        {!n.isRead && <span className="text-[#119653] font-semibold text-[9px]">• Mới</span>}
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
            </div>
          )}
        </div>

        {/* Dev Quick Role Switcher */}
        <div className="relative">
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
