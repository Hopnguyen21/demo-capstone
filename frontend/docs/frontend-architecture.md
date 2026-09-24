# SmartFarm Frontend Architecture Documentation

## 1. Executive Summary
SmartFarm is a multi-tenant, AI-powered Smart Agriculture Management SaaS platform. This document outlines the enterprise-grade React 19 + Vite + TypeScript frontend architecture designed to support four distinct user roles:
1. **Platform Admin** (Platform-wide governance)
2. **Platform Technician** (IoT infrastructure, LoRa provisioning & hot-swap maintenance)
3. **Farm Owner** (Tenant Root, Farm/Field/Zone/Crop business operations)
4. **Farmer / Farm Worker** (Tenant Member, localized task execution & assigned zone monitoring)

---

## 2. Technology Stack & Key Libraries
- **Framework:** React 19 + Vite 8
- **Language:** TypeScript 5.x
- **Routing:** React Router v7 (Data Routers with Role Guards)
- **Styling:** Tailwind CSS 3.4+ / Vanilla CSS Tokens (Natural Green & Deep Neutral Theme)
- **UI Primitives:** Radix UI / shadcn design pattern primitives
- **Icons:** Lucide React icons
- **Data Visualization:** Recharts / Chart.js (Crop-aware environmental range bands, sparklines, time-series)
- **GIS / Mapping:** Leaflet & React-Leaflet (Custom Farm/Field/Zone Polygons, LoRa Gateway & Sensor Node markers)
- **State Management & Caching:** TanStack Query (React Query)
- **Form Handling & Validation:** React Hook Form + Zod
- **HTTP Client:** Axios / Fetch API client with automatic JWT refresh and tenant header injection

---

## 3. Project Directory Structure
```
src/
├── app/
│   ├── router/          # Route definitions & Role Guards
│   ├── providers/       # AuthProvider, QueryProvider, ThemeProvider, NotificationProvider
│   ├── guards/          # ProtectedRoute, RoleRoute, TenantGuard
│   └── config/          # Environment & App Config
│
├── assets/              # Static SVG icons, images, illustrations
├── components/
│   ├── ui/              # Base design system components (Button, Input, Select, Badge, Card, Modal, Drawer, Toast, Stepper, RangeBand)
│   ├── layout/          # Topbar, Sidebar, BottomNav, PageContainer, Shell
│   ├── navigation/      # Role-based Sidebar menus, Breadcrumbs, Role Switcher
│   ├── forms/           # FormSection, FormField, MultiStepWizard
│   ├── tables/          # DataTable, FilterBar, Pagination, BulkActions
│   ├── charts/          # RealtimeLineChart, ThresholdRangeChart, DonutGauge, Sparkline
│   ├── maps/            # FarmGISMap, BoundaryDrawer, MarkerInfoPanel
│   ├── dialogs/         # ConfirmDialog, ActionModal, DetailModal
│   └── feedback/        # EmptyState, LoadingSkeleton, ErrorState, 401/403/404 Page
│
├── features/
│   ├── auth/            # Login, Refresh, Forgot/Reset Password, Onboarding
│   ├── dashboard/       # Role-specific Dashboards (Admin, Tech, Owner, Farmer)
│   ├── tenants/         # Tenant management & organization profile
│   ├── users/           # User management & Farmer access control
│   ├── farms/           # Multi-step Farm Wizard, GIS coordinates, Farm settings
│   ├── fields/          # Field boundary & crop assignment
│   ├── zones/           # Zone environmental parameters & target ranges
│   ├── crops/           # Crop library, varieties & growth profiles
│   ├── planting-seasons/# Season timelines & stage transitions
│   ├── gateways/        # Gateway ESP32 status & MAC configuration
│   ├── devices/         # Node, Sensor & Actuator inventory
│   ├── monitoring/      # Real-time & Historical environmental monitoring
│   ├── alerts/          # Alert rules, triggered alerts & notifications
│   ├── control/         # Manual Actuation, Irrigation Schedules & Auto-Rules
│   ├── ai-assistant/    # Gemini Context-aware RAG Chat & Recommendation Cards
│   ├── tasks/           # Work orders & task assignments for farmers
│   ├── inventory/       # Materials stock, low-stock warnings & usage logs
│   ├── maintenance/     # Provisioning, Service Requests & Hot-swap flow
│   ├── reports/         # Exportable Environmental, Water & Energy Analytics
│   └── settings/        # System & Tenant Settings
│
├── hooks/               # Custom hooks (useAuth, useFarmContext, useTelemetry, useAI, useMap)
├── lib/
│   ├── api/             # Central Axios client with interceptors
│   ├── auth/            # Token storage & RBAC utilities
│   ├── validation/      # Zod validation schemas
│   └── utils/           # Date formatters, range validators, GIS convertors
│
├── services/            # API Service Layer mapped 1-to-1 to backend controllers
├── types/               # TypeScript interfaces reflecting DB schema & DTOs
├── mocks/               # Realistic Mock Data engine for offline frontend development
└── pages/
    ├── auth/            # Auth pages
    ├── admin/           # Platform Admin routes
    ├── technician/      # Platform Technician routes
    ├── owner/           # Farm Owner routes
    └── farmer/          # Farmer field routes
```

---

## 4. Multi-Tenant Isolation & Role Authorization Layer
- **Tenant Context:** All requests from Farm Owners and Farmers implicitly attach `X-Tenant-ID` header.
- **RBAC Matrix:**
  - `PLATFORM_ADMIN`: Access to `/admin/*` only.
  - `PLATFORM_TECHNICIAN`: Access to `/technician/*` only.
  - `FARM_OWNER`: Access to `/owner/*` (Tenant Root view).
  - `FARMER`: Access to `/farmer/*` (Restricted to assigned Farms & Zones).
- **Route Protection Component:**
```tsx
<RoleRoute allowedRoles={['FARM_OWNER']}>
  <OwnerDashboardPage />
</RoleRoute>
```
