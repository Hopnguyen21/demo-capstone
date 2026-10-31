import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { Shell } from '../../components/layout/Shell';
import { HomePage } from '../../pages/public/HomePage';
import { LoginPage } from '../../pages/auth/LoginPage';
import { RegisterPage } from '../../pages/auth/RegisterPage';
import { AdminDashboard } from '../../pages/admin/AdminDashboard';
import { TenantsPage } from '../../pages/admin/TenantsPage';
import { UsersPage } from '../../pages/admin/UsersPage';
import { CropsPage } from '../../pages/admin/CropsPage';
import { VietGapStandardsPage } from '../../pages/admin/VietGapStandardsPage';
import { GrowthProfilesPage } from '../../pages/admin/GrowthProfilesPage';
import { DevicesPage } from '../../pages/admin/DevicesPage';
import { SystemHealthPage } from '../../pages/admin/SystemHealthPage';
import { AuditLogsPage } from '../../pages/admin/AuditLogsPage';
import { SettingsPage } from '../../pages/admin/SettingsPage';

import { TechnicianDashboard } from '../../pages/technician/TechnicianDashboard';
import { ProvisioningPage } from '../../pages/technician/ProvisioningPage';
import { GatewaysPage } from '../../pages/technician/GatewaysPage';
import { MaintenancePage } from '../../pages/technician/MaintenancePage';
import { TechnicianInventoryPage } from '../../pages/technician/InventoryPage';

import { OwnerDashboard } from '../../pages/owner/OwnerDashboard';
import { FarmsPage } from '../../pages/owner/FarmsPage';
import { CreateFarmWizard } from '../../pages/owner/CreateFarmWizard';
import { FieldsPage } from '../../pages/owner/FieldsPage';
import { ZonesPage } from '../../pages/owner/ZonesPage';
import { PlantingSeasonsPage } from '../../pages/owner/PlantingSeasonsPage';
import { MonitoringRealtime } from '../../pages/owner/MonitoringRealtime';
import { MonitoringHistory } from '../../pages/owner/MonitoringHistory';
import { AlertsPage } from '../../pages/owner/AlertsPage';
import { ControlPage } from '../../pages/owner/ControlPage';
import { SchedulesAutomationPage } from '../../pages/owner/SchedulesAutomationPage';
import { FarmersPage } from '../../pages/owner/FarmersPage';
import { TasksPage } from '../../pages/owner/TasksPage';
import { AIAssistantPage } from '../../pages/owner/AIAssistantPage';
import { ReportsPage } from '../../pages/owner/ReportsPage';
import { SupportPage } from '../../pages/owner/SupportPage';

import { FarmerHome } from '../../pages/farmer/FarmerHome';
import { FarmerZonesPage } from '../../pages/farmer/FarmerZonesPage';
import { FarmerTasksPage } from '../../pages/farmer/FarmerTasksPage';
import { FarmerInvitationsPage } from '../../pages/farmer/FarmerInvitationsPage';
import { FarmerIrrigationPage } from '../../pages/farmer/FarmerIrrigationPage';
import { FarmerAIPage } from '../../pages/farmer/FarmerAIPage';

import { ServiceRequestsPage } from '../../pages/admin/ServiceRequestsPage';
import { RouteErrorBoundary } from '../../components/ui/RouteErrorBoundary';

import { UserRole } from '../../types';

const landingByRole: Record<UserRole, string> = {
  PLATFORM_ADMIN: '/admin/dashboard',
  PLATFORM_TECHNICIAN: '/technician/dashboard',
  FARM_OWNER: '/owner/dashboard',
  FARMER: '/farmer/home',
};

const RequireRole: React.FC<{ allowedRoles: UserRole[]; children: React.ReactElement }> = ({ allowedRoles, children }) => {
  const { user, role, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const currentRole = (user.role || role) as UserRole;
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to={landingByRole[currentRole] || '/home'} replace />;
  }

  return children;
};

const RoleBasedRedirect: React.FC = () => {
  const { user, role, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  const currentRole = (user.role || role) as UserRole;
  return <Navigate to={landingByRole[currentRole] || '/home'} replace />;
};

const OwnerOnlyAIAssistant = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === 'FARM_OWNER') return <AIAssistantPage />;
  return <Navigate to={landingByRole[user.role as UserRole] || '/home'} replace />;
};

export const router = createBrowserRouter([
  // Public Landing Homepage (Opens by default on root '/')
  {
    path: '/',
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/home',
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  // Public Auth Pages
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
    errorElement: <RouteErrorBoundary />,
  },
  // Authenticated Portal Layout (Protected by Shell & Role Guards)
  {
    element: <Shell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Admin Routes (Exclusive to PLATFORM_ADMIN)
      { path: '/admin/dashboard', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><AdminDashboard /></RequireRole> },
      { path: '/admin/requests', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><ServiceRequestsPage /></RequireRole> },
      { path: '/admin/tenants', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><TenantsPage /></RequireRole> },
      { path: '/admin/users', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><UsersPage /></RequireRole> },
      { path: '/admin/crops', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><CropsPage /></RequireRole> },
      { path: '/admin/vietgap', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><VietGapStandardsPage /></RequireRole> },
      { path: '/admin/vietgap-standards', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><VietGapStandardsPage /></RequireRole> },
      { path: '/admin/growth-profiles', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><GrowthProfilesPage /></RequireRole> },
      { path: '/admin/devices', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><DevicesPage /></RequireRole> },
      { path: '/admin/system-health', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><SystemHealthPage /></RequireRole> },
      { path: '/admin/audit-logs', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><AuditLogsPage /></RequireRole> },
      { path: '/admin/settings', element: <RequireRole allowedRoles={['PLATFORM_ADMIN']}><SettingsPage /></RequireRole> },

      // Technician Routes (Exclusive to PLATFORM_TECHNICIAN and PLATFORM_ADMIN)
      { path: '/technician/dashboard', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><TechnicianDashboard /></RequireRole> },
      { path: '/technician/deployments', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><TechnicianDashboard /></RequireRole> },
      { path: '/technician/provisioning', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><ProvisioningPage /></RequireRole> },
      { path: '/technician/gateways', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><GatewaysPage /></RequireRole> },
      { path: '/technician/devices', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><GatewaysPage /></RequireRole> },
      { path: '/technician/maintenance', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><MaintenancePage /></RequireRole> },
      { path: '/technician/inventory', element: <RequireRole allowedRoles={['PLATFORM_TECHNICIAN', 'PLATFORM_ADMIN']}><TechnicianInventoryPage /></RequireRole> },

      // Farm Owner Routes (Exclusive to FARM_OWNER and PLATFORM_ADMIN)
      { path: '/owner/dashboard', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><OwnerDashboard /></RequireRole> },
      { path: '/owner/farms', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><FarmsPage /></RequireRole> },
      { path: '/owner/farms/create', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><CreateFarmWizard /></RequireRole> },
      { path: '/owner/fields', element: <Navigate to="/owner/farms" replace /> },
      { path: '/owner/zones', element: <Navigate to="/owner/farms" replace /> },
      { path: '/owner/planting-seasons', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><PlantingSeasonsPage /></RequireRole> },
      { path: '/owner/monitoring/realtime', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><MonitoringRealtime /></RequireRole> },
      { path: '/owner/monitoring/history', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><MonitoringHistory /></RequireRole> },
      { path: '/owner/alerts', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><AlertsPage /></RequireRole> },
      { path: '/owner/control', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><ControlPage /></RequireRole> },
      { path: '/owner/schedules', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><SchedulesAutomationPage /></RequireRole> },
      { path: '/owner/farmers', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><FarmersPage /></RequireRole> },
      { path: '/owner/tasks', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><TasksPage /></RequireRole> },
      { path: '/owner/ai', element: <OwnerOnlyAIAssistant /> },
      { path: '/owner/reports', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><ReportsPage /></RequireRole> },
      { path: '/owner/support', element: <RequireRole allowedRoles={['FARM_OWNER', 'PLATFORM_ADMIN']}><SupportPage /></RequireRole> },

      // Farmer Routes (Accessible to FARMER, FARM_OWNER, and PLATFORM_ADMIN)
      { path: '/farmer/home', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><FarmerHome /></RequireRole> },
      { path: '/farmer/zones', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><FarmerZonesPage /></RequireRole> },
      { path: '/farmer/monitoring', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><MonitoringRealtime /></RequireRole> },
      { path: '/farmer/alerts', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><AlertsPage /></RequireRole> },
      { path: '/farmer/tasks', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><FarmerTasksPage /></RequireRole> },
      { path: '/farmer/invitations', element: <RequireRole allowedRoles={['FARMER']}><FarmerInvitationsPage /></RequireRole> },
      { path: '/farmer/irrigation', element: <RequireRole allowedRoles={['FARMER', 'FARM_OWNER', 'PLATFORM_ADMIN']}><FarmerIrrigationPage /></RequireRole> },
      { path: '/farmer/ai', element: <RequireRole allowedRoles={['FARMER']}><FarmerAIPage /></RequireRole> },
      { path: '*', element: <RoleBasedRedirect /> },
    ],
  },
]);
