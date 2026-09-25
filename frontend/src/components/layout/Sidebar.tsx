import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthContext';
import {
  LayoutDashboard, Building2, Users, Sprout, Cpu, Radio, Activity,
  ShieldAlert, Settings, Wrench, Package, CpuIcon, MapPin, Gauge,
  Sliders, Calendar, Bot, FileText, ClipboardList, PackageCheck, Headphones,
  ChevronRight
} from 'lucide-react';

export interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { role } = useAuth();

  const adminNav: NavItem[] = [
    { title: 'Platform Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Tiếp nhận & Phân công', path: '/admin/requests', icon: <ClipboardList size={18} />, badge: 'CF1' },
    { title: 'Quản lý Tenants', path: '/admin/tenants', icon: <Building2 size={18} /> },
    { title: 'Quản lý Người dùng', path: '/admin/users', icon: <Users size={18} /> },
    { title: 'Thư viện Giống Cây', path: '/admin/crops', icon: <Sprout size={18} /> },
    { title: 'Hồ sơ Sinh trưởng', path: '/admin/growth-profiles', icon: <Activity size={18} /> },
    { title: 'Danh mục Thiết bị IoT', path: '/admin/devices', icon: <Cpu size={18} /> },
    { title: 'Sức khỏe Máy chủ & IoT', path: '/admin/system-health', icon: <Radio size={18} /> },
    { title: 'Nhật ký Audit Logs', path: '/admin/audit-logs', icon: <ShieldAlert size={18} /> },
    { title: 'Cấu hình Platform', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  const techNav: NavItem[] = [
    { title: 'Trung tâm Kỹ thuật', path: '/technician/dashboard', icon: <Wrench size={18} /> },
    { title: 'Yêu cầu Triển khai', path: '/technician/deployments', icon: <PackageCheck size={18} />, badge: 'Mới' },
    { title: 'Cấp phát Thiết bị (QR)', path: '/technician/provisioning', icon: <CpuIcon size={18} /> },
    { title: 'Quản lý Gateway ESP32', path: '/technician/gateways', icon: <Radio size={18} /> },
    { title: 'Chẩn đoán Node & Cảm biến', path: '/technician/devices', icon: <Activity size={18} /> },
    { title: 'Bảo trì & Thay thế Hot-Swap', path: '/technician/maintenance', icon: <Wrench size={18} /> },
    { title: 'Kho Vật tư Linh kiện', path: '/technician/inventory', icon: <Package size={18} /> },
    { title: 'Báo cáo Kỹ thuật', path: '/technician/reports', icon: <FileText size={18} /> },
  ];

  const ownerNav: NavItem[] = [
    { title: 'Tổng quan Trang trại', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Quản lý Nông trang', path: '/owner/farms', icon: <Building2 size={18} />, badge: 'CF1' },
    { title: 'Cây trồng & Vụ mùa', path: '/owner/planting-seasons', icon: <Calendar size={18} /> },
    { title: 'Giám sát Vi khí hậu', path: '/owner/monitoring/realtime', icon: <Gauge size={18} /> },
    { title: 'Bản đồ GIS Số', path: '/owner/map', icon: <MapPin size={18} /> },
    { title: 'Trung tâm Cảnh báo', path: '/owner/alerts', icon: <ShieldAlert size={18} />, badge: '2' },
    { title: 'Điều khiển Tưới tiêu', path: '/owner/control', icon: <Sliders size={18} /> },
    { title: 'Lập lịch & Luật Tự động', path: '/owner/schedules', icon: <Calendar size={18} /> },
    { title: 'Quản lý Nhân công', path: '/owner/farmers', icon: <Users size={18} /> },
    { title: 'Phân công Công việc', path: '/owner/tasks', icon: <ClipboardList size={18} /> },
    { title: 'Kho Vật tư & Phân bón', path: '/owner/inventory', icon: <Package size={18} /> },
    { title: 'Trợ lý Nông học AI', path: '/owner/ai', icon: <Bot size={18} />, badge: 'AI' },
    { title: 'Báo cáo & Phân tích', path: '/owner/reports', icon: <FileText size={18} /> },
    { title: 'Yêu cầu Hỗ trợ Kỹ thuật', path: '/owner/support', icon: <Headphones size={18} /> },
  ];

  const farmerNav: NavItem[] = [
    { title: 'Trang chủ Thực địa', path: '/farmer/home', icon: <LayoutDashboard size={18} /> },
    { title: 'Khu vực được Phân công', path: '/farmer/zones', icon: <Sprout size={18} /> },
    { title: 'Theo dõi Vi khí hậu', path: '/farmer/monitoring', icon: <Gauge size={18} /> },
    { title: 'Cảnh báo Nông nghiệp', path: '/farmer/alerts', icon: <ShieldAlert size={18} /> },
    { title: 'Danh sách Tác vụ', path: '/farmer/tasks', icon: <ClipboardList size={18} /> },
    { title: 'Tưới thủ công', path: '/farmer/irrigation', icon: <Sliders size={18} /> },
    { title: 'Hỏi đáp Trợ lý AI', path: '/farmer/ai', icon: <Bot size={18} /> },
  ];

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'PLATFORM_ADMIN': return adminNav;
      case 'PLATFORM_TECHNICIAN': return techNav;
      case 'FARM_OWNER': return ownerNav;
      case 'FARMER': return farmerNav;
      default: return ownerNav;
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex flex-col justify-between p-3 select-none overflow-y-auto shadow-sm">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Menu Chức năng
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group
              ${isActive
                ? 'bg-[#119653] text-white font-semibold shadow-sm'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-[#119653]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#119653]'} transition-colors`}>{item.icon}</span>
                  <span>{item.title}</span>
                </div>
                {item.badge ? (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isActive ? 'bg-[#0e8046] text-white border border-white/20' : 'bg-emerald-50 text-[#119653] border border-emerald-200'}`}>
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-emerald-100' : 'text-slate-400'}`} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Sidebar Footer info */}
      <div className="pt-3 mt-3 border-t border-slate-100 text-[10px] text-slate-400 px-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">SmartFarm Web v4.0</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <p className="mt-0.5 text-slate-400">TimescaleDB + Gemini 1.5</p>
      </div>
    </aside>
  );
};
