import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthContext';
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
import { FarmerIrrigationPage } from '../../pages/farmer/FarmerIrrigationPage';

import { ServiceRequestsPage } from '../../pages/admin/ServiceRequestsPage';
import { RouteErrorBoundary } from '../../components/ui/RouteErrorBoundary';

const OwnerOnlyAIAssistant = () => {
  const { user } = useAuth();
  if (user?.role === 'FARM_OWNER') return <AIAssistantPage />;
  if (!user) return <Navigate to="/login" replace />;

  const landingByRole = {
    PLATFORM_ADMIN: '/admin/dashboard',
    PLATFORM_TECHNICIAN: '/technician/dashboard',
    FARM_OWNER: '/owner/dashboard',
    FARMER: '/farmer/home',
  } as const;
  return <Navigate to={landingByRole[user.role]} replace />;
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
  // Authenticated Portal Layout (Protected by Shell)
  {
    element: <Shell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Admin Routes
      { path: '/admin/dashboard', element: <AdminDashboard /> },
      { path: '/admin/requests', element: <ServiceRequestsPage /> },
      { path: '/admin/tenants', element: <TenantsPage /> },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/crops', element: <CropsPage /> },
      { path: '/admin/vietgap', element: <VietGapStandardsPage /> },
      { path: '/admin/growth-profiles', element: <GrowthProfilesPage /> },
      { path: '/admin/devices', element: <DevicesPage /> },
      { path: '/admin/system-health', element: <SystemHealthPage /> },
      { path: '/admin/audit-logs', element: <AuditLogsPage /> },
      { path: '/admin/settings', element: <SettingsPage /> },

      // Technician Routes
      { path: '/technician/dashboard', element: <TechnicianDashboard /> },
      { path: '/technician/deployments', element: <TechnicianDashboard /> },
      { path: '/technician/provisioning', element: <ProvisioningPage /> },
      { path: '/technician/gateways', element: <GatewaysPage /> },
      { path: '/technician/devices', element: <GatewaysPage /> },
      { path: '/technician/maintenance', element: <MaintenancePage /> },
      { path: '/technician/inventory', element: <TechnicianInventoryPage /> },

      // Farm Owner Routes
      { path: '/owner/dashboard', element: <OwnerDashboard /> },
      { path: '/owner/farms', element: <FarmsPage /> },
      { path: '/owner/farms/create', element: <CreateFarmWizard /> },
      { path: '/owner/fields', element: <Navigate to="/owner/farms" replace /> },
      { path: '/owner/zones', element: <Navigate to="/owner/farms" replace /> },
      { path: '/owner/planting-seasons', element: <PlantingSeasonsPage /> },
      { path: '/owner/monitoring/realtime', element: <MonitoringRealtime /> },
      { path: '/owner/monitoring/history', element: <MonitoringHistory /> },
      { path: '/owner/alerts', element: <AlertsPage /> },
      { path: '/owner/control', element: <ControlPage /> },
      { path: '/owner/schedules', element: <SchedulesAutomationPage /> },
      { path: '/owner/farmers', element: <FarmersPage /> },
      { path: '/owner/tasks', element: <TasksPage /> },
      { path: '/owner/ai', element: <OwnerOnlyAIAssistant /> },
      { path: '/owner/reports', element: <ReportsPage /> },
      { path: '/owner/support', element: <SupportPage /> },

      // Farmer Routes
      { path: '/farmer/home', element: <FarmerHome /> },
      { path: '/farmer/zones', element: <FarmerZonesPage /> },
      { path: '/farmer/monitoring', element: <MonitoringRealtime /> },
      { path: '/farmer/alerts', element: <AlertsPage /> },
      { path: '/farmer/tasks', element: <FarmerTasksPage /> },
      { path: '/farmer/irrigation', element: <FarmerIrrigationPage /> },
      { path: '*', element: <Navigate to="/owner/dashboard" replace /> },
    ],
  },
]);
