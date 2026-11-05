import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { UserRole } from '../../types';
import { mockFarms, mockZones, mockWeather, mockAlerts } from '../../mocks/mockData';
import {
  Sprout, Search, Bell, Sun, CloudRain, UserCheck, LogOut,
  ChevronDown, ShieldAlert, CheckCircle2, Layers
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const { user, role, switchRole, selectedFarmId, setSelectedFarmId, selectedZoneId, setSelectedZoneId, logout } = useAuth();
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const weather = mockWeather;
  const activeAlerts = mockAlerts.filter(a => a.status === 'OPEN');

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    PLATFORM_ADMIN: { label: 'Platform Admin', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    PLATFORM_TECHNICIAN: { label: 'Technician', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    FARM_OWNER: { label: 'Farm Owner', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    FARMER: { label: 'Farm Worker', color: 'bg-amber-50 text-amber-800 border-amber-200' },
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
              {mockFarms.map(f => (
                <option key={f.farmId} value={f.farmId} className="bg-[#119653] text-white">{f.name}</option>
              ))}
            </select>

            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="bg-[#0e8046] border border-[#14a85e] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white cursor-pointer"
            >
              {mockZones.map(z => (
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
          >
            <Bell size={17} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-50 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-rose-500" /> Cảnh báo Hệ thống ({activeAlerts.length})
                </span>
                <span className="text-[10px] text-[#119653] font-semibold hover:underline cursor-pointer">Đánh dấu đã đọc</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {mockAlerts.map(a => (
                  <div key={a.alertId} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between font-semibold text-rose-600">
                      <span>{a.title}</span>
                      <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-medium">{a.severity}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{a.message}</p>
                    <span className="text-[9px] text-slate-400 block mt-1">{a.triggeredAt}</span>
                  </div>
                ))}
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
                onClick={() => { switchRole('PLATFORM_ADMIN'); setShowRoleMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-rose-50 text-rose-700 flex items-center justify-between"
              >
                <span>1. Platform Admin</span>
                {role === 'PLATFORM_ADMIN' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => { switchRole('PLATFORM_TECHNICIAN'); setShowRoleMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-sky-50 text-sky-700 flex items-center justify-between"
              >
                <span>2. Platform Technician</span>
                {role === 'PLATFORM_TECHNICIAN' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => { switchRole('FARM_OWNER'); setShowRoleMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-50 text-emerald-700 flex items-center justify-between"
              >
                <span>3. Farm Owner (Tenant Root)</span>
                {role === 'FARM_OWNER' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
              <button
                onClick={() => { switchRole('FARMER'); setShowRoleMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-50 text-amber-700 flex items-center justify-between"
              >
                <span>4. Farmer / Farm Worker</span>
                {role === 'FARMER' && <CheckCircle2 size={13} className="text-[#119653]" />}
              </button>
            </div>
          )}
        </div>

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/20">
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {user?.fullName.charAt(0) || 'U'}
          </div>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="p-1.5 text-emerald-100 hover:text-white rounded-lg hover:bg-[#0e8046] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
