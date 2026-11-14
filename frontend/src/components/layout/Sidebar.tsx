import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import {
  LayoutDashboard, Building2, Database, Users, Sprout, Cpu, Radio, Activity,
  ShieldAlert, Settings, Wrench, Package, CpuIcon, MapPin, Gauge,
  Sliders, Calendar, Bot, FileText, ClipboardList, PackageCheck, Headphones,
  ChevronRight, FileCheck, BookOpen, X
} from 'lucide-react';

export interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const adminNav: NavItem[] = [
    { title: 'Platform Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Tiếp nhận & Phân công', path: '/admin/requests', icon: <ClipboardList size={18} />, badge: 'CF1' },
    { title: 'Quản lý Tenants', path: '/admin/tenants', icon: <Building2 size={18} /> },
    { title: 'Quản lý Người dùng', path: '/admin/users', icon: <Users size={18} /> },
    { title: 'Gói Hợp Đồng Canh Tác', path: '/admin/contract-packages', icon: <PackageCheck size={18} />, badge: 'Mới' },
    { title: 'Hóa Đơn Thu Phí', path: '/admin/bills', icon: <FileCheck size={18} /> },
    { title: 'Nhập & Xuất Kho IoT', path: '/admin/stock-outs', icon: <Package size={18} /> },
    { title: 'Thư viện Giống Cây', path: '/admin/crops', icon: <Sprout size={18} /> },
    { title: 'Quy chuẩn VietGAP', path: '/admin/vietgap', icon: <FileText size={18} />, badge: 'TCVN' },
    { title: 'Hồ sơ Sinh trưởng', path: '/admin/growth-profiles', icon: <Activity size={18} /> },
    { title: 'Kho Vật tư & Linh kiện', path: '/admin/devices', icon: <Package size={18} />, badge: 'Kho' },
    { title: 'Sức khỏe Máy chủ & IoT', path: '/admin/system-health', icon: <Radio size={18} /> },
    { title: 'Nhật ký Audit Logs', path: '/admin/audit-logs', icon: <ShieldAlert size={18} /> },
    { title: 'Sao lưu & Khôi phục', path: '/admin/backup-restore', icon: <Database size={18} /> },
    { title: 'Cấu hình Platform', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  const techNav: NavItem[] = [
    { title: 'Trung tâm Kỹ thuật', path: '/technician/dashboard', icon: <Wrench size={18} /> },
    { title: 'Yêu cầu Lắp đặt (Chấm Node)', path: '/technician/provisioning', icon: <CpuIcon size={18} />, badge: '⚡ Mới' },
    { title: 'Yêu cầu Bảo trì (Chấm Node)', path: '/technician/maintenance', icon: <Wrench size={18} />, badge: '🛠️ Hot-Swap' },
    { title: 'Gói Hợp Đồng Canh Tác', path: '/technician/contract-packages', icon: <PackageCheck size={18} />, badge: 'Gói' },
    { title: 'Hóa Đơn Thu Phí', path: '/technician/bills', icon: <FileCheck size={18} /> },
    { title: 'Nhập & Xuất Kho IoT', path: '/technician/stock-outs', icon: <Package size={18} /> },
    { title: 'Quản lý Gateway ESP32', path: '/technician/gateways', icon: <Radio size={18} /> },
    { title: 'Chẩn đoán Node & Cảm biến', path: '/technician/devices', icon: <Activity size={18} /> },
    { title: 'Kho Vật tư Linh kiện', path: '/technician/inventory', icon: <Package size={18} /> },
  ];

  const ownerNav: NavItem[] = [
    { title: 'Tổng quan Trang trại', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Quản lý Nông trang', path: '/owner/farms', icon: <Building2 size={18} />, badge: 'CF1' },
    { title: 'Lịch sử Giao dịch & Hóa đơn', path: '/owner/bills', icon: <FileCheck size={18} /> },
    { title: 'Cây trồng & Vụ mùa', path: '/owner/planting-seasons', icon: <Calendar size={18} /> },
    { title: 'Giám sát Vi khí hậu', path: '/owner/monitoring/realtime', icon: <Gauge size={18} /> },
    { title: 'Trung tâm Cảnh báo', path: '/owner/alerts', icon: <ShieldAlert size={18} />, badge: '2' },
    { title: 'Điều khiển Tưới tiêu', path: '/owner/control', icon: <Sliders size={18} /> },
    { title: 'Lập lịch & Luật Tự động', path: '/owner/schedules', icon: <Calendar size={18} /> },
    { title: 'Quản lý Nhân công', path: '/owner/farmers', icon: <Users size={18} /> },
    { title: 'Phân công Công việc', path: '/owner/tasks', icon: <ClipboardList size={18} /> },
    { title: 'Trợ lý Nông học AI', path: '/owner/ai', icon: <Bot size={18} />, badge: 'AI' },
    { title: 'Báo cáo & Phân tích', path: '/owner/reports', icon: <FileText size={18} /> },
    { title: 'Yêu cầu Hỗ trợ Kỹ thuật', path: '/owner/support', icon: <Headphones size={18} /> },
  ];

  const farmerNav: NavItem[] = [
    { title: 'Trang chủ Thực địa', path: '/farmer/home', icon: <LayoutDashboard size={18} /> },
    { title: 'Khu vực được Phân công', path: '/farmer/zones', icon: <Sprout size={18} /> },
    { title: 'Theo dõi Vi khí hậu', path: '/farmer/monitoring', icon: <Gauge size={18} /> },
    { title: 'Cảnh báo Nông nghiệp', path: '/farmer/alerts', icon: <ShieldAlert size={18} /> },
    { title: 'Công việc của tôi', path: '/farmer/tasks', icon: <ClipboardList size={18} /> },
    { title: 'Lời mời tham gia Farm', path: '/farmer/invitations', icon: <Users size={18} /> },
    { title: 'Tưới thủ công', path: '/farmer/irrigation', icon: <Sliders size={18} /> },
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

  const renderNavContent = (onItemClick?: () => void) => (
    <>
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Menu Chức năng
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={({ isActive }) => `
              flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group
              ${isActive
                ? 'bg-[#119653] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-[#119653]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#119653]'} transition-colors`}>{item.icon}</span>
                  <span className="truncate">{item.title}</span>
                </div>
                {item.badge ? (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${isActive ? 'bg-[#0e8046] text-white border border-white/20' : 'bg-emerald-50 text-[#119653] border border-emerald-200'}`}>
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`} />
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
        <p className="mt-0.5 text-slate-400">PostgreSQL + Gemini 2.5</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 lg:hidden backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer (Slide-over) */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-50 flex flex-col justify-between p-4 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#119653] text-white shadow-xs">
              <Sprout size={18} />
            </div>
            <span className="font-bold text-sm text-slate-900">Danh mục Chức năng</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {renderNavContent(onClose)}
        </div>
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex-col justify-between p-3 select-none overflow-y-auto shadow-xs shrink-0">
        {renderNavContent()}
      </aside>
    </>
  );
};
