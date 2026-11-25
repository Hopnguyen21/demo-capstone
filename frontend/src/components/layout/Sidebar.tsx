import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import {
  LayoutDashboard, Building2, Database, Users, Sprout, Cpu, Radio, Activity,
  ShieldAlert, Settings, Wrench, Package, CpuIcon, MapPin, Gauge,
  Sliders, Calendar, Bot, FileText, ClipboardList, PackageCheck, Headphones,
  ChevronRight, ChevronLeft, FileCheck, BookOpen, X, Tag
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('smartfarm_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('smartfarm_sidebar_collapsed', String(isCollapsed));
    } catch {
      // Ignore storage restrictions; sidebar still works for the current session.
    }
  }, [isCollapsed]);

  const adminNav: NavItem[] = [
    { title: 'Platform Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Tiếp nhận & Phân công', path: '/admin/requests', icon: <ClipboardList size={18} /> },
    { title: 'Khảo sát Thực địa', path: '/admin/field-surveys', icon: <FileText size={18} /> },
    { title: 'Quản lý Tenants', path: '/admin/tenants', icon: <Building2 size={18} /> },
    { title: 'Quản lý Người dùng', path: '/admin/users', icon: <Users size={18} /> },
    { title: 'Gói Duy Trì Dịch Vụ', path: '/admin/contract-packages', icon: <PackageCheck size={18} /> },
    { title: 'Hóa Đơn Thu Phí', path: '/admin/bills', icon: <FileCheck size={18} /> },
    { title: 'Mã Giảm Giá & Ưu Đãi', path: '/admin/discount-codes', icon: <Tag size={18} /> },
    { title: 'Thư viện Giống Cây', path: '/admin/crops', icon: <Sprout size={18} /> },
    { title: 'Quy chuẩn VietGAP', path: '/admin/vietgap', icon: <FileText size={18} /> },
    { title: 'Hồ sơ Sinh trưởng', path: '/admin/growth-profiles', icon: <Activity size={18} /> },
    { title: 'Kho Vật tư & Linh kiện', path: '/admin/devices', icon: <Package size={18} /> },
    { title: 'Quản lý Firmware', path: '/admin/firmware', icon: <Cpu size={18} />, badge: 'OTA' },
    { title: 'Sức khỏe Máy chủ & IoT', path: '/admin/system-health', icon: <Radio size={18} /> },
    { title: 'Nhật ký Audit Logs', path: '/admin/audit-logs', icon: <ShieldAlert size={18} /> },
    { title: 'Sao lưu & Khôi phục', path: '/admin/backup-restore', icon: <Database size={18} /> },
    { title: 'Cấu hình Platform', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  const techNav: NavItem[] = [
    { title: 'Trung tâm Kỹ thuật', path: '/technician/dashboard', icon: <Wrench size={18} /> },
    { title: 'Khảo sát Thực địa', path: '/technician/field-surveys', icon: <FileText size={18} /> },
    { title: 'Yêu cầu Lắp đặt (Chấm Node)', path: '/technician/provisioning', icon: <CpuIcon size={18} /> },
    { title: 'Yêu cầu Bảo trì (Chấm Node)', path: '/technician/maintenance', icon: <Wrench size={18} /> },
    { title: 'Gói Duy Trì Dịch Vụ', path: '/technician/contract-packages', icon: <PackageCheck size={18} /> },
    { title: 'Hóa Đơn Thu Phí', path: '/technician/bills', icon: <FileCheck size={18} /> },
    { title: 'Chẩn đoán Node & Cảm biến', path: '/technician/devices', icon: <Activity size={18} /> },
    { title: 'Kho Vật tư Linh kiện', path: '/technician/inventory', icon: <Package size={18} /> },
    { title: 'Chuẩn bị phần cứng', path: '/technician/hardware-preparation', icon: <Wrench size={18} /> },
    { title: 'Kích hoạt Gateway', path: '/technician/gateway-enrollment', icon: <Radio size={18} /> },
    { title: 'Báo cáo Kỹ thuật', path: '/technician/reports', icon: <FileText size={18} /> },
  ];

  const ownerNav: NavItem[] = [
    { title: 'Tổng quan Trang trại', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
    { title: 'Quản lý Nông trang', path: '/owner/farms', icon: <Building2 size={18} /> },
    { title: 'Vụ Mùa & Giống Cây Trồng', path: '/owner/planting-seasons', icon: <Calendar size={18} /> },
    { title: 'Lịch sử Giao dịch & Hóa đơn', path: '/owner/bills', icon: <FileCheck size={18} /> },
    { title: 'Quản lý Nhân công', path: '/owner/farmers', icon: <Users size={18} /> },
    { title: 'Phân công Công việc', path: '/owner/tasks', icon: <ClipboardList size={18} /> },
    { title: 'Trợ lý Nông học AI', path: '/owner/ai', icon: <Bot size={18} /> },
    { title: 'Báo cáo & Phân tích', path: '/owner/reports', icon: <FileText size={18} /> },
    { title: 'Báo cáo Khảo sát Thực địa', path: '/owner/field-surveys', icon: <FileText size={18} /> },
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

  const renderNavContent = (onItemClick?: () => void, collapsed = false, showCollapseButton = false) => (
    <>
      <div className="space-y-1">
        <div className={`h-8 px-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} text-[11px] font-bold text-slate-400 uppercase tracking-wider`}>
          {!collapsed && <span>Menu Chức năng</span>}
          {showCollapseButton && (
            <button
              type="button"
              onClick={() => setIsCollapsed(prev => !prev)}
              className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-[#119653] hover:border-emerald-300 shadow-xs transition-colors"
              aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          )}
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={({ isActive }) => `
              flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl text-xs font-medium transition-all group
              ${isActive
                ? 'bg-[#119653] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-[#119653]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#119653]'} transition-colors`}>{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </div>
                {!collapsed && item.badge ? (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${isActive ? 'bg-[#0e8046] text-white border border-white/20' : 'bg-emerald-50 text-[#119653] border border-emerald-200'}`}>
                    {item.badge}
                  </span>
                ) : !collapsed ? (
                  <ChevronRight size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isActive ? 'text-emerald-100' : 'text-slate-400'}`} />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
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
      <aside className={`hidden lg:flex ${isCollapsed ? 'w-20' : 'w-64'} h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex-col justify-between p-3 select-none overflow-y-auto shadow-xs shrink-0 transition-[width] duration-300`}>
        <div className="flex-1 min-h-0">
          {renderNavContent(undefined, isCollapsed, true)}
        </div>
      </aside>
    </>
  );
};
